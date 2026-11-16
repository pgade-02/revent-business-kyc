import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listBoardCards } from "@/db/board";
import { openDatabase, type Database } from "@/db/client";
import { insertDocument } from "@/db/documents";
import { applications } from "@/db/schema";
import { seedDatabase } from "@/db/seed/seed";
import { createApplication } from "@/services/applications";
import { assignOwner, reviewDocument } from "@/services/back-office";

let db: Database;
const now = "2026-11-16T09:00:00.000Z";
const plan = { term: 36 as const, lines: [{ productId: "wireless-business-headset", quantity: 3, serviceIds: [] }] };

beforeAll(async () => {
  db = await openDatabase();
  await seedDatabase(db);
});

afterAll(async () => {
  await db.$client.close();
});

async function newApplication(submitted: boolean): Promise<number> {
  const created = await createApplication(db, "seed-customer", plan);
  if (!created.ok) throw new Error(created.reason);
  if (submitted) await db.update(applications).set({ status: "submitted", submittedAt: now, stageChangedAt: now }).where(eq(applications.id, created.applicationId));
  return created.applicationId;
}

const document = (applicationId: number, slot: "passport" | "trade_licence", sha256: string) =>
  insertDocument(db, { applicationId, slot, fileKey: `test/${sha256}`, fileKind: "pdf", sizeBytes: 1, pageCount: 1, sha256 });

describe("listBoardCards", () => {
  it("leaves drafts off the board", async () => {
    const draft = await newApplication(false);
    expect((await listBoardCards(db)).some((found) => found.id === draft)).toBe(false);
  });

  it("counts items, current documents still to review, and names the owner", async () => {
    const id = await newApplication(true);
    const passport = await document(id, "passport", "p1");
    await document(id, "trade_licence", "t1");
    await document(id, "trade_licence", "t2");
    await reviewDocument(db, { documentId: passport, actorId: "seed-reviewer", state: "approved", now });
    await assignOwner(db, { applicationId: id, actorId: "seed-reviewer", ownerId: "seed-reviewer" });

    const found = (await listBoardCards(db)).find((row) => row.id === id);
    expect(found).toMatchObject({ stage: "submitted", itemCount: 3, toReviewCount: 1, ownerId: "seed-reviewer" });
    expect(found?.ownerName).toBeTruthy();
  });
});
