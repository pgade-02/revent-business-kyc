import type { DocumentSlot } from "../documents/slots";
import type { ExtractedField } from "../extraction/extracted-field";

export type ReadValue = {
  documentId: string;
  slot: DocumentSlot;
  field: ExtractedField<string>;
};

export const SLOT_LABEL: Readonly<Record<DocumentSlot, string>> = {
  trade_licence: "Trade licence",
  tax_certificate: "Tax certificate",
  bank_statement: "Bank statement",
  passport: "Passport",
  emirates_id_front: "Emirates ID front",
  emirates_id_back: "Emirates ID back",
  self_disclosure: "Self-disclosure form",
};

export const evidenceOf = (read: ReadValue) => ({
  documentId: read.documentId,
  page: read.field.page,
});
