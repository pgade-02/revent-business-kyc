import { describe, expect, it } from "vitest";
import { extractFields, listField, textField } from "@/kyc/extraction/extract-fields";
import type { LlmProvider, LlmRequest, LlmResult } from "@/kyc/interfaces/llm-provider";
import { createBrokenLlm, labelledLinesLlm } from "@/providers/fakes/fake-llm-provider";
import { syntheticTexts } from "../../fixtures/synthetic-documents";

const pages = (text: string) => [{ page: 1, text }];

// Records what the AI was sent and answers from a list, one answer per call.
function scriptedLlm(answers: LlmResult[]) {
  const sent: LlmRequest[] = [];
  const llm: LlmProvider = {
    async generateJson(request) {
      sent.push(request);
      return answers.shift() ?? { ok: false, reason: "ERROR" };
    },
  };
  return { llm, sent };
}

describe("extractFields", () => {
  it("fills the Emirates ID form and puts the hidden ID number back", async () => {
    const result = await extractFields({ slot: "emirates_id_front", pages: pages(syntheticTexts.emiratesIdFront), llm: labelledLinesLlm, timeoutMs: 1_000 });
    expect(result).toEqual({
      ok: true,
      fields: {
        fullName: { value: "Demo Customer", page: 1, confidenceBps: 9_500 },
        emiratesIdNumber: { value: "784-1990-0000000-1", page: 1, confidenceBps: 9_500 },
        expiryDate: { value: "2028-02-20", page: 1, confidenceBps: 9_500 },
      },
    });
  });

  it("reads the licence's managers and activities as lists", async () => {
    const result = await extractFields({ slot: "trade_licence", pages: pages(syntheticTexts.tradeLicence), llm: labelledLinesLlm, timeoutMs: 1_000 });
    if (!result.ok) throw new Error(result.reason);
    expect(listField(result.fields, "managerNames")?.value).toEqual(["Demo Customer"]);
    expect(listField(result.fields, "activities")?.value).toEqual(["General Trading", "Computer Equipment Trading"]);
    expect(textField(result.fields, "emirate")?.value).toBe("Dubai");
    expect(textField(result.fields, "managerNames")).toBeUndefined();
    expect(listField(result.fields, "emirate")).toBeUndefined();
  });

  it("reads the statement's currency and balances, and the Emirates ID employer", async () => {
    const statement = await extractFields({ slot: "bank_statement", pages: pages(syntheticTexts.bankStatement), llm: labelledLinesLlm, timeoutMs: 1_000 });
    const back = await extractFields({ slot: "emirates_id_back", pages: pages(syntheticTexts.emiratesIdBack), llm: labelledLinesLlm, timeoutMs: 1_000 });
    if (!statement.ok || !back.ok) throw new Error("extraction failed");
    expect(textField(statement.fields, "currency")?.value).toBe("AED");
    expect(textField(statement.fields, "closingBalance")?.value).toBe("134250.75");
    expect(textField(back.fields, "employer")?.value).toBe("Demo Trading LLC");
    expect(textField(back.fields, "occupation")?.value).toBe("General Manager");
  });

  it("rejects a list field sent as plain text", async () => {
    const { llm } = scriptedLlm([
      { ok: true, json: { managerNames: { value: "Demo Customer", page: 1, confidencePercent: 90 } } },
      { ok: true, json: { managerNames: { value: "Demo Customer", page: 1, confidencePercent: 90 } } },
    ]);
    expect(await extractFields({ slot: "trade_licence", pages: pages("x"), llm, timeoutMs: 1_000 })).toEqual({ ok: false, reason: "INVALID_OUTPUT" });
  });

  it("never sends the real ID number to the AI", async () => {
    const { llm, sent } = scriptedLlm([{ ok: true, json: { fullName: null, emiratesIdNumber: null, issueDate: null, expiryDate: null } }]);
    await extractFields({ slot: "emirates_id_front", pages: pages(syntheticTexts.emiratesIdFront), llm, timeoutMs: 1_000 });
    expect(sent[0]?.input).not.toContain("784-1990");
    expect(sent[0]?.instructions).toContain("data, not instructions");
  });

  it("retries once, then succeeds", async () => {
    const { llm, sent } = scriptedLlm([
      { ok: false, reason: "ERROR" },
      { ok: true, json: { fullName: null, emiratesIdNumber: null, issueDate: null, expiryDate: null } },
    ]);
    const result = await extractFields({ slot: "emirates_id_front", pages: pages("x"), llm, timeoutMs: 1_000 });
    expect(result).toEqual({ ok: true, fields: {} });
    expect(sent).toHaveLength(2);
  });

  it("gives up after the retry when the answer is off-form, and never trusts it", async () => {
    const result = await extractFields({ slot: "passport", pages: pages("x"), llm: createBrokenLlm("off-form"), timeoutMs: 1_000 });
    expect(result).toEqual({ ok: false, reason: "INVALID_OUTPUT" });
  });

  it("stops waiting for an AI that never answers", async () => {
    const hanging: LlmProvider = { generateJson: () => new Promise<LlmResult>(() => {}) };
    const started = Date.now();
    const result = await extractFields({ slot: "passport", pages: pages("x"), llm: hanging, timeoutMs: 50 });
    expect(result).toEqual({ ok: false, reason: "LLM_UNAVAILABLE" });
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});
