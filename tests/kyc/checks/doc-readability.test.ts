import { describe, expect, it } from "vitest";
import { checkDocUnreadable } from "@/kyc/checks/doc-unreadable";
import { checkDocWrongType } from "@/kyc/checks/doc-wrong-type";
import { syntheticTexts } from "../../fixtures/synthetic-documents";

const pages = (text: string) => [{ page: 1, text }];
const readability = { documentId: "doc_test", minTextChars: 20, minImageShortSidePx: 500 };

describe("DOC_UNREADABLE", () => {
  it("fails a photo that is too small, and tells the customer", () => {
    const result = checkDocUnreadable({ ...readability, pages: pages(syntheticTexts.passport("2031-08-14")), imageSize: { width: 640, height: 400 } });
    expect(result).toMatchObject({ status: "fail", customerMessageKey: "Checks.DOC_UNREADABLE" });
  });

  it("fails a document where almost nothing could be read", () => {
    expect(checkDocUnreadable({ ...readability, pages: pages("  a  b \n"), imageSize: null }).status).toBe("fail");
  });

  it("passes a readable document", () => {
    expect(checkDocUnreadable({ ...readability, pages: pages(syntheticTexts.tradeLicence), imageSize: { width: 1200, height: 900 } }).status).toBe("pass");
  });
});

describe("DOC_WRONG_TYPE", () => {
  const check = (slot: Parameters<typeof checkDocWrongType>[0]["slot"], text: string) =>
    checkDocWrongType({ documentId: "doc_test", slot, pages: pages(text) });

  it.each([
    ["trade_licence", syntheticTexts.tradeLicence],
    ["tax_certificate", syntheticTexts.taxCertificate("100000000000003")],
    ["bank_statement", syntheticTexts.bankStatement],
    ["passport", syntheticTexts.passport("2031-08-14")],
    ["emirates_id_front", syntheticTexts.emiratesIdFront],
    ["emirates_id_back", syntheticTexts.emiratesIdBack],
  ] as const)("passes a genuine %s", (slot, text) => {
    expect(check(slot, text).status).toBe("pass");
  });

  it("fails a foreign ID card in the passport box, with the passport message", () => {
    const result = check("passport", syntheticTexts.foreignIdCard);
    expect(result).toMatchObject({ status: "fail", customerMessageKey: "Checks.DOC_WRONG_TYPE.passport" });
    expect(result.detail).toBe("Uploaded as passport but has none of its printed features.");
  });

  it("catches the Emirates ID front and back swapped, both ways", () => {
    expect(check("emirates_id_back", syntheticTexts.emiratesIdFront).detail).toBe(
      "Uploaded as emirates_id_back but looks like a emirates_id_front.",
    );
    expect(check("emirates_id_front", syntheticTexts.emiratesIdBack).detail).toBe(
      "Uploaded as emirates_id_front but looks like a emirates_id_back.",
    );
  });

  it("fails an invoice in the bank statement box (no IBAN)", () => {
    expect(check("bank_statement", syntheticTexts.invoice)).toMatchObject({
      status: "fail",
      customerMessageKey: "Checks.DOC_WRONG_TYPE.bank_statement",
    });
  });
});
