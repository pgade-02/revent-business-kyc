import { CheckIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { BandBadge } from "@/components/team/band-badge";
import { FiguresTable, PatternsCard } from "@/components/team/review-sections";
import type { SavedAssessment } from "@/db/assessments";
import type { CheckResult } from "@/kyc/checks/check-result";
import type { DocumentSlot } from "@/kyc/documents/slots";

const MARK: Record<CheckResult["status"], { Icon: typeof CheckIcon; className: string }> = {
  pass: { Icon: CheckIcon, className: "text-success" },
  warn: { Icon: TriangleAlertIcon, className: "text-amber-700 dark:text-amber-300" },
  skipped: { Icon: TriangleAlertIcon, className: "text-amber-700 dark:text-amber-300" },
  fail: { Icon: XIcon, className: "text-destructive" },
};

// Lists the checks across documents that did not pass, problems first.
function CrossCheckList({ checks }: { checks: readonly CheckResult[] }) {
  const notPassed = checks.filter((check) => check.status !== "pass").sort((a, b) => Number(b.status === "fail") - Number(a.status === "fail"));
  if (notPassed.length === 0) {
    return (
      <p className="flex items-center gap-1 text-sm text-success">
        <CheckIcon className="size-4" aria-hidden /> All checks across documents passed.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {notPassed.map((check, index) => {
        const { Icon, className } = MARK[check.status];
        return (
          <li key={`${check.code}-${index}`} className="flex items-start gap-2">
            <Icon className={`mt-0.5 size-4 shrink-0 ${className}`} aria-hidden />
            <span>{check.detail}</span>
          </li>
        );
      })}
    </ul>
  );
}

// Shows the failures that stop the application, in place of a score.
function Stopped({ stops }: { stops: readonly string[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {[...new Set(stops)].map((stop) => (
        <li key={stop} className="flex items-start gap-2 font-semibold text-destructive">
          <XIcon className="mt-1 size-5 shrink-0" aria-hidden />
          <span>
            Failed: {stop} This stops the application.
          </span>
        </li>
      ))}
    </ul>
  );
}

// Shows the score with its band (or what stops the application), the checks across documents, patterns and statement figures.
export function RiskCard({ assessment, slots }: { assessment: SavedAssessment | null; slots: ReadonlyMap<string, DocumentSlot> }) {
  if (!assessment) return <p className="text-sm text-muted-foreground">No risk assessment yet. It runs when the application is submitted.</p>;
  const { score } = assessment;
  return (
    <div className="flex flex-col gap-5 rounded-xl border p-4">
      {!score ? (
        <span className="text-muted-foreground">Not scored.</span>
      ) : score.hardStops.length > 0 ? (
        <Stopped stops={score.hardStops} />
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-4xl font-semibold">{score.score}</span>
          <BandBadge band={score.band} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Checks across documents</h3>
        <CrossCheckList checks={assessment.checks} />
      </div>

      <PatternsCard insights={assessment.insights} slots={slots} />

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Bank statement summary</h3>
        <FiguresTable figures={assessment.figures} problem={assessment.figuresProblem} />
      </div>
    </div>
  );
}
