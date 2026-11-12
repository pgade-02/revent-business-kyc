import { getTranslations, setRequestLocale } from "next-intl/server";
import { KycShell } from "@/components/kyc/kyc-shell";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { loadKycOverview } from "@/services/kyc-overview";

// The customer's own data is read on every visit, never built in advance.
export const dynamic = "force-dynamic";

export default async function KycLayout({ children, params }: LayoutProps<"/[locale]/kyc">) {
  setRequestLocale((await params).locale);
  const overview = await loadKycOverview();

  if (!overview) {
    const t = await getTranslations("Kyc");
    return (
      <main className="mx-auto flex max-w-3xl flex-col items-start gap-4 px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("noApplication")}</p>
        <Link href="/plan" className={buttonVariants({ size: "lg" })}>
          {t("buildPlan")}
        </Link>
      </main>
    );
  }
  return <KycShell overview={overview}>{children}</KycShell>;
}
