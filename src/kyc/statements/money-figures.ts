import { z } from "zod";
import { divideRoundHalfUp, ratioBps } from "../../plan/money";
import { addDays, monthEnd } from "../dates";
import { companyNameKey } from "../matching/company-names";
import type { RowLabel } from "./label-transactions";
import type { Transaction } from "./transaction";

export type LabelledTransaction = Transaction & RowLabel;
export type StatementForFigures = { openingFils: number | null; transactions: readonly LabelledTransaction[] };

const fils = z.number().int();
const bpsOrNull = z.number().int().nullable();

// ARCHITECTURE §4. Money in fils, ratios in bps, all computed by code.
export const moneyFiguresSchema = z.object({
  monthsCovered: z.number().int().min(1),
  planMonthly: fils,
  avgMonthlyIncome: fils,
  leaseToIncomeBps: bpsOrNull,
  lowestBalance: fils.nullable(),
  daysBelowZero: z.number().int().min(0),
  returnedItems: z.number().int().min(0),
  existingDebtMonthly: fils,
  debtToIncomeBps: bpsOrNull,
  topPayerShareBps: bpsOrNull, // shown, not scored
  largestBalanceDropBps: z.number().int().min(0), // shown, not scored
  reasons: z.array(z.literal("NO_CUSTOMER_INCOME")),
});
export type MoneyFigures = z.infer<typeof moneyFiguresSchema>;

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

// Income from the largest payer as a share of all income. Payers are grouped by their
// cleaned company name, so "ATLAS LOGISTICS FZE" and "Atlas Logistics" are one payer.
function topPayerShareBps(income: readonly LabelledTransaction[], totalIncome: number): number | null {
  if (totalIncome === 0) return null;
  const byPayer = new Map<string, number>();
  for (const row of income) {
    const key = row.payer ? companyNameKey(row.payer) : "";
    byPayer.set(key, (byPayer.get(key) ?? 0) + row.amountFils);
  }
  return ratioBps(Math.max(...byPayer.values()), totalIncome);
}

// End-of-day balance for every day of the covered months: the last printed balance of a
// day, carried forward over days with no rows. Starts from the earliest opening balance.
function dailyBalances(statements: readonly StatementForFigures[], months: readonly string[]): Map<string, number> {
  const printed = new Map<string, number>();
  const ordered = [...statements].sort((a, b) => (a.transactions[0]?.date ?? "").localeCompare(b.transactions[0]?.date ?? ""));
  for (const statement of ordered) {
    const rows = [...statement.transactions].sort((a, b) => a.date.localeCompare(b.date));
    for (const row of rows) if (row.balanceFils !== null) printed.set(row.date, row.balanceFils);
  }
  const first = months[0];
  const last = months.at(-1);
  const daily = new Map<string, number>();
  if (!first || !last) return daily;
  let current = ordered[0]?.openingFils ?? null;
  for (let day = `${first}-01`; day <= monthEnd(last); day = addDays(day, 1)) {
    current = printed.get(day) ?? current;
    if (current !== null && months.includes(day.slice(0, 7))) daily.set(day, current);
  }
  return daily;
}

// The largest fall from one month's closing balance to the next, in bps of the earlier one.
function largestBalanceDropBps(daily: ReadonlyMap<string, number>, months: readonly string[]): number {
  let largest = 0;
  months.forEach((month, index) => {
    const next = months[index + 1];
    const close = daily.get(monthEnd(month));
    const nextClose = next ? daily.get(monthEnd(next)) : undefined;
    if (close === undefined || nextClose === undefined || close <= 0 || nextClose >= close) return;
    largest = Math.max(largest, ratioBps(close - nextClose, close) ?? 0);
  });
  return largest;
}

// Part 2, step 3. `months` are the full months covered (STMT_COVERAGE); only AED statements
// are passed in (STMT_CURRENCY). Sums in fils first, rounded half-up once at the end.
export function computeMoneyFigures(input: { statements: readonly StatementForFigures[]; months: readonly string[]; planMonthlyFils: number }): MoneyFigures | null {
  const { months, planMonthlyFils } = input;
  if (months.length === 0) return null;
  const rows = input.statements.flatMap((statement) => statement.transactions).filter((row) => months.includes(row.date.slice(0, 7)));
  const income = rows.filter((row) => row.label === "customer_income" && row.amountFils > 0);
  const totalIncome = sum(income.map((row) => row.amountFils));
  const avgMonthlyIncome = divideRoundHalfUp(totalIncome, months.length);
  const debtPaid = sum(rows.filter((row) => row.label === "debt_repayment" && row.amountFils < 0).map((row) => -row.amountFils));
  const existingDebtMonthly = divideRoundHalfUp(debtPaid, months.length);
  const daily = dailyBalances(input.statements, months);
  const balances = [...daily.values()];

  return {
    monthsCovered: months.length,
    planMonthly: planMonthlyFils,
    avgMonthlyIncome,
    leaseToIncomeBps: ratioBps(planMonthlyFils, avgMonthlyIncome),
    lowestBalance: balances.length > 0 ? Math.min(...balances) : null,
    daysBelowZero: balances.filter((balance) => balance < 0).length,
    returnedItems: rows.filter((row) => row.label === "returned_item").length,
    existingDebtMonthly,
    debtToIncomeBps: ratioBps(existingDebtMonthly, avgMonthlyIncome),
    topPayerShareBps: topPayerShareBps(income, totalIncome),
    largestBalanceDropBps: largestBalanceDropBps(daily, months),
    reasons: totalIncome === 0 ? ["NO_CUSTOMER_INCOME"] : [],
  };
}
