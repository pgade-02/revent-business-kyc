// Builds a UAE IBAN with correct check digits (ISO 13616): "AE", 2 check digits,
// a 3-digit bank code and a 16-digit account number.
function mod97(digits: string): number {
  let remainder = 0;
  for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder;
}

export function uaeIban(bankCode: string, accountNumber: string): string {
  const bban = `${bankCode}${accountNumber}`;
  // "AE00" moved to the end, letters as numbers (A = 10, E = 14).
  const check = 98 - mod97(`${bban}101400`);
  return `AE${String(check).padStart(2, "0")}${bban}`;
}

export const groupedIban = (iban: string) => iban.replace(/(.{4})/g, "$1 ").trim();
