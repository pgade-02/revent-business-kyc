import { z } from "zod";
import type { LlmProvider, LlmResult } from "@/kyc/interfaces/llm-provider";
import { jsonSchemaFor } from "../mistral/mistral-llm-provider";

const answer = z.object({
  candidates: z.array(z.object({ content: z.object({ parts: z.array(z.object({ text: z.string().optional() })) }) })).min(1),
  usageMetadata: z.object({
    promptTokenCount: z.number().int(),
    candidatesTokenCount: z.number().int().default(0),
    thoughtsTokenCount: z.number().int().default(0),
  }),
});

// Gemini behind LlmProvider, over its REST API (one endpoint, so no SDK). The request's own
// schema is sent as the JSON schema to answer in; src/kyc still validates the answer itself.
export function createGeminiLlmProvider(options: { apiKey: string; model: string; fetchImpl?: typeof fetch }): LlmProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent`;
  return {
    async generateJson({ instructions, input, outputSchema, timeoutMs }): Promise<LlmResult> {
      const body = {
        systemInstruction: { parts: [{ text: instructions }] },
        contents: [{ role: "user", parts: [{ text: input }] }],
        generationConfig: { responseMimeType: "application/json", responseJsonSchema: jsonSchemaFor(outputSchema) },
      };
      try {
        const response = await fetchImpl(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": options.apiKey },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) return { ok: false, reason: "ERROR" };
        const parsed = answer.safeParse(await response.json());
        const text = parsed.success ? parsed.data.candidates[0]?.content.parts.map((part) => part.text ?? "").join("") : undefined;
        if (!parsed.success || !text) return { ok: false, reason: "ERROR" };
        const usage = parsed.data.usageMetadata;
        return {
          ok: true,
          json: JSON.parse(text),
          usage: { inputTokens: usage.promptTokenCount, outputTokens: usage.candidatesTokenCount + usage.thoughtsTokenCount },
        };
      } catch (error) {
        return { ok: false, reason: error instanceof DOMException && error.name === "TimeoutError" ? "TIMEOUT" : "ERROR" };
      }
    },
  };
}
