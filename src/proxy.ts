import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Runs before every customer page: maps / to English and /ar to Arabic.
export default createMiddleware(routing);

export const config = {
  // Skip API routes, the English-only team UI, Next internals and files like favicon.ico.
  matcher: "/((?!api|team|_next|_vercel|.*\\..*).*)",
};
