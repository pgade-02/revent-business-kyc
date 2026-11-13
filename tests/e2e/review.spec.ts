import { expect, test, type APIRequestContext } from "@playwright/test";
import { startApplication, submitCompleteApplication } from "./application-helpers";

const signInAs = (role: "customer" | "reviewer", request: APIRequestContext) => request.post("/api/session", { data: { role } });

test("a customer cannot open the team pages or record a decision", async ({ page }) => {
  const applicationId = await submitCompleteApplication(page);
  const refused = await page.request.post(`/api/team/applications/${applicationId}/actions`, { data: { action: "approve" } });
  expect(refused.status()).toBe(403);
  await page.goto("/team");
  await expect(page.getByRole("button", { name: "Sign in as reviewer" })).toBeVisible();
});

test("a reviewer opens a submitted application, sees the score card, and records decisions", async ({ page }) => {
  const applicationId = await submitCompleteApplication(page);
  await signInAs("reviewer", page.request);

  await page.goto("/team");
  await expect(page.getByRole("heading", { name: "Applications to review" })).toBeVisible();
  await page.getByRole("link", { name: /Example Trading LLC/ }).first().click();
  await expect(page).toHaveURL(new RegExp(`/team/applications/${applicationId}$`));

  for (const heading of ["Score", "Insights", "Reasons", "Money figures", "Documents", "Decision"]) {
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  await expect(page.getByText(/Green|Amber|Red · Recommend reject/).first()).toBeVisible();

  // Reject needs a reason: the page and the server both refuse an empty one.
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await page.getByRole("button", { name: "Record: Reject" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "A reason is required" })).toBeVisible();

  await page.getByRole("button", { name: "Request document", exact: true }).click();
  await page.getByLabel("Document").selectOption("passport");
  await page.getByLabel("Reason (required)").fill("Passport photo page is cut off.");
  await page.getByRole("button", { name: "Record: Request document" }).click();
  await expect(page.getByText("Requested a document by")).toBeVisible();
  await expect(page.getByText(": Passport photo page is cut off.")).toBeVisible();
});

test("a draft application is not visible to the team", async ({ page }) => {
  const applicationId = await startApplication(page);
  await signInAs("reviewer", page.request);
  const response = await page.goto(`/team/applications/${applicationId}`);
  expect(response?.status()).toBe(404);
  expect((await page.request.post(`/api/team/applications/${applicationId}/actions`, { data: { action: "approve" } })).status()).toBe(404);
});
