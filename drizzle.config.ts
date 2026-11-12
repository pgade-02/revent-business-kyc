import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  // Used by `npm run db:studio` to open the local database. PGlite allows one program
  // at a time, so stop `npm run dev` before opening Studio.
  driver: "pglite",
  dbCredentials: { url: process.env.DATABASE_DIR || "./.data/pglite" },
});
