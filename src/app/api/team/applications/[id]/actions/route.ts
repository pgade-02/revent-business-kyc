import { accessDeniedResponse, findReviewerApplication, parseId } from "@/auth/access";
import { getAppDatabase } from "@/db/app-db";
import { reviewActionInput } from "@/kyc/review/review-action";
import { recordReviewAction } from "@/services/review";

// Records a reviewer's decision: approve, request a document, or reject (PRD §6, item 7).
// It records only; it never creates a quote or contacts anyone.
export async function POST(request: Request, context: RouteContext<"/api/team/applications/[id]/actions">) {
  const applicationId = parseId((await context.params).id);
  if (applicationId === null) return accessDeniedResponse("NOT_FOUND");

  const db = await getAppDatabase();
  const access = await findReviewerApplication(db, applicationId);
  if (!access.ok) return accessDeniedResponse(access.reason);

  const parsed = reviewActionInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid action" }, { status: 400 });

  const id = await recordReviewAction(db, { applicationId, reviewerId: access.user.id, action: parsed.data });
  return Response.json({ id }, { status: 201 });
}
