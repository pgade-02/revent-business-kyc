import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "@/db/client";
import { saveCompanyDetails } from "@/db/company-details";
import { insertDocument } from "@/db/documents";
import { applications } from "@/db/schema";
import { seedDatabase } from "@/db/seed/seed";
import { saveSignatoryDetails } from "@/db/signatory-details";
import type { DocumentSlot } from "@/kyc/documents/slots";
import { listTimeline } from "@/db/timeline";
import { isApplicationReference } from "@/ops/reference";
import { createApplication } from "@/services/applications";
import { submitApplication } from "@/services/submit-application";

let db: Database;

const plan = { term: 36 as const, lines: [{ productId: "wireless-business-headset", quantity: 1, serviceIds: [] }] };
const slots: DocumentSlot[] = ["trade_licence", "tax_certificate", "bank_statement", "passport", "emirates_id_front", "emirates_id_back", "self_disclosure"];
const submittedAt = "2026-11-13T08:00:00.000Z";

beforeAll(async () => {
  db = await openDatabase();
  await seedDatabase(db);
});

afterAll(async () => {
  await db.$client.close();
});

async function newApplication() {
  const created = await createApplication(db, "seed-customer", plan);
  if (!created.ok) throw new Error(created.reason);
  return { id: created.applicationId, route: created.route };
}

async function fillIn(applicationId: number) {
  for (const slot of slots) {
    await insertDocument(db, { applicationId, slot, fileKey: `test/${slot}`, fileKind: "pdf", sizeBytes: 1, pageCount: 1, sha256: slot });
  }
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
}

describe("submitApplication", () => {
  it("refuses with the missing items and leaves the application a draft", async () => {
    const application = await newApplication();
    const result = await submitApplication(db, application, submittedAt);
    expect(result).toEqual({ ok: false, reason: "MISSING", missing: ["company_details", "signatory_details", ...slots] });
    const [row] = await db.select().from(applications).where(eq(applications.id, application.id));
    expect(row).toMatchObject({ status: "draft", submittedAt: null });
  });

  it("marks a complete application submitted, once", async () => {
    const application = await newApplication();
    await fillIn(application.id);

    expect(await submitApplication(db, application, submittedAt)).toEqual({ ok: true });
    const [row] = await db.select().from(applications).where(eq(applications.id, application.id));
    expect(row?.status).toBe("submitted");
    expect(new Date(row?.submittedAt ?? "").toISOString()).toBe(submittedAt);
    expect(isApplicationReference(row?.reference ?? "")).toBe(true);
    expect(row?.reference?.startsWith("RB-26-")).toBe(true);
    expect((await listTimeline(db, application.id)).map((entry) => entry.event)).toEqual(["submitted"]);

    expect(await submitApplication(db, application, submittedAt)).toEqual({ ok: false, reason: "ALREADY_SUBMITTED" });
  });
});
