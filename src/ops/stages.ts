// Where an application is in the back office.
export const APPLICATION_STAGES = ["draft", "submitted", "in_review", "waiting_on_customer", "approved", "rejected"] as const;
export type ApplicationStage = (typeof APPLICATION_STAGES)[number];

export const CLOSED_STAGES: readonly ApplicationStage[] = ["approved", "rejected"];
export const isOpen = (stage: ApplicationStage) => stage !== "draft" && !CLOSED_STAGES.includes(stage);

const NEXT: Record<ApplicationStage, readonly ApplicationStage[]> = {
  draft: [],
  submitted: ["in_review", "waiting_on_customer", "approved", "rejected"],
  in_review: ["waiting_on_customer", "approved", "rejected"],
  waiting_on_customer: ["in_review", "approved", "rejected"],
  approved: ["in_review"],
  rejected: ["in_review"],
};

// Lists the stages a reviewer may move an application to from its current stage.
export const nextStages = (from: ApplicationStage): readonly ApplicationStage[] => NEXT[from];

// Whether a reviewer may move an application from one stage to another.
export const canMoveTo = (from: ApplicationStage, to: ApplicationStage) => NEXT[from].includes(to);
