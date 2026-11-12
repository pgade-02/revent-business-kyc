import { detectLikelySlot, hasFingerprint } from "../documents/fingerprints";
import type { DocumentSlot } from "../documents/slots";
import type { PageText } from "../interfaces/pdf-text-reader";
import type { CheckResult } from "./check-result";

const CODE = "DOC_WRONG_TYPE";

export type DocWrongTypeInput = { documentId: string; slot: DocumentSlot; pages: PageText[] };

// Fails when the readable text lacks the features every document of this slot has,
// e.g. no passport line in the passport box, or a front Emirates ID in the back box.
// Each slot has its own customer message ("This doesn't look like a passport…").
export function checkDocWrongType({ documentId, slot, pages }: DocWrongTypeInput): CheckResult {
  const text = pages.map((page) => page.text).join("\n");
  if (hasFingerprint(slot, text)) {
    return { code: CODE, status: "pass", detail: `Has the printed features of a ${slot}.` };
  }

  const lookalike = detectLikelySlot(text, slot);
  return {
    code: CODE,
    status: "fail",
    detail: lookalike
      ? `Uploaded as ${slot} but looks like a ${lookalike}.`
      : `Uploaded as ${slot} but has none of its printed features.`,
    evidence: { documentId, page: 1 },
    customerMessageKey: `Checks.DOC_WRONG_TYPE.${slot}`,
  };
}
