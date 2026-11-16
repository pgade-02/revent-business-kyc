import type { ActionResult } from "@/services/back-office";

const STATUS = { NOT_FOUND: 404, NOT_ALLOWED: 409, NOT_A_REVIEWER: 400 } as const;

// Turns a back-office action result into an HTTP response.
export function actionResponse(result: ActionResult): Response {
  return result.ok ? new Response(null, { status: 204 }) : Response.json({ reason: result.reason }, { status: STATUS[result.reason] });
}
