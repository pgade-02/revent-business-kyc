// A reviewer's verdict on one document.
export const DOCUMENT_REVIEW_STATES = ["to_review", "approved", "rejected"] as const;
export type DocumentReviewState = (typeof DOCUMENT_REVIEW_STATES)[number];
