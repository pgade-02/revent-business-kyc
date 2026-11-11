import { mkdir } from "node:fs/promises";
import path from "node:path";
import { openDatabase, type Database } from "./client";
import { seedDatabase } from "./seed/seed";

// Next's dev server reloads modules on every edit. Keeping the open database on
// globalThis stops it opening a second copy of the same folder, which PGlite can't share.
const globalForDb = globalThis as typeof globalThis & { appDatabase?: Promise<Database> };

// The running app's database, saved on disk in .data/ (git-ignored).
// Seeding is safe to repeat, so it runs on every start.
export function getAppDatabase(): Promise<Database> {
  globalForDb.appDatabase ??= (async () => {
    const dataDir = process.env.DATABASE_DIR ?? path.join(process.cwd(), ".data", "pglite");
    // PGlite creates only the last folder in the path, so make the parents first.
    await mkdir(dataDir, { recursive: true });
    const db = await openDatabase(dataDir);
    await seedDatabase(db);
    return db;
  })().catch((error: unknown) => {
    // Forget the failed attempt so the next request tries again instead of failing forever.
    globalForDb.appDatabase = undefined;
    throw error;
  });
  return globalForDb.appDatabase;
}
