import { daysBetween } from "../dates";
import type { ExtractedField } from "../extraction/extracted-field";
import type { CheckResult } from "./check-result";

const CODE = "DOC_EXPIRED";

export type DocExpiredInput = {
  documentId: string;
  expiryDate: ExtractedField<string> | undefined; // "YYYY-MM-DD", as read from the document
  today: string; // "YYYY-MM-DD" in Dubai
};

// Fails when the expiry date is before today. A document that expires today is still valid today.
// The customer can fix this by uploading an in-date copy, so it carries a customer message.
export function checkDocExpired({ documentId, expiryDate, today }: DocExpiredInput): CheckResult {
  if (!expiryDate) {
    return { code: CODE, status: "skipped", detail: "No expiry date was found on the document." };
  }

  const evidence = { documentId, page: expiryDate.page };
  const daysLeft = daysBetween(today, expiryDate.value);
  if (daysLeft === null) {
    return { code: CODE, status: "skipped", detail: "The expiry date could not be read as a date.", evidence };
  }

  if (daysLeft < 0) {
    return {
      code: CODE,
      status: "fail",
      detail: `Expired on ${expiryDate.value}, ${-daysLeft} day(s) before today (${today}).`,
      evidence,
      customerMessageKey: "Checks.DOC_EXPIRED",
    };
  }
  return { code: CODE, status: "pass", detail: `Valid until ${expiryDate.value}.`, evidence };
}
