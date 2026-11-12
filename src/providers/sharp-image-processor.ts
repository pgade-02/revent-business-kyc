import sharp from "sharp";
import type { ImageProcessing, ImageProcessor } from "@/kyc/interfaces/image-processor";

// Refuse images over 50 megapixels: a tiny file can claim to be enormous and use up
// the server's memory when opened (a "decompression bomb"). Phone photos are ~12–50 MP.
const MAX_INPUT_PIXELS = 50_000_000;

// Average hash: shrink to 8×8 grey, then each bit = "is this square brighter than average?".
// Photos of the same page give almost the same 64 bits, even at different sizes.
async function averageHash(bytes: Uint8Array): Promise<string> {
  const pixels = await sharp(bytes).greyscale().resize(8, 8, { fit: "fill" }).raw().toBuffer();
  const mean = pixels.reduce((sum, value) => sum + value, 0) / pixels.length;
  let bits = 0n;
  for (const value of pixels) bits = (bits << 1n) | (value > mean ? 1n : 0n);
  return bits.toString(16).padStart(16, "0");
}

export const sharpImageProcessor: ImageProcessor = {
  async clean(bytes): Promise<ImageProcessing> {
    try {
      const metadata = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
      const format = metadata.format === "png" ? "png" : "jpeg";
      // rotate() applies the EXIF orientation first, so the picture stays upright after
      // re-encoding. sharp writes no EXIF unless asked, so location and device data are dropped.
      const pipeline = sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS }).rotate();
      const encoded = format === "png" ? pipeline.png() : pipeline.jpeg({ quality: 90 });
      const { data, info } = await encoded.toBuffer({ resolveWithObject: true });
      const cleanBytes = new Uint8Array(data);
      return {
        ok: true,
        image: {
          bytes: cleanBytes,
          format,
          width: info.width,
          height: info.height,
          perceptualHash: await averageHash(cleanBytes),
        },
      };
    } catch {
      return { ok: false, reason: "UNREADABLE" };
    }
  },
};
