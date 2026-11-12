import { getDocument, VerbosityLevel } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PageText, PdfTextReader } from "@/kyc/interfaces/pdf-text-reader";

// Reads the text layer of each page locally: free, instant and exact.
export const pdfjsTextReader: PdfTextReader = {
  async readPages(bytes): Promise<PageText[]> {
    const pdf = await getDocument({
      data: new Uint8Array(bytes), // pdfjs takes over the buffer it is given, so pass a copy
      // pdfjs 5 no longer builds code from fonts, so the old isEvalSupported guard is gone.
      useSystemFonts: false,
      verbosity: VerbosityLevel.ERRORS,
    }).promise;

    try {
      const pages: PageText[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const content = await (await pdf.getPage(pageNumber)).getTextContent();
        const text = content.items.map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : "") : "")).join("");
        pages.push({ page: pageNumber, text });
      }
      return pages;
    } finally {
      await pdf.destroy();
    }
  },
};
