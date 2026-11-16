import type { listTimeline } from "@/db/timeline";
import { describeEvent } from "./timeline-text";

type TimelineEntry = Awaited<ReturnType<typeof listTimeline>>[number];

const timeText = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dubai", dateStyle: "medium", timeStyle: "short" });

// Says who did something: a reviewer by name, the customer, or the system.
const actorText = (entry: TimelineEntry) => (entry.actorRole === "customer" ? "Customer" : (entry.actorName ?? "System"));

// Lists everything that happened on the application, newest first.
export function TimelineList({ entries, reviewerNames }: { entries: TimelineEntry[]; reviewerNames: ReadonlyMap<string, string> }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>;
  return (
    <ol className="flex flex-col gap-3 border-s ps-4">
      {entries.map((entry) => (
        <li key={entry.id} className="flex flex-col">
          <span className="text-sm">{describeEvent(entry.event, entry.detail, reviewerNames)}</span>
          <span className="text-xs text-muted-foreground">
            {actorText(entry)} · {timeText(entry.createdAt)}
          </span>
        </li>
      ))}
    </ol>
  );
}
