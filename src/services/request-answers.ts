import type { Database } from "@/db/client";
import { listOpenRequestItems, resolveRequestItems } from "@/db/info-requests";
import type { applications } from "@/db/schema";
import { recordEvent } from "@/db/timeline";
import type { RequestSubject } from "@/ops/info-requests";
import { changeStage } from "./back-office";

type ApplicationRow = typeof applications.$inferSelect;

// Whether the customer may change this item: anything in a draft, or an item a reviewer asked for.
export async function canCustomerChange(db: Database, application: ApplicationRow, subject: RequestSubject): Promise<boolean> {
  if (application.status === "draft") return true;
  if (application.status !== "waiting_on_customer") return false;
  return (await listOpenRequestItems(db, application.id)).some((item) => item.subject === subject);
}

// Marks a requested item answered; returns true when nothing is left open and the application went back to review.
export async function recordCustomerAnswer(
  db: Database,
  input: { application: ApplicationRow; customerId: string; subject: RequestSubject; now: string },
): Promise<boolean> {
  const { application, customerId, subject, now } = input;
  if (application.status !== "waiting_on_customer") return false;
  await resolveRequestItems(db, application.id, subject, now);
  await recordEvent(db, { applicationId: application.id, actorId: customerId, event: "information_provided", detail: { subject } });
  if ((await listOpenRequestItems(db, application.id)).length > 0) return false;
  const moved = await changeStage(db, { applicationId: application.id, actorId: customerId, to: "in_review", now });
  return moved.ok;
}
