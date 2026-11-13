import { TASK_SLOTS, tasksForRoute, type KycTask, type TaskInputs } from "../documents/kyc-tasks";
import type { DocumentSlot } from "../documents/slots";

// What still stops the customer from submitting (PRD §5, decision log 49): an empty
// required upload box, or a details form that was never saved. A file that is waiting
// for a fix does not block; the team sees its warning instead.

export type SubmitBlocker = DocumentSlot | "company_details" | "signatory_details";

export type SubmitInputs = TaskInputs & { route: "self_disclosure" | "verification_call" };

export function submitBlockers({ route, files, companyDetailsSaved, signatoryDetailsSaved }: SubmitInputs): SubmitBlocker[] {
  const blockers: SubmitBlocker[] = [];
  if (!companyDetailsSaved) blockers.push("company_details");
  if (!signatoryDetailsSaved) blockers.push("signatory_details");
  const requiredSlots = tasksForRoute(route).flatMap((task) => TASK_SLOTS[task] ?? []);
  for (const slot of requiredSlots) {
    if (!files.some((file) => file.slot === slot)) blockers.push(slot);
  }
  return blockers;
}

// The task where the customer fixes a blocker, so the screen can link straight to it.
export function blockerTask(blocker: SubmitBlocker): KycTask {
  if (blocker === "company_details") return "company";
  if (blocker === "signatory_details") return "signatory";
  const owner = (Object.keys(TASK_SLOTS) as KycTask[]).find((task) => TASK_SLOTS[task]?.includes(blocker));
  if (!owner) throw new Error(`slot ${blocker} belongs to no task`); // a bug in TASK_SLOTS, not user input
  return owner;
}
