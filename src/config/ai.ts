import { z } from "zod";

// Which AI provider the app uses, and its settings. Model names live here and in
// env, never in the docs (the docs only define the interfaces).
const aiFromEnv = z.object({
  MISTRAL_API_KEY: z.string().min(1).optional(),
  MISTRAL_OCR_MODEL: z.string().min(1).default("mistral-ocr-latest"),
  MISTRAL_LLM_MODEL: z.string().min(1).default("mistral-small-latest"),
  // OCR of a phone photo usually takes a few seconds; this keeps a document inside 15 s (PRD §7).
  OCR_TIMEOUT_MS: z.coerce.number().int().positive().default(8_000),
});

export type AiConfig = { mistralApiKey: string | null; ocrModel: string; llmModel: string; ocrTimeoutMs: number };

export function readAiConfig(env: Record<string, string | undefined>): AiConfig {
  const present = Object.fromEntries(Object.keys(aiFromEnv.shape).map((key) => [key, env[key] || undefined]));
  const parsed = aiFromEnv.parse(present);
  return {
    mistralApiKey: parsed.MISTRAL_API_KEY ?? null,
    ocrModel: parsed.MISTRAL_OCR_MODEL,
    llmModel: parsed.MISTRAL_LLM_MODEL,
    ocrTimeoutMs: parsed.OCR_TIMEOUT_MS,
  };
}
