import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { BoardCard } from "@/ops/board";
import type { Database } from "./client";
import { applications, documents, planItems, users } from "./schema";

const owner = alias(users, "owner");

// Lists every submitted application with what its board card shows.
export async function listBoardCards(db: Database): Promise<BoardCard[]> {
  const itemCount = db
    .select({ applicationId: planItems.applicationId, count: sql<number>`sum(${planItems.quantity})::int`.as("item_count") })
    .from(planItems)
    .groupBy(planItems.applicationId)
    .as("item_counts");
  const toReview = db
    .select({ applicationId: documents.applicationId, count: sql<number>`count(*)::int`.as("to_review_count") })
    .from(documents)
    .where(and(isNull(documents.replacedAt), eq(documents.reviewState, "to_review")))
    .groupBy(documents.applicationId)
    .as("to_review_counts");

  const rows = await db
    .select({
      id: applications.id,
      reference: applications.reference,
      stage: applications.status,
      stageChangedAt: applications.stageChangedAt,
      submittedAt: applications.submittedAt,
      companyName: applications.companyName,
      route: applications.route,
      term: applications.term,
      planMonthlyFils: applications.planMonthlyFils,
      itemCount: itemCount.count,
      toReviewCount: toReview.count,
      ownerId: applications.assignedTo,
      ownerName: owner.name,
    })
    .from(applications)
    .leftJoin(itemCount, eq(itemCount.applicationId, applications.id))
    .leftJoin(toReview, eq(toReview.applicationId, applications.id))
    .leftJoin(owner, eq(owner.id, applications.assignedTo))
    .where(ne(applications.status, "draft"));
  return rows.map((row) => ({ ...row, itemCount: row.itemCount ?? 0, toReviewCount: row.toReviewCount ?? 0 }));
}

