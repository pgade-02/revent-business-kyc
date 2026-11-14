import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createAnthropicLlmProvider } from "@/providers/anthropic/anthropic-llm-provider";
import { createGeminiLlmProvider } from "@/providers/gemini/gemini-llm-provider";

// A stand-in for the network: records what would be sent and replies with a set answer.
function fakeFetch(status: number, json: unknown) {
  const sent: { url: string; body: Record<string, unknown> }[] = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    sent.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify(json), { status, headers: { "content-type": "application/json" } });
  };
  return { fetchImpl, sent };
}

const request = {
  task: "insights",
  instructions: "Write things to check.",
  input: '{"score":70}',
  outputSchema: z.object({ thingsToCheck: z.array(z.string()) }),
  timeoutMs: 1_000,
};

describe("Gemini provider", () => {
  it("asks for JSON in the request's schema and reports tokens, thinking included", async () => {
    const { fetchImpl, sent } = fakeFetch(200, {
      candidates: [{ content: { parts: [{ text: '{"thingsToCheck":["Look at the licence."]}' }] } }],
      usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 30, thoughtsTokenCount: 50 },
    });
    const result = await createGeminiLlmProvider({ apiKey: "test-key", model: "gemini-test", fetchImpl }).generateJson(request);
    expect(result).toEqual({ ok: true, json: { thingsToCheck: ["Look at the licence."] }, usage: { inputTokens: 120, outputTokens: 80 } });
    expect(sent[0]?.url).toContain("/models/gemini-test:generateContent");
    expect(sent[0]?.body).toMatchObject({ generationConfig: { responseMimeType: "application/json" } });
  });

  it("returns an error, not a guess, when the model is overloaded", async () => {
    const { fetchImpl } = fakeFetch(503, { error: { message: "high demand" } });
    expect(await createGeminiLlmProvider({ apiKey: "test-key", model: "gemini-test", fetchImpl }).generateJson(request)).toEqual({
      ok: false,
      reason: "ERROR",
    });
  });
});

describe("Claude provider", () => {
  const message = (text: string, stopReason = "end_turn") => ({
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-test",
    content: [{ type: "text", text }],
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 200, output_tokens: 40 },
  });

  it("sends the schema as structured output with the effort setting, and reports tokens", async () => {
    const { fetchImpl, sent } = fakeFetch(200, message('{"thingsToCheck":["Look at the licence."]}'));
    const result = await createAnthropicLlmProvider({ apiKey: "test-key", model: "claude-test", effort: "low", fetchImpl }).generateJson(
      request,
    );
    expect(result).toEqual({ ok: true, json: { thingsToCheck: ["Look at the licence."] }, usage: { inputTokens: 200, outputTokens: 40 } });
    expect(sent[0]?.body).toMatchObject({
      model: "claude-test",
      system: "Write things to check.",
      output_config: { effort: "low", format: { type: "json_schema" } },
    });
  });

  it("treats an answer cut off by the token limit as an error", async () => {
    const { fetchImpl } = fakeFetch(200, message('{"thingsToCheck":["Look', "max_tokens"));
    expect(
      await createAnthropicLlmProvider({ apiKey: "test-key", model: "claude-test", effort: "low", fetchImpl }).generateJson(request),
    ).toEqual({ ok: false, reason: "ERROR" });
  });
});
