import type { School } from './types';

// Which schools are switched off. Kept in this browser, and can be carried to another device
// through a link (?hide=… or, when most are off, ?only=…).
const STORAGE_KEY = 'early-years-kw:hidden';

// The last 8 hex digits of a Google place id are unique within the dataset and keep links short.
const shortId = (id: string) => id.replace(/^0x/, '').slice(-8).padStart(8, '0');

export function loadHidden(all: School[]): Set<string> {
  const params = new URLSearchParams(location.search);
  const byShort = new Map(all.map((s) => [shortId(s.id), s.id]));
  const decode = (value: string) => (value.match(/.{8}/g) ?? []).flatMap((k) => byShort.get(k) ?? []);

  let fromLink: Set<string> | null = null;
  if (params.has('hide')) fromLink = new Set(decode(params.get('hide') ?? ''));
  else if (params.has('only')) {
    const keep = new Set(decode(params.get('only') ?? ''));
    fromLink = new Set(all.filter((s) => !keep.has(s.id)).map((s) => s.id));
  }
  if (fromLink) {
    // The link's selection becomes this device's selection; drop it from the address bar so a
    // reload doesn't undo later changes.
    saveHidden(fromLink);
    params.delete('hide');
    params.delete('only');
    history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
    return fromLink;
  }

  try {
    const known = new Set(all.map((s) => s.id));
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[];
    return new Set(saved.filter((id) => known.has(id)));
  } catch {
    return new Set();
  }
}

export function saveHidden(hidden: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...hidden]));
  } catch {
    // Private mode or storage disabled: the selection simply lasts for this visit.
  }
}

export function selectionLink(all: School[], hidden: Set<string>) {
  const url = new URL(location.origin + location.pathname);
  if (hidden.size) {
    const off = all.filter((s) => hidden.has(s.id));
    const on = all.filter((s) => !hidden.has(s.id));
    if (off.length <= on.length) url.searchParams.set('hide', off.map((s) => shortId(s.id)).join(''));
    else url.searchParams.set('only', on.map((s) => shortId(s.id)).join(''));
  }
  return url.toString();
}
