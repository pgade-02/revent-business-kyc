import { eq } from "drizzle-orm";
import { insertAssessment } from "@/db/assessments";
import type { Database } from "@/db/client";
import { loadCompanyDetails } from "@/db/company-details";
import { listCurrentDocumentFields } from "@/db/documents";
import { loadLatestScoringSettings } from "@/db/scoring-settings";
import { applications } from "@/db/schema";
import { loadSignatoryDetails } from "@/db/signatory-details";
import { todayInDubai } from "@/kyc/dates";
import { runCrossChecks } from "@/kyc/submit/cross-checks";

// The application date is the Submit date in Dubai (ARCHITECTURE §3).
async function loadSubmittedAt(db: Database, applicationId: number): Promise<string> {
  const [row] = await db.select({ submittedAt: applications.submittedAt }).from(applications).where(eq(applications.id, applicationId));
  if (!row?.submittedAt) throw new Error("Part 2 runs only after Submit");
  return row.submittedAt;
}

// Part 2 after Submit (ARCHITECTURE §2). For now: the cross-checks, saved as a new
// assessment. Money figures, score and insights are added by later steps.
export async function runAssessment(db: Database, applicationId: number): Promise<number> {
  const [documents, company, signatory, { version, settings }, submittedAt] = await Promise.all([
    listCurrentDocumentFields(db, applicationId),
    loadCompanyDetails(db, applicationId),
    loadSignatoryDetails(db, applicationId),
    loadLatestScoringSettings(db),
    loadSubmittedAt(db, applicationId),
  ]);
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
    coverage: { submitMonth: todayInDubai(new Date(submittedAt)).slice(0, 7), monthsRequired: settings.statementMonthsRequired },
  });
  return insertAssessment(db, { applicationId, scoringSettingsVersion: version, checks });
}
