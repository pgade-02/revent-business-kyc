import { accessDeniedResponse, findCustomerApplication, parseId } from "@/auth/access";
import { getAppDatabase } from "@/db/app-db";
import { runAssessmentSafely } from "@/services/app-services";
import { submitApplication } from "@/services/submit-application";

// Submit the application. Refused with the list of what is missing until every required
// file is uploaded and both details forms are saved (PRD §5, decision log 49).
export async function POST(_request: Request, context: RouteContext<"/api/applications/[id]/submit">) {
  const applicationId = parseId((await context.params).id);
  if (applicationId === null) return accessDeniedResponse("NOT_FOUND");

  const db = await getAppDatabase();
  const access = await findCustomerApplication(db, applicationId);
  if (!access.ok) return accessDeniedResponse(access.reason);

  const result = await submitApplication(db, access.value, new Date().toISOString(), access.user.id);
  if (result.ok) {
    await runAssessmentSafely(db, applicationId);
    return new Response(null, { status: 204 });
  }
  if (result.reason === "MISSING") return Response.json({ missing: result.missing }, { status: 400 });
  return Response.json({ error: "Already submitted" }, { status: 409 });
}
