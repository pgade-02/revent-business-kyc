// ICAO 9303 check digit, shared by passports and ID cards: weights 7, 3, 1 repeating,
// "<" counts 0, A = 10 … Z = 35, sum modulo 10.
function characterValue(character: string): number {
  if (character === "<") return 0;
  if (/[0-9]/.test(character)) return Number(character);
  return character.charCodeAt(0) - 55;
}

export function checkDigit(field: string): string {
  const weights = [7, 3, 1];
  const sum = [...field].reduce((total, character, index) => total + characterValue(character) * (weights[index % 3] ?? 0), 0);
  return String(sum % 10);
}
