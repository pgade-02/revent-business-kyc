import { PDFDocument, StandardFonts } from "pdf-lib";
import sharp from "sharp";

const escapeXml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// A "phone photo" of a document: the text drawn onto a light card. Real enough to
// open and look at; the fake OCR returns the same text for it.
export async function makeTextImage(text: string, width = 1200, height = 760): Promise<Uint8Array> {
  const fontSize = Math.max(10, Math.round(width / 42));
  const lines = text
    .split("\n")
    .map((line, index) => `<text x="${fontSize * 2}" y="${fontSize * (3 + index * 1.6)}">${escapeXml(line)}</text>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="#f4f1ea"/>
    <g font-family="DejaVu Sans Mono, Consolas, monospace" font-size="${fontSize}" fill="#1d1d1f">${lines}</g>
  </svg>`;
  return new Uint8Array(await sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer());
}

// A real PDF whose pages carry a text layer, so pdfjs reads it exactly like a
// digitally generated licence or bank statement. An empty string = an image-only page.
export async function makeTextPdf(pageTexts: string[]): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (const text of pageTexts) {
    const page = document.addPage([595, 842]);
    if (text) page.drawText(text, { x: 50, y: 780, size: 11, font, lineHeight: 16 });
  }
  return document.save();
}
