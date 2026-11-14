import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "@/db/client";
import { insertDocument, saveProcessingResult } from "@/db/documents";
import { applications } from "@/db/schema";
import { seedDatabase } from "@/db/seed/seed";
import { checkDocReading } from "@/kyc/checks/doc-reading";
import { labelledLinesLlm } from "@/providers/fakes/fake-llm-provider";
import { createApplication } from "@/services/applications";
import { listReviewQueue, loadReviewPage, recordReviewAction } from "@/services/review";
import { runAssessment } from "@/services/run-assessment";

let db: Database;
const plan = { term: 36 as const, lines: [{ productId: "wireless-business-headset", quantity: 1, serviceIds: [] }] };

beforeAll(async () => {
  db = await openDatabase();
  await seedDatabase(db);
});

afterAll(async () => {
  await db.$client.close();
});

async function newApplication(submitted: boolean) {
  const created = await createApplication(db, "seed-customer", plan);
  if (!created.ok) throw new Error(created.reason);
  if (submitted) {
    await db
      .update(applications)
      .set({ status: "submitted", submittedAt: "2026-11-13T08:00:00.000Z" })
      .where(eq(applications.id, created.applicationId));
  }
  return created.applicationId;
}

describe("review", () => {
  it("lists only submitted applications in the team's queue", async () => {
    const draft = await newApplication(false);
    const submitted = await newApplication(true);
    const queue = await listReviewQueue(db);
    expect(queue.map((item) => item.id)).toContain(submitted);
    expect(queue.map((item) => item.id)).not.toContain(draft);
  });

  it("records a decision against the score card the reviewer saw, and shows it in the history", async () => {
    const applicationId = await newApplication(true);
    const assessmentId = await runAssessment(db, applicationId, { llm: labelledLinesLlm, timeoutMs: 1_000 });
    await recordReviewAction(db, {
      applicationId,
      reviewerId: "seed-reviewer",
      action: { action: "reject", reason: "Income does not support the lease." },
    });

    const [row] = await db.select().from(applications).where(eq(applications.id, applicationId));
    if (!row) throw new Error("application missing");
    const page = await loadReviewPage(db, row);
    expect(page.assessment?.id).toBe(assessmentId);
    expect(page.actions).toEqual([
      expect.objectContaining({ action: "reject", reason: "Income does not support the lease.", reviewerName: expect.any(String) }),
    ]);
    expect(row.status).toBe("submitted"); // a decision is recorded; the system changes nothing else
  });
});

describe("document checklist", () => {
  it("shows a document that was never checked as 'could not check', never as a pass", async () => {
    const applicationId = await newApplication(true);
    await insertDocument(db, {
      applicationId,
      slot: "passport",
      fileKey: "test/unchecked",
      fileKind: "pdf",
      sizeBytes: 1,
      pageCount: 1,
      sha256: `unchecked-${applicationId}`,
    });
    const [row] = await db.select().from(applications).where(eq(applications.id, applicationId));
    if (!row) throw new Error("application missing");
    expect((await loadReviewPage(db, row)).checklist).toEqual([
      expect.objectContaining({ slot: "passport", status: "skipped", results: [] }),
    ]);
  });
});

describe("a reading step that failed", () => {
  it("shows the document as Fail on the review page, with the reason, instead of Pass", async () => {
    const applicationId = await newApplication(true);
    const documentId = await insertDocument(db, {
      applicationId,
      slot: "bank_statement",
      fileKey: "test/rows",
      fileKind: "pdf",
      sizeBytes: 1,
      pageCount: 1,
      sha256: `rows-${applicationId}`,
    });
    await saveProcessingResult(db, documentId, {
      status: "needs_review",
      fields: null,
      results: [{ code: "DOC_UNREADABLE", status: "pass", detail: "ok" }, checkDocReading(String(documentId), "UNREADABLE_ROW")],
    });
    const [row] = await db.select().from(applications).where(eq(applications.id, applicationId));
    if (!row) throw new Error("application missing");
    const [statement] = (await loadReviewPage(db, row)).checklist;
    expect(statement).toMatchObject({ slot: "bank_statement", status: "fail" });
    expect(statement?.results.find((result) => result.code === "DOC_READING")?.detail).toBe(
      "A statement row could not be read as money, so no rows were kept.",
    );
  });
});
