import { defineRouting } from "next-intl/routing";

// English is the default and has no prefix (/); Arabic lives under /ar.
export const routing = defineRouting({
  locales: ["en", "ar"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
