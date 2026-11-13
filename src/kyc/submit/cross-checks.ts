import type { CheckResult } from "../checks/check-result";
import { checkDobMatch } from "../checks/dob-match";
import { checkEidEmployer } from "../checks/eid-employer";
import { checkEidSidesMatch, type EidSide } from "../checks/eid-sides-match";
import { checkEmirateMatch } from "../checks/emirate-match";
import { checkIbanConsistent } from "../checks/iban-consistent";
import { checkLicenceNumber } from "../checks/licence-number";
import { checkNameCompany } from "../checks/name-company";
import { checkNameSignatory } from "../checks/name-signatory";
import { checkNationalityMatch } from "../checks/nationality-match";
import type { ReadValue } from "../checks/read-value";
import { checkStmtContinuity } from "../checks/stmt-continuity";
import { checkStmtCoverage } from "../checks/stmt-coverage";
import { checkStmtCurrency } from "../checks/stmt-currency";
import { checkTrnNumber } from "../checks/trn-number";
import { EMIRATES } from "../company/company-details";
import type { DocumentSlot } from "../documents/slots";
import { listField, textField, type ExtractedFields } from "../extraction/extract-fields";
import type { NameCutoffs } from "../matching/person-names";

export type SubmittedDocument = { id: string; slot: DocumentSlot; fields: ExtractedFields };

export type CrossCheckInput = {
  documents: readonly SubmittedDocument[];
  company: { companyName: string | null; licenceNumber: string | null; trn: string | null; emirate: string | null };
  signatoryName: string | null;
  nameCutoffs: NameCutoffs;
  coverage: { submitMonth: string; monthsRequired: number }; // submitMonth: YYYY-MM in Dubai
};

// Every value of one field read from the documents in the given slots.
function readsOf(documents: readonly SubmittedDocument[], slots: readonly DocumentSlot[], name: string): ReadValue[] {
  return documents.flatMap((document) => {
    const field = slots.includes(document.slot) ? textField(document.fields, name) : undefined;
    return field ? [{ documentId: document.id, slot: document.slot, field }] : [];
  });
}

// Part 2, step 1 (ARCHITECTURE §2): every submit-stage cross-check, from the fields stored
// at upload and the details the customer typed. Pure: same input, same results.
export function runCrossChecks({ documents, company, signatoryName, nameCutoffs, coverage }: CrossCheckInput): CheckResult[] {
  const read = (slot: DocumentSlot, name: string) => readsOf(documents, [slot], name)[0] ?? null;
  const eidSide = (slot: DocumentSlot): EidSide => ({
    emiratesIdNumber: read(slot, "emiratesIdNumber"),
    expiryDate: read(slot, "expiryDate"),
    fullName: read(slot, "fullName"),
  });
  const licence = documents.find((document) => document.slot === "trade_licence");
  const managerNames = licence ? listField(licence.fields, "managerNames") : undefined;
  const emirate = EMIRATES.find((code) => code === company.emirate) ?? null;

  return [
    checkNameCompany({
      typed: company.companyName,
      onDocuments: [
        ...readsOf(documents, ["trade_licence", "tax_certificate", "self_disclosure"], "companyName"),
        ...readsOf(documents, ["bank_statement"], "accountHolder"),
      ],
    }),
    checkLicenceNumber({ typed: company.licenceNumber, onLicence: read("trade_licence", "licenceNumber") }),
    checkTrnNumber({ typed: company.trn, onCertificate: read("tax_certificate", "trn") }),
    checkEmirateMatch({ typed: emirate, onLicence: read("trade_licence", "emirate") }),
    checkNameSignatory({
      typed: signatoryName,
      passport: read("passport", "fullName"),
      emiratesIdFront: read("emirates_id_front", "fullName"),
      managers: licence && managerNames ? { documentId: licence.id, field: managerNames } : null,
      cutoffs: nameCutoffs,
    }),
    checkEidSidesMatch({ front: eidSide("emirates_id_front"), back: eidSide("emirates_id_back"), cutoffs: nameCutoffs }),
    checkDobMatch({ passport: read("passport", "dateOfBirth"), emiratesIdBack: read("emirates_id_back", "dateOfBirth") }),
    checkNationalityMatch({ passport: read("passport", "nationality"), emiratesIdBack: read("emirates_id_back", "nationality") }),
    checkEidEmployer({ companyName: company.companyName, employer: read("emirates_id_back", "employer") }),
    ...statementChecks(documents.filter((document) => document.slot === "bank_statement"), coverage),
  ];
}

function statementChecks(statements: readonly SubmittedDocument[], coverage: CrossCheckInput["coverage"]): CheckResult[] {
  const value = (statement: SubmittedDocument, name: string) => textField(statement.fields, name) ?? null;
  return [
    checkStmtCoverage({
      ...coverage,
      statements: statements.map((statement) => ({
        documentId: statement.id,
        periodStart: value(statement, "periodStart")?.value ?? null,
        periodEnd: value(statement, "periodEnd")?.value ?? null,
      })),
    }),
    checkIbanConsistent({ onStatements: readsOf(statements, ["bank_statement"], "iban") }),
    checkStmtCurrency({
      currencies: statements.map((statement) => {
        const currency = value(statement, "currency");
        return currency ? { documentId: statement.id, slot: statement.slot, field: currency } : null;
      }),
    }),
    checkStmtContinuity({
      statements: statements.map((statement) => ({
        documentId: statement.id,
        iban: value(statement, "iban")?.value ?? null,
        periodStart: value(statement, "periodStart")?.value ?? null,
        periodEnd: value(statement, "periodEnd")?.value ?? null,
        openingBalance: value(statement, "openingBalance"),
        closingBalance: value(statement, "closingBalance"),
      })),
    }),
  ];
}
