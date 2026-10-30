import hexData from '../data/children-hex.json';
import type { School } from './types';

/** A 1.2 km hexagon with its estimated children under five (WorldPop 2026). */
export interface ChildHex {
  q: number;
  r: number;
  lng: number;
  lat: number;
  children: number;
  governorate: string | null;
  area: { en: string; ar: string; km: number } | null;
}

export interface HexStat extends ChildHex {
  /** Distance to the nearest school on the map (km). */
  nearestKm: number;
  /** Schools within NEAR_KM of the hexagon's centre. */
  schoolsNear: number;
  /** Children under five living within NEAR_KM. */
  childrenNear: number;
  /** childrenNear ÷ schoolsNear, or null when there is no school that close. */
  perSchool: number | null;
  /** 0 (well served) … 4 (worst), per lens. */
  band: Record<Lens, number>;
}

export type Lens = 'perSchool' | 'distance';

export interface Coverage {
  hexes: HexStat[];
  children: number;
  /** Children living more than FAR_KM from the nearest school. */
  farChildren: number;
  hotspots: Record<Lens, HexStat[]>;
}

export const HEXES = hexData as ChildHex[];
export const HEX_RADIUS_M = 600;
export const NEAR_KM = 1.5;
export const FAR_KM = 2;

// Upper bounds of bands 0–3; band 4 is "no school within NEAR_KM" / "more than 5 km".
export const PER_SCHOOL_BOUNDS = [150, 300, 600];
export const DISTANCE_BOUNDS = [1, 2, 3, 5];

// One hue (amber), stepping in lightness: on the dark maps the worst-served areas are the
// brightest, on the day map the darkest. Both ramps pass the ordinal checks against their surface.
export const RAMPS = {
  dark: ['#8b532f', '#b56b3a', '#df8448', '#ffa264', '#ffc793'],
  light: ['#db9062', '#c86e31', '#ab5200', '#8a3a00', '#672700'],
};

const KM_PER_DEG_LAT = 110.57;
const KM_PER_DEG_LNG = 111.32 * Math.cos((29.3 * Math.PI) / 180);
const toKm = (lng: number, lat: number): [number, number] => [lng * KM_PER_DEG_LNG, lat * KM_PER_DEG_LAT];
const CELL_KM = 1;

/** A coarse grid of points for fast "what's within d km" lookups. */
function gridIndex(points: [number, number][]) {
  const cells = new Map<string, number[]>();
  points.forEach(([x, y], i) => {
    const key = `${Math.floor(x / CELL_KM)},${Math.floor(y / CELL_KM)}`;
    const list = cells.get(key);
    if (list) list.push(i);
    else cells.set(key, [i]);
  });
  return {
    /** Indices of points in the cells within `ring` cells of (x, y). */
    around(x: number, y: number, ring: number) {
      const cx = Math.floor(x / CELL_KM);
      const cy = Math.floor(y / CELL_KM);
      const out: number[] = [];
      for (let i = cx - ring; i <= cx + ring; i++) {
        for (let j = cy - ring; j <= cy + ring; j++) out.push(...(cells.get(`${i},${j}`) ?? []));
      }
      return out;
    },
  };
}

// Children within NEAR_KM of each hexagon never change, so they are summed once.
const hexKm = HEXES.map((h) => toKm(h.lng, h.lat));
const hexIndex = gridIndex(hexKm);
const CHILDREN_NEAR = HEXES.map((_, i) => {
  const [x, y] = hexKm[i];
  return hexIndex
    .around(x, y, Math.ceil(NEAR_KM / CELL_KM))
    .filter((j) => Math.hypot(hexKm[j][0] - x, hexKm[j][1] - y) <= NEAR_KM)
    .reduce((sum, j) => sum + HEXES[j].children, 0);
});

const bandOf = (value: number, bounds: number[]) => {
  const i = bounds.findIndex((b) => value <= b);
  return i < 0 ? bounds.length : i;
};

/** Pick the top places by `score`, at least 3 km apart and under different names, so one district doesn't fill the list. */
function spreadOut(list: HexStat[], score: (h: HexStat) => number, count = 5) {
  const picked: HexStat[] = [];
  const label = (h: HexStat) => `${h.area?.en ?? ''}|${h.governorate}`;
  for (const h of [...list].sort((a, b) => score(b) - score(a))) {
    if (picked.some((p) => label(p) === label(h) || Math.hypot((p.lng - h.lng) * KM_PER_DEG_LNG, (p.lat - h.lat) * KM_PER_DEG_LAT) < 3)) continue;
    picked.push(h);
    if (picked.length === count) break;
  }
  return picked;
}

/** Where children under five live relative to the schools currently on the map. */
export function analyseCoverage(schools: School[]): Coverage {
  const schoolKm = schools.map((s) => toKm(s.lng, s.lat));
  const schoolIndex = gridIndex(schoolKm);

  let children = 0;
  let farChildren = 0;
  const hexes = HEXES.map((h, i): HexStat => {
    const [x, y] = hexKm[i];
    // Widen the search ring until the nearest school found is closer than the ring's edge.
    let nearestKm = Infinity;
    for (let ring = 1; ring <= 12 && nearestKm > (ring - 1) * CELL_KM; ring++) {
      for (const j of schoolIndex.around(x, y, ring)) nearestKm = Math.min(nearestKm, Math.hypot(schoolKm[j][0] - x, schoolKm[j][1] - y));
    }
    // Remote places (farms near the borders): just check every school.
    if (nearestKm === Infinity) for (const [sx, sy] of schoolKm) nearestKm = Math.min(nearestKm, Math.hypot(sx - x, sy - y));
    const schoolsNear = schoolIndex
      .around(x, y, Math.ceil(NEAR_KM / CELL_KM))
      .filter((j) => Math.hypot(schoolKm[j][0] - x, schoolKm[j][1] - y) <= NEAR_KM).length;
    const childrenNear = CHILDREN_NEAR[i];
    const perSchool = schoolsNear ? childrenNear / schoolsNear : null;
    children += h.children;
    if (nearestKm > FAR_KM) farChildren += h.children;
    return {
      ...h,
      nearestKm,
      schoolsNear,
      childrenNear,
      perSchool,
      band: {
        perSchool: perSchool === null ? 4 : bandOf(perSchool, PER_SCHOOL_BOUNDS),
        distance: bandOf(nearestKm, DISTANCE_BOUNDS),
      },
    };
  });

  const populated = hexes.filter((h) => h.childrenNear >= 200);
  const noSchool = populated.filter((h) => h.schoolsNear === 0);
  return {
    hexes,
    children,
    farChildren,
    hotspots: {
      // Most children with no school within NEAR_KM; if that's rare, the most children per school.
      perSchool: noSchool.length >= 5 ? spreadOut(noSchool, (h) => h.childrenNear) : spreadOut(populated, (h) => h.perSchool ?? Infinity),
      // The most children living more than FAR_KM from any school on the map.
      distance: spreadOut(
        populated.filter((h) => h.nearestKm > FAR_KM),
        (h) => h.childrenNear,
      ),
    },
  };
}
