// Machine-readable lines print dates as YYMMDD, without the century.
const iso = (century: number, yymmdd: string) => `${century}${yymmdd.slice(0, 2)}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`;

// Documents with an expiry last at most ten years, so it is always 20YY.
export const mrzExpiryToIso = (yymmdd: string) => iso(20, yymmdd);

// A birth date is never in the future: 20YY unless that is after today, then 19YY.
export function mrzBirthToIso(yymmdd: string, today: string): string {
  const thisCentury = iso(20, yymmdd);
  return thisCentury > today ? iso(19, yymmdd) : thisCentury;
}

// Countries with a code shorter than 3 letters pad it with "<" (Germany is "D<<").
export const mrzCountry = (code: string) => code.replaceAll("<", "");
