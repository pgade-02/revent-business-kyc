import { expect, type Page } from "@playwright/test";
import { makeTextPdf } from "../fixtures/make-files";

// Shared by the Submit and review tests: build an application straight through the API.
const smallPlan = { term: 36, lines: [{ productId: "wireless-business-headset", quantity: 1, serviceIds: [] }] };
export const slots = ["trade_licence", "tax_certificate", "bank_statement", "passport", "emirates_id_front", "emirates_id_back", "self_disclosure"];

export async function startApplication(page: Page): Promise<number> {
  const response = await page.request.post("/api/applications", { data: smallPlan });
  expect(response.status()).toBe(201);
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || !("applicationId" in body) || typeof body.applicationId !== "number") throw new Error("no applicationId");
  return body.applicationId;
}

// Uploads go straight to the API: this test is about Submit, not the upload boxes.
// A file still being checked counts as a file for the gate.
export async function uploadFile(page: Page, applicationId: number, slot: string) {
  const buffer = Buffer.from(await makeTextPdf([`Test file for ${slot}`]));
  return page.request.post(`/api/applications/${applicationId}/documents`, {
    multipart: { slot, file: { name: `${slot}.pdf`, mimeType: "application/pdf", buffer } },
  });
}

export async function saveForms(page: Page, applicationId: number) {
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

// A complete application, submitted. Part 2 runs inside the Submit request.
export async function submitCompleteApplication(page: Page): Promise<number> {
  const applicationId = await startApplication(page);
  for (const slot of slots) expect((await uploadFile(page, applicationId, slot)).status()).toBe(201);
  await saveForms(page, applicationId);
  expect((await page.request.post(`/api/applications/${applicationId}/submit`)).status()).toBe(204);
  return applicationId;
}
