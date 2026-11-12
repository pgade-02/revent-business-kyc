import { sha256Hex } from "@/kyc/intake/hashes";
import type { OcrProvider } from "@/kyc/interfaces/ocr-provider";

// The app's OCR until a real provider is connected: it says "unavailable", so photos
// and scans honestly end as "Needs review" instead of getting an invented result.
export const unavailableOcr: OcrProvider = {
  async read() {
    return { ok: false, reason: "ERROR" };
  },
};

// Stands in for the OCR service until providers are benchmarked (decision log #19).
// It does not look at the picture: it returns page texts registered in advance for
// that exact file (by fingerprint). An unknown file reads as blank, like a blurred photo.
export function createFakeOcrProvider(pageTextsByFile: ReadonlyMap<string, string[]>): OcrProvider {
  return {
    async read({ bytes, kind, pages }) {
      const texts = pageTextsByFile.get(sha256Hex(bytes)) ?? [];
      const wanted = kind === "pdf" && pages ? pages : [1];
      return { ok: true, pages: wanted.map((page) => ({ page, text: texts[page - 1] ?? "" })) };
    },
  };
}
