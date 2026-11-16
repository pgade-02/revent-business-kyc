"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import type { ApplicationStage } from "@/ops/stages";
import { STAGE_LABEL } from "./labels";

// Sends one back-office change and refreshes the page, keeping any refusal to show.
function useOpsAction() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function send(url: string, body: unknown) {
    setBusy(true);
    setError(null);
    const response = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (response.ok) router.refresh();
    else setError(response.status === 409 ? "Not allowed in this stage." : "Could not save. Try again.");
  }
  return { send, error, busy };
}

const ErrorText = ({ text }: { text: string | null }) => (text ? <span role="alert" className="text-sm text-destructive">{text}</span> : null);

// Picks the application's owner from the reviewers.
export function OwnerSelect({ applicationId, ownerId, reviewers }: { applicationId: number; ownerId: string | null; reviewers: { id: string; name: string }[] }) {
  const { send, error, busy } = useOpsAction();
  return (
    <span className="flex items-center gap-2">
      <NativeSelect
        aria-label="Owner"
        value={ownerId ?? ""}
        disabled={busy}
        onChange={(event) => send(`/api/ops/applications/${applicationId}/owner`, { ownerId: event.target.value || null })}
      >
        <option value="">Unassigned</option>
        {reviewers.map((reviewer) => (
          <option key={reviewer.id} value={reviewer.id}>
            {reviewer.name}
          </option>
        ))}
      </NativeSelect>
      <ErrorText text={error} />
    </span>
  );
}

// Moves the application to one of the stages the rules allow next.
export function StageSelect({ applicationId, next }: { applicationId: number; next: readonly ApplicationStage[] }) {
  const { send, error, busy } = useOpsAction();
  return (
    <span className="flex items-center gap-2">
      <NativeSelect
        aria-label="Change status"
        value=""
        disabled={busy || next.length === 0}
        onChange={(event) => event.target.value && send(`/api/ops/applications/${applicationId}/stage`, { to: event.target.value })}
      >
        <option value="">Change status</option>
        {next.map((stage) => (
          <option key={stage} value={stage}>
            {STAGE_LABEL[stage]}
          </option>
        ))}
      </NativeSelect>
      <ErrorText text={error} />
    </span>
  );
}

// Approves or rejects one document.
export function DocumentReviewButtons({ documentId, disabled }: { documentId: number; disabled: boolean }) {
  const { send, error, busy } = useOpsAction();
  const review = (state: "approved" | "rejected") => send(`/api/ops/documents/${documentId}/review`, { state });
  return (
    <span className="flex items-center gap-2">
      <Button size="sm" variant="outline" disabled={disabled || busy} onClick={() => review("approved")}>
        Approve
      </Button>
      <Button size="sm" variant="outline" disabled={disabled || busy} onClick={() => review("rejected")}>
        Reject
      </Button>
      <ErrorText text={error} />
    </span>
  );
}
