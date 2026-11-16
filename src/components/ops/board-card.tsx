import Link from "next/link";
import { waitingFor, type BoardCard as BoardCardData } from "@/ops/board";
import { formatAed } from "@/lib/format-money";
import { ROUTE_LABEL, STAGE_LABEL } from "./labels";

function Chip({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "attention" }) {
  const style = tone === "attention" ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" : "bg-muted text-muted-foreground";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>{children}</span>;
}

// Shows one application on the board and links to its page.
export function BoardCard({ card, now }: { card: BoardCardData; now: Date }) {
  const items = `${card.itemCount} item${card.itemCount === 1 ? "" : "s"}`;
  return (
    <Link href={`/ops/applications/${card.id}`} className="flex flex-col gap-3 rounded-xl border p-4 transition-colors hover:bg-accent">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-mono font-medium">{card.reference ?? `#${card.id}`}</span>
        <span className="text-muted-foreground">{card.stageChangedAt ? waitingFor(card.stageChangedAt, now) : "—"}</span>
      </div>
      <div className="flex flex-col">
        <span className="font-medium">{card.companyName ?? "Company name not given"}</span>
        <span className="text-sm text-muted-foreground">
          {items} · {card.term} months · {formatAed(card.planMonthlyFils, "en")} a month
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Chip>{STAGE_LABEL[card.stage]}</Chip>
        {card.route === "self_disclosure" && <Chip>{ROUTE_LABEL.self_disclosure}</Chip>}
        {card.toReviewCount > 0 && <Chip tone="attention">{card.toReviewCount} to review</Chip>}
      </div>
      <span className="text-sm text-muted-foreground">Owner: {card.ownerName ?? "Unassigned"}</span>
    </Link>
  );
}
