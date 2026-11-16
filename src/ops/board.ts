import { z } from "zod";
import { isOpen, type ApplicationStage } from "./stages";

export type BoardCard = {
  id: number;
  reference: string | null;
  stage: ApplicationStage;
  stageChangedAt: string | null;
  companyName: string | null;
  route: "self_disclosure" | "verification_call";
  term: number;
  planMonthlyFils: number;
  itemCount: number;
  toReviewCount: number;
  ownerId: string | null;
  ownerName: string | null;
};

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

// Reads the board's filters from the page address; anything unknown falls back to the default.
export const boardFilterSchema = z.object({
  tab: z.enum(["open", "closed"]).catch("open"),
  owner: z.enum(["anyone", "me", "unassigned"]).catch("anyone"),
  route: z.preprocess(emptyToUndefined, z.enum(["self_disclosure", "verification_call"]).optional()).catch(undefined),
  waiting: z.preprocess((value) => value === "1", z.boolean()),
});
export type BoardFilter = z.infer<typeof boardFilterSchema>;

function matchesOwner(card: BoardCard, owner: BoardFilter["owner"], viewerId: string): boolean {
  if (owner === "me") return card.ownerId === viewerId;
  if (owner === "unassigned") return card.ownerId === null;
  return true;
}

// Keeps the cards that match the filter, longest waiting first.
export function filterBoard(cards: readonly BoardCard[], filter: BoardFilter, viewerId: string): BoardCard[] {
  return cards
    .filter((card) => card.stage !== "draft")
    .filter((card) => isOpen(card.stage) === (filter.tab === "open"))
    .filter((card) => matchesOwner(card, filter.owner, viewerId))
    .filter((card) => !filter.route || card.route === filter.route)
    .filter((card) => !filter.waiting || card.stage === "waiting_on_customer")
    .sort((a, b) => (a.stageChangedAt ?? "").localeCompare(b.stageChangedAt ?? ""));
}

// Says how long a card has been in its stage, in the largest whole unit.
export function waitingFor(since: string, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / 60_000));
  const [count, unit] = minutes >= 1440 ? [Math.floor(minutes / 1440), "day"] : minutes >= 60 ? [Math.floor(minutes / 60), "hour"] : [minutes, "minute"];
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}
