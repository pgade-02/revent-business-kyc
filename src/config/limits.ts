import { z } from "zod";

// Upload safety and readability limits. These protect the server and decide what can
// be read at all, so they are ops settings read from env with defaults, not risk
// settings in scoring_settings (decision log #8, #29, #30).
const limitsFromEnv = z.object({
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  UPLOAD_MAX_PAGES: z.coerce.number().int().positive().default(30),
  // How many of 64 picture-fingerprint bits may differ for two photos to count as
  // the same picture. Detection tolerance, tuned with the eval set (ARCHITECTURE §8).
  UPLOAD_NEAR_DUPLICATE_MAX_BITS: z.coerce.number().int().min(0).max(64).default(5),
  // Fewer characters than this on a PDF page = no text layer, so the page goes to OCR.
  READ_MIN_PAGE_TEXT_CHARS: z.coerce.number().int().min(1).default(20),
  // Fewer characters than this in the whole document = unreadable.
  READ_MIN_DOCUMENT_TEXT_CHARS: z.coerce.number().int().min(1).default(20),
  // Shorter side of a photo below this = too small to read reliably.
  READ_MIN_IMAGE_SIDE_PX: z.coerce.number().int().min(1).default(500),
  // Per AI call; with one retry this keeps a document inside the 15 s target (PRD §7).
  LLM_TIMEOUT_MS: z.coerce.number().int().min(1).default(6_000),
});

export type UploadLimits = {
  maxBytes: number;
  maxPages: number;
  nearDuplicateMaxBits: number;
  minPageTextChars: number;
  minDocumentTextChars: number;
  minImageSidePx: number;
  llmTimeoutMs: number;
};

// Pass process.env in the app; tests pass their own values. Bad values stop the app at start.
export function readUploadLimits(env: Record<string, string | undefined>): UploadLimits {
  const present = Object.fromEntries(Object.keys(limitsFromEnv.shape).map((key) => [key, env[key] || undefined]));
  const parsed = limitsFromEnv.parse(present);
  return {
    maxBytes: parsed.UPLOAD_MAX_BYTES,
    maxPages: parsed.UPLOAD_MAX_PAGES,
    nearDuplicateMaxBits: parsed.UPLOAD_NEAR_DUPLICATE_MAX_BITS,
    minPageTextChars: parsed.READ_MIN_PAGE_TEXT_CHARS,
    minDocumentTextChars: parsed.READ_MIN_DOCUMENT_TEXT_CHARS,
    minImageSidePx: parsed.READ_MIN_IMAGE_SIDE_PX,
    llmTimeoutMs: parsed.LLM_TIMEOUT_MS,
  };
}
