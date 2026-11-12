import { PDFDict, PDFDocument, PDFName, PDFString } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { pdfLibInspector } from "@/providers/pdf-lib-inspector";

// Synthetic PDFs built in the test. pdf-lib saves with compressed object streams by
// default, so these also prove the inspector looks inside them.
async function makePdf(pages: number, change?: (document: PDFDocument) => Promise<void> | void): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  for (let page = 0; page < pages; page += 1) document.addPage();
  await change?.(document);
  return document.save();
}

function addAction(document: PDFDocument, action: PDFDict) {
  const ref = document.context.register(action);
  document.catalog.set(PDFName.of("OpenAction"), ref);
}

describe("pdfLibInspector", () => {
  it("counts pages and finds nothing active in a plain PDF", async () => {
    const result = await pdfLibInspector.inspect(await makePdf(3));
    expect(result).toEqual({
      ok: true,
      facts: { pageCount: 3, hasJavaScript: false, hasEmbeddedFiles: false, hasFormActions: false },
    });
  });

  it("finds JavaScript that runs when the PDF opens", async () => {
    const bytes = await makePdf(1, (document) =>
      addAction(document, document.context.obj({ Type: "Action", S: "JavaScript", JS: PDFString.of("app.alert(1)") })),
    );
    expect(await pdfLibInspector.inspect(bytes)).toMatchObject({ ok: true, facts: { hasJavaScript: true } });
  });

  it("finds a file attached inside the PDF", async () => {
    const bytes = await makePdf(1, async (document) => {
      await document.attach(new TextEncoder().encode("hidden"), "note.txt", { mimeType: "text/plain" });
    });
    expect(await pdfLibInspector.inspect(bytes)).toMatchObject({ ok: true, facts: { hasEmbeddedFiles: true } });
  });

  it("finds a form that sends data to another site", async () => {
    const bytes = await makePdf(1, (document) =>
      addAction(document, document.context.obj({ Type: "Action", S: "SubmitForm", F: PDFString.of("https://example.invalid") })),
    );
    expect(await pdfLibInspector.inspect(bytes)).toMatchObject({ ok: true, facts: { hasFormActions: true } });
  });

  it("reports a password-protected PDF", async () => {
    const bytes = await makePdf(1, (document) => {
      document.context.trailerInfo.Encrypt = document.context.obj({ Filter: "Standard" });
    });
    expect(await pdfLibInspector.inspect(bytes)).toEqual({ ok: false, reason: "ENCRYPTED" });
  });

  it("reports a file that only pretends to be a PDF", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.7 this is not really a pdf");
    expect(await pdfLibInspector.inspect(bytes)).toEqual({ ok: false, reason: "UNREADABLE" });
  });
});
