import { motion } from 'motion/react';
import { ChevronRight, ListChecks } from 'lucide-react';
import { useWords } from '../lib/i18n';
import { GOVERNORATES, KINDS, KIND_ORDER } from '../lib/meta';
import type { Kind, Sector } from '../lib/types';

export type SectorFilter = 'all' | Sector;

interface Props {
  sector: SectorFilter;
  sectorCounts: Record<SectorFilter, number>;
  onSector: (sector: SectorFilter) => void;
  kindCounts: Record<Kind, number>;
  kinds: Set<Kind>;
  onToggleKind: (kind: Kind) => void;
  governorateCounts: Record<string, number>;
  total: number;
  governorate: string | null;
  onGovernorate: (key: string | null) => void;
  hiddenCount: number;
  onManage: () => void;
}

const SECTOR_ORDER: SectorFilter[] = ['all', 'government', 'private'];

export function IndexPanel(props: Props) {
  const { sector, sectorCounts, onSector, kindCounts, kinds, onToggleKind, governorateCounts, total, governorate, onGovernorate, hiddenCount, onManage } = props;
  const { lang, t } = useWords();
  const max = Math.max(1, ...Object.values(governorateCounts));

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-0.5 rounded-xl bg-line p-0.5" role="radiogroup" aria-label={t.groups.sector}>
        {SECTOR_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={sector === s}
            onClick={() => onSector(s)}
            className={`flex flex-col items-center rounded-[10px] px-1 py-1.5 transition-colors ${sector === s ? 'bg-line-strong text-ink' : 'text-ink-muted hover:text-ink'}`}
          >
            <span className="text-[12.5px] leading-tight">{s === 'all' ? t.allSectors : t.sector[s]}</span>
            <span className="tabular text-[11.5px] leading-tight text-ink-faint">{sectorCounts[s].toLocaleString('en-US')}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-0.5" role="group" aria-label={t.groups.kinds}>
        {KIND_ORDER.map((kind) => {
          const on = kinds.has(kind);
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={on}
              onClick={() => onToggleKind(kind)}
              className="group flex items-center gap-3 rounded-lg px-2 py-1.5 text-start transition-colors hover:bg-line"
            >
              <span
                className="size-2.5 shrink-0 rounded-full transition-all"
                style={on ? { background: KINDS[kind].css, boxShadow: `0 0 10px ${KINDS[kind].css}` } : { boxShadow: `inset 0 0 0 1.5px ${KINDS[kind].css}` }}
              />
              <span className={`flex-1 text-[14px] transition-colors ${on ? 'text-ink' : 'text-ink-faint line-through decoration-line-strong'}`}>
                {t.kinds[kind]}
              </span>
              <span className={`tabular text-[13px] ${on ? 'text-ink-muted' : 'text-ink-faint'}`}>{kindCounts[kind].toLocaleString('en-US')}</span>
            </button>
          );
        })}
      </div>

      <div className="h-px bg-line" />

      <div className="flex flex-col" role="group" aria-label={t.groups.governorates}>
        <GovernorateRow label={t.allOfKuwait} count={total} share={1} active={governorate === null} onClick={() => onGovernorate(null)} />
        {Object.entries(GOVERNORATES).map(([key, g]) => (
          <GovernorateRow
            key={key}
            label={lang === 'ar' ? g.ar : g.en}
            secondary={lang === 'ar' ? { text: g.en, lang: 'en' } : { text: g.ar, lang: 'ar' }}
            count={governorateCounts[key] ?? 0}
            share={(governorateCounts[key] ?? 0) / max}
            active={governorate === key}
            onClick={() => onGovernorate(governorate === key ? null : key)}
          />
        ))}
      </div>

      <div className="h-px bg-line" />

      <button
        type="button"
        onClick={onManage}
        className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-start text-ink-muted transition-colors hover:bg-line hover:text-ink"
      >
        <ListChecks size={16} strokeWidth={1.6} className="shrink-0" />
        <span className="flex-1 text-[13.5px]">{t.chooseSchools}</span>
        {hiddenCount > 0 && <span className="tabular rounded-full bg-line-strong px-2 py-0.5 text-[11.5px] text-ink">{t.hiddenCount(hiddenCount)}</span>}
        <ChevronRight size={15} strokeWidth={1.6} className="shrink-0 text-ink-faint rtl:rotate-180" />
      </button>
    </div>
  );
}

function GovernorateRow(props: {
  label: string;
  secondary?: { text: string; lang: 'en' | 'ar' };
  count: number;
  share: number;
  active: boolean;
  onClick: () => void;
}) {
  const { label, secondary, count, share, active, onClick } = props;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`relative flex items-baseline gap-2 rounded-lg px-2 pb-2 pt-1.5 text-start transition-colors hover:bg-line ${active ? 'bg-line' : ''}`}
    >
      <span className={`text-[13.5px] ${active ? 'text-ink' : 'text-ink-muted'}`}>{label}</span>
      {secondary && (
        <span dir={secondary.lang === 'ar' ? 'rtl' : 'ltr'} lang={secondary.lang} className="text-[12px] text-ink-faint">
          {secondary.text}
        </span>
      )}
      <span className={`tabular ms-auto text-[13px] ${active ? 'text-ink' : 'text-ink-muted'}`}>{count.toLocaleString('en-US')}</span>
      {/* A thread whose length is the governorate's share of schools. */}
      <motion.span
        className="absolute bottom-1 start-2 h-px ltr:origin-left rtl:origin-right"
        style={{ width: 'calc(100% - 16px)', background: active ? 'var(--ink)' : 'var(--line-strong)' }}
        initial={false}
        animate={{ scaleX: share }}
        transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
      />
    </button>
  );
}
