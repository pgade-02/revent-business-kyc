import { desc, eq } from "drizzle-orm";
import { loadLatestAssessment } from "@/db/assessments";
import type { Database } from "@/db/client";
import { loadCompanyDetails } from "@/db/company-details";
import { listCurrentDocumentFields, listLatestUploadResults } from "@/db/documents";
import { insertReviewAction, listReviewActions } from "@/db/review-actions";
import { applications } from "@/db/schema";
import type { CheckStatus } from "@/kyc/checks/check-result";
import { listField } from "@/kyc/extraction/extract-fields";
import type { ReviewActionInput } from "@/kyc/review/review-action";

type ApplicationRow = typeof applications.$inferSelect;

// The team's queue: every submitted application, newest first, with its latest band.
export async function listReviewQueue(db: Database) {
  const rows = await db.select().from(applications).where(eq(applications.status, "submitted")).orderBy(desc(applications.submittedAt));
  return Promise.all(
    rows.map(async (row) => {
      const [assessment, actions] = await Promise.all([loadLatestAssessment(db, row.id), listReviewActions(db, row.id)]);
      return {
        id: row.id,
        companyName: row.companyName,
        submittedAt: row.submittedAt,
        score: assessment?.score ?? null,
        lastAction: actions[0]?.action ?? null,
      };
    }),
  );
}

// A document with no checks run (never processed) is "could not check", never a pass.
const worst = (statuses: readonly CheckStatus[]): CheckStatus =>
  statuses.length === 0 ? "skipped" : ((["fail", "warn", "skipped"] as const).find((status) => statuses.includes(status)) ?? "pass");

// Everything the review page shows (PRD §6), read from what Part 2 saved. Nothing is
// recomputed here, so the page shows exactly the assessment the reviewer acts on.
export async function loadReviewPage(db: Database, application: ApplicationRow) {
  const [assessment, company, documents, uploads, actions] = await Promise.all([
    loadLatestAssessment(db, application.id),
    loadCompanyDetails(db, application.id),
    listCurrentDocumentFields(db, application.id),
    listLatestUploadResults(db, application.id),
    listReviewActions(db, application.id),
  ]);
  const licence = documents.find((document) => document.slot === "trade_licence");
  return {
    application: {
      id: application.id,
      term: application.term,
      planMonthlyFils: application.planMonthlyFils,
      route: application.route,
      submittedAt: application.submittedAt,
    },
    company,
    licenceActivities: (licence && listField(licence.fields, "activities")?.value) ?? [],
    assessment,
    checklist: uploads.map((upload) => ({
      documentId: upload.documentId,
      slot: upload.slot,
      status: worst(upload.results.map((result) => result.status)),
      results: upload.results,
    })),
    actions,
  };
}
export type ReviewPageData = Awaited<ReturnType<typeof loadReviewPage>>;

// Records a person's decision against the score card they saw.
export async function recordReviewAction(
  db: Database,
  input: { applicationId: number; reviewerId: string; action: ReviewActionInput },
): Promise<number> {
  const assessment = await loadLatestAssessment(db, input.applicationId);
  return insertReviewAction(db, {
    applicationId: input.applicationId,
    assessmentId: assessment?.id ?? null,
    reviewerId: input.reviewerId,
    input: input.action,
  });
}
