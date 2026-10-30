import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Map, Source, useControl, type MapRef } from 'react-map-gl/maplibre';
import { MapboxOverlay, type MapboxOverlayProps } from '@deck.gl/mapbox';
import { ScatterplotLayer, GeoJsonLayer } from '@deck.gl/layers';
import { TripsLayer } from '@deck.gl/geo-layers';
import type { PickingInfo } from '@deck.gl/core';
import 'maplibre-gl/dist/maplibre-gl.css';
import governoratesRaw from '../../data/geo/kuwait-governorates.geojson?raw';
import { buildStyle } from './style';
import { KINDS, ORIGIN } from '../lib/meta';
import { buildPulses, distanceKm, type Network } from '../lib/network';
import type { MapTheme, School } from '../lib/types';
import type { Lang } from '../lib/i18n';

const governorates = JSON.parse(governoratesRaw) as GeoJSON.FeatureCollection;

// Arabic map labels need right-to-left shaping. The plugin (copied from @mapbox/mapbox-gl-rtl-text
// into public/vendor, since the package doesn't export its built file) loads on first use.
// (Imported on demand so MapLibre stays in its own chunk, as react-map-gl loads it.)
import('maplibre-gl')
  .then(({ setRTLTextPlugin }) => setRTLTextPlugin(new URL('/vendor/mapbox-gl-rtl-text.js', location.href).href, true))
  .catch(() => {});

export const KUWAIT_VIEW = { longitude: 47.82, latitude: 29.27, zoom: 9.35, pitch: 38, bearing: -8 };
export const GULF_VIEW = { longitude: 49.6, latitude: 27.4, zoom: 5.1, pitch: 0, bearing: 0 };
export const INTRO_SECONDS = 4;
// West, south, east, north — keeps the camera around the northern Gulf.
const MAX_BOUNDS: [number, number, number, number] = [42.5, 24.5, 53.5, 32.5];

type RGB = [number, number, number];
type RGBA = [number, number, number, number];

const shortName = (name: string) => (name.length > 36 ? `${name.slice(0, 34).trimEnd()}…` : name);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
// Overshoots slightly, so each school "pops" into place.
const easeOutBack = (x: number) => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2;
// Dot radius in pixels for a zoom level: fine grain at country scale, larger in a neighbourhood.
const dotRadius = (zoom: number) => Math.min(8, 2.1 + Math.max(0, zoom - 9) * 0.8);
// Map labels are drawn above the network so place names stay readable.
// (`beforeId` is read by the MapLibre overlay; deck's layer types don't declare it.)
const UNDER_LABELS: object = { beforeId: 'water-names' };
// Overlay layers sit on the ground plane; skipping the depth test stops them flickering against roads.
const NO_DEPTH = { depthWriteEnabled: false, depthCompare: 'always' } as const;

function DeckOverlay(props: MapboxOverlayProps) {
  const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

/** Seconds since mount, updated every animation frame while `running`. */
function useClock(running: boolean) {
  const [time, setTime] = useState(0);
  const start = useRef(performance.now());
  useEffect(() => {
    if (!running) return;
    let frame = requestAnimationFrame(function tick(now) {
      setTime((now - start.current) / 1000);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [running]);
  return time;
}

interface Props {
  schools: School[];
  network: Network;
  theme: MapTheme;
  lang: Lang;
  showWeave: boolean;
  showPulses: boolean;
  governorate: string | null;
  hoveredId: string | null;
  selectedId: string | null;
  /** Seconds (from `performance.now()`) when schools start to appear; null while waiting. */
  introStartedAt: number | null;
  skipIntro: boolean;
  onHover: (school: School | null, x: number, y: number) => void;
  onSelect: (school: School | null) => void;
  onLoad: () => void;
}

export const SchoolMap = forwardRef<MapRef, Props>(function SchoolMap(props, ref) {
  const {
    schools, network, theme, lang, showWeave, showPulses, governorate, hoveredId, selectedId,
    introStartedAt, skipIntro, onHover, onSelect, onLoad,
  } = props;
  const mapRef = useRef<MapRef | null>(null);
  const reducedMotion = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const time = useClock(!reducedMotion);
  const [zoom, setZoom] = useState(skipIntro ? KUWAIT_VIEW.zoom : GULF_VIEW.zoom);
  const mapStyle = useMemo(() => buildStyle(theme, lang), [theme, lang]);
  const dark = theme !== 'day';
  const pearl: RGB = dark ? [243, 237, 226] : [59, 51, 42];

  // Intro clock: schools ripple out from Kuwait City, the weave follows them.
  const now = performance.now() / 1000;
  const intro = skipIntro || reducedMotion ? INTRO_SECONDS : introStartedAt === null ? -1 : now - introStartedAt;
  const introPhase = intro < 0 ? 'before' : intro < INTRO_SECONDS ? 'running' : 'after';
  const fromOrigin = useMemo(() => schools.map((s) => distanceKm([s.lng, s.lat], ORIGIN)), [schools]);
  const farthest = useMemo(() => Math.max(1, ...fromOrigin), [fromOrigin]);
  const appear = (index: number) =>
    introPhase === 'before' ? 0 : introPhase === 'after' ? 1 : easeOutBack(clamp01((intro - (fromOrigin[index] / farthest) * 1.8) / 0.55));
  const weaveTime =
    introPhase === 'before' ? -1 : introPhase === 'after' ? network.maxTime + 1 : ((intro - 0.6) / 2.6) * network.maxTime;

  const indexById = useMemo(() => new globalThis.Map(schools.map((s, i) => [s.id, i])), [schools]);
  const focus = hoveredId ?? selectedId;
  const focusIndex = focus ? indexById.get(focus) ?? -1 : -1;
  const focusNeighbours = useMemo(() => new Set(focusIndex >= 0 ? network.neighbours[focusIndex] : []), [focusIndex, network]);

  const pulses = useMemo(() => {
    const loop = 40;
    const walks = buildPulses(schools, network, Math.min(70, Math.round(schools.length / 12)), loop);
    // Each walk appears twice, one loop apart, so it wraps seamlessly when the clock restarts.
    return { loop, data: walks.flatMap((w) => [w, { ...w, timestamps: w.timestamps.map((t) => t - loop) }]) };
  }, [schools, network]);

  // School names are a MapLibre symbol layer, which handles overlaps, halos and (with the RTL
  // plugin) Arabic shaping itself. Labels follow the interface language.
  const labelData = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: schools.map((s) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
        properties: { name: shortName(lang === 'ar' ? s.nameAr ?? s.name : s.name), rank: s.rating ?? 0 },
      })),
    }),
    [schools, lang],
  );

  const schoolAlpha = (s: School, i: number) => {
    if (governorate && s.governorate !== governorate) return 45;
    if (focusIndex >= 0 && i !== focusIndex && !focusNeighbours.has(i)) return 120;
    return 255;
  };
  const colorTriggers = [focusIndex, governorate, dark];
  const radiusTrigger = introPhase === 'running' ? intro : introPhase;
  const radius = dotRadius(zoom);
  const wide = zoom < 11;
  const ringPhase = (time * 0.8) % 1;

  const layers = [
    new GeoJsonLayer({
      id: 'governorates',
        ...UNDER_LABELS,
        parameters: NO_DEPTH,
      data: governorates,
      stroked: true,
      filled: true,
      getFillColor: (f) => (f.properties?.shapeName === governorate ? [...pearl, dark ? 12 : 24] : [0, 0, 0, 0]) as RGBA,
      getLineColor: (f) => [...pearl, f.properties?.shapeName === governorate ? 160 : dark ? 28 : 46] as RGBA,
      getLineWidth: (f) => (f.properties?.shapeName === governorate ? 1.6 : 1),
      lineWidthUnits: 'pixels',
      updateTriggers: { getFillColor: [governorate, dark], getLineColor: [governorate, dark], getLineWidth: governorate },
    }),
    showWeave &&
      new TripsLayer({
        id: 'weave',
        ...UNDER_LABELS,
        parameters: NO_DEPTH,
        data: network.edges,
        getPath: (e) => e.path,
        getTimestamps: (e) => e.timestamps,
        getColor: (e) => {
          if (focusIndex >= 0 && (e.a === focusIndex || e.b === focusIndex)) return [...pearl, 235] as RGBA;
          const outside = governorate && (schools[e.a].governorate !== governorate || schools[e.b].governorate !== governorate);
          if (outside) return [...pearl, dark ? 10 : 16] as RGBA;
          // Threads read stronger at country scale, where they carry the picture.
          const base = theme === 'satellite' ? (wide ? 130 : 100) : dark ? (wide ? 78 : 56) : wide ? 92 : 72;
          return [...pearl, focusIndex >= 0 ? Math.round(base * 0.4) : base] as RGBA;
        },
        getWidth: (e) => (focusIndex >= 0 && (e.a === focusIndex || e.b === focusIndex) ? 2.4 : 1),
        widthUnits: 'pixels',
        currentTime: weaveTime,
        trailLength: 1e6,
        fadeTrail: false,
        capRounded: true,
        updateTriggers: { getColor: [...colorTriggers, wide, theme], getWidth: focusIndex },
      }),
    showWeave &&
      showPulses &&
      introPhase === 'after' &&
      !reducedMotion &&
      new TripsLayer({
        id: 'pulses',
        ...UNDER_LABELS,
        parameters: NO_DEPTH,
        data: pulses.data,
        getPath: (d) => d.path,
        getTimestamps: (d) => d.timestamps,
        getColor: dark ? [255, 236, 200] : [128, 84, 24],
        getWidth: 2.2,
        widthUnits: 'pixels',
        currentTime: (time * 1.5) % pulses.loop,
        trailLength: 1.6,
        fadeTrail: true,
        capRounded: true,
        opacity: dark ? 0.85 : 0.7,
      }),
    new ScatterplotLayer<School>({
      id: 'schools-glow',
      billboard: true,
        ...UNDER_LABELS,
        parameters: NO_DEPTH,
      data: schools,
      getPosition: (s) => [s.lng, s.lat],
      getRadius: (_, { index }) => appear(index),
      radiusUnits: 'pixels',
      radiusScale: radius * (zoom < 11 ? 1.9 : 2.5),
      getFillColor: (s, { index }) => [...KINDS[s.kind].color, Math.round(schoolAlpha(s, index) * (dark ? 0.16 : 0.12))] as RGBA,
      updateTriggers: { getRadius: radiusTrigger, getFillColor: colorTriggers },
    }),
    new ScatterplotLayer<School>({
      id: 'schools',
      billboard: true,
        ...UNDER_LABELS,
        parameters: NO_DEPTH,
      data: schools,
      pickable: true,
      getPosition: (s) => [s.lng, s.lat],
      getRadius: (_, { index }) => appear(index) * (index === focusIndex ? 1.5 : 1),
      radiusUnits: 'pixels',
      radiusScale: radius,
      getFillColor: (s, { index }) => [...KINDS[s.kind].color, schoolAlpha(s, index)] as RGBA,
      stroked: true,
      getLineColor: dark ? [20, 18, 15, 210] : [255, 252, 245, 230],
      lineWidthMinPixels: zoom < 11 ? 0.5 : 1,
      updateTriggers: { getRadius: [radiusTrigger, focusIndex], getFillColor: colorTriggers },
    }),
    focusIndex >= 0 &&
      new ScatterplotLayer<School>({
        id: 'focus-ring',
        billboard: true,
        ...UNDER_LABELS,
        parameters: NO_DEPTH,
        data: [schools[focusIndex]],
        getPosition: (s) => [s.lng, s.lat],
        getRadius: reducedMotion ? radius * 2.6 : radius * (1.8 + 1.6 * ringPhase),
        radiusUnits: 'pixels',
        stroked: true,
        filled: false,
        getLineColor: [...KINDS[schools[focusIndex].kind].color, reducedMotion ? 255 : Math.round(255 * (1 - ringPhase))] as RGBA,
        lineWidthMinPixels: 1.6,
        updateTriggers: { getRadius: [ringPhase, radius], getLineColor: ringPhase },
      }),
  ].filter(Boolean);

  const pick = (info: PickingInfo) => (info.layer?.id === 'schools' ? (info.object as School) : null);

  return (
    <Map
      ref={(instance) => {
        mapRef.current = instance;
        if (typeof ref === 'function') ref(instance);
        else if (ref) ref.current = instance;
      }}
      initialViewState={skipIntro ? KUWAIT_VIEW : GULF_VIEW}
      mapStyle={mapStyle}
      minZoom={4.5}
      maxZoom={18.5}
      maxPitch={70}
      maxBounds={MAX_BOUNDS}
      attributionControl={{ compact: true }}
      onLoad={(e) => {
        if (import.meta.env.DEV) Object.assign(window, { __map: e.target });
        onLoad();
      }}
      onMove={(e) => setZoom(e.viewState.zoom)}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Source id="school-labels" type="geojson" data={labelData}>
        <Layer
          id="school-labels"
          type="symbol"
          minzoom={14.6}
          layout={{
            'text-field': ['get', 'name'],
            'text-font': ['Noto Sans Regular'],
            'text-size': 11.5,
            'text-anchor': 'top',
            'text-offset': [0, 1.1],
            'text-max-width': 9,
            'symbol-sort-key': ['-', 0, ['get', 'rank']],
          }}
          paint={{
            'text-color': dark ? '#f3ede2' : '#2b251f',
            'text-halo-color': dark ? '#1a1814' : '#f3ede2',
            'text-halo-width': 1.4,
            'text-opacity': ['interpolate', ['linear'], ['zoom'], 14.6, 0, 15.1, 1],
          }}
        />
      </Source>
      <DeckOverlay
        interleaved
        layers={layers}
        pickingRadius={10}
        onHover={(info) => {
          const school = pick(info);
          const canvas = mapRef.current?.getCanvas();
          if (canvas) canvas.style.cursor = school ? 'pointer' : '';
          onHover(school, info.x, info.y);
        }}
        onClick={(info) => onSelect(pick(info))}
      />
    </Map>
  );
});
