export type TranslationResult = { ok: true; text: string } | { ok: false; reason: "TIMEOUT" | "ERROR" };

// Turns English text into Arabic. The real implementation runs a model on our own server.
export interface TextTranslator {
  toArabic(text: string): Promise<TranslationResult>;
}
