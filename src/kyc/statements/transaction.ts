// One statement row as stored (ARCHITECTURE §4). Money is signed integer fils: + in, − out.
// The description keeps the masking placeholders, so account and card numbers are never stored.
export type Transaction = {
  date: string; // YYYY-MM-DD
  amountFils: number;
  balanceFils: number | null; // some statements print no running balance
  description: string;
  page: number;
};

export const DESCRIPTION_MAX_CHARS = 80;
