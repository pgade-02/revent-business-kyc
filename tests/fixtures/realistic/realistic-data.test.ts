import { describe, expect, it } from "vitest";
import { isUaeIban } from "@/kyc/checks/id-format";
import { companyA, saraHaddad } from "./companies";
import { uaeIban } from "./iban";
import { checkDigit, emiratesIdMrz, passportMrz } from "./mrz";
import { generateStatements, tamperWithStatement } from "./statements";

describe("MRZ check digits", () => {
  it("matches the worked example in ICAO 9303", () => {
    expect(checkDigit("L898902C3")).toBe("6");
    expect(checkDigit("740812")).toBe("2");
    expect(checkDigit("120415")).toBe("9");
  });

  it("builds a 2 × 44 passport MRZ and a 3 × 30 Emirates ID MRZ that our fingerprints recognise", () => {
    const passport = passportMrz(saraHaddad);
    expect(passport.map((line) => line.length)).toEqual([44, 44]);
    expect(passport[0]).toMatch(/^P<UTOHADDAD<<SARA<DEMO/);
    const card = emiratesIdMrz(saraHaddad);
    expect(card.map((line) => line.length)).toEqual([30, 30, 30]);
    expect(card[0]).toMatch(/^ILARE/);
  });
});

describe("IBAN", () => {
  it("produces a UAE IBAN that passes the real checksum check", () => {
    expect(isUaeIban(uaeIban(companyA.bank.bankCode, companyA.bank.accountNumber))).toBe(true);
  });
});

describe("statements", () => {
  const statements = generateStatements(companyA, ["2026-05", "2026-06", "2026-07"]);

  it("reconcile row by row, and each month opens with the previous closing balance", () => {
    for (const statement of statements) {
      let balance = statement.openingFils;
      for (const row of statement.rows) {
        balance = balance + row.creditFils - row.debitFils;
        expect(row.balanceFils).toBe(balance);
      }
      expect(statement.closingFils).toBe(balance);
    }
    expect(statements[1]?.openingFils).toBe(statements[0]?.closingFils);
  });

  it("carries the company's monthly income exactly", () => {
    const credits = statements[0]?.rows.reduce((total, row) => total + row.creditFils, 0);
    expect(credits).toBe(companyA.monthlyIncomeFils);
  });

  it("a tampered copy breaks the arithmetic on exactly one row", () => {
    const original = statements[0];
    if (!original) throw new Error("no statement");
    const tampered = tamperWithStatement(original, 3, 1_000_000);
    let balance = tampered.openingFils;
    const broken = tampered.rows.filter((row) => {
      balance = balance + row.creditFils - row.debitFils;
      const wrong = row.balanceFils !== balance;
      balance = row.balanceFils; // a reader continues from the printed balance
      return wrong;
    });
    expect(broken).toHaveLength(2); // the edited row, and the next row no longer follows from it
  });
});
