import { expect, test } from "@playwright/test";

const smallPlan = { term: 36, lines: [{ productId: "wireless-business-headset", quantity: 1, serviceIds: [] }] };

// Fictional company (tests/fixtures/realistic/companies.ts).
test("a customer fills in Company details, fixes a wrong TRN, and the task completes", async ({ page }) => {
  expect((await page.request.post("/api/applications", { data: smallPlan })).status()).toBe(201);
  await page.goto("/kyc/company");

  await page.getByLabel("Company name").fill("Falcon Demo Trading L.L.C.");
  await page.getByLabel("Trade licence number").fill("CN-4729183");
  await page.getByLabel("Year established").fill("2019");
  await page.getByLabel("Licence issuing authority").fill("Emirate Economic Registry (Specimen)");
  await page.getByLabel("Emirate").selectOption("dubai");
  await page.getByLabel("Legal form").selectOption("llc");
  await page.getByLabel("Tax registration number (TRN) (optional)").fill("12345");
  await page.getByLabel("Registered address", { exact: true }).fill("Office 1204, Specimen Tower, Business Bay, Dubai");

  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("A TRN has 15 digits.")).toBeVisible();
  await expect(page.getByText("1 of 5 complete").first()).toBeVisible();

  await page.getByLabel("Tax registration number (TRN) (optional)").fill("100 4729 1830 0003");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Details saved" })).toBeVisible();
  await expect(page.getByText("2 of 5 complete").first()).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Tax registration number (TRN) (optional)")).toHaveValue("100472918300003");
  await expect(page.getByLabel("Emirate")).toHaveValue("dubai");
});

test("the Company details form is in Arabic and right-to-left on the Arabic site", async ({ page }) => {
  expect((await page.request.post("/api/applications", { data: smallPlan })).status()).toBe(201);
  await page.goto("/ar/kyc/company");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByLabel("اسم الشركة")).toBeVisible();
  await expect(page.getByRole("button", { name: "حفظ البيانات" })).toBeVisible();
});
