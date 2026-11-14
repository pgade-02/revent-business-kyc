import type { CheckResult } from "@/kyc/checks/check-result";
import { buildFindings, type Findings } from "@/kyc/insights/findings";
import type { Score } from "@/kyc/scoring/score";
import type { MoneyFigures } from "@/kyc/statements/money-figures";

// Invented findings for comparing AI providers on the insights step. No real company or
// person: these are the only inputs any trial or free-tier AI account may ever see.

const block = (bps: number) => ({ bps, confidenceBps: 10_000 });
const score = (value: number, band: Score["band"], hardStops: string[] = []): Score => ({
  score: value,
  band,
  confidenceBps: 10_000,
  hardStops,
  blocks: { documents: block(10_000), identity: block(8_000), financial: block(7_000), integrity: block(10_000) },
});
const check = (code: string, status: CheckResult["status"], detail: string, documentId = "doc_1"): CheckResult =>
  status === "pass" ? { code, status, detail } : { code, status, detail, evidence: { documentId, page: 1 } };

const healthy: MoneyFigures = {
  monthsCovered: 6,
  planMonthly: 2_368_100,
  avgMonthlyIncome: 18_500_000,
  leaseToIncomeBps: 1_280,
  lowestBalance: 21_900_000,
  daysBelowZero: 0,
  returnedItems: 0,
  existingDebtMonthly: 650_000,
  debtToIncomeBps: 351,
  topPayerShareBps: 2_794,
  largestBalanceDropBps: 0,
  reasons: [],
};

const passes = [
  "NAME_COMPANY",
  "LICENCE_NUMBER",
  "TRN_NUMBER",
  "EMIRATE_MATCH",
  "EID_SIDES_MATCH",
  "DOB_MATCH",
  "IBAN_CONSISTENT",
  "STMT_CONTINUITY",
].map((code) => check(code, "pass", "ok"));

export const insightScenarios: { name: string; findings: Findings }[] = [
  {
    name: "Clean, healthy trader",
    findings: buildFindings({
      score: score(96, "GREEN"),
      checks: passes,
      figures: healthy,
      figuresProblem: null,
      licenceActivities: ["Office Equipment Trading"],
    }),
  },
  {
    name: "One big customer, falling balance, employer elsewhere",
    findings: buildFindings({
      score: score(71, "AMBER"),
      checks: [
        ...passes,
        check("EID_EMPLOYER", "warn", 'Employer on the Emirates ID is "Harbour Logistics LLC", not this company.', "doc_eid_back"),
        check("NAME_SIGNATORY", "warn", "Names on the Passport and the Emirates ID front are spelled differently.", "doc_passport"),
      ],
      figures: { ...healthy, topPayerShareBps: 6_200, largestBalanceDropBps: 4_800, daysBelowZero: 3, returnedItems: 1 },
      figuresProblem: null,
      licenceActivities: ["IT Infrastructure Services", "Computer Equipment Trading"],
    }),
  },
  {
    name: "Expired licence, statements that do not add up, no income",
    findings: buildFindings({
      score: score(31, "RED", ["Trade licence has expired.", "2 bank statements do not add up."]),
      checks: [
        check("DOC_EXPIRED", "fail", "Expired on 2026-03-01, 258 day(s) before today (2026-11-14).", "doc_licence"),
        check(
          "STMT_CONTINUITY",
          "warn",
          "Closing balance does not carry over to the next opening balance at: 2026-07-31 → 2026-08-01.",
          "doc_aug",
        ),
        check(
          "DOB_MATCH",
          "warn",
          "Date of birth differs between the passport and the Emirates ID back: they may belong to different people.",
          "doc_passport",
        ),
      ],
      figures: {
        ...healthy,
        avgMonthlyIncome: 0,
        leaseToIncomeBps: null,
        debtToIncomeBps: null,
        topPayerShareBps: null,
        reasons: ["NO_CUSTOMER_INCOME"],
      },
      figuresProblem: null,
      licenceActivities: ["General Trading"],
    }),
  },
  {
    name: "Little could be read",
    findings: buildFindings({
      score: score(50, "AMBER"),
      checks: [
        check("NAME_COMPANY", "skipped", "Could not check: no company name in English was read from the documents."),
        check("STMT_COVERAGE", "fail", "Statements do not cover 2 of the 6 months needed: 2026-09, 2026-10.", "doc_statement"),
      ],
      figures: null,
      figuresProblem: "No full statement month is covered.",
      licenceActivities: [],
    }),
  },
];
