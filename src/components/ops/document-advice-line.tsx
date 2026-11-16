import { CheckIcon, ChevronDownIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { checkLabel } from "@/components/team/check-labels";
import type { CheckResult } from "@/kyc/checks/check-result";
import type { DocumentAdvice, DocumentVerdict } from "@/ops/document-advice";
import { cn } from "@/lib/utils";

const VERDICT: Record<DocumentVerdict, { label: string; style: string; Icon: typeof CheckIcon }> = {
  passed: { label: "Passed", style: "bg-success-soft text-success", Icon: CheckIcon },
  needs_look: { label: "Needs a look", style: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200", Icon: TriangleAlertIcon },
  problem: { label: "Failed", style: "bg-destructive/10 text-destructive", Icon: XIcon },
};

const MARK: Record<CheckResult["status"], { Icon: typeof CheckIcon; className: string }> = {
  pass: { Icon: CheckIcon, className: "text-success" },
  warn: { Icon: TriangleAlertIcon, className: "text-amber-700 dark:text-amber-300" },
  skipped: { Icon: TriangleAlertIcon, className: "text-amber-700 dark:text-amber-300" },
  fail: { Icon: XIcon, className: "text-destructive" },
};

// File checks that only matter when they find something; a pass would just add noise.
const SHOWN_ONLY_WHEN_FOUND = ["FILE_DUPLICATE", "FILE_REUSED"];

// Lists checks with a mark each, in plain words or with their detail.
function CheckList({ checks, words }: { checks: readonly CheckResult[]; words: (check: CheckResult) => string }) {
  return (
    <ul className="flex flex-col gap-1">
      {checks.map((check, index) => {
        const { Icon, className } = MARK[check.status];
        return (
          <li key={`${check.code}-${index}`} className="flex items-start gap-2">
            <Icon className={cn("mt-0.5 size-4 shrink-0", className)} aria-hidden />
            <span>{words(check)}</span>
          </li>
        );
      })}
    </ul>
  );
}

// Shows a document's result (click to see every check), the reasons when it is not a pass, and things to check across documents.
export function DocumentAdviceLine({ advice, checks, thingsToCheck }: { advice: DocumentAdvice; checks: readonly CheckResult[]; thingsToCheck: readonly CheckResult[] }) {
  const { label, style, Icon } = VERDICT[advice.verdict];
  const listed = checks.filter((check) => check.status !== "pass" || !SHOWN_ONLY_WHEN_FOUND.includes(check.code));
  return (
    <div className="flex flex-col gap-2 text-sm">
      <details className="group">
        <summary className={cn("flex w-fit cursor-pointer list-none items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", style)}>
          <Icon className="size-3.5" aria-hidden />
          {label}
          {listed.length > 0 && <ChevronDownIcon className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />}
        </summary>
        {listed.length > 0 && (
          <div className="mt-2 ps-1">
            <CheckList checks={listed} words={(check) => checkLabel(check.code, check.status)} />
          </div>
        )}
      </details>
      {advice.reasons.length > 0 && (
        <ul className="list-disc ps-5 text-muted-foreground">
          {advice.reasons.map((reason, index) => (
            <li key={index}>{reason}</li>
          ))}
        </ul>
      )}
      {thingsToCheck.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="font-medium">Things to check</span>
          <CheckList checks={thingsToCheck} words={(check) => check.detail} />
        </div>
      )}
    </div>
  );
}
