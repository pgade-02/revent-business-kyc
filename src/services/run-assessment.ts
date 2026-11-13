import { eq } from "drizzle-orm";
import { insertAssessment } from "@/db/assessments";
import type { Database } from "@/db/client";
import { loadCompanyDetails } from "@/db/company-details";
import { listCurrentDocumentFields, listLatestUploadResults } from "@/db/documents";
import { loadLatestScoringSettings } from "@/db/scoring-settings";
import { applications } from "@/db/schema";
import { loadSignatoryDetails } from "@/db/signatory-details";
import { todayInDubai } from "@/kyc/dates";
import type { LlmProvider } from "@/kyc/interfaces/llm-provider";
import { computeScore } from "@/kyc/scoring/score";
import { runCrossChecks } from "@/kyc/submit/cross-checks";
import { statementFigures } from "./statement-figures";

// The application date is the Submit date in Dubai (ARCHITECTURE §3).
async function loadSubmitted(db: Database, applicationId: number) {
  const [row] = await db
    .select({ submittedAt: applications.submittedAt, planMonthlyFils: applications.planMonthlyFils })
    .from(applications)
    .where(eq(applications.id, applicationId));
  if (!row?.submittedAt) throw new Error("Part 2 runs only after Submit");
  return { submitMonth: todayInDubai(new Date(row.submittedAt)).slice(0, 7), planMonthlyFils: row.planMonthlyFils };
}

// Part 2 after Submit (ARCHITECTURE §2), saved as a new assessment. Insights are added
// by a later step.
export async function runAssessment(db: Database, applicationId: number, ai: { llm: LlmProvider; timeoutMs: number }): Promise<number> {
  const [documents, company, signatory, { version, settings }, submitted] = await Promise.all([
    listCurrentDocumentFields(db, applicationId),
    loadCompanyDetails(db, applicationId),
    loadSignatoryDetails(db, applicationId),
    loadLatestScoringSettings(db),
    loadSubmitted(db, applicationId),
  ]);
  const coverage = { submitMonth: submitted.submitMonth, monthsRequired: settings.statementMonthsRequired };
  const checks = runCrossChecks({
    documents,
    company: {
      companyName: company?.companyName ?? null,
      licenceNumber: company?.licenceNumber ?? null,
      trn: company?.trn ?? null,
      emirate: company?.emirate ?? null,
    },
    signatoryName: signatory?.fullName ?? null,
    nameCutoffs: settings.nameMatch,
    coverage,
  });
  const { figures, problem } = await statementFigures(db, { documents, coverage, planMonthlyFils: submitted.planMonthlyFils, ai });
  const score = computeScore({ uploads: await listLatestUploadResults(db, applicationId), crossChecks: checks, figures, settings });
  return insertAssessment(db, { applicationId, scoringSettingsVersion: version, checks, figures, figuresProblem: problem, score });
}
