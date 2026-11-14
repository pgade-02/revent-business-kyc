import { notFound } from "next/navigation";
import { findReviewerApplication, parseId } from "@/auth/access";
import { BandBadge } from "@/components/team/band-badge";
import { ReviewActions } from "@/components/team/review-actions";
import { DocumentResults, FiguresTable, PatternsCard, ReasonsList, Section } from "@/components/team/review-sections";
import { SignInAsReviewer } from "@/components/team/sign-in-as-reviewer";
import { getAppDatabase } from "@/db/app-db";
import { formatAed } from "@/lib/format-money";
import { loadReviewPage } from "@/services/review";

export const dynamic = "force-dynamic";

const ACTION_LABEL = { approve: "Approved", request_document: "Requested a document", reject: "Rejected" } as const;

// One page per application (PRD §6, reviewer order): score, each document's result, reasons
// across documents, patterns and things to check, money figures, and the decision.
export default async function ReviewApplicationPage({ params }: PageProps<"/team/applications/[id]">) {
  const id = parseId((await params).id);
  if (id === null) notFound();
  const db = await getAppDatabase();
  const access = await findReviewerApplication(db, id);
  if (!access.ok) return access.reason === "NOT_FOUND" ? notFound() : <SignInAsReviewer />;

  const data = await loadReviewPage(db, access.value);
  const { application, company, assessment } = data;
  const slots = new Map(data.checklist.map((document) => [document.documentId, document.slot]));
  // Document checks are shown under each document; reasons are what compares documents.
  const notPassed = (assessment?.checks ?? []).filter((check) => check.status !== "pass");

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{company?.companyName ?? `Application ${application.id}`}</h1>
        <p className="text-sm text-muted-foreground">
          Licence {company?.licenceNumber ?? "—"} · {application.term} months at {formatAed(application.planMonthlyFils, "en")} a month ·
          Submitted {application.submittedAt?.slice(0, 10)}
        </p>
        {data.licenceActivities.length > 0 && <p className="text-sm">Licence activities: {data.licenceActivities.join(", ")}</p>}
        {application.route === "verification_call" && (
          <p className="self-start rounded-lg border px-3 py-1 text-sm">
            Verification call needed: plan is at or above the route threshold.
          </p>
        )}
      </header>

      {!assessment ? (
        <p className="text-destructive">The assessment is missing for this application.</p>
      ) : (
        <>
          <Section title="Score">
            {assessment.score ? (
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-4xl font-semibold">{assessment.score.score}</span>
                <BandBadge band={assessment.score.band} />
                <span className="text-sm text-muted-foreground">Confidence {(assessment.score.confidenceBps / 100).toFixed(0)}%</span>
                {assessment.score.hardStops.map((stop) => (
                  <span key={stop} className="text-sm font-semibold text-destructive">
                    Hard stop: {stop}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">Not scored.</p>
            )}
          </Section>
          <Section title="Documents">
            <DocumentResults checklist={data.checklist} />
          </Section>
          <Section title="Reasons">
            <ReasonsList checks={notPassed} slots={slots} />
          </Section>
          <Section title="Patterns and things to check">
            <PatternsCard insights={assessment.insights} slots={slots} />
          </Section>
          <Section title="Money figures">
            <FiguresTable figures={assessment.figures} problem={assessment.figuresProblem} />
          </Section>
        </>
      )}

      <Section title="Decision">
        <ReviewActions applicationId={application.id} />
        {data.actions.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {data.actions.map((action) => (
              <li key={action.id}>
                <span className="font-medium">{ACTION_LABEL[action.action]}</span> by {action.reviewerName} on{" "}
                {action.createdAt.slice(0, 16).replace("T", " ")} UTC
                {action.reason ? `: ${action.reason}` : ""}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
