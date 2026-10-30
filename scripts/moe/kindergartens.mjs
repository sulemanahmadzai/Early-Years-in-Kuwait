// Extract the list of government kindergartens from the Ministry of Education's school
// directory (دليل المدارس 2024-2025, kindergarten stage = pages 6–29) into
// data/moe/government-kindergartens.json. Needs poppler's `pdftotext` (brew install poppler).
//
//   node scripts/moe/kindergartens.mjs [path/to/directory.pdf]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const PDF = process.argv[2] ?? path.join(ROOT, 'data/moe/schools-directory-2024-2025.pdf');
const OUT = path.join(ROOT, 'data/moe/government-kindergartens.json');

// The kindergarten stage, one education district after another (headings checked by eye:
// some district names use glyphs that don't extract).
const DISTRICT_PAGES = [
  ['Ahmadi', 6, 11],
  ['Jahra', 12, 14],
  ['Hawalli', 15, 17],
  ['Al Asimah', 18, 22],
  ['Farwaniya', 23, 26],
  ['Mubarak Al-Kabeer', 27, 29],
];

// The PDF stores Arabic words in visual order using presentation-form letters: reverse the
// characters first (so lam-alef ligatures stay whole), then normalise to ordinary letters.
// A few ligatures in the fonts don't map to Unicode and come out as Latin letters or symbols;
// they are kept as "…" so matching can treat them as a gap.
function readArabic(word) {
  if (/^[\d./-]+$/.test(word)) return word;
  const logical = [...word].reverse().join('').normalize('NFKC');
  return logical.replace(/[A-Za-z@^`?!$%&*+=<>|~_\\{}[\]À-ɏ]+/g, '…');
}

function wordsOnPage(page) {
  const xml = execFileSync('pdftotext', ['-bbox', '-f', String(page), '-l', String(page), PDF, '-'], { encoding: 'utf8' });
  return [...xml.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)].map((m) => ({
    x: (Number(m[1]) + Number(m[3])) / 2,
    xMax: Number(m[3]),
    y: (Number(m[2]) + Number(m[4])) / 2,
    text: m[5].replace(/[‪-‮‎‏]/g, ''),
  }));
}

const rows = [];
for (const [district, first, last] of DISTRICT_PAGES) {
  for (let page = first; page <= last; page++) {
    const words = wordsOnPage(page);
    // Column centres come from the header row ("المنطقة … الشارع"), which sits above the first school.
    const headerY = words.find((w) => readArabic(w.text) === 'المنطقة')?.y;
    if (headerY === undefined) throw new Error(`No table header on page ${page}`);
    const header = words.filter((w) => Math.abs(w.y - headerY) < 4).map((w) => ({ ...w, label: readArabic(w.text) }));
    const colX = (labels) => {
      const hits = header.filter((h) => labels.includes(h.label));
      return hits.reduce((sum, h) => sum + h.x, 0) / hits.length;
    };
    const columns = {
      area: colX(['المنطقة']),
      name: colX(['إسم', 'المدرسة']),
      year: colX(['سنة', 'الإنشاء']),
      phone: colX(['رقم', 'الهاتف']),
      paci: colX(['رابط', 'العنوان']),
      block: colX(['القطعه']),
      street: colX(['الشارع']),
    };
    const columnOf = (w) => Object.entries(columns).sort((a, b) => Math.abs(a[1] - w.x) - Math.abs(b[1] - w.x))[0][0];

    // Below the header and above the page-number footer.
    const body = words.filter((w) => w.y > headerY + 6 && w.y < 645);
    // Every school row has exactly one founding year; other cells are attached to the nearest year.
    const years = body.filter((w) => columnOf(w) === 'year' && /^(19|20)\d\d$/.test(w.text)).sort((a, b) => a.y - b.y);
    const pageRows = years.map((y) => ({ y: y.y, cells: { year: [y] } }));
    const areaWords = [];
    for (const w of body) {
      const col = columnOf(w);
      if (col === 'year') continue;
      if (col === 'area') {
        if (!/^\d+$/.test(w.text)) areaWords.push(w); // skip the page number in the corner
        continue;
      }
      const row = pageRows.reduce((best, r) => (Math.abs(r.y - w.y) < Math.abs(best.y - w.y) ? r : best), pageRows[0]);
      if (!row || Math.abs(row.y - w.y) > 40) continue;
      (row.cells[col] ??= []).push(w);
    }
    // The area cell is merged across its schools and centred on them: give each row the area
    // label closest to it vertically.
    const areaLines = Object.values(Object.groupBy(areaWords, (w) => Math.round(w.y / 6))).map((ws) => ({
      y: ws.reduce((s, w) => s + w.y, 0) / ws.length,
      text: ws.sort((a, b) => b.xMax - a.xMax).map((w) => readArabic(w.text)).join(' '),
    }));
    const text = (ws = []) => ws.sort((a, b) => b.xMax - a.xMax || a.y - b.y).map((w) => readArabic(w.text)).join(' ').trim();
    for (const r of pageRows) {
      const area = areaLines.length ? areaLines.reduce((best, a) => (Math.abs(a.y - r.y) < Math.abs(best.y - r.y) ? a : best)).text : null;
      const digits = (r.cells.phone ?? []).map((w) => w.text).filter((t) => /^\d{8}$/.test(t));
      rows.push({
        district,
        area,
        name: text(r.cells.name),
        founded: Number(r.cells.year[0].text),
        phones: digits,
        paci: (r.cells.paci ?? []).map((w) => w.text).find((t) => /^\d{6,9}$/.test(t)) ?? null,
        block: text(r.cells.block) || null,
        street: text(r.cells.street) || null,
        page,
      });
    }
  }
}

fs.writeFileSync(OUT, `${JSON.stringify(rows, null, 1)}\n`);
const byDistrict = Object.entries(Object.groupBy(rows, (r) => r.district)).map(([d, l]) => `${d} ${l.length}`).join(', ');
console.log(`${rows.length} government kindergartens (${byDistrict}) → ${path.relative(ROOT, OUT)}`);
