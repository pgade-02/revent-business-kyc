"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { Catalogue } from "@/db/catalogue";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { pricePlan, TERMS, type PlanLine, type PriceBook, type Term } from "@/plan/pricing";
import { PlanSummary, type SaveState } from "./plan-summary";
import { ProductRow } from "./product-row";
import { TermPicker } from "./term-picker";

const CATEGORIES = ["technology", "furniture", "office_appliances"] as const;

// Holds the customer's choices and shows live totals. The totals here are for
// display; the server prices the plan again from the database when it is saved.
export function PlanBuilder({ catalogue }: { catalogue: Catalogue }) {
  const t = useTranslations("Plan");
  const [term, setTerm] = useState<Term>(24);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [chosenServices, setChosenServices] = useState<Record<string, string[]>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const priceBook: PriceBook = useMemo(
    () => ({
      products: new Map(catalogue.products.map((product) => [product.id, product.monthlyFils])),
      services: new Map(catalogue.services.map((service) => [service.id, service.monthlyFils])),
    }),
    [catalogue],
  );

  const lines: PlanLine[] = Object.entries(quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([productId, quantity]) => ({ productId, quantity, serviceIds: chosenServices[productId] ?? [] }));
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  const termOptions = TERMS.map((option) => {
    const priced = lines.length > 0 ? pricePlan(lines, option, priceBook) : null;
    return { term: option, totals: priced?.ok ? priced.totals : null };
  });
  const currentTotals = termOptions.find((option) => option.term === term)?.totals ?? null;

  // Any change after saving means the saved plan is out of date, so allow saving again.
  function changed() {
    if (saveState !== "saving") setSaveState("idle");
  }

  function setQuantity(productId: string, quantity: number) {
    setQuantities((previous) => ({ ...previous, [productId]: Math.max(0, quantity) }));
    changed();
  }

  function toggleService(productId: string, serviceId: string, chosen: boolean) {
    setChosenServices((previous) => {
      const current = previous[productId] ?? [];
      const next = chosen ? [...current, serviceId] : current.filter((id) => id !== serviceId);
      return { ...previous, [productId]: next };
    });
    changed();
  }

  async function proceed() {
    setSaveState("saving");
    const response = await fetch("/api/applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ term, lines }),
    }).catch(() => null);
    setSaveState(response?.status === 201 ? "saved" : "failed");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
      <div className="flex flex-col gap-6">
        {CATEGORIES.map((category) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle>{t(`categories.${category}`)}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {catalogue.products
                  .filter((product) => product.category === category)
                  .map((product) => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      services={catalogue.services}
                      term={term}
                      quantity={quantities[product.id] ?? 0}
                      chosenServiceIds={chosenServices[product.id] ?? []}
                      onQuantityChange={(quantity) => setQuantity(product.id, quantity)}
                      onServiceToggle={(serviceId, chosen) => toggleService(product.id, serviceId, chosen)}
                    />
                  ))}
              </ul>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <CardTitle>{t("termTitle")}</CardTitle>
            <CardDescription>{t("termHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <TermPicker
              options={termOptions}
              term={term}
              onChange={(next) => {
                setTerm(next);
                changed();
              }}
            />
          </CardContent>
        </Card>
      </div>

      <div className="lg:sticky lg:top-6">
        <PlanSummary totals={currentTotals} itemCount={itemCount} saveState={saveState} onProceed={proceed} />
      </div>
    </div>
  );
}
