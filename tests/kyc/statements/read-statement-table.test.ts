import { describe, expect, it } from "vitest";
import { readStatementTable, statementDate } from "@/kyc/statements/read-statement-table";

// The layout Mistral OCR returned for a real two-page synthetic statement: the summary table,
// the transactions table with headings on page 1, and page 2 carrying on without headings.
const page1 = [
  "|  Opening Balance at 01 May 2026 | AED 180,000.00  |",
  "| --- | --- |",
  "|  Total Credits | AED 1,345,500.00  |",
  "",
  "| No. | Date | Description | Debit (AED) | Credit (AED) | Running Balance (AED) |",
  "| --- | --- | --- | --- | --- | --- |",
  "|  1 | 02 May 2026 | Customer Payment – Al Raya Trading L.L.C. | - | 120,000.00 | 300,000.00  |",
  "|  2 | 05 May 2026 | Office Rent – May 2026 (JLT) | 60,000.00 | - | 240,000.00  |",
].join("\n");
const page2 = [
  "|  3 | 25 Sept 2026 | Payroll – Sep 2026 | 145,000.00 | - | 95,000.00  |",
  "| --- | --- | --- | --- | --- | --- |",
  "|  4 | 30 Sept 2026 | Bank Charges – Sep 2026 | 525.00 | - | 94,475.00  |",
].join("\n");

describe("readStatementTable", () => {
  it("reads every row by its column headings, carrying them onto the next page", () => {
    const result = readStatementTable([
      { page: 1, text: page1 },
      { page: 2, text: page2 },
    ]);
    expect(result).toEqual({
      ok: true,
      data: [
        {
          date: "2026-05-02",
          amountFils: 12_000_000,
          balanceFils: 30_000_000,
          description: "Customer Payment – Al Raya Trading L.L.C.",
          page: 1,
        },
        { date: "2026-05-05", amountFils: -6_000_000, balanceFils: 24_000_000, description: "Office Rent – May 2026 (JLT)", page: 1 },
        { date: "2026-09-25", amountFils: -14_500_000, balanceFils: 9_500_000, description: "Payroll – Sep 2026", page: 2 },
        { date: "2026-09-30", amountFils: -52_500, balanceFils: 9_447_500, description: "Bank Charges – Sep 2026", page: 2 },
      ],
    });
  });

  it("never swaps money in and out, whatever order the columns come in", () => {
    const creditFirst =
      "| Date | Details | Deposits | Withdrawals | Balance |\n| --- | --- | --- | --- | --- |\n| 2026-05-02 | Salary refund | 500.00 | | 1,500.00 |";
    expect(readStatementTable([{ page: 1, text: creditFirst }])).toMatchObject({ ok: true, data: [{ amountFils: 50_000 }] });
  });

  it("reads a single signed Amount column, with brackets as negative", () => {
    const signed = "| Date | Narration | Amount | Balance |\n|---|---|---|---|\n| 02/05/2026 | Card purchase | (1,250.00) | 8,750.00 |";
    expect(readStatementTable([{ page: 1, text: signed }])).toMatchObject({
      ok: true,
      data: [{ date: "2026-05-02", amountFils: -125_000, balanceFils: 875_000 }],
    });
  });

  it("masks account and card numbers in descriptions before they are stored", () => {
    const text =
      "| Date | Description | Debit | Credit | Balance |\n|---|---|---|---|---|\n| 03 May 2026 | Transfer to 0123456789012 | 100.00 | - | 900.00 |";
    const result = readStatementTable([{ page: 1, text }]);
    expect(result.ok && result.data[0]?.description).toBe("Transfer to [[ACCOUNT_1]]");
  });

  it("fails the whole statement on a row it cannot read as money, never half-counting", () => {
    const text = "| Date | Description | Debit | Credit | Balance |\n|---|---|---|---|---|\n| 03 May 2026 | Fee | ten | - | 900.00 |";
    expect(readStatementTable([{ page: 1, text }])).toEqual({ ok: false, reason: "UNREADABLE_ROW" });
  });

  it("says so when there is no transactions table at all", () => {
    expect(readStatementTable([{ page: 1, text: "ACCOUNT STATEMENT\nNo table here" }])).toEqual({ ok: false, reason: "NO_TABLE" });
  });
});

describe("statementDate", () => {
  it.each([
    ["02 May 2026", "2026-05-02"],
    ["15 Sept 2026", "2026-09-15"],
    ["2-Oct-2026", "2026-10-02"],
    ["02/05/2026", "2026-05-02"],
    ["2026-05-02", "2026-05-02"],
  ])("reads %s as %s", (printed, iso) => {
    expect(statementDate(printed)).toBe(iso);
  });

  it("refuses a date that does not exist", () => {
    expect(statementDate("31/02/2026")).toBeNull();
  });
});
