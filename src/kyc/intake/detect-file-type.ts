export type FileKind = "pdf" | "png" | "jpeg";

// Every file format starts with a fixed "signature". Reading it tells us what the
// file really is, whatever its name says: invoice.pdf.exe or a renamed .docx is caught.
const signatures: { kind: FileKind; bytes: number[] }[] = [
  { kind: "pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // "%PDF-"
  { kind: "png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { kind: "jpeg", bytes: [0xff, 0xd8, 0xff] },
];

export function detectFileType(bytes: Uint8Array): FileKind | null {
  const match = signatures.find((signature) => signature.bytes.every((byte, index) => bytes[index] === byte));
  return match ? match.kind : null;
}
