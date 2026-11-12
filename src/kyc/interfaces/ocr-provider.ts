import type { PageText } from "./pdf-text-reader";

export type OcrRequest = {
  bytes: Uint8Array;
  kind: "pdf" | "png" | "jpeg";
  // For a PDF: only these pages (the ones without a text layer). Ignored for images.
  pages?: number[];
};

export type OcrResult = { ok: true; pages: PageText[] } | { ok: false; reason: "TIMEOUT" | "ERROR" };

// Turns pictures of pages into text. The real implementation calls an OCR service.
export interface OcrProvider {
  read(request: OcrRequest): Promise<OcrResult>;
}
