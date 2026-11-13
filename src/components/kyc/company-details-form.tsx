"use client";

import { useTranslations } from "next-intl";
import type { ComponentProps, ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { EMIRATES, LEGAL_FORMS } from "@/kyc/company/company-details";
import { FormField, SaveRow, useDetailsForm } from "./details-form";

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

export function CompanyDetailsForm({ applicationId, initial }: { applicationId: number; initial: CompanyFormValues }) {
  const t = useTranslations("Kyc.companyForm");
  const form = useDetailsForm(`/api/applications/${applicationId}/company`, initial);
  const { values, set, invalid } = form;

  const field = (name: TextField, control: (props: { id: string; "aria-invalid": boolean }) => ReactNode, hint?: string) => (
    <FormField name={name} label={t(`fields.${name}`)} error={invalid.includes(name) ? t(`errors.${name}`) : null} hint={hint}>
      {control}
    </FormField>
  );

  // dir="auto": an English name typed on the Arabic site keeps its own direction (no "." jumping to the front).
  const input = (name: TextField, extra: ComponentProps<"input"> = {}) =>
    field(name, (props) => <Input {...props} dir="auto" {...extra} value={values[name]} onChange={(event) => set(name, event.target.value)} />);

  const select = (name: "emirate" | "legalForm", options: readonly string[], labels: "emirates" | "legalForms") =>
    field(name, (props) => (
      <NativeSelect {...props} className="w-full" value={values[name]} onChange={(event) => set(name, event.target.value)}>
        <NativeSelectOption value="">{t("choose")}</NativeSelectOption>
        {options.map((option) => (
          <NativeSelectOption key={option} value={option}>
            {t(`${labels}.${option}`)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    ));

  return (
    <form onSubmit={form.save} noValidate className="flex flex-col gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        {input("companyName", { autoComplete: "organization" })}
        {input("licenceNumber")}
        {input("yearEstablished", { inputMode: "numeric", maxLength: 4 })}
        {input("issuingAuthority")}
        {select("emirate", EMIRATES, "emirates")}
        {select("legalForm", LEGAL_FORMS, "legalForms")}
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
      <SaveRow saveState={form.saveState} hasInvalidFields={invalid.length > 0} />
    </form>
  );
}
