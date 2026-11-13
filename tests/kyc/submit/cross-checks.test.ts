import { describe, expect, it } from "vitest";
import { extractedFieldsSchema, type ExtractedFields } from "@/kyc/extraction/extract-fields";
import { runCrossChecks, type CrossCheckInput, type SubmittedDocument } from "@/kyc/submit/cross-checks";

// One invented company whose documents all agree.
const fieldsOf = (values: Record<string, string | string[]>): ExtractedFields =>
  extractedFieldsSchema.parse(Object.fromEntries(Object.entries(values).map(([name, value]) => [name, { value, page: 1, confidenceBps: 9_500 }])));
const person = { fullName: "Lina Example Rahal", dateOfBirth: "1988-04-12", nationality: "UTO" };
const card = { emiratesIdNumber: "784-1988-1234567-1", expiryDate: "2028-02-20" };
const IBAN = "AE070331234567890123456";

const documents: SubmittedDocument[] = [
  {
    id: "licence",
    slot: "trade_licence",
    fields: fieldsOf({ companyName: "Example Harbour Trading LLC", licenceNumber: "1048372", emirate: "Dubai", managerNames: ["Lina Rahal"] }),
  },
  { id: "tax", slot: "tax_certificate", fields: fieldsOf({ companyName: "Example Harbour Trading L.L.C", trn: "100234567800003" }) },
  {
    id: "may",
    slot: "bank_statement",
    fields: fieldsOf({ accountHolder: "EXAMPLE HARBOUR TRADING LLC", iban: IBAN, currency: "AED", periodStart: "2026-05-01", periodEnd: "2026-05-31", openingBalance: "100.00", closingBalance: "250.50" }),
  },
  {
    id: "june",
    slot: "bank_statement",
    fields: fieldsOf({ accountHolder: "Example Harbour Trading LLC", iban: IBAN, currency: "AED", periodStart: "2026-06-01", periodEnd: "2026-06-30", openingBalance: "250.50", closingBalance: "80.00" }),
  },
  { id: "passport", slot: "passport", fields: fieldsOf({ ...person, fullName: "RAHAL LINA EXAMPLE" }) },
  { id: "eid_front", slot: "emirates_id_front", fields: fieldsOf({ fullName: person.fullName, ...card }) },
  { id: "eid_back", slot: "emirates_id_back", fields: fieldsOf({ ...card, ...person, fullName: "LINA EXAMPLE RAHAL", employer: "EXAMPLE HARBOUR TRADING LLC" }) },
];

const input: CrossCheckInput = {
  documents,
  company: { companyName: "Example Harbour Trading LLC", licenceNumber: "1048372", trn: "100234567800003", emirate: "dubai" },
  signatoryName: "Lina Example Rahal",
  nameCutoffs: { matchBps: 9_500, possibleMatchBps: 8_500 },
};

const statuses = (results: ReturnType<typeof runCrossChecks>) => Object.fromEntries(results.map((result) => [result.code, result.status]));

describe("runCrossChecks", () => {
  it("runs every cross-check once and passes a consistent application", () => {
    expect(statuses(runCrossChecks(input))).toEqual({
      NAME_COMPANY: "pass",
      LICENCE_NUMBER: "pass",
      TRN_NUMBER: "pass",
      EMIRATE_MATCH: "pass",
      NAME_SIGNATORY: "pass",
      EID_SIDES_MATCH: "pass",
      DOB_MATCH: "pass",
      NATIONALITY_MATCH: "pass",
      EID_EMPLOYER: "pass",
      IBAN_CONSISTENT: "pass",
      STMT_CURRENCY: "pass",
      STMT_CONTINUITY: "pass",
    });
  });

  it("warns on the checks a different person's passport breaks, and leaves the rest alone", () => {
    const otherPassport = { id: "passport", slot: "passport" as const, fields: fieldsOf({ fullName: "NADIA OTHER HADDAD", dateOfBirth: "1990-01-01", nationality: "UTO" }) };
    const result = statuses(runCrossChecks({ ...input, documents: documents.map((document) => (document.slot === "passport" ? otherPassport : document)) }));
    expect(result).toMatchObject({ NAME_SIGNATORY: "warn", DOB_MATCH: "warn", NATIONALITY_MATCH: "pass", NAME_COMPANY: "pass" });
  });

  it("skips, never passes, what it cannot compare when nothing was read", () => {
    const empty = documents.map((document) => ({ ...document, fields: {} }));
    const result = runCrossChecks({ ...input, documents: empty, company: { companyName: null, licenceNumber: null, trn: null, emirate: null }, signatoryName: null });
    expect(result.filter((check) => check.status === "pass").map((check) => check.code)).toEqual(["STMT_CURRENCY"]); // an unread currency counts as AED
    expect(result.every((check) => check.status === "pass" || check.status === "skipped")).toBe(true);
  });
});
