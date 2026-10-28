import NumberFlow from '@number-flow/react';
import { motion } from 'motion/react';
import { GOVERNORATES } from '../lib/meta';

interface Props {
  count: number;
  governorate: string | null;
  compact: boolean;
  /** False until the schools start appearing; the count then rolls up from zero. */
  counting: boolean;
}

// English reads left-to-right from the left edge, Arabic right-to-left from the
// right edge; a single thread with a knot ties the two lines together.
export function TitleBlock({ count, governorate, compact, counting }: Props) {
  const place = governorate ? GOVERNORATES[governorate]?.en ?? governorate : null;
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
      className="pointer-events-none absolute left-4 top-4 z-10 sm:left-6 sm:top-6"
      style={{ textShadow: '0 1px 12px var(--page)' }}
    >
      <div className="inline-flex flex-col">
        <h1 className={`font-extralight leading-none tracking-[-0.02em] text-ink ${compact ? 'text-[22px]' : 'text-[34px]'}`}>
          Early years in Kuwait
        </h1>
        <div className={`flex items-center gap-2 ${compact ? 'my-1.5' : 'my-2.5'}`} aria-hidden>
          <span className="h-px flex-1 bg-line-strong" />
          <span className="size-1.5 rotate-45 bg-ink-muted" />
          <span className="h-px w-6 bg-line-strong" />
        </div>
        <p dir="rtl" lang="ar" className={`self-end font-light leading-none text-ink-muted ${compact ? 'text-[15px]' : 'text-[20px]'}`}>
          الطفولة المبكرة في الكويت
        </p>
      </div>
      <motion.p
        initial={false}
        animate={{ opacity: counting ? 1 : 0 }}
        transition={{ duration: 0.6 }}
        className={`tabular text-ink-muted ${compact ? 'mt-2 text-[12px]' : 'mt-4 text-[14px]'}`}
      >
        <NumberFlow value={counting ? count : 0} className="text-ink" transformTiming={{ duration: 1400, easing: "ease-out" }} />{' '}
        {count === 1 ? 'school' : 'nurseries, kindergartens and preschools'}
        {place ? ` in ${place}` : ''}
      </motion.p>
    </motion.header>
  );
}
