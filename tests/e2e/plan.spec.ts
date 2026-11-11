import { expect, test } from "@playwright/test";

test("a customer builds a plan, sees the totals and saves it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Build your plan" }).click();
  await expect(page).toHaveURL(/\/plan$/);

  await page.getByRole("button", { name: "Add one Wireless business headset" }).click();
  await page.getByRole("button", { name: "Add one 65-inch meeting room display" }).click();
  await page.getByRole("button", { name: /36 months/ }).click();

  const totals = page.getByTestId("plan-totals");
  await expect(totals).toContainText("236.81"); // monthly excl. VAT
  await expect(totals).toContainText("11.84"); // VAT
  await expect(totals).toContainText("8,525.16"); // full term excl. VAT

  await page.getByRole("button", { name: "Proceed to KYC" }).click();
  await expect(page.getByRole("status")).toHaveText("Your plan is saved. Business verification comes next.");

  // Saving signed the visitor in as the customer, without a sign-in step.
  expect(await (await page.request.get("/api/session")).json()).toMatchObject({ role: "customer" });
});

test("the plan screen is in Arabic at /ar/plan", async ({ page }) => {
  await page.goto("/ar/plan");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("أنشئ خطتك");
  await expect(page.getByText("سماعة رأس لاسلكية للأعمال")).toBeVisible();
});

test("the server ignores totals sent by the browser", async ({ request }) => {
  const response = await request.post("/api/applications", {
    data: {
      term: 36,
      lines: [{ productId: "wireless-business-headset", quantity: 1, serviceIds: [] }],
      planMonthlyFils: 1,
    },
  });
  expect(response.status()).toBe(201);
  expect(await response.json()).toMatchObject({ planMonthlyFils: 3_089, route: "self_disclosure" });
});

test("a reviewer cannot create an application", async ({ request }) => {
  await request.post("/api/session", { data: { role: "reviewer" } });
  const response = await request.post("/api/applications", {
    data: { term: 36, lines: [{ productId: "wireless-business-headset", quantity: 1, serviceIds: [] }] },
  });
  expect(response.status()).toBe(403);
});

test("an invalid plan is rejected", async ({ request }) => {
  const response = await request.post("/api/applications", { data: { term: 12, lines: [] } });
  expect(response.status()).toBe(400);
});
