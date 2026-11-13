import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { checkResultSchema, type CheckResult } from "@/kyc/checks/check-result";
import type { Database } from "./client";
import { assessments } from "./schema";

export type SavedAssessment = { id: number; scoringSettingsVersion: number; checks: CheckResult[]; createdAt: string };

export async function insertAssessment(db: Database, assessment: { applicationId: number; scoringSettingsVersion: number; checks: CheckResult[] }): Promise<number> {
  const [saved] = await db.insert(assessments).values(assessment).returning({ id: assessments.id });
  if (!saved) throw new Error("insert returned no row");
  return saved.id;
}

// The newest run; the JSON is checked on the way out, like every other JSON column.
export async function loadLatestAssessment(db: Database, applicationId: number): Promise<SavedAssessment | null> {
  const [row] = await db.select().from(assessments).where(eq(assessments.applicationId, applicationId)).orderBy(desc(assessments.id)).limit(1);
  if (!row) return null;
  return { id: row.id, scoringSettingsVersion: row.scoringSettingsVersion, checks: z.array(checkResultSchema).parse(row.checks), createdAt: row.createdAt };
}
