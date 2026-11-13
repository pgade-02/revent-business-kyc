import { describe, expect, it } from "vitest";
import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";
import { checkDocExpired } from "@/kyc/checks/doc-expired";
import { checkFileDuplicate } from "@/kyc/checks/file-duplicate";
import { checkMrzCheckDigits } from "@/kyc/checks/mrz-check-digits";
import { DOCUMENT_SLOTS } from "@/kyc/documents/slots";
import { INTAKE_REJECTIONS } from "@/kyc/intake/intake-file";

// Follows a key like "Checks.DOC_EXPIRED" through the messages file.
function lookUp(messages: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => {
    return typeof node === "object" && node !== null ? (node as Record<string, unknown>)[part] : undefined;
  }, messages);
}

// Every customer message a check can produce must exist in both languages,
// or the customer would see a raw key instead of a sentence.
const producedKeys = [
  checkDocExpired({
    documentId: "doc_test",
    expiryDate: { value: "2020-01-01", page: 1, confidenceBps: 9_000 },
    today: "2026-11-12",
  }).customerMessageKey,
  checkFileDuplicate({
    file: { documentId: "doc_new", sha256: "a".repeat(64), perceptualHash: null },
    otherFilesInApplication: [{ documentId: "doc_old", sha256: "a".repeat(64), perceptualHash: null }],
    nearDuplicateMaxBits: 5,
  }).customerMessageKey,
  checkMrzCheckDigits("doc_test", {
    mrz: { line1: "ILARE0000000000000000000000000", line2: "0000000F0000001UTO<<<<<<<<<<<1" },
    page: 1,
  }).customerMessageKey,
  ...INTAKE_REJECTIONS.map((reason) => `Upload.${reason}`),
  "Checks.DOC_UNREADABLE",
  ...DOCUMENT_SLOTS.map((slot) => `Checks.DOC_WRONG_TYPE.${slot}`),
];

describe("customer messages produced by checks", () => {
  it.each(producedKeys)("%s exists in English and Arabic", (key) => {
    expect(key).toBeDefined();
    expect(typeof lookUp(en, key ?? "")).toBe("string");
    expect(typeof lookUp(ar, key ?? "")).toBe("string");
  });
});
