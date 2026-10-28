// Step 3: clean, filter and enrich the scraped places into the dataset the website loads.
//
//   node scripts/scrape/build.mjs            # writes src/data/schools.json
//   node scripts/scrape/build.mjs --report   # also prints what was kept/dropped and why
import fs from 'node:fs';
import path from 'node:path';
import { RAW_DIR, ROOT, arg, readJson, writeJson } from './lib.mjs';

const OUT = path.join(ROOT, 'src/data/schools.json');
const REJECTS = path.join(RAW_DIR, 'rejected.json');
const KUWAIT_BBOX = { south: 28.52, north: 30.11, west: 46.55, east: 48.43 };

// Google categories (English UI) that are early-years by definition.
const EARLY_YEARS_CATEGORY = /nursery school|preschool|pre-school|kindergarten|day ?care|child ?care|playgroup|montessori|early childhood/i;
// Generic school categories count only when the name says it is early-years.
const SCHOOL_CATEGORY = /school|academy|education/i;
const EARLY_YEARS_NAME = /nursery|pre-?school|kindergarten|\bkg\b|day ?care|montessori|toddler|kids|حضان|روض|رياض|تمهيدي/i;
const NOT_A_SCHOOL = /plant|garden|florist|landscap|farm|seed|tree|pharmacy|hospital|clinic|doctor|dental|store|shop|supermarket|market|restaurant|caf[eé]|salon|spa|hotel|mosque|church|park|playground|real estate|mall|toy|clothing|furniture|bank|government office|ministry/i;

const discovered = readJson(path.join(RAW_DIR, 'discovered.json'), { places: {} }).places;
const details = readJson(path.join(RAW_DIR, 'details.json'), {});
const governorates = readJson(path.join(ROOT, 'data/geo/kuwait-governorates.geojson'), { features: [] }).features;

function insideRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function governorateOf(lng, lat) {
  for (const f of governorates) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    if (polys.some(([outer, ...holes]) => insideRing([lng, lat], outer) && !holes.some((h) => insideRing([lng, lat], h)))) {
      return f.properties.shapeName;
    }
  }
  // Schools on the waterfront can fall just outside the simplified outlines: use the nearest one.
  let best = null;
  let bestDist = Infinity;
  for (const f of governorates) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const [x, y] of polys.flatMap((poly) => poly[0])) {
      const d = (x - lng) ** 2 + (y - lat) ** 2;
      if (d < bestDist) [best, bestDist] = [f.properties.shapeName, d];
    }
  }
  return bestDist < 0.05 ** 2 ? best : null;
}

// "83J5+V8 Salmiya, Kuwait" → "Salmiya"
const areaFromPlusCode = (code) => code?.match(/^\S+\s+(.+?),\s*Kuwait$/)?.[1] ?? null;

// "+96525340304" → "+965 2534 0304"
const formatPhone = (p) => (p?.startsWith('+965') && p.length === 12 ? `+965 ${p.slice(4, 8)} ${p.slice(8)}` : p ?? null);

// "KIDSZONE KINDERGARTEN SCHOOL" → "Kidszone Kindergarten School". Short words stay as
// acronyms (KG, IAK) unless they are ordinary joining words. Mixed-case names are untouched.
const JOINING_WORDS = new Set(['and', 'of', 'the', 'for', 'in', 'at', 'al', 'el', 'to']);
function tidyName(name) {
  const letters = name?.match(/[A-Za-z]/g) ?? [];
  const upper = letters.filter((c) => c === c.toUpperCase()).length;
  if (!letters.length || upper / letters.length < 0.5 || !/[A-Z]{4}/.test(name)) return name;
  return name.replace(/[A-Z][A-Z'’]*/g, (word, offset) => {
    const lower = word.toLowerCase();
    if (JOINING_WORDS.has(lower)) return offset === 0 ? word[0] + lower.slice(1) : lower;
    return word.length <= 3 ? word : word[0] + lower.slice(1);
  });
}

// "Five Senses Preschool حضانة الحواس الخمس" → { latin: "Five Senses Preschool", arabic: "حضانة الحواس الخمس" }
const ARABIC_RUN = /[\u0600-\u06FF][\u0600-\u06FF\s\d\-–،.()]*[\u0600-\u06FF)]/;
function splitBilingual(name) {
  const arabic = name?.match(ARABIC_RUN)?.[0]?.trim();
  if (!arabic) return { latin: name, arabic: null };
  const latin = name.replace(arabic, '').replace(/\s*[-–|/]\s*$|^\s*[-–|/]\s*/g, '').replace(/\s{2,}/g, ' ').trim();
  return { latin: /[A-Za-z]{2}/.test(latin) ? latin : null, arabic };
}

// The name is the most reliable signal (روضة = kindergarten, حضانة = nursery); Google's
// category, which owners choose themselves, only decides when the name says nothing.
function classify(name, altName, category) {
  const names = `${name} ${altName ?? ''}`;
  if (/روض|رياض/.test(names)) return 'kindergarten';
  if (/حضان/.test(names)) return 'nursery';
  if (/kindergarten|\bkg\b/i.test(names)) return 'kindergarten';
  if (/nursery|day ?care|baby|toddler/i.test(names)) return 'nursery';
  if (/pre-?school|montessori|early (years|childhood|learning)|play ?school/i.test(names)) return 'preschool';
  if (/kindergarten/i.test(category ?? '')) return 'kindergarten';
  if (/preschool|montessori/i.test(category ?? '')) return 'preschool';
  return 'nursery';
}

// Names that leave no doubt. Arabic حضانة is a child nursery (a plant nursery is مشتل),
// so these win even when the business picked a wrong Google category.
const STRONG_NAME = /حضان|روض|رياض\s*(ال)?أطفال|nursery school|pre-?school|kindergarten|\bkg\b|day ?care|montessori|toddler/i;
const KID_WORDS = /kid|baby|babies|child|little|play|tots|toddler|mini|junior/i;
// Categories that are never a school, whatever the name says.
const HARD_NO = /grocery|supermarket|restaurant|caf[eé]|pharmacy|hospital|clinic|doctor|dental|salon|spa\b|hotel|mosque|church|real estate|bank|car |gas station|mall|clothing|furniture|toy store/i;

function verdict(p, d) {
  if (!d || d.error) return 'no details';
  if (d.status === 'Permanently closed') return 'permanently closed';
  const { lat, lng } = p;
  if (lat < KUWAIT_BBOX.south || lat > KUWAIT_BBOX.north || lng < KUWAIT_BBOX.west || lng > KUWAIT_BBOX.east) return 'outside Kuwait';
  if (d.address && !/kuwait|الكويت/i.test(d.address) && !/kuwait/i.test(d.plusCode ?? '')) return 'outside Kuwait';
  const category = d.category ?? '';
  const name = `${d.name ?? p.name} ${d.altName ?? ''}`;
  if (EARLY_YEARS_CATEGORY.test(category)) return 'keep';
  if (HARD_NO.test(category)) return `category: ${category}`;
  if (/plant nursery|garden|florist|landscap/i.test(category)) {
    return /حضان|روض|رياض/.test(name) || KID_WORDS.test(name) ? 'keep' : `category: ${category}`;
  }
  if (STRONG_NAME.test(name)) return 'keep';
  if (SCHOOL_CATEGORY.test(category) && EARLY_YEARS_NAME.test(name)) return 'keep';
  if (NOT_A_SCHOOL.test(category)) return `category: ${category}`;
  return `category: ${category || '(none)'}`;
}

// English (or Latin-script) display name plus the Arabic name when Google has one.
// Invisible left-to-right / right-to-left marks that some listings carry.
const BIDI_MARKS = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

function names(raw, alt) {
  const main = splitBilingual(raw?.replace(BIDI_MARKS, ''));
  const second = splitBilingual(alt?.replace(BIDI_MARKS, ''));
  const arabic = main.arabic ?? second.arabic;
  // Drop stray punctuation, and treat handles like "_happylandfaiha" or "." as no English name.
  const clean = (v) => v?.replace(/^[\s._\-–|/]+|[\s._\-–|/]+$/g, '') || null;
  const junk = (v) => !v || !/[A-Za-z]{3}/.test(v) || /^[a-z0-9_.]+$/.test(v);
  const latin = [clean(main.latin), clean(second.latin)].find((v) => !junk(v));
  if (!latin && arabic) return { name: arabic, nameAr: arabic };
  const name = tidyName(latin ?? raw).replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  return { name, nameAr: arabic };
}

const kept = [];
const rejected = {};
for (const p of Object.values(discovered)) {
  const d = details[p.fid];
  const v = verdict(p, d);
  if (v !== 'keep') {
    (rejected[v] ??= []).push(d?.name ?? p.name);
    continue;
  }
  const lat = Number.isFinite(d.lat) ? d.lat : p.lat;
  const lng = Number.isFinite(d.lng) ? d.lng : p.lng;
  kept.push({
    id: p.fid.split(':')[1],
    ...names(d.name ?? p.name, d.altName),
    kind: classify(d.name ?? p.name, d.altName, d.category),
    category: d.category,
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    governorate: governorateOf(lng, lat),
    area: areaFromPlusCode(d.plusCode),
    address: d.address,
    phone: formatPhone(d.phone),
    website: d.website,
    rating: d.rating,
    photo: d.photo?.replace(/=w\d+-h\d+[^=]*$/, '=w480-h320-k-no') ?? null,
    mapsUrl: p.placeId ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.name ?? p.name)}&query_place_id=${p.placeId}` : p.href,
    status: d.status,
  });
}

// The same school sometimes appears twice (branch pages, duplicates): drop exact name+position repeats.
const seen = new Set();
const schools = kept
  .filter((s) => {
    const key = `${s.name.toLowerCase()}|${s.lat.toFixed(4)}|${s.lng.toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })
  .sort((a, b) => a.name.localeCompare(b.name));

// Photos: with --photos, download each one into public/photos so the site never depends on
// Google's image links staying alive. Already-downloaded photos are always used.
const PHOTO_DIR = path.join(ROOT, 'public/photos');
fs.mkdirSync(PHOTO_DIR, { recursive: true });
const download = arg('photos') === true ? schools.filter((s) => s.photo && !fs.existsSync(path.join(PHOTO_DIR, `${s.id}.jpg`))) : [];
if (download.length) console.log(`Downloading ${download.length} photos…`);
for (let i = 0; i < download.length; i += 8) {
  await Promise.all(
    download.slice(i, i + 8).map(async (s) => {
      try {
        const res = await fetch(s.photo);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        fs.writeFileSync(path.join(PHOTO_DIR, `${s.id}.jpg`), Buffer.from(await res.arrayBuffer()));
      } catch (err) {
        console.warn(`  photo for ${s.name}: ${err.message}`);
      }
    }),
  );
}
for (const s of schools) if (fs.existsSync(path.join(PHOTO_DIR, `${s.id}.jpg`))) s.photo = `/photos/${s.id}.jpg`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
writeJson(OUT, schools);
writeJson(REJECTS, rejected);

const count = (key) => Object.entries(Object.groupBy(schools, (s) => s[key] ?? '—')).map(([k, v]) => `${k}: ${v.length}`).join(', ');
console.log(`Discovered ${Object.keys(discovered).length}, with details ${Object.keys(details).length}, kept ${schools.length}`);
console.log(`By kind — ${count('kind')}`);
console.log(`By governorate — ${count('governorate')}`);
console.log(`With phone ${schools.filter((s) => s.phone).length}, photo ${schools.filter((s) => s.photo).length}, Arabic name ${schools.filter((s) => s.nameAr).length}`);
if (arg('report') === true) {
  console.log('\nRejected:');
  for (const [reason, names] of Object.entries(rejected).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${String(names.length).padStart(4)}  ${reason}  e.g. ${names.slice(0, 3).join(' | ')}`);
  }
  console.log('\nKept categories:');
  for (const [c, list] of Object.entries(Object.groupBy(schools, (s) => s.category ?? '—')).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${String(list.length).padStart(4)}  ${c}`);
  }
}
console.log(`\nWrote ${path.relative(ROOT, OUT)}`);
