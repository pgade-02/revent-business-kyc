import { z } from "zod";

// What the customer types on Company details (PRD §4, screen 4). These values are later
// compared with the trade licence and tax certificate (LICENCE_NUMBER, NAME_COMPANY, TRN_NUMBER).

export const EMIRATES = ["abu_dhabi", "dubai", "sharjah", "ajman", "umm_al_quwain", "ras_al_khaimah", "fujairah"] as const;

export const LEGAL_FORMS = [
  "llc",
  "sole_establishment",
  "civil_company",
  "free_zone_company",
  "branch",
  "joint_stock",
  "partnership",
] as const;

const text = (max: number) => z.string().trim().min(1).max(max);

// Customers type TRNs with spaces or dashes; only the 15 digits are kept.
const trn = z
  .string()
  .transform((value) => value.replace(/[\s-]/g, ""))
  .pipe(z.union([z.literal(""), z.string().regex(/^\d{15}$/)]))
  .transform((value) => (value === "" ? null : value));

// The current year comes in from outside, so the rule stays a pure function of its input.
export function companyDetailsSchema(currentYear: number) {
  return z.object({
    companyName: text(200),
    licenceNumber: text(40),
    yearEstablished: z.coerce.number().int().min(1900).max(currentYear),
    issuingAuthority: text(120),
    emirate: z.enum(EMIRATES),
    legalForm: z.enum(LEGAL_FORMS),
    trn: trn.prefault(""), // optional (PRD §4); prefault runs "" through the transform, so it becomes null
    registeredAddress: text(300),
    deliverToRegisteredAddress: z.boolean(),
  });
}

export type CompanyDetails = z.output<ReturnType<typeof companyDetailsSchema>>;
export type CompanyDetailsInput = z.input<ReturnType<typeof companyDetailsSchema>>;
