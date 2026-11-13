import { describe, expect, it } from "vitest";
import type { DocumentSlot } from "@/kyc/documents/slots";
import { blockerTask, submitBlockers } from "@/kyc/submit/submit-blockers";

const allSlots: DocumentSlot[] = ["trade_licence", "tax_certificate", "bank_statement", "passport", "emirates_id_front", "emirates_id_back", "self_disclosure"];
const ready = (slots: DocumentSlot[], status = "ready") => slots.map((slot) => ({ slot, status }));
const complete = { files: ready(allSlots), companyDetailsSaved: true, signatoryDetailsSaved: true };

describe("submitBlockers", () => {
  it("has nothing blocking when every file and both forms are in", () => {
    expect(submitBlockers({ route: "self_disclosure", ...complete })).toEqual([]);
  });

  it("lists every empty box and unsaved form on a new application", () => {
    expect(submitBlockers({ route: "self_disclosure", files: [], companyDetailsSaved: false, signatoryDetailsSaved: false })).toEqual([
      "company_details",
      "signatory_details",
      ...allSlots,
    ]);
  });

  it("does not ask for the self-disclosure form on a verification-call plan", () => {
    const files = ready(allSlots.filter((slot) => slot !== "self_disclosure"));
    expect(submitBlockers({ route: "verification_call", ...complete, files })).toEqual([]);
    expect(submitBlockers({ route: "self_disclosure", ...complete, files })).toEqual(["self_disclosure"]);
  });

  it("lets a file that needs a fix through, because a failed check never blocks Submit", () => {
    const files = [...ready(allSlots.filter((slot) => slot !== "passport")), { slot: "passport" as const, status: "needs_fix" }];
    expect(submitBlockers({ route: "self_disclosure", ...complete, files })).toEqual([]);
  });

  it("blocks on an unsaved signatory form even when its documents are uploaded", () => {
    expect(submitBlockers({ route: "self_disclosure", ...complete, signatoryDetailsSaved: false })).toEqual(["signatory_details"]);
  });
});

describe("blockerTask", () => {
  it("points each blocker at the task where it is fixed", () => {
    expect(blockerTask("company_details")).toBe("company");
    expect(blockerTask("signatory_details")).toBe("signatory");
    expect(blockerTask("bank_statement")).toBe("documents");
    expect(blockerTask("emirates_id_back")).toBe("signatory");
    expect(blockerTask("self_disclosure")).toBe("self_disclosure");
  });
});
