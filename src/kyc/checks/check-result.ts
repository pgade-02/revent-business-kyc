import { z } from "zod";

// The one shape every check returns (docs/ARCHITECTURE.md §3).
export const checkStatusSchema = z.enum(["pass", "warn", "fail", "skipped"]);

export const checkResultSchema = z.object({
  code: z.string().regex(/^[A-Z][A-Z_]*$/, "check codes are UPPER_SNAKE"),
  status: checkStatusSchema,
  // English, for reviewers only. Never shown to customers and never holds ID numbers.
  detail: z.string().min(1),
  evidence: z.object({ documentId: z.string().min(1), page: z.number().int().min(1) }).optional(),
  // Only when the customer can fix it: a key into messages/{en,ar}.json.
  customerMessageKey: z.string().min(1).optional(),
});

export type CheckStatus = z.infer<typeof checkStatusSchema>;
export type CheckResult = z.infer<typeof checkResultSchema>;
