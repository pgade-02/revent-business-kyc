import { PDFDict, PDFDocument, PDFName, PDFString, setTextRenderingMode, TextRenderingMode } from "pdf-lib";
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
      facts: { pageCount: 2, emptyPageCount: 0, picturePages: [], hasJavaScript: false, hasEmbeddedFiles: false, hasFormActions: false },
    });
  });

  it("counts blank pages, but not pages that only hold a scanned image", async () => {
    const blank = await pdfLibInspector.inspect(await makeTextPdf(["", "Some text.", ""]));
    expect(blank).toMatchObject({ ok: true, facts: { pageCount: 3, emptyPageCount: 2 } });
    const scan = await pdfLibInspector.inspect(await makeImagePdf([await makeTextImage("Scanned page")]));
    expect(scan).toMatchObject({ ok: true, facts: { emptyPageCount: 0 } });
  });

  it("marks scanned pages as picture pages, and leaves computer-made pages alone", async () => {
    const scanThenDigital = await PDFDocument.load(await makeImagePdf([await makeTextImage("Scanned page")]));
    scanThenDigital.addPage().drawText("A computer-made page with a small logo-free layout.", { x: 50, y: 700, size: 11 });
    expect(await pdfLibInspector.inspect(await scanThenDigital.save())).toMatchObject({ ok: true, facts: { picturePages: [1] } });
  });

  it("marks a page with invisible text (a scanner app's own OCR layer) as a picture page", async () => {
    const document = await PDFDocument.create();
    const page = document.addPage();
    // Text render mode 3 = invisible, the way scanner apps hide their text over the photo.
    page.pushOperators(setTextRenderingMode(TextRenderingMode.Invisible));
    page.drawText("784-1990-0000000-1", { x: 50, y: 700, size: 11 });
    expect(await pdfLibInspector.inspect(await document.save())).toMatchObject({ ok: true, facts: { picturePages: [1] } });
  });

  it("does not treat a small logo as a scan", async () => {
    const document = await PDFDocument.load(await makeTextPdf(["Bank statement text with a logo."]));
    const logo = await document.embedJpg(await makeTextImage("LOGO", 300, 120));
    document.getPage(0).drawImage(logo, { x: 400, y: 760, width: 150, height: 60 });
    expect(await pdfLibInspector.inspect(await document.save())).toMatchObject({ ok: true, facts: { picturePages: [] } });
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
