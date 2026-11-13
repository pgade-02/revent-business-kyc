import { describe, expect, it } from "vitest";
import type { DocumentSlot } from "@/kyc/documents/slots";
import { checkLicenceNumber } from "@/kyc/checks/licence-number";
import { checkNameCompany } from "@/kyc/checks/name-company";
import type { ReadValue } from "@/kyc/checks/read-value";
import { checkTrnNumber } from "@/kyc/checks/trn-number";

// Invented company and numbers.
const read = (slot: DocumentSlot, value: string, documentId: string = slot): ReadValue => ({
  documentId,
  slot,
  field: { value, page: 1, confidenceBps: 9_500 },
});

describe("LICENCE_NUMBER", () => {
  it("passes when the typed number matches, ignoring dashes", () => {
    expect(
      checkLicenceNumber({
        typed: "1048372",
        onLicence: read("trade_licence", "1048-372"),
      }),
    ).toMatchObject({ status: "pass" });
  });

  it("warns when they differ, without repeating either number", () => {
    const result = checkLicenceNumber({
      typed: "1048372",
      onLicence: read("trade_licence", "1048373"),
    });
    expect(result).toMatchObject({
      status: "warn",
      evidence: { documentId: "trade_licence", page: 1 },
    });
    expect(result.detail).not.toContain("1048");
  });

  it("is skipped, never passed, when the licence number was not read", () => {
    expect(checkLicenceNumber({ typed: "1048372", onLicence: null })).toMatchObject({ status: "skipped" });
  });
});

describe("TRN_NUMBER", () => {
  it("is skipped when no TRN was typed (the field is optional)", () => {
    expect(
      checkTrnNumber({
        typed: null,
        onCertificate: read("tax_certificate", "100234567800003"),
      }),
    ).toMatchObject({
      status: "skipped",
      detail: "No TRN was typed in Company details.",
    });
  });

  it("passes on the same TRN printed with spaces", () => {
    expect(
      checkTrnNumber({
        typed: "100234567800003",
        onCertificate: read("tax_certificate", "100 2345 6780 0003"),
      }),
    ).toMatchObject({
      status: "pass",
    });
  });

  it("warns on a different TRN", () => {
    expect(
      checkTrnNumber({
        typed: "100234567800003",
        onCertificate: read("tax_certificate", "100234567800004"),
      }),
    ).toMatchObject({
      status: "warn",
    });
  });
});

describe("NAME_COMPANY", () => {
  const typed = "Falcon Trading LLC";

  it("passes when every document names the same company", () => {
    const result = checkNameCompany({
      typed,
      onDocuments: [
        read("trade_licence", "FALCON TRADING L.L.C."),
        read("tax_certificate", "Falcon Trading"),
        read("bank_statement", "FALCON TRADING LLC"),
      ],
    });
    expect(result).toMatchObject({
      status: "pass",
      detail: "Company name matches on: Trade licence, Tax certificate, Bank statement.",
    });
  });

  it("warns and lists every document that names another company", () => {
    const result = checkNameCompany({
      typed,
      onDocuments: [read("trade_licence", "Falcon Trading LLC"), read("bank_statement", "HORIZON TECH FZ-LLC", "statement-3")],
    });
    expect(result).toMatchObject({
      status: "warn",
      evidence: { documentId: "statement-3", page: 1 },
    });
    expect(result.detail).toContain('Bank statement "HORIZON TECH FZ-LLC"');
  });

  it("does not warn about a name printed only in Arabic", () => {
    const result = checkNameCompany({
      typed,
      onDocuments: [read("trade_licence", "فالكون للتجارة"), read("tax_certificate", "Falcon Trading")],
    });
    expect(result).toMatchObject({
      status: "pass",
      detail: "Company name matches on: Tax certificate.",
    });
  });

  it("is skipped when no name could be compared", () => {
    expect(
      checkNameCompany({
        typed,
        onDocuments: [read("trade_licence", "فالكون للتجارة")],
      }),
    ).toMatchObject({ status: "skipped" });
    expect(checkNameCompany({ typed, onDocuments: [] })).toMatchObject({
      status: "skipped",
    });
  });
});
