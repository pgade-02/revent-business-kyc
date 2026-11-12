import { setRequestLocale } from "next-intl/server";
import { UploadTaskPage } from "@/components/kyc/upload-task-page";

// Only plans below the route threshold have this task; otherwise the page is not found.
export default async function SelfDisclosurePage({ params }: PageProps<"/[locale]/kyc/self-disclosure">) {
  setRequestLocale((await params).locale);
  return <UploadTaskPage task="self_disclosure" />;
}
