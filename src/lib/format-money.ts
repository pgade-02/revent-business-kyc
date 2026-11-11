// Display only: turns integer fils into "AED 236.81". The division by 100 happens
// here and nowhere else, after all maths is done in whole fils.
export function formatAed(fils: number, locale: string): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-AE" : "en-AE", {
    style: "currency",
    currency: "AED",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(fils / 100);
}
