import { expect, test } from "@playwright/test";

test("signing in as customer, then reviewer, then out", async ({ request }) => {
  expect((await request.get("/api/session")).status()).toBe(401);

  const signIn = await request.post("/api/session", { data: { role: "customer" } });
  expect(signIn.status()).toBe(200);
  expect(signIn.headers()["set-cookie"]).toMatch(/HttpOnly/i);
  expect(await (await request.get("/api/session")).json()).toMatchObject({ role: "customer" });

  await request.post("/api/session", { data: { role: "reviewer" } });
  expect(await (await request.get("/api/session")).json()).toMatchObject({ role: "reviewer" });

  expect((await request.delete("/api/session")).status()).toBe(204);
  expect((await request.get("/api/session")).status()).toBe(401);
});

test("a hand-made cookie is not accepted", async ({ playwright, baseURL }) => {
  const forged = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { cookie: "revent_session=seed-reviewer.9999999999.not-a-real-signature" },
  });
  expect((await forged.get("/api/session")).status()).toBe(401);
  await forged.dispose();
});

test("an unknown role is rejected", async ({ request }) => {
  expect((await request.post("/api/session", { data: { role: "admin" } })).status()).toBe(400);
});
