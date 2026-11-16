import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // These load their own engine files from disk at run time (PGlite's database, pdfjs's
  // worker, the translation model's runtime); bundling breaks those paths, so Node loads them as-is.
  serverExternalPackages: ["@electric-sql/pglite", "pdfjs-dist", "@huggingface/transformers"],
};

export default withNextIntl(nextConfig);
