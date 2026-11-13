import type { Database } from "@/db/client";
import { listStatementRows, saveLabels, type StoredTransaction } from "@/db/transactions";
import { coveredMonths } from "@/kyc/checks/stmt-coverage";
import { textField } from "@/kyc/extraction/extract-fields";
import type { LlmProvider } from "@/kyc/interfaces/llm-provider";
import { labelTransactions } from "@/kyc/statements/label-transactions";
import { computeMoneyFigures, type LabelledTransaction, type MoneyFigures } from "@/kyc/statements/money-figures";
import type { SubmittedDocument } from "@/kyc/submit/cross-checks";
import { parseAmountFils } from "@/plan/money";

export type FiguresOutcome = { figures: MoneyFigures | null; problem: string | null };

type Input = {
  documents: readonly SubmittedDocument[];
  coverage: { submitMonth: string; monthsRequired: number };
  planMonthlyFils: number;
  ai: { llm: LlmProvider; timeoutMs: number };
};

// A currency that was not read counts as AED, as in STMT_CURRENCY.
const isAedStatement = (document: SubmittedDocument) =>
  document.slot === "bank_statement" && (textField(document.fields, "currency")?.value.trim().toUpperCase() ?? "AED") === "AED";

async function labelled(db: Database, rows: StoredTransaction[], ai: Input["ai"]): Promise<(LabelledTransaction & { documentId: number })[] | null> {
  const unlabelled = rows.filter((row) => row.label === null);
  if (unlabelled.length > 0) {
    const result = await labelTransactions({ rows: unlabelled, ...ai });
    if (!result.ok) return null;
    await saveLabels(db, result.data);
    for (const row of unlabelled) Object.assign(row, result.data.get(row.id));
  }
  return rows.flatMap(({ label, ...row }) => (label ? [{ ...row, label }] : []));
}

// Part 2, steps 2–3: label the stored rows (once; a resubmit reuses them), then compute the
// figures in code. Labelling that fails leaves the figures empty with the reason, never a guess.
export async function statementFigures(db: Database, input: Input): Promise<FiguresOutcome> {
  const statements = input.documents.filter(isAedStatement);
  const months = coveredMonths({
    ...input.coverage,
    statements: statements.map((statement) => ({
      documentId: statement.id,
      periodStart: textField(statement.fields, "periodStart")?.value ?? null,
      periodEnd: textField(statement.fields, "periodEnd")?.value ?? null,
    })),
  });
  if (months.length === 0) return { figures: null, problem: "No full statement month is covered." };

  const rows = await listStatementRows(db, statements.map((statement) => Number(statement.id)));
  const labelledRows = await labelled(db, rows, input.ai);
  if (!labelledRows) return { figures: null, problem: "Transactions could not be labelled (AI unavailable or answer off-form)." };

  const figures = computeMoneyFigures({
    months,
    planMonthlyFils: input.planMonthlyFils,
    statements: statements.map((statement) => {
      const opening = textField(statement.fields, "openingBalance");
      return {
        openingFils: opening ? parseAmountFils(opening.value) : null,
        transactions: labelledRows.filter((row) => String(row.documentId) === statement.id),
      };
    }),
  });
  return { figures, problem: null };
}
