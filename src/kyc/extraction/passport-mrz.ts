import { checkDigit } from "./mrz-check-digit";
import { fitTrailingFiller } from "./mrz-filler";
import { mrzBirthToIso, mrzCountry, mrzExpiryToIso } from "./mrz-date";

// The second machine-readable line of a passport (ICAO 9303, TD3: 2 × 44). Line 1 holds
// only the document type, issuing country and name, so it is not parsed. Code reads these
// lines itself; they are masked before any AI call.
export type PassportMrz = { line2: string };

// Number, check, nationality, birth date, check, sex, expiry, check: 28 fixed characters,
// then the optional data (14), its check, and the check over the whole line.
const LINE_2 = /([A-Z0-9<]{9}[0-9][A-Z<]{3}[0-9]{6}[0-9][MFX<][0-9]{6}[0-9])([A-Z0-9<]{13,17})([0-9])/;

// The optional data (14) and its check digit, with the trailing filler fitted; the check digit
// may be "<" or "0" when the data is empty.
function normaliseOptional(optionalWithCheck: string): string | null {
  const optional = fitTrailingFiller(optionalWithCheck.slice(0, -1), 14);
  return optional === null ? null : optional + optionalWithCheck.slice(-1);
}

export function findPassportMrz(text: string): PassportMrz | null {
  const compact = text.toUpperCase().replace(/\s+/g, "");
  const match = LINE_2.exec(compact);
  if (!match) return null;
  const [, fixed = "", optional = "", overallCheck = ""] = match;
  const fixedOptional = normaliseOptional(optional);
  return fixedOptional === null ? null : { line2: `${fixed}${fixedOptional}${overallCheck}` };
}

const isFiller = (field: string) => /^<+$/.test(field);

// The five check digits of a TD3 passport. Each entry names the part, never its value.
export function passportMrzCheckDigitFailures({ line2 }: PassportMrz): string[] {
  const composite = line2.slice(0, 10) + line2.slice(13, 20) + line2.slice(21, 43);
  const optional = line2.slice(28, 42);
  const checks = [
    { part: "passport number", field: line2.slice(0, 9), digit: line2[9] },
    { part: "date of birth", field: line2.slice(13, 19), digit: line2[19] },
    { part: "expiry date", field: line2.slice(21, 27), digit: line2[27] },
    { part: "optional data", field: optional, digit: line2[42] === "<" && isFiller(optional) ? "0" : line2[42] },
    { part: "whole line", field: composite, digit: line2[43] },
  ];
  return checks.filter((check) => checkDigit(check.field) !== check.digit).map((check) => check.part);
}

// Only values whose own check digit passed (decision log #67): expiry and date of birth have
// one each; nationality is covered only by the whole-line digit.
export function passportMrzValues(mrz: PassportMrz, today: string): Record<string, string> {
  const failures = passportMrzCheckDigitFailures(mrz);
  const { line2 } = mrz;
  return {
    ...(failures.includes("expiry date") ? {} : { expiryDate: mrzExpiryToIso(line2.slice(21, 27)) }),
    ...(failures.includes("date of birth") ? {} : { dateOfBirth: mrzBirthToIso(line2.slice(13, 19), today) }),
    ...(failures.includes("whole line") ? {} : { nationality: mrzCountry(line2.slice(10, 13)) }),
  };
}
