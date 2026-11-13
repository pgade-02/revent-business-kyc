import { describe, expect, it } from "vitest";
import { labelTransactions } from "@/kyc/statements/label-transactions";
import { computeMoneyFigures, type LabelledTransaction, type StatementForFigures } from "@/kyc/statements/money-figures";
import { divideRoundHalfUp, ratioBps } from "@/plan/money";
import { labelledLinesLlm } from "@/providers/fakes/fake-llm-provider";
import { companyA } from "../../fixtures/realistic/companies";
import { generateStatements } from "../../fixtures/realistic/statements";

const MONTHS = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
const PLAN_MONTHLY = 2_368_100; // AED 23,681

// The fictional company's six statements, labelled by the fake AI, as Part 2 would see them.
async function realisticStatements(): Promise<StatementForFigures[]> {
  const statements = generateStatements(companyA, MONTHS);
  const rows = statements.flatMap((statement, s) =>
    statement.rows.map((r, i) => ({ id: s * 1_000 + i, date: r.date, description: r.description, amountFils: r.creditFils - r.debitFils, balanceFils: r.balanceFils })),
  );
  const labels = await labelTransactions({ rows, llm: labelledLinesLlm, timeoutMs: 1_000 });
  if (!labels.ok) throw new Error(labels.reason);
  return statements.map((statement, s) => ({
    openingFils: statement.openingFils,
    transactions: rows
      .filter((r) => Math.floor(r.id / 1_000) === s)
      .map((r) => {
        const label = labels.data.get(r.id);
        if (!label) throw new Error("unlabelled row");
        return { ...r, page: 1, ...label };
      }),
  }));
}

const tx = (date: string, amountFils: number, balanceFils: number, label: LabelledTransaction["label"] = "other", payer: string | null = null): LabelledTransaction => ({
  date,
  amountFils,
  balanceFils,
  description: "ROW",
  page: 1,
  label,
  payer,
});

describe("computeMoneyFigures", () => {
  it("gives back exactly the monthly amounts the fictional company's statements were built from", async () => {
    const figures = computeMoneyFigures({ statements: await realisticStatements(), months: MONTHS, planMonthlyFils: PLAN_MONTHLY });
    expect(figures).toMatchObject({
      monthsCovered: 6,
      avgMonthlyIncome: companyA.monthlyIncomeFils,
      existingDebtMonthly: companyA.monthlyLoanRepaymentFils,
      leaseToIncomeBps: ratioBps(PLAN_MONTHLY, companyA.monthlyIncomeFils),
      debtToIncomeBps: ratioBps(companyA.monthlyLoanRepaymentFils, companyA.monthlyIncomeFils),
      daysBelowZero: 0,
      returnedItems: 0,
      reasons: [],
    });
  });

  it("counts every calendar day the balance stays below zero, not only days with rows", () => {
    const may = { openingFils: 10_000, transactions: [tx("2026-05-10", -30_000, -20_000), tx("2026-05-15", 50_000, 30_000)] };
    const figures = computeMoneyFigures({ statements: [may], months: ["2026-05"], planMonthlyFils: 100 });
    expect(figures).toMatchObject({ daysBelowZero: 5, lowestBalance: -20_000 }); // 10th to 14th
  });

  it("finds the largest month-to-month fall in closing balance", () => {
    const rows = [tx("2026-05-31", 0, 100_000), tx("2026-06-30", -40_000, 60_000), tx("2026-07-31", -30_000, 30_000)];
    const figures = computeMoneyFigures({ statements: [{ openingFils: 100_000, transactions: rows }], months: ["2026-05", "2026-06", "2026-07"], planMonthlyFils: 100 });
    expect(figures?.largestBalanceDropBps).toBe(5_000); // June → July: 30,000 of 60,000
  });

  it("shares income by payer, treating different spellings of one company as one payer", () => {
    const rows = [
      tx("2026-05-03", 600_000, 600_000, "customer_income", "ATLAS LOGISTICS FZE"),
      tx("2026-05-09", 300_000, 900_000, "customer_income", "Atlas Logistics"),
      tx("2026-05-20", 100_000, 1_000_000, "customer_income", "Northwind Hotels"),
    ];
    const figures = computeMoneyFigures({ statements: [{ openingFils: 0, transactions: rows }], months: ["2026-05"], planMonthlyFils: 100 });
    expect(figures?.topPayerShareBps).toBe(9_000);
  });

  it("rounds the monthly average half-up once, after summing in fils", () => {
    const rows = [tx("2026-05-03", 100, 100, "customer_income", "A"), tx("2026-06-03", 101, 201, "customer_income", "A")];
    const figures = computeMoneyFigures({ statements: [{ openingFils: 0, transactions: rows }], months: ["2026-05", "2026-06"], planMonthlyFils: 100 });
    expect(figures?.avgMonthlyIncome).toBe(divideRoundHalfUp(201, 2)); // 100.5 → 101
  });

  it("marks no customer income, with both ratios empty rather than zero", () => {
    const figures = computeMoneyFigures({ statements: [{ openingFils: 0, transactions: [tx("2026-05-03", 500, 500, "own_transfer_or_loan_in")] }], months: ["2026-05"], planMonthlyFils: 100 });
    expect(figures).toMatchObject({ avgMonthlyIncome: 0, leaseToIncomeBps: null, debtToIncomeBps: null, topPayerShareBps: null, reasons: ["NO_CUSTOMER_INCOME"] });
  });

  it("returns nothing when no full month is covered", () => {
    expect(computeMoneyFigures({ statements: [], months: [], planMonthlyFils: 100 })).toBeNull();
  });
});
