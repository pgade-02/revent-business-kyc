import { describe, expect, it } from "vitest";
import { readUploadLimits } from "@/config/limits";
import type { ImageProcessor } from "@/kyc/interfaces/image-processor";
import type { PdfFacts, PdfInspector } from "@/kyc/interfaces/pdf-inspector";
import { detectFileType } from "@/kyc/intake/detect-file-type";
import { hammingDistance, sha256Hex } from "@/kyc/intake/hashes";
import { intakeFile } from "@/kyc/intake/intake-file";

const pdfBytes = new TextEncoder().encode("%PDF-1.7 synthetic");
const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const limits = { maxBytes: 1_000, maxPages: 30 };

// Fakes stand in for pdf-lib and sharp, so these tests check only the decisions.
const cleanFacts: PdfFacts = { pageCount: 2, hasJavaScript: false, hasEmbeddedFiles: false, hasFormActions: false };
const pdfSaying = (result: Awaited<ReturnType<PdfInspector["inspect"]>>): PdfInspector => ({ inspect: async () => result });
const imageProcessor: ImageProcessor = {
  clean: async () => ({
    ok: true,
    image: { bytes: new Uint8Array([1, 2, 3]), format: "png", width: 1200, height: 800, perceptualHash: "00ff00ff00ff00ff" },
  }),
};
const intake = (bytes: Uint8Array, pdfInspector = pdfSaying({ ok: true, facts: cleanFacts })) =>
  intakeFile({ bytes, limits, pdfInspector, imageProcessor });

describe("detectFileType", () => {
  it("reads the real type from the first bytes", () => {
    expect(detectFileType(pdfBytes)).toBe("pdf");
    expect(detectFileType(pngBytes)).toBe("png");
    expect(detectFileType(jpegBytes)).toBe("jpeg");
  });

  it("does not trust anything else, such as a Word file or a zip", () => {
    expect(detectFileType(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBeNull();
    expect(detectFileType(new Uint8Array([]))).toBeNull();
  });
});

describe("hashes", () => {
  it("gives the same SHA-256 for the same bytes and a different one after a 1-byte change", () => {
    expect(sha256Hex(pdfBytes)).toBe(sha256Hex(new Uint8Array(pdfBytes)));
    const changed = new Uint8Array(pdfBytes);
    changed[10] = 0x21;
    expect(sha256Hex(changed)).not.toBe(sha256Hex(pdfBytes));
  });

  it("counts differing bits between picture fingerprints", () => {
    expect(hammingDistance("0000000000000000", "0000000000000000")).toBe(0);
    expect(hammingDistance("0000000000000000", "000000000000000f")).toBe(4);
    expect(hammingDistance("0000000000000000", "ffffffffffffffff")).toBe(64);
    expect(hammingDistance("not-a-hash", "0000000000000000")).toBeNull();
  });
});

describe("intakeFile", () => {
  it("accepts a clean PDF as uploaded, with its fingerprint and page count", async () => {
    const result = await intake(pdfBytes);
    expect(result).toEqual({
      ok: true,
      file: { kind: "pdf", bytes: pdfBytes, pageCount: 2, sha256: sha256Hex(pdfBytes), perceptualHash: null, imageSize: null },
    });
  });

  it("stores the cleaned image but fingerprints the image as uploaded", async () => {
    const result = await intake(pngBytes);
    if (!result.ok) throw new Error(result.reason);
    expect(result.file.bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(result.file.sha256).toBe(sha256Hex(pngBytes));
    expect(result.file.perceptualHash).toBe("00ff00ff00ff00ff");
  });

  it.each([
    ["a file over the size limit", new Uint8Array(1_001).fill(0x25), undefined, "TOO_LARGE"],
    ["a file that is not a PDF, JPG or PNG", new TextEncoder().encode("hello"), undefined, "UNSUPPORTED_TYPE"],
    ["a password-protected PDF", pdfBytes, pdfSaying({ ok: false, reason: "ENCRYPTED" }), "PASSWORD_PROTECTED"],
    ["a broken PDF", pdfBytes, pdfSaying({ ok: false, reason: "UNREADABLE" }), "UNREADABLE"],
    ["a PDF over the page limit", pdfBytes, pdfSaying({ ok: true, facts: { ...cleanFacts, pageCount: 31 } }), "TOO_MANY_PAGES"],
    ["a PDF with JavaScript", pdfBytes, pdfSaying({ ok: true, facts: { ...cleanFacts, hasJavaScript: true } }), "ACTIVE_CONTENT"],
    ["a PDF with an attachment", pdfBytes, pdfSaying({ ok: true, facts: { ...cleanFacts, hasEmbeddedFiles: true } }), "ACTIVE_CONTENT"],
    ["a PDF with a form action", pdfBytes, pdfSaying({ ok: true, facts: { ...cleanFacts, hasFormActions: true } }), "ACTIVE_CONTENT"],
  ] as const)("rejects %s", async (_name, bytes, inspector, reason) => {
    expect(await intake(bytes, inspector)).toEqual({ ok: false, reason });
  });
});

describe("readUploadLimits", () => {
  it("has safe defaults when env sets nothing", () => {
    expect(readUploadLimits({})).toEqual({
      maxBytes: 10_485_760,
      maxPages: 30,
      nearDuplicateMaxBits: 5,
      minPageTextChars: 20,
      minDocumentTextChars: 20,
      minImageSidePx: 500,
      llmTimeoutMs: 6_000,
    });
  });

  it("takes values from env, and refuses nonsense", () => {
    expect(readUploadLimits({ UPLOAD_MAX_PAGES: "12" }).maxPages).toBe(12);
    expect(() => readUploadLimits({ UPLOAD_MAX_BYTES: "lots" })).toThrow();
  });
});
