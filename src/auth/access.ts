import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { applications, documents } from "@/db/schema";
import { getCurrentUser, type SessionUser } from "./session";

type ApplicationRow = typeof applications.$inferSelect;
type DocumentRow = typeof documents.$inferSelect;

export type AccessDenied = "SIGNED_OUT" | "NOT_A_CUSTOMER" | "NOT_A_REVIEWER" | "NOT_FOUND";
export type Access<T> = { ok: true; user: SessionUser; value: T } | { ok: false; reason: AccessDenied };

// Never trust IDs from the browser (SECURITY §4): every lookup is limited to rows the
// signed-in customer owns. Someone else's row looks exactly like a missing one.
async function currentCustomer(): Promise<{ ok: true; user: SessionUser } | { ok: false; reason: AccessDenied }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "SIGNED_OUT" };
  if (user.role !== "customer") return { ok: false, reason: "NOT_A_CUSTOMER" };
  return { ok: true, user };
}

export async function findCustomerApplication(db: Database, applicationId: number): Promise<Access<ApplicationRow>> {
  const customer = await currentCustomer();
  if (!customer.ok) return customer;
  const [row] = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, applicationId), eq(applications.ownerId, customer.user.id)));
  return row ? { ok: true, user: customer.user, value: row } : { ok: false, reason: "NOT_FOUND" };
}

export async function findCustomerDocument(db: Database, documentId: number): Promise<Access<DocumentRow>> {
  const customer = await currentCustomer();
  if (!customer.ok) return customer;
  const [row] = await db
    .select({ document: documents })
    .from(documents)
    .innerJoin(applications, eq(documents.applicationId, applications.id))
    .where(and(eq(documents.id, documentId), eq(applications.ownerId, customer.user.id)));
  return row ? { ok: true, user: customer.user, value: row.document } : { ok: false, reason: "NOT_FOUND" };
}

// The application the KYC screens work on: the customer's most recent one.
export async function findLatestCustomerApplication(db: Database): Promise<Access<ApplicationRow>> {
  const customer = await currentCustomer();
  if (!customer.ok) return customer;
  const [row] = await db
    .select()
    .from(applications)
    .where(eq(applications.ownerId, customer.user.id))
    .orderBy(desc(applications.id))
    .limit(1);
  return row ? { ok: true, user: customer.user, value: row } : { ok: false, reason: "NOT_FOUND" };
}

// The team side: only the reviewer role, and only applications that were submitted.
// A draft is still the customer's to change, so it looks exactly like a missing one.
export async function currentReviewer(): Promise<{ ok: true; user: SessionUser } | { ok: false; reason: AccessDenied }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "SIGNED_OUT" };
  return user.role === "reviewer" ? { ok: true, user } : { ok: false, reason: "NOT_A_REVIEWER" };
}

export async function findReviewerApplication(db: Database, applicationId: number): Promise<Access<ApplicationRow>> {
  const reviewer = await currentReviewer();
  if (!reviewer.ok) return reviewer;
  const [row] = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, applicationId), eq(applications.status, "submitted")));
  return row ? { ok: true, user: reviewer.user, value: row } : { ok: false, reason: "NOT_FOUND" };
}

const statusFor: Record<AccessDenied, number> = { SIGNED_OUT: 401, NOT_A_CUSTOMER: 403, NOT_A_REVIEWER: 403, NOT_FOUND: 404 };

export function accessDeniedResponse(reason: AccessDenied): Response {
  return Response.json({ error: reason }, { status: statusFor[reason] });
}

// Route ids arrive as text; anything that is not a positive whole number cannot be a row.
export function parseId(text: string): number | null {
  const id = Number(text);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
