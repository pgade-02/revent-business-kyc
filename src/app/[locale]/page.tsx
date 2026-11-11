import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Home");

  return (
    <main className="mx-auto flex max-w-3xl flex-col items-start gap-6 px-6 py-12">
      <h1 className="text-2xl font-medium">{t("title")}</h1>
      <Link href="/plan" className={buttonVariants({ size: "lg" })}>
        {t("startPlan")}
      </Link>
    </main>
  );
}
