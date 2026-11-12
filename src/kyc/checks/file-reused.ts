import type { CheckResult } from "./check-result";

const CODE = "FILE_REUSED";

export type FileReusedInput = {
  documentId: string;
  // How many other customers' applications contain a file with the same SHA-256.
  // Only the count is passed in: this check must never see who those customers are.
  otherCustomerApplicationCount: number;
};

// The same exact file in another customer's application is a fraud signal (a borrowed
// or template document). The customer is not told; the reviewer sees a warning.
export function checkFileReused({ documentId, otherCustomerApplicationCount }: FileReusedInput): CheckResult {
  if (otherCustomerApplicationCount > 0) {
    return {
      code: CODE,
      status: "warn",
      detail: `The same file was uploaded in ${otherCustomerApplicationCount} other customer application(s).`,
      evidence: { documentId, page: 1 },
    };
  }
  return { code: CODE, status: "pass", detail: "Not seen in any other customer's application." };
}
