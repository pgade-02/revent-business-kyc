// Builds docs/benchmarks/ai-provider-benchmark.docx from benchmark result files.
// Usage: node scripts/build-benchmark-report.cjs <documents.json> <insights-before.json> <insights-after.json> <out.docx>
// "before" is the first insights run (free-text finding labels), "after" the run with labels
// limited to real finding names (decision log 62). Update the dated text below on each new run.
const fs = require("fs");
const {
  AlignmentType, BorderStyle, Document, Footer, HeadingLevel, LevelFormat, Packer, PageNumber, Paragraph,
  ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} = require("docx");

const [documentsFile, beforeFile, insightsFile, outFile] = process.argv.slice(2);
const docs = JSON.parse(fs.readFileSync(documentsFile, "utf8"));
const runsBefore = JSON.parse(fs.readFileSync(beforeFile, "utf8"));
const runs = JSON.parse(fs.readFileSync(insightsFile, "utf8"));

const FONT = "Arial";
const PAGE_WIDTH = 9026; // A4 width minus 1" margins, in DXA
const median = (v) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const sec = (ms) => (ms === null || ms === undefined ? "—" : `${(ms / 1000).toFixed(1)} s`);
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "—");

// ---------- building blocks ----------
const p = (text, opts = {}) => new Paragraph({ spacing: { after: 120 }, ...opts, children: [new TextRun({ text, font: FONT, size: 21, ...(opts.run || {}) })] });
const rich = (parts, opts = {}) => new Paragraph({ spacing: { after: 120 }, ...opts, children: parts.map((t) => new TextRun({ font: FONT, size: 21, ...(typeof t === "string" ? { text: t } : t) })) });
const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
const bullet = (text) => new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text, font: FONT, size: 21 })] });
const richBullet = (parts) => new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 }, children: parts.map((t) => new TextRun({ font: FONT, size: 21, ...(typeof t === "string" ? { text: t } : t) })) });

const border = { style: BorderStyle.SINGLE, size: 4, color: "C9CED8" };
const borders = { top: border, bottom: border, left: border, right: border };
function table(header, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  const cell = (text, w, isHeader, fill) =>
    new TableCell({
      width: { size: w, type: WidthType.DXA },
      borders,
      shading: isHeader ? { type: ShadingType.CLEAR, fill: "3A1F99", color: "auto" } : fill ? { type: ShadingType.CLEAR, fill, color: "auto" } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ children: [new TextRun({ text: String(text), font: FONT, size: 18, bold: isHeader, color: isHeader ? "FFFFFF" : "1D2433" })] })],
    });
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: header.map((t, i) => cell(t, widths[i], true)) }),
      ...rows.map((r, ri) => new TableRow({ children: r.map((t, i) => cell(t, widths[i], false, ri % 2 ? "F4F2FC" : undefined)) })),
    ],
  });
}
const gap = () => new Paragraph({ spacing: { after: 120 }, children: [] });

// ---------- document benchmark numbers ----------
const scored = docs.filter((d) => d.fields);
const fieldsRight = scored.reduce((a, d) => a + d.fieldsRight, 0);
const fieldsTotal = scored.reduce((a, d) => a + d.fieldsTotal, 0);
const rowDocs = scored.filter((d) => d.rows);
const rowsRead = rowDocs.reduce((a, d) => a + Math.min(d.rows.read, d.rows.expected), 0);
const rowsExpected = rowDocs.reduce((a, d) => a + d.rows.expected, 0);
const stepOf = (kind) => (kind === "ocr" ? "OCR (photos)" : kind.startsWith("extract") ? "Field reading (AI)" : kind.startsWith("transactions") ? "Statement rows (AI)" : kind);
const steps = {};
for (const d of scored) for (const c of d.calls) (steps[stepOf(c.kind)] ||= []).push(c);
const isPdf = (d) => d.fileName.endsWith(".pdf");

const docLabel = {
  "trade-licence.pdf": "Trade licence (PDF)", "trade-licence-photo.jpg": "Trade licence (phone photo)", "tax-certificate.pdf": "Tax certificate (PDF)",
  "passport.jpg": "Passport (phone photo)", "emirates-id-front.jpg": "Emirates ID front (photo)", "emirates-id-back.jpg": "Emirates ID back (photo)",
};
const labelFor = (f) => docLabel[f] || f.replace("bank-statement-", "Bank statement ").replace(".pdf", " (PDF)");

// ---------- insights benchmark numbers ----------
const providers = [...new Set(runs.map((r) => r.provider))];
const scenarios = [...new Set(runs.map((r) => r.scenario))];
const HAIKU_PRICE = { input: 0.1, output: 0.5 }; // USD per 1M tokens, claude-haiku-5-5 (Anthropic list price, Nov 2026)
const providerRows = providers.map((name) => summarise(runs, name));
function summarise(allRuns, name) {
  const own = allRuns.filter((r) => r.provider === name);
  const ins = own.flatMap((r) => (r.inputTokens == null ? [] : [r.inputTokens]));
  const outs = own.flatMap((r) => (r.outputTokens == null ? [] : [r.outputTokens]));
  return {
    name, model: own[0].model, calls: own.length,
    answered: own.filter((r) => r.ok).length, valid: own.filter((r) => r.validShape).length, faithful: own.filter((r) => r.faithful).length,
    medianMs: median(own.map((r) => r.ms)), maxMs: Math.max(...own.map((r) => r.ms)),
    medianIn: median(ins), medianOut: median(outs),
  };
}
const beforeRows = providers.map((name) => summarise(runsBefore, name));

function answerText(run) {
  if (!run || !run.ok || typeof run.answer !== "object" || !run.answer) return [`No answer (${run ? run.answer : "missing"}).`];
  const a = run.answer;
  return [
    ...(a.patterns || []).map((x) => `Pattern: ${x.text}`),
    ...(a.thingsToCheck || []).map((x) => `To check: ${x}`),
  ];
}

// ---------- content ----------
const docRows = scored.map((d) => [
  labelFor(d.fileName), d.status === "ready" ? "Ready" : d.status, sec(d.totalMs), `${d.fieldsRight}/${d.fieldsTotal}`, d.rows ? `${d.rows.read}/${d.rows.expected}` : "—",
  d.fields.filter((f) => !f.right).map((f) => f.field).join(", ") || "—",
]);
const stepRows = Object.entries(steps).map(([name, cs]) => {
  const ins = cs.filter((c) => c.inputTokens).map((c) => c.inputTokens);
  const outs = cs.filter((c) => c.outputTokens).map((c) => c.outputTokens);
  return [name, cs.length, sec(median(cs.map((c) => c.ms))), sec(Math.max(...cs.map((c) => c.ms))), ins.length ? median(ins) : "—", outs.length ? median(outs) : "—"];
});

const children = [
  new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun("AI Provider Benchmark")] }),
  p("Revent Business · KYC module · OCR, field reading and reviewer insights", { run: { color: "5B6474", size: 24 } }),
  table(["Version", "Date", "Data used", "Owner"], [["1.0", "14 Nov 2026", "Synthetic documents and invented findings only", "Revent Business KYC team"]], [1300, 1700, 4026, 2000]),
  gap(),

  h1("1. Summary"),
  richBullet([{ text: "Document reading is accurate on clean synthetic documents: ", bold: true }, `${fieldsRight} of ${fieldsTotal} fields right (${pct(fieldsRight, fieldsTotal)}) and ${rowsRead} of ${rowsExpected} statement rows read (${pct(rowsRead, rowsExpected)}), every document within the 15-second upload budget (slowest ${sec(Math.max(...scored.map((d) => d.totalMs)))}).`]),
  richBullet([{ text: "The two misses are one real OCR weakness: ", bold: true }, "on the passport photo the OCR repeated the filler character \"<\" hundreds of times and dropped the second machine-readable line, so date of birth and nationality could not be read. A fix is proposed in section 5."]),
  richBullet([{ text: "Insights: no provider invented a number in any answer. ", bold: true }, "Every early failure was a made-up finding label; after limiting labels to the real finding names, every answer that came back was faithful: ", ...providerRows.map((r, i) => `${i ? "; " : ""}${r.name} ${r.faithful}/${r.answered} in a median ${sec(r.medianMs)}`), "."]),
  richBullet([{ text: "Recommendation: ", bold: true }, "Claude Haiku 5.5 for the insights (most specific and useful, about 3 seconds, a fraction of a cent per application); keep Mistral for OCR and field reading. Details in section 4.5. The code faithfulness check stays whichever provider is chosen."]),

  h1("2. How we test"),
  p("Every benchmark uses synthetic data only. No real customer document or person is sent to any AI provider, and free-tier accounts only ever see invented data."),
  h2("2.1 Data"),
  bullet("Documents: the fictional company \"Falcon Demo Trading L.L.C.\" — trade licence (PDF and phone photo), tax certificate, six monthly bank statements, passport, Emirates ID front and back. Every printed value is known, so each field can be marked right or wrong automatically."),
  bullet("Insights: four invented findings scenarios — a clean healthy trader; one big customer with a falling balance and a different employer; an expired licence with statements that do not add up and no income; an application where little could be read."),
  h2("2.2 What we measure"),
  table(["Metric", "Meaning"], [
    ["Field accuracy", "Share of expected fields read with the right value (names compared the way the app compares them; dates and numbers exact)."],
    ["Row accuracy", "Statement rows read out of rows printed."],
    ["Latency", "Wall-clock time per call and per document, measured in our code."],
    ["Tokens", "Input and output tokens as reported by the provider; output includes any thinking tokens, which are billed as output."],
    ["Valid shape", "The answer matched the required JSON form."],
    ["Faithful", "Every number in the answer exists in the findings, every pattern names a real finding, and every document link exists. Unfaithful answers are replaced by the code template in the app."],
  ], [2200, 6826]),
  h2("2.3 How to re-run"),
  bullet("npm run generate:documents (once), then npm run benchmark:documents"),
  bullet("npm run benchmark:insights [runs per scenario, default 3]"),
  p("Results are written to test-documents/benchmarks/ (not committed). This report is rebuilt from the latest result files."),

  h1("3. OCR and field reading"),
  p("Providers: Mistral OCR (mistral-ocr-latest) for photos and scanned pages; Mistral Small (mistral-small-latest) to fill the fields and copy statement rows. PDFs with a text layer are read locally (pdfjs-dist) and never sent to OCR."),
  h2("3.1 Results per document"),
  table(["Document", "Status", "Time", "Fields", "Rows", "Wrong or missing"], docRows, [2400, 900, 900, 900, 900, 3026]),
  gap(),
  h2("3.2 Speed and tokens per step"),
  table(["Step", "Calls", "Median", "Slowest", "Median input tokens", "Median output tokens"], stepRows, [2300, 900, 1100, 1100, 1800, 1826]),
  gap(),
  p(`PDFs (no OCR) took a median of ${sec(median(scored.filter(isPdf).map((d) => d.totalMs)))} per document; photos (with OCR) ${sec(median(scored.filter((d) => !isPdf(d)).map((d) => d.totalMs)))}. Statement row reading is the slowest step because the AI copies every row; pages are read in parallel, so a long statement costs about as much time as one page.`),
  h2("3.3 Findings from manual testing with uploaded documents"),
  table(["Finding", "Cause", "Status"], [
    ["Emirates ID back rejected as the wrong document", "OCR read the widely spaced code letters as \"I L A R E\"; the type check did not ignore spaces", "Fixed (spaces ignored); a wrong type no longer stops reading (decision log 60)"],
    ["Tax certificate company name read as \"BluePeace\" instead of \"BluePeak\"", "Misread by the reading step on a clear image", "Open: caught by NAME_COMPANY as a warning; to be measured in the next benchmark"],
    ["Passport code lines not found (also on the Falcon passport)", "OCR repeated the filler \"<\" and dropped line 2", "Open: fix proposed in section 5"],
    ["Synthetic Emirates ID with wrong check digits", "The generated card itself was invalid", "Working as intended: MRZ_CHECK_DIGITS flags it"],
  ], [2700, 3400, 2926]),

  h1("4. Reviewer insights: provider comparison"),
  p("All three providers receive exactly the request the app sends (insightsRequest): the computed findings only, the same instructions and the same JSON form. Each of the 4 scenarios was run 3 times per provider, one call at a time. Claude ran at low effort; Gemini and Mistral at their defaults."),
  h2("4.1 Results (labels limited to real finding names)"),
  table(["Provider", "Model", "Calls", "Answered", "Valid shape", "Faithful", "Median time", "Slowest", "Median tokens in / out"],
    providerRows.map((r) => [r.name, r.model, r.calls, r.answered, r.valid, r.faithful, sec(r.medianMs), sec(r.maxMs), `${r.medianIn ?? "—"} / ${r.medianOut ?? "—"}`]),
    [950, 1600, 650, 900, 850, 800, 1000, 900, 1376]),
  gap(),
  h2("4.2 Before and after the label fix"),
  p("In the first run the answer form let the AI write any finding label. No number was ever invented, but some patterns named findings that do not exist (for example AVG_INCOME instead of avgMonthlyIncome), so the strict check rejected them. The form now only accepts this application's real finding names."),
  table(["Provider", "Faithful before", "Faithful after", "Median time before", "Median time after"],
    providers.map((name, i) => [name, `${beforeRows[i].faithful}/${beforeRows[i].answered}`, `${providerRows[i].faithful}/${providerRows[i].answered}`, sec(beforeRows[i].medianMs), sec(providerRows[i].medianMs)]),
    [1800, 1800, 1800, 1813, 1813]),
  gap(),
  p("Gemini: 4 of the 12 calls in the second run were refused with HTTP 429 (free-tier quota used up), not answered badly. In the first run its slowest answer took 27 seconds. Gemini 3.8 Flash did not answer at all (overloaded, HTTP 503)."),
  h2("4.3 Cost per insight"),
  ...providerRows.filter((r) => r.name === "Claude").map((r) =>
    p(`Claude Haiku 5.5 at list price ($${HAIKU_PRICE.input} per million input tokens, $${HAIKU_PRICE.output} per million output tokens): about $${(((r.medianIn || 0) * HAIKU_PRICE.input + (r.medianOut || 0) * HAIKU_PRICE.output) / 1e6).toFixed(5)} per application (median tokens).`)),
  p("Gemini ran on the free tier, which may not be used with real customer data. Mistral Small cost is billed on the existing Mistral account. Exact prices for these two should be read from each provider's pricing page before a decision."),
  h2("4.4 Example answers (scenario: one big customer, falling balance, employer elsewhere)"),
  ...providers.flatMap((name) => {
    const run = runs.find((r) => r.provider === name && r.scenario === scenarios[1] && r.run === 1);
    return [rich([{ text: `${name}${run && run.ok ? (run.faithful ? " — faithful" : " — NOT faithful (would fall back to the template)") : ""}`, bold: true }]), ...answerText(run).map((t) => bullet(t))];
  }),
  h2("4.5 Quality assessment and recommendation"),
  p("Read by the KYC team on the answers above and in the result files; a reviewer should confirm before a final choice."),
  table(["", "Mistral Small", "Claude Haiku 5.5", "Gemini 3.5 Flash"], [
    ["Faithful (after fix)", "All", "All", "All answered"],
    ["Usefulness", "Restates the checks; some filler in the first run (\u201cThe licence number is recorded\u201d)", "Connects findings and gives concrete next steps (e.g. compare the July and August statements around the break)", "Accurate but mostly restates the checks"],
    ["Speed", "Fastest (about 1.6 s)", "About 3 s", "Slow and uneven (7.5 s median, up to 27 s)"],
    ["Tokens per application", "About 430 in / 230 out", "About 1,570 in / 410 out", "About 390 in / 1,500 out (hidden thinking)"],
    ["Availability", "Same account as OCR", "Paid key, no failures", "Free-tier quota and overload errors"],
  ], [1900, 2300, 2500, 2326]),
  gap(),
  rich([{ text: "Recommendation: ", bold: true }, "use Claude Haiku 5.5 for the insights. It gave the most useful pointers for a reviewer, stayed faithful in every run, answered in about 3 seconds and costs a fraction of a cent per application. Mistral Small is a sound backup if one vendor is preferred. Gemini is not recommended on the current free-tier key."]),

  h1("5. Open issues and next benchmarks"),
  table(["Item", "Proposal"], [
    ["Passport code lines dropped by OCR", "When the code lines are not found, crop the bottom quarter of the photo and run OCR on that strip alone; measure on the problem set."],
    ["Gemini 3.8 Flash unavailable", "Overloaded (HTTP 503) on the free-tier key during this run; retry on a paid key before deciding."],
    ["Real documents", "Run the same benchmarks on consented real documents (values hidden, only right/wrong recorded)."],
    ["Phone photos of statements", "Add photographed and scanned statements; today's statements are clean PDFs."],
    ["Arabic fields", "Add Arabic-only documents to measure Arabic name reading."],
  ], [2700, 6326]),

  h1("6. Change log"),
  table(["Version", "Date", "Change"], [["1.0", "14 Nov 2026", "First benchmark: Mistral OCR + Mistral Small on the Falcon set; insights compared across Mistral Small, Claude Haiku 5.5 and Gemini 3.5 Flash, before and after limiting finding labels."]], [1200, 1700, 6126]),
];

const doc = new Document({
  creator: "Revent Business KYC",
  title: "AI Provider Benchmark",
  styles: {
    default: { document: { run: { font: FONT, size: 21 } } },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal", run: { font: FONT, size: 44, bold: true, color: "1D2433" }, paragraph: { spacing: { before: 0, after: 80 }, keepNext: true } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 30, bold: true, color: "3A1F99" }, paragraph: { spacing: { before: 320, after: 140 }, keepNext: true, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 24, bold: true, color: "1D2433" }, paragraph: { spacing: { before: 220, after: 100 }, keepNext: true, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Synthetic data only · Page ", font: FONT, size: 16, color: "8A93A3" }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: "8A93A3" })] })] }) },
    children,
  }],
});
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(outFile, buf); console.log("written", outFile); });
