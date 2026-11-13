import { daysBetween } from "../dates";
import type { ExtractedField } from "../extraction/extracted-field";
import type { CheckResult } from "./check-result";

const CODE = "EID_DATES";

export type EidDatesInput = {
  documentId: string;
  issueDate: ExtractedField<string> | undefined; // "YYYY-MM-DD"
  expiryDate: ExtractedField<string> | undefined;
  today: string; // Dubai
};

// A real card is issued on or before today and before it expires. Anything else means
// a date was misread or edited, so a reviewer looks (no customer message).
export function checkEidDates({ documentId, issueDate, expiryDate, today }: EidDatesInput): CheckResult {
  if (!issueDate) return { code: CODE, status: "skipped", detail: "No issue date was found on the card." };
  const evidence = { documentId, page: issueDate.page };

  const issuedDaysAgo = daysBetween(issueDate.value, today);
  if (issuedDaysAgo === null) return { code: CODE, status: "skipped", detail: "The issue date could not be read as a date.", evidence };
  if (issuedDaysAgo < 0) {
    return { code: CODE, status: "fail", detail: `Issue date ${issueDate.value} is after today (${today}).`, evidence };
  }

  if (!expiryDate) return { code: CODE, status: "pass", detail: "Issue date is not in the future; no expiry date to compare." , evidence };
  const validDays = daysBetween(issueDate.value, expiryDate.value);
  if (validDays !== null && validDays <= 0) {
    return { code: CODE, status: "fail", detail: `Issue date ${issueDate.value} is not before expiry date ${expiryDate.value}.`, evidence };
  }
  return { code: CODE, status: "pass", detail: "Issue date is not in the future and is before the expiry date.", evidence };
}
