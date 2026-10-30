export type Kind = 'kindergarten' | 'nursery' | 'preschool';

/** Government = listed in the Ministry of Education's 2024–25 directory; everything else is private. */
export type Sector = 'government' | 'private';

export interface School {
  id: string;
  name: string;
  nameAr: string | null;
  kind: Kind;
  category: string | null;
  lat: number;
  lng: number;
  governorate: string | null;
  area: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  photo: string | null;
  mapsUrl: string;
  status: string | null;
  sector: Sector;
  /** Founding year, from the Ministry directory (government kindergartens only). */
  founded: number | null;
}

export type MapTheme = 'dusk' | 'day' | 'satellite';
