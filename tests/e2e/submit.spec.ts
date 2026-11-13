import { expect, test, type Page } from "@playwright/test";
import { makeTextPdf } from "../fixtures/make-files";

const smallPlan = { term: 36, lines: [{ productId: "wireless-business-headset", quantity: 1, serviceIds: [] }] };
const slots = ["trade_licence", "tax_certificate", "bank_statement", "passport", "emirates_id_front", "emirates_id_back", "self_disclosure"];

async function startApplication(page: Page): Promise<number> {
  const response = await page.request.post("/api/applications", { data: smallPlan });
  expect(response.status()).toBe(201);
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || !("applicationId" in body) || typeof body.applicationId !== "number") throw new Error("no applicationId");
  return body.applicationId;
}

// Uploads go straight to the API: this test is about Submit, not the upload boxes.
// A file still being checked counts as a file for the gate.
async function uploadFile(page: Page, applicationId: number, slot: string) {
  const buffer = Buffer.from(await makeTextPdf([`Test file for ${slot}`]));
  return page.request.post(`/api/applications/${applicationId}/documents`, {
    multipart: { slot, file: { name: `${slot}.pdf`, mimeType: "application/pdf", buffer } },
  });
}

async function saveForms(page: Page, applicationId: number) {
  const company = await page.request.put(`/api/applications/${applicationId}/company`, {
    data: {
      companyName: "Example Trading LLC",
      licenceNumber: "123456",
      yearEstablished: "2020",
      issuingAuthority: "Department of Economy and Tourism",
      emirate: "dubai",
      legalForm: "llc",
      trn: "",
      registeredAddress: "Office 1, Example Street, Dubai",
      deliverToRegisteredAddress: true,
    },
  });
  expect(company.status()).toBe(204);
  const signatory = await page.request.put(`/api/applications/${applicationId}/signatory`, {
    data: { isApplicant: true, fullName: "Example Person", signingEmail: "person@example.com", mobile: "" },
  });
  expect(signatory.status()).toBe(204);
}

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
