import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadLatestAssessment } from "@/db/assessments";
import { openDatabase, type Database } from "@/db/client";
import { saveCompanyDetails } from "@/db/company-details";
import { insertDocument, saveProcessingResult } from "@/db/documents";
import { seedDatabase } from "@/db/seed/seed";
import { saveSignatoryDetails } from "@/db/signatory-details";
import type { DocumentSlot } from "@/kyc/documents/slots";
import { createApplication } from "@/services/applications";
import { runAssessment } from "@/services/run-assessment";

// Invented company and person.
let db: Database;
const plan = { term: 36 as const, lines: [{ productId: "wireless-business-headset", quantity: 1, serviceIds: [] }] };
const read = (value: string) => ({ value, page: 1, confidenceBps: 9_500 });

beforeAll(async () => {
  db = await openDatabase();
  await seedDatabase(db);
});

afterAll(async () => {
  await db.$client.close();
});

async function uploadWithFields(applicationId: number, slot: DocumentSlot, fields: Record<string, string>) {
  const id = await insertDocument(db, { applicationId, slot, fileKey: `test/${slot}`, fileKind: "pdf", sizeBytes: 1, pageCount: 1, sha256: `${applicationId}-${slot}` });
  await saveProcessingResult(db, id, { status: "ready", results: [], fields: Object.fromEntries(Object.entries(fields).map(([name, value]) => [name, read(value)])) });
  return id;
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

    await runAssessment(db, applicationId);
    const assessment = await loadLatestAssessment(db, applicationId);
    const byCode = Object.fromEntries((assessment?.checks ?? []).map((check) => [check.code, check]));
    expect(assessment?.checks).toHaveLength(12);
    expect(byCode.NAME_COMPANY?.status).toBe("pass");
    expect(byCode.EMIRATE_MATCH?.status).toBe("pass");
    expect(byCode.LICENCE_NUMBER).toMatchObject({ status: "warn", evidence: { documentId: String(licenceId), page: 1 } });
    expect(byCode.TRN_NUMBER?.status).toBe("skipped");
  });

  it("keeps earlier assessments when it runs again", async () => {
    const created = await createApplication(db, "seed-customer", plan);
    if (!created.ok) throw new Error(created.reason);
    const first = await runAssessment(db, created.applicationId);
    const second = await runAssessment(db, created.applicationId);
    expect(second).toBeGreaterThan(first);
    expect((await loadLatestAssessment(db, created.applicationId))?.id).toBe(second);
  });
});
