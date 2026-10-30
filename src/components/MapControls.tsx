import { Activity, Hexagon, LocateFixed, Minus, Moon, Network, Plus, Presentation, Satellite, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { useWords } from '../lib/i18n';
import type { MapTheme } from '../lib/types';

interface Props {
  showWeave: boolean;
  onWeave: (on: boolean) => void;
  showPulses: boolean;
  onPulses: (on: boolean) => void;
  theme: MapTheme;
  onTheme: (theme: MapTheme) => void;
  onZoom: (delta: number) => void;
  onHome: () => void;
  onPresent: () => void;
  compact: boolean;
  /** Coverage view on/off; the grid and pulse switches step aside while it's on. */
  coverage: boolean;
  onCoverage: (on: boolean) => void;
}

const THEME_ICONS: { id: MapTheme; icon: ReactNode }[] = [
  { id: 'dusk', icon: <Moon size={15} strokeWidth={1.6} /> },
  { id: 'day', icon: <Sun size={15} strokeWidth={1.6} /> },
  { id: 'satellite', icon: <Satellite size={15} strokeWidth={1.6} /> },
];

export function MapControls(props: Props) {
  const { showWeave, onWeave, showPulses, onPulses, theme, onTheme, onZoom, onHome, onPresent, compact, coverage, onCoverage } = props;
  const { t } = useWords();

  // Phones get one slim column of icons; pinch-zoom replaces the zoom buttons.
  if (compact) {
    const current = THEME_ICONS.findIndex((th) => th.id === theme);
    const next = THEME_ICONS[(current + 1) % THEME_ICONS.length];
    return (
      <div className="glass flex flex-col gap-0.5 rounded-2xl p-1">
        <IconButton label={t.coverage} active={coverage} onClick={() => onCoverage(!coverage)}>
          <Hexagon size={16} strokeWidth={1.6} />
        </IconButton>
        <IconButton label={showWeave ? t.hideGrid : t.showGrid} active={showWeave && !coverage} onClick={() => onWeave(!showWeave)}>
          <Network size={16} strokeWidth={1.6} />
        </IconButton>
        {showWeave && !coverage && (
          <IconButton label={showPulses ? t.stopPulse : t.showPulse} active={showPulses} onClick={() => onPulses(!showPulses)}>
            <Activity size={16} strokeWidth={1.6} />
          </IconButton>
        )}
        <IconButton label={t.switchTo(t.themes[next.id])} onClick={() => onTheme(next.id)}>
          {THEME_ICONS[current].icon}
        </IconButton>
        <IconButton label={t.home} onClick={onHome}>
          <LocateFixed size={15} strokeWidth={1.6} />
        </IconButton>
      </div>
    );
  }

  return (
    <div className="flex flex-row items-end gap-2">
      <div className="glass flex flex-row items-center gap-1 rounded-2xl p-1.5">
        <Switch label={t.coverage} on={coverage} onChange={onCoverage} icon={<Hexagon size={14} strokeWidth={1.7} />} />
        <Divider />
        <Switch label={t.grid} on={showWeave && !coverage} disabled={coverage} onChange={onWeave} />
        <Switch label={t.pulse} on={showWeave && showPulses && !coverage} disabled={!showWeave || coverage} onChange={onPulses} />
        <Divider />
        <div className="flex gap-0.5" role="radiogroup" aria-label={t.mapStyle}>
          {THEME_ICONS.map((th) => (
            <IconButton key={th.id} label={t.themes[th.id]} active={theme === th.id} role="radio" onClick={() => onTheme(th.id)}>
              {th.icon}
            </IconButton>
          ))}
        </div>
        <Divider />
        <button
          type="button"
          onClick={onPresent}
          className="flex h-9 items-center gap-2 rounded-xl bg-ink px-3.5 text-[13px] font-normal text-[var(--page)] transition-opacity hover:opacity-90"
        >
          <Presentation size={15} strokeWidth={1.7} />
          {t.present}
        </button>
      </div>
      <div className="glass flex flex-col gap-0.5 rounded-2xl p-1.5">
        <IconButton label={t.zoomIn} onClick={() => onZoom(1)}>
          <Plus size={16} strokeWidth={1.6} />
        </IconButton>
        <IconButton label={t.zoomOut} onClick={() => onZoom(-1)}>
          <Minus size={16} strokeWidth={1.6} />
        </IconButton>
        <IconButton label={t.home} onClick={onHome}>
          <LocateFixed size={15} strokeWidth={1.6} />
        </IconButton>
      </div>
    </div>
  );
}

/** Switches the whole interface between English and Arabic; labelled in the language it switches to. */
export function LanguageToggle({ compact }: { compact: boolean }) {
  const { lang, t, setLang } = useWords();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
      aria-label={t.otherLanguageLabel}
      title={t.otherLanguageLabel}
      lang={lang === 'ar' ? 'en' : 'ar'}
      className={`glass flex h-11 items-center justify-center rounded-2xl text-[13.5px] text-ink-muted transition-colors hover:text-ink ${compact ? 'w-11' : 'px-4'}`}
    >
      {compact ? (lang === 'ar' ? 'EN' : 'ع') : t.otherLanguage}
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-6 w-px bg-line" />;
}

function IconButton(props: { label: string; active?: boolean; role?: string; onClick: () => void; children: ReactNode }) {
  const { label, active, role, onClick, children } = props;
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      role={role}
      aria-checked={role === 'radio' ? active : undefined}
      onClick={onClick}
      className={`grid size-9 place-items-center rounded-xl transition-colors ${active ? 'bg-line-strong text-ink' : 'text-ink-muted hover:bg-line hover:text-ink'}`}
    >
      {children}
    </button>
  );
}

function Switch(props: { label: string; on: boolean; disabled?: boolean; onChange: (on: boolean) => void; icon?: ReactNode }) {
  const { label, on, disabled, onChange, icon } = props;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="flex h-9 items-center gap-2 rounded-xl px-2.5 text-[13px] transition-colors hover:bg-line disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <span className={`flex items-center gap-1.5 ${on ? 'text-ink' : 'text-ink-muted'}`}>
        {icon}
        {label}
      </span>
      <span className={`relative h-[18px] w-[30px] rounded-full transition-colors ${on ? 'bg-ink' : 'bg-line-strong'}`}>
        <span className={`absolute top-[3px] size-3 rounded-full transition-all duration-200 ${on ? 'start-[15px] bg-[var(--page)]' : 'start-[3px] bg-ink-muted'}`} />
      </span>
    </button>
  );
}
