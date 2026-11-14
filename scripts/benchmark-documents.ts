// Measures OCR and field reading on the synthetic Falcon documents, whose every printed value
// is known (tests/fixtures/realistic): speed per step, tokens, and which fields came back right.
//   npm run generate:documents   (once, to create test-documents/samples/realistic)
//   npm run benchmark:documents
// Results go to test-documents/benchmarks/ (git-ignored). Synthetic data only, so values are shown.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { readUploadLimits } from "@/config/limits";
import { startingScoringSettings } from "@/db/seed/scoring-settings";
import { monthEnd, todayInDubai } from "@/kyc/dates";
import { checkDocument } from "@/kyc/documents/check-document";
import type { DocumentSlot } from "@/kyc/documents/slots";
import type { ExtractedFields } from "@/kyc/extraction/extract-fields";
import { intakeFile } from "@/kyc/intake/intake-file";
import type { LlmProvider } from "@/kyc/interfaces/llm-provider";
import type { OcrProvider } from "@/kyc/interfaces/ocr-provider";
import { compareCompanyNames, companyNameKey } from "@/kyc/matching/company-names";
import { comparePersonNames } from "@/kyc/matching/person-names";
import { sameNumber, words } from "@/kyc/matching/text";
import { parseAmountFils } from "@/plan/money";
import { pdfLibInspector } from "@/providers/pdf-lib-inspector";
import { sharpImageProcessor } from "@/providers/sharp-image-processor";
import { getDocumentReaders } from "@/services/app-services";
import { companyA, saraHaddad } from "../tests/fixtures/realistic/companies";
import { uaeIban } from "../tests/fixtures/realistic/iban";
import { generateStatements } from "../tests/fixtures/realistic/statements";

process.loadEnvFile(".env.local");
const folder = path.join(process.cwd(), "test-documents", "samples", "realistic", "falcon");
const months = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
const statements = generateStatements(companyA, months);
const fullName = `${saraHaddad.givenNames} ${saraHaddad.surname}`;
const cutoffs = startingScoringSettings.nameMatch;

type Compare = (read: string, expected: string) => boolean;
const exact: Compare = (read, expected) => words(read).join(" ") === words(expected).join(" ");
const number: Compare = (read, expected) => sameNumber(read, expected) === "match";
const company: Compare = (read, expected) =>
  compareCompanyNames(read, expected) === "match" || companyNameKey(read) === companyNameKey(expected);
const person: Compare = (read, expected) => ["match", "possible_match"].includes(comparePersonNames(read, expected, cutoffs));
const money: Compare = (read, expected) => parseAmountFils(read) === parseAmountFils(expected);

type Expected = Record<string, { value: string | string[]; compare: Compare }>;
const licenceFields: Expected = {
  licenceNumber: { value: companyA.licenceNumber, compare: number },
  companyName: { value: companyA.name, compare: company },
  issueDate: { value: companyA.licenceIssued, compare: exact },
  expiryDate: { value: companyA.licenceExpires, compare: exact },
  emirate: { value: companyA.emirate, compare: exact },
  managerNames: { value: [fullName], compare: person },
};

// What each file should give back. Code-read values (machine-readable lines) are included,
// so the table shows the whole pipeline, not only the AI.
const answerKey: Record<string, { slot: DocumentSlot; fields: Expected; rows?: number }> = {
  "trade-licence.pdf": { slot: "trade_licence", fields: { ...licenceFields, activities: { value: companyA.activities, compare: exact } } },
  "trade-licence-photo.jpg": { slot: "trade_licence", fields: licenceFields }, // page 1 only: activities are on page 2
  "tax-certificate.pdf": {
    slot: "tax_certificate",
    fields: { trn: { value: companyA.trn, compare: number }, companyName: { value: companyA.name, compare: company } },
  },
  ...Object.fromEntries(
    statements.map((statement) => [
      `bank-statement-${statement.month}.pdf`,
      {
        slot: "bank_statement" as const,
        rows: statement.rows.length,
        fields: {
          accountHolder: { value: companyA.name, compare: company },
          iban: { value: uaeIban(companyA.bank.bankCode, companyA.bank.accountNumber), compare: number },
          currency: { value: "AED", compare: exact },
          periodStart: { value: `${statement.month}-01`, compare: exact },
          periodEnd: { value: monthEnd(statement.month), compare: exact },
          openingBalance: { value: (statement.openingFils / 100).toFixed(2), compare: money },
          closingBalance: { value: (statement.closingFils / 100).toFixed(2), compare: money },
        },
      },
    ]),
  ),
  "passport.jpg": {
    slot: "passport",
    fields: {
      fullName: { value: fullName, compare: person },
      passportNumber: { value: saraHaddad.passportNumber, compare: number },
      expiryDate: { value: saraHaddad.passportExpires, compare: exact },
      dateOfBirth: { value: saraHaddad.birthDate, compare: exact },
      nationality: { value: saraHaddad.nationality, compare: exact },
    },
  },
  "emirates-id-front.jpg": {
    slot: "emirates_id_front",
    fields: {
      fullName: { value: fullName, compare: person },
      emiratesIdNumber: { value: saraHaddad.emiratesId, compare: number },
      issueDate: { value: saraHaddad.emiratesIdIssued, compare: exact },
      expiryDate: { value: saraHaddad.emiratesIdExpires, compare: exact },
    },
  },
  "emirates-id-back.jpg": {
    slot: "emirates_id_back",
    fields: {
      employer: { value: saraHaddad.employer.en, compare: company },
      occupation: { value: saraHaddad.occupation.en, compare: exact },
      emiratesIdNumber: { value: saraHaddad.emiratesId, compare: number },
      expiryDate: { value: saraHaddad.emiratesIdExpires, compare: exact },
      dateOfBirth: { value: saraHaddad.birthDate, compare: exact },
    },
  },
};

type Call = { kind: string; ms: number; inputTokens?: number; outputTokens?: number };

// Wraps the real readers so every OCR and AI call is timed, without changing what they do.
function timed(readers: { ocr: OcrProvider; llm: LlmProvider }, calls: Call[]) {
  const ocr: OcrProvider = {
    async read(request) {
      const started = performance.now();
      const result = await readers.ocr.read(request);
      calls.push({ kind: "ocr", ms: Math.round(performance.now() - started) });
      return result;
    },
  };
  const llm: LlmProvider = {
    async generateJson(request) {
      const started = performance.now();
      const result = await readers.llm.generateJson(request);
      const usage = result.ok ? result.usage : undefined;
      calls.push({ kind: request.task, ms: Math.round(performance.now() - started), ...usage });
      return result;
    },
  };
  return { ocr, llm };
}

function scoreFields(fields: ExtractedFields | null, expected: Expected) {
  return Object.entries(expected).map(([name, { value, compare }]) => {
    const read = fields?.[name]?.value;
    const readList = read === undefined ? [] : typeof read === "string" ? [read] : [...read];
    const wantList = typeof value === "string" ? [value] : value;
    const right = readList.length > 0 && wantList.every((want) => readList.some((got) => compare(got, want)));
    return { field: name, right, read: read ?? null, expected: value, confidenceBps: fields?.[name]?.confidenceBps ?? null };
  });
}

async function main() {
  const readers = getDocumentReaders(process.env);
  const limits = readUploadLimits(process.env);
  const report = [];
  for (const [fileName, expected] of Object.entries(answerKey)) {
    const calls: Call[] = [];
    const bytes = new Uint8Array(readFileSync(path.join(folder, fileName)));
    const started = performance.now();
    const intake = await intakeFile({ bytes, limits, pdfInspector: pdfLibInspector, imageProcessor: sharpImageProcessor });
    if (!intake.ok) {
      report.push({ fileName, refused: intake.reason });
      continue;
    }
    const outcome = await checkDocument({
      documentId: fileName,
      slot: expected.slot,
      file: intake.file,
      today: todayInDubai(new Date()),
      expiresSoonDays: startingScoringSettings.expiresSoonDays,
      readers: { ...readers, ...timed(readers, calls) },
      limits,
    });
    const fields = scoreFields(outcome.fields, expected.fields);
    report.push({
      fileName,
      slot: expected.slot,
      status: outcome.status,
      problem: outcome.problem,
      totalMs: Math.round(performance.now() - started),
      ocrPages: outcome.ocrPages,
      calls,
      fieldsRight: fields.filter((field) => field.right).length,
      fieldsTotal: fields.length,
      fields,
      rows: expected.rows === undefined ? null : { read: outcome.transactions.length, expected: expected.rows },
      checks: outcome.results.map((result) => `${result.code}:${result.status}`),
    });
    const last = report.at(-1);
    if (last && "fieldsRight" in last) {
      const misses = fields.filter((field) => !field.right).map((field) => `${field.field} (read ${JSON.stringify(field.read)})`);
      const rows = last.rows ? ` · rows ${last.rows.read}/${last.rows.expected}` : "";
      console.log(
        `${fileName} | ${last.status} | ${last.totalMs} ms | fields ${last.fieldsRight}/${last.fieldsTotal}${rows}${misses.length ? ` | wrong or missing: ${misses.join("; ")}` : ""}`,
      );
    }
  }
  const outDir = path.join(process.cwd(), "test-documents", "benchmarks");
  mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `documents-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(`\nAll details: ${path.relative(process.cwd(), file)}`);
}

void main();
