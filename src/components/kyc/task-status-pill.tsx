import { AlertCircleIcon, CheckCircle2Icon, CircleDashedIcon, CircleIcon, ClockIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { TaskStatus } from "@/kyc/documents/kyc-tasks";
import { cn } from "@/lib/utils";

const styles: Record<TaskStatus, { className: string; Icon: typeof CircleIcon }> = {
  completed: { className: "bg-success-soft text-success", Icon: CheckCircle2Icon },
  needs_fix: { className: "bg-destructive/10 text-destructive", Icon: AlertCircleIcon },
  in_progress: { className: "bg-brand-soft text-brand-soft-foreground", Icon: CircleDashedIcon },
  not_started: { className: "bg-secondary text-muted-foreground", Icon: CircleIcon },
  coming_soon: { className: "bg-secondary text-muted-foreground", Icon: ClockIcon },
};

// The small rounded label next to each task: "Completed", "Not started", …
export function TaskStatusPill({ status }: { status: TaskStatus }) {
  const t = useTranslations("Kyc.status");
  const { className, Icon } = styles[status];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", className)}>
      <Icon className="size-3.5" aria-hidden />
      {t(status)}
    </span>
  );
}
