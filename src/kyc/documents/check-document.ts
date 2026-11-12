import type { CheckResult } from "../checks/check-result";
import { checkDocExpired } from "../checks/doc-expired";
import { checkDocExpiresSoon } from "../checks/doc-expires-soon";
import { checkDocUnreadable } from "../checks/doc-unreadable";
import { checkDocWrongType } from "../checks/doc-wrong-type";
import { checkIdFormat } from "../checks/id-format";
import { extractFields, type ExtractedFields } from "../extraction/extract-fields";
import { readPages } from "../extraction/read-pages";
import type { AcceptedFile } from "../intake/intake-file";
import type { LlmProvider } from "../interfaces/llm-provider";
import type { OcrProvider } from "../interfaces/ocr-provider";
import type { PdfTextReader } from "../interfaces/pdf-text-reader";
import { decideDocumentStatus, type DocumentStatus } from "./document-status";
import type { DocumentSlot } from "./slots";

const SLOTS_WITH_EXPIRY: DocumentSlot[] = ["trade_licence", "passport", "emirates_id_back"];

export type CheckDocumentInput = {
  documentId: string;
  slot: DocumentSlot;
  file: AcceptedFile;
  today: string; // Dubai date
  expiresSoonDays: number; // from scoring_settings
  readers: { pdfTextReader: PdfTextReader; ocr: OcrProvider; llm: LlmProvider };
  limits: { minPageTextChars: number; minDocumentTextChars: number; minImageSidePx: number; llmTimeoutMs: number };
};

export type CheckDocumentOutcome = {
  status: DocumentStatus;
  results: CheckResult[];
  fields: ExtractedFields | null;
  ocrPages: number[];
  problem: "OCR_FAILED" | "LLM_UNAVAILABLE" | "INVALID_OUTPUT" | null; // why reading failed, for logs
};

function fieldChecks(input: CheckDocumentInput, fields: ExtractedFields): CheckResult[] {
  const { documentId, slot, today, expiresSoonDays } = input;
  const results: CheckResult[] = [];
  if (SLOTS_WITH_EXPIRY.includes(slot)) {
    results.push(checkDocExpired({ documentId, expiryDate: fields.expiryDate, today }));
    results.push(checkDocExpiresSoon({ documentId, expiryDate: fields.expiryDate, today, expiresSoonDays }));
  }
  const { emiratesIdNumber, trn, iban } = fields;
  if (emiratesIdNumber || trn || iban) results.push(checkIdFormat({ documentId, emiratesId: emiratesIdNumber, trn, iban }));
  return results;
}

// Part 1 for one uploaded file (ARCHITECTURE §2): read the pages, run the quick
// checks, fill the form, check the fields, and decide what the customer sees.
// Cheap code checks run before the AI, so a blurred or wrong document never costs an AI call.
export async function checkDocument(input: CheckDocumentInput): Promise<CheckDocumentOutcome> {
  const { documentId, slot, file, readers, limits } = input;
  const read = await readPages({ file, ...readers, minPageTextChars: limits.minPageTextChars });
  if (!read.ok) return { status: "needs_review", results: [], fields: null, ocrPages: [], problem: "OCR_FAILED" };

  const outcome = (results: CheckResult[], fields: ExtractedFields | null, problem: CheckDocumentOutcome["problem"]) => ({
    status: decideDocumentStatus(results, problem === null),
    results,
    fields,
    ocrPages: read.ocrPages,
    problem,
  });

  const unreadable = checkDocUnreadable({
    documentId,
    pages: read.pages,
    imageSize: file.imageSize,
    minTextChars: limits.minDocumentTextChars,
    minImageShortSidePx: limits.minImageSidePx,
  });
  if (unreadable.status === "fail") return outcome([unreadable], null, null);

  const wrongType = checkDocWrongType({ documentId, slot, pages: read.pages });
  if (wrongType.status === "fail") return outcome([unreadable, wrongType], null, null);

  const extraction = await extractFields({ slot, pages: read.pages, llm: readers.llm, timeoutMs: limits.llmTimeoutMs });
  if (!extraction.ok) return outcome([unreadable, wrongType], null, extraction.reason);

  return outcome([unreadable, wrongType, ...fieldChecks(input, extraction.fields)], extraction.fields, null);
}
