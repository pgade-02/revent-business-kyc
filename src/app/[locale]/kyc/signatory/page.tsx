import { setRequestLocale } from "next-intl/server";
import { DocumentsPage } from "@/components/documents/documents-page";

export const dynamic = "force-dynamic";

// Identity documents only for now; the signatory's name and email fields come with the
// Company details and Authorised signatory form step.
export default async function SignatoryDocumentsPage({ params }: PageProps<"/[locale]/kyc/signatory">) {
  setRequestLocale((await params).locale);
  return (
    <DocumentsPage
      title="identityTitle"
      subtitle="identitySubtitle"
      slots={["passport", "emirates_id_front", "emirates_id_back"]}
    />
  );
}
