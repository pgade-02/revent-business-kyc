import type { Transaction } from "../statements/transaction";
import type { CheckResult } from "./check-result";

const CODE = "STMT_BALANCE";

type Input = { documentId: string; openingFils: number | null; closingFils: number | null; transactions: readonly Transaction[] };

// Banks print newest-first or oldest-first; the maths needs oldest-first.
function oldestFirst(transactions: readonly Transaction[]): readonly Transaction[] {
  const first = transactions[0];
  const last = transactions.at(-1);
  return first && last && first.date > last.date ? [...transactions].reverse() : transactions;
}

// Rows whose printed balance is not the previous balance plus the row's amount.
function rowsThatDoNotAddUp(transactions: readonly Transaction[], openingFils: number | null): Transaction[] {
  let previous = openingFils;
  const wrong: Transaction[] = [];
  for (const transaction of transactions) {
    if (transaction.balanceFils === null) {
      previous = null;
      continue;
    }
    if (previous !== null && previous + transaction.amountFils !== transaction.balanceFils) wrong.push(transaction);
    previous = transaction.balanceFils;
  }
  return wrong;
}

// Code checks the arithmetic in whole fils. A mismatch means a row was misread or the
// statement was edited, so the reviewer is warned; the detail never repeats amounts.
export function checkStmtBalance({ documentId, openingFils, closingFils, transactions }: Input): CheckResult {
  if (transactions.length === 0) return { code: CODE, status: "skipped", detail: "Could not check: no transaction rows were read." };
  const ordered = oldestFirst(transactions);
  const wrongRows = rowsThatDoNotAddUp(ordered, openingFils);
  const total = ordered.reduce((sum, transaction) => sum + transaction.amountFils, 0);
  const totalWrong = openingFils !== null && closingFils !== null && openingFils + total !== closingFils;

  const problems = [
    ...(wrongRows.length > 0 ? [`${wrongRows.length} row(s) whose balance does not follow from the previous one (page ${[...new Set(wrongRows.map((row) => row.page))].join(", ")})`] : []),
    ...(totalWrong ? ["opening balance plus all rows does not equal the closing balance"] : []),
  ];
  const evidence = { documentId, page: wrongRows[0]?.page ?? ordered[0]?.page ?? 1 };
  if (problems.length > 0) return { code: CODE, status: "warn", detail: `Statement does not add up: ${problems.join("; ")}. It may be misread or edited.`, evidence };
  const checkedTotal = openingFils !== null && closingFils !== null;
  if (!checkedTotal && ordered.every((transaction) => transaction.balanceFils === null)) {
    return { code: CODE, status: "skipped", detail: "Could not check: the statement prints no balances to add up against." };
  }
  return {
    code: CODE,
    status: "pass",
    detail: `All ${ordered.length} rows add up${checkedTotal ? ", and opening plus rows equals closing" : ""}.`,
    evidence,
  };
}
