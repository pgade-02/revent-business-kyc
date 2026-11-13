import { describe, expect, it } from "vitest";
import { reviewActionInput } from "@/kyc/review/review-action";

describe("reviewActionInput", () => {
  it("lets a reviewer approve with or without a note", () => {
    expect(reviewActionInput.parse({ action: "approve" })).toEqual({ action: "approve" });
    expect(reviewActionInput.parse({ action: "approve", reason: "" })).toEqual({ action: "approve", reason: undefined });
    expect(reviewActionInput.parse({ action: "approve", reason: "All checks clear." })).toEqual({ action: "approve", reason: "All checks clear." });
  });

  it("refuses a reject without a reason, including one that is only spaces", () => {
    expect(reviewActionInput.safeParse({ action: "reject" }).success).toBe(false);
    expect(reviewActionInput.safeParse({ action: "reject", reason: "   " }).success).toBe(false);
    expect(reviewActionInput.parse({ action: "reject", reason: " Income does not support the lease. " })).toEqual({ action: "reject", reason: "Income does not support the lease." });
  });

  it("needs a real document box and a reason to request a document", () => {
    expect(reviewActionInput.safeParse({ action: "request_document", reason: "Cut off." }).success).toBe(false);
    expect(reviewActionInput.safeParse({ action: "request_document", slot: "selfie", reason: "Cut off." }).success).toBe(false);
    expect(reviewActionInput.parse({ action: "request_document", slot: "passport", reason: "Cut off." })).toMatchObject({ slot: "passport" });
  });

  it("knows no action that lets the system decide on its own", () => {
    expect(reviewActionInput.safeParse({ action: "auto_approve" }).success).toBe(false);
  });
});
