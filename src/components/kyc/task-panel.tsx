import { EyeIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { readUploadLimits } from "@/config/limits";
import type { KycTask } from "@/kyc/documents/kyc-tasks";
import type { TaskContext } from "@/services/kyc-overview";
import { ContinueButton } from "./continue-button";
import { TASK_HREF, TASK_ICON } from "./task-routes";
import { TaskStatusPill } from "./task-status-pill";

// The right-hand side of the hub for one task: "Task 3 of 5", title, intro,
// the task's own content, and the Continue button.
export async function TaskPanel({ task, context, children }: { task: KycTask; context: TaskContext; children: ReactNode }) {
  const t = await getTranslations("Kyc");
  const Icon = TASK_ICON[task];
  const maxMb = Math.floor(readUploadLimits(process.env).maxBytes / (1024 * 1024));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-primary">
            <Icon className="size-4" aria-hidden />
          </span>
          {t("taskOf", { index: context.index, total: context.total })}
          <TaskStatusPill status={context.status} />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">{t(`tasks.${task}.title`)}</h2>
        <p className="text-muted-foreground">{t(`tasks.${task}.intro`)}</p>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <EyeIcon className="size-4" aria-hidden />
          {t("seenBy")}
        </p>
      </header>
      {children}
      <ContinueButton nextHref={context.nextTask ? TASK_HREF[context.nextTask] : null} fixes={context.fixes} maxMb={maxMb} />
    </div>
  );
}
