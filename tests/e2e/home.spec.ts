import { expect, test } from "@playwright/test";

test("English is served at / and reads left to right", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lease the office devices your business needs");
});

test("Arabic is served at /ar and reads right to left", async ({ page }) => {
  await page.goto("/ar");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("استأجر أجهزة المكتب التي يحتاجها عملك");
});

test("/en redirects to / because English has no prefix", async ({ page }) => {
  await page.goto("/en");
  await expect(page).toHaveURL(/\/$/);
});

test("the language link switches to Arabic and back", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "العربية" }).click();
  await expect(page).toHaveURL(/\/ar$/);
  await page.getByRole("link", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("the theme button switches between light and dark", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: "Switch between light and dark theme" }).click();
  await expect(html).toHaveClass(/dark/);
});
