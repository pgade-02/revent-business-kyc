import { CheckIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import type { DocumentAdvice, DocumentVerdict } from "@/ops/document-advice";
import { cn } from "@/lib/utils";

const VERDICT: Record<DocumentVerdict, { label: string; style: string; Icon: typeof CheckIcon }> = {
  passed: { label: "All checks passed", style: "bg-success-soft text-success", Icon: CheckIcon },
  needs_look: { label: "Needs a look", style: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200", Icon: TriangleAlertIcon },
  problem: { label: "Problem found", style: "bg-destructive/10 text-destructive", Icon: XIcon },
};

// Shows one document's result and the reasons behind it.
export function DocumentAdviceLine({ advice }: { advice: DocumentAdvice }) {
  const { label, style, Icon } = VERDICT[advice.verdict];
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className={cn("flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", style)}>
        <Icon className="size-3.5" aria-hidden />
        {label}
      </span>
      {advice.reasons.length > 0 && (
        <ul className="list-disc ps-5 text-muted-foreground">
          {advice.reasons.map((reason, index) => (
            <li key={index}>{reason}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
