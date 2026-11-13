"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";

// Sends the application. The server checks completeness again, so a stale page can
// never submit an incomplete application; on refusal the page reloads its list.
export function SubmitButton({ applicationId, disabled }: { applicationId: number; disabled: boolean }) {
  const t = useTranslations("Kyc.review");
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sending" | "failed">("idle");

  async function submit() {
    setState("sending");
    const response = await fetch(`/api/applications/${applicationId}/submit`, { method: "POST" }).catch(() => null);
    if (response?.status === 204 || response?.status === 400 || response?.status === 409) {
      setState("idle");
      router.refresh(); // shows "Verification in progress", or what is still missing
      return;
    }
    setState("failed");
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button size="lg" className="h-12 px-8" disabled={disabled || state === "sending"} onClick={submit}>
        {t(state === "sending" ? "submitting" : "submit")}
      </Button>
      {state === "failed" && (
        <p role="alert" className="text-sm text-destructive">
          {t("submitFailed")}
        </p>
      )}
    </div>
  );
}
