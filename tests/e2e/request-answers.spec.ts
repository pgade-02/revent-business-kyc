import { expect, test, type Page } from "@playwright/test";
import { z } from "zod";
import { submitCompleteApplication, uploadFile } from "./application-helpers";

const signInAs = (page: Page, role: "customer" | "reviewer") => page.request.post("/api/session", { data: { role } });

test("the customer sees only what was asked, answers it, and the application returns to review", async ({ page }) => {
  const applicationId = await submitCompleteApplication(page);
  await signInAs(page, "reviewer");
  const sent = await page.request.post(`/api/ops/applications/${applicationId}/requests`, {
    data: { items: [{ subject: "passport", reason: "expired", note: "Please upload the renewed passport", noteAr: "يرجى تحميل الجواز المجدد" }] },
  });
  expect(sent.status()).toBe(204);

  await signInAs(page, "customer");
  await page.goto("/kyc/review");
  await expect(page.getByRole("heading", { name: "We need a few more things" })).toBeVisible();
  await expect(page.getByText("Note from our team: Please upload the renewed passport")).toBeVisible();
  await expect(page.getByRole("link", { name: "Update" })).toHaveAttribute("href", "/kyc/signatory");

  await page.goto("/ar/kyc/review");
  await expect(page.getByText("ملاحظة من فريقنا: يرجى تحميل الجواز المجدد")).toBeVisible();

  expect((await uploadFile(page, applicationId, "trade_licence")).status()).toBe(409);
  const upload = await uploadFile(page, applicationId, "passport");
  expect(upload.status()).toBe(201);
  const { documentId } = z.object({ documentId: z.number() }).parse(await upload.json());
  expect((await page.request.post(`/api/documents/${documentId}/process`)).status()).toBe(200);

  await page.goto("/en/kyc/review");
  await expect(page.getByRole("heading", { name: "Verification in progress" })).toBeVisible();

  await signInAs(page, "reviewer");
  await page.goto(`/ops/applications/${applicationId}`);
  await expect(page.getByText(/· In review for/)).toBeVisible();
  await expect(page.getByText(/answered /)).toBeVisible();
});

test("an item drafts one message in the chosen language", async ({ page }) => {
  test.setTimeout(120_000);
  const applicationId = await submitCompleteApplication(page);
  await signInAs(page, "reviewer");
  await page.goto(`/ops/applications/${applicationId}`);

  await page.getByLabel("What to ask for, item 1").selectOption("passport");
  await page.getByLabel("Reason, item 1").selectOption("expired");
  await page.getByRole("button", { name: "Draft message" }).click();
  const message = page.getByLabel("Message, item 1", { exact: true });
  await expect(message).toHaveValue("Your passport has expired. Please upload a valid, current copy.");

  await page.getByLabel("Message language").selectOption("ar");
  await expect(message).toHaveValue("");
  await page.getByRole("button", { name: "Draft message" }).click();
  await expect(message).not.toHaveValue("", { timeout: 90_000 });
  await expect(message).toHaveAttribute("dir", "rtl");
  await message.fill("يرجى تحميل جواز سفر ساري المفعول.");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("يرجى تحميل جواز سفر ساري المفعول.")).toBeVisible();
  await expect(page.getByText("Your passport has expired.")).toHaveCount(0);
});
