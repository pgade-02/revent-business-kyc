// The machine-readable lines on the back of an Emirates ID (ICAO 9303, TD1: 3 × 30).
// Code reads them itself; the AI never sees them (they are masked).
// Sex is in these lines too but is never returned (docs/document-specs/emirates-id.md §5).

import { checkDigit } from "./mrz-check-digit";
import { fitTrailingFiller } from "./mrz-filler";
import { mrzBirthToIso, mrzCountry, mrzExpiryToIso } from "./mrz-date";

export type EmiratesIdMrz = { line1: string; line2: string; name: string | null };

// OCR splits and spaces the lines in different ways, so whitespace is removed first.
const LINE_1 = /I[A-Z<]ARE[0-9]{9}[0-9][0-9]{15}/;
// The optional part is 11 characters; OCR may read its trailing filler too long or too short,
// so it is captured loosely and fitted afterwards (mrz-filler.ts).
const LINE_2 = /([0-9]{6}[0-9][MF<][0-9]{6}[0-9][A-Z<]{3})([A-Z0-9<]{8,14})([0-9])/;

// Line 3 is "SURNAME<<GIVEN<NAMES" padded with "<". It has no check digit, and long names
// are cut at 30 characters, so it is only compared loosely.
const LINE_3 = /^([A-Z]+(?:<[A-Z]+)*)<<([A-Z]+(?:<[A-Z]+)*)/;

function nameFrom(line3: RegExpExecArray | null): string | null {
  if (!line3) return null;
  const [, surname = "", given = ""] = line3;
  return `${given} ${surname}`.replaceAll("<", " ");
}

export function findEmiratesIdMrz(text: string): EmiratesIdMrz | null {
  const compact = text.toUpperCase().replace(/\s+/g, "");
  const line1 = LINE_1.exec(compact);
  if (!line1) return null;
  const afterLine1 = compact.slice(line1.index + 30);
  const line2 = LINE_2.exec(afterLine1);
  if (!line2) return null;
  const [whole, fields = "", optional = "", overallCheck = ""] = line2;
  const fixedOptional = fitTrailingFiller(optional, 11);
  if (fixedOptional === null) return null;
  const name = nameFrom(LINE_3.exec(afterLine1.slice(line2.index + whole.length)));
  return { line1: line1[0], line2: `${fields}${fixedOptional}${overallCheck}`, name };
}


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

// The ID number is printed in the same 784-YYYY-NNNNNNN-C form as on the front.
const idNumber = (digits: string) => `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 14)}-${digits.slice(14)}`;

export function emiratesIdMrzValues({ line1, line2, name }: EmiratesIdMrz, today: string): Record<string, string> {
  return {
    emiratesIdNumber: idNumber(line1.slice(15, 30)),
    expiryDate: mrzExpiryToIso(line2.slice(8, 14)),
    dateOfBirth: mrzBirthToIso(line2.slice(0, 6), today),
    nationality: mrzCountry(line2.slice(15, 18)),
    ...(name ? { fullName: name } : {}),
  };
}
