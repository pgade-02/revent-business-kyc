import { desc, eq } from "drizzle-orm";
import type { ReviewActionInput } from "@/kyc/review/review-action";
import type { Database } from "./client";
import { reviewActions, users } from "./schema";

export async function insertReviewAction(
  db: Database,
  action: { applicationId: number; assessmentId: number | null; reviewerId: string; input: ReviewActionInput },
): Promise<number> {
  const { input } = action;
  const [saved] = await db
    .insert(reviewActions)
    .values({
      applicationId: action.applicationId,
      assessmentId: action.assessmentId,
      reviewerId: action.reviewerId,
      action: input.action,
      slot: input.action === "request_document" ? input.slot : null,
      reason: input.reason ?? null,
    })
    .returning({ id: reviewActions.id });
  if (!saved) throw new Error("insert returned no row");
  return saved.id;
}

// Newest first, with the reviewer's name for the history list.
export async function listReviewActions(db: Database, applicationId: number) {
  return db
    .select({
      id: reviewActions.id,
      action: reviewActions.action,
      slot: reviewActions.slot,
      reason: reviewActions.reason,
      createdAt: reviewActions.createdAt,
      reviewerName: users.name,
    })
    .from(reviewActions)
    .innerJoin(users, eq(reviewActions.reviewerId, users.id))
    .where(eq(reviewActions.applicationId, applicationId))
    .orderBy(desc(reviewActions.id));
}
