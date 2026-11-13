"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// v1 has no real sign-in (PRD §4): the seeded reviewer is one click away. Must be replaced
// by real sign-in before any real customer data is used.
export function SignInAsReviewer() {
  const router = useRouter();
  async function signIn() {
    await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "reviewer" }),
    });
    router.refresh();
  }
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Team sign-in</h1>
      <p className="text-muted-foreground">This area is for Revent reviewers.</p>
      <Button onClick={signIn}>Sign in as reviewer</Button>
    </div>
  );
}
