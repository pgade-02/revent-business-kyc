import { getOrStartCustomerSession } from "@/auth/session";
import { createApplication } from "@/services/applications";
import { getAppDatabase } from "@/db/app-db";
import { planInputSchema } from "@/plan/plan-input";

// Save the customer's plan (the Proceed button). The body holds only choices;
// prices, totals and the route are computed here from the database.
export async function POST(request: Request) {
  const session = await getOrStartCustomerSession();
  if (!session.ok) return Response.json({ error: "Only customers can create applications" }, { status: 403 });

  const parsed = planInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid plan" }, { status: 400 });

  const db = await getAppDatabase();
  const result = await createApplication(db, session.user.id, parsed.data);
  if (!result.ok) return Response.json({ error: result.reason }, { status: 400 });

  return Response.json(
    {
      applicationId: result.applicationId,
      planMonthlyFils: result.totals.planMonthlyFils,
      contractTotalFils: result.totals.contractTotalFils,
      route: result.route,
    },
    { status: 201 },
  );
}
