import { Command } from 'cmdk';
import Fuse from 'fuse.js';
import { AnimatePresence, motion } from 'motion/react';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { GOVERNORATES, KINDS, governorateName } from '../lib/meta';
import type { School } from '../lib/types';

interface Props {
  open: boolean;
  schools: School[];
  onOpenChange: (open: boolean) => void;
  onSchool: (school: School) => void;
  onGovernorate: (key: string) => void;
}

export function SearchButton({ count, onClick, compact }: { count: number; onClick: () => void; compact: boolean }) {
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Search schools"
      className={`glass flex h-11 items-center gap-2.5 rounded-2xl text-ink-muted transition-colors hover:text-ink ${compact ? 'w-11 justify-center' : 'w-[300px] px-4'}`}
    >
      <Search size={16} strokeWidth={1.7} />
      {!compact && (
        <>
          <span className="flex-1 text-left text-[13.5px]">Search {count.toLocaleString()} schools or an area</span>
          <kbd className="rounded-md border border-line-strong px-1.5 py-0.5 font-sans text-[11px] text-ink-faint">{mac ? '⌘K' : 'Ctrl K'}</kbd>
        </>
      )}
    </button>
  );
}

export function SearchPalette({ open, schools, onOpenChange, onSchool, onGovernorate }: Props) {
  const [query, setQuery] = useState('');
  const fuse = useMemo(
    () =>
      new Fuse(schools, {
        keys: [
          { name: 'name', weight: 3 },
          { name: 'nameAr', weight: 3 },
          { name: 'area', weight: 1.5 },
          { name: 'governorate', weight: 1 },
        ],
        threshold: 0.32,
        ignoreLocation: true,
      }),
    [schools],
  );

  const q = query.trim();
  const results = q ? fuse.search(q, { limit: 40 }).map((r) => r.item) : [];
  const governorateHits = q
    ? Object.entries(GOVERNORATES).filter(([key, g]) => [key, g.en, g.ar].some((n) => n.toLowerCase().includes(q.toLowerCase())))
    : [];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onOpenChange(false)}
        >
          <motion.div
            initial={{ y: -10, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: -6, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 500, damping: 40 }}
            className="w-full max-w-[560px]"
          >
            <Command
              label="Search schools"
              shouldFilter={false}
              loop
              className="glass overflow-hidden rounded-2xl !bg-[var(--surface-strong)]"
              onKeyDown={(e) => e.key === 'Escape' && onOpenChange(false)}
            >
              <div className="flex items-center gap-3 border-b border-line px-4">
                <Search size={17} strokeWidth={1.7} className="text-ink-muted" />
                <Command.Input
                  autoFocus
                  value={query}
                  onValueChange={setQuery}
                  placeholder="School name in English or Arabic, or an area like Salmiya"
                  className="h-14 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint"
                />
              </div>
              <Command.List className="scroll-thin max-h-[52vh] overflow-y-auto p-2">
                {q && (
                  <Command.Empty className="px-3 py-8 text-center text-[13.5px] text-ink-muted">
                    Nothing matches “{q}”. Try the Arabic name, or an area such as Jabriya or Mangaf.
                  </Command.Empty>
                )}
                {!q && <p className="px-3 py-6 text-center text-[13px] text-ink-faint">Start typing to find a school.</p>}
                {governorateHits.map(([key, g]) => (
                  <Command.Item
                    key={key}
                    value={`gov-${key}`}
                    onSelect={() => onGovernorate(key)}
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 data-[selected=true]:bg-line"
                  >
                    <span className="size-2.5 rotate-45 border border-ink-muted" />
                    <span className="flex-1 text-[14px] text-ink">{g.en} governorate</span>
                    <span dir="rtl" lang="ar" className="text-[13px] text-ink-faint">
                      {g.ar}
                    </span>
                  </Command.Item>
                ))}
                {results.map((s) => (
                  <Command.Item
                    key={s.id}
                    value={s.id}
                    onSelect={() => onSchool(s)}
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 data-[selected=true]:bg-line"
                  >
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: KINDS[s.kind].css }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] text-ink">{s.name}</span>
                      {s.nameAr && s.nameAr !== s.name && (
                        <span dir="rtl" lang="ar" className="block truncate text-right text-[12.5px] text-ink-faint">
                          {s.nameAr}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-[12px] text-ink-muted">{s.area ?? governorateName(s.governorate)}</span>
                  </Command.Item>
                ))}
              </Command.List>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
