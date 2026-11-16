import { desc, eq } from "drizzle-orm";
import { timelineDetailSchema, type TimelineDetail, type TimelineEvent } from "@/ops/timeline";
import type { Database } from "./client";
import { timelineEvents, users } from "./schema";

export type NewTimelineEvent = { applicationId: number; actorId: string | null; event: TimelineEvent; detail?: TimelineDetail };

export async function recordEvent(db: Database, event: NewTimelineEvent): Promise<void> {
  await db.insert(timelineEvents).values({ ...event, detail: event.detail ?? {} });
}

// Lists an application's events, newest first, with who did each one.
export async function listTimeline(db: Database, applicationId: number) {
  const rows = await db
    .select({ id: timelineEvents.id, event: timelineEvents.event, detail: timelineEvents.detail, createdAt: timelineEvents.createdAt, actorName: users.name, actorRole: users.role })
    .from(timelineEvents)
    .leftJoin(users, eq(timelineEvents.actorId, users.id))
    .where(eq(timelineEvents.applicationId, applicationId))
    .orderBy(desc(timelineEvents.id));
  return rows.map((row) => ({ ...row, detail: timelineDetailSchema.parse(row.detail) }));
}
