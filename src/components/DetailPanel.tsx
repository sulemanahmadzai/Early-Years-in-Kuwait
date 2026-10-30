import { AnimatePresence, motion } from 'motion/react';
import { ExternalLink, EyeOff, Globe, MapPin, Phone, Star, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { KINDS, governorateName } from '../lib/meta';
import { formatKm } from '../lib/geo';
import type { School } from '../lib/types';
import { SaduBand } from './SaduBand';

interface Props {
  school: School | null;
  connected: { school: School; km: number }[];
  sheet: boolean; // bottom sheet on phones, side panel otherwise
  onClose: () => void;
  onSelect: (school: School) => void;
  onHide: (school: School) => void;
}

export function DetailPanel({ school, connected, sheet, onClose, onSelect, onHide }: Props) {
  const where = school
    ? [school.area, governorateName(school.governorate)].filter((v, i, a) => v && a.indexOf(v) === i).join(', ')
    : '';
  const motionProps = sheet
    ? { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }
    : { initial: { x: 40, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: 40, opacity: 0 } };

  return (
    <AnimatePresence>
      {school && (
        <motion.aside
          key="detail"
          aria-label={school.name}
          {...motionProps}
          transition={{ type: 'spring', stiffness: 380, damping: 38 }}
          className={
            sheet
              ? 'glass fixed inset-x-0 bottom-0 z-30 max-h-[72vh] overflow-hidden rounded-t-3xl'
              : 'glass fixed bottom-4 right-4 top-[76px] z-30 w-[380px] overflow-hidden rounded-3xl'
          }
        >
          <div className="scroll-thin h-full overflow-y-auto">
            <Header school={school} onClose={onClose} sheet={sheet} />
            <motion.div
              key={school.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 }}
              className="px-5 pb-6"
            >
              <div className="flex items-center gap-2 text-[12px] text-ink-muted">
                <span className="size-2 rounded-full" style={{ background: KINDS[school.kind].css }} />
                {KINDS[school.kind].label}
                <span dir="rtl" lang="ar" className="text-ink-faint">
                  {KINDS[school.kind].ar}
                </span>
              </div>
              <h2 dir="auto" className="mt-2 text-start text-[22px] font-light leading-tight tracking-[-0.01em] text-ink">{school.name}</h2>
              {school.nameAr && school.nameAr !== school.name && (
                <p dir="rtl" lang="ar" className="mt-1 text-[16px] text-ink-muted">
                  {school.nameAr}
                </p>
              )}

              <dl className="mt-5 flex flex-col gap-3 text-[13.5px]">
                {(where || school.address) && (
                  <Fact icon={<MapPin size={15} strokeWidth={1.6} />} label="Location">
                    {where}
                    {school.address && <span className="mt-0.5 block text-[12.5px] text-ink-faint">{school.address}</span>}
                  </Fact>
                )}
                {school.phone && (
                  <Fact icon={<Phone size={15} strokeWidth={1.6} />} label="Phone">
                    <a href={`tel:${school.phone.replace(/\s/g, '')}`} className="tabular hover:underline" dir="ltr">
                      {school.phone}
                    </a>
                  </Fact>
                )}
                {school.website && (
                  <Fact icon={<Globe size={15} strokeWidth={1.6} />} label="Website">
                    <a href={school.website} target="_blank" rel="noreferrer" className="break-all hover:underline">
                      {school.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                    </a>
                  </Fact>
                )}
                {school.rating && (
                  <Fact icon={<Star size={15} strokeWidth={1.6} />} label="Google rating">
                    <span className="tabular">{school.rating.toFixed(1)}</span> <span className="text-ink-faint">out of 5</span>
                  </Fact>
                )}
              </dl>

              <div className="mt-5 flex gap-2">
                {school.phone && (
                  <a
                    href={`tel:${school.phone.replace(/\s/g, '')}`}
                    className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-ink text-[13px] font-normal text-[var(--page)] transition-opacity hover:opacity-90"
                  >
                    <Phone size={15} strokeWidth={1.7} /> Call
                  </a>
                )}
                <a
                  href={school.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-line-strong text-[13px] text-ink transition-colors hover:bg-line"
                >
                  <ExternalLink size={15} strokeWidth={1.7} /> Open in Google Maps
                </a>
              </div>
              <button
                type="button"
                onClick={() => onHide(school)}
                className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-xl text-[12.5px] text-ink-muted transition-colors hover:bg-line hover:text-ink"
              >
                <EyeOff size={14} strokeWidth={1.7} /> Hide this school from the map
              </button>

              {connected.length > 0 && (
                <section className="mt-7">
                  <h3 className="text-[13px] font-normal text-ink">Connected on the grid</h3>
                  <p className="mt-0.5 text-[12px] text-ink-faint">Its nearest neighbours, joined by a thread on the map.</p>
                  <ul className="mt-2 flex flex-col">
                    {connected.map(({ school: n, km }) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(n)}
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-line"
                        >
                          <span className="size-2 shrink-0 rounded-full" style={{ background: KINDS[n.kind].css }} />
                          <span dir="auto" className="min-w-0 flex-1 truncate text-start text-[13px] text-ink-muted">{n.name}</span>
                          <span className="tabular shrink-0 text-[12px] text-ink-faint">{formatKm(km)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </motion.div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function Header({ school, onClose, sheet }: { school: School; onClose: () => void; sheet: boolean }) {
  return (
    <div className="relative">
      {sheet && <div className="absolute left-1/2 top-2 z-10 h-1 w-10 -translate-x-1/2 rounded-full bg-line-strong" />}
      <div className={`relative overflow-hidden ${sheet ? 'h-28' : 'h-40'}`}>
        {school.photo ? (
          <img src={school.photo} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <SaduBand color={KINDS[school.kind].css} className="size-full" />
        )}
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-(--surface-strong)" />
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="glass absolute right-3 top-3 grid size-8 place-items-center rounded-full text-ink transition-opacity hover:opacity-80"
      >
        <X size={15} strokeWidth={1.8} />
      </button>
    </div>
  );
}

function Fact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="mt-0.5 shrink-0 text-ink-faint" title={label} aria-label={label}>
        {icon}
      </dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </div>
  );
}
