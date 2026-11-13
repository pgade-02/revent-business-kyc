import { z } from "zod";
import type { DocumentSlot } from "../documents/slots";

// null = not on the document.
const field = z
  .object({
    value: z.string().min(1),
    page: z.int().min(1),
    confidencePercent: z.int().min(0).max(100),
  })
  .nullable();

const listField = z
  .object({
    values: z.array(z.string().min(1)).min(1),
    page: z.int().min(1),
    confidencePercent: z.int().min(0).max(100),
  })
  .nullable();

// Cards print the name in Arabic and English; the name checks compare Latin letters.
const englishName = field.describe("Full name in English (Latin letters), as printed after 'Name:'. Never the Arabic name.");
const amount = field.describe("Amount as printed, digits and decimal point only, with a leading minus if negative.");

// Only what the checks need. Date of birth, nationality and sex are never asked for:
// code reads them from the machine-readable lines (docs/document-specs/cross-checks.md §7).
// Dates must come back as YYYY-MM-DD.
export const fieldSchemas = {
  trade_licence: z.object({
    licenceNumber: field,
    companyName: field,
    issueDate: field,
    expiryDate: field,
    emirate: field.describe("The emirate the licence was issued in, in English, for example Dubai."),
    address: field,
    managerNames: listField.describe("English names of every owner, partner, manager or authorised signatory listed on the licence."),
    activities: listField.describe("Each licensed business activity, in English."),
  }),
  tax_certificate: z.object({
    trn: field,
    companyName: field,
    taxType: field.describe('"vat" for a VAT registration certificate, "corporate_tax" for a Corporate Tax one.'),
    address: field,
  }),
  bank_statement: z.object({
    accountHolder: field,
    iban: field,
    currency: field.describe("Three-letter currency code of the account, for example AED."),
    periodStart: field,
    periodEnd: field,
    openingBalance: amount,
    closingBalance: amount,
  }),
  passport: z.object({ fullName: field, passportNumber: field, expiryDate: field }),
  // Newer cards print the dates on the front; older ones the expiry on the back. Both are asked.
  emirates_id_front: z.object({ fullName: englishName, emiratesIdNumber: field, issueDate: field, expiryDate: field }),
  emirates_id_back: z.object({
    expiryDate: field,
    employer: field.describe("Employer in English, as printed. null if the card has no employer."),
    occupation: field.describe("Occupation in English, as printed. null if the card has no occupation."),
  }),
  self_disclosure: z.object({ companyName: field }),
} satisfies Record<DocumentSlot, z.ZodType>;

export type RawField = z.infer<typeof field> | z.infer<typeof listField>;
