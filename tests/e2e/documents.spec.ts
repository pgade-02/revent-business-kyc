import { expect, test, type Page } from "@playwright/test";
import { makeTextPdf } from "../fixtures/make-files";
import { syntheticTexts } from "../fixtures/synthetic-documents";

const smallPlan = { term: 36, lines: [{ productId: "wireless-business-headset", quantity: 1, serviceIds: [] }] };
// 10 displays for 24 months is above the AED 40,000 route threshold.
const largePlan = { term: 24, lines: [{ productId: "meeting-room-display-65", quantity: 10, serviceIds: [] }] };

// Saving a plan signs the browser in as the customer, exactly like pressing Proceed.
async function startApplication(page: Page, plan = smallPlan) {
  expect((await page.request.post("/api/applications", { data: plan })).status()).toBe(201);
}

async function upload(page: Page, box: string, name: string, buffer: Buffer, mimeType = "application/pdf") {
  await page.getByRole("region", { name: box }).locator("input[type=file]").setInputFiles({ name, mimeType, buffer });
}

const pdf = async (text: string) => Buffer.from(await makeTextPdf([text]));

test("the hub opens on the first open task and shows progress", async ({ page }) => {
  await startApplication(page);
  await page.goto("/kyc");
  await expect(page).toHaveURL(/\/kyc\/company$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Business verification");
  await expect(page.getByText("1 of 5 complete").first()).toBeVisible(); // the pre-filled account
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("Company details");
  await expect(page.getByText("Task 2 of 5")).toBeVisible();
});

test("a customer uploads documents and sees each result under its box", async ({ page }) => {
  await startApplication(page);
  await page.goto("/kyc/documents");

  await upload(page, "Trade licence", "licence.pdf", await pdf(syntheticTexts.tradeLicence));
  await expect(page.getByRole("region", { name: "Trade licence" }).getByRole("status")).toHaveText("Looks good");

  const statements = page.getByRole("region", { name: "Bank statements, last 6 months" });
  await upload(page, "Bank statements, last 6 months", "invoice.pdf", await pdf(syntheticTexts.invoice));
  await expect(statements.getByRole("status")).toHaveText("Needs a fix");
  await expect(statements).toContainText("Wrong document. Please upload a valid bank statement.");

  await upload(page, "Tax registration certificate", "notes.pdf", Buffer.from("not really a pdf"));
  await expect(page.getByRole("region", { name: "Tax registration certificate" })).toContainText(
    "Unsupported file. Please upload a PDF, JPG or PNG.",
  );

  // After a reload the saved results are still there, and the task shows it needs a fix.
  await page.reload();
  await expect(statements).toContainText("Wrong document. Please upload a valid bank statement.");
  await expect(page.getByRole("link", { name: /Business documents.*Needs a fix/ })).toBeVisible();
});

test("Continue lists what still needs a fix, then carries on", async ({ page }) => {
  await startApplication(page);
  await page.goto("/kyc/documents");
  await upload(page, "Bank statements, last 6 months", "invoice.pdf", await pdf(syntheticTexts.invoice));
  await expect(page.getByRole("region", { name: "Bank statements, last 6 months" }).getByRole("status")).toHaveText("Needs a fix");
  await page.reload();

  await page.getByRole("button", { name: "Continue" }).click();
  // Next.js has its own hidden route announcer with role="alert", so pick ours by text.
  await expect(page.getByRole("alert").filter({ hasText: "needs a fix" })).toContainText("1 file needs a fix");
  await page.getByRole("button", { name: "Continue anyway" }).click();
  await expect(page).toHaveURL(/\/kyc\/signatory$/);
});

test("a plan above the threshold has 4 tasks and no self-disclosure", async ({ page }) => {
  await startApplication(page, largePlan);
  await page.goto("/kyc/account");
  await expect(page.getByText("1 of 4 complete").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Self-disclosure form/ })).toHaveCount(0);
  expect((await page.goto("/kyc/self-disclosure"))?.status()).toBe(404);
});

test("the identity documents screen works in Arabic", async ({ page }) => {
  await startApplication(page);
  await page.goto("/ar/kyc/signatory");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("المفوّض بالتوقيع");
  await expect(page.getByRole("region", { name: "جواز السفر" })).toBeVisible();
});

test("a visitor without a plan is sent to build one first", async ({ page }) => {
  await page.goto("/kyc/documents");
  await expect(page.getByText("Build your plan first, then complete your business verification.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Build your plan" })).toBeVisible();
});

test("only the owning customer can upload or process", async ({ page, request }) => {
  await startApplication(page);
  // Someone else's or a missing document looks the same: not found.
  expect((await page.request.post("/api/documents/999999/process")).status()).toBe(404);
  // Without a session nothing is allowed.
  expect((await request.post("/api/documents/1/process")).status()).toBe(401);
  // A reviewer cannot upload customer documents.
  await request.post("/api/session", { data: { role: "reviewer" } });
  const asReviewer = await request.post("/api/applications/1/documents", { multipart: { slot: "passport" } });
  expect(asReviewer.status()).toBe(403);
});
