import { expect, test } from "@playwright/test";
import { saveForms, slots, startApplication, uploadFile } from "./application-helpers";

test("Submit stays locked and lists what is missing, and the server refuses too", async ({ page }) => {
  const applicationId = await startApplication(page);
  await page.goto("/kyc/review");

  await expect(page.getByText("9 things still needed")).toBeVisible();
  await expect(page.getByRole("link", { name: "Save your company details" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Upload: Passport" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit", exact: true })).toBeDisabled();

  const refused = await page.request.post(`/api/applications/${applicationId}/submit`);
  expect(refused.status()).toBe(400);
  expect(await refused.json()).toMatchObject({ missing: expect.arrayContaining(["company_details", "passport"]) });
});

test("a complete application is submitted once, then locked", async ({ page }) => {
  const applicationId = await startApplication(page);
  for (const slot of slots) expect((await uploadFile(page, applicationId, slot)).status()).toBe(201);
  await saveForms(page, applicationId);

  await page.goto("/kyc/company");
  await page.getByRole("link", { name: "Review and submit" }).click();
  await expect(page).toHaveURL(/\/kyc\/review$/);
  await expect(page.getByText("Everything is in. You can submit.")).toBeVisible();
  await page.getByRole("button", { name: "Submit", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Verification in progress" })).toBeVisible();
  await page.goto("/kyc");
  await expect(page).toHaveURL(/\/kyc\/review$/);

  expect((await page.request.post(`/api/applications/${applicationId}/submit`)).status()).toBe(409);
  expect((await uploadFile(page, applicationId, "passport")).status()).toBe(409);
});

test("the review page is in Arabic too", async ({ page }) => {
  await startApplication(page);
  await page.goto("/ar/kyc/review");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("button", { name: "إرسال", exact: true })).toBeDisabled();
});
