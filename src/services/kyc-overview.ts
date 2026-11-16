import { cache } from "react";
import { findLatestCustomerApplication } from "@/auth/access";
import type { SessionUser } from "@/auth/session";
import { getAppDatabase } from "@/db/app-db";
import { listOpenRequestItems } from "@/db/info-requests";
import type { SavedCompanyDetails } from "@/db/company-details";
import type { CurrentDocument } from "@/db/documents";
import type { SavedSignatoryDetails } from "@/db/signatory-details";
import { loadLatestScoringSettings } from "@/db/scoring-settings";
import { TASK_SLOTS, taskStatus, tasksForRoute, type KycTask, type TaskStatus } from "@/kyc/documents/kyc-tasks";
import { submitBlockers, type SubmitBlocker } from "@/kyc/submit/submit-blockers";
import { loadApplicationProgress } from "./application-progress";

export type TaskSummary = { task: KycTask; status: TaskStatus };

export type KycOverview = {
  user: SessionUser;
  applicationId: number;
  submitted: boolean;
  openRequestItems: Awaited<ReturnType<typeof listOpenRequestItems>>;
  documents: CurrentDocument[];
  companyDetails: SavedCompanyDetails | null;
  signatoryDetails: SavedSignatoryDetails | null;
  tasks: TaskSummary[];
  completedCount: number;
  submitBlockers: SubmitBlocker[]; // empty = Submit is allowed
  routeThresholdFils: number;
};

// Everything the verification screens show about the customer's current application.
// cache() runs it once per request, so the layout and the page share one database read.
export const loadKycOverview = cache(async (): Promise<KycOverview | null> => {
  const db = await getAppDatabase();
  const access = await findLatestCustomerApplication(db);
  if (!access.ok) return null;

  const { documents, companyDetails, signatoryDetails, inputs } = await loadApplicationProgress(db, access.value.id);
  const tasks = tasksForRoute(access.value.route).map((task) => ({ task, status: taskStatus(task, inputs) }));
  const { settings } = await loadLatestScoringSettings(db);
  return {
    user: access.user,
    applicationId: access.value.id,
    submitted: access.value.status !== "draft",
    openRequestItems: await listOpenRequestItems(db, access.value.id),
    documents,
    companyDetails,
    signatoryDetails,
    tasks,
    completedCount: tasks.filter((summary) => summary.status === "completed").length,
    submitBlockers: submitBlockers({ route: access.value.route, ...inputs }),
    routeThresholdFils: settings.routeThresholdFils,
  };
});

export type TaskContext = {
  index: number; // 1-based, for "Task 3 of 5"
  total: number;
  status: TaskStatus;
  nextTask: KycTask | null;
  fixes: { slot: CurrentDocument["slot"]; messageKeys: string[] }[]; // files in this task waiting for a fix
};

// Where one task sits in the list, and what is still waiting for a fix in it.
export function describeTask(overview: KycOverview, task: KycTask): TaskContext | null {
  const position = overview.tasks.findIndex((summary) => summary.task === task);
  const summary = overview.tasks[position];
  if (!summary) return null;
  const slots = TASK_SLOTS[task] ?? [];
  const nextTask = overview.tasks.slice(position + 1).find((later) => later.status !== "coming_soon")?.task ?? null;
  return {
    index: position + 1,
    total: overview.tasks.length,
    status: summary.status,
    nextTask,
    fixes: overview.documents
      .filter((document) => slots.includes(document.slot) && document.status === "needs_fix")
      .map((document) => ({ slot: document.slot, messageKeys: document.customerMessageKeys })),
  };
}
