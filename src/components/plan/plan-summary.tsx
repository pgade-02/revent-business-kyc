"use client";

import { useLocale, useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatAed } from "@/lib/format-money";
import type { PlanTotals } from "@/plan/pricing";

export type SaveState = "idle" | "saving" | "saved" | "failed";

type PlanSummaryProps = {
  totals: PlanTotals | null;
  itemCount: number;
  saveState: SaveState;
  onProceed: () => void;
};

// The right-hand card: the plan's money figures and the Proceed button.
export function PlanSummary({ totals, itemCount, saveState, onProceed }: PlanSummaryProps) {
  const t = useTranslations("Plan");
  const locale = useLocale();
  const aed = (fils: number) => formatAed(fils, locale);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("summaryTitle")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("itemCount", { count: itemCount })}</p>
      </CardHeader>
      <CardContent>
        {totals ? (
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm" data-testid="plan-totals">
            <dt>{t("monthlyExclVat")}</dt>
            <dd className="text-end text-lg font-medium tabular-nums">{aed(totals.planMonthlyFils)}</dd>
            <dt>{t("vat")}</dt>
            <dd className="text-end tabular-nums">{aed(totals.vatMonthlyFils)}</dd>
            <dt>{t("monthlyInclVat")}</dt>
            <dd className="text-end tabular-nums">{aed(totals.monthlyInclVatFils)}</dd>
            <dt>{t("fullTermExclVat")}</dt>
            <dd className="text-end tabular-nums">{aed(totals.contractTotalFils)}</dd>
            <dt>{t("fullTermInclVat")}</dt>
            <dd className="text-end tabular-nums">{aed(totals.contractTotalInclVatFils)}</dd>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">{t("emptyPlan")}</p>
        )}
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-2">
        <Button disabled={!totals || saveState === "saving" || saveState === "saved"} onClick={onProceed}>
          {saveState === "saving" ? t("saving") : t("proceed")}
        </Button>
        <p role="status" className="text-sm">
          {saveState === "saved" && t("saved")}
          {saveState === "failed" && <span className="text-destructive">{t("saveFailed")}</span>}
        </p>
        {saveState === "saved" && (
          <Link href="/kyc" className={buttonVariants({ variant: "outline" })}>
            {t("continueToVerification")}
          </Link>
        )}
      </CardFooter>
    </Card>
  );
}
