// Fictional companies and people for the realistic test set (SECURITY §1: synthetic only).
// Every document of one company is generated from its single record here, so the
// licence, tax certificate, statements and signatory's IDs agree with each other.
// "UTO" (Utopia) is ICAO's official code for specimen travel documents.

export type Person = {
  surname: string;
  givenNames: string;
  nameAr: string;
  nationality: "UTO";
  birthDate: string; // YYYY-MM-DD
  sex: "M" | "F";
  passportNumber: string; // 8–9 letters/digits
  passportIssued: string;
  passportExpires: string;
  emiratesId: string; // 784-YYYY-NNNNNNN-C
  emiratesIdCardNumber: string; // 9 digits, printed in the card's MRZ
  emiratesIdIssued: string;
  emiratesIdExpires: string;
  emiratesIdIssuingPlace: string;
  occupation: { en: string; ar: string };
  employer: { en: string; ar: string }; // the company on the Emirates ID back
};

export type Company = {
  key: string; // folder name
  name: string;
  nameAr: string;
  legalForm: string;
  licenceNumber: string;
  authority: string;
  emirate: string;
  licenceIssued: string;
  licenceExpires: string;
  activities: string[];
  address: string;
  trn: string;
  taxEffectiveDate: string;
  bank: { name: string; bankCode: string; accountNumber: string };
  signatory: Person;
  // Money in fils, per month: what the statements are generated from.
  monthlyIncomeFils: number;
  monthlyRentFils: number;
  monthlySalariesFils: number;
  monthlyLoanRepaymentFils: number;
  openingBalanceFils: number;
};

export const saraHaddad: Person = {
  surname: "HADDAD",
  givenNames: "SARA DEMO",
  nameAr: "سارة ديمو حداد",
  nationality: "UTO",
  birthDate: "1988-04-12",
  sex: "F",
  passportNumber: "U4821736",
  passportIssued: "2023-02-15",
  passportExpires: "2033-02-14",
  emiratesId: "784-1988-4821736-2",
  emiratesIdCardNumber: "148217362",
  emiratesIdIssued: "2026-10-01",
  emiratesIdExpires: "2028-09-30",
  emiratesIdIssuingPlace: "Dubai",
  occupation: { en: "General Manager", ar: "مدير عام" },
  employer: { en: "Falcon Demo Trading L.L.C.", ar: "فالكون ديمو للتجارة ش.ذ.م.م" },
};

export const omarFarouk: Person = {
  surname: "FAROUK",
  givenNames: "OMAR SPECIMEN",
  nameAr: "عمر سبيسيمن فاروق",
  nationality: "UTO",
  birthDate: "1979-11-03",
  sex: "M",
  passportNumber: "U7390452",
  passportIssued: "2021-06-01",
  passportExpires: "2031-05-31",
  emiratesId: "784-1979-7390452-8",
  emiratesIdCardNumber: "173904528",
  emiratesIdIssued: "2025-12-16",
  emiratesIdExpires: "2027-12-15",
  emiratesIdIssuingPlace: "Sharjah",
  occupation: { en: "Partner", ar: "شريك" },
  employer: { en: "Horizon Specimen Contracting L.L.C.", ar: "هورايزن سبيسيمن للمقاولات ش.ذ.م.م" },
};

export const companyA: Company = {
  key: "company-a-falcon",
  name: "Falcon Demo Trading L.L.C.",
  nameAr: "فالكون ديمو للتجارة ش.ذ.م.م",
  legalForm: "Limited Liability Company",
  licenceNumber: "CN-4729183",
  authority: "Emirate Economic Registry (Specimen)",
  emirate: "Dubai",
  licenceIssued: "2025-07-01",
  licenceExpires: "2027-06-30",
  activities: ["Computer & Peripheral Equipment Trading", "Office Equipment Trading", "IT Infrastructure Services"],
  address: "Office 1204, Specimen Tower, Business Bay, Dubai, UAE",
  trn: "100472918300003",
  taxEffectiveDate: "2024-06-01",
  bank: { name: "Demo Gulf Bank (Specimen)", bankCode: "099", accountNumber: "0012047291830001" },
  signatory: saraHaddad,
  monthlyIncomeFils: 18_500_000, // AED 185,000
  monthlyRentFils: 2_100_000,
  monthlySalariesFils: 9_800_000,
  monthlyLoanRepaymentFils: 650_000,
  openingBalanceFils: 24_000_000,
};

// A different business: its documents mixed into Company A's application must be flagged.
export const companyB: Company = {
  key: "company-b-horizon",
  name: "Horizon Specimen Contracting L.L.C.",
  nameAr: "هورايزن سبيسيمن للمقاولات ش.ذ.م.م",
  legalForm: "Limited Liability Company",
  licenceNumber: "CN-8810457",
  authority: "Emirate Economic Registry (Specimen)",
  emirate: "Sharjah",
  licenceIssued: "2025-03-10",
  licenceExpires: "2027-03-09",
  activities: ["Building Contracting", "Interior Fit-out Works"],
  address: "Warehouse 7, Specimen Industrial Area, Sharjah, UAE",
  trn: "100881045700003",
  taxEffectiveDate: "2023-01-01",
  bank: { name: "Specimen National Bank", bankCode: "098", accountNumber: "0108810457000002" },
  signatory: omarFarouk,
  monthlyIncomeFils: 6_200_000,
  monthlyRentFils: 1_500_000,
  monthlySalariesFils: 3_900_000,
  monthlyLoanRepaymentFils: 1_100_000,
  openingBalanceFils: 1_200_000,
};
