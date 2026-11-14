import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readUploadLimits } from "@/config/limits";
import { openDatabase, type Database } from "@/db/client";
import { findDocument, listCurrentDocuments } from "@/db/documents";
import { checkResults, users } from "@/db/schema";
import { seedDatabase } from "@/db/seed/seed";
import { unavailableOcr } from "@/providers/fakes/fake-ocr-provider";
import { labelledLinesLlm } from "@/providers/fakes/fake-llm-provider";
import { createLocalFileStore } from "@/providers/local-file-store";
import { pdfLibInspector } from "@/providers/pdf-lib-inspector";
import { pdfjsTextReader } from "@/providers/pdfjs-text-reader";
import { sharpImageProcessor } from "@/providers/sharp-image-processor";
import { createApplication } from "@/services/applications";
import { processDocument, uploadDocument, type DocumentServices } from "@/services/documents";
import { makeTextImage, makeTextPdf } from "../fixtures/make-files";
import { syntheticTexts } from "../fixtures/synthetic-documents";

let db: Database;
let storeDir: string;
let services: DocumentServices;
let applicationId: number;

const plan = { term: 36 as const, lines: [{ productId: "wireless-business-headset", quantity: 1, serviceIds: [] }] };

beforeAll(async () => {
  db = await openDatabase();
  await seedDatabase(db);
  storeDir = await mkdtemp(path.join(tmpdir(), "kyc-docs-"));
  services = {
    db,
    fileStore: createLocalFileStore(storeDir),
    limits: readUploadLimits({}),
    pdfInspector: pdfLibInspector,
    imageProcessor: sharpImageProcessor,
    readers: { pdfTextReader: pdfjsTextReader, ocr: unavailableOcr, llm: labelledLinesLlm },
    now: () => new Date("2026-11-12T08:00:00Z"),
  };
  const created = await createApplication(db, "seed-customer", plan);
  if (!created.ok) throw new Error(created.reason);
  applicationId = created.applicationId;
});

afterAll(async () => {
  await db.$client.close();
  await rm(storeDir, { recursive: true, force: true });
});

async function uploadAndProcess(
  slot: Parameters<typeof uploadDocument>[1]["slot"],
  bytes: Uint8Array,
  forApplication = applicationId,
  owner = "seed-customer",
) {
  const uploaded = await uploadDocument(services, { applicationId: forApplication, slot, bytes });
  if (!uploaded.ok) throw new Error(uploaded.reason);
  const document = await findDocument(db, uploaded.documentId);
  if (!document) throw new Error("document not saved");
  return { documentId: uploaded.documentId, result: await processDocument(services, document, owner) };
}

describe("document upload and processing", () => {
  it("checks a digital licence end to end and marks it Ready", async () => {
    const { result } = await uploadAndProcess("trade_licence", await makeTextPdf([syntheticTexts.tradeLicence]));
    expect(result).toEqual({ status: "ready", customerMessageKeys: [] });
  });

  it("asks for a fix when an invoice is put in the bank statement box, and keeps the run's results", async () => {
    const { documentId, result } = await uploadAndProcess("bank_statement", await makeTextPdf([syntheticTexts.invoice]));
    expect(result).toEqual({ status: "needs_fix", customerMessageKeys: ["Checks.DOC_WRONG_TYPE.bank_statement"] });
    const saved = await db.select().from(checkResults).where(eq(checkResults.documentId, documentId));
    // Statement rows need OCR, which this test app does not have: the failed step is recorded.
    expect(saved.map((row) => `${row.code}:${row.status}`)).toEqual([
      "FILE_DUPLICATE:pass",
      "FILE_REUSED:pass",
      "DOC_UNREADABLE:pass",
      "DOC_WRONG_TYPE:fail",
      "DOC_READING:fail",
    ]);
  });

  it("sends a photo to review while no OCR provider is connected", async () => {
    const { result } = await uploadAndProcess("passport", await makeTextImage(syntheticTexts.passport("2031-08-14")));
    expect(result.status).toBe("needs_review");
  });

  it("refuses an unsupported file without saving anything", async () => {
    const result = await uploadDocument(services, { applicationId, slot: "passport", bytes: new TextEncoder().encode("hello") });
    expect(result).toEqual({ ok: false, reason: "UNSUPPORTED_TYPE" });
  });

  it("flags the same file uploaded twice in one application", async () => {
    const bytes = await makeTextPdf([syntheticTexts.taxCertificate("100000000000003")]);
    await uploadAndProcess("tax_certificate", bytes);
    const { result } = await uploadAndProcess("bank_statement", bytes);
    expect(result.customerMessageKeys).toContain("Checks.FILE_DUPLICATE");
  });

  it("replaces the file in a one-file box but keeps several files in the statements box", async () => {
    const current = await listCurrentDocuments(db, applicationId);
    expect(current.filter((document) => document.slot === "tax_certificate")).toHaveLength(1);
    expect(current.filter((document) => document.slot === "bank_statement").length).toBeGreaterThan(1);

    await uploadAndProcess("trade_licence", await makeTextPdf([`${syntheticTexts.tradeLicence}\nPage: 2`]));
    const licences = (await listCurrentDocuments(db, applicationId)).filter((document) => document.slot === "trade_licence");
    expect(licences).toHaveLength(1);
  });

  it("warns the reviewer when another customer's application has the same file", async () => {
    await db.insert(users).values({ id: "test-other-customer", role: "customer", name: "Other Customer", email: "other@demo.example" });
    const other = await createApplication(db, "test-other-customer", plan);
    if (!other.ok) throw new Error(other.reason);
    const bytes = await makeTextPdf([syntheticTexts.bankStatement]);
    await uploadAndProcess("bank_statement", bytes, other.applicationId, "test-other-customer");

    const { documentId } = await uploadAndProcess("bank_statement", bytes);
    const [reused] = await db
      .select()
      .from(checkResults)
      .where(eq(checkResults.documentId, documentId))
      .then((rows) => rows.filter((row) => row.code === "FILE_REUSED"));
    expect(reused).toMatchObject({ status: "warn", customerMessageKey: null });
  });
});
