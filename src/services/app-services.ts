import path from "node:path";
import { readUploadLimits } from "@/config/limits";
import { getAppDatabase } from "@/db/app-db";
import { unavailableOcr } from "@/providers/fakes/fake-ocr-provider";
import { labelledLinesLlm } from "@/providers/fakes/fake-llm-provider";
import { createLocalFileStore } from "@/providers/local-file-store";
import { pdfLibInspector } from "@/providers/pdf-lib-inspector";
import { pdfjsTextReader } from "@/providers/pdfjs-text-reader";
import { sharpImageProcessor } from "@/providers/sharp-image-processor";
import type { DocumentServices } from "./documents";

// The one place that decides which real parts the running app uses.
// OCR and the LLM are stand-ins until the real provider is connected (decision log #35).
export async function getDocumentServices(): Promise<DocumentServices> {
  return {
    db: await getAppDatabase(),
    fileStore: createLocalFileStore(process.env.FILE_STORE_DIR || path.join(process.cwd(), ".data", "files")),
    limits: readUploadLimits(process.env),
    pdfInspector: pdfLibInspector,
    imageProcessor: sharpImageProcessor,
    readers: { pdfTextReader: pdfjsTextReader, ocr: unavailableOcr, llm: labelledLinesLlm },
    now: () => new Date(),
  };
}
