import { describe, expect, it } from "vitest";
import { draftRequestMessage } from "@/ops/request-message";

describe("draftRequestMessage", () => {
  it("writes one plain sentence from the document and the reason", () => {
    expect(draftRequestMessage({ subject: "passport", reason: "expired" }, "Passport")).toBe("Your passport has expired. Please upload a valid, current copy.");
    expect(draftRequestMessage({ subject: "bank_statement", reason: "missing_pages" }, "Bank statement")).toBe(
      "Some pages of your bank statement are missing. Please upload every page.",
    );
  });

  it("asks to correct typed details, and to check a document whose details differ", () => {
    expect(draftRequestMessage({ subject: "company_details", reason: "details_do_not_match" }, "Company details")).toBe(
      "Your company details don't match your documents. Please check them and correct anything that is wrong.",
    );
    expect(draftRequestMessage({ subject: "trade_licence", reason: "details_do_not_match" }, "Trade licence")).toBe(
      "The details on your trade licence don't match your other documents. Please check them or upload the correct document.",
    );
  });
});
