import type { StyleSpecification, LayerSpecification, ExpressionSpecification } from 'maplibre-gl';
import type { MapTheme } from '../lib/types';
import type { Lang } from '../lib/i18n';
import kuwaitOutline from '../../data/geo/kuwait-outline.geojson?raw';

// OpenFreeMap: free OpenStreetMap vector tiles, no key or account needed.
const TILES = 'https://tiles.openfreemap.org/planet';
const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
const SATELLITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

interface Palette {
  land: string;
  urban: string;
  green: string;
  water: string;
  waterLabel: string;
  road: string;
  roadMajor: string;
  building: string;
  border: string;
  label: string;
  labelMinor: string;
  halo: string;
  outsideKuwait: string;
  outsideOpacity: number;
  coast: string;
}

const PALETTES: Record<MapTheme, Palette> = {
  // The Gulf after sunset: cool ink water, warm sand land.
  dusk: {
    land: '#1f1c18',
    urban: '#25211c',
    green: '#1e231d',
    water: '#0b232b',
    waterLabel: '#3e6872',
    road: '#2b2620',
    roadMajor: '#3b342b',
    building: '#2c2822',
    border: '#7a6f60',
    label: '#b3aa9b',
    labelMinor: '#8a8173',
    halo: '#1a1814',
    outsideKuwait: '#0d0c0a',
    outsideOpacity: 0.55,
    coast: '#f3ede2',
  },
  // Midday sand and shallow Gulf turquoise, for bright rooms and projectors.
  day: {
    land: '#ede5d6',
    urban: '#e6dccb',
    green: '#dfe2cc',
    water: '#a7d3d0',
    waterLabel: '#4f8783',
    road: '#f8f3ea',
    roadMajor: '#fffaf2',
    building: '#dccfbb',
    border: '#9b8c76',
    label: '#4d443a',
    labelMinor: '#7a6e60',
    halo: '#f3ede2',
    outsideKuwait: '#d9cfbf',
    outsideOpacity: 0.55,
    coast: '#3b332a',
  },
  satellite: {
    land: '#1f1c18',
    urban: '#25211c',
    green: '#1e231d',
    water: '#0b232b',
    waterLabel: '#cfe3e6',
    road: '#ffffff',
    roadMajor: '#ffffff',
    building: '#2c2822',
    border: '#f3ede2',
    label: '#f8f4ec',
    labelMinor: '#e7e0d3',
    halo: '#141210',
    outsideKuwait: '#0d0c0a',
    outsideOpacity: 0.45,
    coast: '#f3ede2',
  },
};

const NAMES: Record<Lang, ExpressionSpecification> = {
  en: ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']],
  ar: ['coalesce', ['get', 'name:ar'], ['get', 'name'], ['get', 'name:en']],
};
// The Gulf is the Arabian Gulf (الخليج العربي) in Kuwait; OpenStreetMap's labels say otherwise.
const waterName = (lang: Lang): ExpressionSpecification =>
  lang === 'ar'
    ? ['case', ['in', 'الفارسي', NAMES.ar], 'الخليج العربي', NAMES.ar]
    : ['case', ['in', 'Persian Gulf', NAMES.en], 'Arabian Gulf', NAMES.en];

// A rectangle around the region with Kuwait cut out, used to dim everything beyond the border.
function outsideMask(): GeoJSON.FeatureCollection {
  const outline = JSON.parse(kuwaitOutline) as GeoJSON.FeatureCollection;
  const geometry = outline.features[0].geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
  const holes = geometry.type === 'Polygon' ? [geometry.coordinates[0]] : geometry.coordinates.map((p) => p[0]);
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [[[30, 15], [65, 15], [65, 40], [30, 40], [30, 15]], ...holes] },
      },
    ],
  };
}

const mask = outsideMask();
const outline = JSON.parse(kuwaitOutline) as GeoJSON.FeatureCollection;

export function buildStyle(theme: MapTheme, lang: Lang = 'en'): StyleSpecification {
  const NAME = NAMES[lang];
  const p = PALETTES[theme];
  const satellite = theme === 'satellite';

  const base: LayerSpecification[] = satellite
    ? [{ id: 'satellite', type: 'raster', source: 'satellite', paint: { 'raster-saturation': -0.25, 'raster-brightness-max': 0.82 } }]
    : [
        { id: 'land', type: 'background', paint: { 'background-color': p.land } },
        {
          id: 'urban',
          type: 'fill',
          source: 'omt',
          'source-layer': 'landuse',
          filter: ['in', ['get', 'class'], ['literal', ['residential', 'suburb', 'neighbourhood', 'commercial', 'industrial', 'retail']]],
          paint: { 'fill-color': p.urban, 'fill-opacity': 0.9 },
        },
        {
          id: 'green',
          type: 'fill',
          source: 'omt',
          'source-layer': 'park',
          paint: { 'fill-color': p.green, 'fill-opacity': 0.8 },
        },
        { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': p.water } },
        {
          id: 'roads-minor',
          type: 'line',
          source: 'omt',
          'source-layer': 'transportation',
          minzoom: 12,
          filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'tertiary']]],
          paint: {
            'line-color': p.road,
            'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 12, 0.4, 16, 3, 18, 8],
          },
        },
        {
          id: 'roads-major',
          type: 'line',
          source: 'omt',
          'source-layer': 'transportation',
          filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary']]],
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': p.roadMajor,
            'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 8, 0.5, 12, 1.6, 16, 6, 18, 14],
          },
        },
        {
          id: 'buildings',
          type: 'fill-extrusion',
          source: 'omt',
          'source-layer': 'building',
          minzoom: 14.5,
          paint: {
            'fill-extrusion-color': p.building,
            'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
            'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
            'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 14.5, 0, 15.5, 0.75],
          },
        },
      ];

  const labels: LayerSpecification[] = [
    {
      id: 'water-names',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'water_name',
      layout: {
        'text-field': waterName(lang),
        'text-font': ['Noto Sans Italic'],
        'text-size': 13,
        'text-letter-spacing': 0.2,
        'text-max-width': 8,
      },
      paint: { 'text-color': p.waterLabel, 'text-halo-color': p.halo, 'text-halo-width': satellite ? 1.2 : 0 },
    },
    {
      id: 'places-minor',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      minzoom: 11,
      filter: ['in', ['get', 'class'], ['literal', ['suburb', 'neighbourhood', 'quarter', 'village']]],
      layout: { 'text-field': NAME, 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-max-width': 7 },
      paint: { 'text-color': p.labelMinor, 'text-halo-color': p.halo, 'text-halo-width': 1.2 },
    },
    {
      id: 'places-major',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      filter: ['in', ['get', 'class'], ['literal', ['city', 'town']]],
      layout: {
        'text-field': NAME,
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 7, 12, 12, 15],
        'text-letter-spacing': 0.04,
      },
      paint: { 'text-color': p.label, 'text-halo-color': p.halo, 'text-halo-width': 1.4 },
    },
  ];

  return {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      omt: { type: 'vector', url: TILES, attribution: '© OpenStreetMap contributors · OpenFreeMap' },
      ...(satellite && {
        satellite: { type: 'raster', tiles: [SATELLITE], tileSize: 256, maxzoom: 18, attribution: 'Imagery © Esri' },
      }),
      mask: { type: 'geojson', data: mask },
      outline: { type: 'geojson', data: outline },
    },
    layers: [
      ...base,
      { id: 'outside-kuwait', type: 'fill', source: 'mask', paint: { 'fill-color': p.outsideKuwait, 'fill-opacity': p.outsideOpacity } },
      {
        id: 'border-glow',
        type: 'line',
        source: 'outline',
        paint: { 'line-color': p.coast, 'line-opacity': 0.06, 'line-width': 9, 'line-blur': 8 },
      },
      {
        id: 'border',
        type: 'line',
        source: 'omt',
        'source-layer': 'boundary',
        filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
        paint: { 'line-color': p.border, 'line-opacity': 0.6, 'line-width': 1, 'line-dasharray': [3, 2] },
      },
      ...labels,
    ],
  };
}
