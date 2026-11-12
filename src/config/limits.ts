import { z } from "zod";

// Upload safety limits. These protect the server, so they are ops settings read
// from env with defaults, not risk settings in scoring_settings (decision log #8).
const limitsFromEnv = z.object({
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  UPLOAD_MAX_PAGES: z.coerce.number().int().positive().default(30),
  // How many of 64 picture-fingerprint bits may differ for two photos to count as
  // the same picture. Detection tolerance, tuned with the eval set (ARCHITECTURE §8).
  UPLOAD_NEAR_DUPLICATE_MAX_BITS: z.coerce.number().int().min(0).max(64).default(5),
});

export type UploadLimits = { maxBytes: number; maxPages: number; nearDuplicateMaxBits: number };

// Pass process.env in the app; tests pass their own values. Bad values stop the app at start.
export function readUploadLimits(env: Record<string, string | undefined>): UploadLimits {
  const parsed = limitsFromEnv.parse({
    UPLOAD_MAX_BYTES: env.UPLOAD_MAX_BYTES || undefined,
    UPLOAD_MAX_PAGES: env.UPLOAD_MAX_PAGES || undefined,
    UPLOAD_NEAR_DUPLICATE_MAX_BITS: env.UPLOAD_NEAR_DUPLICATE_MAX_BITS || undefined,
  });
  return {
    maxBytes: parsed.UPLOAD_MAX_BYTES,
    maxPages: parsed.UPLOAD_MAX_PAGES,
    nearDuplicateMaxBits: parsed.UPLOAD_NEAR_DUPLICATE_MAX_BITS,
  };
}
