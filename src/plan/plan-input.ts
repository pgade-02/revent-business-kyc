import { z } from "zod";

// What the customer's browser sends when they press Proceed. Only choices, never
// prices or totals: the server works those out itself from the prices table.
export const planInputSchema = z.object({
  term: z.union([z.literal(24), z.literal(36), z.literal(48)]),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1).max(100),
        quantity: z.number().int().min(1).max(999),
        serviceIds: z
          .array(z.string().min(1).max(100))
          .max(10)
          .refine((ids) => new Set(ids).size === ids.length, { message: "a service is listed twice" }),
      }),
    )
    .min(1)
    .max(50),
});

export type PlanInput = z.infer<typeof planInputSchema>;
