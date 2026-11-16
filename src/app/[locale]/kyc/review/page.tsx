import { CheckCircle2Icon, ChevronRightIcon, ClockIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RequestBanner } from "@/components/kyc/request-banner";
import { SubmitButton } from "@/components/kyc/submit-button";
import { TASK_HREF } from "@/components/kyc/task-routes";
import { TaskStatusPill } from "@/components/kyc/task-status-pill";
import { Link } from "@/i18n/navigation";
import { blockerTask, type SubmitBlocker } from "@/kyc/submit/submit-blockers";
import { loadKycOverview } from "@/services/kyc-overview";

// Review and submit (PRD §4, screen 8), then "Verification in progress".
export default async function ReviewPage({ params }: PageProps<"/[locale]/kyc/review">) {
  setRequestLocale((await params).locale);
  const overview = await loadKycOverview();
  if (!overview) return null; // the layout already shows "Build your plan first"
  const t = await getTranslations("Kyc");

  if (overview.openRequestItems.length > 0) return <RequestBanner items={overview.openRequestItems} />;
  if (overview.submitted) {
    return (
      <div className="flex flex-col items-start gap-4">
        <span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-primary">
          <ClockIcon className="size-5" aria-hidden />
        </span>
        <h2 className="text-2xl font-semibold tracking-tight">{t("review.inProgressTitle")}</h2>
        <p className="text-muted-foreground">{t("review.inProgressBody")}</p>
      </div>
    );
  }

  const fixCount = overview.documents.filter((document) => document.status === "needs_fix").length;
  const blockers = overview.submitBlockers;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">{t("reviewAndSubmit")}</h2>
        <p className="text-muted-foreground">{t("review.intro")}</p>
      </header>

      <ul className="divide-y rounded-xl border">
        {overview.tasks.map(({ task, status }) => (
          <li key={task}>
            <Link href={TASK_HREF[task]} className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-accent">
              <span className="font-medium">{t(`tasks.${task}.title`)}</span>
              <TaskStatusPill status={status} />
            </Link>
          </li>
        ))}
      </ul>

      {blockers.length > 0 ? (
        <section aria-labelledby="still-needed" className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <h3 id="still-needed" className="font-semibold">
            {t("review.stillNeeded", { count: blockers.length })}
          </h3>
          <ul className="flex flex-col gap-2">
            {blockers.map((blocker) => (
              <li key={blocker}>
                <Link href={TASK_HREF[blockerTask(blocker)]} className="flex items-center gap-2 text-sm underline-offset-4 hover:underline">
                  <ChevronRightIcon className="size-4 rtl:rotate-180" aria-hidden />
                  <BlockerLabel blocker={blocker} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2Icon className="size-4" aria-hidden />
          {t("review.allIn")}
        </p>
      )}

      {fixCount > 0 && (
        <p className="text-sm text-muted-foreground">{t("review.fixesDoNotBlock", { count: fixCount })}</p>
      )}

      <SubmitButton applicationId={overview.applicationId} disabled={blockers.length > 0} />
    </div>
  );
}

async function BlockerLabel({ blocker }: { blocker: SubmitBlocker }) {
  const t = await getTranslations();
  if (blocker === "company_details") return t("Kyc.review.missing.company_details");
  if (blocker === "signatory_details") return t("Kyc.review.missing.signatory_details");
  return t("Kyc.review.missing.file", { name: t(`Documents.slots.${blocker}.label`) });
}
