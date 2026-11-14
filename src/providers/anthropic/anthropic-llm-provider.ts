import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { LlmProvider, LlmResult } from "@/kyc/interfaces/llm-provider";

// Claude behind LlmProvider. The SDK asks for JSON in the request's own schema (structured
// outputs); src/kyc still validates the answer itself. Retries are left to askLlm, which
// owns the "one retry" rule (CLAUDE.md §5).
export function createAnthropicLlmProvider(options: {
  apiKey: string;
  model: string;
  effort: "low" | "medium" | "high";
  fetchImpl?: typeof fetch;
}): LlmProvider {
  const client = new Anthropic({ apiKey: options.apiKey, maxRetries: 0, ...(options.fetchImpl ? { fetch: options.fetchImpl } : {}) });
  return {
    async generateJson({ instructions, input, outputSchema, timeoutMs }): Promise<LlmResult> {
      if (!(outputSchema instanceof z.ZodObject)) return { ok: false, reason: "ERROR" };
      try {
        const response = await client.messages.parse(
          {
            model: options.model,
            max_tokens: 4_000,
            system: instructions,
            messages: [{ role: "user", content: input }],
            output_config: { effort: options.effort, format: zodOutputFormat(outputSchema) },
          },
          { timeout: timeoutMs },
        );
        if (response.stop_reason !== "end_turn" || response.parsed_output === null) return { ok: false, reason: "ERROR" };
        return {
          ok: true,
          json: response.parsed_output,
          usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
        };
      } catch (error) {
        return { ok: false, reason: error instanceof Anthropic.APIConnectionTimeoutError ? "TIMEOUT" : "ERROR" };
      }
    },
  };
}
