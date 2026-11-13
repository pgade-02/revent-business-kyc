import type { z } from "zod";
import type { LlmProvider, LlmResult } from "../interfaces/llm-provider";

const ATTEMPTS = 2; // one try plus one retry (CLAUDE.md §5)

export type AskResult<T> = { ok: true; data: T } | { ok: false; reason: "LLM_UNAVAILABLE" | "INVALID_OUTPUT" };

// Code enforces the time limit too, so a provider that hangs cannot stall an upload.
function withTimeout(call: Promise<LlmResult>, timeoutMs: number): Promise<LlmResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<LlmResult>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, reason: "TIMEOUT" }), timeoutMs);
  });
  return Promise.race([call.catch((): LlmResult => ({ ok: false, reason: "ERROR" })), timeout]).finally(() => clearTimeout(timer));
}

// The AI only fills a fixed form. An answer that does not match it exactly is thrown away
// after one retry; the caller then sends the document to "Needs review", never a guess.
export async function askLlm<T>(
  llm: LlmProvider,
  request: { task: string; instructions: string; input: string; outputSchema: z.ZodType<T>; timeoutMs: number },
): Promise<AskResult<T>> {
  let lastFailure: "LLM_UNAVAILABLE" | "INVALID_OUTPUT" = "LLM_UNAVAILABLE";
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const result = await withTimeout(llm.generateJson(request), request.timeoutMs);
    if (!result.ok) {
      lastFailure = "LLM_UNAVAILABLE";
      continue;
    }
    const parsed = request.outputSchema.safeParse(result.json);
    if (parsed.success) return { ok: true, data: parsed.data };
    lastFailure = "INVALID_OUTPUT";
  }
  return { ok: false, reason: lastFailure };
}
