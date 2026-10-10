// v5 типы (v1 Place/Post остаются для read-only миграции)
export interface GeoPlaceV5 {
  id: number;
  name: string;
  address?: string | null;
  district?: string | null;
  street?: string | null;
  lat: number;
  lng: number;
  yandex_kind: string;
  preview_url?: string | null;
}

export interface ThreadV5 {
  id: number;
  author_id: number;
  author_username?: string | null;
  title?: string | null;
  body_md: string;
  body_html: string;
  categories?: { id: number; name: string; slug: string }[];
  tags?: string[];
  photos?: { id: number; url: string }[];
  is_offtop: boolean;
  place?: GeoPlaceV5 | null;
  views: number;
  likes_count: number;
  comments_count: number;
  created_at: string;
  comments?: ThreadCommentV5[];
}

export interface ThreadCommentV5 {
  id: number;
  parent_id?: number | null;
  author_id: number;
  body_html: string;
  created_at: string;
}
