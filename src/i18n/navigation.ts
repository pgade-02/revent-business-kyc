import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware versions of Next's navigation helpers: they add or strip /ar for us.
export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
