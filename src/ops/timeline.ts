import { z } from "zod";

// Events on an application. "detail" holds ids, slots and field names only, never personal data.
export const TIMELINE_EVENTS = [
  "document_uploaded",
  "document_removed",
  "company_details_changed",
  "signatory_details_changed",
  "submitted",
  "assessment_ready",
  "owner_changed",
  "stage_changed",
  "document_reviewed",
  "information_requested",
  "information_provided",
] as const;
export type TimelineEvent = (typeof TIMELINE_EVENTS)[number];

export const timelineDetailSchema = z.record(z.string(), z.union([z.string(), z.number(), z.null(), z.array(z.string())]));
export type TimelineDetail = z.infer<typeof timelineDetailSchema>;
