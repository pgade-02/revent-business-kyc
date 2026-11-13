import type { CheckResult } from "../checks/check-result";
import { checkDocExpired } from "../checks/doc-expired";
import { checkDocExpiresSoon } from "../checks/doc-expires-soon";
import { checkDocUnreadable } from "../checks/doc-unreadable";
import { checkDocWrongType } from "../checks/doc-wrong-type";
import { checkEidDates } from "../checks/eid-dates";
import { checkIdFormat } from "../checks/id-format";
import { checkMrzCheckDigits } from "../checks/mrz-check-digits";
import { checkPassportMrz } from "../checks/passport-mrz";
import { emiratesIdMrzValues, findEmiratesIdMrz } from "../extraction/emirates-id-mrz";
import { extractFields, textField, type ExtractedFields } from "../extraction/extract-fields";
import type { ExtractedField } from "../extraction/extracted-field";
import { findPassportMrz, passportMrzValues } from "../extraction/passport-mrz";
import { readPages } from "../extraction/read-pages";
import type { AcceptedFile } from "../intake/intake-file";
import type { LlmProvider } from "../interfaces/llm-provider";
import type { OcrProvider } from "../interfaces/ocr-provider";
import type { PageText, PdfTextReader } from "../interfaces/pdf-text-reader";
import { decideDocumentStatus, type DocumentStatus } from "./document-status";
import type { DocumentSlot } from "./slots";

const SLOTS_WITH_EXPIRY: DocumentSlot[] = ["trade_licence", "passport", "emirates_id_front", "emirates_id_back"];

export type CheckDocumentInput = {
  documentId: string;
  slot: DocumentSlot;
  file: AcceptedFile;
  today: string; // Dubai date
  expiresSoonDays: number; // from scoring_settings
  readers: { pdfTextReader: PdfTextReader; ocr: OcrProvider; llm: LlmProvider };
  limits: {
    minPageTextChars: number;
    minDocumentTextChars: number;
    minImageSidePx: number;
    minSharpness: number;
    llmTimeoutMs: number;
  };
};

export type CheckDocumentOutcome = {
  status: DocumentStatus;
  results: CheckResult[];
  fields: ExtractedFields | null;
  ocrPages: number[];
  problem: "OCR_FAILED" | "LLM_UNAVAILABLE" | "INVALID_OUTPUT" | null; // why reading failed, for logs
};

function findOnPage<T>(pages: PageText[], find: (text: string) => T | null) {
  for (const page of pages) {
    const mrz = find(page.text);
    if (mrz) return { mrz, page: page.page };
  }
  return null;
}

type MrzRead = { check: CheckResult; fields: Record<string, ExtractedField<string>> };

// Values from the machine-readable lines are kept only when every check digit is right,
// so a misread birth date can never raise a false "different person" warning.
function mrzRead(check: CheckResult, page: number | undefined, values: Record<string, string> | undefined): MrzRead {
  if (check.status !== "pass" || page === undefined || !values) return { check, fields: {} };
  const fields = Object.fromEntries(Object.entries(values).map(([name, value]) => [name, { value, page, confidenceBps: 10_000 }]));
  return { check, fields };
}

function readMrz({ documentId, slot, today }: CheckDocumentInput, pages: PageText[]): MrzRead | null {
  if (slot === "emirates_id_back") {
    const found = findOnPage(pages, findEmiratesIdMrz);
    return mrzRead(checkMrzCheckDigits(documentId, found), found?.page, found ? emiratesIdMrzValues(found.mrz, today) : undefined);
  }
  if (slot === "passport") {
    const found = findOnPage(pages, findPassportMrz);
    return mrzRead(checkPassportMrz(documentId, found), found?.page, found ? passportMrzValues(found.mrz, today) : undefined);
  }
  return null;
}

function fieldChecks(input: CheckDocumentInput, fields: ExtractedFields): CheckResult[] {
  const { documentId, slot, today, expiresSoonDays } = input;
  const results: CheckResult[] = [];
  const expiryDate = textField(fields, "expiryDate");

  if (slot === "emirates_id_front") results.push(checkEidDates({ documentId, issueDate: textField(fields, "issueDate"), expiryDate, today }));
  if (SLOTS_WITH_EXPIRY.includes(slot)) {
    results.push(checkDocExpired({ documentId, expiryDate, today }));
    results.push(checkDocExpiresSoon({ documentId, expiryDate, today, expiresSoonDays }));
  }
  const emiratesIdNumber = textField(fields, "emiratesIdNumber");
  const trn = textField(fields, "trn");
  const iban = textField(fields, "iban");
  if (emiratesIdNumber || trn || iban) results.push(checkIdFormat({ documentId, emiratesId: emiratesIdNumber, trn, iban }));
  return results;
}

// Part 1 for one uploaded file (ARCHITECTURE §2): read the pages, run the quick
// checks, fill the form, check the fields, and decide what the customer sees.
// Cheap code checks run before the AI, so a blurred or wrong document never costs an AI call.
export async function checkDocument(input: CheckDocumentInput): Promise<CheckDocumentOutcome> {
  const { documentId, slot, file, readers, limits } = input;
  const unreadableWith = (pages: PageText[] | null) =>
    checkDocUnreadable({
      documentId,
      pages,
      imageSize: file.imageSize,
      sharpness: file.sharpness,
      minTextChars: limits.minDocumentTextChars,
      minImageShortSidePx: limits.minImageSidePx,
      minSharpness: limits.minSharpness,
    });

  // Too small or blurred: ask for a new photo before paying for OCR.
  const photo = unreadableWith(null);
  if (photo.status === "fail") return { status: decideDocumentStatus([photo], true), results: [photo], fields: null, ocrPages: [], problem: null };

  const read = await readPages({ file, ...readers, minPageTextChars: limits.minPageTextChars });
  if (!read.ok) return { status: "needs_review", results: [], fields: null, ocrPages: [], problem: "OCR_FAILED" };

  const outcome = (results: CheckResult[], fields: ExtractedFields | null, problem: CheckDocumentOutcome["problem"]) => ({
    status: decideDocumentStatus(results, problem === null),
    results,
    fields,
    ocrPages: read.ocrPages,
    problem,
  });

  const unreadable = unreadableWith(read.pages);
  if (unreadable.status === "fail") return outcome([unreadable], null, null);

  const wrongType = checkDocWrongType({ documentId, slot, pages: read.pages });
  if (wrongType.status === "fail") return outcome([unreadable, wrongType], null, null);

  const extraction = await extractFields({ slot, pages: read.pages, llm: readers.llm, timeoutMs: limits.llmTimeoutMs });
  if (!extraction.ok) return outcome([unreadable, wrongType], null, extraction.reason);

  // The printed expiry wins; the back of a current Emirates ID prints none, so the lines fill it in.
  const mrz = readMrz(input, read.pages);
  const fields = { ...mrz?.fields, ...extraction.fields };
  return outcome([unreadable, wrongType, ...(mrz ? [mrz.check] : []), ...fieldChecks(input, fields)], fields, null);
}
