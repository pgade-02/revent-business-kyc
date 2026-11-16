"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { REQUEST_REASONS, REQUEST_SUBJECTS, type RequestItem } from "@/ops/info-requests";
import arabic from "../../../messages/ar.json";
import { REQUEST_REASON_LABEL, REQUEST_SUBJECT_LABEL } from "./labels";

const MAX_ITEMS = 10;
const emptyItem = (): RequestItem => ({ subject: REQUEST_SUBJECTS[0], reason: REQUEST_REASONS[0], note: "" });

// Gives the Arabic wording the customer will see for an item's subject and reason.
function arabicLabels(item: RequestItem): string {
  const subject =
    item.subject === "company_details" || item.subject === "signatory_details" ? arabic.Kyc.request.subject[item.subject] : arabic.Documents.slots[item.subject].label;
  return `${subject}: ${arabic.Kyc.request.reason[item.reason]}`;
}

// Edits one item of the request: what to ask for, why, a note, and its Arabic draft.
function ItemFields({
  item,
  index,
  showArabic,
  onChange,
  onRemove,
}: {
  item: RequestItem;
  index: number;
  showArabic: boolean;
  onChange: (item: RequestItem) => void;
  onRemove?: () => void;
}) {
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
        {onRemove && (
          <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
            Remove
          </Button>
        )}
      </div>
      <Textarea aria-label={`Note, item ${index + 1}`} placeholder="Note (optional)" maxLength={500} value={item.note ?? ""} onChange={(event) => onChange({ ...item, note: event.target.value })} />
      {showArabic && (
        <div dir="rtl" lang="ar" className="flex flex-col gap-2 rounded-md bg-muted/50 p-2">
          <span className="text-sm">{arabicLabels(item)}</span>
          <Textarea
            aria-label={`Arabic note, item ${index + 1}`}
            placeholder="ملاحظة (اختياري)"
            maxLength={1000}
            value={item.noteAr ?? ""}
            onChange={(event) => onChange({ ...item, noteAr: event.target.value })}
          />
        </div>
      )}
    </fieldset>
  );
}

const draftsSchema = z.object({ arabic: z.array(z.string().nullable()) });

// Asks the server to draft Arabic for every note; a note it could not translate stays as it was.
async function draftArabic(items: RequestItem[]): Promise<RequestItem[] | null> {
  const response = await fetch("/api/ops/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts: items.map((item) => item.note ?? "") }),
  });
  if (!response.ok) return null;
  const parsed = draftsSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) return null;
  const drafts = parsed.data.arabic;
  return items.map((item, index) => ({ ...item, noteAr: drafts[index] ?? item.noteAr ?? "" }));
}

// Builds and sends a "more information" request, optionally starting from the suggested items, with an optional Arabic draft.
export function RequestForm({ applicationId, disabled, suggested }: { applicationId: number; disabled: boolean; suggested: RequestItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState<RequestItem[]>([emptyItem()]);
  const [showArabic, setShowArabic] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<"drafting" | "sending" | null>(null);

  async function onDraftArabic() {
    setBusy("drafting");
    setMessage(null);
    const drafted = await draftArabic(items);
    setBusy(null);
    setShowArabic(true);
    if (drafted) setItems(drafted);
    else setMessage("Could not draft Arabic. You can type it yourself.");
  }

  async function send() {
    setBusy("sending");
    setMessage(null);
    const body = { items: showArabic ? items : items.map((item) => ({ ...item, noteAr: undefined })) };
    const response = await fetch(`/api/ops/applications/${applicationId}/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(null);
    if (!response.ok) return setMessage(response.status === 409 ? "Not allowed in this stage." : "Could not send. Check each item and try again.");
    setItems([emptyItem()]);
    setShowArabic(false);
    router.refresh();
  }

  const update = (index: number, item: RequestItem) => setItems(items.map((current, at) => (at === index ? item : current)));
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => (
        <ItemFields
          key={index}
          item={item}
          index={index}
          showArabic={showArabic}
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
        <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={onDraftArabic}>
          {busy === "drafting" ? "Drafting Arabic…" : "Draft Arabic"}
        </Button>
        <Button type="button" size="sm" disabled={disabled || busy !== null} onClick={send}>
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
