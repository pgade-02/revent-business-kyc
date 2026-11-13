import { describe, expect, it } from "vitest";
import { checkIbanConsistent } from "@/kyc/checks/iban-consistent";
import type { ReadValue } from "@/kyc/checks/read-value";
import { checkStmtContinuity, type StatementBalances } from "@/kyc/checks/stmt-continuity";
import { checkStmtCurrency } from "@/kyc/checks/stmt-currency";

// Invented company, accounts and amounts.
const onStatement = (documentId: string, value: string): ReadValue => ({ documentId, slot: "bank_statement", field: { value, page: 1, confidenceBps: 9_500 } });
const amount = (value: string) => ({ value, page: 1, confidenceBps: 9_500 });
const IBAN = "AE07 0331 2345 6789 0123 456";

function statement(documentId: string, month: string, opening: string, closing: string, iban: string | null = IBAN): StatementBalances {
  const lastDay = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  return { documentId, iban, periodStart: `${month}-01`, periodEnd: `${month}-${lastDay}`, openingBalance: amount(opening), closingBalance: amount(closing) };
}

describe("IBAN_CONSISTENT", () => {
  it("passes when every statement has the same IBAN, however it is spaced", () => {
    expect(checkIbanConsistent({ onStatements: [onStatement("may", IBAN), onStatement("june", "AE070331234567890123456")] }).status).toBe("pass");
  });

  it("warns on a second account without repeating either IBAN", () => {
    const result = checkIbanConsistent({ onStatements: [onStatement("may", IBAN), onStatement("june", "AE460260001234567890123")] });
    expect(result).toMatchObject({ status: "warn", evidence: { documentId: "june" } });
    expect(result.detail).not.toMatch(/AE\d/);
  });

  it("is skipped with fewer than two IBANs", () => {
    expect(checkIbanConsistent({ onStatements: [onStatement("may", IBAN)] }).status).toBe("skipped");
  });
});

describe("STMT_CURRENCY", () => {
  it("passes AED and treats an unread currency as AED", () => {
    expect(checkStmtCurrency({ currencies: [onStatement("may", "aed"), null] }).status).toBe("pass");
  });

  it("warns that a non-AED statement is left out of the figures", () => {
    const result = checkStmtCurrency({ currencies: [onStatement("may", "AED"), onStatement("june", "USD")] });
    expect(result).toMatchObject({ status: "warn", evidence: { documentId: "june" } });
    expect(result.detail).toContain("USD");
  });
});

describe("STMT_CONTINUITY", () => {
  it("passes when each closing balance is the next opening balance, in any upload order", () => {
    const result = checkStmtContinuity({
      statements: [statement("june", "2026-06", "134,250.75", "98,000.00"), statement("may", "2026-05", "120500.00", "134250.75")],
    });
    expect(result).toMatchObject({ status: "pass", detail: "Balances carry over across 1 statement change(s)." });
  });

  it("warns when the next statement opens with a different balance, even by one fils", () => {
    const result = checkStmtContinuity({
      statements: [statement("may", "2026-05", "120500.00", "134250.75"), statement("june", "2026-06", "134250.74", "98000.00")],
    });
    expect(result).toMatchObject({ status: "warn", evidence: { documentId: "june" } });
    expect(result.detail).toContain("2026-05-31 → 2026-06-01");
  });

  it("does not compare statements of different accounts or with a month between them", () => {
    const otherAccount = statement("june", "2026-06", "5.00", "6.00", "AE460260001234567890123");
    const afterGap = statement("july", "2026-07", "7.00", "8.00");
    expect(checkStmtContinuity({ statements: [statement("may", "2026-05", "1.00", "2.00"), otherAccount] }).status).toBe("skipped");
    expect(checkStmtContinuity({ statements: [statement("may", "2026-05", "1.00", "2.00"), afterGap] }).status).toBe("skipped");
  });

  it("is skipped when a balance could not be read as an amount", () => {
    const unreadable = { ...statement("june", "2026-06", "0", "0"), openingBalance: amount("see page 2") };
    expect(checkStmtContinuity({ statements: [statement("may", "2026-05", "1.00", "2.00"), unreadable] }).status).toBe("skipped");
  });
});
