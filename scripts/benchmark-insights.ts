// Compares AI providers on the reviewer insights step: speed, tokens, valid answers and
// faithfulness, on invented findings only (tests/fixtures/insight-scenarios.ts).
//   npm run benchmark:insights            → 3 runs per scenario and provider
// Results go to test-documents/benchmarks/ (git-ignored). Keys come from .env.local and are
// never printed. Every run is a paid (or free-tier) API call.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { insightsRequest, isFaithful } from "@/kyc/insights/write-insights";
import type { LlmProvider } from "@/kyc/interfaces/llm-provider";
import { createAnthropicLlmProvider } from "@/providers/anthropic/anthropic-llm-provider";
import { createGeminiLlmProvider } from "@/providers/gemini/gemini-llm-provider";
import { createMistralLlmProvider } from "@/providers/mistral/mistral-llm-provider";
import { insightScenarios } from "../tests/fixtures/insight-scenarios";

process.loadEnvFile(".env.local");
const RUNS = Number(process.argv[2] ?? 3);
const TIMEOUT_MS = 60_000;

const key = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set in .env.local`);
  return value;
};

const providers: { name: string; model: string; llm: LlmProvider }[] = [
  {
    name: "Mistral",
    model: "mistral-small-latest",
    llm: createMistralLlmProvider({ apiKey: key("MISTRAL_API_KEY") }, { model: "mistral-small-latest" }),
  },
  {
    name: "Claude",
    model: "claude-haiku-5-5",
    llm: createAnthropicLlmProvider({ apiKey: key("ANTHROPIC_API_KEY"), model: "claude-haiku-5-5", effort: "low" }),
  },
  { name: "Gemini", model: "gemini-3.5-flash", llm: createGeminiLlmProvider({ apiKey: key("GEMINI_API_KEY"), model: "gemini-3.5-flash" }) },
];

type Run = {
  provider: string;
  model: string;
  scenario: string;
  run: number;
  ms: number;
  ok: boolean;
  validShape: boolean;
  faithful: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  answer: unknown;
};

async function measure(provider: (typeof providers)[number], scenario: (typeof insightScenarios)[number], run: number): Promise<Run> {
  const request = insightsRequest(scenario.findings, TIMEOUT_MS);
  const started = performance.now();
  const result = await provider.llm.generateJson(request);
  const ms = Math.round(performance.now() - started);
  const parsed = result.ok ? request.outputSchema.safeParse(result.json) : null;
  return {
    provider: provider.name,
    model: provider.model,
    scenario: scenario.name,
    run,
    ms,
    ok: result.ok,
    validShape: parsed?.success ?? false,
    faithful: parsed?.success ? isFaithful(parsed.data, scenario.findings) : false,
    inputTokens: result.ok ? (result.usage?.inputTokens ?? null) : null,
    outputTokens: result.ok ? (result.usage?.outputTokens ?? null) : null,
    answer: result.ok ? result.json : result.reason,
  };
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0 ? null : sorted[Math.floor(sorted.length / 2)];
};

async function main() {
  const runs: Run[] = [];
  // One call at a time, so no provider is slowed by the others or by rate limits.
  for (const provider of providers) {
    for (const scenario of insightScenarios) {
      for (let run = 1; run <= RUNS; run += 1) runs.push(await measure(provider, scenario, run));
    }
  }
  const outDir = path.join(process.cwd(), "test-documents", "benchmarks");
  mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `insights-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(runs, null, 2));

  console.log("provider | model | calls | answered | valid shape | faithful | median ms | max ms | median in tokens | median out tokens");
  for (const provider of providers) {
    const own = runs.filter((run) => run.provider === provider.name);
    const count = (test: (run: Run) => boolean) => own.filter(test).length;
    const numbers = (pick: (run: Run) => number | null) => own.flatMap((run) => (pick(run) === null ? [] : [pick(run) as number]));
    console.log(
      [
        provider.name,
        provider.model,
        own.length,
        count((run) => run.ok),
        count((run) => run.validShape),
        count((run) => run.faithful),
        median(own.map((run) => run.ms)),
        Math.max(...own.map((run) => run.ms)),
        median(numbers((run) => run.inputTokens)),
        median(numbers((run) => run.outputTokens)),
      ].join(" | "),
    );
  }
  console.log(`\nAll answers: ${path.relative(process.cwd(), file)}`);
}

void main();
