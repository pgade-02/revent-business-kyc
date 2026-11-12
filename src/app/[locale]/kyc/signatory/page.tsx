import { setRequestLocale } from "next-intl/server";
import { UploadTaskPage } from "@/components/kyc/upload-task-page";

// Identity documents only for now; the signatory's name and email fields come with
// the Company details and Authorised signatory form step.
export default async function SignatoryPage({ params }: PageProps<"/[locale]/kyc/signatory">) {
  setRequestLocale((await params).locale);
  return <UploadTaskPage task="signatory" sectionTitle="identityTitle" />;
}
