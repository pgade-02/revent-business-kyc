import { jaroWinklerBps } from "./jaro-winkler";
import { scriptOf, words, type MatchResult } from "./text";

export type NameCutoffs = { matchBps: number; possibleMatchBps: number };

// Pairs each word of the shorter name with its closest unused word in the longer one.
function weakestWordScore(shorter: string[], longer: string[]): number {
  const available = [...longer];
  let weakest = 10_000;
  for (const word of shorter) {
    let bestIndex = 0;
    let bestScore = -1;
    available.forEach((candidate, index) => {
      const score = jaroWinklerBps(word, candidate);
      if (score > bestScore) [bestIndex, bestScore] = [index, score];
    });
    available.splice(bestIndex, 1);
    weakest = Math.min(weakest, bestScore);
  }
  return weakest;
}

// Word order and extra middle names are ignored. A one-word name is too common to prove anything.
export function comparePersonNames(a: string, b: string, cutoffs: NameCutoffs): MatchResult {
  const script = scriptOf(a);
  if (script === "none" || script !== scriptOf(b)) return "not_comparable";

  const wordsA = words(a);
  const wordsB = words(b);
  if (wordsA.join("") === wordsB.join("")) return "match"; // "Al Mansoori" = "Almansoori"

  const [shorter, longer] = wordsA.length <= wordsB.length ? [wordsA, wordsB] : [wordsB, wordsA];
  if (shorter.length < 2) return "not_comparable";

  const weakest = weakestWordScore(shorter, longer);
  if (weakest >= cutoffs.matchBps) return "match";
  return weakest >= cutoffs.possibleMatchBps ? "possible_match" : "different";
}
