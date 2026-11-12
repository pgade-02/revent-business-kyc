import { describe, expect, it } from "vitest";
import { readPages } from "@/kyc/extraction/read-pages";
import type { OcrProvider, OcrRequest } from "@/kyc/interfaces/ocr-provider";
import type { PdfTextReader } from "@/kyc/interfaces/pdf-text-reader";

const bytes = new Uint8Array([1, 2, 3]);
const textLayer = (texts: string[]): PdfTextReader => ({
  readPages: async () => texts.map((text, index) => ({ page: index + 1, text })),
});

function recordingOcr(text = "Text read by OCR from the picture") {
  const requests: OcrRequest[] = [];
  const ocr: OcrProvider = {
    async read(request) {
      requests.push(request);
      return { ok: true, pages: (request.pages ?? [1]).map((page) => ({ page, text })) };
    },
  };
  return { ocr, requests };
}

describe("readPages", () => {
  it("reads a digital PDF directly and never calls OCR", async () => {
    const { ocr, requests } = recordingOcr();
    const result = await readPages({
      file: { kind: "pdf", bytes, pageCount: 2 },
      pdfTextReader: textLayer(["Licence Number: CN-1234567 and more text", "Page two has plenty of text too"]),
      ocr,
      minPageTextChars: 20,
    });
    expect(result).toMatchObject({ ok: true, ocrPages: [] });
    expect(requests).toHaveLength(0);
  });

  it("sends only the pages without a text layer to OCR", async () => {
    const { ocr, requests } = recordingOcr();
    const result = await readPages({
      file: { kind: "pdf", bytes, pageCount: 3 },
      pdfTextReader: textLayer(["A page with a proper text layer", "", "A page with a proper text layer"]),
      ocr,
      minPageTextChars: 20,
    });
    expect(requests[0]?.pages).toEqual([2]);
    if (!result.ok) throw new Error("expected pages");
    expect(result.pages[1]?.text).toBe("Text read by OCR from the picture");
    expect(result.ocrPages).toEqual([2]);
  });

  it("sends a photo to OCR", async () => {
    const { ocr, requests } = recordingOcr();
    const result = await readPages({ file: { kind: "jpeg", bytes, pageCount: 1 }, pdfTextReader: textLayer([]), ocr, minPageTextChars: 20 });
    expect(requests[0]?.kind).toBe("jpeg");
    expect(result).toMatchObject({ ok: true, ocrPages: [1] });
  });

  it("reports when OCR is unavailable", async () => {
    const ocr: OcrProvider = { read: async () => ({ ok: false, reason: "TIMEOUT" }) };
    const result = await readPages({ file: { kind: "png", bytes, pageCount: 1 }, pdfTextReader: textLayer([]), ocr, minPageTextChars: 20 });
    expect(result).toEqual({ ok: false, reason: "OCR_FAILED" });
  });
});
