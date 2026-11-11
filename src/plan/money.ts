export const UAE_VAT_RATE_BPS = 500; // 5%, a tax rate, not a risk setting.
const BPS_PER_WHOLE = 10_000;

// Non-integer or unsafe values here mean a bug upstream, so throw.
function assertSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${name} must be a safe integer, got ${value}`);
  }
}

// Divides two integers and rounds half-up. BigInt keeps it exact for large values.
export function divideRoundHalfUp(numerator: number, denominator: number): number {
  assertSafeInteger(numerator, "numerator");
  assertSafeInteger(denominator, "denominator");
  if (denominator === 0) throw new Error("denominator must not be 0");

  const n = BigInt(numerator);
  const d = BigInt(denominator);
  const negative = n < 0n !== d < 0n;
  const absN = n < 0n ? -n : n;
  const absD = d < 0n ? -d : d;
  // floor((2n + d) / 2d) is n / d rounded half-up for non-negative values.
  const rounded = (2n * absN + absD) / (2n * absD);
  return Number(negative ? -rounded : rounded);
}

export function vatOnMonthly(monthlyFils: number, vatRateBps: number = UAE_VAT_RATE_BPS): number {
  return divideRoundHalfUp(monthlyFils * vatRateBps, BPS_PER_WHOLE);
}

// Sums first, rounds once. Returns null for an empty list: there is no average.
export function averageRoundHalfUp(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (const value of values) {
    assertSafeInteger(value, "value");
    sum += value;
  }
  return divideRoundHalfUp(sum, values.length);
}

// numerator ÷ denominator in bps. Null when the denominator is 0 (e.g. no income).
export function ratioBps(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return divideRoundHalfUp(numerator * BPS_PER_WHOLE, denominator);
}
