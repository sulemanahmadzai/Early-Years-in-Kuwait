import { motion } from 'motion/react';
import { ChevronRight, ListChecks } from 'lucide-react';
import { GOVERNORATES, KINDS, KIND_ORDER } from '../lib/meta';
import type { Kind } from '../lib/types';

interface Props {
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

export function IndexPanel(props: Props) {
  const { kindCounts, kinds, onToggleKind, governorateCounts, total, governorate, onGovernorate, hiddenCount, onManage } = props;
  const max = Math.max(1, ...Object.values(governorateCounts));
  const rows = Object.keys(GOVERNORATES);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5" role="group" aria-label="School types">
        {KIND_ORDER.map((kind) => {
          const on = kinds.has(kind);
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={on}
              onClick={() => onToggleKind(kind)}
              className="group flex items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-line"
            >
              <span
                className="size-2.5 shrink-0 rounded-full transition-all"
                style={on ? { background: KINDS[kind].css, boxShadow: `0 0 10px ${KINDS[kind].css}` } : { boxShadow: `inset 0 0 0 1.5px ${KINDS[kind].css}` }}
              />
              <span className={`flex-1 text-[14px] transition-colors ${on ? 'text-ink' : 'text-ink-faint line-through decoration-line-strong'}`}>
                {KINDS[kind].plural}
              </span>
              <span className={`tabular text-[13px] ${on ? 'text-ink-muted' : 'text-ink-faint'}`}>{kindCounts[kind].toLocaleString()}</span>
            </button>
          );
        })}
      </div>

      <div className="h-px bg-line" />

      <div className="flex flex-col" role="group" aria-label="Governorates">
        <GovernorateRow label="All of Kuwait" count={total} share={1} active={governorate === null} onClick={() => onGovernorate(null)} />
        {rows.map((key) => (
          <GovernorateRow
            key={key}
            label={GOVERNORATES[key].en}
            labelAr={GOVERNORATES[key].ar}
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
        className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-left text-ink-muted transition-colors hover:bg-line hover:text-ink"
      >
        <ListChecks size={16} strokeWidth={1.6} className="shrink-0" />
        <span className="flex-1 text-[13.5px]">Choose schools</span>
        {hiddenCount > 0 && (
          <span className="tabular rounded-full bg-line-strong px-2 py-0.5 text-[11.5px] text-ink">{hiddenCount.toLocaleString()} hidden</span>
        )}
        <ChevronRight size={15} strokeWidth={1.6} className="shrink-0 text-ink-faint" />
      </button>
    </div>
  );
}

function GovernorateRow(props: { label: string; labelAr?: string; count: number; share: number; active: boolean; onClick: () => void }) {
  const { label, labelAr, count, share, active, onClick } = props;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`relative flex items-baseline gap-2 rounded-lg px-2 pb-2 pt-1.5 text-left transition-colors hover:bg-line ${active ? 'bg-line' : ''}`}
    >
      <span className={`text-[13.5px] ${active ? 'text-ink' : 'text-ink-muted'}`}>{label}</span>
      {labelAr && (
        <span dir="rtl" lang="ar" className="text-[12px] text-ink-faint">
          {labelAr}
        </span>
      )}
      <span className={`tabular ml-auto text-[13px] ${active ? 'text-ink' : 'text-ink-muted'}`}>{count.toLocaleString()}</span>
      {/* A thread whose length is the governorate's share of schools. */}
      <motion.span
        className="absolute bottom-1 left-2 h-px origin-left"
        style={{ width: 'calc(100% - 16px)', background: active ? 'var(--ink)' : 'var(--line-strong)' }}
        initial={false}
        animate={{ scaleX: share }}
        transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
      />
    </button>
  );
}
