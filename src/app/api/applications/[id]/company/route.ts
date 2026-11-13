import { accessDeniedResponse, findCustomerApplication, parseId } from "@/auth/access";
import { getAppDatabase } from "@/db/app-db";
import { saveCompanyDetails } from "@/db/company-details";
import { todayInDubai } from "@/kyc/dates";
import { companyDetailsSchema } from "@/kyc/company/company-details";

// Save Company details. Only the owner of a draft application may change them.
export async function PUT(request: Request, context: RouteContext<"/api/applications/[id]/company">) {
  const applicationId = parseId((await context.params).id);
  if (applicationId === null) return accessDeniedResponse("NOT_FOUND");

  const db = await getAppDatabase();
  const access = await findCustomerApplication(db, applicationId);
  if (!access.ok) return accessDeniedResponse(access.reason);
  if (access.value.status !== "draft") return Response.json({ error: "Already submitted" }, { status: 409 });

  const currentYear = Number(todayInDubai(new Date()).slice(0, 4));
  const parsed = companyDetailsSchema(currentYear).safeParse(await request.json().catch(() => null));
  // Field names only: the form shows its own message next to each one.
  if (!parsed.success) return Response.json({ invalidFields: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))] }, { status: 400 });

  await saveCompanyDetails(db, applicationId, parsed.data);
  return new Response(null, { status: 204 });
}
