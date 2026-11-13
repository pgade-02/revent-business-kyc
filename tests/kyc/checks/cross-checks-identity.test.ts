import { describe, expect, it } from "vitest";
import { checkEidEmployer } from "@/kyc/checks/eid-employer";
import { checkEidSidesMatch, type EidSide } from "@/kyc/checks/eid-sides-match";
import { checkEmirateMatch } from "@/kyc/checks/emirate-match";
import { checkNameSignatory } from "@/kyc/checks/name-signatory";
import type { ReadValue } from "@/kyc/checks/read-value";
import type { DocumentSlot } from "@/kyc/documents/slots";

// Invented people, companies and numbers.
const cutoffs = { matchBps: 9_500, possibleMatchBps: 8_500 };
const read = (slot: DocumentSlot, value: string): ReadValue => ({ documentId: slot, slot, field: { value, page: 1, confidenceBps: 9_500 } });
const managers = (...names: string[]) => ({ documentId: "trade_licence", field: { value: names, page: 1, confidenceBps: 9_500 } });

describe("EMIRATE_MATCH", () => {
  it("passes however the licence prints the emirate", () => {
    expect(checkEmirateMatch({ typed: "abu_dhabi", onLicence: read("trade_licence", "ABU DHABI") }).status).toBe("pass");
    expect(checkEmirateMatch({ typed: "umm_al_quwain", onLicence: read("trade_licence", "Umm Al-Quwain") }).status).toBe("pass");
  });

  it("warns when the licence is from another emirate", () => {
    expect(checkEmirateMatch({ typed: "dubai", onLicence: read("trade_licence", "Sharjah") })).toMatchObject({ status: "warn", evidence: { documentId: "trade_licence" } });
  });

  it("is skipped when the printed emirate is not one it recognises", () => {
    expect(checkEmirateMatch({ typed: "dubai", onLicence: read("trade_licence", "Free Zone Authority") }).status).toBe("skipped");
  });
});

describe("EID_EMPLOYER", () => {
  it("passes when the employer is the company, ignoring the legal form", () => {
    expect(checkEidEmployer({ companyName: "Example Trading LLC", employer: read("emirates_id_back", "EXAMPLE TRADING L.L.C") }).status).toBe("pass");
  });

  it("warns on a different employer and is skipped when none is printed", () => {
    expect(checkEidEmployer({ companyName: "Example Trading LLC", employer: read("emirates_id_back", "Other Contracting LLC") }).status).toBe("warn");
    expect(checkEidEmployer({ companyName: "Example Trading LLC", employer: null }).status).toBe("skipped");
  });
});

describe("NAME_SIGNATORY", () => {
  const base = {
    typed: "Lina Example Rahal",
    passport: read("passport", "RAHAL LINA EXAMPLE"),
    emiratesIdFront: read("emirates_id_front", "Lina Example Rahal"),
    managers: managers("Lina Rahal", "Karim Sample"),
    cutoffs,
  };

  it("passes when every name agrees and the signatory is a manager", () => {
    expect(checkNameSignatory(base)).toMatchObject({ status: "pass", evidence: { documentId: "passport" } });
  });

  it("warns when the passport and Emirates ID names differ, without quoting either", () => {
    const result = checkNameSignatory({ ...base, emiratesIdFront: read("emirates_id_front", "Nadia Other Haddad") });
    expect(result.status).toBe("warn");
    expect(result.detail).toContain("Passport and the Emirates ID front differ");
    expect(result.detail).not.toMatch(/Nadia|Lina/);
  });

  it("warns that authority is not proven when the signatory is not a manager", () => {
    const result = checkNameSignatory({ ...base, managers: managers("Karim Sample") });
    expect(result.status).toBe("warn");
    expect(result.detail).toContain("authority not proven");
  });

  it("is skipped when fewer than two names can be compared", () => {
    expect(checkNameSignatory({ typed: "Lina Rahal", passport: null, emiratesIdFront: null, managers: null, cutoffs }).status).toBe("skipped");
  });
});

describe("EID_SIDES_MATCH", () => {
  const front: EidSide = {
    emiratesIdNumber: read("emirates_id_front", "784-1990-1234567-1"),
    expiryDate: read("emirates_id_front", "2028-02-20"),
    fullName: read("emirates_id_front", "Lina Example Rahal"),
  };
  const back: EidSide = {
    emiratesIdNumber: read("emirates_id_back", "784199012345671"),
    expiryDate: read("emirates_id_back", "2028-02-20"),
    fullName: read("emirates_id_back", "LINA EXAMPLE RAHAL"),
  };

  it("passes when both sides agree", () => {
    expect(checkEidSidesMatch({ front, back, cutoffs })).toMatchObject({ status: "pass", detail: "Front and back agree on: ID number, expiry date, name." });
  });

  it("warns naming the part that differs, never the value", () => {
    const result = checkEidSidesMatch({ front, back: { ...back, expiryDate: read("emirates_id_back", "2029-02-20") }, cutoffs });
    expect(result).toMatchObject({ status: "warn", detail: expect.stringContaining("expiry date") });
    expect(result.detail).not.toContain("2029");
  });

  it("is skipped when the back was not read", () => {
    expect(checkEidSidesMatch({ front, back: { emiratesIdNumber: null, expiryDate: null, fullName: null }, cutoffs }).status).toBe("skipped");
  });
});
