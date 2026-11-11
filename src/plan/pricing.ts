import { vatOnMonthly } from "./money";

export const TERMS = [24, 36, 48] as const;
export type Term = (typeof TERMS)[number];

// Monthly price in fils per term. A term can be missing (not offered).
export type TermPrices = Readonly<Partial<Record<Term, number>>>;

// Prices come from the `prices` table; the caller loads them and passes them in.
export type PriceBook = {
  products: ReadonlyMap<string, TermPrices>;
  services: ReadonlyMap<string, TermPrices>;
};

export type PlanLine = {
  productId: string;
  serviceIds: readonly string[];
  quantity: number;
};

export type PlanTotals = {
  term: Term;
  planMonthlyFils: number; // excluding VAT
  vatMonthlyFils: number; // display only
  contractTotalFils: number; // planMonthly × term, excluding VAT
};

export type PricingFailure =
  | { ok: false; reason: "EMPTY_PLAN" }
  | { ok: false; reason: "INVALID_QUANTITY"; productId: string }
  | { ok: false; reason: "MISSING_PRICE"; itemId: string; term: Term };

export type PricingResult = { ok: true; totals: PlanTotals } | PricingFailure;

// Line monthly = (product price + its service prices) × quantity, all at the plan's term.
export function pricePlan(lines: readonly PlanLine[], term: Term, prices: PriceBook): PricingResult {
  if (lines.length === 0) return { ok: false, reason: "EMPTY_PLAN" };

  let planMonthlyFils = 0;
  for (const line of lines) {
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) {
      return { ok: false, reason: "INVALID_QUANTITY", productId: line.productId };
    }
    const productPrice = prices.products.get(line.productId)?.[term];
    if (productPrice === undefined) {
      return { ok: false, reason: "MISSING_PRICE", itemId: line.productId, term };
    }
    let unitMonthly = productPrice;
    for (const serviceId of line.serviceIds) {
      const servicePrice = prices.services.get(serviceId)?.[term];
      if (servicePrice === undefined) {
        return { ok: false, reason: "MISSING_PRICE", itemId: serviceId, term };
      }
      unitMonthly += servicePrice;
    }
    planMonthlyFils += unitMonthly * line.quantity;
  }

  return {
    ok: true,
    totals: {
      term,
      planMonthlyFils,
      vatMonthlyFils: vatOnMonthly(planMonthlyFils),
      contractTotalFils: planMonthlyFils * term,
    },
  };
}
