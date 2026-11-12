import { decodePDFRawStream, PDFArray, PDFDict, PDFName, PDFRawStream, PDFStream, type PDFPage } from "pdf-lib";

const name = (value: string) => PDFName.of(value);

// A page with no images or drawings and an almost empty content stream shows nothing.
const EMPTY_CONTENT_MAX_BYTES = 24;
// An image this big fills a page: a scan or a phone photo. Logos are far smaller.
const PICTURE_MIN_PIXELS = 250_000;
// Text render mode 3 = invisible text. Scanner apps lay it over the photo as their
// own quick OCR, which can be wrong (decision log #43).
const INVISIBLE_TEXT = /(^|\s)3\s+Tr(\s|$)/;

function contentStreams(page: PDFPage): PDFStream[] {
  const contents = page.node.Contents();
  const items = contents instanceof PDFArray ? contents.asArray().map((item) => page.doc.context.lookup(item)) : [contents];
  return items.filter((item): item is PDFStream => item instanceof PDFStream);
}

function contentText(page: PDFPage): string {
  return contentStreams(page)
    .map((stream) => {
      if (!(stream instanceof PDFRawStream)) return "";
      try {
        return Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
      } catch {
        return "";
      }
    })
    .join("\n");
}

function largestImagePixels(page: PDFPage): number {
  const xObjects = page.node.Resources()?.lookup(name("XObject"));
  if (!(xObjects instanceof PDFDict)) return 0;
  let largest = 0;
  for (const key of xObjects.keys()) {
    const object = xObjects.lookup(key);
    if (!(object instanceof PDFStream) || object.dict.get(name("Subtype")) !== name("Image")) continue;
    const width = Number(object.dict.get(name("Width"))?.toString() ?? 0);
    const height = Number(object.dict.get(name("Height"))?.toString() ?? 0);
    largest = Math.max(largest, width * height);
  }
  return largest;
}

export function isEmptyPage(page: PDFPage): boolean {
  const xObjects = page.node.Resources()?.lookup(name("XObject"));
  if (xObjects instanceof PDFDict && xObjects.keys().length > 0) return false; // has images or drawings
  const size = contentStreams(page).reduce((total, stream) => total + stream.getContentsSize(), 0);
  return size <= EMPTY_CONTENT_MAX_BYTES;
}

// A scan or photo saved as PDF. Its text, if any, came from a scanner app, so the
// page goes to our OCR instead of trusting that text.
export function isPicturePage(page: PDFPage): boolean {
  return largestImagePixels(page) >= PICTURE_MIN_PIXELS || INVISIBLE_TEXT.test(contentText(page));
}
