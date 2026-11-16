import { z } from "zod";
import { DOCUMENT_SLOTS } from "../kyc/documents/slots";

// One "more information" request: what to ask for, why, and an optional note.
export const REQUEST_SUBJECTS = [...DOCUMENT_SLOTS, "company_details", "signatory_details"] as const;
export const REQUEST_REASONS = ["expired", "not_clear", "wrong_document", "missing_pages", "details_do_not_match", "other"] as const;

export const requestItemSchema = z.object({
  subject: z.enum(REQUEST_SUBJECTS),
  reason: z.enum(REQUEST_REASONS),
  note: z.string().trim().max(500).optional(),
  noteAr: z.string().trim().max(1000).optional(),
});

export const infoRequestSchema = z.object({ items: z.array(requestItemSchema).min(1).max(10) });
export type RequestSubject = (typeof REQUEST_SUBJECTS)[number];
export type RequestReason = (typeof REQUEST_REASONS)[number];
export type RequestItem = z.infer<typeof requestItemSchema>;
export type InfoRequestInput = z.infer<typeof infoRequestSchema>;
