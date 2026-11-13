import { describe, expect, it } from "vitest";
import { checkDobMatch } from "@/kyc/checks/dob-match";
import { checkNationalityMatch } from "@/kyc/checks/nationality-match";
import type { ReadValue } from "@/kyc/checks/read-value";
import { mrzBirthToIso, mrzCountry } from "@/kyc/extraction/mrz-date";

const onPassport = (value: string): ReadValue => ({ documentId: "doc_passport", slot: "passport", field: { value, page: 1, confidenceBps: 10_000 } });
const onEidBack = (value: string): ReadValue => ({ documentId: "doc_eid_back", slot: "emirates_id_back", field: { value, page: 1, confidenceBps: 10_000 } });

describe("dates and country codes from the machine-readable lines", () => {
  it("puts a birth date in the past century when this century would be in the future", () => {
    expect(mrzBirthToIso("880412", "2026-11-14")).toBe("1988-04-12");
    expect(mrzBirthToIso("100101", "2026-11-14")).toBe("2010-01-01");
    expect(mrzBirthToIso("261115", "2026-11-14")).toBe("1926-11-15");
  });

  it("drops the filler from short country codes", () => {
    expect(mrzCountry("D<<")).toBe("D");
    expect(mrzCountry("UTO")).toBe("UTO");
  });
});

describe("DOB_MATCH", () => {
  it("passes when both documents give the same date", () => {
    expect(checkDobMatch({ passport: onPassport("1988-04-12"), emiratesIdBack: onEidBack("1988-04-12") }).status).toBe("pass");
  });

  it("warns without repeating the dates, and points the reviewer to the passport", () => {
    const result = checkDobMatch({ passport: onPassport("1988-04-12"), emiratesIdBack: onEidBack("1990-01-01") });
    expect(result.status).toBe("warn");
    expect(result.evidence).toEqual({ documentId: "doc_passport", page: 1 });
    expect(result.detail).toContain("Emirates ID back");
    expect(result.detail).not.toMatch(/\d{4}/);
    expect(result.customerMessageKey).toBeUndefined();
  });

  it("is skipped when either date was not read", () => {
    expect(checkDobMatch({ passport: onPassport("1988-04-12"), emiratesIdBack: null }).status).toBe("skipped");
  });
});

describe("NATIONALITY_MATCH", () => {
  it("passes on the same code and warns on a different one, without naming either", () => {
    expect(checkNationalityMatch({ passport: onPassport("UTO"), emiratesIdBack: onEidBack("UTO") }).status).toBe("pass");
    const result = checkNationalityMatch({ passport: onPassport("UTO"), emiratesIdBack: onEidBack("GBR") });
    expect(result.status).toBe("warn");
    expect(result.detail).not.toMatch(/UTO|GBR/);
  });

  it("is skipped when either code was not read", () => {
    expect(checkNationalityMatch({ passport: null, emiratesIdBack: onEidBack("UTO") }).status).toBe("skipped");
  });
});
