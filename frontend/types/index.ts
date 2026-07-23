export interface City {
  id: number;
  name: string;
  slug: string;
  country?: string | null;
  center_lat: number;
  center_lng: number;
  default_zoom: number;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon?: string | null;
}

export interface Place {
  id: number;
  city_id: number;
  created_by: number;
  title: string;
  slug: string;
  latitude: number;
  longitude: number;
  is_verified: boolean;
  created_at: string;
  categories: Category[];
}

export interface Photo {
  id: number;
  post_id: number;
  file_name: string;
  width?: number | null;
  height?: number | null;
  created_at: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  avatar?: string | null;
  created_at: string;
}

export interface Post {
  id: number;
  place_id: number;
  author_id: number;
  title: string;
  text: string;
  created_at: string;
  photos: Photo[];
}
