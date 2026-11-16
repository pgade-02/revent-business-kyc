import { and, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Database } from "@/db/client";
import { loadLatestAssessment } from "@/db/assessments";
import { listLatestUploadResults } from "@/db/documents";
import { listInfoRequests } from "@/db/info-requests";
import { loadLatestScoringSettings } from "@/db/scoring-settings";
import { applications, documents, planItems, products, services, users } from "@/db/schema";
import { listTimeline } from "@/db/timeline";
import { DOCUMENT_SLOTS } from "@/kyc/documents/slots";
import { extractedFieldsSchema } from "@/kyc/extraction/extract-fields";
import { documentAdvice } from "@/ops/document-advice";
import { suggestRequestItems } from "@/ops/suggest-request";
import { compareTypedDetails, type ReadBySlot } from "@/ops/typed-vs-document";

const uploader = alias(users, "uploader");
const reviewer = alias(users, "reviewer");

// Lists an application's current documents in checklist order, with who uploaded and reviewed each.
export async function listOpsDocuments(db: Database, applicationId: number) {
  const rows = await db
    .select({
      id: documents.id,
      slot: documents.slot,
      fileKind: documents.fileKind,
      sizeBytes: documents.sizeBytes,
      pageCount: documents.pageCount,
      sha256: documents.sha256,
      uploadedAt: documents.createdAt,
      uploadedByName: uploader.name,
      reviewState: documents.reviewState,
      reviewedByName: reviewer.name,
      reviewedAt: documents.reviewedAt,
      fields: documents.fields,
    })
    .from(documents)
    .leftJoin(uploader, eq(uploader.id, documents.uploadedBy))
    .leftJoin(reviewer, eq(reviewer.id, documents.reviewedBy))
    .where(and(eq(documents.applicationId, applicationId), isNull(documents.replacedAt)));
  return rows.sort((a, b) => DOCUMENT_SLOTS.indexOf(a.slot) - DOCUMENT_SLOTS.indexOf(b.slot));
}

type DocumentWithFields = Awaited<ReturnType<typeof listOpsDocuments>>[number];
const fieldsOf = (row: DocumentWithFields) => {
  const parsed = extractedFieldsSchema.safeParse(row.fields);
  return parsed.success ? parsed.data : null;
};

// Adds each document's result, from its latest checks.
function withAdvice(rows: DocumentWithFields[], uploads: Awaited<ReturnType<typeof listLatestUploadResults>>) {
  return rows.map((row) => {
    const results = uploads.find((upload) => upload.documentId === String(row.id))?.results ?? [];
    return { ...row, advice: documentAdvice(results) };
  });
}

// Gathers the values read from each current document, keyed by its slot.
function readBySlot(rows: DocumentWithFields[]): ReadBySlot {
  return Object.fromEntries(rows.map((row) => [row.slot, fieldsOf(row) ?? {}]));
}

// Lists the plan's products with quantities and the names of their added services.
export async function listPlanLines(db: Database, applicationId: number) {
  const [lines, serviceNames] = await Promise.all([
    db
      .select({ id: planItems.id, productName: products.name, quantity: planItems.quantity, serviceIds: planItems.serviceIds })
      .from(planItems)
      .innerJoin(products, eq(products.id, planItems.productId))
      .where(eq(planItems.applicationId, applicationId))
      .orderBy(planItems.id),
    db.select({ id: services.id, name: services.name }).from(services),
  ]);
  const nameOf = new Map(serviceNames.map((service) => [service.id, service.name]));
  return lines.map(({ serviceIds, ...line }) => ({ ...line, services: serviceIds.map((id) => nameOf.get(id) ?? id) }));
}

// Loads what the application page shows: header, people, plan, document results, typed-vs-document comparisons, a suggested request, requests, timeline and the risk assessment.
export async function loadOpsApplication(db: Database, applicationId: number) {
  const [application] = await db.select().from(applications).where(eq(applications.id, applicationId));
  if (!application) return null;
  const [reviewers, [contact], planLines, documentRows, uploads, { settings }, requests, timeline, assessment] = await Promise.all([
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.role, "reviewer")),
    db.select({ name: users.name, email: users.email, mobile: users.mobile }).from(users).where(eq(users.id, application.ownerId)),
    listPlanLines(db, applicationId),
    listOpsDocuments(db, applicationId),
    listLatestUploadResults(db, applicationId),
    loadLatestScoringSettings(db),
    listInfoRequests(db, applicationId),
    listTimeline(db, applicationId),
    loadLatestAssessment(db, applicationId),
  ]);
  const typed = {
    companyName: application.companyName,
    licenceNumber: application.licenceNumber,
    emirate: application.emirate,
    trn: application.trn,
    signatoryName: application.signatoryName,
  };
  const comparisons = compareTypedDetails(typed, readBySlot(documentRows), settings.nameMatch);
  const resultsOf = (id: number) => uploads.find((upload) => upload.documentId === String(id))?.results ?? [];
  const alreadyAsked = requests.flatMap((request) => request.items.filter((item) => !item.resolvedAt).map((item) => item.subject));
  return {
    application,
    reviewers,
    contact: contact ?? null,
    planLines,
    documents: withAdvice(documentRows, uploads),
    comparisons,
    suggestedRequest: suggestRequestItems({
      documents: documentRows.map((row) => ({ slot: row.slot, reviewState: row.reviewState, results: resultsOf(row.id) })),
      comparisons,
      alreadyAsked,
    }),
    requests,
    timeline,
    assessment,
  };
}
