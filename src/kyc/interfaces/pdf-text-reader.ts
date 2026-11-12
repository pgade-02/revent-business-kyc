// Text that is really stored inside a PDF page (its "text layer"). Exact and free,
// so a page that has one never goes to OCR (decision log #1).
export type PageText = { page: number; text: string };

export interface PdfTextReader {
  readPages(bytes: Uint8Array): Promise<PageText[]>;
}
