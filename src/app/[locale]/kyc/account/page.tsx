import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TaskPanel } from "@/components/kyc/task-panel";
import { describeTask, loadKycOverview } from "@/services/kyc-overview";

// Read-only: these details come from the customer's Revent account (PRD §4, screen 3).
export default async function AccountPage({ params }: PageProps<"/[locale]/kyc/account">) {
  setRequestLocale((await params).locale);
  const overview = await loadKycOverview();
  if (!overview) return null;
  const context = describeTask(overview, "account");
  if (!context) notFound();
  const t = await getTranslations("Kyc.account");
  const { user } = overview;

  const rows = [
    { label: t("name"), value: user.name },
    { label: t("workEmail"), value: user.email },
    { label: t("mobile"), value: user.mobile },
    { label: t("company"), value: user.companyName },
  ];

  return (
    <TaskPanel task="account" context={context}>
      <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">{row.label}</dt>
            <dd className="font-medium">{row.value ?? t("notProvided")}</dd>
          </div>
        ))}
      </dl>
    </TaskPanel>
  );
}
