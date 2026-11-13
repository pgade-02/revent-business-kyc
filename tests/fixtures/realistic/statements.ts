import type { Company } from "./companies";

// One month of a business bank statement. Amounts are integer fils and every running
// balance equals the previous balance + credit − debit, so the statement reconciles
// unless it is deliberately edited.

export type StatementRow = { date: string; description: string; debitFils: number; creditFils: number; balanceFils: number };
export type Statement = { month: string; openingFils: number; closingFils: number; rows: StatementRow[] };

// Small seeded random generator: the same company and month always give the same statement.
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

const lastDay = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
const day = (month: string, dayOfMonth: number) => `${month}-${String(Math.min(dayOfMonth, lastDay(month))).padStart(2, "0")}`;

const customers = ["Gulf Retail Group", "Specimen Schools Co", "Demo Health Clinic", "Atlas Logistics FZE", "Northwind Hotels"];

export function generateStatement(company: Company, month: string, openingFils: number): Statement {
  const random = seededRandom(Number(month.replace("-", "")) + company.licenceNumber.length * 7);
  const moves: Omit<StatementRow, "balanceFils">[] = [];
  const debit = (dayOfMonth: number, description: string, fils: number) =>
    moves.push({ date: day(month, dayOfMonth), description, debitFils: fils, creditFils: 0 });

  // Customer payments: the month's income split across 4–6 transfers.
  const payments = 4 + Math.floor(random() * 3);
  let incomeLeft = company.monthlyIncomeFils;
  for (let index = 0; index < payments; index += 1) {
    const share = index === payments - 1 ? incomeLeft : Math.round((company.monthlyIncomeFils / payments) * (0.7 + random() * 0.6));
    incomeLeft -= share;
    const customer = customers[index % customers.length] ?? "Customer";
    moves.push({ date: day(month, 3 + index * 5), description: `INWARD TRANSFER ${customer.toUpperCase()} INV-${month.replace("-", "")}${index + 1}`, debitFils: 0, creditFils: share });
  }
  debit(1, "STANDING ORDER OFFICE RENT SPECIMEN TOWER", company.monthlyRentFils);
  debit(5, "LOAN REPAYMENT FIN-REF 88231", company.monthlyLoanRepaymentFils);
  debit(12, "DEWA UTILITIES BILL PAYMENT", 180_000 + Math.round(random() * 60_000));
  debit(19, "CARD PURCHASE OFFICE SUPPLIES DUBAI", 45_000 + Math.round(random() * 40_000));
  debit(27, "WPS SALARY TRANSFER PAYROLL", company.monthlySalariesFils);
  debit(28, "BANK CHARGES MONTHLY FEE", 10_500);

  moves.sort((a, b) => a.date.localeCompare(b.date) || b.creditFils - a.creditFils);
  let balance = openingFils;
  const rows = moves.map((move) => {
    balance = balance + move.creditFils - move.debitFils;
    return { ...move, balanceFils: balance };
  });
  return { month, openingFils, closingFils: balance, rows };
}

// Consecutive months: each month opens with the previous month's closing balance.
export function generateStatements(company: Company, months: string[]): Statement[] {
  let opening = company.openingBalanceFils;
  return months.map((month) => {
    const statement = generateStatement(company, month, opening);
    opening = statement.closingFils;
    return statement;
  });
}

// A tampered copy: one balance changed by hand, the way someone editing a PDF would,
// without fixing the rows after it. STMT_BALANCE must catch this.
export function tamperWithStatement(statement: Statement, rowIndex: number, addFils: number): Statement {
  const rows = statement.rows.map((row, index) => (index === rowIndex ? { ...row, balanceFils: row.balanceFils + addFils } : row));
  return { ...statement, rows };
}
