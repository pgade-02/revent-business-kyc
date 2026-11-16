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

type MessageLanguage = "en" | "ar";
type DraftItem = RequestItem & { key: number; language: MessageLanguage };

const MAX_ITEMS = 10;
let nextKey = 0;
const toDraft = (item: RequestItem): DraftItem => ({ ...item, note: "", noteAr: "", key: nextKey++, language: "en" });
const emptyItem = (): DraftItem => toDraft({ subject: REQUEST_SUBJECTS[0], reason: REQUEST_REASONS[0] });

const draftsSchema = z.object({ arabic: z.array(z.string().nullable()) });

// Asks the server for an Arabic draft of one message; null when it could not translate.
async function translateToArabic(text: string): Promise<string | null> {
  const response = await fetch("/api/ops/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texts: [text] }) });
  if (!response.ok) return null;
  const parsed = draftsSchema.safeParse(await response.json().catch(() => null));
  return parsed.success ? (parsed.data.arabic[0] ?? null) : null;
}

// One item: what to ask for, why, a drafted message in the chosen language, and its own Send and Remove.
function ItemCard({
  item,
  index,
  disabled,
  onChange,
  onSend,
  onRemove,
}: {
  item: DraftItem;
  index: number;
  disabled: boolean;
  onChange: (item: DraftItem) => void;
  onSend: () => Promise<string | null>;
  onRemove: () => void;
}) {
  const [busy, setBusy] = useState<"drafting" | "sending" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const field = item.language === "ar" ? "noteAr" : "note";
  const label = (text: string) => `${text}, item ${index + 1}`;

  async function draftMessage() {
    setProblem(null);
    const english = draftRequestMessage(item, REQUEST_SUBJECT_LABEL[item.subject]);
    if (item.language === "en") return onChange({ ...item, note: english });
    setBusy("drafting");
    const arabic = await translateToArabic(english);
    setBusy(null);
    if (arabic === null) return setProblem("Could not draft the Arabic. You can type it yourself.");
    onChange({ ...item, noteAr: arabic });
  }

  async function send() {
    setBusy("sending");
    setProblem(await onSend());
    setBusy(null);
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">Item {index + 1}</legend>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect aria-label={label("What to ask for")} value={item.subject} onChange={(event) => onChange({ ...item, subject: event.target.value as RequestItem["subject"] })}>
          {REQUEST_SUBJECTS.map((subject) => (
            <option key={subject} value={subject}>
              {REQUEST_SUBJECT_LABEL[subject]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label={label("Reason")} value={item.reason} onChange={(event) => onChange({ ...item, reason: event.target.value as RequestItem["reason"] })}>
          {REQUEST_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {REQUEST_REASON_LABEL[reason]}
            </option>
          ))}
        </NativeSelect>
        <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={draftMessage}>
          {busy === "drafting" ? "Drafting…" : "Draft message"}
        </Button>
        <NativeSelect aria-label={label("Language")} value={item.language} onChange={(event) => onChange({ ...item, language: event.target.value === "ar" ? "ar" : "en" })}>
          <option value="en">English</option>
          <option value="ar">Arabic</option>
        </NativeSelect>
      </div>
      <Textarea
        aria-label={label("Message")}
        dir={item.language === "ar" ? "rtl" : "ltr"}
        lang={item.language}
        placeholder={item.language === "ar" ? "رسالة إلى العميل (اختياري)" : "Message to the customer (optional)"}
        maxLength={item.language === "ar" ? 1000 : 500}
        value={item[field] ?? ""}
        onChange={(event) => onChange({ ...item, [field]: event.target.value })}
      />
      <div className="flex flex-wrap items-center justify-end gap-2">
        {problem && (
          <span role="alert" className="me-auto text-sm text-destructive">
            {problem}
          </span>
        )}
        <Button type="button" size="sm" disabled={disabled || busy !== null} onClick={send}>
          {busy === "sending" ? "Sending…" : "Send request"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onRemove}>
          Remove
        </Button>
      </div>
    </fieldset>
  );
}

// Lists the items to ask for, starting from the suggested ones; each item is sent on its own.
export function RequestForm({ applicationId, disabled, suggested }: { applicationId: number; disabled: boolean; suggested: RequestItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState<DraftItem[]>(() => (suggested.length > 0 ? suggested.map(toDraft) : [emptyItem()]));

  async function sendItem(item: DraftItem): Promise<string | null> {
    const message = item.language === "ar" ? { noteAr: item.noteAr } : { note: item.note };
    const response = await fetch(`/api/ops/applications/${applicationId}/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ subject: item.subject, reason: item.reason, ...message }] }),
    });
    if (!response.ok) return response.status === 409 ? "Not allowed in this stage." : "Could not send. Check the item and try again.";
    setItems((current) => current.filter((other) => other.key !== item.key));
    router.refresh();
    return null;
  }

  const update = (changed: DraftItem) => setItems((current) => current.map((item) => (item.key === changed.key ? changed : item)));
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => (
        <ItemCard
          key={item.key}
          item={item}
          index={index}
          disabled={disabled}
          onChange={update}
          onSend={() => sendItem(item)}
          onRemove={() => setItems((current) => current.filter((other) => other.key !== item.key))}
        />
      ))}
      <Button type="button" variant="outline" size="sm" className="self-start" disabled={items.length >= MAX_ITEMS} onClick={() => setItems((current) => [...current, emptyItem()])}>
        Add item
      </Button>
    </div>
  );
}
