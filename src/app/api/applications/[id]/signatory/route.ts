import { accessDeniedResponse, findCustomerApplication, parseId } from "@/auth/access";
import { getAppDatabase } from "@/db/app-db";
import { saveSignatoryDetails } from "@/db/signatory-details";
import { signatoryDetailsSchema } from "@/kyc/signatory/signatory-details";

// Save the authorised signatory's details. Only the owner of a draft application may change them.
export async function PUT(request: Request, context: RouteContext<"/api/applications/[id]/signatory">) {
  const applicationId = parseId((await context.params).id);
  if (applicationId === null) return accessDeniedResponse("NOT_FOUND");

  const db = await getAppDatabase();
  const access = await findCustomerApplication(db, applicationId);
  if (!access.ok) return accessDeniedResponse(access.reason);
  if (access.value.status !== "draft") return Response.json({ error: "Already submitted" }, { status: 409 });

  const parsed = signatoryDetailsSchema.safeParse(await request.json().catch(() => null));
  // Field names only: the form shows its own message next to each one.
  if (!parsed.success) return Response.json({ invalidFields: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))] }, { status: 400 });

  await saveSignatoryDetails(db, applicationId, parsed.data);
  return new Response(null, { status: 204 });
}
