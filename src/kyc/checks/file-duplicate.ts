import { hammingDistance } from "../intake/hashes";
import type { CheckResult } from "./check-result";

const CODE = "FILE_DUPLICATE";

export type FileFingerprint = { documentId: string; sha256: string; perceptualHash: string | null };

export type FileDuplicateInput = {
  file: FileFingerprint;
  otherFilesInApplication: FileFingerprint[];
  nearDuplicateMaxBits: number;
};

function sameFile(a: FileFingerprint, b: FileFingerprint, maxBits: number): "exact" | "near" | null {
  if (a.sha256 === b.sha256) return "exact";
  if (!a.perceptualHash || !b.perceptualHash) return null;
  const distance = hammingDistance(a.perceptualHash, b.perceptualHash);
  return distance !== null && distance <= maxBits ? "near" : null;
}

// Fails when the customer uploads the same file (or a photo of the same page) twice in
// one application, usually into the wrong slot. They can fix it, so it has a message.
export function checkFileDuplicate({ file, otherFilesInApplication, nearDuplicateMaxBits }: FileDuplicateInput): CheckResult {
  for (const other of otherFilesInApplication) {
    const match = sameFile(file, other, nearDuplicateMaxBits);
    if (match) {
      return {
        code: CODE,
        status: "fail",
        detail: match === "exact" ? "Identical to another file in this application." : "Looks like the same picture as another file in this application.",
        evidence: { documentId: file.documentId, page: 1 },
        customerMessageKey: "Checks.FILE_DUPLICATE",
      };
    }
  }
  return { code: CODE, status: "pass", detail: "Not a copy of another file in this application." };
}
