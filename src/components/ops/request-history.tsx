import type { listInfoRequests } from "@/db/info-requests";
import { REQUEST_REASON_LABEL, REQUEST_SUBJECT_LABEL } from "./labels";

type InfoRequest = Awaited<ReturnType<typeof listInfoRequests>>[number];

const timeText = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dubai", dateStyle: "medium", timeStyle: "short" });

// Lists the requests already sent, newest first.
export function RequestHistory({ requests }: { requests: InfoRequest[] }) {
  if (requests.length === 0) return <p className="text-sm text-muted-foreground">No requests sent yet.</p>;
  return (
    <ul className="divide-y rounded-xl border">
      {requests.map((request) => (
        <li key={request.id} className="flex flex-col gap-1 p-4">
          <span className="text-sm text-muted-foreground">
            Sent by {request.createdByName ?? "a reviewer"} on {timeText(request.createdAt)} · {request.answeredAt ? `answered ${timeText(request.answeredAt)}` : "not answered yet"}
          </span>
          <ul className="flex flex-col gap-1">
            {request.items.map((item, index) => (
              <li key={index} className="text-sm">
                <span className="font-medium">{REQUEST_SUBJECT_LABEL[item.subject]}</span>: {REQUEST_REASON_LABEL[item.reason]}
                {item.note ? <span className="text-muted-foreground"> · {item.note}</span> : null}
                {item.resolvedAt ? <span className="text-success"> · done</span> : null}
                {item.noteAr ? (
                  <span dir="rtl" lang="ar" className="block text-muted-foreground">
                    {item.noteAr}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
