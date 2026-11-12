import type { OcrProvider } from "../interfaces/ocr-provider";
import type { PageText, PdfTextReader } from "../interfaces/pdf-text-reader";
import type { AcceptedFile } from "../intake/intake-file";

export type ReadPagesInput = {
  file: Pick<AcceptedFile, "kind" | "bytes" | "pageCount" | "picturePages">;
  pdfTextReader: PdfTextReader;
  ocr: OcrProvider;
  minPageTextChars: number; // fewer characters than this = no real text layer on that page
};

export type ReadPagesResult =
  | { ok: true; pages: PageText[]; ocrPages: number[] }
  | { ok: false; reason: "OCR_FAILED" };

// Gets the text of every page the cheapest exact way (ARCHITECTURE §2, "Route per page"):
// a PDF page with a text layer is read directly; photos, scans and image-only pages go to OCR.
export async function readPages({ file, pdfTextReader, ocr, minPageTextChars }: ReadPagesInput): Promise<ReadPagesResult> {
  if (file.kind !== "pdf") {
    const result = await ocr.read({ bytes: file.bytes, kind: file.kind });
    return result.ok ? { ok: true, pages: result.pages, ocrPages: [1] } : { ok: false, reason: "OCR_FAILED" };
  }

  const textLayer = await pdfTextReader.readPages(file.bytes).catch((): PageText[] => []);
  const pages: PageText[] = Array.from({ length: file.pageCount }, (_, index) => ({
    page: index + 1,
    text: textLayer.find((page) => page.page === index + 1)?.text ?? "",
  }));

  // A scanned page may carry a scanner app's own hidden text, which can be wrong, so it
  // always goes to OCR. Other pages go only when they have too little real text.
  const ocrPages = pages
    .filter((page) => file.picturePages.includes(page.page) || page.text.trim().length < minPageTextChars)
    .map((page) => page.page);
  if (ocrPages.length === 0) return { ok: true, pages, ocrPages };

  const result = await ocr.read({ bytes: file.bytes, kind: "pdf", pages: ocrPages });
  if (!result.ok) return { ok: false, reason: "OCR_FAILED" };
  const merged = pages.map((page) => result.pages.find((ocrPage) => ocrPage.page === page.page) ?? page);
  return { ok: true, pages: merged, ocrPages };
}
