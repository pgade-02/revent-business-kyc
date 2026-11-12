import type { ExtractedField } from "../extraction/extracted-field";
import type { CheckResult } from "./check-result";

const CODE = "ID_FORMAT";

export type IdFormatInput = {
  documentId: string;
  emiratesId?: ExtractedField<string>;
  trn?: ExtractedField<string>;
  iban?: ExtractedField<string>;
};

// Documents print numbers with spaces or dashes ("784-1990-…"); only the characters count.
function compact(text: string): string {
  return text.replace(/[\s-]/g, "").toUpperCase();
}

const isEmiratesId = (text: string) => /^784\d{12}$/.test(compact(text));
const isTrn = (text: string) => /^\d{15}$/.test(compact(text));

// UAE IBAN: "AE", 2 check digits, 19 digits. The check digits are verified with
// the standard ISO 13616 mod-97 rule: move the first 4 characters to the end,
// turn letters into numbers (A=10 … Z=35), and the remainder by 97 must be 1.
export function isUaeIban(text: string): boolean {
  const iban = compact(text);
  if (!/^AE\d{21}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const character of rearranged) {
    const digits = /[A-Z]/.test(character) ? String(character.charCodeAt(0) - 55) : character;
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

const rules = [
  { field: "emiratesId", label: "Emirates ID number does not start with 784 and have 15 digits", valid: isEmiratesId },
  { field: "trn", label: "TRN does not have 15 digits", valid: isTrn },
  { field: "iban", label: "IBAN is not a valid UAE IBAN (AE, 23 characters, checksum)", valid: isUaeIban },
] as const;

// Warns the reviewer about any number in the wrong format. It could be a misread or
// an edited document, so it never blocks the customer. Details never repeat the number.
export function checkIdFormat(input: IdFormatInput): CheckResult {
  const present = rules.flatMap((rule) => {
    const field = input[rule.field];
    return field ? [{ ...rule, field }] : [];
  });
  if (present.length === 0) {
    return { code: CODE, status: "skipped", detail: "No ID numbers were found on the document." };
  }

  const invalid = present.filter((rule) => !rule.valid(rule.field.value));
  const first = invalid[0];
  if (!first) {
    return { code: CODE, status: "pass", detail: `${present.length} ID number(s) have the expected format.` };
  }
  return {
    code: CODE,
    status: "warn",
    detail: invalid.map((rule) => rule.label).join("; ") + ".",
    evidence: { documentId: input.documentId, page: first.field.page },
  };
}
