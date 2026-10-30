import { useWords } from '../lib/i18n';
import type { Sector } from '../lib/types';

/** A small outlined tag; government schools get a filled pearl dot so they read at a glance. */
export function SectorBadge({ sector, className = '' }: { sector: Sector; className?: string }) {
  const { t } = useWords();
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-line-strong px-1.5 py-px text-[10.5px] leading-tight text-ink-muted ${className}`}>
      {sector === 'government' && <span className="size-1.5 rounded-full bg-ink" />}
      {t.sector[sector]}
    </span>
  );
}
