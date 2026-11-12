import type { PageText } from "../interfaces/pdf-text-reader";
import type { CheckResult } from "./check-result";

const CODE = "DOC_UNREADABLE";

export type DocUnreadableInput = {
  documentId: string;
  pages: PageText[];
  imageSize: { width: number; height: number } | null;
  minTextChars: number;
  minImageShortSidePx: number;
};

// Fails when a photo is too small to read reliably, or when almost no text could be
// read from the whole document (blurred, dark, cut off, or blank). The customer can
// fix it by taking a clearer photo, so it has a message.
export function checkDocUnreadable(input: DocUnreadableInput): CheckResult {
  const { documentId, pages, imageSize, minTextChars, minImageShortSidePx } = input;
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
  const readableChars = pages.reduce((total, page) => total + page.text.replace(/\s/g, "").length, 0);
  if (readableChars < minTextChars) {
    return fail(`Only ${readableChars} characters could be read (minimum ${minTextChars}).`);
  }
  return { code: CODE, status: "pass", detail: `${readableChars} characters read.` };
}
