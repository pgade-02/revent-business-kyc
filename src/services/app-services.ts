import path from "node:path";
import { readAiConfig } from "@/config/ai";
import { readUploadLimits } from "@/config/limits";
import { getAppDatabase } from "@/db/app-db";
import { unavailableOcr } from "@/providers/fakes/fake-ocr-provider";
import { labelledLinesLlm } from "@/providers/fakes/fake-llm-provider";
import { createLocalFileStore } from "@/providers/local-file-store";
import { createMistralLlmProvider } from "@/providers/mistral/mistral-llm-provider";
import { createMistralOcrProvider } from "@/providers/mistral/mistral-ocr-provider";
import { pdfLibInspector } from "@/providers/pdf-lib-inspector";
import { pdfjsTextReader } from "@/providers/pdfjs-text-reader";
import { sharpImageProcessor } from "@/providers/sharp-image-processor";
import type { DocumentServices } from "./documents";

// Real OCR and AI when MISTRAL_API_KEY is set; otherwise honest stand-ins: OCR says
// "unavailable" (photos go to Needs review) and a labelled-lines reader fills forms.
export function getDocumentReaders(env: Record<string, string | undefined>): DocumentServices["readers"] {
  const ai = readAiConfig(env);
  if (!ai.mistralApiKey) return { pdfTextReader: pdfjsTextReader, ocr: unavailableOcr, llm: labelledLinesLlm };
  const client = { apiKey: ai.mistralApiKey };
  return {
    pdfTextReader: pdfjsTextReader,
    ocr: createMistralOcrProvider(client, { model: ai.ocrModel, timeoutMs: ai.ocrTimeoutMs }),
    llm: createMistralLlmProvider(client, { model: ai.llmModel }),
  };
}

// The one place that decides which real parts the running app uses.
export async function getDocumentServices(): Promise<DocumentServices> {
  return {
    db: await getAppDatabase(),
    fileStore: createLocalFileStore(process.env.FILE_STORE_DIR || path.join(process.cwd(), ".data", "files")),
    limits: readUploadLimits(process.env),
    pdfInspector: pdfLibInspector,
    imageProcessor: sharpImageProcessor,
    readers: getDocumentReaders(process.env),
    now: () => new Date(),
  };
}
