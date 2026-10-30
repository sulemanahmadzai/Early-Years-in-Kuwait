import { AnimatePresence, motion } from 'motion/react';
import type { HexStat, Lens } from '../lib/coverage';
import { useWords } from '../lib/i18n';
import { hexPlace } from './CoveragePanel';

interface Props {
  hover: { hex: HexStat; x: number; y: number } | null;
  lens: Lens;
  governmentOnly: boolean;
}

const WIDTH = 260;

/** What a coverage hexagon means, next to the cursor. */
export function HexCard({ hover, lens, governmentOnly }: Props) {
  const words = useWords();
  const { t } = words;
  let left = 0;
  let top = 0;
  if (hover) {
    left = hover.x + 18 + WIDTH > innerWidth ? hover.x - 18 - WIDTH : hover.x + 18;
    top = Math.min(hover.y + 14, innerHeight - 130);
  }
  const h = hover?.hex;
  const noun = t.schoolNoun(governmentOnly);

  return (
    <AnimatePresence>
      {h && (
        <motion.div
          key="hex"
          role="tooltip"
          className="glass pointer-events-none fixed z-30 rounded-2xl px-3.5 py-3"
          style={{ width: WIDTH }}
          initial={{ opacity: 0, scale: 0.96, left, top }}
          animate={{ opacity: 1, scale: 1, left, top }}
          exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
          transition={{ type: 'spring', stiffness: 520, damping: 40, mass: 0.6 }}
        >
          <div className="truncate text-[14px] text-ink">{hexPlace(h, words) || t.coverage}</div>
          <div className="tabular mt-1 text-[12.5px] text-ink-muted">{t.childrenHere(h.children)}</div>
          <div className="tabular mt-0.5 text-[12.5px] text-ink-muted">
            {lens === 'distance'
              ? t.nearestSchool(t.distance(h.nearestKm))
              : h.schoolsNear === 0
                ? t.noSchoolNear(noun)
                : `${t.schoolsNear(h.schoolsNear)} · ${t.perSchoolValue(h.perSchool ?? 0)}`}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
