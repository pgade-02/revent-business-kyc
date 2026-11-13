import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadLatestAssessment } from "@/db/assessments";
import { openDatabase, type Database } from "@/db/client";
import { saveCompanyDetails } from "@/db/company-details";
import { insertDocument, saveProcessingResult } from "@/db/documents";
import { applications } from "@/db/schema";
import { seedDatabase } from "@/db/seed/seed";
import { saveSignatoryDetails } from "@/db/signatory-details";
import type { DocumentSlot } from "@/kyc/documents/slots";
import { createApplication } from "@/services/applications";
import { monthEnd } from "@/kyc/dates";
import type { Transaction } from "@/kyc/statements/transaction";
import { createBrokenLlm, labelledLinesLlm } from "@/providers/fakes/fake-llm-provider";
import { companyA } from "../fixtures/realistic/companies";
import { generateStatements } from "../fixtures/realistic/statements";
import { runAssessment } from "@/services/run-assessment";

// Invented company and person.
let db: Database;
const ai = { llm: labelledLinesLlm, timeoutMs: 1_000 };
const plan = { term: 36 as const, lines: [{ productId: "wireless-business-headset", quantity: 1, serviceIds: [] }] };
const read = (value: string) => ({ value, page: 1, confidenceBps: 9_500 });

beforeAll(async () => {
  db = await openDatabase();
  await seedDatabase(db);
});

afterAll(async () => {
  await db.$client.close();
});

// Part 2 only runs on a submitted application; the Submit date sets the months needed.
const markSubmitted = (applicationId: number) =>
  db.update(applications).set({ status: "submitted", submittedAt: "2026-11-13T08:00:00.000Z" }).where(eq(applications.id, applicationId));

async function uploadWithFields(applicationId: number, slot: DocumentSlot, fields: Record<string, string>, transactions: Transaction[] = []) {
  const sha256 = `${applicationId}-${slot}-${fields.periodStart ?? ""}`;
  const id = await insertDocument(db, { applicationId, slot, fileKey: `test/${sha256}`, fileKind: "pdf", sizeBytes: 1, pageCount: 1, sha256 });
  const stored = Object.fromEntries(Object.entries(fields).map(([name, value]) => [name, read(value)]));
  await saveProcessingResult(db, id, { status: "ready", results: [], fields: stored, transactions });
  return id;
}

const amount = (fils: number) => (fils / 100).toFixed(2);

// The fictional company's six statements, stored as upload would have stored them.
async function uploadStatements(applicationId: number) {
  for (const statement of generateStatements(companyA, ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"])) {
    const periodEnd = monthEnd(statement.month);
    const rows = statement.rows.map((row) => ({ date: row.date, amountFils: row.creditFils - row.debitFils, balanceFils: row.balanceFils, description: row.description, page: 1 }));
    await uploadWithFields(
      applicationId,
      "bank_statement",
      { periodStart: `${statement.month}-01`, periodEnd, currency: "AED", openingBalance: amount(statement.openingFils), closingBalance: amount(statement.closingFils) },
      rows,
    );
  }
}

async function submittedApplication() {
  const created = await createApplication(db, "seed-customer", plan);
  if (!created.ok) throw new Error(created.reason);
  await markSubmitted(created.applicationId);
  return created.applicationId;
}

describe("runAssessment", () => {
  it("saves the cross-checks from stored fields and typed details as a new assessment", async () => {
    const created = await createApplication(db, "seed-customer", plan);
    if (!created.ok) throw new Error(created.reason);
    const applicationId = created.applicationId;
    const licenceId = await uploadWithFields(applicationId, "trade_licence", { companyName: "Example Trading LLC", licenceNumber: "999999", emirate: "Dubai" });
    await saveCompanyDetails(db, applicationId, {
      companyName: "Example Trading LLC",
      licenceNumber: "123456",
      yearEstablished: 2020,
      issuingAuthority: "Department of Economy and Tourism",
      emirate: "dubai",
      legalForm: "llc",
      trn: null,
      registeredAddress: "Office 1, Example Street, Dubai",
      deliverToRegisteredAddress: true,
    });
    await saveSignatoryDetails(db, applicationId, { isApplicant: true, fullName: "Example Person", signingEmail: "person@example.com", mobile: null });

    await markSubmitted(applicationId);
    await runAssessment(db, applicationId, ai);
    const assessment = await loadLatestAssessment(db, applicationId);
    const byCode = Object.fromEntries((assessment?.checks ?? []).map((check) => [check.code, check]));
    expect(assessment?.checks).toHaveLength(13);
    expect(byCode.NAME_COMPANY?.status).toBe("pass");
    expect(byCode.EMIRATE_MATCH?.status).toBe("pass");
    expect(byCode.LICENCE_NUMBER).toMatchObject({ status: "warn", evidence: { documentId: String(licenceId), page: 1 } });
    expect(byCode.TRN_NUMBER?.status).toBe("skipped");
    expect(byCode.STMT_COVERAGE?.status).toBe("skipped"); // no statements uploaded in this test
  });

  it("labels the stored rows and saves money figures built from them", async () => {
    const applicationId = await submittedApplication();
    await uploadStatements(applicationId);
    await runAssessment(db, applicationId, ai);
    const assessment = await loadLatestAssessment(db, applicationId);
    expect(assessment?.figuresProblem).toBeNull();
    expect(assessment?.figures).toMatchObject({ monthsCovered: 6, avgMonthlyIncome: companyA.monthlyIncomeFils, existingDebtMonthly: companyA.monthlyLoanRepaymentFils });
    expect(assessment?.checks.find((check) => check.code === "STMT_COVERAGE")?.status).toBe("pass");
  });

  it("leaves the figures empty, with the reason, when the AI cannot label the rows", async () => {
    const applicationId = await submittedApplication();
    await uploadStatements(applicationId);
    await runAssessment(db, applicationId, { llm: createBrokenLlm("unavailable"), timeoutMs: 1_000 });
    const assessment = await loadLatestAssessment(db, applicationId);
    expect(assessment).toMatchObject({ figures: null, figuresProblem: "Transactions could not be labelled (AI unavailable or answer off-form)." });
  });

  it("keeps earlier assessments when it runs again", async () => {
    const created = await createApplication(db, "seed-customer", plan);
    if (!created.ok) throw new Error(created.reason);
    await markSubmitted(created.applicationId);
    const first = await runAssessment(db, created.applicationId, ai);
    const second = await runAssessment(db, created.applicationId, ai);
    expect(second).toBeGreaterThan(first);
    expect((await loadLatestAssessment(db, created.applicationId))?.id).toBe(second);
  });
});
