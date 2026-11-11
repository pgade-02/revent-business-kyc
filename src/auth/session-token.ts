import { createHmac, timingSafeEqual } from "node:crypto";

// A session token is "userId.expiresAt.signature". The signature is an HMAC of
// the first two parts made with a server-only secret, so a browser can read the
// token but cannot change the user or the expiry without the check failing.

export type SessionTokenResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "MALFORMED" | "BAD_SIGNATURE" | "EXPIRED" };

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(userId: string, expiresAtSeconds: number, secret: string): string {
  const payload = `${userId}.${expiresAtSeconds}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function readSessionToken(token: string, nowSeconds: number, secret: string): SessionTokenResult {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "MALFORMED" };
  const [userId = "", expiresText = "", signature = ""] = parts;

  const expected = Buffer.from(sign(`${userId}.${expiresText}`, secret));
  const given = Buffer.from(signature);
  // timingSafeEqual takes the same time whether the first or last character differs,
  // so an attacker cannot guess the signature one character at a time.
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "BAD_SIGNATURE" };
  }

  const expiresAt = Number(expiresText);
  if (!Number.isSafeInteger(expiresAt)) return { ok: false, reason: "MALFORMED" };
  if (expiresAt <= nowSeconds) return { ok: false, reason: "EXPIRED" };
  return { ok: true, userId };
}
