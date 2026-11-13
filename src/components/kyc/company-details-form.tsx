"use client";

import { CheckCircle2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { EMIRATES, LEGAL_FORMS } from "@/kyc/company/company-details";

// Every value is kept as typed; the server parses and checks it (companyDetailsSchema).
export type CompanyFormValues = {
  companyName: string;
  licenceNumber: string;
  yearEstablished: string;
  issuingAuthority: string;
  emirate: string;
  legalForm: string;
  trn: string;
  registeredAddress: string;
  deliverToRegisteredAddress: boolean;
};

type TextField = Exclude<keyof CompanyFormValues, "deliverToRegisteredAddress">;
type SaveState = "idle" | "saving" | "saved" | "failed";

export function CompanyDetailsForm({ applicationId, initial }: { applicationId: number; initial: CompanyFormValues }) {
  const t = useTranslations("Kyc.companyForm");
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const set = (field: keyof CompanyFormValues, value: string | boolean) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    setSaveState("idle");
  };

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaveState("saving");
    const response = await fetch(`/api/applications/${applicationId}/company`, {
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

  // One labelled field with its error message. aria-invalid lets screen readers and the styles see it.
  const field = (name: TextField, control: (props: { id: string; "aria-invalid": boolean }) => React.ReactNode, hint?: string) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{t(`fields.${name}`)}</Label>
      {control({ id: name, "aria-invalid": invalid.includes(name) })}
      {invalid.includes(name) ? (
        <p className="text-sm text-destructive">{t(`errors.${name}`)}</p>
      ) : (
        hint && <p className="text-sm text-muted-foreground">{hint}</p>
      )}
    </div>
  );

  // dir="auto": an English name typed on the Arabic site keeps its own direction (no "." jumping to the front).
  const input = (name: TextField, extra: React.ComponentProps<"input"> = {}) =>
    field(name, (props) => <Input {...props} dir="auto" {...extra} value={values[name]} onChange={(event) => set(name, event.target.value)} />);

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        {input("companyName", { autoComplete: "organization" })}
        {input("licenceNumber")}
        {input("yearEstablished", { inputMode: "numeric", maxLength: 4 })}
        {input("issuingAuthority")}
        {field("emirate", (props) => (
          <NativeSelect {...props} className="w-full" value={values.emirate} onChange={(event) => set("emirate", event.target.value)}>
            <NativeSelectOption value="">{t("choose")}</NativeSelectOption>
            {EMIRATES.map((emirate) => (
              <NativeSelectOption key={emirate} value={emirate}>
                {t(`emirates.${emirate}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ))}
        {field("legalForm", (props) => (
          <NativeSelect {...props} className="w-full" value={values.legalForm} onChange={(event) => set("legalForm", event.target.value)}>
            <NativeSelectOption value="">{t("choose")}</NativeSelectOption>
            {LEGAL_FORMS.map((form) => (
              <NativeSelectOption key={form} value={form}>
                {t(`legalForms.${form}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ))}
        {field(
          "trn",
          (props) => <Input {...props} inputMode="numeric" value={values.trn} onChange={(event) => set("trn", event.target.value)} />,
          t("trnHint"),
        )}
      </div>
      {field("registeredAddress", (props) => (
        <Textarea {...props} dir="auto" rows={3} value={values.registeredAddress} onChange={(event) => set("registeredAddress", event.target.value)} />
      ))}
      <Label className="flex items-center gap-3 font-normal">
        <Checkbox checked={values.deliverToRegisteredAddress} onCheckedChange={(checked) => set("deliverToRegisteredAddress", checked)} />
        {t("deliverToRegisteredAddress")}
      </Label>

      <div className="flex items-center justify-end gap-4">
        {saveState === "saved" && (
          <p role="status" className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2Icon className="size-4" aria-hidden />
            {t("saved")}
          </p>
        )}
        {saveState === "failed" && (
          <p role="alert" className="text-sm text-destructive">
            {invalid.length > 0 ? t("fixFields") : t("saveFailed")}
          </p>
        )}
        <Button type="submit" variant="outline" disabled={saveState === "saving"}>
          {t(saveState === "saving" ? "saving" : "save")}
        </Button>
      </div>
    </form>
  );
}
