// Children under five, per hexagon, for the coverage view.
//
// Source: WorldPop 2026 age/sex estimates for Kuwait (R2025A, 100 m, constrained to built-up
// areas), ages 0 and 1–4, girls and boys. Download them into data/population/ first:
//
//   b=https://data.worldpop.org/GIS/AgeSex_structures/Global_2015_2030/R2025A/2026/KWT/v1/100m/constrained
//   for f in f_00 f_01 m_00 m_01; do curl -o data/population/kwt_${f}_2026.tif $b/kwt_${f}_2026_CN_100m_R2025A_v1.tif; done
//   node scripts/coverage/children.mjs
//
// Writes src/data/children-hex.json: flat-topped hexagons 1.2 km across (radius 0.6 km).
import { fromFile } from 'geotiff';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader as Pbf } from 'pbf';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const OUT = path.join(ROOT, 'src/data/children-hex.json');
const RASTERS = ['f_00', 'f_01', 'm_00', 'm_01'].map((f) => path.join(ROOT, `data/population/kwt_${f}_2026.tif`));

export const HEX_RADIUS_KM = 0.6;
const KM_PER_DEG_LAT = 110.57;
const KM_PER_DEG_LNG = 111.32 * Math.cos((29.3 * Math.PI) / 180);
const SQRT3 = Math.sqrt(3);

// Flat-topped axial hex coordinates on a local kilometre grid.
function hexOf(xKm, yKm) {
  const q = ((2 / 3) * xKm) / HEX_RADIUS_KM;
  const r = ((-1 / 3) * xKm + (SQRT3 / 3) * yKm) / HEX_RADIUS_KM;
  let [rx, ry, rz] = [Math.round(q), Math.round(-q - r), Math.round(r)];
  const [dx, dy, dz] = [Math.abs(rx - q), Math.abs(ry - (-q - r)), Math.abs(rz - r)];
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy <= dz) rz = -rx - ry;
  return [rx, rz];
}
const hexCentre = (q, r) => [HEX_RADIUS_KM * 1.5 * q, HEX_RADIUS_KM * SQRT3 * (r + q / 2)];

// --- children per hexagon ---------------------------------------------------
let total = 0;
const hexes = new Map();
let grid = null;
for (const file of RASTERS) {
  const image = await (await fromFile(file)).getImage();
  const [values] = await image.readRasters();
  const nodata = image.getGDALNoData();
  const [x0, y0] = image.getOrigin();
  const [dx, dy] = image.getResolution();
  const width = image.getWidth();
  grid ??= { x0, y0, dx, dy, width };
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!(v > 0) || v === nodata) continue;
    const lng = x0 + ((i % width) + 0.5) * dx;
    const lat = y0 + (Math.floor(i / width) + 0.5) * dy;
    const [q, r] = hexOf(lng * KM_PER_DEG_LNG, lat * KM_PER_DEG_LAT);
    const key = `${q},${r}`;
    hexes.set(key, (hexes.get(key) ?? 0) + v);
    total += v;
  }
}

// --- labels: governorate and the nearest neighbourhood ----------------------
const governorates = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/geo/kuwait-governorates.geojson'), 'utf8')).features;
function insideRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const outerRings = (f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates[0]] : f.geometry.coordinates.map((p) => p[0]));
function governorateOf(lng, lat) {
  const inside = governorates.find((f) => outerRings(f).some((ring) => insideRing([lng, lat], ring)));
  if (inside) return inside.properties.shapeName;
  // On the coast the simplified outlines can miss: take the governorate with the nearest vertex.
  let best = null;
  let bestD = Infinity;
  for (const f of governorates) {
    for (const [x, y] of outerRings(f).flat()) {
      const d = (x - lng) ** 2 + (y - lat) ** 2;
      if (d < bestD) [best, bestD] = [f.properties.shapeName, d];
    }
  }
  return best;
}

// Neighbourhood names (English and Arabic) from the same OpenStreetMap tiles the map draws,
// read once at zoom 14 for the populated part of Kuwait and cached in data/raw.
const PLACES_CACHE = path.join(ROOT, 'data/raw/osm-places.json');
const PLACE_CLASSES = new Set(['suburb', 'neighbourhood', 'quarter', 'town', 'village', 'city']);
async function loadPlaces(points) {
  if (fs.existsSync(PLACES_CACHE)) return JSON.parse(fs.readFileSync(PLACES_CACHE, 'utf8'));
  const { tiles } = await (await fetch('https://tiles.openfreemap.org/planet')).json();
  const z = 14;
  const n = 2 ** z;
  const tileOf = ([lng, lat]) => {
    const rad = (lat * Math.PI) / 180;
    return [Math.floor(((lng + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n)];
  };
  const wanted = [...new Set(points.map((p) => tileOf(p).join('/')))];
  const places = new Map();
  for (let i = 0; i < wanted.length; i += 8) {
    await Promise.all(
      wanted.slice(i, i + 8).map(async (xy) => {
        const [x, y] = xy.split('/').map(Number);
        const res = await fetch(tiles[0].replace('{z}', z).replace('{x}', x).replace('{y}', y));
        if (!res.ok) return;
        const layer = new VectorTile(new Pbf(new Uint8Array(await res.arrayBuffer()))).layers.place;
        for (let f = 0; f < (layer?.length ?? 0); f++) {
          const feature = layer.feature(f);
          const p = feature.properties;
          if (!PLACE_CLASSES.has(p.class)) continue;
          const [lng, lat] = feature.toGeoJSON(x, y, z).geometry.coordinates;
          const en = p['name:en'] ?? p['name:latin'] ?? p.name;
          const ar = p['name:ar'] ?? (/[\u0600-\u06FF]/.test(p.name ?? '') ? p.name : null);
          places.set(`${p.class}|${en}`, { en, ar, kind: p.class, lng, lat });
        }
      }),
    );
  }
  const list = [...places.values()];
  fs.mkdirSync(path.dirname(PLACES_CACHE), { recursive: true });
  fs.writeFileSync(PLACES_CACHE, JSON.stringify(list));
  return list;
}
// Places inside Kuwait only (the tiles reach over the border into Iraq and Saudi Arabia), with
// English names for the few that only carry an Arabic one.
const ENGLISH = { 'منطقة كبد': 'Kabd', 'حي دور القاعدة': 'Base Housing' };
const places = (
  await loadPlaces([...hexes.keys()].map((key) => {
    const [q, r] = key.split(',').map(Number);
    const [x, y] = hexCentre(q, r);
    return [x / KM_PER_DEG_LNG, y / KM_PER_DEG_LAT];
  }))
)
  .filter((p) => governorates.some((f) => outerRings(f).some((ring) => insideRing([p.lng, p.lat], ring))))
  .map((p) => ({ ...p, en: ENGLISH[p.en] ?? p.en }));
// The closest neighbourhood within 6 km (the interface says "near …" beyond 2 km); a city's label
// point counts as 1 km further away, so central districts keep their own names rather than "Kuwait City".
function nearestArea(lng, lat) {
  let best = null;
  let bestKm = 6;
  for (const p of places) {
    const km = Math.hypot((p.lng - lng) * KM_PER_DEG_LNG, (p.lat - lat) * KM_PER_DEG_LAT) + (p.kind === 'city' ? 1 : 0);
    if (km < bestKm) [best, bestKm] = [p, km];
  }
  return best ? { en: best.en, ar: best.ar ?? best.en, km: Math.round(bestKm * 10) / 10 } : null;
}

const out = [];
for (const [key, children] of hexes) {
  if (children < 5) continue; // stray pixels in the desert
  const [q, r] = key.split(',').map(Number);
  const [x, y] = hexCentre(q, r);
  const lng = x / KM_PER_DEG_LNG;
  const lat = y / KM_PER_DEG_LAT;
  out.push({
    q,
    r,
    lng: Math.round(lng * 1e5) / 1e5,
    lat: Math.round(lat * 1e5) / 1e5,
    children: Math.round(children),
    governorate: governorateOf(lng, lat),
    area: nearestArea(lng, lat),
  });
}
out.sort((a, b) => b.children - a.children);
console.log(`${places.length} neighbourhood names; ${out.filter((h) => !h.area).length} hexagons without one`);
fs.writeFileSync(OUT, `${JSON.stringify(out)}\n`);
console.log(
  `${Math.round(total).toLocaleString()} children under five in ${out.length} hexagons ` +
    `(largest ${out[0].children.toLocaleString()}) → ${path.relative(ROOT, OUT)}`,
);
