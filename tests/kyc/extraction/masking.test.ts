import { describe, expect, it } from "vitest";
import { maskText, unmask } from "@/kyc/extraction/masking";
import { syntheticTexts } from "../../fixtures/synthetic-documents";

describe("maskText", () => {
  it("hides Emirates ID numbers, IBANs and TRNs, and keeps the labels", () => {
    const { text } = maskText(
      ["ID Number: 784-1990-0000000-1", "IBAN: AE070331234567890123456", "TRN: 100000000000003"].join("\n"),
    );
    expect(text).toBe(["ID Number: [[EID_1]]", "IBAN: [[IBAN_1]]", "TRN: [[TRN_1]]"].join("\n"));
  });

  it("hides whole machine-readable passport lines and the printed passport number", () => {
    const { text } = maskText(syntheticTexts.passport("2031-08-14"));
    expect(text).not.toContain("X1234567");
    expect(text).not.toContain("P<GBR");
    expect(text).toContain("Passport No: [[PASSPORT_1]]");
    expect(text).toContain("Date of Expiry: 2031-08-14"); // dates are not personal numbers
  });

  it("hides card and account numbers", () => {
    const { text } = maskText("Card: 4111 1111 1111 1111\nAccount: 0123456789012");
    expect(text).toBe("Card: [[CARD_1]]\nAccount: [[ACCOUNT_1]]");
  });

  it("gives the same number the same placeholder", () => {
    const { text, originals } = maskText("TRN 100000000000003 and again 100000000000003");
    expect(text).toBe("TRN [[TRN_1]] and again [[TRN_1]]");
    expect(originals.size).toBe(1);
  });
});

describe("unmask", () => {
  it("puts the real values back and leaves unknown placeholders alone", () => {
    const { originals } = maskText("ID Number: 784-1990-0000000-1");
    expect(unmask("[[EID_1]]", originals)).toBe("784-1990-0000000-1");
    expect(unmask("[[EID_9]]", originals)).toBe("[[EID_9]]");
  });
});
