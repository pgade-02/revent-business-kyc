// Runs files through the real upload checks and the real AI provider, and prints
// what the customer and the reviewer would see.
//   npm run check:documents            → test-documents/samples (synthetic, shows values read)
//   npm run check:documents mine       → test-documents/my-documents (hides values read)
//   npm run check:documents <folder>   → any other folder (shows values read)
// The box (slot) is guessed from the file name; see slotFor().
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { readUploadLimits } from "@/config/limits";
import { startingScoringSettings } from "@/db/seed/scoring-settings";
import { todayInDubai } from "@/kyc/dates";
import { checkDocument } from "@/kyc/documents/check-document";
import type { DocumentSlot } from "@/kyc/documents/slots";
import { intakeFile } from "@/kyc/intake/intake-file";
import { pdfLibInspector } from "@/providers/pdf-lib-inspector";
import { sharpImageProcessor } from "@/providers/sharp-image-processor";
import { getDocumentReaders } from "@/services/app-services";
import en from "../messages/en.json";

try {
  process.loadEnvFile(".env.local"); // the API key; never printed
} catch {
  // No .env.local: the stand-in readers are used.
}

const argument = process.argv[2];
const ownDocuments = argument === "mine";
const folder = ownDocuments
  ? path.join(process.cwd(), "test-documents", "my-documents")
  : argument
    ? path.resolve(argument) // any other folder, e.g. a copy holding only the files to test
    : path.join(process.cwd(), "test-documents", "samples");

// Most specific words first: "Passport-Back" is a passport, not an Emirates ID back.
function slotFor(fileName: string): DocumentSlot {
  const name = fileName.toLowerCase();
  if (/passport|foreign|pan/.test(name)) return "passport";
  if (/emirates|eid/.test(name)) return /back/.test(name) ? "emirates_id_back" : "emirates_id_front";
  if (/licen[cs]e/.test(name)) return "trade_licence";
  if (/tax|trn|vat/.test(name)) return "tax_certificate";
  if (/statement|invoice|bank/.test(name)) return "bank_statement";
  return "passport";
}

const message = (key: string | undefined) =>
  key?.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], en) as string | undefined;

async function main() {
  const readers = getDocumentReaders(process.env);
  const limits = readUploadLimits(process.env);
  const usingAi = Boolean(process.env.MISTRAL_API_KEY);
  console.log(`Folder: ${folder}\nReaders: ${usingAi ? "Mistral (real OCR and AI)" : "stand-ins (no API key)"}\n`);

  const files = readdirSync(folder).filter((name) => /\.(pdf|jpe?g|png)$/i.test(name));
  for (const [index, fileName] of files.entries()) {
    const label = ownDocuments ? `file ${index + 1}` : fileName;
    const slot = slotFor(fileName);
    const started = Date.now();
    const bytes = new Uint8Array(readFileSync(path.join(folder, fileName)));
    const intake = await intakeFile({ bytes, limits, pdfInspector: pdfLibInspector, imageProcessor: sharpImageProcessor });
    if (!intake.ok) {
      console.log(`${label} → ${slot}: REFUSED at upload (${intake.reason}) "${message(`Upload.${intake.reason}`)}"\n`);
      continue;
    }

    const outcome = await checkDocument({
      documentId: String(index + 1),
      slot,
      file: intake.file,
      today: todayInDubai(new Date()),
      expiresSoonDays: startingScoringSettings.expiresSoonDays,
      readers,
      limits,
    });
    const ms = Date.now() - started;
    console.log(`${label} → ${slot}: ${outcome.status.toUpperCase()} in ${ms} ms (OCR pages: ${outcome.ocrPages.join(",") || "none"}${outcome.problem ? `, problem: ${outcome.problem}` : ""})`);
    for (const result of outcome.results) {
      // Reviewer details can contain dates read from the document, so they are hidden for your own files.
      console.log(`   ${result.status.padEnd(7)} ${result.code}${ownDocuments ? "" : `: ${result.detail}`}`);
      if (result.customerMessageKey) console.log(`           customer sees: "${message(result.customerMessageKey)}"`);
    }
    if (outcome.fields) {
      const names = Object.keys(outcome.fields);
      console.log(
        ownDocuments
          ? `   fields read: ${names.join(", ") || "none"} (values hidden)`
          : `   fields read: ${Object.entries(outcome.fields).map(([name, field]) => `${name}=${field.value}`).join(" · ") || "none"}`,
      );
    }
    console.log("");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "failed");
  process.exitCode = 1;
});
