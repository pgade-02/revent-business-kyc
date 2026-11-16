import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { requestItemSchema, type InfoRequestInput, type RequestSubject } from "@/ops/info-requests";
import type { Database } from "./client";
import { infoRequestItems, infoRequests, users } from "./schema";

// Saves a request and its items together.
export async function insertInfoRequest(db: Database, request: { applicationId: number; createdBy: string; input: InfoRequestInput }): Promise<number> {
  return db.transaction(async (tx) => {
    const [saved] = await tx.insert(infoRequests).values({ applicationId: request.applicationId, createdBy: request.createdBy }).returning({ id: infoRequests.id });
    if (!saved) throw new Error("insert returned no row");
    await tx.insert(infoRequestItems).values(request.input.items.map((item) => ({ requestId: saved.id, ...item, note: item.note || null, noteAr: item.noteAr || null })));
    return saved.id;
  });
}

// Lists an application's requests with their items and who sent them, newest first.
export async function listInfoRequests(db: Database, applicationId: number) {
  const requests = await db
    .select({ id: infoRequests.id, createdAt: infoRequests.createdAt, answeredAt: infoRequests.answeredAt, createdByName: users.name })
    .from(infoRequests)
    .leftJoin(users, eq(users.id, infoRequests.createdBy))
    .where(eq(infoRequests.applicationId, applicationId))
    .orderBy(desc(infoRequests.id));
  if (requests.length === 0) return [];
  const items = await db.select().from(infoRequestItems).where(inArray(infoRequestItems.requestId, requests.map((request) => request.id)));
  return requests.map((request) => ({
    ...request,
    items: items
      .filter((item) => item.requestId === request.id)
      .map((item) => ({ ...parseItem(item), resolvedAt: item.resolvedAt })),
  }));
}

type ItemRow = typeof infoRequestItems.$inferSelect;
const parseItem = (item: ItemRow) =>
  requestItemSchema.parse({ subject: item.subject, reason: item.reason, note: item.note ?? undefined, noteAr: item.noteAr ?? undefined });

// Lists the items the customer still has to answer.
export async function listOpenRequestItems(db: Database, applicationId: number) {
  const rows = await db
    .select({ item: infoRequestItems })
    .from(infoRequestItems)
    .innerJoin(infoRequests, eq(infoRequests.id, infoRequestItems.requestId))
    .where(and(eq(infoRequests.applicationId, applicationId), isNull(infoRequests.answeredAt), isNull(infoRequestItems.resolvedAt)))
    .orderBy(infoRequestItems.id);
  return rows.map(({ item }) => ({ id: item.id, ...parseItem(item) }));
}

// Marks the open items for one subject done, and each request answered once none of its items are open.
export async function resolveRequestItems(db: Database, applicationId: number, subject: RequestSubject, now: string): Promise<void> {
  const open = (await listOpenRequestItems(db, applicationId)).filter((item) => item.subject === subject);
  if (open.length === 0) return;
  await db.transaction(async (tx) => {
    await tx.update(infoRequestItems).set({ resolvedAt: now }).where(inArray(infoRequestItems.id, open.map((item) => item.id)));
    const requests = await tx.select({ id: infoRequests.id }).from(infoRequests).where(and(eq(infoRequests.applicationId, applicationId), isNull(infoRequests.answeredAt)));
    for (const request of requests) {
      const [stillOpen] = await tx.select({ id: infoRequestItems.id }).from(infoRequestItems).where(and(eq(infoRequestItems.requestId, request.id), isNull(infoRequestItems.resolvedAt))).limit(1);
      if (!stillOpen) await tx.update(infoRequests).set({ answeredAt: now }).where(eq(infoRequests.id, request.id));
    }
  });
}
