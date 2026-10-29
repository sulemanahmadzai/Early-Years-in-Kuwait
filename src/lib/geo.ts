import type { LngLatBoundsLike } from 'maplibre-gl';
import type { School } from './types';

export function boundsOf(schools: School[], minSpanDeg = 0.03): LngLatBoundsLike {
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of schools) {
    w = Math.min(w, p.lng);
    e = Math.max(e, p.lng);
    s = Math.min(s, p.lat);
    n = Math.max(n, p.lat);
  }
  // Keep a single school (or a tight cluster) from zooming the camera all the way in.
  const padLng = Math.max(0, minSpanDeg - (e - w)) / 2;
  const padLat = Math.max(0, minSpanDeg - (n - s)) / 2;
  return [
    [w - padLng, s - padLat],
    [e + padLng, n + padLat],
  ];
}

export const formatKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`);

/**
 * Bounds of the bulk of the schools, ignoring the few outliers in each direction
 * (farm areas near the borders) so the camera frames where the network actually is.
 */
export function coreBoundsOf(schools: School[], trim = 0.03, pad = 0.025): LngLatBoundsLike {
  if (schools.length < 20) return boundsOf(schools, 0.06);
  const pick = (values: number[], p: number) => values[Math.floor(p * (values.length - 1))];
  const lats = schools.map((s) => s.lat).sort((a, b) => a - b);
  const lngs = schools.map((s) => s.lng).sort((a, b) => a - b);
  return [
    [pick(lngs, trim) - pad, pick(lats, trim) - pad],
    [pick(lngs, 1 - trim) + pad, pick(lats, 1 - trim) + pad],
  ];
}
