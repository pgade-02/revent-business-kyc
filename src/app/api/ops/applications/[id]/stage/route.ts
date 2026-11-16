import { z } from "zod";
import { accessDeniedResponse, findReviewerApplication, parseId } from "@/auth/access";
import { getAppDatabase } from "@/db/app-db";
import { APPLICATION_STAGES } from "@/ops/stages";
import { changeStage } from "@/services/back-office";
import { actionResponse } from "../../../action-response";

const stageInput = z.object({ to: z.enum(APPLICATION_STAGES) });

// Moves the application to another stage.
export async function PUT(request: Request, context: RouteContext<"/api/ops/applications/[id]/stage">) {
  const applicationId = parseId((await context.params).id);
  if (applicationId === null) return accessDeniedResponse("NOT_FOUND");
  const db = await getAppDatabase();
  const access = await findReviewerApplication(db, applicationId);
  if (!access.ok) return accessDeniedResponse(access.reason);

  const parsed = stageInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Expected a stage" }, { status: 400 });
  return actionResponse(await changeStage(db, { applicationId, actorId: access.user.id, to: parsed.data.to, now: new Date().toISOString() }));
}
