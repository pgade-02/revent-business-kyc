import type { Term } from "@/plan/pricing";

type MonthlyFilsByTerm = Readonly<Record<Term, number>>;

type SeedProduct = {
  id: string;
  name: string;
  category: "technology" | "furniture" | "office_appliances";
  specs: string;
  monthlyFils: MonthlyFilsByTerm;
};

type SeedService = { id: string; name: string; description: string; monthlyFils: MonthlyFilsByTerm };

// Where a price is known from the live site it is marked "site". Other terms
// are demo prices (equipment follows ×0.72 / ×0.57 from 24 months), so every
// product is flagged isDemoPrice until the real prices are confirmed.
export const seedProducts: readonly SeedProduct[] = [
  {
    id: "lenovo-thinkpad-e14",
    name: "Lenovo ThinkPad E14",
    category: "technology",
    specs: "Intel Core Ultra 5 · 16GB RAM · 512GB SSD · 14-inch display",
    monthlyFils: { 24: 17_105 /* site */, 36: 12_316, 48: 9_750 },
  },
  {
    id: "wireless-business-headset",
    name: "Wireless business headset",
    category: "technology",
    specs: "",
    monthlyFils: { 24: 4_290, 36: 3_089 /* site */, 48: 2_445 },
  },
  {
    id: "meeting-room-display-65",
    name: "65-inch meeting room display",
    category: "technology",
    specs: "",
    monthlyFils: { 24: 28_600, 36: 20_592 /* site */, 48: 16_302 },
  },
  {
    id: "ergonomic-office-chair",
    name: "Ergonomic office chair",
    category: "furniture",
    specs: "",
    monthlyFils: { 24: 5_225, 36: 3_762 /* site "from" price */, 48: 2_978 },
  },
  {
    id: "height-adjustable-desk",
    name: "Height-adjustable desk",
    category: "furniture",
    specs: "",
    monthlyFils: { 24: 8_900, 36: 6_408, 48: 5_073 },
  },
  {
    id: "meeting-table-8-seat",
    name: "Meeting table, 8 seats",
    category: "furniture",
    specs: "",
    monthlyFils: { 24: 12_500, 36: 9_000, 48: 7_125 },
  },
  {
    id: "water-dispenser",
    name: "Water dispenser",
    category: "office_appliances",
    specs: "",
    monthlyFils: { 24: 3_575, 36: 2_574 /* site "from" price */, 48: 2_038 },
  },
  {
    id: "coffee-machine",
    name: "Coffee machine",
    category: "office_appliances",
    specs: "",
    monthlyFils: { 24: 6_200, 36: 4_464, 48: 3_534 },
  },
  {
    id: "paper-shredder",
    name: "Paper shredder",
    category: "office_appliances",
    specs: "",
    monthlyFils: { 24: 3_800, 36: 2_736, 48: 2_166 },
  },
];

// Demo prices. Managed setup + Device care add up to the site's ThinkPad E14
// service totals: AED 61.00 (24), 50.92 (36), 45.52 (48).
export const seedServices: readonly SeedService[] = [
  {
    id: "essential-setup-asset-tagging",
    name: "Essential setup + asset tagging",
    description: "Device set up and labelled for your asset register.",
    monthlyFils: { 24: 1_500, 36: 1_100, 48: 900 },
  },
  {
    id: "managed-setup",
    name: "Managed setup",
    description: "Device configured to your company settings before delivery.",
    monthlyFils: { 24: 3_500, 36: 2_800, 48: 2_500 },
  },
  {
    id: "data-transfer",
    name: "Data transfer",
    description: "Files moved from your old device to the new one.",
    monthlyFils: { 24: 2_000, 36: 1_500, 48: 1_200 },
  },
  {
    id: "device-care",
    name: "Device care",
    description: "Repair or replacement cover for the lease term.",
    monthlyFils: { 24: 2_600, 36: 2_292, 48: 2_052 },
  },
];
