import { describe, expect, it } from "vitest";
import { fitTrailingFiller } from "@/kyc/extraction/mrz-filler";

describe("fitTrailingFiller", () => {
  it("fits only the trailing filler, keeping the data exactly as read", () => {
    expect(fitTrailingFiller("123456789012<", 14)).toBe("123456789012<<");
    expect(fitTrailingFiller("123456789012<<<", 14)).toBe("123456789012<<");
    expect(fitTrailingFiller("<<<<<<<<<<<<", 11)).toBe("<<<<<<<<<<<");
    expect(fitTrailingFiller("AB<CD<<", 11)).toBe("AB<CD<<<<<<");
  });

  it("refuses data longer than the field: that is a misread, not a filler problem", () => {
    expect(fitTrailingFiller("123456789012345", 14)).toBeNull();
  });
});
