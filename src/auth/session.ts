import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getAppDatabase } from "@/db/app-db";
import { users } from "@/db/schema";
import { createSessionToken, readSessionToken } from "./session-token";

export const SESSION_COOKIE = "revent_session";
const SESSION_SECONDS = 8 * 60 * 60;

export type SessionUser = typeof users.$inferSelect;

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

// A missing secret is a setup mistake, not a user error, so it throws.
function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters (see .env.example)");
  }
  return secret;
}

// The signed-in user, or null. The role always comes from the database, never the cookie.
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const result = readSessionToken(token, nowSeconds(), sessionSecret());
  if (!result.ok) return null;

  const db = await getAppDatabase();
  const [user] = await db.select().from(users).where(eq(users.id, result.userId));
  return user ?? null;
}

export async function startSession(userId: string): Promise<void> {
  const token = createSessionToken(userId, nowSeconds() + SESSION_SECONDS, sessionSecret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, // page scripts cannot read it
    sameSite: "lax", // not sent on cross-site form posts
    secure: process.env.NODE_ENV === "production", // HTTPS only when deployed
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export type CustomerSessionResult = { ok: true; user: SessionUser } | { ok: false; reason: "NOT_A_CUSTOMER" };

// Customers have no sign-in step in v1 (PRD §4): a visitor without a session
// becomes the seeded customer. A signed-in reviewer is refused, not switched.
// Only callable from a route handler or server action, because it may set a cookie.
export async function getOrStartCustomerSession(): Promise<CustomerSessionResult> {
  const current = await getCurrentUser();
  if (current) return current.role === "customer" ? { ok: true, user: current } : { ok: false, reason: "NOT_A_CUSTOMER" };

  const db = await getAppDatabase();
  const [customer] = await db.select().from(users).where(eq(users.role, "customer")).limit(1);
  if (!customer) throw new Error("no seeded customer: the database was not seeded");
  await startSession(customer.id);
  return { ok: true, user: customer };
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
