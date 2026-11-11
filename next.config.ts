import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // PGlite loads its own database engine file from disk; bundling breaks that path,
  // so Node loads the package as-is.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default withNextIntl(nextConfig);
