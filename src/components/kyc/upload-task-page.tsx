import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { DocumentSlots } from "@/components/documents/document-slots";
import { TASK_SLOTS, type KycTask } from "@/kyc/documents/kyc-tasks";
import { describeTask, loadKycOverview } from "@/services/kyc-overview";
import { TaskPanel } from "./task-panel";

// A task whose content is upload boxes: Business documents, Authorised signatory
// (identity documents) and Self-disclosure form. `children` (a form) comes before the boxes.
export async function UploadTaskPage({
  task,
  sectionTitle,
  children,
}: {
  task: KycTask;
  sectionTitle?: "identityTitle";
  children?: ReactNode;
}) {
  const overview = await loadKycOverview();
  if (!overview) return null; // the layout already shows "Build your plan first"
  const context = describeTask(overview, task);
  if (!context) notFound(); // e.g. self-disclosure on a verification-call plan
  const t = await getTranslations("Documents");

  return (
    <TaskPanel task={task} context={context}>
      {children}
      {sectionTitle && <h3 className="-mb-4 text-lg font-semibold">{t(sectionTitle)}</h3>}
      <DocumentSlots applicationId={overview.applicationId} slots={TASK_SLOTS[task] ?? []} documents={overview.documents} />
    </TaskPanel>
  );
}
