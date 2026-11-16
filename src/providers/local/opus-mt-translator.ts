import { pipeline, type TranslationPipeline } from "@huggingface/transformers";
import type { TextTranslator, TranslationResult } from "@/kyc/interfaces/text-translator";

let loading: Promise<TranslationPipeline> | null = null;

// Loads the model once per server process; the first call downloads it to the local cache.
function loadModel(model: string): Promise<TranslationPipeline> {
  loading ??= pipeline("translation", model, { dtype: "q8" }).catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}

const timeout = (ms: number) => new Promise<"TIMEOUT">((resolve) => setTimeout(() => resolve("TIMEOUT"), ms));

// Translates English to Arabic with a local opus-mt model; no text leaves the server.
export function createOpusMtTranslator(options: { model: string; timeoutMs: number }): TextTranslator {
  return {
    async toArabic(text: string): Promise<TranslationResult> {
      try {
        const run = loadModel(options.model).then((translate) => translate(text));
        const output = await Promise.race([run, timeout(options.timeoutMs)]);
        if (output === "TIMEOUT") return { ok: false, reason: "TIMEOUT" };
        const first = Array.isArray(output) ? output[0] : output;
        const translated = first && "translation_text" in first ? first.translation_text : "";
        return translated ? { ok: true, text: translated } : { ok: false, reason: "ERROR" };
      } catch {
        return { ok: false, reason: "ERROR" };
      }
    },
  };
}
