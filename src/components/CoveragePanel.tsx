import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { type Coverage, type HexStat, type Lens, RAMPS } from '../lib/coverage';
import { useWords, type Words } from '../lib/i18n';

interface Props {
  coverage: Coverage;
  lens: Lens;
  onLens: (lens: Lens) => void;
  /** Government-only filter: the wording says "government kindergarten". */
  governmentOnly: boolean;
  dark: boolean;
  onLocate: (hex: HexStat) => void;
  onClose: () => void;
}

const LENSES: Lens[] = ['perSchool', 'distance'];

/** "Salwa, Hawalli" — or "near Khaitan, Farwaniya" when the nearest named place is over 2 km away. */
export function hexPlace(hex: HexStat, words: Words) {
  const { lang, t, governorate } = words;
  const gov = governorate(hex.governorate);
  if (!hex.area) return gov ?? '';
  const name = lang === 'ar' ? hex.area.ar : hex.area.en;
  const place = hex.area.km > 2 ? t.near(name) : name;
  return gov && gov !== name ? `${place}${lang === 'ar' ? '، ' : ', '}${gov}` : place;
}

export function CoveragePanel({ coverage, lens, onLens, governmentOnly, dark, onLocate, onClose }: Props) {
  const words = useWords();
  const { t } = words;
  const ramp = dark ? RAMPS.dark : RAMPS.light;
  const noun = t.schoolNoun(governmentOnly);
  const hotspots = coverage.hotspots[lens];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-start justify-between gap-3 px-1">
        <div>
          <h2 className="text-[17px] font-light text-ink">{t.coverage}</h2>
          <p className="mt-0.5 text-[12px] leading-snug text-ink-muted">{t.coverageIntro}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.backToSchools}
          title={t.backToSchools}
          className="grid size-8 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-line hover:text-ink"
        >
          <X size={16} strokeWidth={1.7} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-0.5 rounded-xl bg-line p-0.5" role="radiogroup" aria-label={t.coverage}>
        {LENSES.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={lens === l}
            onClick={() => onLens(l)}
            className={`rounded-[10px] px-2 py-1.5 text-[12.5px] transition-colors ${lens === l ? 'bg-line-strong text-ink' : 'text-ink-muted hover:text-ink'}`}
          >
            {t.lenses[l]}
          </button>
        ))}
      </div>

      <figure className="px-1">
        <figcaption className="text-[12px] text-ink-muted">{t.legendTitle[lens]}</figcaption>
        <div className="mt-2 flex gap-[2px]">
          {ramp.map((c) => (
            <span key={c} className="h-2 flex-1 first:rounded-s-full last:rounded-e-full" style={{ background: c }} />
          ))}
        </div>
        <div className="mt-1.5 grid grid-cols-5 gap-[2px] text-[10.5px] leading-tight text-ink-faint">
          {t.legend[lens].map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        {lens === 'perSchool' && <p className="mt-2 text-[11.5px] text-ink-faint">{t.heightNote}</p>}
      </figure>

      <div className="h-px bg-line" />

      <div className="px-1 text-[13px] leading-relaxed text-ink-muted">
        <p>
          <span className="tabular text-ink">{t.childrenTotal(coverage.children)}</span>
        </p>
        <p className="mt-1">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={`${Math.round(coverage.farChildren / 100)}-${noun}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="tabular inline-block"
            >
              {t.childrenFar(coverage.farChildren, noun)}
            </motion.span>
          </AnimatePresence>
        </p>
      </div>

      {hotspots.length > 0 && (
        <section>
          <h3 className="px-1 text-[12.5px] text-ink">{t.hotspotsTitle[lens]}</h3>
          <ol className="mt-1 flex flex-col">
            {hotspots.map((h, i) => (
              <li key={`${h.q},${h.r}`}>
                <button
                  type="button"
                  onClick={() => onLocate(h)}
                  className="flex w-full items-start gap-2.5 rounded-lg px-1 py-1.5 text-start transition-colors hover:bg-line"
                >
                  <span className="tabular mt-px w-3 shrink-0 text-[12px] text-ink-faint">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-ink">{hexPlace(h, words)}</span>
                    <span className="tabular block text-[11.5px] text-ink-faint">
                      {t.childrenAround(h.childrenNear)}
                      <br />
                      {lens === 'distance' || h.perSchool === null
                        ? lens === 'distance'
                          ? t.nearestSchool(t.distance(h.nearestKm))
                          : t.noSchoolNear(noun)
                        : t.perSchoolValue(h.perSchool)}
                    </span>
                  </span>
                  <span className="mt-1 size-2.5 shrink-0 rounded-sm" style={{ background: ramp[h.band[lens]] }} />
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      <p className="px-1 text-[10.5px] leading-snug text-ink-faint">{t.coverageSource}</p>
    </div>
  );
}
