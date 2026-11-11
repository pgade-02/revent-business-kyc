import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware versions of Next's Link and usePathname: they add or strip /ar for us.
export const { Link, usePathname } = createNavigation(routing);
