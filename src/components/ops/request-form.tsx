"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { REQUEST_REASONS, REQUEST_SUBJECTS, type RequestItem } from "@/ops/info-requests";
import { draftRequestMessage } from "@/ops/request-message";
import { REQUEST_REASON_LABEL, REQUEST_SUBJECT_LABEL } from "./labels";

const MAX_ITEMS = 10;
const emptyItem = (): RequestItem => ({ subject: REQUEST_SUBJECTS[0], reason: REQUEST_REASONS[0], note: "" });

export type MessageLanguage = "en" | "ar";
const FIELD = { en: "note", ar: "noteAr" } as const;

// Edits one item of the request: what to ask for, why, and one message in the chosen language.
function ItemFields({
  item,
  index,
  language,
  onChange,
  onRemove,
}: {
  item: RequestItem;
  index: number;
  language: MessageLanguage;
  onChange: (item: RequestItem) => void;
  onRemove?: () => void;
}) {
  const [drafting, setDrafting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const field = FIELD[language];

  async function draftMessage() {
    setProblem(null);
    const english = draftRequestMessage(item, REQUEST_SUBJECT_LABEL[item.subject]);
    if (language === "en") return onChange({ ...item, note: english });
    setDrafting(true);
    const arabicMessage = await translateToArabic(english);
    setDrafting(false);
    if (arabicMessage === null) return setProblem("Could not draft the Arabic. You can type it yourself.");
    onChange({ ...item, noteAr: arabicMessage });
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">Item {index + 1}</legend>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect aria-label={`What to ask for, item ${index + 1}`} value={item.subject} onChange={(event) => onChange({ ...item, subject: event.target.value as RequestItem["subject"] })}>
          {REQUEST_SUBJECTS.map((subject) => (
            <option key={subject} value={subject}>
              {REQUEST_SUBJECT_LABEL[subject]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label={`Reason, item ${index + 1}`} value={item.reason} onChange={(event) => onChange({ ...item, reason: event.target.value as RequestItem["reason"] })}>
          {REQUEST_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {REQUEST_REASON_LABEL[reason]}
            </option>
          ))}
        </NativeSelect>
        <Button type="button" size="sm" variant="outline" disabled={drafting} onClick={draftMessage}>
          {drafting ? "Drafting…" : "Draft message"}
        </Button>
        {onRemove && (
          <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>
      <Textarea
        aria-label={`Message, item ${index + 1}`}
        dir={language === "ar" ? "rtl" : "ltr"}
        lang={language}
        placeholder={language === "ar" ? "رسالة إلى العميل (اختياري)" : "Message to the customer (optional)"}
        maxLength={language === "ar" ? 1000 : 500}
        value={item[field] ?? ""}
        onChange={(event) => onChange({ ...item, [field]: event.target.value })}
      />
      {problem && (
        <span role="alert" className="text-sm text-destructive">
          {problem}
        </span>
      )}
    </fieldset>
  );
}

const draftsSchema = z.object({ arabic: z.array(z.string().nullable()) });

// Asks the server for an Arabic draft of one message; null when it could not translate.
async function translateToArabic(text: string): Promise<string | null> {
  const response = await fetch("/api/ops/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texts: [text] }) });
  if (!response.ok) return null;
  const parsed = draftsSchema.safeParse(await response.json().catch(() => null));
  return parsed.success ? (parsed.data.arabic[0] ?? null) : null;
}

// Builds and sends a "more information" request, optionally starting from the suggested items.
export function RequestForm({ applicationId, disabled, suggested }: { applicationId: number; disabled: boolean; suggested: RequestItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState<RequestItem[]>([emptyItem()]);
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [language, setLanguage] = useState<MessageLanguage>("en");

  async function send() {
    setSending(true);
    setMessage(null);
    const body = { items: items.map((item) => ({ ...item, [language === "en" ? "noteAr" : "note"]: undefined })) };
    const response = await fetch(`/api/ops/applications/${applicationId}/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSending(false);
    if (!response.ok) return setMessage(response.status === 409 ? "Not allowed in this stage." : "Could not send. Check each item and try again.");
    setItems([emptyItem()]);
    router.refresh();
  }

  const update = (index: number, item: RequestItem) => setItems(items.map((current, at) => (at === index ? item : current)));
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm">
        Message language
        <NativeSelect aria-label="Message language" value={language} onChange={(event) => setLanguage(event.target.value === "ar" ? "ar" : "en")}>
          <option value="en">English</option>
          <option value="ar">Arabic</option>
        </NativeSelect>
      </label>
      {items.map((item, index) => (
        <ItemFields
          key={index}
          item={item}
          index={index}
          language={language}
          onChange={(changed) => update(index, changed)}
          onRemove={items.length > 1 ? () => setItems(items.filter((_, at) => at !== index)) : undefined}
        />
      ))}
      <div className="flex flex-wrap items-center gap-2">
        {suggested.length > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={() => setItems(suggested.map((item) => ({ ...item, note: "" })))}>
            Use suggested request ({suggested.length})
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" disabled={items.length >= MAX_ITEMS} onClick={() => setItems([...items, emptyItem()])}>
          Add item
        </Button>
        <Button type="button" size="sm" disabled={disabled || sending} onClick={send}>
          Send request
        </Button>
        {message && (
          <span role="alert" className="text-sm text-destructive">
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
