import { describe, expect, it } from "vitest";
import { checkEidDates } from "@/kyc/checks/eid-dates";
import { checkMrzCheckDigits } from "@/kyc/checks/mrz-check-digits";
import { emiratesIdMrzValues, findEmiratesIdMrz } from "@/kyc/extraction/emirates-id-mrz";
import { saraHaddad } from "../../fixtures/realistic/companies";
import { emiratesIdMrz } from "../../fixtures/realistic/mrz";

// Synthetic specimen card only (fictional person, "UTO" nationality).
const field = (value: string) => ({ value, page: 1, confidenceBps: 9_500 });
const today = "2026-11-13";
const [line1, line2, line3] = emiratesIdMrz(saraHaddad);
const ocrText = `Card Number 148217362\nOccupation: General Manager\n${line1}\n${line2}\n${line3}`;

describe("EID_DATES", () => {
  const base = { documentId: "doc_test", today };

  it("passes when issued before today and before expiry", () => {
    expect(checkEidDates({ ...base, issueDate: field("2025-04-30"), expiryDate: field("2027-04-29") }).status).toBe("pass");
  });

  it("fails without a customer message when the issue date is in the future", () => {
    const result = checkEidDates({ ...base, issueDate: field("2026-12-01"), expiryDate: field("2028-11-30") });
    expect(result.status).toBe("fail");
    expect(result.customerMessageKey).toBeUndefined();
  });

  it("fails when the issue date is on or after the expiry date", () => {
    expect(checkEidDates({ ...base, issueDate: field("2025-04-30"), expiryDate: field("2025-04-30") }).status).toBe("fail");
    expect(checkEidDates({ ...base, issueDate: field("2026-01-10"), expiryDate: field("2025-01-10") }).status).toBe("fail");
  });

  it("is skipped when no issue date was read, or it is not a real date", () => {
    expect(checkEidDates({ ...base, issueDate: undefined, expiryDate: field("2027-04-29") }).status).toBe("skipped");
    expect(checkEidDates({ ...base, issueDate: field("2025-02-30"), expiryDate: undefined }).status).toBe("skipped");
  });
});

describe("Emirates ID machine-readable lines", () => {
  it("are found in OCR text even when spaced out, and give ID number, expiry, birth date, nationality and name", () => {
    const spaced = ocrText.replace(line1, line1.split("").join(" "));
    const mrz = findEmiratesIdMrz(spaced);
    expect(mrz).not.toBeNull();
    if (mrz)
      expect(emiratesIdMrzValues(mrz, today)).toEqual({
        emiratesIdNumber: saraHaddad.emiratesId,
        expiryDate: saraHaddad.emiratesIdExpires,
        dateOfBirth: saraHaddad.birthDate,
        nationality: "UTO",
        fullName: `${saraHaddad.givenNames} ${saraHaddad.surname}`,
      });
  });

  it("tolerate OCR reading the filler one character too long or short, as seen on real reads", () => {
    for (const filler of ["<<<<<<<<<<<<", "<<<<<<<<<<"]) {
      const misread = ocrText.replace(line2, line2.replace("<<<<<<<<<<<", filler));
      const mrz = findEmiratesIdMrz(misread);
      expect(mrz?.line2).toBe(line2);
    }
  });

  it("are not found on a page without them", () => {
    expect(findEmiratesIdMrz("UNITED ARAB EMIRATES 784-1988-4821736-2")).toBeNull();
  });
});

describe("MRZ_CHECK_DIGITS", () => {
  const found = (text: string) => {
    const mrz = findEmiratesIdMrz(text);
    return mrz ? { mrz, page: 1 } : null;
  };

  it("passes a genuine specimen card", () => {
    expect(checkMrzCheckDigits("doc_test", found(ocrText)).status).toBe("pass");
  });

  it("fails with a customer message when one expiry digit is changed, naming the part but not the value", () => {
    const edited = line2.slice(0, 9) + (line2[9] === "9" ? "8" : "9") + line2.slice(10);
    const result = checkMrzCheckDigits("doc_test", found(ocrText.replace(line2, edited)));
    expect(result.status).toBe("fail");
    expect(result.customerMessageKey).toBe("Checks.MRZ_CHECK_DIGITS");
    expect(result.detail).toContain("expiry date");
    expect(result.detail).toContain("misread or the card was edited");
    expect(result.detail).not.toMatch(/\d{6}/);
  });

  it("is skipped when there are no machine-readable lines", () => {
    expect(checkMrzCheckDigits("doc_test", null).status).toBe("skipped");
  });
});
