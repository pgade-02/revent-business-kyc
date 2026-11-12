// Before any text goes to the AI, ID numbers, IBANs, card and account numbers are
// swapped for placeholders like [[EID_1]] (SECURITY §2). The AI copies placeholders
// into its answer, and code swaps the real values back afterwards.

type MaskRule = { label: string; pattern: RegExp; keepPrefix?: boolean };

// Order matters: the most specific patterns run first, so an Emirates ID is not
// mistaken for a 15-digit TRN, and machine-readable passport lines go before everything.
const rules: MaskRule[] = [
  { label: "MRZ", pattern: /^(?=[A-Z0-9<]*<)[A-Z0-9<]{30,44}$/gm },
  { label: "EID", pattern: /\b784[-\s]?\d{4}[-\s]?\d{7}[-\s]?\d\b/g },
  { label: "IBAN", pattern: /\bAE\d{2}(?:\s?\d){19}\b/gi },
  { label: "CARD", pattern: /\b(?:\d{4}[\s-]){3}\d{4}\b/g },
  { label: "TRN", pattern: /\b\d{15}\b/g },
  { label: "ACCOUNT", pattern: /\b\d{10,14}\b/g },
  { label: "PASSPORT", pattern: /(passport\s*(?:no|number)\.?\s*[:#-]?\s*)([A-Z0-9]{6,9})\b/gi, keepPrefix: true },
];

const PLACEHOLDER = /\[\[[A-Z]+_\d+\]\]/g;

export type MaskedText = { text: string; originals: ReadonlyMap<string, string> };

export function maskText(input: string): MaskedText {
  const originals = new Map<string, string>();
  const placeholderFor = new Map<string, string>(); // same number twice → same placeholder
  let text = input;

  for (const rule of rules) {
    let count = 0;
    text = text.replace(rule.pattern, (match: string, prefix?: string, number?: string) => {
      const value = rule.keepPrefix && number ? number : match;
      let placeholder = placeholderFor.get(value);
      if (!placeholder) {
        count += 1;
        placeholder = `[[${rule.label}_${count}]]`;
        placeholderFor.set(value, placeholder);
        originals.set(placeholder, value);
      }
      return rule.keepPrefix && prefix ? `${prefix}${placeholder}` : placeholder;
    });
  }
  return { text, originals };
}

export function unmask(value: string, originals: ReadonlyMap<string, string>): string {
  return value.replace(PLACEHOLDER, (placeholder) => originals.get(placeholder) ?? placeholder);
}
