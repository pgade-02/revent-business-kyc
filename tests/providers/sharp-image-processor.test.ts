import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { hammingDistance } from "@/kyc/intake/hashes";
import { sharpImageProcessor } from "@/providers/sharp-image-processor";

// A synthetic "document": diagonal stripes, so it has a pattern to fingerprint.
async function stripes(width: number, height: number, inverted = false): Promise<ReturnType<typeof sharp>> {
  const pixels = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dark = Math.floor((x + y) / (width / 4)) % 2 === 0;
      pixels.fill(dark !== inverted ? 30 : 230, (y * width + x) * 3, (y * width + x) * 3 + 3);
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } });
}

async function clean(bytes: Buffer) {
  const result = await sharpImageProcessor.clean(new Uint8Array(bytes));
  if (!result.ok) throw new Error(result.reason);
  return result.image;
}

describe("sharpImageProcessor", () => {
  it("removes EXIF data (such as location and device) from a photo", async () => {
    const photo = await (await stripes(400, 300)).jpeg().withExif({ IFD0: { Make: "Test phone", Copyright: "test" } }).toBuffer();
    expect((await sharp(photo).metadata()).exif).toBeDefined();

    const image = await clean(photo);
    expect(image.format).toBe("jpeg");
    expect((await sharp(image.bytes).metadata()).exif).toBeUndefined();
    expect([image.width, image.height]).toEqual([400, 300]);
  });

  it("gives nearly the same fingerprint to the same picture at another size", async () => {
    const large = await clean(await (await stripes(800, 600)).png().toBuffer());
    const small = await clean(await (await stripes(400, 300)).png().toBuffer());
    expect(large.format).toBe("png");
    expect(hammingDistance(large.perceptualHash, small.perceptualHash)).toBeLessThanOrEqual(5);
  });

  it("gives a very different fingerprint to a different picture", async () => {
    const original = await clean(await (await stripes(400, 300)).png().toBuffer());
    const inverted = await clean(await (await stripes(400, 300, true)).png().toBuffer());
    expect(hammingDistance(original.perceptualHash, inverted.perceptualHash)).toBeGreaterThan(20);
  });

  it("reports a file that only pretends to be an image", async () => {
    const fake = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    expect(await sharpImageProcessor.clean(fake)).toEqual({ ok: false, reason: "UNREADABLE" });
  });
});
