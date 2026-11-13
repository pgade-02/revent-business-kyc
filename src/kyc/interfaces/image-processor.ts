export type CleanImage = {
  bytes: Uint8Array; // re-encoded, with EXIF (location, device) removed
  format: "png" | "jpeg";
  width: number;
  height: number;
  // 64-bit picture fingerprint as 16 hex characters. Two photos of the same page
  // give fingerprints that differ in only a few bits, even after resizing.
  perceptualHash: string;
};

export type ImageProcessing = { ok: true; image: CleanImage } | { ok: false; reason: "UNREADABLE" };

export interface ImageProcessor {
  clean(bytes: Uint8Array): Promise<ImageProcessing>;
  // How sharp the text in a photo is: 0 = completely blurred, higher = sharper.
  // Compared with READ_MIN_SHARPNESS by DOC_UNREADABLE. Null if the image cannot be opened.
  measureSharpness(bytes: Uint8Array): Promise<number | null>;
}
