import { describe, expect, it } from "vitest";
import { companyDetailsSchema } from "@/kyc/company/company-details";

// Fictional company (tests/fixtures/realistic/companies.ts).
const valid = {
  companyName: "  Falcon Demo Trading L.L.C. ",
  licenceNumber: "CN-4729183",
  yearEstablished: "2019",
  issuingAuthority: "Emirate Economic Registry (Specimen)",
  emirate: "dubai",
  legalForm: "llc",
  trn: "100-4729-1830-0003",
  registeredAddress: "Office 1204, Specimen Tower, Business Bay, Dubai",
  deliverToRegisteredAddress: true,
};
const schema = companyDetailsSchema(2026);

describe("company details", () => {
  it("accepts a complete form, trims text, and keeps only the TRN's 15 digits", () => {
    const parsed = schema.parse(valid);
    expect(parsed.companyName).toBe("Falcon Demo Trading L.L.C.");
    expect(parsed.yearEstablished).toBe(2019);
    expect(parsed.trn).toBe("100472918300003");
  });

  it("treats an empty or missing TRN as not given, because it is optional", () => {
    expect(schema.parse({ ...valid, trn: "" }).trn).toBeNull();
    expect(schema.parse({ ...valid, trn: undefined }).trn).toBeNull();
  });

  it("refuses a TRN that is not 15 digits", () => {
    expect(schema.safeParse({ ...valid, trn: "12345" }).success).toBe(false);
  });

  it("refuses a year in the future or before 1900, and blank required fields", () => {
    expect(schema.safeParse({ ...valid, yearEstablished: "2027" }).success).toBe(false);
    expect(schema.safeParse({ ...valid, yearEstablished: "1899" }).success).toBe(false);
    expect(schema.safeParse({ ...valid, companyName: "   " }).success).toBe(false);
    expect(schema.safeParse({ ...valid, emirate: "atlantis" }).success).toBe(false);
  });
});
