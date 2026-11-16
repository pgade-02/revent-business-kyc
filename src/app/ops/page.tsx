import Link from "next/link";
import { currentReviewer } from "@/auth/access";
import { BoardCard } from "@/components/ops/board-card";
import { SignInAsReviewer } from "@/components/team/sign-in-as-reviewer";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { getAppDatabase } from "@/db/app-db";
import { listBoardCards } from "@/db/board";
import { boardFilterSchema, filterBoard, type BoardFilter } from "@/ops/board";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function tabHref(filter: BoardFilter, tab: BoardFilter["tab"]): string {
  const params = new URLSearchParams({ tab, owner: filter.owner, route: filter.route ?? "" });
  if (filter.waiting) params.set("waiting", "1");
  return `/ops?${params.toString()}`;
}

// Shows the Applications board: open or closed applications, filtered by owner, route and waiting.
export default async function ApplicationsBoardPage({ searchParams }: PageProps<"/ops">) {
  const reviewer = await currentReviewer();
  if (!reviewer.ok) return <SignInAsReviewer />;
  const filter = boardFilterSchema.parse(await searchParams);
  const cards = filterBoard(await listBoardCards(await getAppDatabase()), filter, reviewer.user.id);
  const now = new Date();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
        <nav className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
          {(["open", "closed"] as const).map((tab) => (
            <Link
              key={tab}
              href={tabHref(filter, tab)}
              aria-current={filter.tab === tab ? "page" : undefined}
              className={cn("rounded-md px-3 py-1 capitalize", filter.tab === tab && "bg-background font-medium shadow-sm")}
            >
              {tab}
            </Link>
          ))}
        </nav>
      </div>

      <form className="flex flex-wrap items-center gap-3 text-sm">
        <input type="hidden" name="tab" value={filter.tab} />
        <NativeSelect name="owner" defaultValue={filter.owner} aria-label="Owner">
          <option value="anyone">Any owner</option>
          <option value="me">Mine</option>
          <option value="unassigned">Unassigned</option>
        </NativeSelect>
        <NativeSelect name="route" defaultValue={filter.route ?? ""} aria-label="Route">
          <option value="">Any route</option>
          <option value="self_disclosure">Self-disclosure form</option>
          <option value="verification_call">Verification call</option>
        </NativeSelect>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="waiting" value="1" defaultChecked={filter.waiting} />
          Waiting on the customer
        </label>
        <Button type="submit" size="sm" variant="outline">
          Apply
        </Button>
      </form>

      {cards.length === 0 ? (
        <p className="text-muted-foreground">No applications match.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <BoardCard key={card.id} card={card} now={now} />
          ))}
        </div>
      )}
    </>
  );
}
