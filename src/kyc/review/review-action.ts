import { z } from "zod";
import { DOCUMENT_SLOTS } from "../documents/slots";

export const REVIEW_ACTIONS = ["approve", "request_document", "reject"] as const;

const reason = z.string().trim().min(1, "A reason is required").max(1_000);

// What a reviewer can record (PRD §6, item 7). Always a person's decision: the system never
// approves or rejects. Reject and document requests need a reason; approve may have one.
export const reviewActionInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), reason: reason.optional().or(z.literal("").transform(() => undefined)) }),
  z.object({ action: z.literal("request_document"), slot: z.enum(DOCUMENT_SLOTS), reason }),
  z.object({ action: z.literal("reject"), reason }),
]);
export type ReviewActionInput = z.infer<typeof reviewActionInput>;
