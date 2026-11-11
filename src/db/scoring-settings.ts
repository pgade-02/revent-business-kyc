import { desc } from "drizzle-orm";
import { scoringSettingsSchema, type ScoringSettings } from "@/kyc/scoring/settings-schema";
import type { Database } from "./client";
import { scoringSettings } from "./schema";

// The newest settings version. The JSON is checked against the schema on the way
// out too, so a hand-edited row can never feed bad numbers into a decision.
export async function loadLatestScoringSettings(db: Database): Promise<{ version: number; settings: ScoringSettings }> {
  const [row] = await db.select().from(scoringSettings).orderBy(desc(scoringSettings.version)).limit(1);
  if (!row) throw new Error("scoring_settings is empty: the database was not seeded");
  return { version: row.version, settings: scoringSettingsSchema.parse(row.settings) };
}
