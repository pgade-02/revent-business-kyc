const PREFIX_SCALE = 0.1;
const MAX_PREFIX = 4;

function matchedCharacters(a: string, b: string): { aMatched: string[]; bMatched: string[] } {
  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const bUsed = new Array<boolean>(b.length).fill(false);
  const aMatched: string[] = [];

  for (let i = 0; i < a.length; i += 1) {
    const end = Math.min(b.length - 1, i + window);
    for (let j = Math.max(0, i - window); j <= end; j += 1) {
      if (!bUsed[j] && a[i] === b[j]) {
        bUsed[j] = true;
        aMatched.push(a[i] ?? "");
        break;
      }
    }
  }
  const bMatched = [...b].filter((_, j) => bUsed[j]);
  return { aMatched, bMatched };
}

// Jaro-Winkler similarity in basis points (10000 = identical).
export function jaroWinklerBps(a: string, b: string): number {
  if (a === b) return 10_000;
  if (a.length === 0 || b.length === 0) return 0;

  const { aMatched, bMatched } = matchedCharacters(a, b);
  const matches = aMatched.length;
  if (matches === 0) return 0;

  const outOfOrder = aMatched.filter((character, index) => character !== bMatched[index]).length;
  const transpositions = outOfOrder / 2;
  const jaro = (matches / a.length + matches / b.length + (matches - transpositions) / matches) / 3;

  let prefix = 0;
  while (prefix < MAX_PREFIX && prefix < a.length && a[prefix] === b[prefix]) prefix += 1;

  return Math.round((jaro + prefix * PREFIX_SCALE * (1 - jaro)) * 10_000);
}
