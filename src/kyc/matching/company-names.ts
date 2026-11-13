import { LEGAL_FORMS } from "./legal-forms";
import { scriptOf, words, type MatchResult } from "./text";

// Cleaned the same way as the names, so Arabic entries match however they were typed.
const legalFormWords = new Set(LEGAL_FORMS.flatMap(words));

export function companyNameKey(name: string): string {
  return words(name)
    .filter((word) => !legalFormWords.has(word))
    .join(" ");
}

// Exact after clean-up: "Falcon Trading" and "Falcon General Trading" go to the reviewer.
export function compareCompanyNames(a: string, b: string): MatchResult {
  const script = scriptOf(a);
  if (script === "none" || script !== scriptOf(b)) return "not_comparable";
  const keyA = companyNameKey(a);
  const keyB = companyNameKey(b);
  if (keyA === "" || keyB === "") return "not_comparable";
  return keyA === keyB ? "match" : "different";
}
