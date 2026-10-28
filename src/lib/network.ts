import { Delaunay } from 'd3-delaunay';
import { ORIGIN } from './meta';
import type { School } from './types';

export interface Edge {
  a: number;
  b: number;
  path: [[number, number], [number, number]];
  // Reveal times for the intro: each thread grows away from Kuwait City.
  timestamps: [number, number];
}

export interface Pulse {
  path: [number, number][];
  timestamps: number[];
}

export interface Network {
  edges: Edge[];
  neighbours: number[][];
  maxTime: number;
}

const KM_PER_DEG_LAT = 110.57;
const KM_PER_DEG_LNG = 111.32 * Math.cos((29.3 * Math.PI) / 180);
// Threads longer than this would cross Kuwait Bay or open desert and clutter the weave.
const MAX_EDGE_KM = 5;

export function distanceKm(a: [number, number], b: [number, number]) {
  const dx = (a[0] - b[0]) * KM_PER_DEG_LNG;
  const dy = (a[1] - b[1]) * KM_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}

/**
 * Connect schools into a triangular mesh (Delaunay), drop the long threads,
 * then make sure no school is left without at least one connection.
 */
export function buildNetwork(schools: School[]): Network {
  const points = schools.map((s) => [s.lng * KM_PER_DEG_LNG, s.lat * KM_PER_DEG_LAT] as [number, number]);
  const neighbours: number[][] = schools.map(() => []);
  if (schools.length < 3) return { edges: [], neighbours, maxTime: 1 };

  const delaunay = Delaunay.from(points);
  const { triangles, halfedges } = delaunay;
  const candidates: { a: number; b: number; km: number }[] = [];
  for (let e = 0; e < triangles.length; e++) {
    if (e > halfedges[e]) {
      const a = triangles[e];
      const b = triangles[e % 3 === 2 ? e - 2 : e + 1];
      candidates.push({ a, b, km: Math.hypot(points[a][0] - points[b][0], points[a][1] - points[b][1]) });
    }
  }

  const kept = candidates.filter((c) => c.km <= MAX_EDGE_KM);
  const linked = new Set(kept.flatMap((c) => [c.a, c.b]));
  // Outlying schools keep their single shortest thread so every school is on the grid.
  const shortestFor = new Map<number, (typeof candidates)[number]>();
  for (const c of candidates) {
    for (const node of [c.a, c.b]) {
      if (linked.has(node)) continue;
      const best = shortestFor.get(node);
      if (!best || c.km < best.km) shortestFor.set(node, c);
    }
  }
  const all = [...kept, ...new Set(shortestFor.values())];

  const fromOrigin = schools.map((s) => distanceKm([s.lng, s.lat], ORIGIN));
  let maxTime = 1;
  const edges = all.map(({ a, b }) => {
    neighbours[a].push(b);
    neighbours[b].push(a);
    const [near, far] = fromOrigin[a] <= fromOrigin[b] ? [a, b] : [b, a];
    maxTime = Math.max(maxTime, fromOrigin[far]);
    return {
      a: near,
      b: far,
      path: [
        [schools[near].lng, schools[near].lat],
        [schools[far].lng, schools[far].lat],
      ] as Edge['path'],
      timestamps: [fromOrigin[near], fromOrigin[far]] as Edge['timestamps'],
    };
  });
  return { edges, neighbours, maxTime };
}

/** Random walks along the mesh, used for the light pulses travelling between schools. */
export function buildPulses(schools: School[], network: Network, count: number, loopKm: number): Pulse[] {
  const { neighbours } = network;
  const starts = schools.map((_, i) => i).filter((i) => neighbours[i].length > 0);
  if (!starts.length) return [];
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  return Array.from({ length: count }, () => {
    let node = starts[Math.floor(random() * starts.length)];
    let prev = -1;
    let t = random() * loopKm;
    const path: [number, number][] = [[schools[node].lng, schools[node].lat]];
    const timestamps = [t];
    for (let step = 0; step < 14; step++) {
      const options = neighbours[node].filter((n) => n !== prev);
      if (!options.length) break;
      const next = options[Math.floor(random() * options.length)];
      t += distanceKm([schools[node].lng, schools[node].lat], [schools[next].lng, schools[next].lat]);
      path.push([schools[next].lng, schools[next].lat]);
      timestamps.push(t);
      prev = node;
      node = next;
    }
    return { path, timestamps };
  });
}
