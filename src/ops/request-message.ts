import type { RequestItem, RequestReason } from "./info-requests";

const DETAILS_SUBJECTS: readonly RequestItem["subject"][] = ["company_details", "signatory_details"];

// One sentence per reason; {thing} is the document or the details being asked for.
const MESSAGE: Record<RequestReason, string> = {
  expired: "Your {thing} has expired. Please upload a valid, current copy.",
  not_clear: "We couldn't read your {thing} clearly. Please upload a clear copy showing every corner.",
  wrong_document: "The file you uploaded is not your {thing}. Please upload the correct document.",
  missing_pages: "Some pages of your {thing} are missing. Please upload every page.",
  details_do_not_match: "The details on your {thing} don't match your other documents. Please check them or upload the correct document.",
  other: "Please review your {thing} and update it.",
};

const DETAILS_DO_NOT_MATCH = "Your {thing} don't match your documents. Please check them and correct anything that is wrong.";

// Drafts the English message the customer will read for one request item; the reviewer can edit it.
export function draftRequestMessage(item: Pick<RequestItem, "subject" | "reason">, subjectName: string): string {
  const isDetails = DETAILS_SUBJECTS.includes(item.subject);
  const template = isDetails && item.reason === "details_do_not_match" ? DETAILS_DO_NOT_MATCH : MESSAGE[item.reason];
  return template.replace("{thing}", subjectName.toLowerCase());
}
