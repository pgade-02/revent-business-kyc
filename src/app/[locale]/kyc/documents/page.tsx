import { setRequestLocale } from "next-intl/server";
import { UploadTaskPage } from "@/components/kyc/upload-task-page";

export default async function BusinessDocumentsPage({ params }: PageProps<"/[locale]/kyc/documents">) {
  setRequestLocale((await params).locale);
  return <UploadTaskPage task="documents" />;
}
