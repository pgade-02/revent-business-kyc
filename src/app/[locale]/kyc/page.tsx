import { TASK_HREF } from "@/components/kyc/task-routes";
import { redirect } from "@/i18n/navigation";
import { loadKycOverview } from "@/services/kyc-overview";

// The hub opens on the first task that still needs work (or the first task when all are done).
export default async function KycHubPage({ params }: PageProps<"/[locale]/kyc">) {
  const { locale } = await params;
  const overview = await loadKycOverview();
  if (!overview) return null; // the layout already shows "Build your plan first"
  if (overview.submitted) redirect({ href: "/kyc/review", locale });

  const openTasks = overview.tasks.filter(({ status }) => status !== "completed" && status !== "coming_soon");
  const first = openTasks[0]?.task ?? overview.tasks[0]?.task ?? "account";
  redirect({ href: TASK_HREF[first], locale });
}
