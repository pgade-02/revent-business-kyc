"use client";

import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatAed } from "@/lib/format-money";
import type { PlanTotals, Term } from "@/plan/pricing";

type TermPickerProps = {
  options: { term: Term; totals: PlanTotals | null }[];
  term: Term;
  onChange: (term: Term) => void;
};

// The three lease terms side by side, each showing what this plan would cost on it.
export function TermPicker({ options, term, onChange }: TermPickerProps) {
  const t = useTranslations("Plan");
  const locale = useLocale();

  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label={t("termTitle")}>
      {options.map((option) => (
        <Button
          key={option.term}
          variant={option.term === term ? "default" : "outline"}
          aria-pressed={option.term === term}
          className="h-auto flex-col gap-1 py-3"
          onClick={() => onChange(option.term)}
        >
          <span>{t("months", { count: option.term })}</span>
          {option.totals && (
            <span className="text-xs font-normal">
              {t("perMonth", { amount: formatAed(option.totals.planMonthlyFils, locale) })}
            </span>
          )}
        </Button>
      ))}
    </div>
  );
}
