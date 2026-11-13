import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { TRANSACTION_LABELS, type RowLabel } from "@/kyc/statements/label-transactions";
import type { LabelledTransaction } from "@/kyc/statements/money-figures";
import type { Database } from "./client";
import { transactions } from "./schema";

export type StoredTransaction = Omit<LabelledTransaction, "label"> & { id: number; documentId: number; label: RowLabel["label"] | null };

const labelSchema = z.enum(TRANSACTION_LABELS).nullable();

// The stored rows of the given statements, oldest first within each statement.
export async function listStatementRows(db: Database, documentIds: readonly number[]): Promise<StoredTransaction[]> {
  if (documentIds.length === 0) return [];
  const rows = await db.select().from(transactions).where(inArray(transactions.documentId, [...documentIds])).orderBy(transactions.id);
  return rows.map((row) => ({ ...row, label: labelSchema.parse(row.label) }));
}

export async function saveLabels(db: Database, labels: ReadonlyMap<number, RowLabel>): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [id, { label, payer }] of labels) await tx.update(transactions).set({ label, payer }).where(eq(transactions.id, id));
  });
}
