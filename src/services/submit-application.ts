import { and, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { applications } from "@/db/schema";
import { submitBlockers, type SubmitBlocker } from "@/kyc/submit/submit-blockers";
import { loadApplicationProgress } from "./application-progress";

export type SubmitResult = { ok: true } | { ok: false; reason: "MISSING"; missing: SubmitBlocker[] } | { ok: false; reason: "ALREADY_SUBMITTED" };

// Submit = the completeness gate, then mark the application submitted. The assessment
// (Part 2) is started separately by the caller.
export async function submitApplication(
  db: Database,
  application: { id: number; route: "self_disclosure" | "verification_call" },
  submittedAt: string,
): Promise<SubmitResult> {
  const { inputs } = await loadApplicationProgress(db, application.id);
  const missing = submitBlockers({ route: application.route, ...inputs });
  if (missing.length > 0) return { ok: false, reason: "MISSING", missing };

  // "and status = draft" makes a double click (or two tabs) submit only once.
  const updated = await db
    .update(applications)
    .set({ status: "submitted", submittedAt })
    .where(and(eq(applications.id, application.id), eq(applications.status, "draft")))
    .returning({ id: applications.id });
  return updated.length === 1 ? { ok: true } : { ok: false, reason: "ALREADY_SUBMITTED" };
}
