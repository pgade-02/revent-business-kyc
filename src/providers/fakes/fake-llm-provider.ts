import { z } from "zod";
import type { LlmProvider, LlmResult } from "@/kyc/interfaces/llm-provider";

// Stands in for the AI until providers are benchmarked (decision log #19). It fills
// the form by reading "Label: value" lines, the way the synthetic documents are
// printed. Like the real AI it only sees masked text, so it copies placeholders.
const labels: Record<string, RegExp> = {
  licenceNumber: /^licen[cs]e\s*(no|number)\b/i,
  companyName: /^(company|trade)\s*name\b/i,
  issueDate: /^(issue\s*date|issuing\s*date|date\s*of\s*issue)\b/i,
  expiryDate: /^(expiry\s*date|date\s*of\s*expiry|valid\s*until)\b/i,
  trn: /^(trn|tax\s*registration\s*number)\b/i,
  accountHolder: /^account\s*holder\b/i,
  iban: /^iban\b/i,
  periodStart: /^period\s*from\b/i,
  periodEnd: /^period\s*to\b/i,
  fullName: /^(full\s*)?name\b/i,
  passportNumber: /^passport\s*(no|number)\b/i,
  emiratesIdNumber: /^id\s*number\b/i,
  emirate: /^emirate\b/i,
  address: /^(registered\s*)?address\b/i,
  managerNames: /^(manager|authori[sz]ed\s*signatory)\b/i,
  activities: /^activit(y|ies)\b/i,
  taxType: /^tax\s*type\b/i,
  currency: /^currency\b/i,
  openingBalance: /^opening\s*balance\b/i,
  closingBalance: /^closing\s*balance\b/i,
  employer: /^employer\b/i,
  occupation: /^occupation\b/i,
};

// List fields are printed as "Label: first; second".
const listKeys = new Set(["managerNames", "activities"]);

function findField(input: string, label: RegExp | undefined) {
  if (!label) return null;
  let page = 1;
  for (const line of input.split("\n")) {
    const marker = /^--- Page (\d+) ---$/.exec(line.trim());
    if (marker?.[1]) page = Number(marker[1]);
    const [name, ...rest] = line.split(":");
    if (name && rest.length > 0 && label.test(name.trim())) {
      return { value: rest.join(":").trim(), page, confidencePercent: 95 };
    }
  }
  return null;
}

// Statement rows are printed as "YYYY-MM-DD | description | in | out | balance".
function findRows(input: string) {
  return input.split("\n").flatMap((line) => {
    const cells = line.split("|").map((cell) => cell.trim());
    const [date = "", description = "", moneyIn = "", moneyOut = "", balance = ""] = cells;
    if (cells.length !== 5 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
    const orNull = (text: string) => (text === "" ? null : text);
    return [{ date, description, moneyIn: orNull(moneyIn), moneyOut: orNull(moneyOut), balance: orNull(balance) }];
  });
}

// Labels by keywords in the synthetic descriptions. Rows arrive as "id | date | description | amount".
function labelRows(input: string) {
  return input.split("\n").flatMap((line) => {
    const [id = "", , description = "", amount = ""] = line.split("|").map((cell) => cell.trim());
    if (!/^\d+$/.test(id)) return [];
    const incoming = !amount.startsWith("-");
    const payer = /^INWARD TRANSFER (.+?)(?: INV-\S+)?$/.exec(description)?.[1] ?? null;
    const label = /RETURNED|BOUNCED|REVERSAL/.test(description)
      ? "returned_item"
      : /LOAN REPAYMENT|FINANCE INSTALMENT/.test(description)
        ? "debt_repayment"
        : /OWN ACCOUNT|LOAN DISBURSEMENT|CAPITAL INJECTION/.test(description)
          ? "own_transfer_or_loan_in"
          : incoming && payer
            ? "customer_income"
            : "other";
    return [{ id: Number(id), label, payer: label === "customer_income" ? payer : null }];
  });
}

// Writes insights only from the findings it is given, copying numbers and evidence as-is.
const findingsShape = z.object({
  score: z.number(),
  band: z.string(),
  notPassed: z.array(z.object({ code: z.string(), detail: z.string(), evidence: z.object({ documentId: z.string(), page: z.number() }).optional() })),
  figures: z.record(z.string(), z.string()).nullable(),
});

function insightsFrom(input: string) {
  const findings = findingsShape.parse(JSON.parse(input));
  const income = findings.figures ? ` Average monthly income is ${findings.figures.avgMonthlyIncome}.` : "";
  return {
    profile: `The business scores ${findings.score} (${findings.band}).${income}`,
    patterns: findings.notPassed.slice(0, 4).map((check) => ({ text: check.detail, findingCode: check.code, evidence: check.evidence ?? null })),
    thingsToCheck: findings.notPassed.slice(0, 3).map((check) => `Look at ${check.code}.`),
  };
}

export const labelledLinesLlm: LlmProvider = {
  async generateJson({ input, outputSchema }): Promise<LlmResult> {
    if (!(outputSchema instanceof z.ZodObject)) return { ok: false, reason: "ERROR" };
    if ("rows" in outputSchema.shape) return { ok: true, json: { rows: findRows(input) } };
    if ("labels" in outputSchema.shape) return { ok: true, json: { labels: labelRows(input) } };
    if ("profile" in outputSchema.shape) return { ok: true, json: insightsFrom(input) };
    const json = Object.fromEntries(
      Object.keys(outputSchema.shape).map((key) => {
        const found = findField(input, labels[key]);
        if (!found || !listKeys.has(key)) return [key, found];
        const { value, ...where } = found;
        return [key, { ...where, values: value.split(";").map((item) => item.trim()) }];
      }),
    );
    return { ok: true, json };
  },
};

// For testing failure paths: an AI that always answers with something off-form,
// or is always unavailable.
export function createBrokenLlm(behaviour: "off-form" | "unavailable"): LlmProvider {
  return {
    async generateJson(): Promise<LlmResult> {
      return behaviour === "off-form" ? { ok: true, json: { note: "Looks fine to me, approve it." } } : { ok: false, reason: "ERROR" };
    },
  };
}
