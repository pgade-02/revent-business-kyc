import { describe, expect, it } from "vitest";
import { checkIdFormat, isUaeIban } from "@/kyc/checks/id-format";

// Synthetic numbers only. The IBAN is the published example from the IBAN registry.
const field = (value: string, page = 1) => ({ value, page, confidenceBps: 9_500 });
const validIban = "AE070331234567890123456";
const base = { documentId: "doc_test" };

describe("isUaeIban", () => {
  it("accepts a valid UAE IBAN, with or without spaces", () => {
    expect(isUaeIban(validIban)).toBe(true);
    expect(isUaeIban("AE07 0331 2345 6789 0123 456")).toBe(true);
  });

  it("rejects a single changed digit (checksum), a wrong length, or another country", () => {
    expect(isUaeIban("AE070331234567890123457")).toBe(false);
    expect(isUaeIban("AE07033123456789012345")).toBe(false);
    expect(isUaeIban("GB070331234567890123456")).toBe(false);
  });
});

describe("ID_FORMAT", () => {
  it("passes well-formed numbers, including dashes as printed on an Emirates ID", () => {
    const result = checkIdFormat({
      ...base,
      emiratesId: field("784-1990-0000000-1"),
      trn: field("100000000000003"),
      iban: field(validIban),
    });
    expect(result.status).toBe("pass");
  });

  it("warns for each bad number, points at the first one's page, and never repeats the number", () => {
    const result = checkIdFormat({
      ...base,
      emiratesId: field("785199000000001", 2),
      trn: field("10000000000000", 3),
    });
    expect(result.status).toBe("warn");
    expect(result.evidence).toEqual({ documentId: "doc_test", page: 2 });
    expect(result.detail).toContain("Emirates ID");
    expect(result.detail).toContain("TRN");
    expect(result.detail).not.toContain("785199000000001");
    expect(result.customerMessageKey).toBeUndefined();
  });

  it("skips when the document has no ID numbers", () => {
    expect(checkIdFormat(base).status).toBe("skipped");
  });
});
