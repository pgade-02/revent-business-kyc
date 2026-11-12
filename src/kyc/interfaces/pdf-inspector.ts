// Facts about a PDF that intake needs to decide whether it is safe to accept.
export type PdfFacts = {
  pageCount: number;
  emptyPageCount: number; // pages with no text, images or drawings at all
  // Each of these makes the file unsafe to accept (SECURITY §3).
  hasJavaScript: boolean;
  hasEmbeddedFiles: boolean;
  hasFormActions: boolean; // form submit or launch actions
};

export type PdfInspection = { ok: true; facts: PdfFacts } | { ok: false; reason: "ENCRYPTED" | "UNREADABLE" };

export interface PdfInspector {
  inspect(bytes: Uint8Array): Promise<PdfInspection>;
}
