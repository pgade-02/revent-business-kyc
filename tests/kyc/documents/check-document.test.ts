import { describe, expect, it } from "vitest";
import { checkDocument, type CheckDocumentInput } from "@/kyc/documents/check-document";
import { decideDocumentStatus } from "@/kyc/documents/document-status";
import { sha256Hex } from "@/kyc/intake/hashes";
import type { AcceptedFile } from "@/kyc/intake/intake-file";
import { createFakeOcrProvider } from "@/providers/fakes/fake-ocr-provider";
import { createBrokenLlm, labelledLinesLlm } from "@/providers/fakes/fake-llm-provider";
import { syntheticTexts } from "../../fixtures/synthetic-documents";

// A "photo": its bytes only need to be unique, because the fake OCR looks up its text.
function photo(id: number, size = { width: 1200, height: 800 }, sharpness = 2_000): AcceptedFile {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, id]);
  return { kind: "png", bytes, pageCount: 1, sha256: sha256Hex(bytes), perceptualHash: null, imageSize: size, sharpness, picturePages: [1] };
}

function run(slot: CheckDocumentInput["slot"], text: string, overrides: Partial<CheckDocumentInput> = {}) {
  const file = overrides.file ?? photo(1);
  const ocr = createFakeOcrProvider(new Map([[sha256Hex(file.bytes), [text]]]));
  return checkDocument({
    documentId: "doc_test",
    slot,
    file,
    today: "2026-11-12",
    expiresSoonDays: 60,
    readers: { pdfTextReader: { readPages: async () => [] }, ocr, llm: labelledLinesLlm },
    limits: { minPageTextChars: 20, minDocumentTextChars: 20, minImageSidePx: 500, minSharpness: 250, llmTimeoutMs: 1_000 },
    ...overrides,
  });
}

const codes = (results: { code: string; status: string }[]) => results.map((result) => `${result.code}:${result.status}`);

describe("checkDocument", () => {
  it("marks a good passport Ready, with its fields read", async () => {
    const outcome = await run("passport", syntheticTexts.passport("2031-08-14"));
    expect(outcome.status).toBe("ready");
    expect(outcome.fields?.passportNumber?.value).toBe("X1234567");
    expect(codes(outcome.results)).toEqual(["DOC_UNREADABLE:pass", "DOC_WRONG_TYPE:pass", "PASSPORT_MRZ:pass", "DOC_EXPIRED:pass", "DOC_EXPIRES_SOON:pass"]);
  });

  it("takes the passport's expiry from its machine-readable lines when the printed date was not read", async () => {
    const withoutPrintedExpiry = syntheticTexts.passport("2025-01-10").replace("Date of Expiry: 2025-01-10\n", "");
    const outcome = await run("passport", withoutPrintedExpiry);
    expect(outcome.results.find((result) => result.code === "DOC_EXPIRED")?.status).toBe("fail");
  });

  it("reads a bank statement's rows and checks that they add up", async () => {
    const outcome = await run("bank_statement", syntheticTexts.bankStatement);
    expect(outcome.status).toBe("ready");
    expect(outcome.transactions.map((transaction) => transaction.amountFils)).toEqual([2_000_000, -124_925, -500_000]);
    expect(outcome.results.find((result) => result.code === "STMT_BALANCE")?.status).toBe("pass");
  });

  it("sends a statement to Needs review when its rows cannot be read, never half-counted", async () => {
    const outcome = await run("bank_statement", syntheticTexts.bankStatement.replace("| 20,000.00 |", "| twenty thousand |"));
    expect(outcome).toMatchObject({ status: "needs_review", problem: "INVALID_OUTPUT", transactions: [] });
  });

  it("saves the passport's birth date and nationality from its machine-readable lines", async () => {
    const outcome = await run("passport", syntheticTexts.passport("2031-08-14"));
    expect(outcome.fields?.dateOfBirth?.value).toBe("1980-01-01");
    expect(outcome.fields?.nationality?.value).toBe("GBR");
  });

  it("saves nothing from machine-readable lines whose check digits are wrong", async () => {
    const text = syntheticTexts.passport("2031-08-14");
    const line2 = text.split("\n").at(-1) ?? "";
    const edited = text.replace(line2, line2.replace("800101", "800102"));
    const outcome = await run("passport", edited);
    expect(outcome.results.find((result) => result.code === "PASSPORT_MRZ")?.status).toBe("fail");
    expect(outcome.fields?.dateOfBirth).toBeUndefined();
  });

  it("asks for a fix when the passport has expired", async () => {
    const outcome = await run("passport", syntheticTexts.passport("2025-01-10"));
    expect(outcome.status).toBe("needs_fix");
    expect(outcome.results.find((result) => result.code === "DOC_EXPIRED")?.customerMessageKey).toBe("Checks.DOC_EXPIRED");
  });

  it("asks for the right document but still reads the fields, so later checks can run", async () => {
    const outcome = await run("emirates_id_front", syntheticTexts.emiratesIdBack);
    expect(outcome.status).toBe("needs_fix");
    expect(outcome.results.find((result) => result.code === "DOC_WRONG_TYPE")?.status).toBe("fail");
    expect(outcome.fields?.expiryDate?.value).toBe("2028-02-20");
  });

  it("still tells the customer to replace a wrong document when the AI is unavailable", async () => {
    const outcome = await run("passport", syntheticTexts.foreignIdCard, {
      readers: { pdfTextReader: { readPages: async () => [] }, ocr: createFakeOcrProvider(new Map([[photo(1).sha256, [syntheticTexts.foreignIdCard]]])), llm: createBrokenLlm("unavailable") },
    });
    expect(outcome).toMatchObject({ status: "needs_fix", problem: "LLM_UNAVAILABLE" });
  });

  it("asks for a clearer photo when the picture is too small", async () => {
    const outcome = await run("emirates_id_front", syntheticTexts.emiratesIdFront, { file: photo(2, { width: 400, height: 250 }) });
    expect(outcome.status).toBe("needs_fix");
    expect(codes(outcome.results)).toEqual(["DOC_UNREADABLE:fail"]);
  });

  it("asks for a clearer photo when the picture is blurred, without paying for OCR", async () => {
    const outcome = await run("emirates_id_front", syntheticTexts.emiratesIdFront, { file: photo(3, undefined, 160) });
    expect(outcome.status).toBe("needs_fix");
    expect(codes(outcome.results)).toEqual(["DOC_UNREADABLE:fail"]);
    expect(outcome.ocrPages).toEqual([]);
  });

  it("sends the document for review when the AI answers off-form", async () => {
    const ocr = createFakeOcrProvider(new Map([[photo(1).sha256, [syntheticTexts.passport("2031-08-14")]]]));
    const outcome = await run("passport", "", {
      readers: { pdfTextReader: { readPages: async () => [] }, ocr, llm: createBrokenLlm("off-form") },
    });
    expect(outcome).toMatchObject({ status: "needs_review", problem: "INVALID_OUTPUT", fields: null });
  });

  it("keeps a warning for the reviewer without bothering the customer", async () => {
    const outcome = await run("tax_certificate", syntheticTexts.taxCertificate("10000000000000"));
    expect(outcome.status).toBe("ready");
    expect(outcome.results.find((result) => result.code === "ID_FORMAT")?.status).toBe("warn");
  });
});

describe("decideDocumentStatus", () => {
  it("sends a failed check with no customer message to review", () => {
    expect(decideDocumentStatus([{ code: "X", status: "fail", detail: "" }], true)).toBe("needs_review");
  });
});
