// Synthetic documents only (SECURITY §1): made-up company, person and numbers.
// Each text is what a reader would get from the page, printed as "Label: value"
// lines the way real documents label their fields.

const mrz = (line: string, length: number) => line.padEnd(length, "<");

export const syntheticTexts = {
  tradeLicence: [
    "TRADE LICENCE",
    "Issuing Authority: Demo Economic Department",
    "Licence Number: CN-1234567",
    "Company Name: Demo Trading LLC",
    "Legal Form: Limited Liability Company",
    "Emirate: Dubai",
    "Address: Office 101, Demo Tower, Dubai",
    "Issue Date: 2021-03-02",
    "Expiry Date: 2027-03-01",
    "Activities: General Trading; Computer Equipment Trading",
    "Manager: Demo Customer",
  ].join("\n"),

  taxCertificate: (trn: string) =>
    ["TAX REGISTRATION CERTIFICATE", "Corporate Tax", "Tax Type: corporate_tax", `TRN: ${trn}`, "Company Name: Demo Trading LLC"].join("\n"),

  bankStatement: [
    "DEMO BANK",
    "ACCOUNT STATEMENT",
    "Account Holder: Demo Trading LLC",
    "IBAN: AE070331234567890123456",
    "Currency: AED",
    "Period From: 2026-05-01",
    "Period To: 2026-05-31",
    "Opening Balance: 120500.00",
    "Closing Balance: 134250.75",
  ].join("\n"),

  invoice: ["TAX INVOICE", "Invoice No: INV-0042", "Company Name: Demo Trading LLC", "Total: AED 1,050.00"].join("\n"),

  passport: (expiryDate: string) =>
    [
      "PASSPORT",
      "Name: Demo Customer",
      "Passport No: X1234567",
      `Date of Expiry: ${expiryDate}`,
      mrz("P<GBRCUSTOMER<<DEMO", 44),
      "X12345670GBR8001011M3108145<<<<<<<<<<<<<<04",
    ].join("\n"),

  // Looks like a foreign national ID card: readable, but not a passport.
  foreignIdCard: ["GOVERNMENT OF INDIA", "Aadhaar", "Name: Demo Customer", "XXXX XXXX 1234"].join("\n"),

  emiratesIdFront: ["UNITED ARAB EMIRATES", "RESIDENT IDENTITY CARD", "Name: Demo Customer", "ID Number: 784-1990-0000000-1", "Expiry Date: 2028-02-20"].join(
    "\n",
  ),

  emiratesIdBack: [
    "Expiry Date: 2028-02-20",
    "Occupation: General Manager",
    "Employer: Demo Trading LLC",
    mrz("ILARE784199000000001", 30),
    "9001014M2802202ARE<<<<<<<<<<<4",
    mrz("CUSTOMER<<DEMO", 30),
  ].join("\n"),
};
