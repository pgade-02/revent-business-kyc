import { z } from "zod";
import { accessDeniedResponse, findReviewerDocument, parseId } from "@/auth/access";
import { getAppDatabase } from "@/db/app-db";
import { reviewDocument } from "@/services/back-office";
import { actionResponse } from "../../../action-response";

const reviewInput = z.object({ state: z.enum(["approved", "rejected"]) });

// Approves or rejects one document.
export async function PUT(request: Request, context: RouteContext<"/api/ops/documents/[id]/review">) {
  const documentId = parseId((await context.params).id);
  if (documentId === null) return accessDeniedResponse("NOT_FOUND");
  const db = await getAppDatabase();
  const access = await findReviewerDocument(db, documentId);
  if (!access.ok) return accessDeniedResponse(access.reason);

  const parsed = reviewInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Expected approved or rejected" }, { status: 400 });
  return actionResponse(await reviewDocument(db, { documentId, actorId: access.user.id, state: parsed.data.state, now: new Date().toISOString() }));
}
