import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { checkResultSchema, type CheckResult } from "@/kyc/checks/check-result";
import { insightsSchema, type Insights } from "@/kyc/insights/write-insights";
import { scoreSchema, type Score } from "@/kyc/scoring/score";
import { moneyFiguresSchema, type MoneyFigures } from "@/kyc/statements/money-figures";
import type { Database } from "./client";
import { assessments } from "./schema";

export type NewAssessment = {
  applicationId: number;
  scoringSettingsVersion: number;
  checks: CheckResult[];
  figures: MoneyFigures | null;
  figuresProblem: string | null;
  score: Score | null;
  insights: Insights | null;
};
export type SavedAssessment = Omit<NewAssessment, "applicationId"> & { id: number; createdAt: string };

export async function insertAssessment(db: Database, assessment: NewAssessment): Promise<number> {
  const [saved] = await db.insert(assessments).values(assessment).returning({ id: assessments.id });
  if (!saved) throw new Error("insert returned no row");
  return saved.id;
}

// The newest run; the JSON is checked on the way out, like every other JSON column.
export async function loadLatestAssessment(db: Database, applicationId: number): Promise<SavedAssessment | null> {
  const [row] = await db.select().from(assessments).where(eq(assessments.applicationId, applicationId)).orderBy(desc(assessments.id)).limit(1);
  if (!row) return null;
  return {
    id: row.id,
    scoringSettingsVersion: row.scoringSettingsVersion,
    checks: z.array(checkResultSchema).parse(row.checks),
    figures: moneyFiguresSchema.nullable().parse(row.figures),
    figuresProblem: row.figuresProblem,
    score: scoreSchema.nullable().parse(row.score),
    insights: insightsSchema.nullable().parse(row.insights),
    createdAt: row.createdAt,
  };
}
