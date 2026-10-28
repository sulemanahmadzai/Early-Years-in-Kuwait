// Step 1: sweep an area of Kuwait with Google Maps searches and collect every result.
//
// Google Maps lists at most 120 results per search, so the area is split into
// map views. Any view that comes back full is split into 4 smaller views
// (one zoom level deeper) until every view returns fewer than the cap.
//
// Progress is saved after every search; re-running resumes where it stopped.
//
//   node scripts/scrape/discover.mjs --area=city            # quick test (Kuwait City + Hawalli)
//   node scripts/scrape/discover.mjs --area=kuwait          # whole country
//   options: --keywords=حضانة,nursery  --workers=2  --headed
import path from 'node:path';
import {
  RAW_DIR, RESULT_CAP, VIEWPORT, BlockedError, arg, jitter, launch, onStop, readJson, searchArea, sleep, writeJson,
} from './lib.mjs';

const AREAS = {
  // Kuwait City, Hawalli, Salmiya, Jabriya — dense enough to exercise the splitting.
  city: { south: 29.25, north: 29.4, west: 47.9, east: 48.12, zoom: 13 },
  // Everywhere people live: Wafra/Khairan in the south to Subiya in the north, Jahra and Mutla'a in the west.
  kuwait: { south: 28.5, north: 29.75, west: 47.3, east: 48.43, zoom: 12 },
};
// Areas already swept down to full depth; deeper views inside them are skipped.
const SWEPT = areaNameArg() === 'kuwait' ? [AREAS.city] : [];

function areaNameArg() {
  return String(process.argv.find((a) => a.startsWith('--area='))?.slice(7) ?? 'city');
}
const DEFAULT_KEYWORDS = ['حضانة', 'روضة', 'nursery', 'preschool', 'kindergarten'];
// Split a view into 4 when it may be hiding results: the list hit Google's cap
// and a real share of it lies inside the view (over empty sea/desert Google pads
// the list with places from elsewhere), or the view itself holds a lot of places
// (Google sometimes ends a list early, well below the cap).
const FULL = RESULT_CAP - 5;
const SPLIT_IF_FULL_AND_INSIDE = 30;
const SPLIT_IF_INSIDE = 80;
const MAX_ZOOM = 16;

const areaName = arg('area', 'city');
const area = AREAS[areaName];
if (!area) throw new Error(`Unknown --area=${areaName}. Use one of: ${Object.keys(AREAS).join(', ')}`);
const keywords = String(arg('keywords', DEFAULT_KEYWORDS.join(','))).split(',').map((k) => k.trim()).filter(Boolean);
const workers = Number(arg('workers', 2));

const STATE_FILE = path.join(RAW_DIR, 'discovered.json');
const state = readJson(STATE_FILE, { tasks: {}, places: {} });

// Size of one map view in degrees at a zoom level (Web Mercator, 256px tiles).
function viewSpan(lat, zoom) {
  const degPerPx = 360 / (256 * 2 ** zoom);
  return { dLng: VIEWPORT.width * degPerPx, dLat: VIEWPORT.height * degPerPx * Math.cos((lat * Math.PI) / 180) };
}

function rootViews() {
  const views = [];
  const midLat = (area.south + area.north) / 2;
  const { dLat, dLng } = viewSpan(midLat, area.zoom);
  const rows = Math.ceil((area.north - area.south) / dLat);
  const cols = Math.ceil((area.east - area.west) / dLng);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      views.push({ lat: area.south + (r + 0.5) * dLat, lng: area.west + (c + 0.5) * dLng, zoom: area.zoom });
    }
  }
  return views;
}

function countInside(view, results) {
  const { dLat, dLng } = viewSpan(view.lat, view.zoom);
  return results.filter((r) => Math.abs(r.lat - view.lat) <= dLat / 2 && Math.abs(r.lng - view.lng) <= dLng / 2).length;
}

function childViews({ lat, lng, zoom }) {
  const { dLat, dLng } = viewSpan(lat, zoom);
  return [-1, 1].flatMap((sy) =>
    [-1, 1].map((sx) => ({ lat: lat + (sy * dLat) / 4, lng: lng + (sx * dLng) / 4, zoom: zoom + 1 })),
  );
}

const taskKey = (kw, v) => `${kw}|${v.zoom}|${v.lat.toFixed(5)}|${v.lng.toFixed(5)}`;

function addResults(kw, results) {
  let fresh = 0;
  for (const r of results) {
    if (!r.fid || !Number.isFinite(r.lat)) continue;
    const existing = state.places[r.fid];
    if (existing) {
      if (!existing.keywords.includes(kw)) existing.keywords.push(kw);
      continue;
    }
    fresh++;
    state.places[r.fid] = {
      fid: r.fid, name: r.name, lat: r.lat, lng: r.lng, placeId: r.placeId, mid: r.mid,
      href: r.href, cardText: r.text, keywords: [kw],
    };
  }
  return fresh;
}

// Queue replays finished tasks from the saved state, so a restart only redoes unfinished work.
const queue = keywords.flatMap((kw) => rootViews().map((v) => ({ kw, ...v })));
let done = 0;
let searches = 0;
const started = Date.now();

function alreadySwept(view) {
  if (view.zoom < 13) return false;
  const { dLat, dLng } = viewSpan(view.lat, view.zoom);
  return SWEPT.some(
    (a) => view.lat - dLat / 2 >= a.south && view.lat + dLat / 2 <= a.north && view.lng - dLng / 2 >= a.west && view.lng + dLng / 2 <= a.east,
  );
}

function nextTask() {
  while (queue.length) {
    const task = queue.shift();
    if (alreadySwept(task)) {
      done++;
      continue;
    }
    const saved = state.tasks[taskKey(task.kw, task)];
    if (!saved || !('split' in saved)) return task;
    done++;
    if (saved.split) queue.push(...childViews(task).map((v) => ({ kw: task.kw, ...v })));
  }
  return null;
}

let busy = 0;

// Waits while other workers may still split a full view into more tasks.
async function claimTask() {
  for (;;) {
    const task = nextTask();
    if (task || busy === 0) return task;
    await sleep(1000);
  }
}

async function worker(id, context) {
  const page = await context.newPage();
  let blockedStrikes = 0;
  for (let task = await claimTask(); task; task = await claimTask()) {
    busy++;
    try {
      const { results } = await searchArea(page, task.kw, task.lat, task.lng, task.zoom);
      const inside = countInside(task, results);
      const split = task.zoom < MAX_ZOOM &&
        ((results.length >= FULL && inside >= SPLIT_IF_FULL_AND_INSIDE) || inside >= SPLIT_IF_INSIDE);
      const fresh = addResults(task.kw, results);
      state.tasks[taskKey(task.kw, task)] = { n: results.length, inside, split };
      writeJson(STATE_FILE, state);
      done++;
      searches++;
      blockedStrikes = 0;
      if (split) queue.push(...childViews(task).map((v) => ({ kw: task.kw, ...v })));
      const mins = ((Date.now() - started) / 60000).toFixed(1);
      console.log(
        `[w${id}] ${task.kw.padEnd(12)} z${task.zoom} ${task.lat.toFixed(3)},${task.lng.toFixed(3)} → ${String(results.length).padStart(3)} results, ${String(inside).padStart(3)} inside` +
          `${split ? ' (splitting)' : ''}, +${fresh} new | places ${Object.keys(state.places).length} | done ${done}, queued ${queue.length} | ${mins} min`,
      );
      await sleep(jitter(2000));
    } catch (err) {
      queue.unshift(task); // retry later
      if (err instanceof BlockedError) {
        blockedStrikes++;
        if (blockedStrikes >= 3) throw err;
        console.warn(`[w${id}] Google is rate-limiting; pausing 5 minutes (strike ${blockedStrikes}/3)`);
        await sleep(5 * 60000);
      } else {
        console.warn(`[w${id}] ${task.kw} z${task.zoom} failed: ${err.message.split('\n')[0]} — retrying`);
        await sleep(jitter(5000));
      }
    } finally {
      busy--;
    }
  }
  await page.close();
}

onStop(() => writeJson(STATE_FILE, state));
const { browser, context } = await launch();
console.log(`Area "${areaName}", keywords: ${keywords.join(', ')}, ${queue.length} starting views, ${workers} workers`);
try {
  await Promise.all(Array.from({ length: workers }, (_, i) => worker(i + 1, context)));
} finally {
  await browser.close();
}
console.log(
  `\nDone: ${searches} searches this run in ${((Date.now() - started) / 60000).toFixed(1)} min. ` +
    `${Object.keys(state.places).length} unique places saved to ${path.relative(process.cwd(), STATE_FILE)}`,
);
