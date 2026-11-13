import { describe, expect, it } from "vitest";
import type { LlmProvider, LlmRequest, LlmResult } from "@/kyc/interfaces/llm-provider";
import { labelTransactions, type RowToLabel } from "@/kyc/statements/label-transactions";
import { labelledLinesLlm } from "@/providers/fakes/fake-llm-provider";

const row = (id: number, description: string, amountFils: number): RowToLabel => ({ id, date: "2026-05-03", description, amountFils });

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

describe("labelTransactions", () => {
  it("labels each row and keeps the payer only on customer income", async () => {
    const rows = [row(1, "INWARD TRANSFER ATLAS LOGISTICS FZE INV-2605", 4_000_000), row(2, "LOAN REPAYMENT FIN-REF 88231", -650_000), row(3, "CHEQUE RETURNED UNPAID", -120_000)];
    const result = await labelTransactions({ rows, llm: labelledLinesLlm, timeoutMs: 1_000 });
    expect(result.ok && Object.fromEntries(result.data)).toEqual({
      1: { label: "customer_income", payer: "ATLAS LOGISTICS FZE" },
      2: { label: "debt_repayment", payer: null },
      3: { label: "returned_item", payer: null },
    });
  });

  it("sends only id, date, description and amount, written by code", async () => {
    const { llm, sent } = scriptedLlm(() => ({ ok: true, json: { labels: [{ id: 7, label: "other", payer: null }] } }));
    await labelTransactions({ rows: [row(7, "DEWA BILL", -124_925)], llm, timeoutMs: 1_000 });
    expect(sent[0]?.input).toBe("7 | 2026-05-03 | DEWA BILL | -1249.25");
  });

  it("sends 40 rows per call, all calls at once", async () => {
    const { llm, sent } = scriptedLlm((request) => ({
      ok: true,
      json: { labels: request.input.split("\n").map((line) => ({ id: Number(line.split(" | ")[0]), label: "other", payer: null })) },
    }));
    const rows = Array.from({ length: 100 }, (_, index) => row(index + 1, "FEE", -100));
    const result = await labelTransactions({ rows, llm, timeoutMs: 1_000 });
    expect(sent.map((request) => request.input.split("\n").length)).toEqual([40, 40, 20]);
    expect(result.ok && result.data.size).toBe(100);
  });

  it("rejects an answer that leaves a row out or labels one twice", async () => {
    const missing = scriptedLlm(() => ({ ok: true, json: { labels: [{ id: 1, label: "other", payer: null }] } }));
    expect(await labelTransactions({ rows: [row(1, "A", -1), row(2, "B", -1)], llm: missing.llm, timeoutMs: 1_000 })).toEqual({ ok: false, reason: "INVALID_OUTPUT" });
    const twice = scriptedLlm(() => ({ ok: true, json: { labels: [{ id: 1, label: "other", payer: null }, { id: 1, label: "other", payer: null }] } }));
    expect(await labelTransactions({ rows: [row(1, "A", -1), row(2, "B", -1)], llm: twice.llm, timeoutMs: 1_000 })).toEqual({ ok: false, reason: "INVALID_OUTPUT" });
  });

  it("rejects a label outside the five allowed ones", async () => {
    const { llm } = scriptedLlm(() => ({ ok: true, json: { labels: [{ id: 1, label: "salary", payer: null }] } }));
    expect(await labelTransactions({ rows: [row(1, "A", -1)], llm, timeoutMs: 1_000 })).toEqual({ ok: false, reason: "INVALID_OUTPUT" });
  });
});
