import { SLOT_LABEL } from "@/kyc/checks/read-value";
import type { CheckResult } from "@/kyc/checks/check-result";
import type { DocumentSlot } from "@/kyc/documents/slots";
import type { MoneyFigures } from "@/kyc/statements/money-figures";
import { formatAed } from "@/lib/format-money";
import { cn } from "@/lib/utils";
import type { ReviewPageData } from "@/services/review";

type Assessment = NonNullable<ReviewPageData["assessment"]>;
type SlotsById = ReadonlyMap<string, DocumentSlot>;

const aed = (fils: number | null) => (fils === null ? "—" : formatAed(fils, "en"));
const percent = (bps: number | null) => (bps === null ? "—" : `${(bps / 100).toFixed(1)}%`);

const STATUS_STYLE: Record<CheckResult["status"], string> = {
  pass: "text-success",
  warn: "text-amber-700 dark:text-amber-300",
  fail: "text-destructive",
  skipped: "text-muted-foreground",
};
const STATUS_LABEL: Record<CheckResult["status"], string> = { pass: "Pass", warn: "Warning", fail: "Fail", skipped: "Could not check" };

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

// "Passport, page 1": the document page a finding came from.
export function EvidenceLink({ evidence, slots }: { evidence: CheckResult["evidence"]; slots: SlotsById }) {
  if (!evidence) return null;
  const slot = slots.get(evidence.documentId);
  return (
    <span className="text-xs text-muted-foreground">
      {slot ? SLOT_LABEL[slot] : `Document ${evidence.documentId}`}, page {evidence.page}
    </span>
  );
}

export function InsightsCard({ insights, slots }: { insights: Assessment["insights"]; slots: SlotsById }) {
  if (!insights) return <p className="text-muted-foreground">No insights were written.</p>;
  return (
    <div className="flex flex-col gap-4 rounded-xl border p-4">
      <p>{insights.profile}</p>
      {insights.patterns.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Patterns</h3>
          <ul className="flex list-disc flex-col gap-1 ps-5 text-sm">
            {insights.patterns.map((pattern) => (
              <li key={pattern.text}>
                {pattern.text} <EvidenceLink evidence={pattern.evidence ?? undefined} slots={slots} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {insights.thingsToCheck.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Things to check</h3>
          <ul className="flex list-disc flex-col gap-1 ps-5 text-sm">
            {insights.thingsToCheck.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {insights.source === "llm"
          ? "Written by AI from the computed findings only."
          : "Written by a code template (the AI answer was unavailable or not faithful)."}
      </p>
    </div>
  );
}

export function ReasonsList({ checks, slots }: { checks: readonly CheckResult[]; slots: SlotsById }) {
  if (checks.length === 0) return <p className="text-sm text-success">Every check passed.</p>;
  return (
    <ul className="divide-y rounded-xl border">
      {checks.map((check, index) => (
        <li key={`${check.code}-${index}`} className="flex flex-col gap-1 p-3">
          <span className="flex items-center gap-2 text-sm">
            <span className={cn("font-semibold", STATUS_STYLE[check.status])}>{STATUS_LABEL[check.status]}</span>
            <code className="text-xs">{check.code}</code>
          </span>
          <span className="text-sm">{check.detail}</span>
          <EvidenceLink evidence={check.evidence} slots={slots} />
        </li>
      ))}
    </ul>
  );
}

export function FiguresTable({ figures, problem }: { figures: MoneyFigures | null; problem: string | null }) {
  if (!figures) return <p className="text-sm text-muted-foreground">Not computed: {problem ?? "no statements"}</p>;
  const noIncome = figures.reasons.includes("NO_CUSTOMER_INCOME");
  const rows: [string, string][] = [
    ["Months covered", String(figures.monthsCovered)],
    ["Average monthly income", aed(figures.avgMonthlyIncome)],
    ["Lease as % of income", noIncome ? "— (No customer income found)" : percent(figures.leaseToIncomeBps)],
    ["Lowest balance", aed(figures.lowestBalance)],
    ["Days below zero", String(figures.daysBelowZero)],
    ["Returned cheques / debits", String(figures.returnedItems)],
    ["Existing loan repayments per month", `${aed(figures.existingDebtMonthly)} (${percent(figures.debtToIncomeBps)} of income)`],
    ["Largest payer's share of income (not scored)", percent(figures.topPayerShareBps)],
    ["Largest month-on-month balance drop (not scored)", percent(figures.largestBalanceDropBps)],
  ];
  return (
    <table className="w-full text-sm">
      <tbody className="divide-y">
        {rows.map(([label, value]) => (
          <tr key={label}>
            <th className="py-2 pe-4 text-start font-normal text-muted-foreground">{label}</th>
            <td className="py-2 text-end font-medium">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DocumentChecklist({ checklist }: { checklist: ReviewPageData["checklist"] }) {
  return (
    <ul className="divide-y rounded-xl border">
      {checklist.map((document) => (
        <li key={document.documentId} className="flex items-center justify-between p-3 text-sm">
          <span>{SLOT_LABEL[document.slot]}</span>
          <span className={cn("font-semibold", STATUS_STYLE[document.status])}>{STATUS_LABEL[document.status]}</span>
        </li>
      ))}
    </ul>
  );
}
