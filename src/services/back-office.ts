import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "@/db/client";
import { insertInfoRequest } from "@/db/info-requests";
import { applications, documents, users } from "@/db/schema";
import { recordEvent } from "@/db/timeline";
import type { DocumentReviewState } from "@/ops/document-review";
import type { InfoRequestInput } from "@/ops/info-requests";
import { canMoveTo, isOpen, type ApplicationStage } from "@/ops/stages";

export type ActionResult = { ok: true } | { ok: false; reason: "NOT_FOUND" | "NOT_ALLOWED" | "NOT_A_REVIEWER" };

async function stageOf(db: Database, applicationId: number): Promise<ApplicationStage | null> {
  const [row] = await db.select({ status: applications.status }).from(applications).where(eq(applications.id, applicationId));
  return row?.status ?? null;
}

export async function changeStage(db: Database, input: { applicationId: number; actorId: string; to: ApplicationStage; now: string }): Promise<ActionResult> {
  const from = await stageOf(db, input.applicationId);
  if (!from) return { ok: false, reason: "NOT_FOUND" };
  if (!canMoveTo(from, input.to)) return { ok: false, reason: "NOT_ALLOWED" };
  await db.update(applications).set({ status: input.to, stageChangedAt: input.now }).where(eq(applications.id, input.applicationId));
  await recordEvent(db, { applicationId: input.applicationId, actorId: input.actorId, event: "stage_changed", detail: { from, to: input.to } });
  return { ok: true };
}

// Sets the application's owner (a reviewer), or clears it with null.
export async function assignOwner(db: Database, input: { applicationId: number; actorId: string; ownerId: string | null }): Promise<ActionResult> {
  const stage = await stageOf(db, input.applicationId);
  if (!stage || stage === "draft") return { ok: false, reason: "NOT_FOUND" };
  if (input.ownerId) {
    const [owner] = await db.select({ role: users.role }).from(users).where(eq(users.id, input.ownerId));
    if (owner?.role !== "reviewer") return { ok: false, reason: "NOT_A_REVIEWER" };
  }
  await db.update(applications).set({ assignedTo: input.ownerId }).where(eq(applications.id, input.applicationId));
  await recordEvent(db, { applicationId: input.applicationId, actorId: input.actorId, event: "owner_changed", detail: { ownerId: input.ownerId } });
  return { ok: true };
}

// Approves or rejects one current document of an open application.
export async function reviewDocument(
  db: Database,
  input: { documentId: number; actorId: string; state: Exclude<DocumentReviewState, "to_review">; now: string },
): Promise<ActionResult> {
  const [document] = await db
    .select({ applicationId: documents.applicationId, slot: documents.slot, stage: applications.status })
    .from(documents)
    .innerJoin(applications, eq(documents.applicationId, applications.id))
    .where(and(eq(documents.id, input.documentId), isNull(documents.replacedAt)));
  if (!document) return { ok: false, reason: "NOT_FOUND" };
  if (!isOpen(document.stage)) return { ok: false, reason: "NOT_ALLOWED" };
  await db.update(documents).set({ reviewState: input.state, reviewedBy: input.actorId, reviewedAt: input.now }).where(eq(documents.id, input.documentId));
  await recordEvent(db, {
    applicationId: document.applicationId,
    actorId: input.actorId,
    event: "document_reviewed",
    detail: { documentId: input.documentId, slot: document.slot, state: input.state },
  });
  return { ok: true };
}

// Saves a request and moves the application to "waiting on the customer".
export async function requestInformation(
  db: Database,
  input: { applicationId: number; actorId: string; request: InfoRequestInput; now: string },
): Promise<ActionResult> {
  const stage = await stageOf(db, input.applicationId);
  if (!stage || !isOpen(stage)) return { ok: false, reason: stage ? "NOT_ALLOWED" : "NOT_FOUND" };
  const requestId = await insertInfoRequest(db, { applicationId: input.applicationId, createdBy: input.actorId, input: input.request });
  await recordEvent(db, {
    applicationId: input.applicationId,
    actorId: input.actorId,
    event: "information_requested",
    detail: { requestId, subjects: input.request.items.map((item) => item.subject) },
  });
  if (stage !== "waiting_on_customer") await changeStage(db, { applicationId: input.applicationId, actorId: input.actorId, to: "waiting_on_customer", now: input.now });
  return { ok: true };
}
