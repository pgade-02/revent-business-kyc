import { z } from "zod";

// One value read from a document, with where it was found and how sure the reader
// was. Confidence is in basis points (10000 = certain), like every ratio here.
export function extractedFieldSchema<T extends z.ZodType>(value: T) {
  return z.object({
    value,
    page: z.number().int().min(1),
    confidenceBps: z.number().int().min(0).max(10_000),
  });
}

export type ExtractedField<T> = { value: T; page: number; confidenceBps: number };
