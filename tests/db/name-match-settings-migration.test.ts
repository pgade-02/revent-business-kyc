import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "@/db/client";
import { scoringSettings } from "@/db/schema";
import { loadLatestScoringSettings } from "@/db/scoring-settings";
import { startingScoringSettings } from "@/db/seed/scoring-settings";

let db: Database;
const migrationFile = path.join(process.cwd(), "src/db/migrations/0006_name_match_settings.sql");

beforeAll(async () => {
  db = await openDatabase();
  const settingsBeforeMigration: Record<string, unknown> = { ...startingScoringSettings };
  delete settingsBeforeMigration.nameMatch;
  await db.insert(scoringSettings).values({ version: 1, settings: settingsBeforeMigration });
});

afterAll(async () => {
  await db.$client.close();
});

describe("0006_name_match_settings", () => {
  it("adds the name cut-offs as a new version and leaves version 1 alone, once", async () => {
    const sql = await readFile(migrationFile, "utf8");
    await db.$client.exec(sql);
    await db.$client.exec(sql);

    const rows = await db.select().from(scoringSettings);
    expect(rows.map((row) => row.version).sort()).toEqual([1, 2]);
    expect(rows.find((row) => row.version === 1)?.settings).not.toHaveProperty("nameMatch");

    const latest = await loadLatestScoringSettings(db);
    expect(latest).toMatchObject({ version: 2, settings: { nameMatch: { matchBps: 9_500, possibleMatchBps: 8_500 } } });
  });
});
