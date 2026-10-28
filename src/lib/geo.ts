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
