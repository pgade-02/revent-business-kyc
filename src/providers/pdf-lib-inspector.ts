import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFRef,
  PDFStream,
  type PDFObject,
  type PDFPage,
} from "pdf-lib";
import type { PdfInspection, PdfInspector } from "@/kyc/interfaces/pdf-inspector";

const name = (value: string) => PDFName.of(value);
// Action types that run code, open other files or programs, or send form data away.
const unsafeActionTypes = [name("JavaScript"), name("Launch"), name("SubmitForm"), name("ImportData"), name("GoToR")];

// Adobe apps (Acrobat, Adobe Scan) attach a tiny private JSON note to PDFs they save.
// It is the only attachment we accept (decision log #39); any other one is refused.
const ADOBE_NOTE = { relationship: "ADBE_Contact_Private", mimeType: "application/json", maxBytes: 4_096 };

// A page with no images or drawings and an almost empty content stream shows nothing.
const EMPTY_CONTENT_MAX_BYTES = 24;

function dictionaryOf(object: PDFObject): PDFDict | null {
  if (object instanceof PDFDict) return object;
  if (object instanceof PDFStream) return object.dict;
  return null;
}

const nameText = (value: PDFObject | undefined) => (value instanceof PDFName ? value.decodeText() : null);

// The real size once unpacked. The stored size can be tiny for a large, highly
// compressible file, so it cannot be trusted. Unreadable = treated as too large.
function unpackedSize(stream: PDFStream, maxBytes: number): number {
  if (!(stream instanceof PDFRawStream)) return stream.getContentsSize();
  try {
    return decodePDFRawStream(stream).decode().byteLength;
  } catch {
    return maxBytes + 1;
  }
}

// The attached-file streams that are Adobe's own note, by object reference.
function adobeNoteRefs(document: PDFDocument): Set<string> {
  const allowed = new Set<string>();
  for (const [, object] of document.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFDict) || object.get(name("Type")) !== name("Filespec")) continue;
    if (nameText(object.get(name("AFRelationship"))) !== ADOBE_NOTE.relationship) continue;
    const files = object.lookup(name("EF"));
    const ref = files instanceof PDFDict ? files.get(name("F")) : undefined;
    const stream = ref instanceof PDFRef ? document.context.lookup(ref) : undefined;
    if (
      stream instanceof PDFStream &&
      nameText(stream.dict.get(name("Subtype"))) === ADOBE_NOTE.mimeType &&
      unpackedSize(stream, ADOBE_NOTE.maxBytes) <= ADOBE_NOTE.maxBytes &&
      ref instanceof PDFRef
    ) {
      allowed.add(ref.toString());
    }
  }
  return allowed;
}

function isEmptyPage(page: PDFPage): boolean {
  const xObjects = page.node.Resources()?.lookup(name("XObject"));
  if (xObjects instanceof PDFDict && xObjects.keys().length > 0) return false; // has images or drawings
  const contents = page.node.Contents();
  const streams = contents instanceof PDFArray ? contents.asArray().map((item) => page.doc.context.lookup(item)) : [contents];
  const size = streams.reduce((total, stream) => total + (stream instanceof PDFStream ? stream.getContentsSize() : 0), 0);
  return size <= EMPTY_CONTENT_MAX_BYTES;
}

// Looks at every object in the file, including ones hidden inside compressed object
// streams (pdf-lib unpacks those when it loads), for anything active.
export const pdfLibInspector: PdfInspector = {
  async inspect(bytes): Promise<PdfInspection> {
    let document: PDFDocument;
    let pages: PDFPage[];
    try {
      // ignoreEncryption lets us load it just far enough to see that it is encrypted.
      document = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
      if (document.isEncrypted) return { ok: false, reason: "ENCRYPTED" };
      // pdf-lib loads broken files without complaint and only fails when asked for
      // pages, so reading them belongs inside this try.
      pages = document.getPages();
    } catch {
      return { ok: false, reason: "UNREADABLE" };
    }
    if (pages.length === 0) return { ok: false, reason: "UNREADABLE" };

    const allowedNotes = adobeNoteRefs(document);
    let hasJavaScript = false;
    let hasEmbeddedFiles = false;
    let hasFormActions = false;
    for (const [ref, object] of document.context.enumerateIndirectObjects()) {
      const dict = dictionaryOf(object);
      if (!dict) continue;
      if (dict.has(name("JS")) || dict.has(name("JavaScript"))) hasJavaScript = true;
      if (dict.get(name("Type")) === name("EmbeddedFile") && !allowedNotes.has(ref.toString())) hasEmbeddedFiles = true;
      if (dict.has(name("XFA"))) hasFormActions = true;
      const actionType = dict.get(name("S"));
      if (actionType === name("JavaScript")) hasJavaScript = true;
      else if (actionType && unsafeActionTypes.includes(actionType as PDFName)) hasFormActions = true;
    }

    return {
      ok: true,
      facts: {
        pageCount: pages.length,
        emptyPageCount: pages.filter(isEmptyPage).length,
        hasJavaScript,
        hasEmbeddedFiles,
        hasFormActions,
      },
    };
  },
};
