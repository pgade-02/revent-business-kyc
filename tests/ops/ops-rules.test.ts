import { describe, expect, it } from "vitest";
import { infoRequestSchema } from "@/ops/info-requests";
import { applicationReference, isApplicationReference } from "@/ops/reference";
import { canMoveTo, isOpen } from "@/ops/stages";

describe("stages", () => {
  it("lets an open application move on and a closed one only reopen", () => {
    expect(canMoveTo("submitted", "in_review")).toBe(true);
    expect(canMoveTo("waiting_on_customer", "in_review")).toBe(true);
    expect(canMoveTo("approved", "rejected")).toBe(false);
    expect(canMoveTo("approved", "in_review")).toBe(true);
  });

  it("never moves a draft or back to draft or submitted", () => {
    expect(canMoveTo("draft", "submitted")).toBe(false);
    expect(canMoveTo("in_review", "draft")).toBe(false);
    expect(canMoveTo("in_review", "submitted")).toBe(false);
  });

  it("counts approved and rejected as closed", () => {
    expect(isOpen("waiting_on_customer")).toBe(true);
    expect(isOpen("approved")).toBe(false);
    expect(isOpen("rejected")).toBe(false);
  });
});

describe("applicationReference", () => {
  it("builds RB, the two-digit year and six characters", () => {
    expect(applicationReference("2026-11-13T08:00:00.000Z", () => 0)).toBe("RB-26-AAAAAA");
    expect(applicationReference("2027-01-02T08:00:00.000Z", (size) => size - 1)).toBe("RB-27-999999");
  });

  it("never uses the confusable 0, O, 1 or I", () => {
    expect(isApplicationReference("RB-26-JU2XWY")).toBe(true);
    for (const bad of ["RB-26-JU0XWY", "RB-26-JUOXWY", "RB-26-JU1XWY", "RB-26-JUIXWY", "RB-26-JU2XW"]) {
      expect(isApplicationReference(bad)).toBe(false);
    }
  });
});

describe("infoRequestSchema", () => {
  it("accepts a request with at least one item", () => {
    expect(infoRequestSchema.safeParse({ items: [{ subject: "passport", reason: "expired" }] }).success).toBe(true);
  });

  it("refuses an empty request, an unknown subject or a long note", () => {
    expect(infoRequestSchema.safeParse({ items: [] }).success).toBe(false);
    expect(infoRequestSchema.safeParse({ items: [{ subject: "selfie", reason: "expired" }] }).success).toBe(false);
    expect(infoRequestSchema.safeParse({ items: [{ subject: "passport", reason: "other", note: "x".repeat(501) }] }).success).toBe(false);
  });
});
