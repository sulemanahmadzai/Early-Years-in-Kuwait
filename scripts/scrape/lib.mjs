// Shared helpers for scraping Google Maps search results and place pages.
// Google Maps markup changes over time; selectors live here so they are easy to update.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
export const RAW_DIR = path.join(ROOT, 'data/raw');
fs.mkdirSync(RAW_DIR, { recursive: true });

export const VIEWPORT = { width: 1280, height: 900 };
export const RESULT_CAP = 120; // Google Maps never lists more than this for one search

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const jitter = (ms) => Math.round(ms * (0.7 + Math.random() * 0.6));

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

// Write to a temp file first so an interrupted run never leaves half-written JSON.
export function writeJson(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

export function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  return process.argv.includes(`--${name}`) ? true : fallback;
}

/**
 * `photos: true` lets place photos load (Google only inserts the hero <img>
 * once it can load); map tiles, fonts and other images are always blocked.
 */
export async function launch({ headless = arg('headed') !== true, photos = false } = {}) {
  // We handle Ctrl-C / kill ourselves (see onStop) so progress is saved before exiting.
  const browser = await chromium.launch({
    channel: 'chrome',
    headless,
    args: ['--lang=en-US'],
    handleSIGINT: false,
    handleSIGTERM: false,
  });
  const context = await browser.newContext({
    locale: 'en-US',
    viewport: VIEWPORT,
    timezoneId: 'Asia/Kuwait',
    geolocation: { latitude: 29.3759, longitude: 47.9774 },
    permissions: ['geolocation'],
  });
  await context.route('**/*', (route) => {
    const req = route.request();
    const type = req.resourceType();
    if (type === 'media' || type === 'font') return route.abort();
    // Only the hero photo (a w408-sized image) is let through; thumbnails stay blocked.
    if (type === 'image' && !(photos && /googleusercontent\.com\/.*=w4\d\d-h\d+/.test(req.url()))) return route.abort();
    return route.continue();
  });
  return { browser, context };
}

export class BlockedError extends Error {}

/** Run `save` and exit when the script is interrupted (Ctrl-C or kill). */
export function onStop(save) {
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      save();
      console.log(`\nStopped (${signal}); progress saved.`);
      process.exit(130);
    });
  }
}

async function checkBlocked(page) {
  if (page.url().includes('/sorry/')) throw new BlockedError('Google rate-limit page');
  const consent = page.locator('form[action*="consent"] button').first();
  if (page.url().includes('consent.google') && (await consent.count())) {
    await page.locator('button:has-text("Accept all"), button:has-text("Reject all")').first().click();
    await page.waitForLoadState('domcontentloaded');
  }
}

// Pull ids and coordinates out of a /maps/place/ URL.
export function parsePlaceHref(href) {
  const m = (re) => href.match(re)?.[1] ?? null;
  return {
    fid: m(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i),
    lat: Number(m(/!3d(-?[\d.]+)/)),
    lng: Number(m(/!4d(-?[\d.]+)/)),
    placeId: m(/!19s(ChIJ[^!?&]+)/),
    mid: m(/!16s([^!?&]+)/) ? decodeURIComponent(m(/!16s([^!?&]+)/)) : null,
  };
}

/**
 * Search `query` with the map centred on lat/lng at `zoom`, scroll the result
 * list to the end and return every result card.
 */
export async function searchArea(page, query, lat, lng, zoom) {
  const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${lat.toFixed(6)},${lng.toFixed(6)},${zoom}z?hl=en&gl=kw`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await checkBlocked(page);

  const outcome = await Promise.race([
    page.waitForSelector('div[role="feed"]', { timeout: 20000 }).then(() => 'feed'),
    page.waitForURL(/\/maps\/place\//, { timeout: 20000 }).then(() => 'place'),
  ]).catch(() => 'none');
  await checkBlocked(page);

  // A single match opens the place page directly instead of a list.
  if (outcome === 'place') {
    await page.waitForSelector('h1', { timeout: 10000 }).catch(() => {});
    const name = (await page.locator('h1').first().textContent().catch(() => null))?.trim();
    return { results: [{ name, href: page.url(), text: '', ...parsePlaceHref(page.url()) }], ended: true };
  }
  if (outcome === 'none') return { results: [], ended: true };

  let last = -1;
  let stable = 0;
  let ended = false;
  for (let i = 0; i < 60 && stable < 5; i++) {
    const state = await page.evaluate(() => {
      const feed = document.querySelector('div[role="feed"]');
      feed.scrollTo(0, feed.scrollHeight);
      return {
        n: feed.querySelectorAll('a[href*="/maps/place/"]').length,
        ended: /reached the end of the list/i.test(feed.innerText),
      };
    });
    if (state.ended) {
      ended = true;
      break;
    }
    stable = state.n === last ? stable + 1 : 0;
    last = state.n;
    await sleep(jitter(1200));
  }

  const cards = await page.$$eval('div[role="feed"] a[href*="/maps/place/"]', (links) =>
    links.map((a) => {
      const card = a.closest('div.Nv2PK') ?? a.parentElement;
      return { name: a.getAttribute('aria-label'), href: a.href, text: card?.innerText ?? '' };
    }),
  );
  return { results: cards.map((c) => ({ ...c, ...parsePlaceHref(c.href) })), ended };
}

/** Open a place page and read its details. */
export async function placeDetails(page, href) {
  const url = new URL(href);
  url.searchParams.set('hl', 'en');
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 45000 });
  await checkBlocked(page);
  await page.waitForSelector('h1', { timeout: 20000 });
  // Phone/address rows and the hero photo render a moment after the title.
  await page.waitForSelector('button[data-item-id="address"], button[data-item-id^="phone"]', { timeout: 4000 }).catch(() => {});
  await page.waitForSelector('button[jsaction*="heroHeaderImage"] img', { timeout: 1500 }).catch(() => {});

  const data = await page.evaluate(() => {
    const main = document.querySelector('div[role="main"]') ?? document;
    const q = (s) => main.querySelector(s);
    const text = (s) => q(s)?.textContent?.trim() || null;
    const aria = (s, prefix) => q(s)?.getAttribute('aria-label')?.replace(prefix, '').trim() || null;
    const header = q('h1')?.closest('div.TIHn2') ?? q('h1')?.parentElement?.parentElement;
    return {
      name: text('h1'),
      altName: text('h2.bwoZTb'),
      category: text('button.DkEaL') ?? text('span.mgr77e'),
      rating: Number(q('div.F7nice span[aria-hidden="true"]')?.textContent) || null,
      address: aria('button[data-item-id="address"]', /^Address:\s*/),
      phone: q('button[data-item-id^="phone:tel:"]')?.getAttribute('data-item-id')?.replace('phone:tel:', '') ?? null,
      website: q('a[data-item-id="authority"]')?.href ?? null,
      plusCode: aria('button[data-item-id="oloc"]', /^Plus code:\s*/),
      status: header?.innerText.match(/Permanently closed|Temporarily closed/)?.[0] ?? null,
      photo: q('button[jsaction*="heroHeaderImage"] img')?.getAttribute('src') ?? null,
    };
  });
  // The secondary heading holds the native-script name, sometimes followed by the English one.
  if (data.altName && data.name) data.altName = data.altName.replace(data.name, '').trim() || null;
  return { ...data, finalUrl: page.url(), ...parsePlaceHref(page.url()) };
}
