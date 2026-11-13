import { setRequestLocale } from "next-intl/server";
import { SignatoryDetailsForm, type SignatoryFormValues } from "@/components/kyc/signatory-details-form";
import { UploadTaskPage } from "@/components/kyc/upload-task-page";
import { loadKycOverview } from "@/services/kyc-overview";

// Authorised signatory (PRD §4, screen 6): who signs, then their passport and Emirates ID.
export default async function SignatoryPage({ params }: PageProps<"/[locale]/kyc/signatory">) {
  setRequestLocale((await params).locale);
  const overview = await loadKycOverview(); // cached: UploadTaskPage reads the same one
  if (!overview) return null;

  const saved = overview.signatoryDetails;
  const { user } = overview;
  const initial: SignatoryFormValues = {
    isApplicant: saved?.isApplicant ?? false,
    fullName: saved?.fullName ?? "",
    signingEmail: saved?.signingEmail ?? "",
    mobile: saved?.mobile ?? "",
  };

  return (
    <UploadTaskPage task="signatory" sectionTitle="identityTitle">
      <SignatoryDetailsForm
        applicationId={overview.applicationId}
        initial={initial}
        applicant={{ name: user.name, email: user.email, mobile: user.mobile ?? "" }}
      />
    </UploadTaskPage>
  );
}
