"use client";

import { AlertCircleIcon, CheckCircle2Icon, FileIcon, Loader2Icon, UploadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type { DocumentSlot } from "@/kyc/documents/slots";
import { cn } from "@/lib/utils";

type FileStatus = "uploading" | "checking" | "ready" | "needs_fix" | "needs_review" | "failed" | "rejected";

export type ShownFile = {
  key: string;
  name: string;
  status: FileStatus;
  sizeBytes: number | null;
  pageCount: number | null;
  messageKeys: string[];
};

type UploadBoxProps = {
  applicationId: number;
  slot: DocumentSlot;
  severalFiles: boolean;
  initialFiles: ShownFile[];
  maxMb: number;
  maxPages: number;
};

const statusStyle: Record<FileStatus, { className: string; Icon: typeof CheckCircle2Icon; spin?: boolean }> = {
  uploading: { className: "text-muted-foreground", Icon: Loader2Icon, spin: true },
  checking: { className: "text-muted-foreground", Icon: Loader2Icon, spin: true },
  ready: { className: "text-success", Icon: CheckCircle2Icon },
  needs_fix: { className: "text-destructive", Icon: AlertCircleIcon },
  needs_review: { className: "text-muted-foreground", Icon: CheckCircle2Icon },
  failed: { className: "text-destructive", Icon: AlertCircleIcon },
  rejected: { className: "text-destructive", Icon: AlertCircleIcon },
};

function StatusIcon({ status }: { status: FileStatus }) {
  const { Icon, spin } = statusStyle[status];
  return <Icon className={cn("size-4", spin && "animate-spin")} aria-hidden />;
}

// Sends one file through both server steps: upload (store it), then process (check it).
async function sendFile(applicationId: number, slot: DocumentSlot, file: File): Promise<Partial<ShownFile>> {
  const form = new FormData();
  form.append("slot", slot);
  form.append("file", file);
  const upload = await fetch(`/api/applications/${applicationId}/documents`, { method: "POST", body: form }).catch(() => null);
  if (upload?.status === 422) {
    const { reason } = (await upload.json()) as { reason: string };
    return { status: "rejected", messageKeys: [`Upload.${reason}`] };
  }
  if (upload?.status !== 201) return { status: "failed" };

  const stored = (await upload.json()) as { documentId: number; sizeBytes: number; pageCount: number };
  const processed = await fetch(`/api/documents/${stored.documentId}/process`, { method: "POST" }).catch(() => null);
  const size = { sizeBytes: stored.sizeBytes, pageCount: stored.pageCount };
  if (!processed?.ok) return { ...size, status: "failed" };
  const result = (await processed.json()) as { status: FileStatus; customerMessageKeys: string[] };
  return { ...size, status: result.status, messageKeys: result.customerMessageKeys };
}

// One upload box (e.g. "Passport"): the files in it, each with its status and,
// when something needs fixing, the one short message telling the customer what to do.
export function UploadBox({ applicationId, slot, severalFiles, initialFiles, maxMb, maxPages }: UploadBoxProps) {
  const t = useTranslations();
  const inputId = useId();
  const router = useRouter();
  const [files, setFiles] = useState<ShownFile[]>(initialFiles);

  const update = (key: string, change: Partial<ShownFile>) =>
    setFiles((current) => current.map((file) => (file.key === key ? { ...file, ...change } : file)));

  async function choose(chosen: FileList | null) {
    for (const file of Array.from(chosen ?? [])) {
      const shown: ShownFile = { key: crypto.randomUUID(), name: file.name, status: "uploading", sizeBytes: file.size, pageCount: null, messageKeys: [] };
      setFiles((current) => (severalFiles ? [...current, shown] : [shown]));
      update(shown.key, await sendFile(applicationId, slot, file));
    }
    // Re-reads the task list and progress on the server; this box keeps its own state.
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${inputId}-label`}>
      <div>
        <h3 id={`${inputId}-label`} className="font-medium">
          {t(`Documents.slots.${slot}.label`)}
        </h3>
        <p className="text-sm text-muted-foreground">{t(`Documents.slots.${slot}.hint`)}</p>
      </div>

      {files.map((file) => (
        <div key={file.key} className="flex items-start gap-4 rounded-xl border bg-card p-4" data-testid={`file-${slot}`}>
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
            <FileIcon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{file.name}</p>
            {file.sizeBytes !== null && file.pageCount !== null && (
              <p className="text-sm text-muted-foreground">
                {t("Documents.fileSummary", { sizeKb: Math.max(1, Math.round(file.sizeBytes / 1024)), pages: file.pageCount })}
              </p>
            )}
            {/* A good file shows only a green tick; the words stay for screen readers. */}
            <p role="status" className={cn("mt-1 flex items-center gap-1.5 text-sm", statusStyle[file.status].className, file.status === "ready" && "sr-only")}>
              <StatusIcon status={file.status} />
              {t(`Documents.status.${file.status}`)}
            </p>
            {file.messageKeys.map((key) => (
              <p key={key} className="text-sm text-destructive">
                {t(key, { maxMb, maxPages })}
              </p>
            ))}
          </div>
          {file.status === "ready" && <CheckCircle2Icon className="size-6 shrink-0 text-success" aria-hidden />}
        </div>
      ))}

      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6">
        <label htmlFor={inputId} className={cn(buttonVariants({ variant: "outline" }), "cursor-pointer")}>
          <UploadIcon aria-hidden />
          {t(severalFiles ? "Documents.chooseFiles" : "Documents.chooseFile")}
        </label>
        <input
          id={inputId}
          type="file"
          className="sr-only"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          multiple={severalFiles}
          onChange={(event) => {
            void choose(event.target.files);
            event.target.value = ""; // so choosing the same file again still triggers a change
          }}
        />
        <p className="text-xs text-muted-foreground">{t("Documents.formats", { maxMb })}</p>
      </div>
    </section>
  );
}
