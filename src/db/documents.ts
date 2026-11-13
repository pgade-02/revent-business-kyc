import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { checkResultSchema, type CheckResult } from "@/kyc/checks/check-result";
import type { FileFingerprint } from "@/kyc/checks/file-duplicate";
import type { DocumentStatus } from "@/kyc/documents/document-status";
import { slotAllowsSeveralFiles, type DocumentSlot } from "@/kyc/documents/slots";
import type { UploadResults } from "@/kyc/scoring/score";
import type { Transaction } from "@/kyc/statements/transaction";
import { extractedFieldsSchema, type ExtractedFields } from "@/kyc/extraction/extract-fields";
import type { Database } from "./client";
import { applications, checkResults, documents, transactions } from "./schema";

export type DocumentRow = typeof documents.$inferSelect;
type NewDocument = Omit<typeof documents.$inferInsert, "id" | "status" | "createdAt" | "replacedAt">;

// Saves a newly uploaded file as "checking". In a one-file box the previous file is
// marked replaced, not deleted, so its history stays for the reviewer.
export async function insertDocument(db: Database, document: NewDocument): Promise<number> {
  return db.transaction(async (tx) => {
    if (!slotAllowsSeveralFiles(document.slot)) {
      await tx
        .update(documents)
        .set({ replacedAt: sql`now()` })
        .where(and(eq(documents.applicationId, document.applicationId), eq(documents.slot, document.slot), isNull(documents.replacedAt)));
    }
    const [saved] = await tx.insert(documents).values(document).returning({ id: documents.id });
    if (!saved) throw new Error("insert returned no row");
    return saved.id;
  });
}

export async function findDocument(db: Database, documentId: number): Promise<DocumentRow | null> {
  const [row] = await db.select().from(documents).where(eq(documents.id, documentId));
  return row ?? null;
}

// Fingerprints of the other current files in the same application, for FILE_DUPLICATE.
export async function otherFingerprints(db: Database, document: DocumentRow): Promise<FileFingerprint[]> {
  const rows = await db
    .select({ id: documents.id, sha256: documents.sha256, perceptualHash: documents.perceptualHash })
    .from(documents)
    .where(and(eq(documents.applicationId, document.applicationId), ne(documents.id, document.id), isNull(documents.replacedAt)));
  return rows.map((row) => ({ documentId: String(row.id), sha256: row.sha256, perceptualHash: row.perceptualHash }));
}

// How many other customers' applications hold this exact file, for FILE_REUSED.
// Only a number leaves this function, never who those customers are.
export async function countOtherCustomersWithFile(db: Database, sha256: string, ownerId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(distinct ${applications.id})::int` })
    .from(documents)
    .innerJoin(applications, eq(documents.applicationId, applications.id))
    .where(and(eq(documents.sha256, sha256), ne(applications.ownerId, ownerId)));
  return row?.count ?? 0;
}

// Records one processing run: every check result, the document's new status and fields, and
// its statement rows. Rows from an earlier run of the same file are replaced, never doubled.
export async function saveProcessingResult(
  db: Database,
  documentId: number,
  run: { status: DocumentStatus; fields: ExtractedFields | null; results: CheckResult[]; transactions?: readonly Transaction[] },
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(transactions).where(eq(transactions.documentId, documentId));
    if (run.transactions && run.transactions.length > 0) {
      await tx.insert(transactions).values(run.transactions.map((row) => ({ documentId, ...row })));
    }
    if (run.results.length > 0) {
      await tx.insert(checkResults).values(
        run.results.map((result) => ({
          documentId,
          code: result.code,
          status: result.status,
          detail: result.detail,
          evidencePage: result.evidence?.page ?? null,
          customerMessageKey: result.customerMessageKey ?? null,
        })),
      );
    }
    await tx.update(documents).set({ status: run.status, fields: run.fields }).where(eq(documents.id, documentId));
  });
}

// Each current file's checks from its latest run, for scoring after Submit.
export async function listLatestUploadResults(db: Database, applicationId: number): Promise<UploadResults[]> {
  const rows = await db
    .select({ id: documents.id, slot: documents.slot })
    .from(documents)
    .where(and(eq(documents.applicationId, applicationId), isNull(documents.replacedAt)))
    .orderBy(documents.id);
  if (rows.length === 0) return [];
  const results = await db
    .select()
    .from(checkResults)
    .where(inArray(checkResults.documentId, rows.map((row) => row.id)))
    .orderBy(desc(checkResults.createdAt));
  return rows.map((row) => {
    const own = results.filter((result) => result.documentId === row.id);
    const latestRun = own[0]?.createdAt;
    const documentId = String(row.id);
    return {
      documentId,
      slot: row.slot,
      results: own
        .filter((result) => result.createdAt === latestRun)
        .map((result) =>
          checkResultSchema.parse({
            code: result.code,
            status: result.status,
            detail: result.detail,
            evidence: result.evidencePage === null ? undefined : { documentId, page: result.evidencePage },
            customerMessageKey: result.customerMessageKey ?? undefined,
          }),
        ),
    };
  });
}

// The fields read from each current file, for the cross-checks after Submit.
export async function listCurrentDocumentFields(db: Database, applicationId: number) {
  const rows = await db
    .select({ id: documents.id, slot: documents.slot, fields: documents.fields })
    .from(documents)
    .where(and(eq(documents.applicationId, applicationId), isNull(documents.replacedAt)))
    .orderBy(documents.id);
  return rows.map((row) => ({ id: String(row.id), slot: row.slot, fields: extractedFieldsSchema.parse(row.fields ?? {}) }));
}

export async function markDocumentFailed(db: Database, documentId: number): Promise<void> {
  await db.update(documents).set({ status: "failed" }).where(eq(documents.id, documentId));
}

export type CurrentDocument = {
  id: number;
  slot: DocumentSlot;
  status: DocumentRow["status"];
  sizeBytes: number;
  pageCount: number;
  customerMessageKeys: string[];
};

// What the upload screens show: current files with the customer messages from their
// latest run. Rows from one run share a timestamp, because now() is fixed per transaction.
export async function listCurrentDocuments(db: Database, applicationId: number): Promise<CurrentDocument[]> {
  const rows = await db
    .select()
    .from(documents)
    .where(and(eq(documents.applicationId, applicationId), isNull(documents.replacedAt)))
    .orderBy(documents.id);
  if (rows.length === 0) return [];

  const results = await db
    .select({ documentId: checkResults.documentId, key: checkResults.customerMessageKey, createdAt: checkResults.createdAt })
    .from(checkResults)
    .where(inArray(checkResults.documentId, rows.map((row) => row.id)))
    .orderBy(desc(checkResults.createdAt));

  return rows.map((row) => {
    const own = results.filter((result) => result.documentId === row.id);
    const latestRun = own[0]?.createdAt;
    const keys = own.filter((result) => result.createdAt === latestRun && result.key).map((result) => result.key ?? "");
    return { id: row.id, slot: row.slot, status: row.status, sizeBytes: row.sizeBytes, pageCount: row.pageCount, customerMessageKeys: keys };
  });
}
