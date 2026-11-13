import { describe, expect, it } from "vitest";
import type { LlmProvider, LlmRequest, LlmResult } from "@/kyc/interfaces/llm-provider";
import { readTransactions } from "@/kyc/statements/read-transactions";
import { labelledLinesLlm } from "@/providers/fakes/fake-llm-provider";
import { syntheticTexts } from "../../fixtures/synthetic-documents";

const row = (overrides: Record<string, string | null> = {}) => ({
  date: "2026-05-03",
  description: "INWARD TRANSFER",
  moneyIn: "1,000.00",
  moneyOut: null,
  balance: "2,000.00",
  ...overrides,
});

function scriptedLlm(answer: (request: LlmRequest) => LlmResult) {
  const sent: LlmRequest[] = [];
  const llm: LlmProvider = {
    async generateJson(request) {
      sent.push(request);
      return answer(request);
    },
  };
  return { llm, sent };
}

describe("readTransactions", () => {
  it("reads each row into signed fils, keeping the page it came from", async () => {
    const result = await readTransactions({ pages: [{ page: 1, text: syntheticTexts.bankStatement }], llm: labelledLinesLlm, timeoutMs: 1_000 });
    expect(result).toEqual({
      ok: true,
      data: [
        { date: "2026-05-03", amountFils: 2_000_000, balanceFils: 14_050_000, description: "INWARD TRANSFER EXAMPLE CLIENT LLC", page: 1 },
        { date: "2026-05-12", amountFils: -124_925, balanceFils: 13_925_075, description: "DEWA UTILITIES BILL PAYMENT", page: 1 },
        { date: "2026-05-27", amountFils: -500_000, balanceFils: 13_425_075, description: "WPS SALARY TRANSFER PAYROLL", page: 1 },
      ],
    });
  });

  it("asks once per page, each with only that page's masked text", async () => {
    const { llm, sent } = scriptedLlm(() => ({ ok: true, json: { rows: [row()] } }));
    const pages = [1, 2, 3].map((page) => ({ page, text: `Page ${page} account 0123456789012` }));
    const result = await readTransactions({ pages, llm, timeoutMs: 1_000 });
    expect(sent).toHaveLength(3);
    expect(sent.map((request) => request.input)).toEqual(["Page 1 account [[ACCOUNT_1]]", "Page 2 account [[ACCOUNT_1]]", "Page 3 account [[ACCOUNT_1]]"]);
    expect(result.ok && result.data.map((transaction) => transaction.page)).toEqual([1, 2, 3]);
  });

  it("skips lines with no money in or out, and cuts long descriptions to 80 characters", async () => {
    const { llm } = scriptedLlm(() => ({ ok: true, json: { rows: [row({ moneyIn: null }), row({ description: "X".repeat(120) })] } }));
    const result = await readTransactions({ pages: [{ page: 1, text: "x" }], llm, timeoutMs: 1_000 });
    expect(result.ok && result.data).toHaveLength(1);
    expect(result.ok && result.data[0]?.description).toHaveLength(80);
  });

  it("fails the whole statement when one page has a row it cannot read as money", async () => {
    const { llm } = scriptedLlm((request) => ({ ok: true, json: { rows: [request.input === "bad" ? row({ moneyIn: "one thousand" }) : row()] } }));
    const result = await readTransactions({ pages: [{ page: 1, text: "good" }, { page: 2, text: "bad" }], llm, timeoutMs: 1_000 });
    expect(result).toEqual({ ok: false, reason: "INVALID_OUTPUT" });
  });

  it("gives up when the AI is unavailable, after one retry", async () => {
    const { llm, sent } = scriptedLlm(() => ({ ok: false, reason: "ERROR" }));
    expect(await readTransactions({ pages: [{ page: 1, text: "x" }], llm, timeoutMs: 1_000 })).toEqual({ ok: false, reason: "LLM_UNAVAILABLE" });
    expect(sent).toHaveLength(2);
  });
});
