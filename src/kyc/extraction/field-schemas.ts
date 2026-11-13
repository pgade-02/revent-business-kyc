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

// Cards print the name in Arabic and English; the name checks compare Latin letters.
const englishName = field.describe("Full name in English (Latin letters), as printed after 'Name:'. Never the Arabic name.");

// The fixed form the AI fills for each upload box. Only what the checks need:
// no nationality, date of birth, gender or photo (SECURITY §6).
// Dates must come back as YYYY-MM-DD.
export const fieldSchemas = {
  trade_licence: z.object({ licenceNumber: field, companyName: field, expiryDate: field }),
  tax_certificate: z.object({ trn: field, companyName: field }),
  bank_statement: z.object({ accountHolder: field, iban: field, periodStart: field, periodEnd: field }),
  passport: z.object({ fullName: field, passportNumber: field, expiryDate: field }),
  // Newer cards print the dates on the front; older ones the expiry on the back. Both are asked.
  // docs/document-specs/emirates-id.md lists every field and why only these are read.
  emirates_id_front: z.object({ fullName: englishName, emiratesIdNumber: field, issueDate: field, expiryDate: field }),
  emirates_id_back: z.object({ expiryDate: field }),
  self_disclosure: z.object({ companyName: field }),
} satisfies Record<DocumentSlot, z.ZodType>;

export type RawField = z.infer<typeof field>;
