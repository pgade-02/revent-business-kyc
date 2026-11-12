import type { ImageProcessor } from "../interfaces/image-processor";
import type { PdfInspector } from "../interfaces/pdf-inspector";
import { detectFileType, type FileKind } from "./detect-file-type";
import { sha256Hex } from "./hashes";

export type IntakeLimits = { maxBytes: number; maxPages: number };

// Each reason has a customer message under "Upload.<reason>" in messages/.
export const INTAKE_REJECTIONS = [
  "UNSUPPORTED_TYPE",
  "TOO_LARGE",
  "TOO_MANY_PAGES",
  "PASSWORD_PROTECTED",
  "ACTIVE_CONTENT",
  "UNREADABLE",
] as const;
export type IntakeRejection = (typeof INTAKE_REJECTIONS)[number];

export type AcceptedFile = {
  kind: FileKind;
  bytes: Uint8Array; // what gets stored: PDFs as uploaded, images re-encoded without EXIF
  pageCount: number;
  sha256: string; // of the file as uploaded, so the same upload always matches
  perceptualHash: string | null; // images only; PDFs need page rendering (PRD §9 open question)
  imageSize: { width: number; height: number } | null; // images only; checked by DOC_UNREADABLE
};

export type IntakeResult = { ok: true; file: AcceptedFile } | { ok: false; reason: IntakeRejection };

type IntakeInput = {
  bytes: Uint8Array;
  limits: IntakeLimits;
  pdfInspector: PdfInspector;
  imageProcessor: ImageProcessor;
};

// Step 1 of Part 1 (ARCHITECTURE §2): decide whether an uploaded file is safe to keep.
// Cheap checks run first, so a huge or fake file is refused before anything opens it.
export async function intakeFile({ bytes, limits, pdfInspector, imageProcessor }: IntakeInput): Promise<IntakeResult> {
  if (bytes.byteLength > limits.maxBytes) return { ok: false, reason: "TOO_LARGE" };

  const kind = detectFileType(bytes);
  if (!kind) return { ok: false, reason: "UNSUPPORTED_TYPE" };
  const sha256 = sha256Hex(bytes);

  if (kind === "pdf") {
    const inspection = await pdfInspector.inspect(bytes);
    if (!inspection.ok) {
      return { ok: false, reason: inspection.reason === "ENCRYPTED" ? "PASSWORD_PROTECTED" : "UNREADABLE" };
    }
    const { pageCount, hasJavaScript, hasEmbeddedFiles, hasFormActions } = inspection.facts;
    if (hasJavaScript || hasEmbeddedFiles || hasFormActions) return { ok: false, reason: "ACTIVE_CONTENT" };
    if (pageCount > limits.maxPages) return { ok: false, reason: "TOO_MANY_PAGES" };
    return { ok: true, file: { kind, bytes, pageCount, sha256, perceptualHash: null, imageSize: null } };
  }

  const processed = await imageProcessor.clean(bytes);
  if (!processed.ok) return { ok: false, reason: "UNREADABLE" };
  const { image } = processed;
  return {
    ok: true,
    file: {
      kind: image.format,
      bytes: image.bytes,
      pageCount: 1,
      sha256,
      perceptualHash: image.perceptualHash,
      imageSize: { width: image.width, height: image.height },
    },
  };
}
