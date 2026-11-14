import { describe, expect, it } from "vitest";
import { checkLabel } from "@/components/team/check-labels";

describe("checkLabel", () => {
  it("names the problem when a check fails, never the passing wording", () => {
    expect(checkLabel("DOC_EXPIRED", "fail")).toBe("Expired");
    expect(checkLabel("DOC_EXPIRED", "pass")).toBe("Not expired");
    expect(checkLabel("STMT_BALANCE", "warn")).toBe("Balances do not add up");
  });

  it("names the topic when a check could not run", () => {
    expect(checkLabel("PASSPORT_MRZ", "skipped")).toBe("Passport code lines");
  });
});
