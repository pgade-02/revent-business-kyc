import { z } from "zod";
import type { LlmProvider, LlmResult } from "@/kyc/interfaces/llm-provider";

// Stands in for the AI until providers are benchmarked (decision log #19). It fills
// the form by reading "Label: value" lines, the way the synthetic documents are
// printed. Like the real AI it only sees masked text, so it copies placeholders.
const labels: Record<string, RegExp> = {
  licenceNumber: /^licen[cs]e\s*(no|number)\b/i,
  companyName: /^(company|trade)\s*name\b/i,
  expiryDate: /^(expiry\s*date|date\s*of\s*expiry|valid\s*until)\b/i,
  trn: /^(trn|tax\s*registration\s*number)\b/i,
  accountHolder: /^account\s*holder\b/i,
  iban: /^iban\b/i,
  periodStart: /^period\s*from\b/i,
  periodEnd: /^period\s*to\b/i,
  fullName: /^(full\s*)?name\b/i,
  passportNumber: /^passport\s*(no|number)\b/i,
  emiratesIdNumber: /^id\s*number\b/i,
};

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

export const labelledLinesLlm: LlmProvider = {
  async generateJson({ input, outputSchema }): Promise<LlmResult> {
    if (!(outputSchema instanceof z.ZodObject)) return { ok: false, reason: "ERROR" };
    const json = Object.fromEntries(Object.keys(outputSchema.shape).map((key) => [key, findField(input, labels[key])]));
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
