import { accessDeniedResponse, findCustomerApplication, parseId } from "@/auth/access";
import { getAppDatabase } from "@/db/app-db";
import { runAssessmentSafely } from "@/services/app-services";
import { canCustomerChange, recordCustomerAnswer } from "@/services/request-answers";
import { saveSignatoryDetails } from "@/db/signatory-details";
import { signatoryDetailsSchema } from "@/kyc/signatory/signatory-details";

// Save the authorised signatory's details, while the application is a draft or a reviewer asked for them.
export async function PUT(request: Request, context: RouteContext<"/api/applications/[id]/signatory">) {
  const applicationId = parseId((await context.params).id);
  if (applicationId === null) return accessDeniedResponse("NOT_FOUND");

  const db = await getAppDatabase();
  const access = await findCustomerApplication(db, applicationId);
  if (!access.ok) return accessDeniedResponse(access.reason);
  if (!(await canCustomerChange(db, access.value, "signatory_details"))) return Response.json({ error: "Already submitted" }, { status: 409 });

  const parsed = signatoryDetailsSchema.safeParse(await request.json().catch(() => null));
  // Field names only: the form shows its own message next to each one.
  if (!parsed.success) return Response.json({ invalidFields: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))] }, { status: 400 });

  await saveSignatoryDetails(db, applicationId, parsed.data);
  const backToReview = await recordCustomerAnswer(db, { application: access.value, customerId: access.user.id, subject: "signatory_details", now: new Date().toISOString() });
  if (backToReview) await runAssessmentSafely(db, applicationId);
  return new Response(null, { status: 204 });
}
