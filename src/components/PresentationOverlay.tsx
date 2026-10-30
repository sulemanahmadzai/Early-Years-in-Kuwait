import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useWords } from '../lib/i18n';
import { GOVERNORATES, KINDS, KIND_ORDER } from '../lib/meta';
import type { Kind, Sector } from '../lib/types';

export interface Slide {
  /** 'overview', 'grid', or a governorate key. */
  id: string;
  count: number;
  share: number;
  threads: number;
  kinds: Record<Kind, number>;
  sectors: Record<Sector, number>;
  /** The coverage slide: children under five, and those more than 2 km from a school. */
  children?: number;
  farChildren?: number;
}

interface Props {
  slides: Slide[];
  index: number;
  onIndex: (index: number) => void;
  onExit: () => void;
}

const AUTOPLAY_MS = 9000;
const TITLES: Record<string, { en: string; ar: string }> = {
  overview: { en: 'Early years in Kuwait', ar: 'الطفولة المبكرة في الكويت' },
  grid: { en: 'One connected grid', ar: 'شبكة واحدة مترابطة' },
  gaps: { en: 'Where the gaps are', ar: 'أين الفجوات' },
  ...GOVERNORATES,
};

export function PresentationOverlay({ slides, index, onIndex, onExit }: Props) {
  const { lang, t } = useWords();
  const [playing, setPlaying] = useState(false);
  const slide = slides[index];
  const last = slides.length - 1;
  const other = lang === 'ar' ? 'en' : 'ar';
  const summary =
    slide.id === 'gaps'
      ? t.gapsSummary(slide.farChildren ?? 0)
      : slide.id === 'overview'
      ? t.overviewSummary(slide.count)
      : slide.id === 'grid'
        ? t.gridSummary(slide.threads)
        : t.governorateSummary(slide.count, Math.round(slide.share * 100));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') onIndex(Math.min(last, index + 1));
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') onIndex(Math.max(0, index - 1));
      else if (e.key === 'Escape') onExit();
      else return;
      e.preventDefault();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [index, last, onIndex, onExit]);

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => (index < last ? onIndex(index + 1) : setPlaying(false)), AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [playing, index, last, onIndex]);

  return (
    <>
      {/* Darkens the corner behind the caption so map labels don't show through it. */}
      <div
        aria-hidden
        className="pointer-events-none fixed bottom-0 start-0 z-[15] h-[460px] w-[900px] max-w-full"
        style={{
          background: `radial-gradient(ellipse at bottom ${lang === 'ar' ? 'right' : 'left'}, color-mix(in srgb, var(--page) 92%, transparent) 0%, transparent 65%)`,
        }}
      />
      <div className="pointer-events-none fixed bottom-8 start-8 z-20 max-w-[560px]" style={{ textShadow: '0 2px 24px var(--page)' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={`${slide.id}-${lang}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.7, delay: 0.5, ease: [0.2, 0.7, 0.2, 1] } }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.3 } }}
          >
            <div className="inline-flex flex-col">
              <h2 className={`text-[56px] leading-none text-ink ${lang === 'ar' ? 'font-light' : 'font-extralight tracking-[-0.025em]'}`}>
                {TITLES[slide.id][lang]}
              </h2>
              <div className="my-3 flex items-center gap-2" aria-hidden>
                <span className="h-px flex-1 bg-line-strong" />
                <span className="size-1.5 rotate-45 bg-ink-muted" />
                <span className="h-px w-8 bg-line-strong" />
              </div>
              <p dir={other === 'ar' ? 'rtl' : 'ltr'} lang={other} className="self-end text-[26px] font-light leading-tight text-ink-muted">
                {TITLES[slide.id][other]}
              </p>
            </div>
            <div className="h-5" />
            <p className="tabular text-[18px] font-light text-ink">{summary}</p>
            {slide.id === 'gaps' ? (
              <p className="tabular mt-3 text-[14px] text-ink-muted">{t.gapsTotal(slide.children ?? 0)}</p>
            ) : (
            <>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
              {KIND_ORDER.map((k) => (
                <span key={k} className="tabular flex items-center gap-2 text-[14px] text-ink-muted">
                  <span className="size-2 rounded-full" style={{ background: KINDS[k].css }} />
                  {t.kindCount(k, slide.kinds[k])}
                </span>
              ))}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1.5">
              {(['government', 'private'] as Sector[]).map((s) => (
                <span key={s} className="tabular flex items-center gap-2 text-[14px] text-ink-muted">
                  <span className={`size-2 rounded-full ${s === 'government' ? 'bg-ink' : 'border border-ink-muted'}`} />
                  {t.sectorCount(s, slide.sectors[s])}
                </span>
              ))}
            </div>
            </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="glass fixed bottom-8 end-8 z-20 flex items-center gap-1 rounded-2xl p-1.5">
        <ControlButton label={t.previous} disabled={index === 0} onClick={() => onIndex(index - 1)}>
          <ChevronLeft size={17} strokeWidth={1.7} className="rtl:rotate-180" />
        </ControlButton>
        <span className="tabular min-w-14 text-center text-[13px] text-ink-muted" dir="ltr">
          {index + 1} / {slides.length}
        </span>
        <ControlButton label={t.next} disabled={index === last} onClick={() => onIndex(index + 1)}>
          <ChevronRight size={17} strokeWidth={1.7} className="rtl:rotate-180" />
        </ControlButton>
        <span className="mx-1 h-6 w-px bg-line" aria-hidden />
        <ControlButton label={playing ? t.pauseTour : t.playTour} onClick={() => setPlaying(!playing)}>
          {playing ? <Pause size={15} strokeWidth={1.7} /> : <Play size={15} strokeWidth={1.7} />}
        </ControlButton>
        <ControlButton label={t.exitPresentation} onClick={onExit}>
          <X size={16} strokeWidth={1.7} />
        </ControlButton>
      </div>

      <div className="fixed inset-x-0 top-0 z-20 flex justify-center gap-1.5 pt-5" aria-hidden>
        {slides.map((s, i) => (
          <span key={s.id} className={`h-[3px] rounded-full transition-all duration-500 ${i === index ? 'w-8 bg-ink' : 'w-3 bg-line-strong'}`} />
        ))}
      </div>
    </>
  );
}

function ControlButton(props: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
      className="grid size-9 place-items-center rounded-xl text-ink-muted transition-colors hover:bg-line hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {props.children}
    </button>
  );
}
