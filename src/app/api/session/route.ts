import { eq } from "drizzle-orm";
import { z } from "zod";
import { endSession, getCurrentUser, startSession } from "@/auth/session";
import { getAppDatabase } from "@/db/app-db";
import { users } from "@/db/schema";

// v1 role switch (PRD §4: no real sign-up). Must be replaced by real sign-in
// before any real customer data is used.
const switchRoleInput = z.object({ role: z.enum(["customer", "reviewer"]) });

// Who am I?
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  return Response.json({ id: user.id, role: user.role, name: user.name });
}

// Sign in as the seeded customer or the seeded reviewer.
export async function POST(request: Request) {
  const parsed = switchRoleInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "role must be customer or reviewer" }, { status: 400 });
  }

  const db = await getAppDatabase();
  const [user] = await db.select().from(users).where(eq(users.role, parsed.data.role)).limit(1);
  if (!user) return Response.json({ error: "No user with that role" }, { status: 404 });

  await startSession(user.id);
  return Response.json({ id: user.id, role: user.role, name: user.name });
}

// Sign out.
export async function DELETE() {
  await endSession();
  return new Response(null, { status: 204 });
}
