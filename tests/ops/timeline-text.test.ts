import { describe, expect, it } from "vitest";
import { describeEvent } from "@/components/ops/timeline-text";

const names = new Map([["seed-reviewer", "Demo Reviewer"]]);

describe("describeEvent", () => {
  it("names documents, stages and reviewers in plain words", () => {
    expect(describeEvent("document_uploaded", { slot: "passport" }, names)).toBe("Uploaded Passport");
    expect(describeEvent("stage_changed", { from: "submitted", to: "in_review" }, names)).toBe("Moved from Submitted to In review");
    expect(describeEvent("owner_changed", { ownerId: "seed-reviewer" }, names)).toBe("Assigned to Demo Reviewer");
    expect(describeEvent("owner_changed", { ownerId: null }, names)).toBe("Removed the owner");
    expect(describeEvent("document_reviewed", { slot: "trade_licence", state: "rejected" }, names)).toBe("Rejected Trade licence");
    expect(describeEvent("information_requested", { subjects: ["passport", "company_details"] }, names)).toBe("Asked for Passport, Company details");
    expect(describeEvent("information_provided", { subject: "passport" }, names)).toBe("Answered the request for Passport");
  });

  it("falls back to general words for values it does not know", () => {
    expect(describeEvent("document_uploaded", { slot: "fax" }, names)).toBe("Uploaded an item");
    expect(describeEvent("stage_changed", {}, names)).toBe("Moved from another stage to another stage");
    expect(describeEvent("owner_changed", { ownerId: "someone-new" }, names)).toBe("Assigned to a reviewer");
  });
});
