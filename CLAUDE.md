# CLAUDE.md

Instructions for any AI coding assistant working in this repo. Read `docs/PRD.md`, `docs/ARCHITECTURE.md` and `docs/SECURITY.md` before writing code. If code and docs disagree, stop and ask.

## 1. What this repo is

A KYC document-check and risk-assessment module for Revent Business. Customers upload documents, the module checks each one, and after Submit it produces a score, band, reasons and money figures for reviewers. Principle: **AI reads, code decides, people approve.**

## 2. How to work

1. **One step at a time.** Pick one small task: one check, one screen, one table. State the plan in 2–4 lines before coding.
2. **Test first, or with the code.** Every check, figure and scoring rule gets a Vitest test with a fixture. A step is not done until its tests pass.
3. **Run the gate before saying "done":** typecheck, lint, unit tests. For UI or API changes, also the relevant e2e test.
4. **Explain what changed:** files touched, why, how it was tested. Keep it short.

## 3. When something doesn't work

Don't patch around a failure or loosen a test to make it pass.

1. Find the cause: name the file and line, the input, and what was expected vs what happened.
2. If the approach itself is wrong (a provider can't read a document type, a rule gives false alarms), propose **one** alternative and say why.
3. Try it on the same test case.
4. Record it in `docs/ARCHITECTURE.md` → Decision log: add a row with status `trying`, then change it to `adopted` or `dropped` with the evidence.
5. Update the docs only after the new approach passes. Docs describe what works, not what was hoped.

## 4. Code style

**TypeScript**

- `strict` on. No `any`, no `@ts-ignore`, no non-null `!` without a comment saying why it's safe.
- Zod schemas at every boundary: API input, AI output, JSON columns. Infer types from schemas.
- Prefer pure functions. `src/kyc/` and `src/plan/` never import from Next.js, the database client, `src/providers/`, `sharp`, `pdf-lib` or `pdfjs-dist`. They receive data and return data.
- The `FileStore`, `OcrProvider`, `LlmProvider` and `PdfTextReader` interfaces live in `src/kyc/` and are passed in as arguments. Real implementations (and `sharp`, `pdf-lib`, `pdfjs-dist`) live in `src/providers/`.
- Expected failures return results (`{ ok: false, reason }`); throw only for bugs.

**Money and dates**

- Money is an integer in fils. Never use floating-point maths on money. Format only at display.
- Rounding is half-up to whole fils, done once at the end (VAT on the monthly total, averages after summing in fils). The helpers live in `src/plan/money.ts`.
- Ratios (lease to income, debt to income, confidence, block results) are integer basis points (1% = 100 bps). Never compare floats.
- Timestamps (`submitted_at`, `createdAt`) are ISO strings in UTC. Calendar dates (document dates, expiry, transactions, "today") are date-only `YYYY-MM-DD` in Asia/Dubai.

**Naming and size**

- Files: `kebab-case.ts`. Types: `PascalCase`. Functions and variables: `camelCase`. Check codes: `UPPER_SNAKE`.
- One check per file in `src/kyc/checks/`, named after its code (`doc-expired.ts` → `DOC_EXPIRED`).
- A function over ~40 lines or a file over ~200 lines is a sign to split.
- Names say what something is (`leaseToIncomeRatio`, not `ratio2`).

**Comments**

- Explain _why_, not _what_. No commented-out code. No TODO without an owner and reason.

**UI**

- Use existing shadcn/ui components and Tailwind tokens. No custom CSS unless there is no component for it.
- Every customer-facing string goes through next-intl, in both `messages/en.json` and `messages/ar.json` (repo root). Check RTL layout.
- The team (reviewer) UI is English-only in v1 and lives outside `[locale]`. `CheckResult.detail` and the summary are English for reviewers; customers only ever see text from `customerMessageKey`.

**Database**

- Schema changes only through Drizzle migrations. Never `db:push`.
- Risk weights and thresholds live in `scoring_settings`, never as constants in code.
- Upload safety limits (file size, page count) live in `src/config/limits.ts`, read from env with defaults.

## 5. AI calls

- Only through `OcrProvider` / `LlmProvider`. Never call a provider SDK directly from `src/kyc/` or `src/app/`.
- Every LLM call has a fixed output schema, a timeout, and one retry. Invalid output → `Needs review`, never a guess.
- The LLM never does arithmetic that is used in a decision. Code recomputes every number.
- Mask personal fields before sending (see `docs/SECURITY.md` §2).

## 6. Do not

- Add a dependency without saying why the existing stack can't do it.
- Commit real customer documents, secrets or `.env` files.
- Log document content or personal fields.
- Add features, files or abstractions not needed for the current step.
- Make the system approve or reject an application.
- Write logic for a specific demo scenario. Demo cases are seed data (`src/db/seed/`, `tests/fixtures/`) only; no scenario names, IDs or special cases in `src/`.
- Hardcode prices or the route threshold. Prices come from the `prices` table; the threshold comes from `scoring_settings`.

## 7. Definition of done

- [ ] Matches PRD and ARCHITECTURE (or the docs were updated via the decision log)
- [ ] Typecheck, lint and tests pass
- [ ] New customer-facing strings in EN and AR
- [ ] No personal data in code, fixtures or logs
- [ ] Small, focused change with a clear description

Never add Co-Authored-By or any attribution lines to commits or PRs.
