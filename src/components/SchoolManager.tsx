import Fuse from 'fuse.js';
import { AnimatePresence, motion } from 'motion/react';
import { Link2, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AREA_AR, useWords } from '../lib/i18n';
import { GOVERNORATES, KINDS } from '../lib/meta';
import type { School } from '../lib/types';

type View = 'all' | 'shown' | 'hidden';

interface Props {
  open: boolean;
  sheet: boolean; // full-height sheet on phones
  schools: School[];
  hidden: Set<string>;
  onSetHidden: (ids: string[], hide: boolean) => void;
  onLocate: (school: School) => void;
  onCopyLink: () => void;
  onClose: () => void;
}

/** Switch individual schools on or off the map, one at a time or a whole filtered list at once. */
export function SchoolManager({ open, sheet, schools, hidden, onSetHidden, onLocate, onCopyLink, onClose }: Props) {
  const { lang, t } = useWords();
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>('all');
  const [governorate, setGovernorate] = useState('');

  const fuse = useMemo(
    () =>
      new Fuse(
        schools.map((s) => ({ school: s, name: s.name, nameAr: s.nameAr ?? '', area: s.area ?? '', areaAr: (s.area && AREA_AR[s.area]) ?? '' })),
        { keys: ['name', 'nameAr', 'area', 'areaAr'], threshold: 0.32, ignoreLocation: true },
      ),
    [schools],
  );

  const list = useMemo(() => {
    const q = query.trim();
    const base = q ? fuse.search(q).map((r) => r.item.school) : schools;
    return base.filter(
      (s) =>
        (!governorate || s.governorate === governorate) &&
        (view === 'all' || (view === 'hidden') === hidden.has(s.id)),
    );
  }, [fuse, governorate, hidden, query, schools, view]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const shownCount = schools.length - hidden.size;
  const listHidden = list.filter((s) => hidden.has(s.id)).length;
  const filtered = Boolean(query.trim() || governorate || view !== 'all');
  // Slides in from the edge it sits on, which flips in Arabic.
  const offset = lang === 'ar' ? 24 : -24;

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          aria-label={t.chooseSchools}
          initial={sheet ? { y: '100%' } : { x: offset, opacity: 0 }}
          animate={sheet ? { y: 0 } : { x: 0, opacity: 1 }}
          exit={sheet ? { y: '100%' } : { x: offset, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 38 }}
          className={
            sheet
              ? 'glass fixed inset-x-0 bottom-0 top-14 z-40 flex flex-col rounded-t-3xl !bg-[var(--surface-strong)]'
              : 'glass fixed bottom-6 start-6 top-[150px] z-30 flex w-[372px] flex-col rounded-3xl !bg-[var(--surface-strong)]'
          }
        >
          <header className="px-5 pb-3 pt-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-light tracking-[-0.01em] text-ink">{t.chooseSchools}</h2>
                <p className="tabular mt-0.5 text-[12.5px] text-ink-muted">{t.shownOf(shownCount, schools.length)}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t.close}
                className="grid size-8 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-line hover:text-ink"
              >
                <X size={16} strokeWidth={1.7} />
              </button>
            </div>

            <label className="mt-3 flex h-10 items-center gap-2.5 rounded-xl border border-line-strong px-3 focus-within:border-ink-muted">
              <Search size={15} strokeWidth={1.7} className="shrink-0 text-ink-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.filterPlaceholder}
                dir="auto"
                className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-faint focus-visible:outline-none"
              />
            </label>

            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex rounded-xl bg-line p-0.5" role="radiogroup" aria-label={t.views.all}>
                {(['all', 'shown', 'hidden'] as View[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={view === v}
                    onClick={() => setView(v)}
                    className={`rounded-[10px] px-2.5 py-1 text-[12.5px] transition-colors ${view === v ? 'bg-line-strong text-ink' : 'text-ink-muted hover:text-ink'}`}
                  >
                    {t.views[v]}
                    {v === 'hidden' && hidden.size > 0 && <span className="tabular ms-1">{hidden.size.toLocaleString('en-US')}</span>}
                  </button>
                ))}
              </div>
              <select
                value={governorate}
                onChange={(e) => setGovernorate(e.target.value)}
                aria-label={t.groups.governorates}
                className="h-8 min-w-0 flex-1 cursor-pointer rounded-xl border border-line-strong bg-transparent px-2 text-[12.5px] text-ink-muted outline-none"
              >
                <option value="">{t.allGovernorates}</option>
                {Object.entries(GOVERNORATES).map(([key, g]) => (
                  <option key={key} value={key}>
                    {lang === 'ar' ? g.ar : g.en}
                  </option>
                ))}
              </select>
            </div>
          </header>

          <div className="flex items-center justify-between border-y border-line px-5 py-2 text-[12.5px]">
            <span className="tabular text-ink-muted">{t.listCount(list.length, filtered)}</span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={listHidden === list.length}
                onClick={() => onSetHidden(list.map((s) => s.id), true)}
                className="rounded-lg px-2 py-1 text-ink-muted transition-colors hover:bg-line hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent"
              >
                {t.hideList(filtered)}
              </button>
              <button
                type="button"
                disabled={listHidden === 0}
                onClick={() => onSetHidden(list.map((s) => s.id), false)}
                className="rounded-lg px-2 py-1 text-ink-muted transition-colors hover:bg-line hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent"
              >
                {t.showList(filtered)}
              </button>
            </div>
          </div>

          <ul className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 py-1">
            {list.length === 0 && (
              <li className="px-4 py-10 text-center text-[13px] text-ink-muted">
                {view === 'hidden' ? t.emptyHidden : t.emptyFilter}
              </li>
            )}
            {list.map((s) => (
              <SchoolRow key={s.id} school={s} on={!hidden.has(s.id)} onToggle={(on) => onSetHidden([s.id], !on)} onLocate={onLocate} />
            ))}
          </ul>

          <footer className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
            <p className="text-[11.5px] leading-snug text-ink-faint">{t.savedNote}</p>
            <button
              type="button"
              onClick={onCopyLink}
              className="flex h-9 shrink-0 items-center gap-2 rounded-xl border border-line-strong px-3 text-[12.5px] text-ink transition-colors hover:bg-line"
            >
              <Link2 size={14} strokeWidth={1.7} /> {t.copyLink}
            </button>
          </footer>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

function SchoolRow({ school: s, on, onToggle, onLocate }: { school: School; on: boolean; onToggle: (on: boolean) => void; onLocate: (s: School) => void }) {
  const { t, name, where: whereOf } = useWords();
  const where = whereOf(s);
  return (
    <li className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-line" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 52px' }}>
      <span
        className="size-2.5 shrink-0 rounded-full transition-all"
        style={on ? { background: KINDS[s.kind].css } : { boxShadow: `inset 0 0 0 1.5px ${KINDS[s.kind].css}`, opacity: 0.6 }}
      />
      <button
        type="button"
        disabled={!on}
        onClick={() => onLocate(s)}
        title={on ? t.showOnMap : undefined}
        className="min-w-0 flex-1 text-start disabled:cursor-default"
      >
        <span dir="auto" className={`block truncate text-start text-[13.5px] ${on ? 'text-ink' : 'text-ink-faint'}`}>
          {name(s)}
        </span>
        {where && <span className="block truncate text-start text-[11.5px] text-ink-faint">{where}</span>}
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={t.toggleSchool(on, name(s))}
        onClick={() => onToggle(!on)}
        className={`relative h-[20px] w-[34px] shrink-0 rounded-full transition-colors ${on ? 'bg-ink' : 'bg-line-strong'}`}
      >
        <span className={`absolute top-[3px] size-[14px] rounded-full transition-all duration-200 ${on ? 'start-[17px] bg-[var(--page)]' : 'start-[3px] bg-ink-muted'}`} />
      </button>
    </li>
  );
}
