"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { CatalogueProduct, CatalogueService } from "@/db/catalogue";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatAed } from "@/lib/format-money";
import type { Term } from "@/plan/pricing";

type ProductRowProps = {
  product: CatalogueProduct;
  services: CatalogueService[];
  term: Term;
  quantity: number;
  chosenServiceIds: string[];
  onQuantityChange: (quantity: number) => void;
  onServiceToggle: (serviceId: string, chosen: boolean) => void;
};

// One product: its price at the chosen term, a − / + quantity control, and,
// once it is in the plan, the optional services for it.
export function ProductRow(props: ProductRowProps) {
  const { product, services, term, quantity, chosenServiceIds, onQuantityChange, onServiceToggle } = props;
  const t = useTranslations("Plan");
  const locale = useLocale();
  const price = product.monthlyFils[term];

  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">{product.name}</p>
          {product.specs && <p className="text-sm text-muted-foreground">{product.specs}</p>}
          <p className="text-sm">
            {price === undefined ? t("notOffered") : t("perMonth", { amount: formatAed(price, locale) })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("decrease", { name: product.name })}
            disabled={quantity === 0}
            onClick={() => onQuantityChange(quantity - 1)}
          >
            <MinusIcon />
          </Button>
          <span className="w-8 text-center tabular-nums" aria-label={t("quantity", { name: product.name })}>
            {quantity}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("increase", { name: product.name })}
            disabled={price === undefined}
            onClick={() => onQuantityChange(quantity + 1)}
          >
            <PlusIcon />
          </Button>
        </div>
      </div>

      {quantity > 0 && (
        <fieldset className="flex flex-col gap-2 ps-4">
          <legend className="mb-1 text-sm text-muted-foreground">{t("services")}</legend>
          {services.map((service) => {
            const servicePrice = service.monthlyFils[term];
            const id = `${product.id}-${service.id}`;
            return (
              <label key={service.id} htmlFor={id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  id={id}
                  checked={chosenServiceIds.includes(service.id)}
                  disabled={servicePrice === undefined}
                  onCheckedChange={(checked) => onServiceToggle(service.id, checked)}
                />
                <span>{service.name}</span>
                {servicePrice !== undefined && (
                  <span className="text-muted-foreground">
                    {t("perMonth", { amount: formatAed(servicePrice, locale) })}
                  </span>
                )}
              </label>
            );
          })}
        </fieldset>
      )}
    </li>
  );
}
