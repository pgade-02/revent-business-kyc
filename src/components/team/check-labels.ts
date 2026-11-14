import type { CheckStatus } from "@/kyc/checks/check-result";

// Plain names for the upload checks, shown when a reviewer opens a document (team UI, English).
// A passing check reads as what was confirmed, a failing one as the problem found, and one
// that could not run as its topic, so "Fail" is never followed by "Not expired".
type Wording = { pass: string; problem: string; topic: string };

const WORDING: Readonly<Record<string, Wording>> = {
  FILE_DUPLICATE: { pass: "Not uploaded twice", problem: "Uploaded twice", topic: "Duplicate upload" },
  FILE_REUSED: {
    pass: "Not used in another customer's application",
    problem: "Also used in another customer's application",
    topic: "Use in other applications",
  },
  DOC_READING: { pass: "Read completely", problem: "Could not be read completely", topic: "Reading" },
  DOC_UNREADABLE: { pass: "Clear enough to read", problem: "Not clear enough to read", topic: "Readability" },
  DOC_WRONG_TYPE: { pass: "The right kind of document", problem: "Wrong kind of document", topic: "Kind of document" },
  DOC_EXPIRED: { pass: "Not expired", problem: "Expired", topic: "Expiry date" },
  DOC_EXPIRES_SOON: { pass: "Not expiring soon", problem: "Expires soon", topic: "Expiring soon" },
  PASSPORT_MRZ: { pass: "Passport code lines are valid", problem: "Passport code lines are not valid", topic: "Passport code lines" },
  MRZ_CHECK_DIGITS: {
    pass: "Emirates ID code lines are valid",
    problem: "Emirates ID code lines are not valid",
    topic: "Emirates ID code lines",
  },
  EID_DATES: {
    pass: "Issue and expiry dates make sense",
    problem: "Issue and expiry dates do not make sense",
    topic: "Issue and expiry dates",
  },
  ID_FORMAT: { pass: "ID numbers are well-formed", problem: "An ID number is not well-formed", topic: "ID number format" },
  STMT_BALANCE: { pass: "Balances add up", problem: "Balances do not add up", topic: "Balances" },
};

export function checkLabel(code: string, status: CheckStatus): string {
  const wording = WORDING[code];
  if (!wording) return code;
  return status === "pass" ? wording.pass : status === "skipped" ? wording.topic : wording.problem;
}
