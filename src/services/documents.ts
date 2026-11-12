import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { UploadLimits } from "@/config/limits";
import type { Database } from "@/db/client";
import {
  countOtherCustomersWithFile,
  insertDocument,
  markDocumentFailed,
  otherFingerprints,
  saveProcessingResult,
  type DocumentRow,
} from "@/db/documents";
import { loadLatestScoringSettings } from "@/db/scoring-settings";
import { checkFileDuplicate } from "@/kyc/checks/file-duplicate";
import { checkFileReused } from "@/kyc/checks/file-reused";
import { todayInDubai } from "@/kyc/dates";
import { checkDocument, type CheckDocumentInput } from "@/kyc/documents/check-document";
import { decideDocumentStatus, type DocumentStatus } from "@/kyc/documents/document-status";
import type { DocumentSlot } from "@/kyc/documents/slots";
import { intakeFile, type AcceptedFile, type IntakeRejection } from "@/kyc/intake/intake-file";
import type { FileStore } from "@/kyc/interfaces/file-store";
import type { ImageProcessor } from "@/kyc/interfaces/image-processor";
import type { PdfInspector } from "@/kyc/interfaces/pdf-inspector";

// Everything the document steps need from outside, passed in so tests can swap any part.
export type DocumentServices = {
  db: Database;
  fileStore: FileStore;
  limits: UploadLimits;
  pdfInspector: PdfInspector;
  imageProcessor: ImageProcessor;
  readers: CheckDocumentInput["readers"];
  now: () => Date;
};

export type UploadResult =
  | { ok: true; documentId: number; sizeBytes: number; pageCount: number }
  | { ok: false; reason: IntakeRejection };

// Step 1 (ARCHITECTURE §2, "Store"): accept or refuse the file, keep it privately,
// and record it as "checking". Fast, so the screen can answer straight away.
export async function uploadDocument(
  services: DocumentServices,
  input: { applicationId: number; slot: DocumentSlot; bytes: Uint8Array },
): Promise<UploadResult> {
  const intake = await intakeFile({
    bytes: input.bytes,
    limits: services.limits,
    pdfInspector: services.pdfInspector,
    imageProcessor: services.imageProcessor,
  });
  if (!intake.ok) return intake;

  const { file } = intake;
  // A random name: the stored file reveals nothing about the customer or the document.
  const fileKey = `applications/${input.applicationId}/${randomUUID()}.${file.kind === "jpeg" ? "jpg" : file.kind}`;
  await services.fileStore.put(fileKey, file.bytes);

  const documentId = await insertDocument(services.db, {
    applicationId: input.applicationId,
    slot: input.slot,
    fileKey,
    fileKind: file.kind,
    sizeBytes: file.bytes.byteLength,
    pageCount: file.pageCount,
    sha256: file.sha256,
    perceptualHash: file.perceptualHash,
    imageWidth: file.imageSize?.width ?? null,
    imageHeight: file.imageSize?.height ?? null,
  });
  return { ok: true, documentId, sizeBytes: file.bytes.byteLength, pageCount: file.pageCount };
}

const fileKind = z.enum(["pdf", "png", "jpeg"]);

// Which pages are scans or photos. Not stored: the PDF is inspected again (quick, no AI),
// so files uploaded before this rule existed are read the same way.
async function picturePagesOf(services: DocumentServices, kind: AcceptedFile["kind"], bytes: Uint8Array): Promise<number[]> {
  if (kind !== "pdf") return [1];
  const inspection = await services.pdfInspector.inspect(bytes);
  return inspection.ok ? inspection.facts.picturePages : [];
}

async function toAcceptedFile(services: DocumentServices, document: DocumentRow, bytes: Uint8Array): Promise<AcceptedFile> {
  const { imageWidth: width, imageHeight: height } = document;
  const kind = fileKind.parse(document.fileKind);
  return {
    kind,
    bytes,
    pageCount: document.pageCount,
    sha256: document.sha256,
    perceptualHash: document.perceptualHash,
    imageSize: width !== null && height !== null ? { width, height } : null,
    picturePages: await picturePagesOf(services, kind, bytes),
  };
}

export type ProcessResult = { status: DocumentStatus | "failed"; customerMessageKeys: string[] };

// Steps 2–5: duplicate checks, then read and check the document, then save one run.
// A crash marks the file "failed" so the customer can try again, and is re-thrown as a bug.
export async function processDocument(services: DocumentServices, document: DocumentRow, ownerId: string): Promise<ProcessResult> {
  const { db, limits } = services;
  try {
    const bytes = await services.fileStore.get(document.fileKey);
    if (!bytes) {
      await markDocumentFailed(db, document.id);
      return { status: "failed", customerMessageKeys: [] };
    }

    const documentId = String(document.id);
    const duplicate = checkFileDuplicate({
      file: { documentId, sha256: document.sha256, perceptualHash: document.perceptualHash },
      otherFilesInApplication: await otherFingerprints(db, document),
      nearDuplicateMaxBits: limits.nearDuplicateMaxBits,
    });
    const reused = checkFileReused({
      documentId,
      otherCustomerApplicationCount: await countOtherCustomersWithFile(db, document.sha256, ownerId),
    });

    const { settings } = await loadLatestScoringSettings(db);
    const outcome = await checkDocument({
      documentId,
      slot: document.slot,
      file: await toAcceptedFile(services, document, bytes),
      today: todayInDubai(services.now()),
      expiresSoonDays: settings.expiresSoonDays,
      readers: services.readers,
      limits,
    });

    const results = [duplicate, reused, ...outcome.results];
    const status = decideDocumentStatus(results, outcome.problem === null);
    await saveProcessingResult(db, document.id, { status, fields: outcome.fields, results });
    return { status, customerMessageKeys: results.flatMap((result) => (result.customerMessageKey ? [result.customerMessageKey] : [])) };
  } catch (error) {
    await markDocumentFailed(db, document.id);
    throw error;
  }
}
