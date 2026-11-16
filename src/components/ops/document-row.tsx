import { SLOT_LABEL } from "@/kyc/checks/read-value";
import type { loadOpsApplication } from "@/services/ops-application";
import { cn } from "@/lib/utils";
import { DocumentAdviceLine } from "./document-advice-line";
import { REVIEW_STATE_LABEL } from "./labels";
import { DocumentReviewButtons } from "./ops-actions";

type OpsDocument = NonNullable<Awaited<ReturnType<typeof loadOpsApplication>>>["documents"][number];

const STATE_STYLE: Record<OpsDocument["reviewState"], string> = {
  to_review: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  approved: "bg-success-soft text-success",
  rejected: "bg-destructive/10 text-destructive",
};

const sizeText = (bytes: number) => (bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const timeText = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dubai", dateStyle: "medium", timeStyle: "short" });

// Shows one document with its details, file links and review buttons.
export function DocumentRow({ document, canReview }: { document: OpsDocument; canReview: boolean }) {
  const file = `/api/ops/documents/${document.id}/file`;
  return (
    <li className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="font-medium">{SLOT_LABEL[document.slot]}</span>
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATE_STYLE[document.reviewState])}>{REVIEW_STATE_LABEL[document.reviewState]}</span>
        </span>
        <span className="flex flex-wrap items-center gap-3 text-sm">
          <a href={file} target="_blank" rel="noopener" className="underline underline-offset-4">
            Preview
          </a>
          <a href={`${file}?download=1`} className="underline underline-offset-4">
            Download
          </a>
          <DocumentReviewButtons documentId={document.id} disabled={!canReview} />
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        {document.pageCount} page{document.pageCount === 1 ? "" : "s"} · {sizeText(document.sizeBytes)} · uploaded by {document.uploadedByName ?? "the customer"} on{" "}
        {timeText(document.uploadedAt)}
        {document.reviewedByName && document.reviewedAt ? ` · ${REVIEW_STATE_LABEL[document.reviewState].toLowerCase()} by ${document.reviewedByName} on ${timeText(document.reviewedAt)}` : ""}
      </p>
      <DocumentAdviceLine advice={document.advice} checks={document.checks} thingsToCheck={document.thingsToCheck} />
      <p className="break-all font-mono text-xs text-muted-foreground">SHA-256 {document.sha256}</p>
    </li>
  );
}
