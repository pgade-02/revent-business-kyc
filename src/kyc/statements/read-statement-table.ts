import { parseAmountFils } from "../../plan/money";
import { isIsoDate } from "../dates";
import { maskText } from "../extraction/masking";
import type { PageText } from "../interfaces/pdf-text-reader";
import { DESCRIPTION_MAX_CHARS, type Transaction } from "./transaction";

// Reads statement rows from the tables OCR returns (markdown, one "| a | b |" line per row).
// Plain code, no AI: columns are found by their headings, so money in and money out can
// never be swapped (decision log #64).

type Column = "date" | "description" | "debit" | "credit" | "amount" | "balance";
type Columns = Partial<Record<Column, number>>;

// Common heading words, checked in this order so "Balance" is never taken for an amount.
const HEADINGS: [Column, RegExp][] = [
  ["balance", /balance/i],
  ["date", /date/i],
  ["debit", /debit|withdraw|money out|paid out|\bdr\b/i],
  ["credit", /credit|deposit|money in|paid in|\bcr\b/i],
  ["amount", /amount/i],
  ["description", /description|details|narration|particulars|transaction|reference/i],
];

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// "02 May 2026", "02 Sept 2026", "02-May-2026", "02/05/2026" (UAE: day first), "2026-05-02".
export function statementDate(text: string): string | null {
  const value = text.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const named = /^(\d{1,2})[\s-]([A-Za-z]{3})[A-Za-z]*\.?[\s-](\d{4})$/.exec(value);
  const numeric = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(value);
  const parts = iso
    ? [iso[1], iso[2], iso[3]]
    : named
      ? [named[3], String(MONTHS.indexOf((named[2] ?? "").toLowerCase()) + 1), named[1]]
      : numeric
        ? [numeric[3], numeric[2], numeric[1]]
        : null;
  if (!parts) return null;
  const [year = "", month = "", day = ""] = parts;
  const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  return isIsoDate(date) ? date : null;
}

// "1,234.50", "AED 1,234.50", "(1,234.50)" for a negative; "-" or empty is no amount.
function amountFils(text: string | undefined): number | null | "unreadable" {
  const value = (text ?? "").replace(/AED/i, "").replace(/\*/g, "").trim();
  if (value === "" || value === "-" || value === "—") return null;
  const negative = /^\(.*\)$/.test(value);
  const fils = parseAmountFils(value.replace(/[()]/g, ""));
  if (fils === null) return "unreadable";
  return negative ? -fils : fils;
}

const cellsOf = (line: string) => {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
};
const isSeparator = (cells: string[]) => cells.every((cell) => /^:?-{2,}:?$/.test(cell));

function columnsOf(cells: string[]): Columns | null {
  const columns: Columns = {};
  cells.forEach((cell, index) => {
    const match = HEADINGS.find(([column, pattern]) => columns[column] === undefined && pattern.test(cell));
    if (match) columns[match[0]] = index;
  });
  const hasMoney = columns.amount !== undefined || (columns.debit !== undefined && columns.credit !== undefined);
  return columns.date !== undefined && columns.balance !== undefined && hasMoney ? columns : null;
}

type RowResult = Transaction | "skip" | "unreadable";

const cell = (cells: string[], index: number | undefined) => (index === undefined ? undefined : cells[index]);

// Signed fils: + money in, − money out. null when the row moves no money.
function moneyOf(cells: string[], columns: Columns): number | null | "unreadable" {
  if (columns.amount !== undefined) return amountFils(cell(cells, columns.amount));
  const debit = amountFils(cell(cells, columns.debit));
  const credit = amountFils(cell(cells, columns.credit));
  if (debit === "unreadable" || credit === "unreadable") return "unreadable";
  if (debit === null && credit === null) return null;
  return (credit ?? 0) - Math.abs(debit ?? 0);
}

function rowOf(cells: string[], columns: Columns, page: number): RowResult {
  const date = statementDate(cell(cells, columns.date) ?? "");
  if (!date) return "skip"; // headings repeated, totals, and other lines without a date
  const amount = moneyOf(cells, columns);
  const balance = amountFils(cell(cells, columns.balance));
  if (amount === "unreadable" || balance === "unreadable") return "unreadable";
  if (amount === null) return "skip"; // e.g. an opening-balance line
  // Masked like the AI input used to be: account and card numbers never reach the database.
  const description = maskText(cell(cells, columns.description) ?? "").text.slice(0, DESCRIPTION_MAX_CHARS);
  return { date, amountFils: amount, balanceFils: balance, description, page };
}

export type TableReadResult = { ok: true; data: Transaction[] } | { ok: false; reason: "NO_TABLE" | "UNREADABLE_ROW" };

// The heading row sets the columns; a table that carries on onto the next page without its
// headings keeps the last ones, so long statements read the same on every page.
export function readStatementTable(pages: readonly PageText[]): TableReadResult {
  let columns: Columns | null = null;
  const transactions: Transaction[] = [];
  for (const page of pages) {
    for (const line of page.text.split("\n")) {
      if (!line.includes("|")) continue;
      const cells = cellsOf(line);
      if (isSeparator(cells)) continue;
      const headings = columnsOf(cells);
      if (headings) {
        columns = headings;
        continue;
      }
      if (!columns) continue;
      const row = rowOf(cells, columns, page.page);
      if (row === "unreadable") return { ok: false, reason: "UNREADABLE_ROW" };
      if (row !== "skip") transactions.push(row);
    }
  }
  return columns ? { ok: true, data: transactions } : { ok: false, reason: "NO_TABLE" };
}
