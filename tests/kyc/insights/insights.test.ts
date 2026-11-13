import { describe, expect, it } from "vitest";
import type { CheckResult } from "@/kyc/checks/check-result";
import { buildFindings, type Findings } from "@/kyc/insights/findings";
import { writeInsights } from "@/kyc/insights/write-insights";
import type { LlmProvider, LlmRequest } from "@/kyc/interfaces/llm-provider";
import type { Score } from "@/kyc/scoring/score";
import type { MoneyFigures } from "@/kyc/statements/money-figures";
import { createBrokenLlm, labelledLinesLlm } from "@/providers/fakes/fake-llm-provider";

const score: Score = {
  score: 73,
  band: "AMBER",
  confidenceBps: 10_000,
  hardStops: [],
  blocks: { documents: { bps: 10_000, confidenceBps: 10_000 }, identity: { bps: 8_333, confidenceBps: 10_000 }, financial: { bps: 5_500, confidenceBps: 10_000 }, integrity: { bps: 10_000, confidenceBps: 10_000 } },
};
const figures: MoneyFigures = {
  monthsCovered: 6,
  planMonthly: 2_368_100,
  avgMonthlyIncome: 18_500_000,
  leaseToIncomeBps: 1_280,
  lowestBalance: 21_900_000,
  daysBelowZero: 0,
  returnedItems: 0,
  existingDebtMonthly: 650_000,
  debtToIncomeBps: 351,
  topPayerShareBps: 6_200,
  largestBalanceDropBps: 4_800,
  reasons: [],
};
const checks: CheckResult[] = [
  { code: "NAME_COMPANY", status: "pass", detail: "Company name matches on: Trade licence." },
  { code: "EID_EMPLOYER", status: "warn", detail: 'Employer on the Emirates ID is "Other Contracting LLC", not this company.', evidence: { documentId: "12", page: 1 } },
  { code: "TRN_NUMBER", status: "skipped", detail: "No TRN was typed in Company details." },
];
const findings: Findings = buildFindings({ score, checks, figures, figuresProblem: null, licenceActivities: ["Office Equipment Trading"] });
const ai = (llm: LlmProvider) => ({ llm, timeoutMs: 1_000 });

// An AI that always gives the same answer, recording what it was sent.
function answering(json: unknown) {
  const sent: LlmRequest[] = [];
  const llm: LlmProvider = {
    async generateJson(request) {
      sent.push(request);
      return { ok: true, json };
    },
  };
  return { llm, sent };
}
const answer = (patternText: string, evidence: { documentId: string; page: number } | null = null, findingCode = "topPayerShare") => ({
  profile: "An office equipment trader with steady income.",
  patterns: [{ text: patternText, findingCode, evidence }],
  thingsToCheck: [],
});

describe("buildFindings", () => {
  it("formats every figure for display, and keeps only codes for checks that passed", () => {
    expect(findings.figures).toMatchObject({ avgMonthlyIncome: "AED 185,000.00", leaseToIncome: "12.80%", topPayerShare: "62.00%" });
    expect(findings.passed).toEqual(["NAME_COMPANY"]);
    expect(findings.notPassed.map((check) => check.code)).toEqual(["EID_EMPLOYER", "TRN_NUMBER"]);
  });
});

describe("writeInsights", () => {
  it("keeps a faithful AI answer, with its evidence link", async () => {
    const insights = await writeInsights(findings, ai(labelledLinesLlm));
    expect(insights.source).toBe("llm");
    expect(insights.patterns[0]).toMatchObject({ findingCode: "EID_EMPLOYER", evidence: { documentId: "12", page: 1 } });
  });

  it("sends the findings only: no document fields or page text", async () => {
    const { llm, sent } = answering(answer("62% of income comes from one customer."));
    await writeInsights(findings, ai(llm));
    expect(Object.keys(JSON.parse(sent[0]?.input ?? "{}"))).toEqual(["score", "band", "hardStops", "notPassed", "passed", "figures", "figuresProblem", "licenceActivities"]);
  });

  it("accepts a number written differently but equal to a finding (62% for 62.00%)", async () => {
    const { llm } = answering(answer("62% of income comes from one customer."));
    expect((await writeInsights(findings, ai(llm))).source).toBe("llm");
  });

  it("throws away an answer with a number that is not in the findings", async () => {
    const { llm } = answering(answer("Income grew 40% this year."));
    expect(await writeInsights(findings, ai(llm))).toMatchObject({ source: "template", patterns: [] });
  });

  it("throws away a pattern whose evidence link does not exist", async () => {
    const { llm } = answering(answer("The employer differs.", { documentId: "99", page: 3 }, "EID_EMPLOYER"));
    expect((await writeInsights(findings, ai(llm))).source).toBe("template");
  });

  it("throws away a pattern that rests on no real finding", async () => {
    const { llm } = answering(answer("Seasonal business.", null, "SEASONALITY"));
    expect((await writeInsights(findings, ai(llm))).source).toBe("template");
  });

  it("falls back to a code template when the AI is unavailable: plain profile and the checks that did not pass", async () => {
    expect(await writeInsights(findings, ai(createBrokenLlm("unavailable")))).toEqual({
      profile: "Score 73 (AMBER). Over 6 months, average monthly income is AED 185,000.00 and the lease is 12.80% of it.",
      patterns: [],
      thingsToCheck: ['EID_EMPLOYER: Employer on the Emirates ID is "Other Contracting LLC", not this company.'],
      source: "template",
    });
  });
});
