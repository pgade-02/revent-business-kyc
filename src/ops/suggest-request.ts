import type { CheckResult } from "@/kyc/checks/check-result";
import type { DocumentSlot } from "@/kyc/documents/slots";
import type { DocumentReviewState } from "./document-review";
import type { RequestItem, RequestReason, RequestSubject } from "./info-requests";
import type { TypedComparisons } from "./typed-vs-document";

// The request reason for each check the customer can fix; any other fixable check asks with "other".
const REASON_FOR_CHECK: Readonly<Record<string, RequestReason>> = {
  DOC_EXPIRED: "expired",
  DOC_UNREADABLE: "not_clear",
  MRZ_CHECK_DIGITS: "not_clear",
  PASSPORT_MRZ: "not_clear",
  DOC_WRONG_TYPE: "wrong_document",
  FILE_DUPLICATE: "wrong_document",
};

const COMPANY_FIELDS = ["companyName", "licenceNumber", "emirate", "trn"] as const;

export type DocumentForSuggestion = { slot: DocumentSlot; reviewState: DocumentReviewState; results: readonly CheckResult[] };

// One item per document the customer can fix, using the first fixable failure's reason.
function documentItems(documents: readonly DocumentForSuggestion[]): RequestItem[] {
  return documents.flatMap((document) => {
    if (document.reviewState === "approved") return [];
    const fixable = document.results.find((result) => result.status === "fail" && result.customerMessageKey);
    return fixable ? [{ subject: document.slot, reason: REASON_FOR_CHECK[fixable.code] ?? "other" }] : [];
  });
}

// One item for the company details and one for the signatory when a typed value does not match the documents.
function detailItems(comparisons: TypedComparisons): RequestItem[] {
  const items: RequestItem[] = [];
  if (COMPANY_FIELDS.some((field) => comparisons[field].verdict === "different")) items.push({ subject: "company_details", reason: "details_do_not_match" });
  if (comparisons.signatoryName.verdict === "different") items.push({ subject: "signatory_details", reason: "details_do_not_match" });
  return items;
}

// Suggests what to ask the customer for, leaving out anything already asked for; the reviewer edits and sends it.
export function suggestRequestItems(input: {
  documents: readonly DocumentForSuggestion[];
  comparisons: TypedComparisons;
  alreadyAsked: readonly RequestSubject[];
}): RequestItem[] {
  return [...documentItems(input.documents), ...detailItems(input.comparisons)].filter((item) => !input.alreadyAsked.includes(item.subject)).slice(0, 10);
}
