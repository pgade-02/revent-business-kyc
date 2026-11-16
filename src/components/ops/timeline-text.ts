import { APPLICATION_STAGES } from "@/ops/stages";
import { REQUEST_SUBJECTS } from "@/ops/info-requests";
import type { TimelineDetail, TimelineEvent } from "@/ops/timeline";
import { REQUEST_SUBJECT_LABEL, STAGE_LABEL } from "./labels";

const subjectName = (value: unknown) => {
  const subject = REQUEST_SUBJECTS.find((known) => known === value);
  return subject ? REQUEST_SUBJECT_LABEL[subject] : "an item";
};
const stageName = (value: unknown) => {
  const stage = APPLICATION_STAGES.find((known) => known === value);
  return stage ? STAGE_LABEL[stage] : "another stage";
};
const listOf = (value: unknown) => (Array.isArray(value) && value.length > 0 ? value.map(subjectName).join(", ") : "information");

// Turns one timeline event into a short sentence, using reviewer names for owner changes.
export function describeEvent(event: TimelineEvent, detail: TimelineDetail, reviewerNames: ReadonlyMap<string, string>): string {
  switch (event) {
    case "document_uploaded":
      return `Uploaded ${subjectName(detail.slot)}`;
    case "document_removed":
      return `Removed ${subjectName(detail.slot)}`;
    case "company_details_changed":
      return "Changed the company details";
    case "signatory_details_changed":
      return "Changed the authorised signatory details";
    case "submitted":
      return "Submitted the application";
    case "assessment_ready":
      return "Risk assessment ready";
    case "owner_changed":
      return typeof detail.ownerId === "string" ? `Assigned to ${reviewerNames.get(detail.ownerId) ?? "a reviewer"}` : "Removed the owner";
    case "stage_changed":
      return `Moved from ${stageName(detail.from)} to ${stageName(detail.to)}`;
    case "document_reviewed":
      return `${detail.state === "approved" ? "Approved" : "Rejected"} ${subjectName(detail.slot)}`;
    case "information_requested":
      return `Asked for ${listOf(detail.subjects)}`;
    case "information_provided":
      return `Answered the request for ${subjectName(detail.subject)}`;
  }
}
