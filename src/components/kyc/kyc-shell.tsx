import { LockIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { formatAed } from "@/lib/format-money";
import type { KycOverview } from "@/services/kyc-overview";
import { TaskList } from "./task-list";

// The Business verification frame shared by every task page (live-site layout):
// title and progress on top, the task list on the left, the open task on the right.
export async function KycShell({ overview, children }: { overview: KycOverview; children: ReactNode }) {
  const t = await getTranslations("Kyc");
  const locale = await getLocale();
  const total = overview.tasks.length;
  const remaining = total - overview.completedCount;
  const percent = Math.round((overview.completedCount / total) * 100);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>

      <div className="mt-8">
        <p className="text-sm font-medium">{t("progress", { done: overview.completedCount, total })}</p>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={overview.completedCount}
          aria-label={t("progress", { done: overview.completedCount, total })}
        >
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-start">
        <div className="flex flex-col gap-4">
          <TaskList tasks={overview.tasks} thresholdLabel={formatAed(overview.routeThresholdFils, locale)} />
          {/* Review and submit is a later step; it stays locked until every task is done. */}
          <Button variant="secondary" size="lg" disabled className="h-12 w-full">
            <LockIcon aria-hidden />
            {t("reviewAndSubmit")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">{t("finishMore", { count: remaining })}</p>
        </div>
        <section className="rounded-2xl border bg-card p-6 sm:p-8">{children}</section>
      </div>
    </main>
  );
}
