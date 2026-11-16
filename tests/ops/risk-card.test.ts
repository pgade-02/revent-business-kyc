import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RiskCard } from "@/components/ops/risk-card";
import type { SavedAssessment } from "@/db/assessments";

const block = { bps: 10_000, confidenceBps: 10_000 };
const assessment = (hardStops: string[]): SavedAssessment => ({
  id: 1,
  createdAt: "2026-11-16T09:00:00.000Z",
  scoringSettingsVersion: 1,
  checks: [],
  figures: null,
  figuresProblem: "no statements",
  insights: null,
  score: { score: 90, band: hardStops.length > 0 ? "RED" : "GREEN", confidenceBps: 10_000, hardStops, blocks: { documents: block, identity: block, financial: block, integrity: block } },
});
const render = (hardStops: string[]) => renderToStaticMarkup(createElement(RiskCard, { assessment: assessment(hardStops), otherChecks: [], slots: new Map() }));

describe("RiskCard", () => {
  it("shows the score and band when nothing stops the application", () => {
    const html = render([]);
    expect(html).toContain(">90<");
    expect(html).toContain("Green");
  });

  it("shows each stop once as a failure, in place of the score", () => {
    const html = render(["Emirates ID has expired.", "Emirates ID has expired."]);
    expect(html.match(/Failed: Emirates ID has expired\. This stops the application\./g)).toHaveLength(1);
    expect(html).not.toContain(">90<");
    expect(html).not.toContain("Recommend reject");
  });
});
