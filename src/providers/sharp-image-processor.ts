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

// Sharpness = "variance of the Laplacian", measured on the sharpest parts of the photo.
// 1. Grey, and always the same width, so big and small photos are measured alike.
// 2. An edge filter (Laplacian): every pixel minus its 4 neighbours. Crisp text gives
//    strong positive and negative values; blur smears edges so values stay near zero.
// 3. Split into tiles and take each tile's variance (how spread out the values are).
// 4. Score = average of the sharpest 10% of tiles: the text, not the empty card or desk.
const SHARPNESS_WIDTH = 1200;
const TILE = 50;
const TOP_SHARE = 0.1;
const NEUTRAL = 128; // sharp clips filter output to 0–255, so zero is moved to the middle

export async function sharpnessScore(bytes: Uint8Array): Promise<number> {
  const { data, info } = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .greyscale()
    .resize({ width: SHARPNESS_WIDTH })
    .convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0], offset: NEUTRAL })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const variances: number[] = [];
  for (let top = 0; top + TILE <= info.height; top += TILE) {
    for (let left = 0; left + TILE <= info.width; left += TILE) {
      let sum = 0;
      let sumOfSquares = 0;
      for (let y = top; y < top + TILE; y += 1) {
        for (let x = left; x < left + TILE; x += 1) {
          const value = (data[y * info.width + x] ?? NEUTRAL) - NEUTRAL;
          sum += value;
          sumOfSquares += value * value;
        }
      }
      const count = TILE * TILE;
      variances.push(sumOfSquares / count - (sum / count) ** 2);
    }
  }
  if (variances.length === 0) return 0;
  variances.sort((a, b) => b - a);
  const top = variances.slice(0, Math.max(1, Math.round(variances.length * TOP_SHARE)));
  return Math.round(top.reduce((total, value) => total + value, 0) / top.length);
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
  measureSharpness: (bytes) => sharpnessScore(bytes).catch(() => null),
};
