import { describe, expect, it } from "vitest";
import { boardFilterSchema, filterBoard, waitingFor, type BoardCard } from "@/ops/board";

const card = (id: number, overrides: Partial<BoardCard>): BoardCard => ({
  id,
  reference: `RB-26-AAAAA${id}`,
  stage: "submitted",
  stageChangedAt: "2026-11-10T08:00:00.000Z",
  submittedAt: "2026-11-10T08:00:00.000Z",
  companyName: null,
  route: "verification_call",
  term: 36,
  planMonthlyFils: 10_000,
  itemCount: 1,
  toReviewCount: 0,
  ownerId: null,
  ownerName: null,
  ...overrides,
});

const cards = [
  card(1, { stage: "in_review", ownerId: "me", submittedAt: "2026-11-12T08:00:00.000Z" }),
  card(2, { stage: "waiting_on_customer", route: "self_disclosure", submittedAt: "2026-11-09T08:00:00.000Z" }),
  card(3, { stage: "approved" }),
  card(4, { stage: "submitted", ownerId: "someone-else", submittedAt: "2026-11-11T08:00:00.000Z" }),
];
const ids = (filter: Record<string, string>) => filterBoard(cards, boardFilterSchema.parse(filter), "me").map((found) => found.id);

describe("filterBoard", () => {
  it("shows open applications by default, newest first", () => {
    expect(ids({})).toEqual([1, 4, 2]);
  });

  it("shows only closed applications on the Closed tab", () => {
    expect(ids({ tab: "closed" })).toEqual([3]);
  });

  it("filters by owner, route and waiting on the customer", () => {
    expect(ids({ owner: "me" })).toEqual([1]);
    expect(ids({ owner: "unassigned" })).toEqual([2]);
    expect(ids({ route: "self_disclosure" })).toEqual([2]);
    expect(ids({ waiting: "1" })).toEqual([2]);
  });

  it("falls back to the defaults for unknown values in the address", () => {
    expect(boardFilterSchema.parse({ tab: "archived", owner: "x", route: "fax", waiting: "yes" })).toEqual({
      tab: "open",
      owner: "anyone",
      route: undefined,
      waiting: false,
    });
  });
});

describe("waitingFor", () => {
  const now = new Date("2026-11-16T10:00:00.000Z");
  it("uses the largest whole unit", () => {
    expect(waitingFor("2026-11-16T09:59:00.000Z", now)).toBe("1 minute");
    expect(waitingFor("2026-11-16T07:30:00.000Z", now)).toBe("2 hours");
    expect(waitingFor("2026-11-13T09:00:00.000Z", now)).toBe("3 days");
  });
});
