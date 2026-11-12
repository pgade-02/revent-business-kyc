"use client";

import { FileIcon, UploadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
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

const statusColour: Record<FileStatus, string> = {
  uploading: "text-muted-foreground",
  checking: "text-muted-foreground",
  ready: "text-green-700 dark:text-green-400",
  needs_fix: "text-destructive",
  needs_review: "text-muted-foreground",
  failed: "text-destructive",
  rejected: "text-destructive",
};

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
  const [files, setFiles] = useState<ShownFile[]>(initialFiles);

  const update = (key: string, change: Partial<ShownFile>) =>
    setFiles((current) => current.map((file) => (file.key === key ? { ...file, ...change } : file)));

  async function choose(chosen: FileList | null) {
    for (const file of Array.from(chosen ?? [])) {
      const shown: ShownFile = { key: crypto.randomUUID(), name: file.name, status: "uploading", sizeBytes: file.size, pageCount: null, messageKeys: [] };
      setFiles((current) => (severalFiles ? [...current, shown] : [shown]));
      update(shown.key, await sendFile(applicationId, slot, file));
    }
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
        <div key={file.key} className="flex items-start gap-3 rounded-lg border p-3" data-testid={`file-${slot}`}>
          <FileIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            {file.sizeBytes !== null && file.pageCount !== null && (
              <p className="text-xs text-muted-foreground">
                {t("Documents.fileSummary", { sizeKb: Math.max(1, Math.round(file.sizeBytes / 1024)), pages: file.pageCount })}
              </p>
            )}
            <p role="status" className={cn("text-sm", statusColour[file.status])}>
              {t(`Documents.status.${file.status}`)}
            </p>
            {file.messageKeys.map((key) => (
              <p key={key} className="text-sm text-destructive">
                {t(key, { maxMb, maxPages })}
              </p>
            ))}
          </div>
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
