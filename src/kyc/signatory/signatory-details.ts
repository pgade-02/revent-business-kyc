import { z } from "zod";

// The authorised signatory as typed by the customer (PRD §4, screen 6). The name is later
// compared with the licence, passport and Emirates ID (NAME_SIGNATORY), and the signing
// email's domain with the applicant's (EMAIL_DOMAIN).

// UAE mobiles are typed as 05X…, 5X… or +971 5X…; all are stored as +9715XXXXXXXX.
const uaeMobile = z
  .string()
  .transform((value) => value.replace(/[\s()-]/g, ""))
  .pipe(z.union([z.literal(""), z.string().regex(/^(?:\+971|00971|0)?5\d{8}$/)]))
  .transform((value) => (value === "" ? null : `+971${value.slice(-9)}`));

export const signatoryDetailsSchema = z.object({
  isApplicant: z.boolean(),
  fullName: z.string().trim().min(2).max(200),
  signingEmail: z.string().trim().toLowerCase().pipe(z.email()),
  mobile: uaeMobile.prefault(""), // optional; prefault runs "" through the transform, so it becomes null
});

export type SignatoryDetails = z.output<typeof signatoryDetailsSchema>;
