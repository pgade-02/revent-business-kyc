import { z } from "zod";
import type { DocumentSlot } from "../documents/slots";

// One value read from a document, as the AI must return it. null = not on the document.
const field = z
  .object({
    value: z.string().min(1),
    page: z.int().min(1),
    confidencePercent: z.int().min(0).max(100),
  })
  .nullable();

// The fixed form the AI fills for each upload box. Only what the checks need:
// no nationality, date of birth, gender or photo (SECURITY §6).
// Dates must come back as YYYY-MM-DD.
export const fieldSchemas = {
  trade_licence: z.object({ licenceNumber: field, companyName: field, expiryDate: field }),
  tax_certificate: z.object({ trn: field, companyName: field }),
  bank_statement: z.object({ accountHolder: field, iban: field, periodStart: field, periodEnd: field }),
  passport: z.object({ fullName: field, passportNumber: field, expiryDate: field }),
  emirates_id_front: z.object({ fullName: field, emiratesIdNumber: field }),
  emirates_id_back: z.object({ expiryDate: field }),
  self_disclosure: z.object({ companyName: field }),
} satisfies Record<DocumentSlot, z.ZodType>;

export type RawField = z.infer<typeof field>;
