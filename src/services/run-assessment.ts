import { insertAssessment } from "@/db/assessments";
import type { Database } from "@/db/client";
import { loadCompanyDetails } from "@/db/company-details";
import { listCurrentDocumentFields } from "@/db/documents";
import { loadLatestScoringSettings } from "@/db/scoring-settings";
import { loadSignatoryDetails } from "@/db/signatory-details";
import { runCrossChecks } from "@/kyc/submit/cross-checks";

// Part 2 after Submit (ARCHITECTURE §2). For now: the cross-checks, saved as a new
// assessment. Money figures, score and insights are added by later steps.
export async function runAssessment(db: Database, applicationId: number): Promise<number> {
  const [documents, company, signatory, { version, settings }] = await Promise.all([
    listCurrentDocumentFields(db, applicationId),
    loadCompanyDetails(db, applicationId),
    loadSignatoryDetails(db, applicationId),
    loadLatestScoringSettings(db),
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
  });
  return insertAssessment(db, { applicationId, scoringSettingsVersion: version, checks });
}
