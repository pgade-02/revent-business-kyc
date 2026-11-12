"use client";

import { ChevronRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { TaskSummary } from "@/services/kyc-overview";
import { TASK_HREF, TASK_ICON } from "./task-routes";
import { TaskStatusPill } from "./task-status-pill";

// The list of tasks on the left. The open task is highlighted; a task that is not
// built yet is shown but cannot be opened.
export function TaskList({ tasks, thresholdLabel }: { tasks: TaskSummary[]; thresholdLabel: string }) {
  const t = useTranslations("Kyc.tasks");
  const pathname = usePathname();

  return (
    <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
      {tasks.map(({ task, status }) => {
        const Icon = TASK_ICON[task];
        const active = pathname === TASK_HREF[task];
        const disabled = status === "coming_soon";
        const content = (
          <>
            <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", active ? "bg-card text-primary" : "bg-secondary text-muted-foreground")}>
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex items-start justify-between gap-3">
                <span className="font-medium">{t(`${task}.title`)}</span>
                <TaskStatusPill status={status} />
              </span>
              <span className="text-sm text-muted-foreground">{t(`${task}.summary`, { threshold: thresholdLabel })}</span>
            </span>
            {!disabled && <ChevronRightIcon className="mt-3 size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />}
          </>
        );
        return (
          <li key={task}>
            {disabled ? (
              <div className="flex gap-4 p-5 opacity-70">{content}</div>
            ) : (
              <Link
                href={TASK_HREF[task]}
                aria-current={active ? "page" : undefined}
                className={cn("flex gap-4 p-5 transition-colors hover:bg-accent", active && "bg-accent")}
              >
                {content}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
