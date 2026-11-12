import { getTranslations } from "next-intl/server";
import { ShieldCheckIcon } from "lucide-react";
import { findLatestCustomerApplication } from "@/auth/access";
import { buttonVariants } from "@/components/ui/button";
import { getAppDatabase } from "@/db/app-db";
import { listCurrentDocuments } from "@/db/documents";
import { readUploadLimits } from "@/config/limits";
import { Link } from "@/i18n/navigation";
import { slotAllowsSeveralFiles, type DocumentSlot } from "@/kyc/documents/slots";
import { UploadBox } from "./upload-box";

type DocumentsPageProps = { title: "businessTitle" | "identityTitle"; subtitle: "businessSubtitle" | "identitySubtitle"; slots: DocumentSlot[] };

// Shared by the Business documents and Authorised signatory screens: a heading,
// then one upload box per slot, pre-filled with the files already uploaded.
export async function DocumentsPage({ title, subtitle, slots }: DocumentsPageProps) {
  const t = await getTranslations("Documents");
  const db = await getAppDatabase();
  const application = await findLatestCustomerApplication(db);

  if (!application.ok) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col items-start gap-4 px-6 py-12">
        <h1 className="text-2xl font-medium">{t(title)}</h1>
        <p className="text-muted-foreground">{t("noApplication")}</p>
        <Link href="/plan" className={buttonVariants()}>
          {t("buildPlan")}
        </Link>
      </main>
    );
  }

  const current = await listCurrentDocuments(db, application.value.id);
  const limits = readUploadLimits(process.env);
  const maxMb = Math.floor(limits.maxBytes / (1024 * 1024));

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-medium">{t(title)}</h1>
        <p className="mt-1 text-muted-foreground">{t(subtitle)}</p>
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheckIcon className="size-4" aria-hidden />
          {t("privacy")}
        </p>
      </div>
      {slots.map((slot) => (
        <UploadBox
          key={slot}
          applicationId={application.value.id}
          slot={slot}
          severalFiles={slotAllowsSeveralFiles(slot)}
          maxMb={maxMb}
          maxPages={limits.maxPages}
          initialFiles={current
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
    </main>
  );
}
