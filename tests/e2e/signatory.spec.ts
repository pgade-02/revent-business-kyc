import { expect, test } from "@playwright/test";

const smallPlan = { term: 36, lines: [{ productId: "wireless-business-headset", quantity: 1, serviceIds: [] }] };

test("ticking 'I'm the authorised signatory' fills in the applicant, and a bad mobile is shown", async ({ page }) => {
  expect((await page.request.post("/api/applications", { data: smallPlan })).status()).toBe(201);
  await page.goto("/kyc/signatory");

  await page.getByRole("checkbox", { name: "I’m the authorised signatory" }).click();
  await expect(page.getByLabel("Full name")).toHaveValue("Demo Customer"); // the seeded applicant
  await expect(page.getByLabel("Email for signing")).toHaveValue("owner@demo-trading.example");

  await page.getByLabel("Mobile (optional)").fill("04 123 4567");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Enter a UAE mobile number, for example 050 123 4567.")).toBeVisible();

  await page.getByLabel("Mobile (optional)").fill("050 123 4567");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Details saved" })).toBeVisible();
  // Details saved but no identity documents yet: the task is under way, not complete.
  await expect(page.getByText("Task 4 of 5")).toBeVisible();
  await expect(page.getByRole("main").getByText("In progress").first()).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Mobile (optional)")).toHaveValue("+971501234567");
});
