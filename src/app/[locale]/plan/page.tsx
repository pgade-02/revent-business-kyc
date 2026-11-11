import { getTranslations, setRequestLocale } from "next-intl/server";
import { PlanBuilder } from "@/components/plan/plan-builder";
import { getAppDatabase } from "@/db/app-db";
import { loadCatalogue } from "@/db/catalogue";

// Prices are read from the database on every visit, never baked in at build time.
export const dynamic = "force-dynamic";

export default async function PlanPage({ params }: PageProps<"/[locale]/plan">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Plan");
  const catalogue = await loadCatalogue(await getAppDatabase(), locale === "ar" ? "ar" : "en");

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-medium">{t("title")}</h1>
      <p className="mt-1 mb-8 text-muted-foreground">{t("subtitle")}</p>
      <PlanBuilder catalogue={catalogue} />
    </main>
  );
}
