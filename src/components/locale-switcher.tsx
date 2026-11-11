"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

// Links to the same page in the other language.
export function LocaleSwitcher() {
  const t = useTranslations("Shell");
  const pathname = usePathname();
  const otherLocale = useLocale() === "ar" ? "en" : "ar";

  return (
    <Link
      href={pathname}
      locale={otherLocale}
      lang={otherLocale}
      className="rounded-lg px-2.5 py-1.5 text-sm font-medium hover:bg-muted"
    >
      {t("otherLanguage")}
    </Link>
  );
}
