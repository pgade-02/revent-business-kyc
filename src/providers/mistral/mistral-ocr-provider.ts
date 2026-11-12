import { z } from "zod";
import type { OcrProvider } from "@/kyc/interfaces/ocr-provider";
import { postToMistral, type MistralClient } from "./mistral-client";

const MIME = { pdf: "application/pdf", png: "image/png", jpeg: "image/jpeg" } as const;

// Only the fields we use; anything else in the answer is ignored.
const ocrAnswer = z.object({
  pages: z.array(z.object({ index: z.int().min(0), markdown: z.string() })),
});

// The OCR answer is Markdown and marks pictures it found as ![img-0.jpeg](img-0.jpeg).
// Those links are not document text, so they are removed before any check reads it.
const IMAGE_PLACEHOLDER = /!\[[^\]]*\]\([^)]*\)/g;

export function createMistralOcrProvider(client: MistralClient, options: { model: string; timeoutMs: number }): OcrProvider {
  return {
    async read({ bytes, kind, pages }) {
      const dataUrl = `data:${MIME[kind]};base64,${Buffer.from(bytes).toString("base64")}`;
      const document = kind === "pdf" ? { type: "document_url", document_url: dataUrl } : { type: "image_url", image_url: dataUrl };
      const body = {
        model: options.model,
        document,
        include_image_base64: false,
        // Mistral counts pages from 0; we count from 1.
        ...(kind === "pdf" && pages ? { pages: pages.map((page) => page - 1) } : {}),
      };

      const result = await postToMistral(client, "/v1/ocr", body, options.timeoutMs);
      if (!result.ok) return { ok: false, reason: result.reason };
      const answer = ocrAnswer.safeParse(result.json);
      if (!answer.success) return { ok: false, reason: "ERROR" };
      return {
        ok: true,
        pages: answer.data.pages.map((page) => ({ page: page.index + 1, text: page.markdown.replace(IMAGE_PLACEHOLDER, "").trim() })),
      };
    },
  };
}
