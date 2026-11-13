import { accessDeniedResponse, findCustomerApplication, parseId } from "@/auth/access";
import { getAppDatabase } from "@/db/app-db";
import type { Database } from "@/db/client";
import { readUploadLimits } from "@/config/limits";
import { getDocumentReaders } from "@/services/app-services";
import { runAssessment } from "@/services/run-assessment";
import { submitApplication } from "@/services/submit-application";

// The customer's Submit has already succeeded, so a bug here must not show them an error.
// Only the id and error type are logged: the message could hold document values.
async function runAssessmentSafely(db: Database, applicationId: number) {
  try {
    const ai = { llm: getDocumentReaders(process.env).llm, timeoutMs: readUploadLimits(process.env).llmTimeoutMs };
    await runAssessment(db, applicationId, ai);
  } catch (error) {
    console.error(`Assessment failed for application ${applicationId}: ${error instanceof Error ? error.name : "unknown error"}`);
  }
}

// Submit the application. Refused with the list of what is missing until every required
// file is uploaded and both details forms are saved (PRD §5, decision log 49).
export async function POST(_request: Request, context: RouteContext<"/api/applications/[id]/submit">) {
  const applicationId = parseId((await context.params).id);
  if (applicationId === null) return accessDeniedResponse("NOT_FOUND");

  const db = await getAppDatabase();
  const access = await findCustomerApplication(db, applicationId);
  if (!access.ok) return accessDeniedResponse(access.reason);

  const result = await submitApplication(db, access.value, new Date().toISOString());
  if (result.ok) {
    await runAssessmentSafely(db, applicationId);
    return new Response(null, { status: 204 });
  }
  if (result.reason === "MISSING") return Response.json({ missing: result.missing }, { status: 400 });
  return Response.json({ error: "Already submitted" }, { status: 409 });
}
