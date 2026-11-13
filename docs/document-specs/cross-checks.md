# Cross-checks — spec (v1)

Status: **approved 2026-11-13** (decision log #51). Nothing here is built yet.

Cross-checks run **once, after Submit** (Part 2). They compare documents with each other
and with what the customer typed. Each one only ever **warns the reviewer**; none blocks
Submit, rejects an application or is a hard stop.

Source: the owner's KYC rulebook, cut down to what v1 can check reliably. Rulebook rows
that need official databases, biometrics or judgement are listed in §5 and §6.

## 1. New fields to read

Read by the AI unless marked **code** (code parses the machine-readable lines; the AI
never sees or returns those values).

| Document | New field | Used by |
|---|---|---|
| Trade licence | `managerNames` (owners, partners, manager or authorised signatory; list) | `NAME_SIGNATORY` |
| Trade licence | `emirate` | `EMIRATE_MATCH` |
| Trade licence | `issueDate` | Shown only (§4) |
| Trade licence | `activities` | Shown only (§4); insights |
| Trade licence | `address` | Shown only (§4) |
| Tax certificate | `taxType` (`vat` or `corporate_tax`) | Shown only (§4) |
| Tax certificate | `address` | Shown only (§4) |
| Bank statement | `currency` | `STMT_CURRENCY`, money figures |
| Bank statement | `openingBalance`, `closingBalance` | `STMT_CONTINUITY` |
| Emirates ID back | `employer` | `EID_EMPLOYER` |
| Emirates ID back | `occupation` | Shown only (§4) |
| Emirates ID back | name, ID number, expiry, date of birth, nationality — **code** | `EID_SIDES_MATCH`, `DOB_MATCH`, `NATIONALITY_MATCH` |
| Passport | passport number, expiry, date of birth, nationality, check digits — **code** | `PASSPORT_MRZ`, `DOB_MATCH`, `NATIONALITY_MATCH` |

The passport's machine-readable zone is 2 lines of 44 characters (ICAO TD3); the Emirates
ID's is 3 lines of 30 (TD1). Both use the same check-digit rule, already in
`src/kyc/extraction/emirates-id-mrz.ts`.

## 2. Cross-checks

"Skipped" means a value needed is missing or unreadable. A skipped check shows as
"Could not check" to the reviewer, never as a pass.

| Code | Compares | Warns when | Skipped when | Scored? |
|---|---|---|---|---|
| `NAME_COMPANY` | Company name on licence, tax certificate, statements (account holder), self-disclosure form, and typed in Company details | Any of them is a different company | Fewer than 2 names read | Yes (identity) |
| `LICENCE_NUMBER` | Licence number on the licence and typed | Different | Not read | Yes (identity) |
| `TRN_NUMBER` | TRN on the tax certificate and typed | Different | No TRN typed, or not read | Yes (identity) |
| `EMIRATE_MATCH` | Emirate on the licence and typed | Different | Not read | Yes (identity) |
| `NAME_SIGNATORY` | Name typed in the signatory form, passport, Emirates ID front, and `managerNames` on the licence | Passport and ID name differ, or the signatory is not among `managerNames` ("authority not proven") | Fewer than 2 names read | Yes (identity) |
| `EID_SIDES_MATCH` | Emirates ID front (number, expiry, name) and back's machine-readable lines | Any differs: front and back may be from different cards | Back lines not read | Yes (identity) |
| `DOB_MATCH` | Date of birth in the passport's and the Emirates ID's machine-readable lines | Different: possibly two different people | Either not read | Yes (identity) |
| `NATIONALITY_MATCH` | Nationality code in the same two places | Different (dual nationals can legitimately differ) | Either not read | **No** — shown only |
| `EID_EMPLOYER` | Employer on the Emirates ID back and the company name | A different employer | No employer printed (for example UAE nationals, family-sponsored residents) | **No** — shown only |
| `EMAIL_DOMAIN` | Applicant's work email and signing email domains, and the company name | Domains differ from each other or don't relate to the company. Free webmail is noted, not warned | — | Yes (identity) |
| `IBAN_CONSISTENT` | IBAN on every statement | More than one IBAN | Fewer than 2 IBANs read | Yes (integrity) |
| `STMT_CONTINUITY` | Closing balance of month N and opening balance of month N+1 | They differ | A balance not read | Yes (integrity) |
| `STMT_COVERAGE` | Re-run of the upload check against the submit month | A month is missing | — | Yes (integrity) |
| `STMT_CURRENCY` | Currency of each statement | Any statement is not AED: it is left out of the money figures | Currency not read (treated as AED) | No — explains the figures |

Not scored means: the reviewer sees the result, but it never changes the score or band.
Nationality is never a score input (SECURITY §6). Employer is not scored in v1 because a
mismatch has too many innocent causes; revisit after reviewer feedback.

## 3. How things are compared

- **Company names:** lower-case, punctuation removed, legal endings dropped (LLC, L.L.C.,
  FZE, FZCO, FZ-LLC, DMCC, Est., Establishment). Words like "Trading" are kept. Arabic compared with
  Arabic only when both sides have it.
- **Person names:** same clean-up, then: word order ignored; extra middle names allowed
  (the shorter name needs at least 2 words); spacing ignored ("Al Mansoori" = "Almansoori").
  Each word is then paired with its closest word in the other name and scored with
  Jaro-Winkler; the weakest pair decides: at or above `nameMatch.matchBps` _(setting, 9500)_
  = match, at or above `nameMatch.possibleMatchBps` _(setting, 8500)_ = possible match
  (warns the reviewer as a spelling variant), below = different. No list of name spellings.
- **Numbers** (licence, TRN, ID, IBAN): spaces and dashes removed, then exact.
- **Dates and codes** (date of birth, nationality, expiry): exact.
- **Money:** integer fils, exact.

All matching is plain code with tests. The AI never decides whether two values match.

## 4. Shown to the reviewer, not checked

| Item | Shown as |
|---|---|
| Licence activities | Next to the plan, so the reviewer can judge if the devices fit the business |
| Addresses | Licence, tax certificate and typed address side by side |
| Tax certificate type | "VAT" or "Corporate Tax" |
| Licence issue date | Next to the first statement month (business age at a glance) |
| Occupation | Under the signatory's name |

## 5. Checked by the reviewer by hand

v1 has no connection to official registers. The review page shows each item with a link
to the official lookup and a "Verified" tick box (recorded in the audit log).

| Item | What the reviewer does |
|---|---|
| Licence status | Looks up the licence number with the issuing authority (active, suspended, cancelled) |
| TRN registration | Looks up the TRN with the tax authority |
| Licence QR code | Opens the QR link printed on the licence, if any |

Code still checks what it can: licence expiry (`DOC_EXPIRED`), TRN format (`ID_FORMAT`),
and `LICENCE_NUMBER` / `TRN_NUMBER` above.

## 6. Not in v1

| Rulebook item | Why |
|---|---|
| Photo / face matching | Biometric data; needs a licensed identity-verification provider |
| Sex | Not needed for any check (SECURITY §6) |
| Arabic name against the official ID record | Needs the official register |
| Document authenticity (fonts, edits) | Cannot be done reliably; balance maths and PDF checks cover what they can |
| Power of attorney | No upload box. If the signatory is not on the licence, `NAME_SIGNATORY` warns and the reviewer can use **Request document** |
| Currency conversion | Non-AED statements are left out of the money figures instead |
| Business-age check | Licences show renewal dates inconsistently; shown only (§4) |

## 7. Privacy

- Date of birth and nationality are read by **code** from the machine-readable lines,
  compared in memory, and only `match` / `different` / `could not check` is stored. The
  values are never stored, logged, sent to the AI or shown.
- Occupation and employer are stored as read and shown to the reviewer only.
- The machine-readable lines stay masked before any AI call, as today.
