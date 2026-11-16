import { randomInt } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { applications } from "@/db/schema";
import { recordEvent } from "@/db/timeline";
import { applicationReference } from "@/ops/reference";
import { submitBlockers, type SubmitBlocker } from "@/kyc/submit/submit-blockers";
import { loadApplicationProgress } from "./application-progress";

export type SubmitResult = { ok: true } | { ok: false; reason: "MISSING"; missing: SubmitBlocker[] } | { ok: false; reason: "ALREADY_SUBMITTED" };

// Submits a complete draft and gives it a reference.
export async function submitApplication(
  db: Database,
  application: { id: number; route: "self_disclosure" | "verification_call" },
  submittedAt: string,
  actorId: string | null = null,
): Promise<SubmitResult> {
  const { inputs } = await loadApplicationProgress(db, application.id);
  const missing = submitBlockers({ route: application.route, ...inputs });
  if (missing.length > 0) return { ok: false, reason: "MISSING", missing };

  // "and status = draft" makes a double click (or two tabs) submit only once.
  const updated = await db
    .update(applications)
    .set({ status: "submitted", submittedAt, stageChangedAt: submittedAt, reference: applicationReference(submittedAt, randomInt) })
    .where(and(eq(applications.id, application.id), eq(applications.status, "draft")))
    .returning({ id: applications.id });
  if (updated.length !== 1) return { ok: false, reason: "ALREADY_SUBMITTED" };
  await recordEvent(db, { applicationId: application.id, actorId, event: "submitted" });
  return { ok: true };
}
