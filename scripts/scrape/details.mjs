// Step 2: open every discovered place once and read its phone, address, category, photo, etc.
// Saved per place, so re-running only visits places that are still missing.
//
//   node scripts/scrape/details.mjs               # all discovered places
//   node scripts/scrape/details.mjs --limit=20    # quick sample
//   options: --workers=3  --retry-errors  --headed
import path from 'node:path';
import { RAW_DIR, BlockedError, arg, jitter, launch, onStop, placeDetails, readJson, sleep, writeJson } from './lib.mjs';

const DISCOVERED = path.join(RAW_DIR, 'discovered.json');
const DETAILS = path.join(RAW_DIR, 'details.json');

const { places } = readJson(DISCOVERED, { places: {} });
const details = readJson(DETAILS, {});
const retryErrors = arg('retry-errors') === true;
const todo = Object.values(places)
  .filter((p) => !details[p.fid] || (retryErrors && details[p.fid].error))
  .slice(0, Number(arg('limit', Infinity)));
const workers = Number(arg('workers', 4));

console.log(`${Object.keys(places).length} discovered, ${todo.length} to fetch, ${workers} workers`);
const started = Date.now();
let fetched = 0;
let lastSave = 0;

function save(force = false) {
  if (force || Date.now() - lastSave > 3000) {
    writeJson(DETAILS, details);
    lastSave = Date.now();
  }
}

async function worker(id, context) {
  const page = await context.newPage();
  let blockedStrikes = 0;
  while (todo.length) {
    const place = todo.shift();
    try {
      details[place.fid] = { ...(await placeDetails(page, place.href)), fetchedAt: new Date().toISOString() };
      blockedStrikes = 0;
    } catch (err) {
      if (err instanceof BlockedError) {
        todo.unshift(place);
        if (++blockedStrikes >= 3) throw err;
        console.warn(`[w${id}] Google is rate-limiting; pausing 5 minutes (strike ${blockedStrikes}/3)`);
        await sleep(5 * 60000);
        continue;
      }
      details[place.fid] = { error: err.message.split('\n')[0], fetchedAt: new Date().toISOString() };
    }
    fetched++;
    save();
    if (fetched % 25 === 0 || !todo.length) {
      const rate = fetched / ((Date.now() - started) / 60000);
      console.log(`${fetched} fetched, ${todo.length} left (~${(todo.length / rate).toFixed(0)} min) — last: ${details[place.fid].name ?? details[place.fid].error}`);
    }
    await sleep(jitter(700));
  }
  await page.close();
}

onStop(() => save(true));
const { browser, context } = await launch({ photos: true });
try {
  await Promise.all(Array.from({ length: workers }, (_, i) => worker(i + 1, context)));
} finally {
  save(true);
  await browser.close();
}
const errors = Object.values(details).filter((d) => d.error).length;
console.log(`\nDone in ${((Date.now() - started) / 60000).toFixed(1)} min. ${Object.keys(details).length} places saved, ${errors} errors.`);
