import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "@/db/client";
import { listInfoRequests, listOpenRequestItems } from "@/db/info-requests";
import { applications } from "@/db/schema";
import { seedDatabase } from "@/db/seed/seed";
import { listTimeline } from "@/db/timeline";
import { createApplication } from "@/services/applications";
import { requestInformation } from "@/services/back-office";
import { canCustomerChange, recordCustomerAnswer } from "@/services/request-answers";

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

const load = async (id: number) => {
  const [row] = await db.select().from(applications).where(eq(applications.id, id));
  if (!row) throw new Error("missing application");
  return row;
};

async function waitingApplication(): Promise<number> {
  const created = await createApplication(db, "seed-customer", plan);
  if (!created.ok) throw new Error(created.reason);
  const id = created.applicationId;
  await db.update(applications).set({ status: "submitted", submittedAt: now }).where(eq(applications.id, id));
  const request = {
    items: [
      { subject: "passport" as const, reason: "expired" as const, note: "Renewed passport please", noteAr: "يرجى تحميل الجواز المجدد" },
      { subject: "company_details" as const, reason: "details_do_not_match" as const },
    ],
  };
  await requestInformation(db, { applicationId: id, actorId: "seed-reviewer", request, now });
  return id;
}

describe("canCustomerChange", () => {
  it("allows anything in a draft", async () => {
    const created = await createApplication(db, "seed-customer", plan);
    if (!created.ok) throw new Error(created.reason);
    expect(await canCustomerChange(db, await load(created.applicationId), "trade_licence")).toBe(true);
  });

  it("allows only the requested items while waiting on the customer", async () => {
    const application = await load(await waitingApplication());
    expect(await canCustomerChange(db, application, "passport")).toBe(true);
    expect(await canCustomerChange(db, application, "company_details")).toBe(true);
    expect(await canCustomerChange(db, application, "trade_licence")).toBe(false);
    expect(await canCustomerChange(db, application, "signatory_details")).toBe(false);
  });

  it("allows nothing once the application is in review", async () => {
    const id = await waitingApplication();
    await db.update(applications).set({ status: "in_review" }).where(eq(applications.id, id));
    expect(await canCustomerChange(db, await load(id), "passport")).toBe(false);
  });
});

describe("recordCustomerAnswer", () => {
  it("marks each item done and returns the application to review after the last one", async () => {
    const id = await waitingApplication();
    expect(await recordCustomerAnswer(db, { application: await load(id), customerId: "seed-customer", subject: "passport", now })).toBe(false);
    expect((await listOpenRequestItems(db, id)).map((item) => item.subject)).toEqual(["company_details"]);
    expect((await load(id)).status).toBe("waiting_on_customer");

    expect(await recordCustomerAnswer(db, { application: await load(id), customerId: "seed-customer", subject: "company_details", now })).toBe(true);
    expect((await load(id)).status).toBe("in_review");
    const [request] = await listInfoRequests(db, id);
    expect(request?.answeredAt).not.toBeNull();
    expect(request?.items[0]).toMatchObject({ noteAr: "يرجى تحميل الجواز المجدد", resolvedAt: expect.any(String) });
    const events = (await listTimeline(db, id)).map((entry) => entry.event);
    expect(events.slice(0, 3)).toEqual(["stage_changed", "information_provided", "information_provided"]);
  });

  it("does nothing when the application is not waiting on the customer", async () => {
    const created = await createApplication(db, "seed-customer", plan);
    if (!created.ok) throw new Error(created.reason);
    expect(await recordCustomerAnswer(db, { application: await load(created.applicationId), customerId: "seed-customer", subject: "passport", now })).toBe(false);
    expect(await listTimeline(db, created.applicationId)).toEqual([]);
  });
});
