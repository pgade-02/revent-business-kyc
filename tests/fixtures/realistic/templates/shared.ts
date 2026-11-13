// Pieces shared by every template. Documents look like real UAE paperwork (bilingual,
// tables, QR, stamps) but carry fictional names and a SPECIMEN mark, and never use a
// real authority's or bank's name or logo.

export const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// UAE documents print dates as DD/MM/YYYY, which the AI must turn into YYYY-MM-DD.
export const uaeDate = (isoDate: string) => isoDate.split("-").reverse().join("/");

export const aed = (fils: number) =>
  (fils / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const baseCss = `
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Segoe UI", Arial, "Noto Naskh Arabic", sans-serif; color: #1b1f2a; }
  .page { position: relative; padding: 36px 44px; overflow: hidden; }
  .ar { direction: rtl; font-family: Arial, "Segoe UI", sans-serif; }
  .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  h1 { font-size: 20px; margin: 0; letter-spacing: 0.5px; }
  h2 { font-size: 14px; margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #c9ced8; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  td, th { border: 1px solid #c9ced8; padding: 6px 8px; vertical-align: top; text-align: left; }
  th { background: #eef1f6; font-weight: 600; }
  .muted { color: #5b6272; font-size: 11px; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font-size: 96px; font-weight: 800; color: rgba(200, 30, 30, 0.08); transform: rotate(-28deg); pointer-events: none; }
`;

export const watermark = `<div class="watermark">SPECIMEN</div>`;

// A QR-like square from the text's characters. Decorative only: it encodes nothing.
export function fakeQr(seedText: string, size = 84): string {
  const cells = 21;
  let state = [...seedText].reduce((total, character) => total * 31 + character.charCodeAt(0), 7) >>> 0;
  const squares: string[] = [];
  for (let y = 0; y < cells; y += 1) {
    for (let x = 0; x < cells; x += 1) {
      state = (state * 1_664_525 + 1_013_904_223) >>> 0;
      const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
      const ring = finder && (x % 14 === 0 || x % 14 === 6 || y % 14 === 0 || y % 14 === 6 || (x % 14 > 1 && x % 14 < 5 && y % 14 > 1 && y % 14 < 5));
      if ((finder && ring) || (!finder && state % 2 === 0)) squares.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
    }
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${cells} ${cells}" shape-rendering="crispEdges"><rect width="${cells}" height="${cells}" fill="#fff"/><g fill="#111">${squares.join("")}</g></svg>`;
}

export function stamp(textEn: string, textAr: string, colour = "#2b4fa8"): string {
  return `<svg width="120" height="120" viewBox="0 0 120 120" style="opacity:.75">
    <circle cx="60" cy="60" r="55" fill="none" stroke="${colour}" stroke-width="3"/>
    <circle cx="60" cy="60" r="44" fill="none" stroke="${colour}" stroke-width="1"/>
    <text x="60" y="56" text-anchor="middle" font-size="10" font-weight="700" fill="${colour}">${escapeHtml(textEn)}</text>
    <text x="60" y="72" text-anchor="middle" font-size="11" fill="${colour}" font-family="Arial">${escapeHtml(textAr)}</text>
  </svg>`;
}

// A plain silhouette instead of a face: no real or generated person is shown.
export const faceSilhouette = (width: number, height: number) => `
  <svg width="${width}" height="${height}" viewBox="0 0 100 125">
    <rect width="100" height="125" fill="#dfe5ee"/>
    <circle cx="50" cy="45" r="22" fill="#9aa6b8"/>
    <path d="M12 125 C14 88 86 88 88 125 Z" fill="#9aa6b8"/>
  </svg>`;

export const signature = (name: string) =>
  `<span style="font-family:'Segoe Script','Brush Script MT',cursive;font-size:20px;color:#1c3d8f">${escapeHtml(name)}</span>`;

export const htmlPage = (css: string, body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${baseCss}${css}</style></head><body>${body}</body></html>`;
