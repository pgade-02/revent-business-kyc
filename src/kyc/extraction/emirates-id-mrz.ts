// The machine-readable lines on the back of an Emirates ID (ICAO 9303, TD1: 3 × 30).
// Code reads them itself; the AI never sees them (they are masked).
// Only check digits and the expiry date are used. Date of birth, sex and nationality
// are in these lines too but are never returned (docs/document-specs/emirates-id.md §5).

function characterValue(character: string): number {
  if (character === "<") return 0;
  if (/[0-9]/.test(character)) return Number(character);
  return character.charCodeAt(0) - 55; // A = 10 … Z = 35
}

// ICAO check digit: weights 7, 3, 1 repeating, sum modulo 10.
export function checkDigit(field: string): string {
  const weights = [7, 3, 1];
  const sum = [...field].reduce((total, character, index) => total + characterValue(character) * (weights[index % 3] ?? 0), 0);
  return String(sum % 10);
}

export type EmiratesIdMrz = { line1: string; line2: string };

// OCR splits and spaces the lines in different ways, so whitespace is removed first.
const LINE_1 = /I[A-Z<]ARE[0-9]{9}[0-9][0-9]{15}/;
// OCR often reads a run of "<" filler one too long or short (seen on our specimen cards).
// Filler holds no data and counts 0 in every check digit, so a filler-only optional part
// of any length is reset to 11 "<". Anything else must be exactly 11 characters.
const LINE_2 = /([0-9]{6}[0-9][MF<][0-9]{6}[0-9][A-Z<]{3})([A-Z0-9<]{8,14})([0-9])/;

function normaliseOptional(optional: string): string | null {
  if (/^<+$/.test(optional)) return "<".repeat(11);
  return optional.length === 11 ? optional : null;
}

export function findEmiratesIdMrz(text: string): EmiratesIdMrz | null {
  const compact = text.toUpperCase().replace(/\s+/g, "");
  const line1 = LINE_1.exec(compact);
  if (!line1) return null;
  const line2 = LINE_2.exec(compact.slice(line1.index + 30));
  if (!line2) return null;
  const [, fields = "", optional = "", overallCheck = ""] = line2;
  const fixedOptional = normaliseOptional(optional);
  return fixedOptional === null ? null : { line1: line1[0], line2: `${fields}${fixedOptional}${overallCheck}` };
}

// The four check digits of a TD1 card. Each entry says which part was checked, not its value.
export function mrzCheckDigitFailures({ line1, line2 }: EmiratesIdMrz): string[] {
  const composite = line1.slice(5, 30) + line2.slice(0, 7) + line2.slice(8, 15) + line2.slice(18, 29);
  const checks = [
    { part: "card number", field: line1.slice(5, 14), digit: line1[14] },
    { part: "date of birth", field: line2.slice(0, 6), digit: line2[6] },
    { part: "expiry date", field: line2.slice(8, 14), digit: line2[14] },
    { part: "whole lines", field: composite, digit: line2[29] },
  ];
  return checks.filter((check) => checkDigit(check.field) !== check.digit).map((check) => check.part);
}

// Expiry as YYYY-MM-DD. Cards last a few years, so "YY" is always 20YY.
export function mrzExpiryDate({ line2 }: EmiratesIdMrz): string {
  const yymmdd = line2.slice(8, 14);
  return `20${yymmdd.slice(0, 2)}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`;
}
