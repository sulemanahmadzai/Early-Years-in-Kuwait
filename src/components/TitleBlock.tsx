import NumberFlow from '@number-flow/react';
import { motion } from 'motion/react';
import { useWords } from '../lib/i18n';
import type { Sector } from '../lib/types';

interface Props {
  count: number;
  governorate: string | null;
  sector: Sector | 'all';
  compact: boolean;
  /** False until the schools start appearing; the count then rolls up from zero. */
  counting: boolean;
}

const TITLES = { en: 'Early years in Kuwait', ar: 'الطفولة المبكرة في الكويت' };

// The title in the interface language, with the other language beneath it aligned to the opposite
// edge; a single thread with a knot ties the two lines together.
export function TitleBlock({ count, governorate, sector, compact, counting }: Props) {
  const { lang, t, governorate: governorateName } = useWords();
  const other = lang === 'ar' ? 'en' : 'ar';
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
      className="pointer-events-none absolute start-4 top-4 z-10 sm:start-6 sm:top-6"
      style={{ textShadow: '0 1px 12px var(--page)' }}
    >
      <div className="inline-flex flex-col">
        <h1
          className={`leading-none text-ink ${lang === 'ar' ? 'font-light' : 'font-extralight tracking-[-0.02em]'} ${compact ? 'text-[22px]' : 'text-[34px]'}`}
        >
          {TITLES[lang]}
        </h1>
        <div className={`flex items-center gap-2 ${compact ? 'my-1.5' : 'my-2.5'}`} aria-hidden>
          <span className="h-px flex-1 bg-line-strong" />
          <span className="size-1.5 rotate-45 bg-ink-muted" />
          <span className="h-px w-6 bg-line-strong" />
        </div>
        <p
          dir={other === 'ar' ? 'rtl' : 'ltr'}
          lang={other}
          className={`self-end font-light leading-none text-ink-muted ${compact ? 'text-[15px]' : 'text-[20px]'}`}
        >
          {TITLES[other]}
        </p>
      </div>
      <motion.p
        initial={false}
        animate={{ opacity: counting ? 1 : 0 }}
        transition={{ duration: 0.6 }}
        className={`tabular text-ink-muted ${compact ? 'mt-2 text-[12px]' : 'mt-4 text-[14px]'}`}
      >
        <NumberFlow value={counting ? count : 0} className="text-ink" transformTiming={{ duration: 1400, easing: 'ease-out' }} />{' '}
        {t.countRest(count, governorateName(governorate), sector)}
      </motion.p>
    </motion.header>
  );
}
