// OCR often reads a run of "<" filler one too long or too short (decision log #46, #67).
// Filler only ever trails a field's data and counts 0 in every check digit, so fitting it never
// changes a value that was read; the check digits still catch any real misread.

// The data kept exactly as read, with the trailing filler fitted to the field's length.
export function fitTrailingFiller(field: string, length: number): string | null {
  const data = field.replace(/<+$/, "");
  return data.length <= length ? data.padEnd(length, "<") : null;
}
