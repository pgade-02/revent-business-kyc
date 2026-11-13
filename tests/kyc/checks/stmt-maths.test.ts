import { describe, expect, it } from "vitest";
import { checkStmtBalance } from "@/kyc/checks/stmt-balance";
import { checkStmtCoverage, monthsBefore } from "@/kyc/checks/stmt-coverage";
import type { Transaction } from "@/kyc/statements/transaction";
import { companyA } from "../../fixtures/realistic/companies";
import { generateStatements, tamperWithStatement, type Statement } from "../../fixtures/realistic/statements";

// Synthetic statements from the realistic generator: every running balance reconciles.
const [may] = generateStatements(companyA, ["2026-05"]);
if (!may) throw new Error("no statement");

const toTransactions = (statement: Statement): Transaction[] =>
  statement.rows.map((row) => ({ date: row.date, amountFils: row.creditFils - row.debitFils, balanceFils: row.balanceFils, description: row.description, page: 1 }));
const balanceCheck = (statement: Statement, transactions = toTransactions(statement)) =>
  checkStmtBalance({ documentId: "may", openingFils: statement.openingFils, closingFils: statement.closingFils, transactions });

describe("STMT_BALANCE", () => {
  it("passes a statement whose every row and total add up", () => {
    expect(balanceCheck(may)).toMatchObject({ status: "pass", detail: `All ${may.rows.length} rows add up, and opening plus rows equals closing.` });
  });

  it("passes the same statement printed newest-first", () => {
    expect(balanceCheck(may, toTransactions(may).reverse()).status).toBe("pass");
  });

  it("warns on an edited balance, naming the page but never the amount", () => {
    const result = balanceCheck(may, toTransactions(tamperWithStatement(may, 3, 500_000)));
    expect(result.status).toBe("warn");
    expect(result.detail).toContain("row(s) whose balance does not follow from the previous one (page 1)");
    expect(result.detail).not.toMatch(/\d{4,}/);
  });

  it("warns when a row is missing, even if each remaining balance looks fine on its own", () => {
    const rows = toTransactions(may).filter((_, index) => index !== 2);
    expect(balanceCheck(may, rows).detail).toContain("opening balance plus all rows does not equal the closing balance");
  });

  it("is skipped when nothing can be added up", () => {
    const noBalances = toTransactions(may).map((transaction) => ({ ...transaction, balanceFils: null }));
    expect(checkStmtBalance({ documentId: "may", openingFils: null, closingFils: null, transactions: noBalances }).status).toBe("skipped");
    expect(checkStmtBalance({ documentId: "may", openingFils: 0, closingFils: 0, transactions: [] }).status).toBe("skipped");
  });
});

describe("STMT_COVERAGE", () => {
  const month = (documentId: string, start: string, end: string) => ({ documentId, periodStart: start, periodEnd: end });
  const sixMonths = ["05", "06", "07", "08", "09", "10"].map((m) => month(m, `2026-${m}-01`, `2026-${m}-${m === "06" || m === "09" ? "30" : "31"}`));

  it("needs the full months before the submit month, across a year end", () => {
    expect(monthsBefore("2026-11", 6)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(monthsBefore("2026-02", 3)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });

  it("passes six full months, and two half-month statements count as one month", () => {
    expect(checkStmtCoverage({ statements: sixMonths, submitMonth: "2026-11", monthsRequired: 6 }).status).toBe("pass");
    const split = [...sixMonths.filter((s) => s.documentId !== "07"), month("07a", "2026-07-01", "2026-07-15"), month("07b", "2026-07-16", "2026-07-31")];
    expect(checkStmtCoverage({ statements: split, submitMonth: "2026-11", monthsRequired: 6 }).status).toBe("pass");
  });

  it("fails naming the missing month, including a month only partly covered", () => {
    const withoutAugust = sixMonths.filter((s) => s.documentId !== "08");
    expect(checkStmtCoverage({ statements: withoutAugust, submitMonth: "2026-11", monthsRequired: 6 }).detail).toBe(
      "Statements do not cover 1 of the 6 months needed: 2026-08.",
    );
    const halfOctober = [...sixMonths.filter((s) => s.documentId !== "10"), month("10", "2026-10-01", "2026-10-20")];
    expect(checkStmtCoverage({ statements: halfOctober, submitMonth: "2026-11", monthsRequired: 6 }).status).toBe("fail");
  });

  it("is skipped, not failed, when no statement period was read", () => {
    expect(checkStmtCoverage({ statements: [month("may", "", "")], submitMonth: "2026-11", monthsRequired: 6 }).status).toBe("skipped");
  });
});
