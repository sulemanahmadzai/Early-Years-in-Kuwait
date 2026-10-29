import { AnimatePresence, motion } from 'motion/react';
import { KINDS, governorateName } from '../lib/meta';
import type { School } from '../lib/types';

interface Props {
  hover: { school: School; x: number; y: number } | null;
}

const WIDTH = 300;

export function HoverCard({ hover }: Props) {
  let left = 0;
  let top = 0;
  if (hover) {
    // Sit beside the cursor, flipping to the other side near the window edges.
    left = hover.x + 18 + WIDTH > innerWidth ? hover.x - 18 - WIDTH : hover.x + 18;
    top = Math.min(hover.y + 14, innerHeight - 150);
  }
  const s = hover?.school;
  const where = s ? [s.area, governorateName(s.governorate)].filter((v, i, a) => v && a.indexOf(v) === i).join(', ') : '';

  return (
    <AnimatePresence>
      {s && (
        <motion.div
          key="hover"
          role="tooltip"
          className="glass pointer-events-none fixed z-30 flex gap-3 rounded-2xl p-3"
          style={{ width: WIDTH }}
          initial={{ opacity: 0, scale: 0.96, left, top }}
          animate={{ opacity: 1, scale: 1, left, top }}
          exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
          transition={{ type: 'spring', stiffness: 520, damping: 40, mass: 0.6 }}
        >
          {s.photo && (
            <img src={s.photo} alt="" className="size-[60px] shrink-0 rounded-xl object-cover" referrerPolicy="no-referrer" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11.5px] text-ink-muted">
              <span className="size-2 rounded-full" style={{ background: KINDS[s.kind].css }} />
              {KINDS[s.kind].label}
            </div>
            <div dir="auto" className="mt-1 text-start text-[15px] font-normal leading-snug text-ink">{s.name}</div>
            {s.nameAr && s.nameAr !== s.name && (
              <div dir="rtl" lang="ar" className="mt-0.5 truncate text-[13px] text-ink-muted">
                {s.nameAr}
              </div>
            )}
            {where && <div className="mt-1.5 truncate text-[12px] text-ink-muted">{where}</div>}
            {s.phone && <div className="tabular mt-0.5 text-[12px] text-ink-muted" dir="ltr">{s.phone}</div>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
