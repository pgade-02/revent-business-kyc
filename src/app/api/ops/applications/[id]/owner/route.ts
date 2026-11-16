import { z } from "zod";
import { accessDeniedResponse, findReviewerApplication, parseId } from "@/auth/access";
import { getAppDatabase } from "@/db/app-db";
import { assignOwner } from "@/services/back-office";
import { actionResponse } from "../../../action-response";

const ownerInput = z.object({ ownerId: z.string().min(1).nullable() });

// Sets or clears the application's owner.
export async function PUT(request: Request, context: RouteContext<"/api/ops/applications/[id]/owner">) {
  const applicationId = parseId((await context.params).id);
  if (applicationId === null) return accessDeniedResponse("NOT_FOUND");
  const db = await getAppDatabase();
  const access = await findReviewerApplication(db, applicationId);
  if (!access.ok) return accessDeniedResponse(access.reason);

  const parsed = ownerInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Expected an owner" }, { status: 400 });
  return actionResponse(await assignOwner(db, { applicationId, actorId: access.user.id, ownerId: parsed.data.ownerId }));
}
