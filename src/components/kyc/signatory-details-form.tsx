"use client";

import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormField, SaveRow, useDetailsForm } from "./details-form";

// Every value is kept as typed; the server parses and checks it (signatoryDetailsSchema).
export type SignatoryFormValues = { isApplicant: boolean; fullName: string; signingEmail: string; mobile: string };
type Applicant = { name: string; email: string; mobile: string };
type TextField = Exclude<keyof SignatoryFormValues, "isApplicant">;

export function SignatoryDetailsForm({
  applicationId,
  initial,
  applicant,
}: {
  applicationId: number;
  initial: SignatoryFormValues;
  applicant: Applicant;
}) {
  const t = useTranslations("Kyc.signatoryForm");
  const form = useDetailsForm(`/api/applications/${applicationId}/signatory`, initial);
  const { values, set, invalid } = form;

  // Ticking "I'm the authorised signatory" fills in the applicant's own details; they stay editable.
  function onIsApplicant(checked: boolean) {
    set("isApplicant", checked);
    if (checked) {
      set("fullName", applicant.name);
      set("signingEmail", applicant.email);
      set("mobile", applicant.mobile);
    }
  }

  const input = (name: TextField, extra: ComponentProps<"input"> = {}, hint?: string) => (
    <FormField name={name} label={t(`fields.${name}`)} error={invalid.includes(name) ? t(`errors.${name}`) : null} hint={hint}>
      {(props) => <Input {...props} dir="auto" {...extra} value={values[name]} onChange={(event) => set(name, event.target.value)} />}
    </FormField>
  );

  return (
    <form onSubmit={form.save} noValidate className="flex flex-col gap-6">
      <Label className="flex items-center gap-3 font-normal">
        <Checkbox checked={values.isApplicant} onCheckedChange={onIsApplicant} />
        {t("isApplicant")}
      </Label>
      <div className="grid gap-6 sm:grid-cols-2">
        {input("fullName", { autoComplete: "name" }, t("fullNameHint"))}
        {input("signingEmail", { type: "email", autoComplete: "email" }, t("signingEmailHint"))}
        {input("mobile", { type: "tel", autoComplete: "tel", inputMode: "tel" })}
      </div>
      <SaveRow saveState={form.saveState} hasInvalidFields={invalid.length > 0} />
    </form>
  );
}
