import { describe, expect, it } from "vitest";
import { z } from "zod";
import { readAiConfig } from "@/config/ai";
import { createMistralLlmProvider } from "@/providers/mistral/mistral-llm-provider";
import { createMistralOcrProvider } from "@/providers/mistral/mistral-ocr-provider";
import { getDocumentReaders } from "@/services/app-services";
import { labelledLinesLlm } from "@/providers/fakes/fake-llm-provider";

type Sent = { url: string; headers: Record<string, string>; body: Record<string, unknown> };

// A stand-in for the network: records what would be sent and replies with a set answer.
function fakeFetch(reply: { status?: number; json?: unknown; hang?: boolean }) {
  const sent: Sent[] = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    sent.push({ url: String(url), headers: init?.headers as Record<string, string>, body: JSON.parse(String(init?.body)) });
    if (reply.hang) {
      return new Promise<Response>((_resolve, reject) =>
        init?.signal?.addEventListener("abort", () => reject(new DOMException("timed out", "TimeoutError"))),
      );
    }
    return new Response(JSON.stringify(reply.json ?? {}), { status: reply.status ?? 200 });
  };
  return { fetchImpl, sent };
}

const client = (fetchImpl: typeof fetch) => ({ apiKey: "test-key", fetchImpl });

describe("Mistral OCR provider", () => {
  it("sends a photo as a base64 image and returns its text without picture links", async () => {
    const { fetchImpl, sent } = fakeFetch({ json: { pages: [{ index: 0, markdown: "PASSPORT\n![img-0.jpeg](img-0.jpeg)\nName: Demo" }] } });
    const ocr = createMistralOcrProvider(client(fetchImpl), { model: "ocr-model", timeoutMs: 1_000 });

    const result = await ocr.read({ bytes: new Uint8Array([1, 2, 3]), kind: "jpeg" });
    expect(result).toEqual({ ok: true, pages: [{ page: 1, text: "PASSPORT\n\nName: Demo" }] });
    expect(sent[0]?.url).toBe("https://api.mistral.ai/v1/ocr");
    expect(sent[0]?.headers.authorization).toBe("Bearer test-key");
    expect(sent[0]?.body).toMatchObject({ model: "ocr-model", document: { type: "image_url", image_url: "data:image/jpeg;base64,AQID" } });
  });

  it("asks only for the PDF pages that need OCR, counting from 0 the way Mistral does", async () => {
    const { fetchImpl, sent } = fakeFetch({ json: { pages: [{ index: 1, markdown: "page two text" }] } });
    const ocr = createMistralOcrProvider(client(fetchImpl), { model: "ocr-model", timeoutMs: 1_000 });

    const result = await ocr.read({ bytes: new Uint8Array([1]), kind: "pdf", pages: [2] });
    expect(sent[0]?.body).toMatchObject({ document: { type: "document_url" }, pages: [1] });
    expect(result).toEqual({ ok: true, pages: [{ page: 2, text: "page two text" }] });
  });

  it("reports an error, an unexpected answer and a timeout without throwing", async () => {
    const options = { model: "m", timeoutMs: 50 };
    const request = { bytes: new Uint8Array([1]), kind: "png" as const };
    expect(await createMistralOcrProvider(client(fakeFetch({ status: 401 }).fetchImpl), options).read(request)).toEqual({ ok: false, reason: "ERROR" });
    expect(await createMistralOcrProvider(client(fakeFetch({ json: { nope: true } }).fetchImpl), options).read(request)).toEqual({ ok: false, reason: "ERROR" });
    expect(await createMistralOcrProvider(client(fakeFetch({ hang: true }).fetchImpl), options).read(request)).toEqual({ ok: false, reason: "TIMEOUT" });
  });
});

describe("Mistral LLM provider", () => {
  const form = z.object({ fullName: z.object({ value: z.string() }).nullable() });

  it("asks for JSON in the exact form and returns the parsed answer", async () => {
    const { fetchImpl, sent } = fakeFetch({ json: { choices: [{ message: { content: '{"fullName":{"value":"Demo"}}' } }] } });
    const llm = createMistralLlmProvider(client(fetchImpl), { model: "llm-model" });

    const result = await llm.generateJson({ task: "extract:passport", instructions: "fill it", input: "text", outputSchema: form, timeoutMs: 1_000 });
    expect(result).toEqual({ ok: true, json: { fullName: { value: "Demo" } } });
    expect(sent[0]?.url).toBe("https://api.mistral.ai/v1/chat/completions");
    expect(sent[0]?.body).toMatchObject({
      model: "llm-model",
      temperature: 0,
      response_format: { type: "json_schema", json_schema: { name: "extract_passport", strict: true } },
    });
    expect(JSON.stringify(sent[0]?.body)).not.toContain("$schema");
  });

  it("passes on text that is not JSON as no answer, so the form check rejects it", async () => {
    const { fetchImpl } = fakeFetch({ json: { choices: [{ message: { content: "Sure! The name is Demo." } }] } });
    const llm = createMistralLlmProvider(client(fetchImpl), { model: "m" });
    expect(await llm.generateJson({ task: "t", instructions: "", input: "", outputSchema: form, timeoutMs: 1_000 })).toEqual({ ok: true, json: undefined });
  });
});

describe("choosing the readers", () => {
  it("uses the stand-ins without a key and Mistral with one", () => {
    expect(getDocumentReaders({}).llm).toBe(labelledLinesLlm);
    expect(getDocumentReaders({ MISTRAL_API_KEY: "" }).llm).toBe(labelledLinesLlm);
    expect(getDocumentReaders({ MISTRAL_API_KEY: "k" }).llm).not.toBe(labelledLinesLlm);
  });

  it("reads model names and the OCR time limit from env, with defaults", () => {
    expect(readAiConfig({})).toEqual({ mistralApiKey: null, ocrModel: "mistral-ocr-latest", llmModel: "mistral-small-latest", ocrTimeoutMs: 8_000 });
  });
});
