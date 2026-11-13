import type { PageText } from "../interfaces/pdf-text-reader";
import type { CheckResult } from "./check-result";

const CODE = "DOC_UNREADABLE";

export type DocUnreadableInput = {
  documentId: string;
  pages: PageText[] | null; // null = before reading: only the photo itself is checked
  imageSize: { width: number; height: number } | null;
  sharpness: number | null;
  minTextChars: number;
  minImageShortSidePx: number;
  minSharpness: number;
};

// Fails when a photo is too small or too blurred to read reliably, or when almost no text
// could be read from the whole document (dark, cut off, or blank). The photo checks run
// before reading, so a blurred photo costs no OCR. The AI would otherwise guess at blurred
// text and return wrong names and dates. The customer can retake the photo, so it has a message.
export function checkDocUnreadable(input: DocUnreadableInput): CheckResult {
  const { documentId, pages, imageSize, sharpness, minTextChars, minImageShortSidePx, minSharpness } = input;
  const evidence = { documentId, page: 1 };
  const fail = (detail: string): CheckResult => ({
    code: CODE,
    status: "fail",
    detail,
    evidence,
    customerMessageKey: "Checks.DOC_UNREADABLE",
  });

  if (imageSize && Math.min(imageSize.width, imageSize.height) < minImageShortSidePx) {
    return fail(`Image is ${imageSize.width}×${imageSize.height} px; the shorter side is below ${minImageShortSidePx} px.`);
  }
  if (sharpness !== null && sharpness < minSharpness) {
    return fail(`Photo sharpness is ${sharpness}; below ${minSharpness} text is too blurred to read reliably.`);
  }
  if (pages === null) return { code: CODE, status: "pass", detail: "Photo is large and sharp enough to read." };
  const readableChars = pages.reduce((total, page) => total + page.text.replace(/\s/g, "").length, 0);
  if (readableChars < minTextChars) {
    return fail(`Only ${readableChars} characters could be read (minimum ${minTextChars}).`);
  }
  return { code: CODE, status: "pass", detail: `${readableChars} characters read.` };
}
