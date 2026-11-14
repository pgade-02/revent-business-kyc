import { z } from "zod";
import type { LlmProvider } from "@/kyc/interfaces/llm-provider";
import { postToMistral, type MistralClient } from "./mistral-client";

const chatAnswer = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
  usage: z.object({ prompt_tokens: z.number().int(), completion_tokens: z.number().int() }).optional(),
});

// The form the model must fill, as JSON Schema. "$schema" is a label for humans,
// not part of the form, so it is left out.
export function jsonSchemaFor(schema: z.ZodType): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  return jsonSchema;
}

export function createMistralLlmProvider(client: MistralClient, options: { model: string }): LlmProvider {
  return {
    async generateJson({ task, instructions, input, outputSchema, timeoutMs }) {
      const body = {
        model: options.model,
        temperature: 0, // the same document should give the same answer
        messages: [
          { role: "system", content: instructions },
          { role: "user", content: input },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: task.replace(/[^A-Za-z0-9_-]/g, "_"), schema: jsonSchemaFor(outputSchema), strict: true },
        },
      };

      const result = await postToMistral(client, "/v1/chat/completions", body, timeoutMs);
      if (!result.ok) return { ok: false, reason: result.reason };
      const answer = chatAnswer.safeParse(result.json);
      if (!answer.success) return { ok: false, reason: "ERROR" };

      // Text that is not JSON is passed on as "no answer": src/kyc then rejects it as off-form.
      const content = answer.data.choices[0]?.message.content ?? "";
      const usage = answer.data.usage && { inputTokens: answer.data.usage.prompt_tokens, outputTokens: answer.data.usage.completion_tokens };
      try {
        return { ok: true, json: JSON.parse(content) as unknown, usage };
      } catch {
        return { ok: true, json: undefined, usage };
      }
    },
  };
}
