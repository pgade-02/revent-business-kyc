import { describe, expect, it } from "vitest";
import { compareTypedDetails, type TypedDetails } from "@/ops/typed-vs-document";

const cutoffs = { matchBps: 9_000, possibleMatchBps: 8_000 };
const read = (value: string) => ({ value, page: 1, confidenceBps: 9_500 });
const typed: TypedDetails = { companyName: "Example Trading LLC", licenceNumber: "123456", emirate: "dubai", trn: null, signatoryName: "Example Person" };

describe("compareTypedDetails", () => {
  it("marks details the documents agree with as the same", () => {
    const result = compareTypedDetails(
      typed,
      {
        trade_licence: { companyName: read("EXAMPLE TRADING L.L.C."), licenceNumber: read("123 456"), emirate: read("Dubai") },
        passport: { fullName: read("EXAMPLE PERSON") },
      },
      cutoffs,
    );
    expect(result.companyName.verdict).toBe("matches");
    expect(result.licenceNumber.verdict).toBe("matches");
    expect(result.emirate.verdict).toBe("matches");
    expect(result.signatoryName).toEqual({ verdict: "matches", reason: null, slot: "passport", documentValue: "EXAMPLE PERSON" });
  });

  it("shows what the document says when it differs", () => {
    const result = compareTypedDetails(typed, { trade_licence: { licenceNumber: read("999999"), emirate: read("Sharjah") } }, cutoffs);
    expect(result.licenceNumber).toEqual({ verdict: "different", reason: null, slot: "trade_licence", documentValue: "999999" });
    expect(result.emirate.verdict).toBe("different");
  });

  it("falls back to the Emirates ID when the passport name was not read", () => {
    const result = compareTypedDetails(typed, { emirates_id_front: { fullName: read("Example Person") } }, cutoffs);
    expect(result.signatoryName).toMatchObject({ verdict: "matches", slot: "emirates_id_front" });
  });

  it("asks for a look when a value was not found, not typed, or written in another script", () => {
    const result = compareTypedDetails(typed, { trade_licence: { companyName: read("مثال للتجارة") }, tax_certificate: { trn: read("100000000000003") } }, cutoffs);
    expect(result.licenceNumber).toMatchObject({ verdict: "needs_look", reason: "not_found" });
    expect(result.trn).toEqual({ verdict: "needs_look", reason: "not_typed", slot: "tax_certificate", documentValue: "100000000000003" });
    expect(result.companyName).toMatchObject({ verdict: "needs_look", reason: "other_script" });
  });

  it("says nothing when a detail was neither typed nor read", () => {
    expect(compareTypedDetails(typed, {}, cutoffs).trn).toMatchObject({ verdict: null, reason: null });
  });
});
