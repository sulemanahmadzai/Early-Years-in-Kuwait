import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import type { LngLatBoundsLike, PaddingOptions } from 'maplibre-gl';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronUp } from 'lucide-react';
import schoolsData from './data/schools.json';
import { SchoolMap, INTRO_SECONDS } from './map/SchoolMap';
import { TitleBlock } from './components/TitleBlock';
import { IndexPanel } from './components/IndexPanel';
import { MapControls } from './components/MapControls';
import { HoverCard } from './components/HoverCard';
import { DetailPanel } from './components/DetailPanel';
import { SearchButton, SearchPalette } from './components/SearchPalette';
import { PresentationOverlay, type Slide } from './components/PresentationOverlay';
import { GOVERNORATES, KIND_ORDER } from './lib/meta';
import { buildNetwork, distanceKm } from './lib/network';
import { coreBoundsOf } from './lib/geo';
import { prefersReducedMotion, useMediaQuery } from './lib/hooks';
import type { Kind, MapTheme, School } from './lib/types';

const SCHOOLS = schoolsData as School[];
const ALL_BOUNDS = coreBoundsOf(SCHOOLS);
const TOUR_ORDER = ['Al Asimah', 'Hawalli', 'Mubarak Al-Kabeer', 'Ahmadi', 'Farwaniya', 'Jahra'];
const HOME_PITCH = 38;
const HOME_BEARING = -8;

const countKinds = (list: School[]) =>
  Object.fromEntries(KIND_ORDER.map((k) => [k, list.filter((s) => s.kind === k).length])) as Record<Kind, number>;

export function App() {
  const mapRef = useRef<MapRef | null>(null);
  const isPhone = useMediaQuery('(max-width: 720px)');
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)');
  const skipIntro = useMemo(() => new URLSearchParams(location.search).has('nointro') || prefersReducedMotion(), []);

  const [theme, setTheme] = useState<MapTheme>('dusk');
  const [showWeave, setShowWeave] = useState(true);
  const [showPulses, setShowPulses] = useState(true);
  const [kinds, setKinds] = useState<Set<Kind>>(() => new Set(KIND_ORDER));
  const [governorate, setGovernorate] = useState<string | null>(null);
  const [hover, setHover] = useState<{ school: School; x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<School | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [slideIndex, setSlideIndex] = useState<number | null>(null);
  const [introStartedAt, setIntroStartedAt] = useState<number | null>(null);
  const [introDone, setIntroDone] = useState(skipIntro);
  const timers = useRef<number[]>([]);
  const presenting = slideIndex !== null;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const visible = useMemo(() => SCHOOLS.filter((s) => kinds.has(s.kind)), [kinds]);
  const network = useMemo(() => buildNetwork(visible), [visible]);
  const inScope = useMemo(() => (governorate ? SCHOOLS.filter((s) => s.governorate === governorate) : SCHOOLS), [governorate]);
  const kindCounts = useMemo(() => countKinds(inScope), [inScope]);
  const governorateCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of visible) if (s.governorate) counts[s.governorate] = (counts[s.governorate] ?? 0) + 1;
    return counts;
  }, [visible]);
  const governorateBounds = useMemo(() => {
    const out: Record<string, LngLatBoundsLike> = {};
    for (const key of Object.keys(GOVERNORATES)) {
      const list = SCHOOLS.filter((s) => s.governorate === key);
      if (list.length) out[key] = coreBoundsOf(list, 0.04, 0.02);
    }
    return out;
  }, []);
  const visibleCount = governorate ? visible.filter((s) => s.governorate === governorate).length : visible.length;

  // ---- Camera ------------------------------------------------------------

  const padding = useCallback(
    (): PaddingOptions =>
      isPhone ? { top: 110, bottom: 190, left: 28, right: 72 } : { top: 150, bottom: 70, left: 380, right: 130 },
    [isPhone],
  );

  const flyToBounds = useCallback(
    (bounds: LngLatBoundsLike, opts: { pitch?: number; bearing?: number; duration?: number } = {}) => {
      const map = mapRef.current?.getMap();
      if (!map) return;
      const { pitch = HOME_PITCH, bearing = HOME_BEARING, duration = 1800 } = opts;
      const camera = map.cameraForBounds(bounds, { padding: padding(), bearing });
      if (!camera) return;
      map.flyTo({ ...camera, pitch, bearing, duration, padding: { top: 0, bottom: 0, left: 0, right: 0 }, essential: true });
    },
    [padding],
  );

  const flyHome = useCallback((duration = 1800) => flyToBounds(ALL_BOUNDS, { duration }), [flyToBounds]);

  const selectSchool = useCallback(
    (school: School | null) => {
      setSelected(school);
      setHover(null);
      setSearchOpen(false);
      if (!school) return;
      const map = mapRef.current?.getMap();
      map?.flyTo({
        center: [school.lng, school.lat],
        zoom: Math.max(map.getZoom(), 14.6),
        pitch: 52,
        duration: 1900,
        padding: isPhone ? { top: 40, bottom: innerHeight * 0.55, left: 0, right: 0 } : { top: 0, bottom: 0, left: 0, right: 400 },
        essential: true,
      });
    },
    [isPhone],
  );

  const selectGovernorate = useCallback(
    (key: string | null) => {
      setGovernorate(key);
      setSelected(null);
      setSearchOpen(false);
      if (key && governorateBounds[key]) flyToBounds(governorateBounds[key], { pitch: 46 });
      else flyHome();
    },
    [flyHome, flyToBounds, governorateBounds],
  );

  // ---- Intro: fly in from the Gulf, then let the schools and the grid appear ----

  const finishIntro = useCallback(() => {
    timers.current.forEach(clearTimeout);
    setIntroStartedAt((t) => t ?? performance.now() / 1000 - INTRO_SECONDS);
    setIntroDone(true);
  }, []);

  const onMapLoad = useCallback(() => {
    if (skipIntro) {
      flyHome(0);
      return;
    }
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    at(500, () => flyHome(5200));
    at(3300, () => setIntroStartedAt(performance.now() / 1000));
    at(3300 + INTRO_SECONDS * 1000 - 1200, () => setIntroDone(true));
  }, [flyHome, skipIntro]);

  const skipIntroNow = useCallback(() => {
    if (introDone) return;
    mapRef.current?.getMap().stop();
    flyHome(0);
    finishIntro();
  }, [finishIntro, flyHome, introDone]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // ---- Presentation ------------------------------------------------------

  const slides = useMemo<Slide[]>(() => {
    const total = SCHOOLS.length;
    const list: Slide[] = [
      {
        id: 'overview',
        title: 'Early years in Kuwait',
        titleAr: 'الطفولة المبكرة في الكويت',
        count: total,
        summary: `${total.toLocaleString()} nurseries, kindergartens and preschools across six governorates`,
        kinds: countKinds(SCHOOLS),
      },
    ];
    for (const key of TOUR_ORDER) {
      const inGov = SCHOOLS.filter((s) => s.governorate === key);
      if (!inGov.length) continue;
      list.push({
        id: key,
        title: GOVERNORATES[key].en,
        titleAr: GOVERNORATES[key].ar,
        count: inGov.length,
        summary: `${inGov.length.toLocaleString()} schools, ${Math.round((inGov.length / total) * 100)}% of Kuwait's total`,
        kinds: countKinds(inGov),
      });
    }
    const threads = buildNetwork(SCHOOLS).edges.length;
    list.push({
      id: 'grid',
      title: 'One connected grid',
      titleAr: 'شبكة واحدة مترابطة',
      count: total,
      summary: `${threads.toLocaleString()} threads join every school to its nearest neighbours`,
      kinds: countKinds(SCHOOLS),
    });
    return list;
  }, []);

  const showSlide = useCallback(
    (index: number) => {
      const slide = slides[index];
      setSlideIndex(index);
      setSelected(null);
      setHover(null);
      const isGov = slide.id in GOVERNORATES;
      setGovernorate(isGov ? slide.id : null);
      if (isGov) flyToBounds(governorateBounds[slide.id], { pitch: 52, bearing: index % 2 ? -22 : 16, duration: 3200 });
      else if (slide.id === 'grid') flyToBounds(ALL_BOUNDS, { pitch: 55, bearing: 18, duration: 3600 });
      else flyHome(3000);
    },
    [flyHome, flyToBounds, governorateBounds, slides],
  );

  const startPresenting = useCallback(() => {
    setShowWeave(true);
    setShowPulses(true);
    setKinds(new Set(KIND_ORDER));
    document.documentElement.requestFullscreen?.().catch(() => {});
    showSlide(0);
  }, [showSlide]);

  const stopPresenting = useCallback(() => {
    setSlideIndex(null);
    setGovernorate(null);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    flyHome();
  }, [flyHome]);

  // ---- Keyboard ----------------------------------------------------------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!introDone) return skipIntroNow();
      if (presenting) return;
      const typing = (e.target as HTMLElement)?.closest('input, textarea');
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === 'Escape' && !searchOpen) {
        if (selected) setSelected(null);
        else if (governorate) selectGovernorate(null);
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [governorate, introDone, presenting, searchOpen, selectGovernorate, selected, skipIntroNow]);

  // ---- Derived detail data -------------------------------------------------

  const connected = useMemo(() => {
    if (!selected) return [];
    const index = visible.findIndex((s) => s.id === selected.id);
    if (index < 0) return [];
    return network.neighbours[index]
      .map((i) => ({ school: visible[i], km: distanceKm([selected.lng, selected.lat], [visible[i].lng, visible[i].lat]) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 8);
  }, [network, selected, visible]);

  const toggleKind = (kind: Kind) =>
    setKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind) && next.size > 1) next.delete(kind);
      else next.add(kind);
      return next;
    });

  const reveal = (delay: number) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 },
    transition: { duration: 0.6, delay, ease: [0.2, 0.7, 0.2, 1] as const },
  });

  const chrome = introDone && !presenting;

  return (
    <div className="relative h-full w-full overflow-hidden" onPointerDown={introDone ? undefined : skipIntroNow}>
      <SchoolMap
        ref={mapRef}
        schools={visible}
        network={network}
        theme={theme}
        showWeave={showWeave}
        showPulses={showPulses}
        governorate={governorate}
        hoveredId={canHover ? hover?.school.id ?? null : null}
        selectedId={selected?.id ?? null}
        introStartedAt={introStartedAt}
        skipIntro={skipIntro}
        onHover={(school, x, y) => setHover(school && canHover ? { school, x, y } : null)}
        onSelect={(school) => (school ? selectSchool(school) : setSelected(null))}
        onLoad={onMapLoad}
      />

      {/* Soft fade behind the title so map labels never fight with it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-44"
        style={{ background: 'linear-gradient(to bottom, color-mix(in srgb, var(--page) 78%, transparent), transparent)' }}
      />
      {!presenting && <TitleBlock count={visibleCount} governorate={governorate} compact={isPhone} counting={introStartedAt !== null || skipIntro} />}

      <AnimatePresence>
        {chrome && (
          <motion.div key="search" {...reveal(0.1)} className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
            <SearchButton count={SCHOOLS.length} compact={isPhone} onClick={() => setSearchOpen(true)} />
          </motion.div>
        )}

        {chrome && !isPhone && (
          <motion.div key="index" {...reveal(0.2)} className="glass absolute bottom-6 left-6 z-20 w-[300px] rounded-3xl p-3">
            <IndexPanel
              kindCounts={kindCounts}
              kinds={kinds}
              onToggleKind={toggleKind}
              governorateCounts={governorateCounts}
              total={visible.length}
              governorate={governorate}
              onGovernorate={selectGovernorate}
            />
            <p className="mt-2 px-2 text-[11px] text-ink-faint">Listings from Google Maps, October 2026</p>
          </motion.div>
        )}

        {chrome && (
          <motion.div
            key="controls"
            {...reveal(0.3)}
            // On desktop the controls slide left to make room for the detail panel.
            style={isPhone ? undefined : { right: selected ? 412 : 24 }}
            className={`absolute z-20 transition-[right] duration-500 ease-out ${isPhone ? 'right-3 top-[76px]' : 'bottom-6'}`}
          >
            <MapControls
              compact={isPhone}
              showWeave={showWeave}
              onWeave={setShowWeave}
              showPulses={showPulses}
              onPulses={setShowPulses}
              theme={theme}
              onTheme={setTheme}
              onZoom={(d) => (d > 0 ? mapRef.current?.zoomIn() : mapRef.current?.zoomOut())}
              onHome={() => selectGovernorate(null)}
              onPresent={startPresenting}
            />
          </motion.div>
        )}

        {chrome && isPhone && !selected && (
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 36, delay: 0.2 }}
            className="glass fixed inset-x-0 bottom-0 z-20 rounded-t-3xl px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2"
          >
            <button
              type="button"
              onClick={() => setSheetOpen(!sheetOpen)}
              aria-expanded={sheetOpen}
              className="flex w-full items-center justify-center gap-1.5 py-1 text-[12px] text-ink-muted"
            >
              <span className="h-1 w-10 rounded-full bg-line-strong" />
            </button>
            <div className={sheetOpen ? 'scroll-thin max-h-[60vh] overflow-y-auto' : 'max-h-[118px] overflow-hidden'}>
              <IndexPanel
                kindCounts={kindCounts}
                kinds={kinds}
                onToggleKind={toggleKind}
                governorateCounts={governorateCounts}
                total={visible.length}
                governorate={governorate}
                onGovernorate={(key) => {
                  setSheetOpen(false);
                  selectGovernorate(key);
                }}
              />
            </div>
            {!sheetOpen && (
              <button type="button" onClick={() => setSheetOpen(true)} className="mt-1 flex w-full items-center justify-center gap-1 py-1 text-[12.5px] text-ink-muted">
                <ChevronUp size={14} /> Governorates
              </button>
            )}
          </motion.div>
        )}

        {!introDone && (
          <motion.button
            key="skip"
            type="button"
            onClick={skipIntroNow}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 1.2 } }}
            exit={{ opacity: 0 }}
            className="absolute bottom-8 left-1/2 z-20 -translate-x-1/2 rounded-full px-4 py-2 text-[12.5px] text-ink-faint transition-colors hover:text-ink"
          >
            Skip intro
          </motion.button>
        )}
      </AnimatePresence>

      {canHover && !presenting && <HoverCard hover={hover && hover.school.id !== selected?.id ? hover : null} />}

      <DetailPanel
        school={presenting ? null : selected}
        connected={connected}
        sheet={isPhone}
        onClose={() => setSelected(null)}
        onSelect={selectSchool}
      />

      <SearchPalette
        open={searchOpen}
        schools={SCHOOLS}
        onOpenChange={setSearchOpen}
        onSchool={(s) => {
          if (!kinds.has(s.kind)) setKinds((prev) => new Set([...prev, s.kind]));
          selectSchool(s);
        }}
        onGovernorate={selectGovernorate}
      />

      {presenting && <PresentationOverlay slides={slides} index={slideIndex} onIndex={showSlide} onExit={stopPresenting} />}
    </div>
  );
}
