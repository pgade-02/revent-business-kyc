import { SLOT_LABEL } from "@/kyc/checks/read-value";
import type { DocumentReviewState } from "@/ops/document-review";
import type { RequestReason, RequestSubject } from "@/ops/info-requests";
import type { ApplicationStage } from "@/ops/stages";

export const STAGE_LABEL: Record<ApplicationStage, string> = {
  draft: "Draft",
  submitted: "Submitted",
  in_review: "In review",
  waiting_on_customer: "Waiting on customer",
  approved: "Approved",
  rejected: "Rejected",
};

export const REVIEW_STATE_LABEL: Record<DocumentReviewState, string> = {
  to_review: "To review",
  approved: "Approved",
  rejected: "Rejected",
};

export const ROUTE_LABEL = { self_disclosure: "Self-disclosure form", verification_call: "Verification call" } as const;

export const REQUEST_SUBJECT_LABEL: Record<RequestSubject, string> = {
  ...SLOT_LABEL,
  company_details: "Company details",
  signatory_details: "Authorised signatory details",
};

export const REQUEST_REASON_LABEL: Record<RequestReason, string> = {
  expired: "Expired",
  not_clear: "Not clear or unreadable",
  wrong_document: "Wrong document",
  missing_pages: "Missing pages",
  details_do_not_match: "Details do not match",
  other: "Other",
};
