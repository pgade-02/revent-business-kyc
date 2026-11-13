import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { CompanyDetailsForm, type CompanyFormValues } from "@/components/kyc/company-details-form";
import { TaskPanel } from "@/components/kyc/task-panel";
import { describeTask, loadKycOverview } from "@/services/kyc-overview";

// Company details (PRD §4, screen 4). Saved values come back into the form; before the
// first save, the company name is taken from the customer's account.
export default async function CompanyPage({ params }: PageProps<"/[locale]/kyc/company">) {
  setRequestLocale((await params).locale);
  const overview = await loadKycOverview();
  if (!overview) return null;
  const context = describeTask(overview, "company");
  if (!context) notFound();

  const saved = overview.companyDetails;
  const initial: CompanyFormValues = {
    companyName: saved?.companyName ?? overview.user.companyName ?? "",
    licenceNumber: saved?.licenceNumber ?? "",
    yearEstablished: saved?.yearEstablished?.toString() ?? "",
    issuingAuthority: saved?.issuingAuthority ?? "",
    emirate: saved?.emirate ?? "",
    legalForm: saved?.legalForm ?? "",
    trn: saved?.trn ?? "",
    registeredAddress: saved?.registeredAddress ?? "",
    deliverToRegisteredAddress: saved?.deliverToRegisteredAddress ?? true,
  };

  return (
    <TaskPanel task="company" context={context}>
      <CompanyDetailsForm applicationId={overview.applicationId} initial={initial} />
    </TaskPanel>
  );
}
