import type { DocumentSlot } from "./slots";

// Printed features that every genuine document of a type has. Code checks these on
// the read text, so a wrong document is caught without trusting the AI.
// Starting rules; their false-alarm rate is measured on the eval set (ARCHITECTURE §8).
const PASSPORT_MRZ = /P<[A-Z]{3}/; // bottom line of every passport
const ID_CARD_MRZ = /I[A-Z<]ARE/; // machine-readable lines on the back of an Emirates ID
const EMIRATES_ID_NUMBER = /784[-\s]?\d{4}[-\s]?\d{7}[-\s]?\d/;
const UAE_IBAN = /AE\d{2}(?:\s?\d){19}/;

const fingerprints: Record<DocumentSlot, (text: string) => boolean> = {
  passport: (text) => PASSPORT_MRZ.test(text),
  emirates_id_back: (text) => ID_CARD_MRZ.test(text),
  emirates_id_front: (text) => EMIRATES_ID_NUMBER.test(text) && !ID_CARD_MRZ.test(text),
  bank_statement: (text) => UAE_IBAN.test(text),
  tax_certificate: (text) => /TAX\s+REGISTRATION|\bTRN\b|CORPORATE\s+TAX|ضريبة/.test(text),
  trade_licence: (text) => /LICEN[CS]E|رخصة/.test(text),
  self_disclosure: (text) => /DISCLOSURE|DECLARATION|إقرار/.test(text),
};

// Most specific first, so "what does it look like instead?" picks the best match.
const detectionOrder: DocumentSlot[] = [
  "passport",
  "emirates_id_back",
  "emirates_id_front",
  "bank_statement",
  "tax_certificate",
  "trade_licence",
  "self_disclosure",
];

const normalise = (text: string) => text.toUpperCase();

export function hasFingerprint(slot: DocumentSlot, text: string): boolean {
  return fingerprints[slot](normalise(text));
}

export function detectLikelySlot(text: string, except: DocumentSlot): DocumentSlot | null {
  const upper = normalise(text);
  return detectionOrder.find((slot) => slot !== except && fingerprints[slot](upper)) ?? null;
}
