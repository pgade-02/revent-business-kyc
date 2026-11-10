# PRD: KYC document checks and risk assessment

Status: v1 draft · Owner: Prerna Gade · Product: Revent Business

## 1. Problem

Revent Business leases office devices to UAE SMEs. In KYC Step 2 ("Business verification") the customer uploads company and identity documents. Today the upload slots only confirm that a file arrived ("Uploaded"). Nothing is read or checked. After Submit, the onboarding team opens every document by hand and decides whether the business looks genuine and able to pay.

This is slow, inconsistent between reviewers, and problems (wrong file, blurry photo, missing month) are found days later instead of at upload.

## 2. Goal

1. Check each document **while the customer is still on the upload page**, and tell them how to fix problems straight away.
2. After Submit, give the finance team **one review page** per application: a score, a colour band, the reasons with evidence (document + page), and key money figures from the bank statements.
3. People make every final decision. The system never approves or rejects on its own.

## 3. Users

| User | Needs |
|---|---|
| Customer (SME owner or staff) | Clear, immediate feedback on each upload, in English or Arabic |
| Finance / onboarding team | A fast, trustworthy summary with proof, so they review exceptions, not every page |
| Developers | Small, testable modules; settings changeable without code changes |

## 4. Scope (v1)

### In scope

Where the module plugs into the existing journey:

| Journey step | Our addition |
|---|---|
| Step 2 → Business documents (trade licence, tax registration certificate, 6 months of bank statements) | Per-document checks at upload |
| Step 2 → Authorised signatory (passport, Emirates ID front and back) | Per-document checks at upload |
| Step 2 → Self-disclosure form (plans under AED 40,000) | Readable + right document type only |
| Step 3 → Review and submit | After Submit: full assessment runs |
| New: team review page | Score, band, reasons, money figures, actions |

The frontend is light but real: a working Next.js app with Postgres and file storage, not mock-ups. Effort goes into the KYC module (`src/kyc/`), not the UI.

| # | Screen | Built | Why |
|---|---|---|---|
| 1 | Plan: products, quantity, services, term (24 / 36 / 48 months) | Yes, simple | Monthly amount feeds affordability; contract total decides the route |
| 2 | Business verification hub (task list + "x of 5 complete") | Yes | Entry point to the tasks |
| 3 | Your account (name, work email, mobile, company) | Read-only, pre-filled | Records who applied; feeds the email-domain check |
| 4 | Company details (name, licence no., authority, emirate) | Yes | Typed values are cross-checked against documents |
| 5 | Business documents (licence, tax certificate, statements) | Yes | Part 1 checks |
| 6 | Authorised signatory (name, signing email, passport, Emirates ID front/back) | Yes | Part 1 checks |
| 7 | Self-disclosure form (plans under AED 40,000) | Yes, upload only | Readable + right type |
| 8 | Review and submit, then "Verification in progress" | Yes | Triggers Part 2 |
| 9 | Team: applications list (company, band, status) | Yes | Find cases |
| 10 | Team: application review page | Yes | Score, reasons, figures, actions |

The hub shows 5 of the live site's 6 tasks (contact person is left out).

Not built: home, full catalogue browsing, sign-up with email code (a simple customer / team switch instead), contact person, key facts and terms, quote, signing, delivery, real emails (document requests show on screen).

**Catalogue and pricing** follow the live site:
- Three categories: Technology, Furniture, Office appliances.
- A monthly price per item for each term (24 / 36 / 48 months). 12 months is "Ask us" and is not offered.
- Optional per-device services: Essential setup + asset tagging, Managed setup, Data transfer, Device care.
- Plan monthly = sum of (item price + its services) × quantity, all at the chosen term. VAT 5% is shown separately. Full term = term × monthly.
- Prices captured from the site are used where known; the rest are seeded and labelled as demo prices.

**Demo scenarios** are seed data only: a plan plus synthetic documents, loaded by a seed script. They run through the same pipeline as any upload; no code path knows about them.

### Out of scope (v1)

- Changing any other part of the Revent Business journey.
- External registry or credit-bureau lookups.
- Social media checks.
- Automatic approval or rejection.
- Agents that act on their own (see ARCHITECTURE.md → Later).

## 5. Customer experience (upload)

Each file shows one of these states:

| State | Meaning | Example message |
|---|---|---|
| Checking | Being read | "Checking your document…" |
| Ready | All checks passed | "Looks good" |
| Needs a fix | A check failed that the customer can fix | "This looks like the front of your Emirates ID. Please upload the back." |
| Needs review | We couldn't decide; the team will look | No customer message; status stays "Uploaded" |

Rules:
- Messages say what is wrong and what to do, in one sentence. No technical words, no scores.
- Every message exists in English and Arabic (right-to-left).
- A failed check never blocks Submit. The customer can still submit, and the team sees the warning.

## 6. Team experience (review page)

One page per application with:

1. **Header:** company name, licence number, plan (term, monthly amount).
2. **Score and band:** 0–100 and Green / Amber / Red, plus "Recommend reject" for Red.
3. **Summary:** 3–5 sentences in a fixed format, generated only from the computed findings.
4. **Reasons:** every check that did not pass, each with a link to the document page it came from.
5. **Money figures:** months covered, average monthly income, lease as % of income, lowest balance, days below zero, returned cheques/debits, existing loan repayments per month.
6. **Document checklist:** each document with pass / warning / fail.
7. **Actions:** Approve · Request document · Reject. Reject and overrides require a reason.

## 7. Success criteria

| Measure | Target |
|---|---|
| Key fields extracted correctly (licence no., TRN, names, dates) on digital PDFs | ≥ 98% |
| Same, on phone photos | ≥ 90% (below that → "Needs review", never a wrong pass) |
| Bank statements where balance maths is checked or clearly flagged | 100% |
| Upload feedback shown | ≤ 15 s per document (p95) |
| Assessment ready after Submit | ≤ 3 min |
| Reviewer agrees with band (shadow test) | ≥ 90% before anyone relies on it |

Measured on a labelled test set of 30–50 anonymised or synthetic documents.

## 8. UI rules

- Reuse Revent's existing look: Tailwind CSS tokens and shadcn/ui components. No new design system.
- Status colours: green = ready, amber = needs a fix / review, red = fail.
- English at `/`, Arabic at `/ar`. Light and dark themes.
- Money shown in AED with two decimals; stored as integer fils.

## 9. Open questions

- [ ] Which team members can approve and reject? One role or two?
- [ ] Final score thresholds: placeholders until calibrated on real decisions.
- [ ] Retention period for documents and extracted data.
- [ ] The AED 40,000 route limit: measured on the full-term total excluding VAT, and including services? The site only says "plan under AED 40,000". Kept as a setting until confirmed.
- [ ] Real prices for Furniture and Office appliances items (only "from" prices are known: AED 37.62 and AED 25.74 per month at 36 months).
