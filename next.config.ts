import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Both load their own engine files from disk at run time (PGlite's database, pdfjs's
  // worker); bundling breaks those paths, so Node loads these packages as-is.
  serverExternalPackages: ["@electric-sql/pglite", "pdfjs-dist"],
};

export default withNextIntl(nextConfig);
