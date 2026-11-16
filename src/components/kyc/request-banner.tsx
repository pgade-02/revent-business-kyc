import { MessageSquareWarningIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { KYC_TASKS, TASK_SLOTS, type KycTask } from "@/kyc/documents/kyc-tasks";
import type { DocumentSlot } from "@/kyc/documents/slots";
import type { RequestItem, RequestSubject } from "@/ops/info-requests";
import { TASK_HREF } from "./task-routes";

// Finds the task page where the customer can change a requested item.
function taskFor(subject: RequestSubject): KycTask {
  if (subject === "company_details") return "company";
  if (subject === "signatory_details") return "signatory";
  const slot: DocumentSlot = subject;
  return KYC_TASKS.find((task) => TASK_SLOTS[task]?.includes(slot)) ?? "documents";
}

// Lists what the team asked for, in the customer's language, with a link to fix each item.
export async function RequestBanner({ items }: { items: (RequestItem & { id: number })[] }) {
  const t = await getTranslations("Kyc.request");
  const tDocuments = await getTranslations("Documents.slots");
  const locale = await getLocale();
  const subjectLabel = (subject: RequestSubject) =>
    subject === "company_details" || subject === "signatory_details" ? t(`subject.${subject}`) : tDocuments(`${subject}.label`);

  return (
    <div className="flex flex-col gap-4">
      <span className="flex size-11 items-center justify-center rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        <MessageSquareWarningIcon className="size-5" aria-hidden />
      </span>
      <h2 className="text-2xl font-semibold tracking-tight">{t("title")}</h2>
      <p className="text-muted-foreground">{t("intro")}</p>
      <ul className="divide-y rounded-xl border">
        {items.map((item) => {
          const note = locale === "ar" ? (item.noteAr ?? item.note) : item.note;
          return (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <span className="flex flex-col gap-1">
                <span className="font-medium">{subjectLabel(item.subject)}</span>
                <span className="text-sm text-muted-foreground">{t(`reason.${item.reason}`)}</span>
                {note && (
                  <span className="text-sm">
                    {t("note")}: {note}
                  </span>
                )}
              </span>
              <Link href={TASK_HREF[taskFor(item.subject)]} className={buttonVariants({ variant: "outline", size: "sm" })}>
                {t("update")}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
