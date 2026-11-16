import { emirateOf } from "@/kyc/checks/emirate-match";
import type { DocumentSlot } from "@/kyc/documents/slots";
import { textField, type ExtractedFields } from "@/kyc/extraction/extract-fields";
import { compareCompanyNames } from "@/kyc/matching/company-names";
import { comparePersonNames, type NameCutoffs } from "@/kyc/matching/person-names";
import { sameNumber, type MatchResult } from "@/kyc/matching/text";

export type Verdict = "matches" | "needs_look" | "different";
// Why a value needs a look: close but not exact, not found on the document, written in another script, or not typed.
export type LookReason = "close" | "not_found" | "other_script" | "not_typed";
// verdict null: nothing typed and nothing read, so there is nothing to say.
export type Comparison = { verdict: Verdict | null; reason: LookReason | null; slot: DocumentSlot; documentValue: string | null };

export type TypedDetails = {
  companyName: string | null;
  licenceNumber: string | null;
  emirate: string | null;
  trn: string | null;
  signatoryName: string | null;
};
export type ReadBySlot = Partial<Record<DocumentSlot, ExtractedFields>>;

const FROM_MATCH: Record<MatchResult, Pick<Comparison, "verdict" | "reason">> = {
  match: { verdict: "matches", reason: null },
  possible_match: { verdict: "needs_look", reason: "close" },
  different: { verdict: "different", reason: null },
  not_comparable: { verdict: "needs_look", reason: "other_script" },
};

// Compares one typed value with the first document that has the field read.
function compare(typed: string | null, sources: [DocumentSlot, string][], read: ReadBySlot, match: (typed: string, onDocument: string) => MatchResult): Comparison {
  const found = sources.map(([slot, name]) => ({ slot, value: textField(read[slot] ?? {}, name)?.value ?? null })).find((source) => source.value !== null);
  const first = sources[0];
  const slot = found?.slot ?? (first ? first[0] : "trade_licence");
  const documentValue = found?.value ?? null;
  if (!typed) return documentValue ? { verdict: "needs_look", reason: "not_typed", slot, documentValue } : { verdict: null, reason: null, slot, documentValue };
  if (!documentValue) return { verdict: "needs_look", reason: "not_found", slot, documentValue };
  return { ...FROM_MATCH[match(typed, documentValue)], slot, documentValue };
}

const sameEmirate = (typed: string, printed: string): MatchResult => {
  const code = emirateOf(printed);
  return code === null ? "not_comparable" : code === typed ? "match" : "different";
};

// Says, for each typed detail, whether the documents show the same value.
export function compareTypedDetails(typed: TypedDetails, read: ReadBySlot, nameCutoffs: NameCutoffs) {
  return {
    companyName: compare(typed.companyName, [["trade_licence", "companyName"]], read, compareCompanyNames),
    licenceNumber: compare(typed.licenceNumber, [["trade_licence", "licenceNumber"]], read, sameNumber),
    emirate: compare(typed.emirate, [["trade_licence", "emirate"]], read, sameEmirate),
    trn: compare(typed.trn, [["tax_certificate", "trn"]], read, sameNumber),
    signatoryName: compare(
      typed.signatoryName,
      [
        ["passport", "fullName"],
        ["emirates_id_front", "fullName"],
      ],
      read,
      (a, b) => comparePersonNames(a, b, nameCutoffs),
    ),
  };
}
export type TypedComparisons = ReturnType<typeof compareTypedDetails>;
