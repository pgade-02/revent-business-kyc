import { describe, expect, it } from "vitest";
import { createSessionToken, readSessionToken } from "@/auth/session-token";

const secret = "test-secret-that-is-at-least-32-characters";
const now = 1_000_000;

describe("session token", () => {
  it("reads back the user it was made for", () => {
    const token = createSessionToken("seed-customer", now + 60, secret);
    expect(readSessionToken(token, now, secret)).toEqual({ ok: true, userId: "seed-customer" });
  });

  it("rejects a token whose user was changed in the browser", () => {
    const token = createSessionToken("seed-customer", now + 60, secret);
    const forged = token.replace("seed-customer", "seed-reviewer");
    expect(readSessionToken(forged, now, secret)).toEqual({ ok: false, reason: "BAD_SIGNATURE" });
  });

  it("rejects a token whose expiry was pushed back", () => {
    const token = createSessionToken("seed-customer", now + 60, secret);
    const forged = token.replace(String(now + 60), String(now + 999_999));
    expect(readSessionToken(forged, now, secret)).toEqual({ ok: false, reason: "BAD_SIGNATURE" });
  });

  it("rejects a token signed with a different secret", () => {
    const token = createSessionToken("seed-customer", now + 60, "another-secret-that-is-32-characters-long");
    expect(readSessionToken(token, now, secret)).toMatchObject({ ok: false, reason: "BAD_SIGNATURE" });
  });

  it("rejects an expired token", () => {
    const token = createSessionToken("seed-customer", now, secret);
    expect(readSessionToken(token, now, secret)).toEqual({ ok: false, reason: "EXPIRED" });
  });

  it("rejects text that is not a token", () => {
    expect(readSessionToken("hello", now, secret)).toEqual({ ok: false, reason: "MALFORMED" });
  });
});
