import type { Term } from "@/plan/pricing";

type MonthlyFilsByTerm = Readonly<Record<Term, number>>;

type SeedProduct = {
  id: string;
  name: string;
  nameAr: string;
  category: "technology" | "furniture" | "office_appliances";
  specs: string;
  monthlyFils: MonthlyFilsByTerm;
  // True only when all three term prices were read off the live site.
  allPricesFromSite?: boolean;
};

type SeedService = {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  monthlyFils: MonthlyFilsByTerm;
};

// Where a single price is known from the live site it is marked "site"; products
// with all three terms from the site have allPricesFromSite. Other terms are demo
// prices (equipment follows ×0.72 / ×0.57 from 24 months, which the site's own
// prices confirm) and those products are flagged isDemoPrice.
// Arabic names are drafts and need a native speaker's review.
export const seedProducts: readonly SeedProduct[] = [
  {
    id: "lenovo-thinkpad-e14",
    name: "Lenovo ThinkPad E14",
    nameAr: "Lenovo ThinkPad E14",
    category: "technology",
    specs: "Intel Core Ultra 5 · 16GB RAM · 512GB SSD · 14-inch display",
    monthlyFils: { 24: 17_105, 36: 12_316, 48: 9_750 },
    allPricesFromSite: true,
  },
  {
    id: "wireless-business-headset",
    name: "Wireless business headset",
    nameAr: "سماعة رأس لاسلكية للأعمال",
    category: "technology",
    specs: "",
    monthlyFils: { 24: 4_290, 36: 3_089 /* site */, 48: 2_445 },
  },
  {
    id: "meeting-room-display-65",
    name: "65-inch meeting room display",
    nameAr: "شاشة غرفة اجتماعات مقاس 65 بوصة",
    category: "technology",
    specs: "",
    monthlyFils: { 24: 28_600, 36: 20_592 /* site */, 48: 16_302 },
  },
  {
    id: "ergonomic-office-chair",
    name: "Ergonomic office chair",
    nameAr: "كرسي مكتب مريح",
    category: "furniture",
    specs: "",
    monthlyFils: { 24: 5_225, 36: 3_762 /* site "from" price */, 48: 2_978 },
  },
  {
    id: "sit-stand-desk",
    name: "Sit-stand desk",
    nameAr: "مكتب للجلوس والوقوف",
    category: "furniture",
    specs: "140 × 70 cm · dual motor · cable tray",
    monthlyFils: { 24: 10_175, 36: 7_326, 48: 5_800 },
    allPricesFromSite: true,
  },
  {
    id: "meeting-table-8-seat",
    name: "Meeting table, 8 seats",
    nameAr: "طاولة اجتماعات لثمانية أشخاص",
    category: "furniture",
    specs: "",
    monthlyFils: { 24: 12_500, 36: 9_000, 48: 7_125 },
  },
  {
    id: "voip-desk-phone",
    name: "VoIP desk phone",
    nameAr: "هاتف مكتبي VoIP",
    category: "office_appliances",
    specs: "HD voice · colour screen · PoE",
    monthlyFils: { 24: 3_575, 36: 2_574, 48: 2_038 },
    allPricesFromSite: true,
  },
  {
    id: "bean-to-cup-coffee-machine",
    name: "Bean-to-cup coffee machine",
    nameAr: "آلة قهوة تطحن الحبوب",
    category: "office_appliances",
    specs: "Freshly ground · milk system · 100 cups a day",
    monthlyFils: { 24: 26_400, 36: 19_008, 48: 15_048 },
    allPricesFromSite: true,
  },
  {
    id: "paper-shredder",
    name: "Paper shredder",
    nameAr: "آلة تمزيق الورق",
    category: "office_appliances",
    specs: "",
    monthlyFils: { 24: 3_800, 36: 2_736, 48: 2_166 },
  },
];

// Managed setup, Data transfer and Device care prices are from the live site.
// Essential setup + asset tagging is "included in Managed setup" there, so its
// stand-alone price is still a demo value.
export const seedServices: readonly SeedService[] = [
  {
    id: "essential-setup-asset-tagging",
    name: "Essential setup + asset tagging",
    nameAr: "الإعداد الأساسي ووسم الأصول",
    description: "Device set up and labelled for your asset register.",
    descriptionAr: "إعداد الجهاز ووضع ملصق عليه لسجل أصولك.",
    monthlyFils: { 24: 1_500, 36: 1_100, 48: 900 },
  },
  {
    id: "managed-setup",
    name: "Managed setup",
    nameAr: "الإعداد المُدار",
    description: "Device configured to your company settings before delivery.",
    descriptionAr: "ضبط الجهاز وفق إعدادات شركتك قبل التسليم.",
    monthlyFils: { 24: 3_600, 36: 2_592, 48: 2_052 },
  },
  {
    id: "data-transfer",
    name: "Data transfer",
    nameAr: "نقل البيانات",
    description: "Files moved from your old device to the new one.",
    descriptionAr: "نقل ملفاتك من جهازك القديم إلى الجديد.",
    monthlyFils: { 24: 750, 36: 540, 48: 428 },
  },
  {
    id: "device-care",
    name: "Device care",
    nameAr: "العناية بالجهاز",
    description: "Repair or replacement cover for the lease term.",
    descriptionAr: "تغطية الإصلاح أو الاستبدال طوال مدة الإيجار.",
    monthlyFils: { 24: 2_500, 36: 2_500, 48: 2_500 },
  },
];
