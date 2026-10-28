export type Kind = 'kindergarten' | 'nursery' | 'preschool';

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
}

export type MapTheme = 'dusk' | 'day' | 'satellite';
