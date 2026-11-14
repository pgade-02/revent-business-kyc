import { daysBetween } from "../dates";
import type { ExtractedField } from "../extraction/extracted-field";
import type { CheckResult } from "./check-result";

const CODE = "DOC_EXPIRES_SOON";

export type DocExpiresSoonInput = {
  documentId: string;
  expiryDate: ExtractedField<string> | undefined;
  today: string;
  expiresSoonDays: number; // from scoring_settings, never a constant here
};

// Warns the reviewer when a still-valid document runs out within `expiresSoonDays`.
// The customer has done nothing wrong, so there is no customer message.
export function checkDocExpiresSoon(input: DocExpiresSoonInput): CheckResult {
  const { documentId, expiryDate, today, expiresSoonDays } = input;
  if (!expiryDate) {
    return { code: CODE, status: "skipped", detail: "No expiry date was found on the document." };
  }

  const evidence = { documentId, page: expiryDate.page };
  const daysLeft = daysBetween(today, expiryDate.value);
  if (daysLeft === null) {
    return { code: CODE, status: "skipped", detail: "The expiry date could not be read as a date.", evidence };
  }
  if (daysLeft < 0) {
    return { code: CODE, status: "skipped", detail: "Already expired, so not checked.", evidence };
  }

  if (daysLeft <= expiresSoonDays) {
    return {
      code: CODE,
      status: "warn",
      detail: `Expires on ${expiryDate.value}, in ${daysLeft} day(s) (limit ${expiresSoonDays}).`,
      evidence,
    };
  }
  return { code: CODE, status: "pass", detail: `More than ${expiresSoonDays} days left.`, evidence };
}
