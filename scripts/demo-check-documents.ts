// Runs synthetic documents through the real Part 1 pipeline and prints what the
// customer and the reviewer would see. Only OCR and the AI are fakes.
//   npm run demo:documents
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readUploadLimits } from "@/config/limits";
import { startingScoringSettings } from "@/db/seed/scoring-settings";
import { todayInDubai } from "@/kyc/dates";
import { checkDocument, type CheckDocumentOutcome } from "@/kyc/documents/check-document";
import type { DocumentSlot } from "@/kyc/documents/slots";
import { sha256Hex } from "@/kyc/intake/hashes";
import { intakeFile } from "@/kyc/intake/intake-file";
import { createFakeOcrProvider } from "@/providers/fakes/fake-ocr-provider";
import { labelledLinesLlm } from "@/providers/fakes/fake-llm-provider";
import { pdfLibInspector } from "@/providers/pdf-lib-inspector";
import { pdfjsTextReader } from "@/providers/pdfjs-text-reader";
import { sharpImageProcessor } from "@/providers/sharp-image-processor";
import en from "../messages/en.json";
import { makeTextImage, makeTextPdf } from "../tests/fixtures/make-files";
import { syntheticTexts as text } from "../tests/fixtures/synthetic-documents";

type Scenario = { name: string; slot: DocumentSlot; fileName: string; make: () => Promise<Uint8Array>; ocrText?: string };

const scenarios: Scenario[] = [
  { name: "Digital trade licence", slot: "trade_licence", fileName: "licence.pdf", make: () => makeTextPdf([text.tradeLicence]) },
  { name: "Tax certificate, TRN one digit short", slot: "tax_certificate", fileName: "tax.pdf", make: () => makeTextPdf([text.taxCertificate("10000000000000")]) },
  { name: "Scanned bank statement (no text layer)", slot: "bank_statement", fileName: "statement-scan.pdf", make: () => makeTextPdf([""]), ocrText: text.bankStatement },
  { name: "Invoice uploaded as bank statement", slot: "bank_statement", fileName: "invoice.pdf", make: () => makeTextPdf([text.invoice]) },
  { name: "Passport photo", slot: "passport", fileName: "passport.jpg", make: () => makeTextImage(text.passport("2031-08-14")), ocrText: text.passport("2031-08-14") },
  { name: "Expired passport", slot: "passport", fileName: "passport-expired.jpg", make: () => makeTextImage(text.passport("2025-01-10")), ocrText: text.passport("2025-01-10") },
  { name: "Foreign ID card in the passport box", slot: "passport", fileName: "foreign-id.jpg", make: () => makeTextImage(text.foreignIdCard), ocrText: text.foreignIdCard },
  { name: "Emirates ID front in the back box", slot: "emirates_id_back", fileName: "eid-front.jpg", make: () => makeTextImage(text.emiratesIdFront), ocrText: text.emiratesIdFront },
  { name: "Tiny, blurry Emirates ID photo", slot: "emirates_id_front", fileName: "eid-tiny.jpg", make: () => makeTextImage(text.emiratesIdFront, 420, 260), ocrText: text.emiratesIdFront },
];

// The screens fill {maxMb} the same way, from the upload limits.
const maxMb = Math.floor(readUploadLimits(process.env).maxBytes / (1024 * 1024));
const customerText = (key: string | undefined) => {
  const message = key?.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], en);
  return typeof message === "string" ? message.replace("{maxMb}", String(maxMb)) : undefined;
};

const statusLabel: Record<CheckDocumentOutcome["status"], string> = {
  ready: "\x1b[32mREADY\x1b[0m        ",
  needs_fix: "\x1b[31mNEEDS A FIX\x1b[0m  ",
  needs_review: "\x1b[33mNEEDS REVIEW\x1b[0m ",
};
const resultMark = { pass: "✓", warn: "!", fail: "✗", skipped: "-" } as const;

function print(scenario: Scenario, outcome: CheckDocumentOutcome, milliseconds: number, ocrPages: number[]) {
  console.log(`\n${statusLabel[outcome.status]} ${scenario.name}  (${scenario.fileName} → ${scenario.slot}, ${milliseconds} ms, OCR pages: ${ocrPages.join(",") || "none"})`);
  for (const result of outcome.results) console.log(`   ${resultMark[result.status]} ${result.code.padEnd(17)} ${result.detail}`);
  const message = outcome.results.map((result) => customerText(result.customerMessageKey)).find(Boolean);
  if (message) console.log(`   Customer sees: "${message}"`);
  if (outcome.fields) {
    const fields = Object.entries(outcome.fields).map(([name, field]) => `${name}=${field.value}`);
    console.log(`   Fields read: ${fields.join(" · ")}`);
  }
}

async function main() {
  const limits = readUploadLimits(process.env);
  const outputDir = path.join(process.cwd(), ".data", "demo-documents");
  await mkdir(outputDir, { recursive: true });
  console.log(`Today in Dubai: ${todayInDubai(new Date())}. Files written to ${outputDir}`);

  for (const [index, scenario] of scenarios.entries()) {
    const bytes = await scenario.make();
    await writeFile(path.join(outputDir, scenario.fileName), bytes);

    const started = Date.now();
    const intake = await intakeFile({ bytes, limits, pdfInspector: pdfLibInspector, imageProcessor: sharpImageProcessor });
    if (!intake.ok) {
      console.log(`\nREJECTED ${scenario.name}: ${intake.reason}`);
      continue;
    }
    // The fake OCR returns the scenario's text for exactly this stored file.
    const ocr = createFakeOcrProvider(new Map([[sha256Hex(intake.file.bytes), [scenario.ocrText ?? ""]]]));
    const outcome = await checkDocument({
      documentId: `demo_${index + 1}`,
      slot: scenario.slot,
      file: intake.file,
      today: todayInDubai(new Date()),
      expiresSoonDays: startingScoringSettings.expiresSoonDays,
      readers: { pdfTextReader: pdfjsTextReader, ocr, llm: labelledLinesLlm },
      limits,
    });
    print(scenario, outcome, Date.now() - started, outcome.ocrPages);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
