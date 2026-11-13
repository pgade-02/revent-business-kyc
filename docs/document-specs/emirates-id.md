# Emirates ID — document spec

Status: **approved 2026-11-13**. Part 1 checks are built (decision log #45, #46).
`EID_SIDES_MATCH` waits for Part 2.

Based on a real resident card (current design, issued 2025) checked side by side with
our synthetic template. No values from that card are recorded here.

## 1. What the real card shows

### Front

| # | Field | Printed as | Notes |
|---|---|---|---|
| 1 | Country and issuer | "UNITED ARAB EMIRATES", issuing authority name in EN + AR, "Resident Identity Card" / "بطاقة هوية مقيم" | National emblem at the top centre |
| 2 | ID number | `784-YYYY-NNNNNNN-C` under "ID Number / رقم الهوية" | YYYY is the holder's birth year; C is a check digit |
| 3 | Name (Arabic) | "الاسم:" line | Own line, above the English name |
| 4 | Name (English) | "Name:" line | Can be long (4–6 words) |
| 5 | Date of birth | `DD/MM/YYYY` | |
| 6 | Nationality | Country name, EN + AR | |
| 7 | Issue date | `DD/MM/YYYY` under "Issuing Date / تاريخ الاصدار" | |
| 8 | Expiry date | `DD/MM/YYYY` under "Expiry Date / تاريخ الانتهاء" | |
| 9 | Sex | `M` / `F`, EN + AR | |
| 10 | Photo, signature, small ghost photo | Images | Never read or used (SECURITY §6) |

### Back

| # | Field | Printed as | Notes |
|---|---|---|---|
| 1 | Card number | 9 digits under "Card Number / رقم البطاقة" | Different from the ID number |
| 2 | Occupation | EN + AR | |
| 3 | Employer | EN + AR | |
| 4 | Issuing place | Emirate, EN + AR | |
| 5 | Chip and serial | Chip, plus a 10-digit number below it | |
| 6 | "If found, return…" notice | EN + AR | |
| 7 | Machine-readable lines | 3 lines × 30 characters (ICAO 9303 TD1) | See §2 |

The back has no printed expiry date on this design. The expiry date is only in the
machine-readable lines. Older cards printed it on the back; we still accept that.

## 2. Machine-readable lines (back)

```
Line 1: I L ARE <card number 9> <check> <ID number 15 digits>
Line 2: <birth YYMMDD> <check> <sex> <expiry YYMMDD> <check> <nationality 3> <<<…> <overall check>
Line 3: <name parts separated by <, two << between groups>
```

Each check digit uses ICAO weights 7-3-1. A misread or edited character breaks it.
Our synthetic generator already produces this structure correctly.

## 3. What we read (AI fields)

| Slot | Fields | Change from today |
|---|---|---|
| Front | fullName, emiratesIdNumber, issueDate, expiryDate | **add issueDate** |
| Back | expiryDate (older cards only) | none |

Not read by the AI: card number, date of birth, nationality, sex, photo.
Employer and occupation are read from the back after decision log #51 (employer for
`EID_EMPLOYER`, occupation shown to the reviewer only); see `cross-checks.md`.
The machine-readable lines are parsed by **code**, not the AI, and are masked before any
AI call. On the current design code takes the back's expiry date from them.

## 4. Checks

Per document (Part 1, at upload):

| Code | Side | Rule | Result if broken |
|---|---|---|---|
| DOC_UNREADABLE | both | Enough text read | Needs a fix: clearer photo |
| DOC_WRONG_TYPE | both | Front: ID number pattern and no machine-readable lines. Back: `I?ARE` machine-readable lines | Needs a fix: wrong side or document |
| DOC_EXPIRED / DOC_EXPIRES_SOON | front; back from machine-readable lines | Expiry vs today (Dubai) | Needs a fix / warning |
| ID_FORMAT | front | `784-YYYY-NNNNNNN-C` | Needs review |
| **EID_DATES** (new) | front | Issue date ≤ today, and issue date < expiry date | Needs review: probably misread or edited |
| **MRZ_CHECK_DIGITS** (new) | back | All check digits in the machine-readable lines are correct | Needs a fix: clearer photo of the back |

Across front and back (Part 2, after Submit):

| Code | Rule | Result if broken |
|---|---|---|
| **EID_SIDES_MATCH** (new) | ID number, expiry and name on the front equal the ones in the back's machine-readable lines | Needs review: front and back may be from different cards |
| NAME_SIGNATORY (existing plan) | Name on the ID matches the passport and the licence's manager | Needs review |

## 5. Decided: date of birth and nationality are match-only; sex is never used

Changed by decision log #51. Code compares date of birth and nationality between the
passport's and this card's machine-readable lines (`DOB_MATCH`, `NATIONALITY_MATCH` in
`cross-checks.md`). They are stored with the card's other fields (decision log #53), never
logged, sent to the AI or displayed, and nationality never affects the score. Sex is not compared.
`MRZ_CHECK_DIGITS` still only tests that each check digit is right.
`EID_SIDES_MATCH` compares ID number, expiry and name only.

## 6. Synthetic template changes

- Front: add the Arabic name line, nationality, issue date and sex; use the real field
  order (ID number, Arabic name, English name, date of birth, nationality, issue date,
  expiry date, sex); add a small ghost photo silhouette; add a fictional issuer line.
  No real emblem.
- Back: add issuing place, a chip drawing, a 10-digit serial and the "if found" notice;
  put the machine-readable lines on a white band.
- New problem files: issue date after expiry; back with one changed machine-readable
  digit; a front and back from two different people.
