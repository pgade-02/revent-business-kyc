import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";

const migrationsFolder = path.join(process.cwd(), "src/db/migrations");

// Opens PGlite (Postgres inside Node) and brings the schema up to date.
// No dataDir = in-memory database, used by tests; it disappears when closed.
export async function openDatabase(dataDir?: string) {
  const client = new PGlite(dataDir);
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder });
  return db;
}

export type Database = Awaited<ReturnType<typeof openDatabase>>;
