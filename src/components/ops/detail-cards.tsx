import type { ReactNode } from "react";
import type { applications } from "@/db/schema";
import { formatAed } from "@/lib/format-money";
import type { TypedComparisons } from "@/ops/typed-vs-document";
import type { listPlanLines } from "@/services/ops-application";
import { DocumentSays } from "./document-says";
import english from "../../../messages/en.json";

type ApplicationRow = typeof applications.$inferSelect;
type PlanLine = Awaited<ReturnType<typeof listPlanLines>>[number];

const companyForm = english.Kyc.companyForm;
const labelFor = (labels: Record<string, string>, code: string | null) => (code ? (Object.entries(labels).find(([key]) => key === code)?.[1] ?? code) : null);

// Frames one card of label and value rows.
function DetailCard({ title, rows }: { title: string; rows: [string, ReactNode][] }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4">
      <h2 className="font-semibold">{title}</h2>
      <dl className="grid grid-cols-[minmax(0,10rem)_1fr] gap-x-4 gap-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-words">{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// Shows the company details the customer typed, each with what the documents say.
export function CompanyCard({ application, comparisons }: { application: ApplicationRow; comparisons: TypedComparisons }) {
  const labels = companyForm.fields;
  return (
    <DetailCard
      title="Company"
      rows={[
        [labels.companyName, <DocumentSays key="name" value={application.companyName} comparison={comparisons.companyName} />],
        [labels.licenceNumber, <DocumentSays key="licence" value={application.licenceNumber} comparison={comparisons.licenceNumber} />],
        [labels.issuingAuthority, application.issuingAuthority],
        [labels.emirate, <DocumentSays key="emirate" value={labelFor(companyForm.emirates, application.emirate)} comparison={comparisons.emirate} />],
        [labels.legalForm, labelFor(companyForm.legalForms, application.legalForm)],
        [labels.yearEstablished, application.yearEstablished],
        ["TRN", <DocumentSays key="trn" value={application.trn} comparison={comparisons.trn} />],
        [labels.registeredAddress, application.registeredAddress],
        ["Deliver to this address", application.deliverToRegisteredAddress === null ? null : application.deliverToRegisteredAddress ? "Yes" : "No"],
      ]}
    />
  );
}

// Shows the authorised signatory the customer named, with what the ID documents say.
export function SignatoryCard({ application, comparisons }: { application: ApplicationRow; comparisons: TypedComparisons }) {
  return (
    <DetailCard
      title="Authorised signatory"
      rows={[
        ["Name", <DocumentSays key="name" value={application.signatoryName} comparison={comparisons.signatoryName} />],
        ["Signing email", application.signatoryEmail],
        ["Mobile", application.signatoryMobile],
        ["Is the applicant", application.signatoryIsApplicant === null ? null : application.signatoryIsApplicant ? "Yes" : "No"],
      ]}
    />
  );
}

// Shows the account holder who filled in the application.
export function ContactCard({ contact }: { contact: { name: string; email: string; mobile: string | null } | null }) {
  return (
    <DetailCard
      title="Contact person"
      rows={[
        ["Name", contact?.name],
        ["Email", contact?.email],
        ["Mobile", contact?.mobile],
      ]}
    />
  );
}

// Shows the plan: each product with its services, the term and the money figures.
export function PlanCard({ application, lines }: { application: ApplicationRow; lines: PlanLine[] }) {
  return (
    <DetailCard
      title="Plan"
      rows={[
        ...lines.map((line): [string, ReactNode] => [
          `${line.quantity} × ${line.productName}`,
          line.services.length > 0 ? line.services.join(", ") : "No added services",
        ]),
        ["Term", `${application.term} months`],
        ["Monthly", formatAed(application.planMonthlyFils, "en")],
        ["Contract total", formatAed(application.contractTotalFils, "en")],
      ]}
    />
  );
}
