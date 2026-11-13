import { chromium, type Browser } from "@playwright/test";
import sharp, { type OverlayOptions } from "sharp";

// Turns template HTML into the kinds of files customers really upload:
// a computer-made PDF (with a text layer), a clean image, or a phone photo of paper.

export type Renderer = {
  pdf: (html: string) => Promise<Uint8Array>;
  png: (html: string) => Promise<Uint8Array>;
  close: () => Promise<void>;
};

export async function startRenderer(): Promise<Renderer> {
  const browser: Browser = await chromium.launch();
  const open = async (html: string) => {
    const page = await browser.newPage({ deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "load" });
    return page;
  };
  return {
    async pdf(html) {
      const page = await open(html);
      const bytes = await page.pdf({ format: "A4", printBackground: true });
      await page.close();
      return new Uint8Array(bytes);
    },
    async png(html) {
      // Screenshot only the document itself (card or page), not the empty browser window.
      const page = await open(html);
      const element = page.locator("body > *").first();
      const bytes = await element.screenshot();
      await page.close();
      return new Uint8Array(bytes);
    },
    close: () => browser.close(),
  };
}

export type PhotoOptions = { tiltDegrees: number; blurSigma: number; glare: boolean; quality: number };

export const normalPhoto: PhotoOptions = { tiltDegrees: 3, blurSigma: 0.6, glare: true, quality: 82 };
export const blurryPhoto: PhotoOptions = { tiltDegrees: 7, blurSigma: 9, glare: true, quality: 55 };

// A phone photo: the document slightly tilted on a desk, a little soft, with a light
// reflection, saved as JPEG. Readability checks must pass normalPhoto and fail blurryPhoto.
export async function phonePhoto(image: Uint8Array, options: PhotoOptions): Promise<Uint8Array> {
  let picture = sharp(image).rotate(options.tiltDegrees, { background: "#6b5845" });
  if (options.blurSigma > 0) picture = picture.blur(options.blurSigma);
  const tilted = await picture.png().toBuffer();
  const { width = 1000, height = 700 } = await sharp(tilted).metadata();

  const margin = Math.round(width * 0.08);
  const desk = sharp({
    create: { width: width + margin * 2, height: height + margin * 2, channels: 3, background: "#6b5845" },
  });
  const layers: OverlayOptions[] = [{ input: tilted, top: margin, left: margin }];
  if (options.glare) {
    const glare = `<svg width="${width + margin * 2}" height="${height + margin * 2}"><defs>
      <radialGradient id="g" cx="70%" cy="25%" r="35%"><stop offset="0" stop-color="#fff" stop-opacity=".45"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
      <rect width="100%" height="100%" fill="url(#g)"/></svg>`;
    layers.push({ input: Buffer.from(glare), top: 0, left: 0 });
  }
  const bytes = await desk.composite(layers).jpeg({ quality: options.quality }).toBuffer();
  return new Uint8Array(bytes);
}
