// Characters for references, without 0, O, 1 and I.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Builds a reference like "RB-26-JU2XWY" from the submit year and six random characters.
export function applicationReference(submittedAt: string, randomIndex: (size: number) => number): string {
  const year = submittedAt.slice(2, 4);
  const code = Array.from({ length: 6 }, () => ALPHABET[randomIndex(ALPHABET.length)] ?? "A").join("");
  return `RB-${year}-${code}`;
}

export const isApplicationReference = (text: string) => /^RB-\d{2}-[A-HJ-NP-Z2-9]{6}$/.test(text);
