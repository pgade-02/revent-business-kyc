import { describe, expect, it } from "vitest";
import { signatoryDetailsSchema } from "@/kyc/signatory/signatory-details";

// Fictional signatory (tests/fixtures/realistic/companies.ts).
const valid = { isApplicant: false, fullName: " Sara Demo Haddad ", signingEmail: "Sara@Falcon-Demo.example", mobile: "050 123 4567" };

describe("signatory details", () => {
  it("trims the name, lower-cases the email and stores the mobile as +9715…", () => {
    expect(signatoryDetailsSchema.parse(valid)).toEqual({
      isApplicant: false,
      fullName: "Sara Demo Haddad",
      signingEmail: "sara@falcon-demo.example",
      mobile: "+971501234567",
    });
  });

  it("accepts the usual ways of typing a UAE mobile", () => {
    for (const mobile of ["0501234567", "501234567", "+971 50 123 4567", "00971-50-123-4567"]) {
      expect(signatoryDetailsSchema.parse({ ...valid, mobile }).mobile).toBe("+971501234567");
    }
  });

  it("treats the mobile as optional, and refuses a non-UAE or landline number", () => {
    expect(signatoryDetailsSchema.parse({ ...valid, mobile: "" }).mobile).toBeNull();
    expect(signatoryDetailsSchema.parse({ ...valid, mobile: undefined }).mobile).toBeNull();
    expect(signatoryDetailsSchema.safeParse({ ...valid, mobile: "04 123 4567" }).success).toBe(false);
    expect(signatoryDetailsSchema.safeParse({ ...valid, mobile: "+44 7700 900123" }).success).toBe(false);
  });

  it("refuses a missing name or an invalid email", () => {
    expect(signatoryDetailsSchema.safeParse({ ...valid, fullName: " " }).success).toBe(false);
    expect(signatoryDetailsSchema.safeParse({ ...valid, signingEmail: "sara@" }).success).toBe(false);
  });
});
