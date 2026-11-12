import { createHash } from "node:crypto";

// Exact fingerprint: changes completely if a single byte of the file changes.
export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// How many bits differ between two 16-hex-character picture fingerprints.
// Small = the same picture (re-photographed, resized); large = different pictures.
export function hammingDistance(hashA: string, hashB: string): number | null {
  if (!/^[0-9a-f]{16}$/.test(hashA) || !/^[0-9a-f]{16}$/.test(hashB)) return null;
  let difference = BigInt(`0x${hashA}`) ^ BigInt(`0x${hashB}`);
  let bits = 0;
  while (difference > 0n) {
    bits += Number(difference & 1n);
    difference >>= 1n;
  }
  return bits;
}
