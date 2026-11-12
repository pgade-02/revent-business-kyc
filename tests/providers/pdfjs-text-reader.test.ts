import { describe, expect, it } from "vitest";
import { pdfjsTextReader } from "@/providers/pdfjs-text-reader";
import { makeTextPdf } from "../fixtures/make-files";
import { syntheticTexts } from "../fixtures/synthetic-documents";

describe("pdfjsTextReader", () => {
  it("reads the text layer of each page, line by line", async () => {
    const pages = await pdfjsTextReader.readPages(await makeTextPdf([syntheticTexts.tradeLicence, ""]));
    expect(pages).toHaveLength(2);
    expect(pages[0]?.text).toContain("Licence Number: CN-1234567");
    expect(pages[0]?.text).toContain("Expiry Date: 2027-03-01");
    expect(pages[1]?.text.trim()).toBe(""); // an image-only page has no text layer
  });
});
