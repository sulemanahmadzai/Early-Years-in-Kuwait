import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { GOVERNORATES } from './meta';
import type { Kind, School, Sector } from './types';

export type Lang = 'en' | 'ar';

const fmt = (n: number) => n.toLocaleString('en-US');
// Population figures are estimates: round them so they don't look more precise than they are.
const approx = (n: number) => fmt(n >= 1000 ? Math.round(n / 100) * 100 : Math.round(n / 10) * 10);

const en = {
  title: 'Early years in Kuwait',
  /** The words after the (animated) number in the title's count line. */
  countRest: (n: number, place: string | null, sector: Sector | 'all' = 'all') => {
    const what =
      sector === 'government'
        ? n === 1 ? 'government kindergarten' : 'government kindergartens'
        : `${sector === 'private' ? 'private ' : ''}${n === 1 ? 'school' : 'nurseries, kindergartens and preschools'}`;
    return `${what}${place ? ` in ${place}` : ''}`;
  },
  kind: { kindergarten: 'Kindergarten', nursery: 'Nursery', preschool: 'Preschool' } as Record<Kind, string>,
  kinds: { kindergarten: 'Kindergartens', nursery: 'Nurseries', preschool: 'Preschools' } as Record<Kind, string>,
  kindCount: (kind: Kind, n: number) => `${fmt(n)} ${en.kinds[kind].toLowerCase()}`,
  sector: { government: 'Government', private: 'Private' } as Record<Sector, string>,
  allSectors: 'All',
  sectorCount: (sector: Sector, n: number) => `${fmt(n)} ${sector === 'government' ? 'government' : 'private'}`,
  governmentNote: 'Government kindergarten, Ministry of Education',
  founded: (year: number) => `Founded ${year}`,
  allOfKuwait: 'All of Kuwait',
  chooseSchools: 'Choose schools',
  hiddenCount: (n: number) => `${fmt(n)} hidden`,
  sources: 'Listings from Google Maps, October 2026. Government list: Ministry of Education directory 2024–25.',
  groups: { sector: 'Government or private', kinds: 'School types', governorates: 'Governorates' },
  grid: 'Grid',
  pulse: 'Pulse',
  mapStyle: 'Map style',
  themes: { dusk: 'Dusk map', day: 'Day map', satellite: 'Satellite' },
  present: 'Present',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  home: 'Show all of Kuwait',
  showGrid: 'Show grid',
  hideGrid: 'Hide grid',
  showPulse: 'Show pulse',
  stopPulse: 'Stop pulse',
  switchTo: (what: string) => `Switch to ${what.toLowerCase()}`,
  otherLanguage: 'العربية',
  otherLanguageLabel: 'عرض الواجهة بالعربية',
  location: 'Location',
  phone: 'Phone',
  website: 'Website',
  rating: 'Google rating',
  outOf5: 'out of 5',
  call: 'Call',
  openInMaps: 'Open in Google Maps',
  hideSchool: 'Hide this school from the map',
  connectedTitle: 'Connected on the grid',
  connectedNote: 'Its nearest neighbours, joined by a thread on the map.',
  close: 'Close',
  distance: (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`),
  searchButton: (n: number) => `Search ${fmt(n)} schools or an area`,
  searchLabel: 'Search schools',
  searchPlaceholder: 'School name in English or Arabic, or an area like Salmiya',
  startTyping: 'Start typing to find a school.',
  noMatch: (q: string) => `Nothing matches “${q}”. Try the Arabic name, or an area such as Jabriya or Mangaf.`,
  governorateResult: (g: string) => `${g} governorate`,
  hidden: 'Hidden',
  hiddenHint: 'Choosing it puts it back on the map',
  overviewSummary: (n: number) => `${fmt(n)} nurseries, kindergartens and preschools across six governorates`,
  governorateSummary: (n: number, pct: number) => `${fmt(n)} schools, ${pct}% of Kuwait's total`,
  gridTitle: 'One connected grid',
  gridSummary: (n: number) => `${fmt(n)} threads join every school to its nearest neighbours`,
  previous: 'Previous',
  next: 'Next',
  playTour: 'Play tour',
  pauseTour: 'Pause tour',
  exitPresentation: 'Exit presentation',
  shownOf: (a: number, b: number) => `${fmt(a)} of ${fmt(b)} shown on the map`,
  filterPlaceholder: 'Filter by name or area',
  views: { all: 'All', shown: 'Shown', hidden: 'Hidden' },
  allGovernorates: 'All governorates',
  listCount: (n: number, filtered: boolean) => `${fmt(n)} ${filtered ? 'in this list' : 'schools'}`,
  hideList: (filtered: boolean): string => (filtered ? 'Hide these' : 'Hide all'),
  showList: (filtered: boolean): string => (filtered ? 'Show these' : 'Show all'),
  emptyHidden: 'No hidden schools here. Every school in this list is on the map.',
  emptyFilter: 'No school matches this filter.',
  savedNote: 'Saved on this device. Copy the link to open the same selection elsewhere.',
  copyLink: 'Copy link',
  showOnMap: 'Show on the map',
  toggleSchool: (on: boolean, name: string) => `${on ? 'Hide' : 'Show'} ${name}`,
  toastHidden: (name: string) => `Hidden from the map: ${name}`,
  undo: 'Undo',
  toastHidMany: (n: number) => `Hid ${fmt(n)} schools`,
  toastShowedMany: (n: number) => `Showed ${fmt(n)} schools`,
  toastBack: (name: string) => `Back on the map: ${name}`,
  toastLinkCopied: (n: number) => `Link copied. It opens the map with these ${fmt(n)} schools.`,
  toastCopyBlocked: 'Copying was blocked by the browser. Try again after clicking the page.',
  skipIntro: 'Skip intro',
  governorates: 'Governorates',
  coverage: 'Coverage',
  coverageIntro: 'Where young children live, and how close the nearest nursery or kindergarten is.',
  lenses: { perSchool: 'Children per school', distance: 'Distance to a school' } as Record<'perSchool' | 'distance', string>,
  legendTitle: {
    perSchool: 'Children under five per school, within 1.5 km',
    distance: 'Distance to the nearest school',
  } as Record<'perSchool' | 'distance', string>,
  legend: {
    perSchool: ['Up to 150', '150–300', '300–600', 'Over 600', 'None nearby'],
    distance: ['Under 1 km', '1–2 km', '2–3 km', '3–5 km', 'Over 5 km'],
  } as Record<'perSchool' | 'distance', string[]>,
  heightNote: 'Column height: children under five living there',
  schoolNoun: (government: boolean): string => (government ? 'government kindergarten' : 'nursery or kindergarten'),
  childrenTotal: (n: number) => `${approx(n)} children under five live in Kuwait.`,
  childrenFar: (n: number, noun: string) => `${approx(n)} of them live more than 2 km from the nearest ${noun}.`,
  hotspotsTitle: { perSchool: 'Most underserved', distance: 'Furthest from a school' } as Record<'perSchool' | 'distance', string>,
  near: (place: string) => `near ${place}`,
  childrenAround: (n: number) => `≈ ${approx(n)} children under five within 1.5 km`,
  childrenHere: (n: number) => `≈ ${approx(n)} children under five here`,
  noSchoolNear: (noun: string) => `No ${noun} within 1.5 km`,
  perSchoolValue: (n: number) => `≈ ${approx(n)} children per school`,
  schoolsNear: (n: number) => `${fmt(n)} ${n === 1 ? 'school' : 'schools'} within 1.5 km`,
  nearestSchool: (km: string) => `Nearest school ${km} away`,
  coverageSource: 'Children under five: WorldPop 2026 estimates on a 100 m grid. Indicative only, as school sizes are not known.',
  backToSchools: 'Back to the schools view',
  gapsTitle: 'Where the gaps are',
  gapsSummary: (n: number) => `${approx(n)} children under five live more than 2 km from a nursery or kindergarten`,
  gapsTotal: (n: number) => `${approx(n)} children under five in Kuwait`,
};

type Dict = typeof en;

const ar: Dict = {
  title: 'الطفولة المبكرة في الكويت',
  countRest: (_n, place, sector = 'all') => {
    const what = sector === 'government' ? 'من رياض الأطفال الحكومية' : sector === 'private' ? 'من الحضانات ورياض الأطفال الخاصة' : 'من الحضانات ورياض الأطفال';
    return `${what}${place ? ` في ${place}` : ''}`;
  },
  kind: { kindergarten: 'روضة أطفال', nursery: 'حضانة', preschool: 'مدرسة تمهيدية' },
  kinds: { kindergarten: 'رياض الأطفال', nursery: 'الحضانات', preschool: 'المدارس التمهيدية' },
  kindCount: (kind, n) => `${ar.kinds[kind]} ${fmt(n)}`,
  sector: { government: 'حكومية', private: 'خاصة' },
  allSectors: 'الكل',
  sectorCount: (sector, n) => `${sector === 'government' ? 'الحكومية' : 'الخاصة'} ${fmt(n)}`,
  governmentNote: 'روضة حكومية تابعة لوزارة التربية',
  founded: (year) => `تأسست عام ${year}`,
  allOfKuwait: 'كل الكويت',
  chooseSchools: 'اختيار المدارس',
  hiddenCount: (n) => `${fmt(n)} مخفية`,
  sources: 'البيانات من خرائط Google، أكتوبر 2026. القائمة الحكومية: دليل مدارس وزارة التربية 2024–2025.',
  groups: { sector: 'حكومية أو خاصة', kinds: 'أنواع المدارس', governorates: 'المحافظات' },
  grid: 'الشبكة',
  pulse: 'النبض',
  mapStyle: 'نمط الخريطة',
  themes: { dusk: 'خريطة المساء', day: 'خريطة النهار', satellite: 'القمر الصناعي' },
  present: 'عرض تقديمي',
  zoomIn: 'تكبير',
  zoomOut: 'تصغير',
  home: 'عرض الكويت كاملة',
  showGrid: 'إظهار الشبكة',
  hideGrid: 'إخفاء الشبكة',
  showPulse: 'تشغيل النبض',
  stopPulse: 'إيقاف النبض',
  switchTo: (what) => `التبديل إلى ${what}`,
  otherLanguage: 'English',
  otherLanguageLabel: 'Show the interface in English',
  location: 'الموقع',
  phone: 'الهاتف',
  website: 'الموقع الإلكتروني',
  rating: 'تقييم Google',
  outOf5: 'من 5',
  call: 'اتصال',
  openInMaps: 'فتح في خرائط Google',
  hideSchool: 'إخفاء هذه المدرسة من الخريطة',
  connectedTitle: 'مرتبطة بها في الشبكة',
  connectedNote: 'أقرب المدارس إليها، يربطها بها خيط على الخريطة.',
  close: 'إغلاق',
  distance: (km) => (km < 1 ? `${Math.round(km * 1000)} م` : `${km.toFixed(km < 10 ? 1 : 0)} كم`),
  searchButton: (n) => `ابحث في ${fmt(n)} مدرسة أو منطقة`,
  searchLabel: 'البحث عن مدرسة',
  searchPlaceholder: 'اسم المدرسة بالعربية أو الإنجليزية، أو منطقة مثل السالمية',
  startTyping: 'اكتب للبحث عن مدرسة.',
  noMatch: (q) => `لا نتائج لـ «${q}». جرّب الاسم بالإنجليزية، أو منطقة مثل الجابرية أو المنقف.`,
  governorateResult: (g) => `محافظة ${g}`,
  hidden: 'مخفية',
  hiddenHint: 'اختيارها يعيدها إلى الخريطة',
  overviewSummary: (n) => `${fmt(n)} من الحضانات ورياض الأطفال في ست محافظات`,
  governorateSummary: (n, pct) => `${fmt(n)} مدرسة، ${pct}٪ من مجموع الكويت`,
  gridTitle: 'شبكة واحدة مترابطة',
  gridSummary: (n) => `${fmt(n)} خيطاً يربط كل مدرسة بأقرب جيرانها`,
  previous: 'السابق',
  next: 'التالي',
  playTour: 'تشغيل الجولة',
  pauseTour: 'إيقاف الجولة',
  exitPresentation: 'إنهاء العرض',
  shownOf: (a, b) => `${fmt(a)} من ${fmt(b)} ظاهرة على الخريطة`,
  filterPlaceholder: 'تصفية بالاسم أو المنطقة',
  views: { all: 'الكل', shown: 'الظاهرة', hidden: 'المخفية' },
  allGovernorates: 'كل المحافظات',
  listCount: (n, filtered) => `${fmt(n)} ${filtered ? 'في هذه القائمة' : 'مدرسة'}`,
  hideList: (filtered) => (filtered ? 'إخفاء هذه' : 'إخفاء الكل'),
  showList: (filtered) => (filtered ? 'إظهار هذه' : 'إظهار الكل'),
  emptyHidden: 'لا توجد مدارس مخفية هنا. كل مدارس هذه القائمة ظاهرة على الخريطة.',
  emptyFilter: 'لا توجد مدرسة تطابق هذه التصفية.',
  savedNote: 'محفوظ على هذا الجهاز. انسخ الرابط لفتح الاختيار نفسه على جهاز آخر.',
  copyLink: 'نسخ الرابط',
  showOnMap: 'عرض على الخريطة',
  toggleSchool: (on, name) => `${on ? 'إخفاء' : 'إظهار'} ${name}`,
  toastHidden: (name) => `أُخفيت من الخريطة: ${name}`,
  undo: 'تراجع',
  toastHidMany: (n) => `أُخفيت ${fmt(n)} مدرسة`,
  toastShowedMany: (n) => `أُظهرت ${fmt(n)} مدرسة`,
  toastBack: (name) => `عادت إلى الخريطة: ${name}`,
  toastLinkCopied: (n) => `نُسخ الرابط. يفتح الخريطة بهذه المدارس (${fmt(n)}).`,
  toastCopyBlocked: 'منع المتصفح النسخ. حاول مرة أخرى بعد النقر على الصفحة.',
  skipIntro: 'تخطي المقدمة',
  governorates: 'المحافظات',
  coverage: 'التغطية',
  coverageIntro: 'أين يعيش الأطفال الصغار، وكم تبعد عنهم أقرب حضانة أو روضة.',
  lenses: { perSchool: 'الأطفال لكل مدرسة', distance: 'المسافة إلى مدرسة' },
  legendTitle: {
    perSchool: 'الأطفال دون الخامسة لكل مدرسة، ضمن 1.5 كم',
    distance: 'المسافة إلى أقرب مدرسة',
  },
  legend: {
    perSchool: ['حتى 150', '150–300', '300–600', 'أكثر من 600', 'لا مدرسة قريبة'],
    distance: ['أقل من 1 كم', '1–2 كم', '2–3 كم', '3–5 كم', 'أكثر من 5 كم'],
  },
  heightNote: 'ارتفاع العمود: عدد الأطفال دون الخامسة',
  schoolNoun: (government) => (government ? 'روضة حكومية' : 'حضانة أو روضة'),
  childrenTotal: (n) => `يعيش في الكويت ${approx(n)} طفل دون الخامسة.`,
  childrenFar: (n, noun) => `منهم ${approx(n)} على بعد أكثر من 2 كم من أقرب ${noun}.`,
  hotspotsTitle: { perSchool: 'الأكثر حاجة', distance: 'الأبعد عن المدارس' },
  near: (place) => `قرب ${place}`,
  childrenAround: (n) => `≈ ${approx(n)} طفل دون الخامسة ضمن 1.5 كم`,
  childrenHere: (n) => `≈ ${approx(n)} طفل دون الخامسة هنا`,
  noSchoolNear: (noun) => `لا توجد ${noun} ضمن 1.5 كم`,
  perSchoolValue: (n) => `≈ ${approx(n)} طفل لكل مدرسة`,
  schoolsNear: (n) => `${fmt(n)} مدرسة ضمن 1.5 كم`,
  nearestSchool: (km) => `أقرب مدرسة على بعد ${km}`,
  coverageSource: 'الأطفال دون الخامسة: تقديرات WorldPop لعام 2026 بدقة 100 م. الأرقام إرشادية لأن سعة المدارس غير معروفة.',
  backToSchools: 'العودة إلى عرض المدارس',
  gapsTitle: 'أين الفجوات',
  gapsSummary: (n) => `${approx(n)} طفل دون الخامسة يعيشون على بعد أكثر من 2 كم من أقرب حضانة أو روضة`,
  gapsTotal: (n) => `${approx(n)} طفل دون الخامسة في الكويت`,
};

const DICTS: Record<Lang, Dict> = { en, ar };

// Area names come from Google's plus codes, mostly in English; these are all the ones in the data.
export const AREA_AR: Record<string, string> = {
  Daher: 'الظهر',
  'Al Jahra': 'الجهراء',
  'Kuwait City': 'مدينة الكويت',
  'Shuwaikh Industrial': 'الشويخ الصناعية',
  Zahra: 'الزهراء',
  'Mubarak Al-Abdullah': 'مبارك العبدالله',
  Rumaithiya: 'الرميثية',
  Mangaf: 'المنقف',
  Ardiya: 'العارضية',
  'Al Farwaniyah': 'الفروانية',
  Hadiya: 'هدية',
  Jabriya: 'الجابرية',
  Sulaibikhat: 'الصليبيخات',
  Salmiya: 'السالمية',
  'Fahad Al Ahmad': 'فهد الأحمد',
  'Abdullah Al Mubarak Al Sabah': 'عبدالله المبارك',
  Andalous: 'الأندلس',
  Fnaitees: 'الفنيطيس',
  'Al Funaytis': 'الفنيطيس',
  'Sabah Al Ahmad': 'صباح الأحمد',
  'Sabah Al Salem': 'صباح السالم',
  Hawally: 'حولي',
  'Ali Sabah Al Salem': 'علي صباح السالم',
  'Jaber Al Ahmad': 'جابر الأحمد',
  Rabia: 'الرابية',
  'Al Wafrah': 'الوفرة',
  'Al Ahmadi': 'الأحمدي',
  'Sabah Al Nasser': 'صباح الناصر',
  'Al-Masayel': 'المسايل',
  Doha: 'الدوحة',
  Firdous: 'الفردوس',
};
const AREA_EN: Record<string, string> = { 'غرب عبدالله المبارك': 'West Abdullah Al Mubarak' };

const ARABIC = /[؀-ۿ]/;

export interface Words {
  lang: Lang;
  t: Dict;
  setLang: (lang: Lang) => void;
  /** The school's name in the interface language, falling back to whichever it has. */
  name: (s: School) => string;
  /** The school's name in the other language, when it has a different one. */
  otherName: (s: School) => string | null;
  governorate: (key: string | null) => string | null;
  area: (area: string | null) => string | null;
  where: (s: School) => string;
}

const LangContext = createContext<Words | null>(null);
const STORAGE_KEY = 'early-years-kw:lang';

function initialLang(): Lang {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (fromUrl === 'ar' || fromUrl === 'en') return fromUrl;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ar' || saved === 'en') return saved;
  } catch {
    // Storage unavailable: start in English.
  }
  return 'en';
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = lang === 'ar' ? 'الطفولة المبكرة في الكويت' : 'Early Years in Kuwait';
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Storage unavailable: the choice lasts for this visit.
    }
  }, [lang]);

  const value = useMemo<Words>(() => {
    const t = DICTS[lang];
    const governorate = (key: string | null) => (key ? (lang === 'ar' ? GOVERNORATES[key]?.ar : GOVERNORATES[key]?.en) ?? key : null);
    const area = (a: string | null) => (a ? (lang === 'ar' ? AREA_AR[a] ?? a : AREA_EN[a] ?? a) : null);
    return {
      lang,
      t,
      setLang,
      name: (s) => (lang === 'ar' ? s.nameAr ?? s.name : s.name),
      otherName: (s) => {
        if (lang === 'ar') return s.nameAr && s.name !== s.nameAr && !ARABIC.test(s.name) ? s.name : null;
        return s.nameAr && s.nameAr !== s.name ? s.nameAr : null;
      },
      governorate,
      area,
      where: (s) =>
        [area(s.area), governorate(s.governorate)].filter((v, i, list): v is string => Boolean(v) && list.indexOf(v) === i).join(lang === 'ar' ? '، ' : ', '),
    };
  }, [lang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useWords(): Words {
  const words = useContext(LangContext);
  if (!words) throw new Error('useWords must be used inside <LangProvider>');
  return words;
}
