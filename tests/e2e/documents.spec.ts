import { expect, test, type Page } from "@playwright/test";
import { makeTextPdf } from "../fixtures/make-files";
import { syntheticTexts } from "../fixtures/synthetic-documents";

const plan = { term: 36, lines: [{ productId: "wireless-business-headset", quantity: 1, serviceIds: [] }] };

// Saving a plan signs the browser in as the customer, exactly like pressing Proceed.
async function startApplication(page: Page) {
  expect((await page.request.post("/api/applications", { data: plan })).status()).toBe(201);
}

async function upload(page: Page, box: string, name: string, buffer: Buffer, mimeType = "application/pdf") {
  await page.getByRole("region", { name: box }).locator("input[type=file]").setInputFiles({ name, mimeType, buffer });
}

test("a customer uploads documents and sees each result under its box", async ({ page }) => {
  await startApplication(page);
  await page.goto("/kyc/documents");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Business documents");

  await upload(page, "Trade licence", "licence.pdf", Buffer.from(await makeTextPdf([syntheticTexts.tradeLicence])));
  await expect(page.getByRole("region", { name: "Trade licence" }).getByRole("status")).toHaveText("Looks good");

  const statements = page.getByRole("region", { name: "Bank statements, last 6 months" });
  await upload(page, "Bank statements, last 6 months", "invoice.pdf", Buffer.from(await makeTextPdf([syntheticTexts.invoice])));
  await expect(statements.getByRole("status")).toHaveText("Needs a fix");
  await expect(statements).toContainText("Wrong document. Please upload a valid bank statement.");

  await upload(page, "Tax registration certificate", "notes.pdf", Buffer.from("not really a pdf"));
  await expect(page.getByRole("region", { name: "Tax registration certificate" })).toContainText(
    "Unsupported file. Please upload a PDF, JPG or PNG.",
  );

  // After a reload the saved results are still there.
  await page.reload();
  await expect(statements).toContainText("Wrong document. Please upload a valid bank statement.");
});

test("the identity documents screen works in Arabic", async ({ page }) => {
  await startApplication(page);
  await page.goto("/ar/kyc/signatory");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("مستندات الهوية");
  await expect(page.getByRole("region", { name: "جواز السفر" })).toBeVisible();
});

test("a visitor without a plan is sent to build one first", async ({ page }) => {
  await page.goto("/kyc/documents");
  await expect(page.getByText("Build your plan first, then add your documents.")).toBeVisible();
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
