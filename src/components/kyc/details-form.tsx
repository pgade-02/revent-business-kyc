"use client";

import { CheckCircle2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";

// Shared by the Company details and Authorised signatory forms: keep what was typed,
// save it with PUT, and show the server's verdict next to each field.

type SaveState = "idle" | "saving" | "saved" | "failed";

export function useDetailsForm<Values extends Record<string, string | boolean>>(saveUrl: string, initial: Values) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  function set<Field extends keyof Values>(field: Field, value: Values[Field]) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setSaveState("idle");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaveState("saving");
    const response = await fetch(saveUrl, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    }).catch(() => null);
    if (response?.status === 204) {
      setInvalid([]);
      setSaveState("saved");
      router.refresh(); // the hub's task list and status pill update
      return;
    }
    const body: unknown = response?.status === 400 ? await response.json().catch(() => null) : null;
    const fields = body && typeof body === "object" && "invalidFields" in body && Array.isArray(body.invalidFields) ? body.invalidFields.map(String) : [];
    setInvalid(fields);
    setSaveState("failed");
  }

  return { values, set, invalid, saveState, save };
}

// One labelled control with its error (or hint) underneath. aria-invalid marks it for
// screen readers and for the red styles.
export function FormField({
  name,
  label,
  error,
  hint,
  children,
}: {
  name: string;
  label: string;
  error: string | null;
  hint?: string;
  children: (props: { id: string; "aria-invalid": boolean }) => ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      {children({ id: name, "aria-invalid": error !== null })}
      {error ? <p className="text-sm text-destructive">{error}</p> : hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SaveRow({ saveState, hasInvalidFields }: { saveState: SaveState; hasInvalidFields: boolean }) {
  const t = useTranslations("Kyc.detailsForm");
  return (
    <div className="flex items-center justify-end gap-4">
      {saveState === "saved" && (
        <p role="status" className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2Icon className="size-4" aria-hidden />
          {t("saved")}
        </p>
      )}
      {saveState === "failed" && (
        <p role="alert" className="text-sm text-destructive">
          {hasInvalidFields ? t("fixFields") : t("saveFailed")}
        </p>
      )}
      <Button type="submit" variant="outline" disabled={saveState === "saving"}>
        {t(saveState === "saving" ? "saving" : "save")}
      </Button>
    </div>
  );
}
