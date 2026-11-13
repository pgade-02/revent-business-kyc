"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { SLOT_LABEL } from "@/kyc/checks/read-value";
import { DOCUMENT_SLOTS } from "@/kyc/documents/slots";
import type { REVIEW_ACTIONS } from "@/kyc/review/review-action";

type Action = (typeof REVIEW_ACTIONS)[number];

const LABEL: Record<Action, string> = { approve: "Approve", request_document: "Request document", reject: "Reject" };

// Approve · Request document · Reject: always a person's click (PRD §6, item 7). The server
// checks the same rules again, so the reason is required there too.
export function ReviewActions({ applicationId }: { applicationId: number }) {
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [slot, setSlot] = useState<string>(DOCUMENT_SLOTS[0]);
  const [error, setError] = useState<string | null>(null);

  async function record() {
    if (!action) return;
    const body = action === "request_document" ? { action, slot, reason } : { action, reason };
    const response = await fetch(`/api/team/applications/${applicationId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (response?.status === 201) {
      setAction(null);
      setReason("");
      setError(null);
      router.refresh();
      return;
    }
    const message: unknown = await response?.json().catch(() => null);
    setError(
      message && typeof message === "object" && "error" in message && typeof message.error === "string"
        ? message.error
        : "Could not record the decision.",
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(LABEL) as Action[]).map((choice) => (
          <Button
            key={choice}
            variant={choice === "reject" ? "destructive" : choice === action ? "default" : "outline"}
            onClick={() => setAction(choice)}
          >
            {LABEL[choice]}
          </Button>
        ))}
      </div>
      {action && (
        <div className="flex flex-col gap-3">
          {action === "request_document" && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="slot">Document</Label>
              <NativeSelect id="slot" value={slot} onChange={(event) => setSlot(event.target.value)}>
                {DOCUMENT_SLOTS.map((option) => (
                  <option key={option} value={option}>
                    {SLOT_LABEL[option]}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <Label htmlFor="reason">{action === "approve" ? "Note (optional)" : "Reason (required)"}</Label>
            <Textarea id="reason" value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button className="self-start" onClick={record}>
            Record: {LABEL[action]}
          </Button>
        </div>
      )}
    </div>
  );
}
