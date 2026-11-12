import type { z } from "zod";

export type LlmRequest = {
  task: string; // short name for logs and tracing, e.g. "extract:passport"
  instructions: string;
  input: string; // already masked: no ID numbers, IBANs or account numbers
  outputSchema: z.ZodType; // the provider asks the model for JSON in this shape
  timeoutMs: number;
};

// The provider returns the raw JSON. src/kyc validates it with the schema itself,
// so a provider can never hand back data that skipped validation.
export type LlmResult = { ok: true; json: unknown } | { ok: false; reason: "TIMEOUT" | "ERROR" };

export interface LlmProvider {
  generateJson(request: LlmRequest): Promise<LlmResult>;
}
