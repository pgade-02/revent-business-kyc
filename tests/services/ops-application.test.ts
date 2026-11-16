import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "@/db/client";
import { insertDocument, saveProcessingResult } from "@/db/documents";
import { applications } from "@/db/schema";
import { seedDatabase } from "@/db/seed/seed";
import type { DocumentSlot } from "@/kyc/documents/slots";
import { nextStages } from "@/ops/stages";
import { createApplication } from "@/services/applications";
import { requestInformation, reviewDocument } from "@/services/back-office";
import { loadOpsApplication } from "@/services/ops-application";

let db: Database;
const now = "2026-11-16T09:00:00.000Z";
const plan = { term: 36 as const, lines: [{ productId: "wireless-business-headset", quantity: 1, serviceIds: [] }] };

beforeAll(async () => {
  db = await openDatabase();
  await seedDatabase(db);
});

afterAll(async () => {
  await db.$client.close();
});

const document = (applicationId: number, slot: DocumentSlot, sha256: string) =>
  insertDocument(db, { applicationId, slot, fileKey: `test/${sha256}`, fileKind: "pdf", sizeBytes: 1, pageCount: 1, sha256 });

describe("loadOpsApplication", () => {
  it("lists current documents in checklist order with who reviewed them", async () => {
    const created = await createApplication(db, "seed-customer", plan);
    if (!created.ok) throw new Error(created.reason);
    const id = created.applicationId;
    await db.update(applications).set({ status: "submitted", submittedAt: now }).where(eq(applications.id, id));
    const passport = await document(id, "passport", "p1");
    await document(id, "trade_licence", "t1");
    await document(id, "trade_licence", "t2");
    await reviewDocument(db, { documentId: passport, actorId: "seed-reviewer", state: "rejected", now });

    const data = await loadOpsApplication(db, id);
    expect(data?.documents.map((row) => [row.slot, row.sha256, row.reviewState])).toEqual([
      ["trade_licence", "t2", "to_review"],
      ["passport", "p1", "rejected"],
    ]);
    expect(data?.documents[1]?.reviewedByName).toBeTruthy();
    expect(data?.documents[0]?.uploadedByName).toBeNull();
    expect(data?.reviewers.map((reviewer) => reviewer.id)).toContain("seed-reviewer");
  });

  it("includes the contact person, plan lines with product names, and the timeline", async () => {
    const created = await createApplication(db, "seed-customer", plan);
    if (!created.ok) throw new Error(created.reason);
    const id = created.applicationId;
    await db.update(applications).set({ status: "submitted", submittedAt: now }).where(eq(applications.id, id));
    await reviewDocument(db, { documentId: await document(id, "passport", "p9"), actorId: "seed-reviewer", state: "approved", now });

    const data = await loadOpsApplication(db, id);
    expect(data?.contact?.email).toBeTruthy();
    expect(data?.planLines).toEqual([{ id: expect.any(Number), productName: expect.any(String), quantity: 1, services: [] }]);
    expect(data?.timeline.map((entry) => [entry.event, entry.actorRole])).toEqual([["document_reviewed", "reviewer"]]);
  });

  it("adds a result to each document from its latest checks", async () => {
    const created = await createApplication(db, "seed-customer", plan);
    if (!created.ok) throw new Error(created.reason);
    const id = created.applicationId;
    await db.update(applications).set({ status: "submitted", submittedAt: now }).where(eq(applications.id, id));
    const licence = await document(id, "trade_licence", "adv1");
    const passport = await document(id, "passport", "adv2");
    const fields = { expiryDate: { value: "2027-01-01", page: 1, confidenceBps: 9_500 } };
    await saveProcessingResult(db, licence, { status: "ready", fields, results: [{ code: "DOC_EXPIRED", status: "pass", detail: "Valid until 2027-01-01." }] });
    await saveProcessingResult(db, passport, { status: "needs_fix", fields, results: [{ code: "DOC_EXPIRED", status: "fail", detail: "Expired on 2026-01-01." }] });

    const advice = (await loadOpsApplication(db, id))?.documents.map((row) => [row.slot, row.advice]);
    expect(advice).toEqual([
      ["trade_licence", { verdict: "passed", reasons: [] }],
      ["passport", { verdict: "problem", reasons: ["Expired on 2026-01-01."] }],
    ]);
  });

  it("compares the typed company details with what the licence says", async () => {
    const created = await createApplication(db, "seed-customer", plan);
    if (!created.ok) throw new Error(created.reason);
    const id = created.applicationId;
    await db
      .update(applications)
      .set({ status: "submitted", submittedAt: now, companyName: "Example Trading LLC", licenceNumber: "123456", emirate: "dubai" })
      .where(eq(applications.id, id));
    const licence = await document(id, "trade_licence", "cmp1");
    const read = (value: string) => ({ value, page: 1, confidenceBps: 9_500 });
    const fields = { companyName: read("EXAMPLE TRADING L.L.C."), licenceNumber: read("654321"), emirate: read("Dubai") };
    await saveProcessingResult(db, licence, { status: "ready", fields, results: [] });

    const comparisons = (await loadOpsApplication(db, id))?.comparisons;
    expect(comparisons?.companyName.verdict).toBe("matches");
    expect(comparisons?.licenceNumber).toEqual({ verdict: "different", reason: null, slot: "trade_licence", documentValue: "654321" });
    expect(comparisons?.emirate.verdict).toBe("matches");
    expect(comparisons?.signatoryName.verdict).toBeNull();
  });

  it("suggests a request from fixable failures and mismatched details, leaving out what was already asked", async () => {
    const created = await createApplication(db, "seed-customer", plan);
    if (!created.ok) throw new Error(created.reason);
    const id = created.applicationId;
    await db.update(applications).set({ status: "submitted", submittedAt: now, licenceNumber: "123456" }).where(eq(applications.id, id));
    const read = (value: string) => ({ value, page: 1, confidenceBps: 9_500 });
    const expired = { code: "DOC_EXPIRED", status: "fail" as const, detail: "Expired on 2026-01-01.", customerMessageKey: "Checks.DOC_EXPIRED" };
    await saveProcessingResult(db, await document(id, "passport", "sug1"), { status: "needs_fix", fields: {}, results: [expired] });
    await saveProcessingResult(db, await document(id, "emirates_id_front", "sug2"), { status: "needs_fix", fields: {}, results: [expired] });
    await saveProcessingResult(db, await document(id, "trade_licence", "sug3"), { status: "ready", fields: { licenceNumber: read("654321") }, results: [] });
    await requestInformation(db, { applicationId: id, actorId: "seed-reviewer", request: { items: [{ subject: "emirates_id_front", reason: "expired" }] }, now });

    expect((await loadOpsApplication(db, id))?.suggestedRequest).toEqual([
      { subject: "passport", reason: "expired" },
      { subject: "company_details", reason: "details_do_not_match" },
    ]);
  });

  it("returns nothing for an unknown application", async () => {
    expect(await loadOpsApplication(db, 999_999)).toBeNull();
  });
});

describe("nextStages", () => {
  it("offers only the moves the rules allow", () => {
    expect(nextStages("in_review")).toEqual(["waiting_on_customer", "approved", "rejected"]);
    expect(nextStages("approved")).toEqual(["in_review"]);
  });
});
