import type { Kind } from './types';

type RGB = [number, number, number];

// Kindergartens take the blue-green of the Kuwait Towers' discs, nurseries the
// madder red of Al Sadu weaving, preschools the gold of the pearling era.
export const KINDS: Record<Kind, { label: string; plural: string; ar: string; color: RGB; css: string }> = {
  kindergarten: { label: 'Kindergarten', plural: 'Kindergartens', ar: 'روضة', color: [79, 209, 197], css: 'var(--kind-kindergarten)' },
  nursery: { label: 'Nursery', plural: 'Nurseries', ar: 'حضانة', color: [236, 91, 67], css: 'var(--kind-nursery)' },
  preschool: { label: 'Preschool', plural: 'Preschools', ar: 'تمهيدي', color: [233, 185, 73], css: 'var(--kind-preschool)' },
};

export const KIND_ORDER: Kind[] = ['kindergarten', 'nursery', 'preschool'];

// Keys are the geoBoundaries names used in the dataset.
export const GOVERNORATES: Record<string, { en: string; ar: string }> = {
  'Al Asimah': { en: 'Capital', ar: 'العاصمة' },
  Hawalli: { en: 'Hawalli', ar: 'حولي' },
  Farwaniya: { en: 'Farwaniya', ar: 'الفروانية' },
  'Mubarak Al-Kabeer': { en: 'Mubarak Al-Kabeer', ar: 'مبارك الكبير' },
  Ahmadi: { en: 'Ahmadi', ar: 'الأحمدي' },
  Jahra: { en: 'Jahra', ar: 'الجهراء' },
};

export const governorateName = (key: string | null) => (key ? GOVERNORATES[key]?.en ?? key : null);

// Kuwait City's old centre — the network grows outward from here.
export const ORIGIN: [number, number] = [47.9774, 29.3759];
