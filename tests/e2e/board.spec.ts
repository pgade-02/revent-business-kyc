import { expect, test } from "@playwright/test";
import { submitCompleteApplication } from "./application-helpers";

test("a submitted application shows on the board with its reference and opens from there", async ({ page }) => {
  const applicationId = await submitCompleteApplication(page);
  await page.request.post("/api/session", { data: { role: "reviewer" } });

  await page.goto("/ops");
  await expect(page.getByRole("heading", { name: "Applications" })).toBeVisible();
  const card = page.locator(`a[href="/ops/applications/${applicationId}"]`);
  await expect(card.getByText(/^RB-\d{2}-[A-HJ-NP-Z2-9]{6}$/)).toBeVisible();
  await expect(card.getByText("7 to review")).toBeVisible();
  await expect(card.getByText("Owner: Unassigned")).toBeVisible();

  await page.getByRole("link", { name: "closed" }).click();
  await expect(card).toHaveCount(0);

  await page.goto("/ops?owner=unassigned");
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/ops/applications/${applicationId}$`));
});

test("a customer is asked to sign in as a reviewer", async ({ page }) => {
  await page.request.post("/api/session", { data: { role: "customer" } });
  await page.goto("/ops");
  await expect(page.getByRole("button", { name: "Sign in as reviewer" })).toBeVisible();
});
