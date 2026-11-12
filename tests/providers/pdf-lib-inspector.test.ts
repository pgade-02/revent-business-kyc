import { PDFDict, PDFDocument, PDFName, PDFString } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { pdfLibInspector } from "@/providers/pdf-lib-inspector";
import { makeImagePdf, makeTextImage, makeTextPdf } from "../fixtures/make-files";

// Synthetic PDFs built in the test. pdf-lib saves with compressed object streams by
// default, so these also prove the inspector looks inside them.
async function makePdf(change?: (document: PDFDocument) => Promise<void> | void): Promise<Uint8Array> {
  const document = await PDFDocument.load(await makeTextPdf(["A page with some text on it."]));
  await change?.(document);
  return document.save();
}

function addAction(document: PDFDocument, action: PDFDict) {
  document.catalog.set(PDFName.of("OpenAction"), document.context.register(action));
}

// The same kind of attachment Adobe apps add: a small JSON note tagged ADBE_Contact_Private.
// The tag can be changed to check that only Adobe's own note is accepted.
async function withAttachment(options: { bytes: number; mimeType: string; relationship: string }): Promise<Uint8Array> {
  const attached = await makePdf(async (document) => {
    await document.attach(new Uint8Array(options.bytes).fill(0x20), "note.json", { mimeType: options.mimeType });
  });
  const document = await PDFDocument.load(attached);
  for (const [, object] of document.context.enumerateIndirectObjects()) {
    if (object instanceof PDFDict && object.get(PDFName.of("Type")) === PDFName.of("Filespec")) {
      object.set(PDFName.of("AFRelationship"), PDFName.of(options.relationship));
    }
  }
  return document.save();
}

describe("pdfLibInspector", () => {
  it("counts pages and finds nothing active in a plain PDF", async () => {
    const result = await pdfLibInspector.inspect(await makeTextPdf(["Page one text.", "Page two text."]));
    expect(result).toEqual({
      ok: true,
      facts: { pageCount: 2, emptyPageCount: 0, hasJavaScript: false, hasEmbeddedFiles: false, hasFormActions: false },
    });
  });

  it("counts blank pages, but not pages that only hold a scanned image", async () => {
    const blank = await pdfLibInspector.inspect(await makeTextPdf(["", "Some text.", ""]));
    expect(blank).toMatchObject({ ok: true, facts: { pageCount: 3, emptyPageCount: 2 } });
    const scan = await pdfLibInspector.inspect(await makeImagePdf([await makeTextImage("Scanned page")]));
    expect(scan).toMatchObject({ ok: true, facts: { emptyPageCount: 0 } });
  });

  it("finds JavaScript that runs when the PDF opens", async () => {
    const bytes = await makePdf((document) =>
      addAction(document, document.context.obj({ Type: "Action", S: "JavaScript", JS: PDFString.of("app.alert(1)") })),
    );
    expect(await pdfLibInspector.inspect(bytes)).toMatchObject({ ok: true, facts: { hasJavaScript: true } });
  });

  it("finds a file attached inside the PDF", async () => {
    const bytes = await makePdf(async (document) => {
      await document.attach(new TextEncoder().encode("hidden"), "note.txt", { mimeType: "text/plain" });
    });
    expect(await pdfLibInspector.inspect(bytes)).toMatchObject({ ok: true, facts: { hasEmbeddedFiles: true } });
  });

  it("accepts the tiny JSON note that Adobe apps add", async () => {
    const bytes = await withAttachment({ bytes: 86, mimeType: "application/json", relationship: "ADBE_Contact_Private" });
    expect(await pdfLibInspector.inspect(bytes)).toMatchObject({ ok: true, facts: { hasEmbeddedFiles: false } });
  });

  it.each([
    ["too large", { bytes: 50_000, mimeType: "application/json", relationship: "ADBE_Contact_Private" }],
    ["not JSON", { bytes: 86, mimeType: "application/x-msdownload", relationship: "ADBE_Contact_Private" }],
    ["not Adobe's tag", { bytes: 86, mimeType: "application/json", relationship: "Data" }],
  ])("still refuses an attachment that only looks like Adobe's note (%s)", async (_case, options) => {
    expect(await pdfLibInspector.inspect(await withAttachment(options))).toMatchObject({ ok: true, facts: { hasEmbeddedFiles: true } });
  });

  it("finds a form that sends data to another site", async () => {
    const bytes = await makePdf((document) =>
      addAction(document, document.context.obj({ Type: "Action", S: "SubmitForm", F: PDFString.of("https://example.invalid") })),
    );
    expect(await pdfLibInspector.inspect(bytes)).toMatchObject({ ok: true, facts: { hasFormActions: true } });
  });

  it("reports a password-protected PDF", async () => {
    const bytes = await makePdf((document) => {
      document.context.trailerInfo.Encrypt = document.context.obj({ Filter: "Standard" });
    });
    expect(await pdfLibInspector.inspect(bytes)).toEqual({ ok: false, reason: "ENCRYPTED" });
  });

  it("reports a file that only pretends to be a PDF", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.7 this is not really a pdf");
    expect(await pdfLibInspector.inspect(bytes)).toEqual({ ok: false, reason: "UNREADABLE" });
  });
});
