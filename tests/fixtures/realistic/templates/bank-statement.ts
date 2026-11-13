import type { Company } from "../companies";
import { groupedIban, uaeIban } from "../iban";
import type { Statement } from "../statements";
import { aed, escapeHtml as e, htmlPage, uaeDate, watermark } from "./shared";

const css = `
  .bank { background: #0f3b57; color: #fff; padding: 16px 44px; display: flex; justify-content: space-between; align-items: center; }
  .bank h1 { font-size: 22px; }
  .summary td { width: 25%; }
  tr:nth-child(even) td { background: #fafbfd; }
`;

const monthEnd = (month: string) =>
  `${month}-${String(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate()).padStart(2, "0")}`;

// One monthly statement as the bank's own system would print it (computer-made PDF).
export function bankStatementHtml(company: Company, statement: Statement): string {
  const iban = uaeIban(company.bank.bankCode, company.bank.accountNumber);
  const credits = statement.rows.reduce((total, row) => total + row.creditFils, 0);
  const debits = statement.rows.reduce((total, row) => total + row.debitFils, 0);
  const rows = statement.rows
    .map(
      (row) => `<tr><td>${uaeDate(row.date)}</td><td>${e(row.description)}</td>
        <td class="num">${row.debitFils ? aed(row.debitFils) : ""}</td><td class="num">${row.creditFils ? aed(row.creditFils) : ""}</td>
        <td class="num">${aed(row.balanceFils)}</td></tr>`,
    )
    .join("");

  return htmlPage(
    css,
    `<div class="bank"><h1>${e(company.bank.name)}</h1><div class="ar" style="font-size:16px">كشف حساب</div></div>
    <section class="page">${watermark}
      <div class="row"><div><h1 style="font-size:16px">ACCOUNT STATEMENT</h1>
        <div>Period: ${uaeDate(`${statement.month}-01`)} to ${uaeDate(monthEnd(statement.month))}</div></div>
        <div class="muted" style="text-align:right">Statement date: ${uaeDate(monthEnd(statement.month))}<br/>Currency: AED</div></div>
      <h2>Account details</h2>
      <table class="summary"><tr><th>Account Holder</th><td colspan="3">${e(company.name)}</td></tr>
        <tr><th>Account Number</th><td>${e(company.bank.accountNumber)}</td><th>IBAN</th><td>${groupedIban(iban)}</td></tr>
        <tr><th>Opening Balance</th><td class="num">${aed(statement.openingFils)}</td><th>Closing Balance</th><td class="num">${aed(statement.closingFils)}</td></tr>
        <tr><th>Total Debits</th><td class="num">${aed(debits)}</td><th>Total Credits</th><td class="num">${aed(credits)}</td></tr></table>
      <h2>Transactions</h2>
      <table><tr><th style="width:12%">Date</th><th>Description</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th></tr>
        <tr><td>${uaeDate(`${statement.month}-01`)}</td><td>OPENING BALANCE</td><td></td><td></td><td class="num">${aed(statement.openingFils)}</td></tr>
        ${rows}</table>
      <p class="muted" style="margin-top:18px">This is a computer-generated statement and does not require a signature.</p>
    </section>`,
  );
}
