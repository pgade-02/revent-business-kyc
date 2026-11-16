import Link from "next/link";
import { notFound } from "next/navigation";
import { findReviewerApplication, parseId } from "@/auth/access";
import {
  CompanyCard,
  ContactCard,
  PlanCard,
  SignatoryCard,
} from "@/components/ops/detail-cards";
import { DocumentRow } from "@/components/ops/document-row";
import { ROUTE_LABEL, STAGE_LABEL } from "@/components/ops/labels";
import { OwnerSelect, StageSelect } from "@/components/ops/ops-actions";
import { RequestForm } from "@/components/ops/request-form";
import { RiskCard } from "@/components/ops/risk-card";
import { RequestHistory } from "@/components/ops/request-history";
import { TimelineList } from "@/components/ops/timeline-list";
import { SignInAsReviewer } from "@/components/team/sign-in-as-reviewer";
import { getAppDatabase } from "@/db/app-db";
import { waitingFor } from "@/ops/board";
import { isOpen, nextStages } from "@/ops/stages";
import { loadOpsApplication } from "@/services/ops-application";

export const dynamic = "force-dynamic";

// Shows one application: header, documents, requests, the details cards and the timeline.
export default async function OpsApplicationPage({
  params,
}: PageProps<"/ops/applications/[id]">) {
  const id = parseId((await params).id);
  if (id === null) notFound();
  const db = await getAppDatabase();
  const access = await findReviewerApplication(db, id);
  if (!access.ok)
    return access.reason === "NOT_FOUND" ? notFound() : <SignInAsReviewer />;
  const data = await loadOpsApplication(db, id);
  if (!data) notFound();
  const {
    application,
    reviewers,
    contact,
    planLines,
    documents,
    comparisons,
    suggestedRequest,
    requests,
    timeline,
    assessment,
    otherChecks,
  } = data;
  const reviewerNames = new Map(
    reviewers.map((reviewer) => [reviewer.id, reviewer.name]),
  );
  const slotsById = new Map(
    documents.map((document) => [String(document.id), document.slot]),
  );
  const now = new Date();

  return (
    <>
      <Link
        href="/ops"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        ← Applications
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">
            {application.reference ?? `#${application.id}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            {application.companyName ?? "Company name not given"} ·{" "}
            {STAGE_LABEL[application.status]}
            {application.stageChangedAt
              ? ` for ${waitingFor(application.stageChangedAt, now)}`
              : ""}{" "}
            · {ROUTE_LABEL[application.route]}
            {application.submittedAt
              ? ` · submitted ${waitingFor(application.submittedAt, now)} ago`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <OwnerSelect
            applicationId={application.id}
            ownerId={application.assignedTo}
            reviewers={reviewers}
          />
          <StageSelect
            applicationId={application.id}
            next={nextStages(application.status)}
          />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Documents</h2>
            {documents.length === 0 ? (
              <p className="text-muted-foreground">No documents uploaded.</p>
            ) : (
              <ul className="divide-y rounded-xl border">
                {documents.map((document) => (
                  <DocumentRow
                    key={document.id}
                    document={document}
                    canReview={isOpen(application.status)}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">More information</h2>
            <RequestHistory requests={requests} />
            <RequestForm
              applicationId={application.id}
              disabled={!isOpen(application.status)}
              suggested={suggestedRequest}
            />
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <CompanyCard application={application} comparisons={comparisons} />
            <SignatoryCard application={application} comparisons={comparisons} />
            <ContactCard contact={contact} />
            <PlanCard application={application} lines={planLines} />
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Overall risk</h2>
            <RiskCard assessment={assessment} otherChecks={otherChecks} slots={slotsById} />
          </section>
        </div>

        <aside className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Timeline</h2>
          <TimelineList entries={timeline} reviewerNames={reviewerNames} />
        </aside>
      </div>
    </>
  );
}
