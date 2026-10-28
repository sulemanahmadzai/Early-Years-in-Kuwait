import { Activity, LocateFixed, Minus, Moon, Network, Plus, Presentation, Satellite, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
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
}

const THEMES: { id: MapTheme; label: string; icon: ReactNode }[] = [
  { id: 'dusk', label: 'Dusk map', icon: <Moon size={15} strokeWidth={1.6} /> },
  { id: 'day', label: 'Day map', icon: <Sun size={15} strokeWidth={1.6} /> },
  { id: 'satellite', label: 'Satellite', icon: <Satellite size={15} strokeWidth={1.6} /> },
];

export function MapControls(props: Props) {
  const { showWeave, onWeave, showPulses, onPulses, theme, onTheme, onZoom, onHome, onPresent, compact } = props;

  // Phones get one slim column of icons; pinch-zoom replaces the zoom buttons.
  if (compact) {
    const current = THEMES.findIndex((t) => t.id === theme);
    const next = THEMES[(current + 1) % THEMES.length];
    return (
      <div className="glass flex flex-col gap-0.5 rounded-2xl p-1">
        <IconButton label={showWeave ? 'Hide grid' : 'Show grid'} active={showWeave} onClick={() => onWeave(!showWeave)}>
          <Network size={16} strokeWidth={1.6} />
        </IconButton>
        {showWeave && (
          <IconButton label={showPulses ? 'Stop pulse' : 'Show pulse'} active={showPulses} onClick={() => onPulses(!showPulses)}>
            <Activity size={16} strokeWidth={1.6} />
          </IconButton>
        )}
        <IconButton label={`Switch to ${next.label.toLowerCase()}`} onClick={() => onTheme(next.id)}>
          {THEMES[current].icon}
        </IconButton>
        <IconButton label="Show all of Kuwait" onClick={onHome}>
          <LocateFixed size={15} strokeWidth={1.6} />
        </IconButton>
      </div>
    );
  }

  return (
    <div className={`flex items-end gap-2 ${compact ? 'flex-col' : 'flex-row'}`}>
      <div className={`glass flex items-center gap-1 rounded-2xl p-1.5 ${compact ? 'flex-col' : 'flex-row'}`}>
        <Switch label="Grid" on={showWeave} onChange={onWeave} compact={compact} />
        <Switch label="Pulse" on={showWeave && showPulses} disabled={!showWeave} onChange={onPulses} compact={compact} />
        <Divider vertical={!compact} />
        <div className={`flex gap-0.5 ${compact ? 'flex-col' : ''}`} role="radiogroup" aria-label="Map style">
          {THEMES.map((t) => (
            <IconButton key={t.id} label={t.label} active={theme === t.id} role="radio" onClick={() => onTheme(t.id)}>
              {t.icon}
            </IconButton>
          ))}
        </div>
        {!compact && (
          <>
            <Divider vertical />
            <button
              type="button"
              onClick={onPresent}
              className="flex h-9 items-center gap-2 rounded-xl bg-ink px-3.5 text-[13px] font-normal text-[var(--page)] transition-opacity hover:opacity-90"
            >
              <Presentation size={15} strokeWidth={1.7} />
              Present
            </button>
          </>
        )}
      </div>
      <div className="glass flex flex-col gap-0.5 rounded-2xl p-1.5">
        <IconButton label="Zoom in" onClick={() => onZoom(1)}>
          <Plus size={16} strokeWidth={1.6} />
        </IconButton>
        <IconButton label="Zoom out" onClick={() => onZoom(-1)}>
          <Minus size={16} strokeWidth={1.6} />
        </IconButton>
        <IconButton label="Show all of Kuwait" onClick={onHome}>
          <LocateFixed size={15} strokeWidth={1.6} />
        </IconButton>
      </div>
    </div>
  );
}

function Divider({ vertical }: { vertical: boolean }) {
  return <span aria-hidden className={vertical ? 'mx-1 h-6 w-px bg-line' : 'my-1 h-px w-6 bg-line'} />;
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

function Switch(props: { label: string; on: boolean; disabled?: boolean; onChange: (on: boolean) => void; compact: boolean }) {
  const { label, on, disabled, onChange, compact } = props;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`flex h-9 items-center gap-2 rounded-xl px-2.5 text-[13px] transition-colors hover:bg-line disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent ${compact ? 'w-full justify-between' : ''}`}
    >
      <span className={on ? 'text-ink' : 'text-ink-muted'}>{label}</span>
      <span className={`relative h-[18px] w-[30px] rounded-full transition-colors ${on ? 'bg-ink' : 'bg-line-strong'}`}>
        <span
          className={`absolute top-[3px] size-3 rounded-full transition-all duration-200 ${on ? 'left-[15px] bg-[var(--page)]' : 'left-[3px] bg-ink-muted'}`}
        />
      </span>
    </button>
  );
}
