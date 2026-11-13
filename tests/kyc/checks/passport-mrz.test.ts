import { describe, expect, it } from "vitest";
import { checkPassportMrz } from "@/kyc/checks/passport-mrz";
import { findPassportMrz, passportMrzExpiryDate } from "@/kyc/extraction/passport-mrz";
import { saraHaddad } from "../../fixtures/realistic/companies";
import { passportMrz } from "../../fixtures/realistic/mrz";

// Synthetic specimen passport only (fictional person, "UTO" nationality).
const [line1, line2] = passportMrz(saraHaddad);
const ocrText = `PASSPORT\nSurname: HADDAD\n${line1}\n${line2}`;

const found = (text: string) => {
  const mrz = findPassportMrz(text);
  return mrz ? { mrz, page: 1 } : null;
};

const replaceAt = (line: string, index: number, character: string) => line.slice(0, index) + character + line.slice(index + 1);
const otherDigit = (digit: string | undefined) => (digit === "9" ? "8" : "9");

describe("Passport machine-readable lines", () => {
  it("are found in OCR text even when spaced out, and give the expiry date", () => {
    const mrz = findPassportMrz(ocrText.replace(line2, line2.split("").join(" ")));
    expect(mrz?.line2).toBe(line2);
    if (mrz) expect(passportMrzExpiryDate(mrz)).toBe(saraHaddad.passportExpires);
  });

  it("tolerate OCR reading the filler one character too long or short", () => {
    for (const filler of ["<<<<<<<<<<<<<<<", "<<<<<<<<<<<<<"]) {
      expect(findPassportMrz(ocrText.replace(line2, line2.replace("<<<<<<<<<<<<<<", filler)))?.line2).toBe(line2);
    }
  });

  it("are not found on a page without them", () => {
    expect(findPassportMrz("PASSPORT\nSurname: HADDAD")).toBeNull();
  });
});

describe("PASSPORT_MRZ", () => {
  it("passes a genuine specimen passport", () => {
    expect(checkPassportMrz("doc_test", found(ocrText)).status).toBe("pass");
  });

  it("accepts '<' as the check digit of empty optional data", () => {
    const withFillerCheck = replaceAt(line2, 42, "<");
    expect(checkPassportMrz("doc_test", found(ocrText.replace(line2, withFillerCheck))).status).toBe("pass");
  });

  it("fails with a customer message when one birth-date digit is changed, naming the part but not the value", () => {
    const edited = replaceAt(line2, 18, otherDigit(line2[18]));
    const result = checkPassportMrz("doc_test", found(ocrText.replace(line2, edited)));
    expect(result.status).toBe("fail");
    expect(result.customerMessageKey).toBe("Checks.PASSPORT_MRZ");
    expect(result.detail).toBe("Check digit wrong for: date of birth, whole line.");
  });

  it("names the passport number when a character of it is changed", () => {
    const edited = replaceAt(line2, 2, line2[2] === "A" ? "B" : "A");
    expect(checkPassportMrz("doc_test", found(ocrText.replace(line2, edited))).detail).toContain("passport number");
  });

  it("is skipped when there are no machine-readable lines", () => {
    expect(checkPassportMrz("doc_test", null).status).toBe("skipped");
  });
});
