import { ShieldCheckIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { readUploadLimits } from "@/config/limits";
import type { CurrentDocument } from "@/db/documents";
import { slotAllowsSeveralFiles, type DocumentSlot } from "@/kyc/documents/slots";
import { UploadBox } from "./upload-box";

type DocumentSlotsProps = { applicationId: number; slots: readonly DocumentSlot[]; documents: CurrentDocument[] };

// One upload box per slot, pre-filled with the files already uploaded.
export async function DocumentSlots({ applicationId, slots, documents }: DocumentSlotsProps) {
  const t = await getTranslations("Documents");
  const limits = readUploadLimits(process.env);
  const maxMb = Math.floor(limits.maxBytes / (1024 * 1024));

  return (
    <div className="flex flex-col gap-8">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheckIcon className="size-4" aria-hidden />
        {t("privacy")}
      </p>
      {slots.map((slot) => (
        <UploadBox
          key={slot}
          applicationId={applicationId}
          slot={slot}
          severalFiles={slotAllowsSeveralFiles(slot)}
          maxMb={maxMb}
          maxPages={limits.maxPages}
          initialFiles={documents
            .filter((document) => document.slot === slot)
            .map((document) => ({
              key: String(document.id),
              // The original file name is not stored (it can contain personal details).
              name: t(`slots.${slot}.label`),
              // Still "checking" after a reload means its check never finished: show it as
              // failed so the customer knows to upload it again.
              status: document.status === "checking" ? "failed" : document.status,
              sizeBytes: document.sizeBytes,
              pageCount: document.pageCount,
              messageKeys: document.customerMessageKeys,
            }))}
        />
      ))}
    </div>
  );
}
