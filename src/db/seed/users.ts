// Synthetic people only: no real names, emails or phone numbers (SECURITY §1).
// The .example domain is reserved and can never belong to a real company.
export const seedUsers = [
  {
    id: "seed-customer",
    role: "customer",
    name: "Demo Customer",
    email: "owner@demo-trading.example",
    mobile: "+971500000000",
    companyName: "Demo Trading LLC",
  },
  {
    id: "seed-reviewer",
    role: "reviewer",
    name: "Demo Reviewer",
    email: "reviewer@revent.example",
    mobile: null,
    companyName: null,
  },
] as const;
