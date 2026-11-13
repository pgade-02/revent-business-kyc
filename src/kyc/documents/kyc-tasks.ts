import type { DocumentSlot } from "./slots";

// The tasks on the Business verification hub (PRD §4). Contact person is left out.
export const KYC_TASKS = ["account", "company", "documents", "signatory", "self_disclosure"] as const;
export type KycTask = (typeof KYC_TASKS)[number];

export type TaskStatus = "completed" | "in_progress" | "not_started" | "needs_fix" | "coming_soon";

// Upload boxes per task. A task is done when every box has at least one file.
export const TASK_SLOTS: Readonly<Partial<Record<KycTask, readonly DocumentSlot[]>>> = {
  documents: ["trade_licence", "tax_certificate", "bank_statement"],
  signatory: ["passport", "emirates_id_front", "emirates_id_back"],
  self_disclosure: ["self_disclosure"],
};

// Plans at or above the route threshold have no self-disclosure task (PRD §4: "x of 4").
export function tasksForRoute(route: "self_disclosure" | "verification_call"): KycTask[] {
  return KYC_TASKS.filter((task) => task !== "self_disclosure" || route === "self_disclosure");
}

type FileState = { slot: DocumentSlot; status: string };

// A file waiting for a fix wins over everything, so the customer sees where to act.
export function uploadTaskStatus(slots: readonly DocumentSlot[], files: readonly FileState[]): TaskStatus {
  const own = files.filter((file) => slots.includes(file.slot));
  if (own.some((file) => file.status === "needs_fix")) return "needs_fix";
  const filled = slots.filter((slot) => own.some((file) => file.slot === slot)).length;
  if (filled === 0) return "not_started";
  return filled === slots.length ? "completed" : "in_progress";
}

// The application as far as the hub needs it. Typed details are only ever saved after
// passing validation, so "saved" means "complete".
export type TaskInputs = { files: readonly FileState[]; companyDetailsSaved: boolean; signatoryDetailsSaved: boolean };

export function taskStatus(task: KycTask, { files, companyDetailsSaved, signatoryDetailsSaved }: TaskInputs): TaskStatus {
  if (task === "account") return "completed"; // pre-filled from the customer's account
  if (task === "company") return companyDetailsSaved ? "completed" : "not_started";
  const uploads = uploadTaskStatus(TASK_SLOTS[task] ?? [], files);
  if (task !== "signatory") return uploads;
  // Signatory = details form + identity documents: complete only when both are done.
  if (uploads === "needs_fix" || (uploads === "completed" && signatoryDetailsSaved)) return uploads;
  return uploads === "not_started" && !signatoryDetailsSaved ? "not_started" : "in_progress";
}
