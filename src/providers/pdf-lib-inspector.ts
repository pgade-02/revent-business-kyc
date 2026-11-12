import { PDFDict, PDFDocument, PDFName, PDFStream, type PDFObject } from "pdf-lib";
import type { PdfInspection, PdfInspector } from "@/kyc/interfaces/pdf-inspector";

const name = (value: string) => PDFName.of(value);
// Action types that run code, open other files or programs, or send form data away.
const unsafeActionTypes = [name("JavaScript"), name("Launch"), name("SubmitForm"), name("ImportData"), name("GoToR")];

function dictionaryOf(object: PDFObject): PDFDict | null {
  if (object instanceof PDFDict) return object;
  if (object instanceof PDFStream) return object.dict;
  return null;
}

// Looks at every object in the file, including ones hidden inside compressed object
// streams (pdf-lib unpacks those when it loads), for anything active.
export const pdfLibInspector: PdfInspector = {
  async inspect(bytes): Promise<PdfInspection> {
    let document: PDFDocument;
    let pageCount: number;
    try {
      // ignoreEncryption lets us load it just far enough to see that it is encrypted.
      document = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
      if (document.isEncrypted) return { ok: false, reason: "ENCRYPTED" };
      // pdf-lib loads broken files without complaint and only fails when asked for
      // pages, so counting them belongs inside this try.
      pageCount = document.getPageCount();
    } catch {
      return { ok: false, reason: "UNREADABLE" };
    }
    if (pageCount === 0) return { ok: false, reason: "UNREADABLE" };

    let hasJavaScript = false;
    let hasEmbeddedFiles = false;
    let hasFormActions = false;
    for (const [, object] of document.context.enumerateIndirectObjects()) {
      const dict = dictionaryOf(object);
      if (!dict) continue;
      if (dict.has(name("JS")) || dict.has(name("JavaScript"))) hasJavaScript = true;
      if (dict.has(name("EmbeddedFiles")) || dict.get(name("Type")) === name("EmbeddedFile")) hasEmbeddedFiles = true;
      if (dict.has(name("XFA"))) hasFormActions = true;
      const actionType = dict.get(name("S"));
      if (actionType === name("JavaScript")) hasJavaScript = true;
      else if (actionType && unsafeActionTypes.includes(actionType as PDFName)) hasFormActions = true;
    }

    return {
      ok: true,
      facts: { pageCount, hasJavaScript, hasEmbeddedFiles, hasFormActions },
    };
  },
};
