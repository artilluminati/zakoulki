// v5 типы (v1 Place/Post остаются для read-only миграции)
export interface GeoPlaceV5 {
  id: number;
  name: string;
  address?: string | null;
  district?: string | null;
  street?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  lat: number;
  lng: number;
  area?: [number, number][] | null;
  yandex_kind: string;
  preview_url?: string | null;
  map_preview?: string | null;
}

export interface ThreadV5 {
  id: number;
  author_id: number;
  author_username?: string | null;
  author_badge?: string | null;
  title?: string | null;
  body_md: string;
  body_html: string;
  categories?: { id: number; name: string; slug: string }[];
  tags?: string[];
  city?: string | null;
  district?: string | null;
  region?: string | null;
  country?: string | null;
  is_hub?: boolean;
  is_hub_talk?: boolean;
  hub_requested?: boolean;
  hub_votes?: number;
  hub_voted?: boolean;
  is_resolved?: boolean;
  is_archived?: boolean;
  hub_id?: number | null;
  hub?: { id: number; title: string; author_id?: number | null } | null;
  talk_id?: number | null;
  attached_count?: number;
  moderators?: { id: number; username: string }[];
  photos?: { id: number; url: string; preview_url?: string }[];
  poll?: PollV5 | null;
  is_offtop: boolean;
  place?: GeoPlaceV5 | null;
  views: number;
  likes_count: number;
  score?: number;
  my_vote?: number | null;
  comments_count: number;
  created_at: string;
  comments?: ThreadCommentV5[];
}

export interface ThreadCommentV5 {
  id: number;
  parent_id?: number | null;
  author_id: number;
  author_username?: string | null;
  author_badge?: string | null;
  body_md: string;
  body_html: string;
  photos?: { id: number; url: string; preview_url?: string }[];
  created_at: string;
}

export interface PollV5 {
  id: number;
  question: string;
  multiple: boolean;
  total: number;
  voted: number[];
  options: { id: number; text: string; votes: number }[];
}
