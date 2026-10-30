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
// "روضة" is a kindergarten, but "الروضة" is usually the Rawda area (its library, park, high school),
// and "رياض" alone also matches "رياضيات" (maths), so it only counts as "رياض الأطفال".
const EARLY_YEARS_NAME = /nursery|pre-?school|kindergarten|\bkg\b|day ?care|montessori|toddler|kids|حضان|(?<!ال)روض|رياض\s*(ال)?[أا]طفال|تمهيدي/i;
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
  // "حضانة الروضة" is a nursery in Rawda, so the word that comes first decides.
  const nurseryAt = names.search(/حا?ضا?ن/);
  const kgAt = names.search(/روض|رياض/);
  if (nurseryAt >= 0 && (kgAt < 0 || nurseryAt < kgAt)) return 'nursery';
  if (kgAt >= 0) return 'kindergarten';
  if (/kindergarten|\bkg\b/i.test(names)) return 'kindergarten';
  if (/nursery|day ?care|baby|toddler/i.test(names)) return 'nursery';
  if (/pre-?school|montes+or+i|early (years|childhood|learning)|play ?school/i.test(names)) return 'preschool';
  if (/kindergarten/i.test(category ?? '')) return 'kindergarten';
  if (/preschool|montessori/i.test(category ?? '')) return 'preschool';
  return 'nursery';
}

// Names that leave no doubt. Arabic حضانة is a child nursery (a plant nursery is مشتل),
// so these win even when the business picked a wrong Google category.
const STRONG_NAME = /حا?ضا?ن|(?<!ال)روض|رياض\s*(ال)?أطفال|تعليم المبكر|nursery school|pre-?school|kindergarten|\bkg\b|day ?care|montes+or+i|toddler|early (learning|years|childhood)/i;
const KID_WORDS = /kid|baby|babies|child|little|play|tots|toddler|mini|junior/i;
// Categories that are never a school, whatever the name says.
const HARD_NO = /grocery|supermarket|market|co-?op|restaurant|caf[eé]|pharmacy|hospital|clinic|doctor|dental|medical|health|salon|spa\b|hotel|mosque|church|real estate|bank|car |gas station|mall|clothing|furniture|store|shop|gym|park\b|playground|bus stop|library|farm|photographer|high school|distribution|warehouse/i;

// Places checked by hand and found not to be early-years schools (see the reason on each).
const EXCLUDE = readJson(path.join(ROOT, 'scripts/scrape/exclude.json'), {});
// Real schools whose Google photo is something else (a sofa, a car, a garden, a selfie…); they show
// the woven pattern instead. Keyed by school id, checked by hand from a contact sheet of all photos.
const BAD_PHOTOS = readJson(path.join(ROOT, 'scripts/scrape/bad-photos.json'), {});

function verdict(p, d) {
  if (EXCLUDE[p.fid.split(':')[1]]) return 'excluded by hand (scripts/scrape/exclude.json)';
  if (!d || d.error) return 'no details';
  if (d.status === 'Permanently closed') return 'permanently closed';
  const { lat, lng } = p;
  if (lat < KUWAIT_BBOX.south || lat > KUWAIT_BBOX.north || lng < KUWAIT_BBOX.west || lng > KUWAIT_BBOX.east) return 'outside Kuwait';
  if (d.address && !/kuwait|الكويت/i.test(d.address) && !/kuwait/i.test(d.plusCode ?? '')) return 'outside Kuwait';
  const category = d.category ?? '';
  const name = `${d.name ?? p.name} ${d.altName ?? ''}`;
  if (EARLY_YEARS_CATEGORY.test(category)) return 'keep';
  if (HARD_NO.test(category)) return `category: ${category}`;
  // A garden or plant nursery is only a school if the name says so in words that can't mean
  // "garden": روضة literally means garden/meadow, so it doesn't count here; حضانة or kids' words do.
  if (/plant nursery|garden|florist|landscap|wholesal|arboretum|park|farm/i.test(category)) {
    return /حا?ضا?ن/.test(name) || KID_WORDS.test(name) ? 'keep' : `category: ${category}`;
  }
  // "… near Blossoms Nursery" is a building next to a school, not the school.
  if (/\bnear\b|بالقرب/i.test(name)) return `category: ${category || '(none)'} (near)`;
  if (STRONG_NAME.test(name)) return 'keep';
  // Plain "nursery" is ambiguous in English (plants), but plant nurseries were handled above.
  if (/nursery|نيرسري/i.test(name)) return 'keep';
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

// Many schools have two Google pins a few metres apart (typically one without a category and one
// marked "Preschool", or "روضة"/"روضه" spellings). Same name within 350 m = same school: keep the
// best-documented pin and fill its gaps from the others.
const normName = (t) =>
  (t ?? '')
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^؀-ۿa-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase();
const distanceKm = (a, b) => Math.hypot((a.lat - b.lat) * 110.57, (a.lng - b.lng) * 97.1);
const quality = (s) => (EARLY_YEARS_CATEGORY.test(s.category ?? '') ? 8 : 0) + (s.photo ? 4 : 0) + (s.phone ? 2 : 0) + (s.rating ? 1 : 0);

const parent = kept.map((_, i) => i);
const root = (i) => (parent[i] === i ? i : (parent[i] = root(parent[i])));
const keys = kept.map((s) => new Set([normName(s.name), normName(s.nameAr)].filter(Boolean)));
for (let i = 0; i < kept.length; i++) {
  for (let j = i + 1; j < kept.length; j++) {
    if (distanceKm(kept[i], kept[j]) <= 0.35 && [...keys[i]].some((k) => keys[j].has(k))) parent[root(j)] = root(i);
  }
}
const groups = Object.values(Object.groupBy(kept.map((s, i) => ({ s, i })), ({ i }) => root(i))).map((g) => g.map(({ s }) => s));
let merged = 0;
const schools = groups
  .map((group) => {
    if (group.length === 1) return group[0];
    merged += group.length - 1;
    const [best, ...rest] = [...group].sort((a, b) => quality(b) - quality(a));
    const latinName = [best, ...rest].map((s) => s.name).find((n) => /[A-Za-z]{3}/.test(n));
    const out = { ...best, name: latinName ?? best.name };
    for (const key of ['nameAr', 'area', 'address', 'phone', 'website', 'rating', 'photo']) out[key] ??= rest.find((s) => s[key])?.[key] ?? null;
    return out;
  })
  .sort((a, b) => a.name.localeCompare(b.name));

// Photos: with --photos, download each one into public/photos so the site never depends on
// Google's image links staying alive. Already-downloaded photos are always used.
// ---- Government or private -------------------------------------------------
// Government kindergartens are the ones in the Ministry of Education's 2024–25 school directory
// (extracted by scripts/moe/kindergartens.mjs). Each Ministry entry is matched to the map by
// phone number, else by name within its district (spelling variants, a missing "ال", reordered
// words and the PDF's few unreadable letters are tolerated). Everything else is private: all
// nurseries (حضانة) are privately run, and so are kindergartens missing from the directory.
const MOE = readJson(path.join(ROOT, 'data/moe/government-kindergartens.json'), []);
const coreName = (t) =>
  normName(t)
    .replace(/^(روضه اطفال|رياض الاطفال|رياض اطفال|روضه)\s+/, '')
    .replace(/\s*[-–(].*$/, '')
    .trim();
const dropAl = (t) => t.replace(/(^|\s)ال/g, '$1');
const lastDigits = (p) => (p ?? '').replace(/\D/g, '').slice(-8);
const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}
// Does a school's name (already reduced to its core) name this Ministry kindergarten?
// The PDF's unreadable letters arrive as "…"; carry them through normalisation as "۞" (an Arabic-block
// sign normName keeps) and treat each run as a gap of 1–4 letters.
const GAP = '۞';
function sameKindergarten(moeName, schoolCore) {
  const moeCore = coreName(moeName.replaceAll('…', GAP)).replace(new RegExp(`\\s*${GAP}[\\s${GAP}]*`, 'g'), GAP);
  if (moeCore.includes(GAP)) {
    const re = new RegExp(`^${moeCore.replace(/\s+/g, '').split(GAP).map(escapeRe).join('.{1,4}')}`);
    if (re.test(schoolCore.replace(/\s+/g, ''))) return true;
    // Or every readable word of the Ministry name appears in the school's name (word order differs).
    const words = moeCore.split(new RegExp(`[\\s${GAP}]+`)).filter((w) => w.length > 1);
    const have = new Set(schoolCore.split(' '));
    return words.length >= 2 && words.every((w) => have.has(w));
  }
  const a = dropAl(moeCore);
  const b = dropAl(schoolCore);
  if (a === b || b.startsWith(`${a} `)) return true; // Google often appends the area
  return a.length >= 4 && editDistance(a, b) <= 1; // one-letter spelling differences (حيان / حبان)
}

const looksLikeKindergarten = (s) => [s.nameAr, s.name].some((n) => n && /^(روض|رياض)/.test(normName(n)));
const moeOf = new Map(); // school index → Ministry entry
for (const m of MOE) {
  // Name within the district first: phone numbers are sometimes shared between neighbouring
  // kindergartens on Google, so a phone alone only decides when no name matches.
  const byName = schools.filter((s) => looksLikeKindergarten(s) && [s.nameAr, s.name].some((n) => n && sameKindergarten(m.name, coreName(n))));
  let hits = byName.filter((s) => s.governorate === m.district);
  if (!hits.length) {
    const phones = [...m.phones, ...(m.paci && /^[2569]\d{7}$/.test(m.paci) ? [m.paci] : [])];
    hits = schools.filter((s) => s.phone && phones.includes(lastDigits(s.phone)) && !moeOf.has(schools.indexOf(s)));
  }
  // Education districts don't follow governorate borders exactly: accept a unique match next door.
  if (!hits.length && byName.length === 1) hits = byName;
  for (const s of hits) if (!moeOf.has(schools.indexOf(s))) moeOf.set(schools.indexOf(s), m);
}
// Two pins matching the same Ministry kindergarten within 2 km are one school (typically an
// English-named pin and an Arabic-named one): keep the better-documented pin.
let moeMerged = 0;
const pinsByMoe = Object.groupBy([...moeOf.entries()], ([, m]) => MOE.indexOf(m));
const dropped = new Set();
for (const pins of Object.values(pinsByMoe)) {
  const list = pins.map(([i]) => i).sort((a, b) => quality(schools[b]) - quality(schools[a]));
  const [keep, ...rest] = list;
  for (const i of rest) {
    if (distanceKm(schools[keep], schools[i]) > 2) continue;
    for (const key of ['nameAr', 'area', 'address', 'phone', 'website', 'rating', 'photo']) schools[keep][key] ??= schools[i][key];
    dropped.add(i);
    moeMerged++;
  }
}
for (const [i, m] of moeOf) {
  const s = schools[i];
  s.sector = 'government';
  s.kind = 'kindergarten';
  s.founded = m.founded;
  // The directory's phone is official; use it when Google has none.
  s.phone ??= m.phones[0] ? `+965 ${m.phones[0].slice(0, 4)} ${m.phones[0].slice(4)}` : null;
}
for (const s of schools) {
  s.sector ??= 'private';
  s.founded ??= null;
}
for (const i of [...dropped].sort((a, b) => b - a)) schools.splice(i, 1);
const moeFound = new Set([...moeOf.values()]).size;
// Ministry kindergartens with no pin on Google Maps, for the record.
writeJson(
  path.join(RAW_DIR, 'moe-not-on-map.json'),
  MOE.filter((m) => ![...moeOf.values()].includes(m)).map(({ district, area, name, phones }) => ({ district, area, name, phones })),
);

for (const s of schools) if (BAD_PHOTOS[s.id]) s.photo = null;
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
for (const s of schools) {
  const file = path.join(PHOTO_DIR, `${s.id}.jpg`);
  if (BAD_PHOTOS[s.id]) fs.rmSync(file, { force: true });
  else if (fs.existsSync(file)) s.photo = `/photos/${s.id}.jpg`;
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
writeJson(OUT, schools);
writeJson(REJECTS, rejected);

const count = (key) => Object.entries(Object.groupBy(schools, (s) => s[key] ?? '—')).map(([k, v]) => `${k}: ${v.length}`).join(', ');
console.log(`Discovered ${Object.keys(discovered).length}, with details ${Object.keys(details).length}, kept ${schools.length} (${merged} duplicate pins merged)`);
console.log(`By kind — ${count('kind')}`);
console.log(`By governorate — ${count('governorate')}`);
console.log(`With phone ${schools.filter((s) => s.phone).length}, photo ${schools.filter((s) => s.photo).length}, Arabic name ${schools.filter((s) => s.nameAr).length}`);
console.log(
  `Government ${schools.filter((s) => s.sector === 'government').length}, private ${schools.filter((s) => s.sector === 'private').length}` +
    ` — ${moeFound} of ${MOE.length} Ministry kindergartens found on the map, ${moeMerged} duplicate pins merged`,
);
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
