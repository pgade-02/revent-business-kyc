import { expect, test } from "@playwright/test";
import { submitCompleteApplication } from "./application-helpers";

test("a reviewer takes ownership, approves a document, changes status and opens the file", async ({ page }) => {
  const applicationId = await submitCompleteApplication(page);
  await page.request.post("/api/session", { data: { role: "reviewer" } });
  await page.goto(`/ops/applications/${applicationId}`);

  await expect(page.getByRole("heading", { name: /^RB-\d{2}-/ })).toBeVisible();
  await expect(page.getByText("SHA-256", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Needs a look").first()).toBeVisible();
  await page.getByText("Needs a look").first().click();
  await expect(page.getByText("This file has not been read yet.").first()).toBeVisible();

  await page.getByLabel("Owner").selectOption({ label: "Demo Reviewer" });
  await expect(page.getByLabel("Owner")).toHaveValue("seed-reviewer");

  const passport = page.getByRole("listitem").filter({ hasText: "Passport" });
  await passport.getByRole("button", { name: "Approve" }).click();
  await expect(passport.getByText("approved by Demo Reviewer")).toBeVisible();

  await page.getByLabel("Change status").selectOption("in_review");
  await expect(page.getByText(/· In review for/)).toBeVisible();

  const href = await passport.getByRole("link", { name: "Download" }).getAttribute("href");
  const file = await page.request.get(href ?? "");
  expect(file.status()).toBe(200);
  expect(file.headers()["content-disposition"]).toContain("attachment");
});

test("a customer cannot use the back-office actions or files", async ({ page }) => {
  const applicationId = await submitCompleteApplication(page);
  const stage = await page.request.put(`/api/ops/applications/${applicationId}/stage`, { data: { to: "approved" } });
  expect(stage.status()).toBe(403);
  const owner = await page.request.put(`/api/ops/applications/${applicationId}/owner`, { data: { ownerId: null } });
  expect(owner.status()).toBe(403);
});

test("a reviewer cannot make a move the rules refuse", async ({ page }) => {
  const applicationId = await submitCompleteApplication(page);
  await page.request.post("/api/session", { data: { role: "reviewer" } });
  const refused = await page.request.put(`/api/ops/applications/${applicationId}/stage`, { data: { to: "draft" } });
  expect(refused.status()).toBe(409);
});

test("a reviewer asks for more information with two items and the application waits on the customer", async ({ page }) => {
  const applicationId = await submitCompleteApplication(page);
  await page.request.post("/api/session", { data: { role: "reviewer" } });
  await page.goto(`/ops/applications/${applicationId}`);
  await expect(page.getByText("No requests sent yet.")).toBeVisible();

  await page.getByLabel("What to ask for, item 1").selectOption("passport");
  await page.getByLabel("Reason, item 1").selectOption("expired");
  await page.getByLabel("Message, item 1", { exact: true }).fill("Please upload the renewed passport");
  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByLabel("What to ask for, item 2").selectOption("company_details");
  await page.getByLabel("Reason, item 2").selectOption("details_do_not_match");
  await page.getByRole("button", { name: "Send request" }).click();

  await expect(page.getByText("Passport: Expired · Please upload the renewed passport")).toBeVisible();
  await expect(page.getByText("Company details: Details do not match")).toBeVisible();
  await expect(page.getByText(/· Waiting on customer for/)).toBeVisible();
});

test("an empty request is refused by the server", async ({ page }) => {
  const applicationId = await submitCompleteApplication(page);
  await page.request.post("/api/session", { data: { role: "reviewer" } });
  const refused = await page.request.post(`/api/ops/applications/${applicationId}/requests`, { data: { items: [] } });
  expect(refused.status()).toBe(400);
});

test("the page shows the company, signatory, contact and plan cards and a timeline of what happened", async ({ page }) => {
  const applicationId = await submitCompleteApplication(page);
  await page.request.post("/api/session", { data: { role: "reviewer" } });
  await page.request.put(`/api/ops/applications/${applicationId}/owner`, { data: { ownerId: "seed-reviewer" } });
  await page.goto(`/ops/applications/${applicationId}`);

  for (const title of ["Company", "Authorised signatory", "Contact person", "Plan", "Timeline"]) {
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  }
  await expect(page.getByText("Limited liability company (LLC)")).toBeVisible();
  await expect(page.getByText("1 × Wireless business headset")).toBeVisible();
  await expect(page.getByText("Not found on the trade licence").first()).toBeVisible();

  const timeline = page.getByRole("list").filter({ hasText: "Submitted the application" });
  await expect(timeline.getByText("Assigned to Demo Reviewer")).toBeVisible();
  await expect(timeline.getByText("Risk assessment ready")).toBeVisible();
  await expect(timeline.getByText("Uploaded Passport")).toBeVisible();
});

test("the risk card shows the score, its band, the checks across documents and the statement summary", async ({ page }) => {
  const applicationId = await submitCompleteApplication(page);
  await page.request.post("/api/session", { data: { role: "reviewer" } });
  await page.goto(`/ops/applications/${applicationId}`);

  await expect(page.getByRole("heading", { name: "Overall risk", exact: true })).toBeVisible();
  await expect(page.getByText(/Green|Amber|Red · Recommend reject/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Other checks across documents" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bank statement summary" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open score card" })).toHaveCount(0);
});
