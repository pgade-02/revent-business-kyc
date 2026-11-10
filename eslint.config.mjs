import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// src/kyc and src/plan must stay pure: data in, data out. Anything that touches
// the framework, the database, files or AI SDKs is passed in from outside.
const pureModuleImportBan = {
  patterns: [
    { group: ["next", "next/*"], message: "src/kyc and src/plan must not import Next.js." },
    { group: ["sharp", "pdf-lib", "pdfjs-dist", "pdfjs-dist/*"], message: "Use the interfaces in src/kyc; implementations live in src/providers." },
    { regex: "(^|/)(db|providers|app)(/|$)", message: "src/kyc and src/plan must not import src/db, src/providers or src/app." },
  ],
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      // A `!` is allowed only with an eslint-disable comment explaining why it is safe.
      "@typescript-eslint/no-non-null-assertion": "error",
    },
  },
  {
    files: ["src/kyc/**/*.{ts,tsx}", "src/plan/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", pureModuleImportBan],
    },
  },
  globalIgnores([".next/**", "node_modules/**", "next-env.d.ts", "playwright-report/**", "test-results/**"]),
]);
