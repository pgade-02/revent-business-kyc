import { describe, expect, it } from "vitest";
import { taskStatus, tasksForRoute, uploadTaskStatus } from "@/kyc/documents/kyc-tasks";

const businessSlots = ["trade_licence", "tax_certificate", "bank_statement"] as const;

describe("tasksForRoute", () => {
  it("has 5 tasks for a self-disclosure plan and 4 for a verification-call plan", () => {
    expect(tasksForRoute("self_disclosure")).toHaveLength(5);
    expect(tasksForRoute("verification_call")).toEqual(["account", "company", "documents", "signatory"]);
  });
});

describe("uploadTaskStatus", () => {
  it("is not started with no files, in progress with some, completed with all", () => {
    expect(uploadTaskStatus(businessSlots, [])).toBe("not_started");
    expect(uploadTaskStatus(businessSlots, [{ slot: "trade_licence", status: "ready" }])).toBe("in_progress");
    expect(
      uploadTaskStatus(businessSlots, [
        { slot: "trade_licence", status: "ready" },
        { slot: "tax_certificate", status: "needs_review" },
        { slot: "bank_statement", status: "ready" },
      ]),
    ).toBe("completed");
  });

  it("shows a needed fix before anything else, and ignores other tasks' files", () => {
    expect(uploadTaskStatus(businessSlots, [{ slot: "bank_statement", status: "needs_fix" }])).toBe("needs_fix");
    expect(uploadTaskStatus(businessSlots, [{ slot: "passport", status: "needs_fix" }])).toBe("not_started");
  });
});

describe("taskStatus", () => {
  it("marks the pre-filled account as completed", () => {
    expect(taskStatus("account", [])).toBe("completed");
  });
});
