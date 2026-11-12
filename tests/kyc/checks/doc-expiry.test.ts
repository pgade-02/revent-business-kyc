import { describe, expect, it } from "vitest";
import { checkResultSchema } from "@/kyc/checks/check-result";
import { checkDocExpired } from "@/kyc/checks/doc-expired";
import { checkDocExpiresSoon } from "@/kyc/checks/doc-expires-soon";

// Fixture: a synthetic trade licence whose expiry date was read from page 1.
const today = "2026-11-12";
const expiry = (value: string) => ({ value, page: 1, confidenceBps: 9_800 });
const base = { documentId: "doc_test_licence" };

describe("DOC_EXPIRED", () => {
  it("fails yesterday's expiry and gives the customer a fix message", () => {
    const result = checkDocExpired({ ...base, expiryDate: expiry("2026-11-11"), today });
    expect(result).toMatchObject({
      status: "fail",
      customerMessageKey: "Checks.DOC_EXPIRED",
      evidence: { documentId: "doc_test_licence", page: 1 },
    });
    expect(checkResultSchema.safeParse(result).success).toBe(true);
  });

  it("passes a document that expires today", () => {
    expect(checkDocExpired({ ...base, expiryDate: expiry(today), today }).status).toBe("pass");
  });

  it("skips when there is no expiry date or it is not a real date", () => {
    expect(checkDocExpired({ ...base, expiryDate: undefined, today }).status).toBe("skipped");
    expect(checkDocExpired({ ...base, expiryDate: expiry("2026-02-30"), today }).status).toBe("skipped");
  });
});

describe("DOC_EXPIRES_SOON", () => {
  const soon = (value: string) => checkDocExpiresSoon({ ...base, expiryDate: expiry(value), today, expiresSoonDays: 60 });

  it("warns at exactly 60 days and below, without a customer message", () => {
    const result = soon("2027-01-11"); // 60 days after today
    expect(result.status).toBe("warn");
    expect(result.customerMessageKey).toBeUndefined();
    expect(soon(today).status).toBe("warn");
  });

  it("passes at 61 days", () => {
    expect(soon("2027-01-12").status).toBe("pass");
  });

  it("leaves expired documents to DOC_EXPIRED", () => {
    expect(soon("2026-11-11").status).toBe("skipped");
  });

  it("uses the limit it is given, not a built-in one", () => {
    const result = checkDocExpiresSoon({ ...base, expiryDate: expiry("2026-12-12"), today, expiresSoonDays: 15 });
    expect(result.status).toBe("pass"); // 30 days left, limit 15
  });
});
