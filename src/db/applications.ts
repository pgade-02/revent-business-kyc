import { pricePlan, type PlanTotals, type PricingFailure } from "@/plan/pricing";
import type { PlanInput } from "@/plan/plan-input";
import { routeForContractTotal, type Route } from "@/plan/route";
import type { Database } from "./client";
import { loadPriceBook } from "./price-book";
import { applications, planItems } from "./schema";
import { loadLatestScoringSettings } from "./scoring-settings";

export type CreateApplicationResult =
  | { ok: true; applicationId: number; totals: PlanTotals; route: Route }
  | PricingFailure;

// Prices the plan from the database (never from the browser), decides the route
// from the current settings, and saves the application with its items in one go.
export async function createApplication(db: Database, ownerId: string, plan: PlanInput): Promise<CreateApplicationResult> {
  const priceBook = await loadPriceBook(db);
  const priced = pricePlan(plan.lines, plan.term, priceBook);
  if (!priced.ok) return priced;

  const { version, settings } = await loadLatestScoringSettings(db);
  const route = routeForContractTotal(priced.totals.contractTotalFils, settings.routeThresholdFils);

  // A transaction: either the application and all its items are saved, or nothing is.
  const applicationId = await db.transaction(async (tx) => {
    const [saved] = await tx
      .insert(applications)
      .values({
        ownerId,
        term: plan.term,
        planMonthlyFils: priced.totals.planMonthlyFils,
        contractTotalFils: priced.totals.contractTotalFils,
        route,
        scoringSettingsVersion: version,
      })
      .returning({ id: applications.id });
    if (!saved) throw new Error("insert returned no row");
    await tx.insert(planItems).values(plan.lines.map((line) => ({ applicationId: saved.id, ...line })));
    return saved.id;
  });

  return { ok: true, applicationId, totals: priced.totals, route };
}
