import { describe, expect, it } from "vitest";
import { checkFileDuplicate } from "@/kyc/checks/file-duplicate";
import { checkFileReused } from "@/kyc/checks/file-reused";

const upload = { documentId: "doc_new", sha256: "a".repeat(64), perceptualHash: "00ff00ff00ff00ff" };
const otherFile = (sha256: string, perceptualHash: string | null) => ({ documentId: "doc_old", sha256, perceptualHash });

describe("FILE_DUPLICATE", () => {
  it("fails an exact copy and tells the customer", () => {
    const result = checkFileDuplicate({ file: upload, otherFilesInApplication: [otherFile(upload.sha256, null)], nearDuplicateMaxBits: 5 });
    expect(result).toMatchObject({ status: "fail", customerMessageKey: "Checks.FILE_DUPLICATE" });
    expect(result.detail).toContain("Identical");
  });

  it("fails a second photo of the same page (fingerprints 4 bits apart)", () => {
    const nearCopy = otherFile("b".repeat(64), "00ff00ff00ff00f0");
    const result = checkFileDuplicate({ file: upload, otherFilesInApplication: [nearCopy], nearDuplicateMaxBits: 5 });
    expect(result.status).toBe("fail");
    expect(result.detail).toContain("same picture");
  });

  it("passes a different picture (fingerprints far apart) and an empty application", () => {
    const different = otherFile("b".repeat(64), "ff00ff00ff00ff00");
    expect(checkFileDuplicate({ file: upload, otherFilesInApplication: [different], nearDuplicateMaxBits: 5 }).status).toBe("pass");
    expect(checkFileDuplicate({ file: upload, otherFilesInApplication: [], nearDuplicateMaxBits: 5 }).status).toBe("pass");
  });

  it("uses the tolerance it is given", () => {
    const nearCopy = otherFile("b".repeat(64), "00ff00ff00ff00f0");
    expect(checkFileDuplicate({ file: upload, otherFilesInApplication: [nearCopy], nearDuplicateMaxBits: 3 }).status).toBe("pass");
  });
});

describe("FILE_REUSED", () => {
  it("warns the reviewer only, and never names the other customers", () => {
    const result = checkFileReused({ documentId: "doc_new", otherCustomerApplicationCount: 2 });
    expect(result).toMatchObject({ status: "warn", evidence: { documentId: "doc_new", page: 1 } });
    expect(result.customerMessageKey).toBeUndefined();
    expect(result.detail).toBe("The same file was uploaded in 2 other customer application(s).");
  });

  it("passes when no other customer has the file", () => {
    expect(checkFileReused({ documentId: "doc_new", otherCustomerApplicationCount: 0 }).status).toBe("pass");
  });
});
