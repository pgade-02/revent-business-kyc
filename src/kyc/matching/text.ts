export type MatchResult = "match" | "possible_match" | "different" | "not_comparable";

export type Script = "arabic" | "latin" | "none";

export function scriptOf(text: string): Script {
  if (/\p{Script=Latin}/u.test(text)) return "latin";
  return /\p{Script=Arabic}/u.test(text) ? "arabic" : "none";
}

// NFKD splits accents and Arabic vowel and hamza marks off their letters; \p{M} then drops them.
// "José" → "jose", "مؤسسة" → "موسسه". The tatweel (ـ) only stretches a word, so it goes too.
export function words(text: string): string[] {
  const cleaned = text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ـ/g, "")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return cleaned === "" ? [] : cleaned.split(" ");
}

export function compactNumber(text: string): string {
  return text.replace(/[\s-]/g, "").toUpperCase();
}

export function sameNumber(a: string, b: string): MatchResult {
  const left = compactNumber(a);
  const right = compactNumber(b);
  if (left === "" || right === "") return "not_comparable";
  return left === right ? "match" : "different";
}
