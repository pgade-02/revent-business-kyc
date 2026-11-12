// The upload boxes on the KYC screens (PRD §4, screens 5–7).
export const DOCUMENT_SLOTS = [
  "trade_licence",
  "tax_certificate",
  "bank_statement",
  "passport",
  "emirates_id_front",
  "emirates_id_back",
  "self_disclosure",
] as const;

export type DocumentSlot = (typeof DOCUMENT_SLOTS)[number];

// Bank statements may come as one file or several (one per month). Every other box
// holds one file, and a new upload replaces the old one.
export const slotAllowsSeveralFiles = (slot: DocumentSlot): boolean => slot === "bank_statement";
