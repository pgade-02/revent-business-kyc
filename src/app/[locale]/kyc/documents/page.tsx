import { setRequestLocale } from "next-intl/server";
import { DocumentsPage } from "@/components/documents/documents-page";

// The customer's own files are read on every visit, never built in advance.
export const dynamic = "force-dynamic";

export default async function BusinessDocumentsPage({ params }: PageProps<"/[locale]/kyc/documents">) {
  setRequestLocale((await params).locale);
  return (
    <DocumentsPage
      title="businessTitle"
      subtitle="businessSubtitle"
      slots={["trade_licence", "tax_certificate", "bank_statement"]}
    />
  );
}
