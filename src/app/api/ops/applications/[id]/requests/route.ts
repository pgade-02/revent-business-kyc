import { accessDeniedResponse, findReviewerApplication, parseId } from "@/auth/access";
import { getAppDatabase } from "@/db/app-db";
import { infoRequestSchema } from "@/ops/info-requests";
import { requestInformation } from "@/services/back-office";
import { actionResponse } from "../../../action-response";

// Asks the customer for more information.
export async function POST(request: Request, context: RouteContext<"/api/ops/applications/[id]/requests">) {
  const applicationId = parseId((await context.params).id);
  if (applicationId === null) return accessDeniedResponse("NOT_FOUND");
  const db = await getAppDatabase();
  const access = await findReviewerApplication(db, applicationId);
  if (!access.ok) return accessDeniedResponse(access.reason);

  const parsed = infoRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Each item needs what to ask for and a reason" }, { status: 400 });
  return actionResponse(await requestInformation(db, { applicationId, actorId: access.user.id, request: parsed.data, now: new Date().toISOString() }));
}
