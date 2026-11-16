import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "@/db/client";
import { insertDocument } from "@/db/documents";
import { listInfoRequests } from "@/db/info-requests";
import { applications, documents } from "@/db/schema";
import { seedDatabase } from "@/db/seed/seed";
import { listTimeline } from "@/db/timeline";
import { createApplication } from "@/services/applications";
import { assignOwner, changeStage, requestInformation, reviewDocument } from "@/services/back-office";

let db: Database;

const reviewer = "seed-reviewer";
const now = "2026-11-14T09:00:00.000Z";
const plan = { term: 36 as const, lines: [{ productId: "wireless-business-headset", quantity: 1, serviceIds: [] }] };

beforeAll(async () => {
  db = await openDatabase();
  await seedDatabase(db);
});

afterAll(async () => {
  await db.$client.close();
});

async function submittedApplication(): Promise<number> {
  const created = await createApplication(db, "seed-customer", plan);
  if (!created.ok) throw new Error(created.reason);
  await db.update(applications).set({ status: "submitted", submittedAt: now }).where(eq(applications.id, created.applicationId));
  return created.applicationId;
}

const events = async (applicationId: number) => (await listTimeline(db, applicationId)).map((entry) => entry.event);
const stageOf = async (applicationId: number) => (await db.select().from(applications).where(eq(applications.id, applicationId)))[0]?.status;

describe("changeStage", () => {
  it("moves along an allowed path and records who and from where", async () => {
    const id = await submittedApplication();
    expect(await changeStage(db, { applicationId: id, actorId: reviewer, to: "in_review", now })).toEqual({ ok: true });
    expect(await stageOf(id)).toBe("in_review");
    const [entry] = await listTimeline(db, id);
    expect(entry).toMatchObject({ event: "stage_changed", detail: { from: "submitted", to: "in_review" } });
  });

  it("refuses a move the rules do not allow and changes nothing", async () => {
    const id = await submittedApplication();
    expect(await changeStage(db, { applicationId: id, actorId: reviewer, to: "draft", now })).toEqual({ ok: false, reason: "NOT_ALLOWED" });
    expect(await stageOf(id)).toBe("submitted");
    expect(await events(id)).toEqual([]);
  });
});

describe("assignOwner", () => {
  it("assigns a reviewer and can unassign", async () => {
    const id = await submittedApplication();
    expect(await assignOwner(db, { applicationId: id, actorId: reviewer, ownerId: reviewer })).toEqual({ ok: true });
    expect(await assignOwner(db, { applicationId: id, actorId: reviewer, ownerId: null })).toEqual({ ok: true });
    expect(await events(id)).toEqual(["owner_changed", "owner_changed"]);
  });

  it("refuses a customer as owner", async () => {
    const id = await submittedApplication();
    expect(await assignOwner(db, { applicationId: id, actorId: reviewer, ownerId: "seed-customer" })).toEqual({ ok: false, reason: "NOT_A_REVIEWER" });
  });
});

describe("reviewDocument", () => {
  it("approves a current document while the application is open", async () => {
    const id = await submittedApplication();
    const documentId = await insertDocument(db, { applicationId: id, slot: "passport", fileKey: "test/passport", fileKind: "pdf", sizeBytes: 1, pageCount: 1, sha256: "a" });
    expect(await reviewDocument(db, { documentId, actorId: reviewer, state: "approved", now })).toEqual({ ok: true });
    const [row] = await db.select().from(documents).where(eq(documents.id, documentId));
    expect(row).toMatchObject({ reviewState: "approved", reviewedBy: reviewer });
    expect((await listTimeline(db, id))[0]).toMatchObject({ event: "document_reviewed", detail: { slot: "passport", state: "approved" } });
  });

  it("refuses once the application is closed", async () => {
    const id = await submittedApplication();
    const documentId = await insertDocument(db, { applicationId: id, slot: "passport", fileKey: "test/passport", fileKind: "pdf", sizeBytes: 1, pageCount: 1, sha256: "b" });
    await changeStage(db, { applicationId: id, actorId: reviewer, to: "approved", now });
    expect(await reviewDocument(db, { documentId, actorId: reviewer, state: "rejected", now })).toEqual({ ok: false, reason: "NOT_ALLOWED" });
  });

  it("refuses a replaced document", async () => {
    const id = await submittedApplication();
    const first = await insertDocument(db, { applicationId: id, slot: "passport", fileKey: "test/1", fileKind: "pdf", sizeBytes: 1, pageCount: 1, sha256: "c" });
    await insertDocument(db, { applicationId: id, slot: "passport", fileKey: "test/2", fileKind: "pdf", sizeBytes: 1, pageCount: 1, sha256: "d" });
    expect(await reviewDocument(db, { documentId: first, actorId: reviewer, state: "approved", now })).toEqual({ ok: false, reason: "NOT_FOUND" });
  });
});

describe("requestInformation", () => {
  it("saves the request and moves the application to waiting on the customer", async () => {
    const id = await submittedApplication();
    const request = { items: [{ subject: "passport" as const, reason: "expired" as const, note: "Please upload the renewed passport" }] };
    expect(await requestInformation(db, { applicationId: id, actorId: reviewer, request, now })).toEqual({ ok: true });
    expect(await stageOf(id)).toBe("waiting_on_customer");
    const [saved] = await listInfoRequests(db, id);
    expect(saved?.items).toEqual(request.items.map((item) => ({ ...item, resolvedAt: null })));
    expect(saved).toMatchObject({ createdByName: expect.any(String), answeredAt: null });
    expect(await events(id)).toEqual(["stage_changed", "information_requested"]);
  });

  it("refuses on a closed application", async () => {
    const id = await submittedApplication();
    await changeStage(db, { applicationId: id, actorId: reviewer, to: "rejected", now });
    const request = { items: [{ subject: "company_details" as const, reason: "details_do_not_match" as const }] };
    expect(await requestInformation(db, { applicationId: id, actorId: reviewer, request, now })).toEqual({ ok: false, reason: "NOT_ALLOWED" });
    expect(await listInfoRequests(db, id)).toEqual([]);
  });
});
