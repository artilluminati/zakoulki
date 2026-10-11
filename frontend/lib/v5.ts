import { api } from "@/lib/api";
import type { ThreadV5, GeoPlaceV5 } from "@/types/v5";
import type { Scope } from "@/lib/scope";

/** Параметры региона: комбо «город и область» идет через OR, обычное — через AND. */
export function scopeParams(s: Scope): Record<string, string | string[]> {
  if (s.any && s.any.length > 0) return { geo_any: s.any };
  const p: Record<string, string> = {};
  if (s.district) p.district = s.district;
  if (s.city) p.city = s.city;
  if (s.region) p.region = s.region;
  if (s.country) p.country = s.country;
  return p;
}

function toSearchParams(params: Record<string, string | number | boolean | string[] | undefined>): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, x));
    else sp.append(k, String(v));
  }
  return sp;
}

export async function fetchThreads(params: Record<string, string | number | boolean | string[] | undefined> = {}) {
  const res = await api.get<ThreadV5[]>("/threads", { params: toSearchParams(params) });
  return res.data;
}

export async function fetchThread(id: number | string) {
  const res = await api.get<ThreadV5 & { comments: { id: number; parent_id?: number | null; author_id: number; author_username?: string | null; author_badge?: string | null; body_md: string; body_html: string; photos?: { id: number; url: string; preview_url?: string }[]; created_at: string }[] }>(`/threads/${id}`);
  return res.data;
}

export async function createThread(payload: { title?: string | null; body_md: string; place_id?: number | null; category_ids?: number[]; tags?: string[]; poll?: { question: string; options: string[]; multiple: boolean } | null; city?: string | null; district?: string | null; region?: string | null; country?: string | null }) {
  const res = await api.post("/threads", payload);
  return res.data;
}

export async function likeThread(id: number) {
  const res = await api.post(`/threads/${id}/like`);
  return res.data as { liked: boolean };
}

export async function bookmarkThread(id: number) {
  const res = await api.post(`/threads/${id}/bookmark`);
  return res.data as { bookmarked: boolean };
}

export async function fetchBookmarks() {
  const res = await api.get<ThreadV5[]>("/threads/bookmarks/mine");
  return res.data;
}

export async function commentThread(id: number, body_md: string, parent_id?: number | null) {
  const res = await api.post(`/threads/${id}/comments`, { body_md, parent_id });
  return res.data;
}

export async function updateThread(id: number, payload: { title?: string | null; body_md?: string; place_id?: number | null }) {
  const res = await api.patch(`/threads/${id}`, payload);
  return res.data;
}

export async function updateComment(commentId: number, body_md: string) {
  const res = await api.patch(`/threads/comments/${commentId}`, { body_md });
  return res.data;
}

export async function deleteComment(commentId: number) {
  await api.delete(`/threads/comments/${commentId}`);
}

export async function uploadCommentPhoto(commentId: number, file: File) {
  const form = new FormData();
  form.append("file", file);
  // Content-Type НЕ ставим вручную: axios добавит boundary сам,
  // иначе FastAPI не распарсит multipart и вернёт ошибку
  const res = await api.post(`/threads/comments/${commentId}/photos`, form);
  return res.data as { id: number; url: string };
}

export async function deletePhoto(photoId: number) {
  await api.delete(`/threads/photos/${photoId}`);
}

export async function votePoll(threadId: number, optionIds: number[]) {
  const res = await api.post(`/threads/${threadId}/vote`, { option_ids: optionIds });
  return res.data;
}

export async function requestHub(threadId: number) {
  const res = await api.post(`/threads/${threadId}/request-hub`);
  return res.data;
}

export async function voteHub(threadId: number) {
  const res = await api.post(`/threads/${threadId}/vote-hub`);
  return res.data;
}

export async function reportThread(id: number, reason: string, text?: string, comment_id?: number) {
  const res = await api.post(`/threads/${id}/report`, { reason, text, comment_id });
  return res.data;
}

export async function searchGeoPlaces(q: string) {
  const res = await api.get<GeoPlaceV5[]>("/geo-places/search", { params: { q } });
  return res.data;
}

export async function fetchTags(search?: string) {
  const res = await api.get("/tags", { params: search ? { search } : {} });
  return res.data as { name: string; count: number }[];
}

export async function fetchNearbyThreads(lat: number, lng: number, radius = 0.3) {
  const res = await api.get("/geo-places/nearby", { params: { lat, lng, radius } });
  return res.data as { id: number; body_md: string; place_name?: string }[];
}

export async function fetchMapPoints(bbox: { north: number; south: number; east: number; west: number; district?: string; city?: string; region?: string; country?: string; geo_any?: string[] }) {
  const res = await api.get("/geo-places/map-points", { params: toSearchParams(bbox) });
  return res.data as { id: number; lat: number; lng: number; is_offtop: boolean; comments: number; has_photo: boolean; cover_url?: string | null; area?: [number, number][] | null }[];
}

export async function createGeoPlace(p: { name: string; latitude: number; longitude: number; address?: string | null; district?: string | null; street?: string | null; city?: string | null; region?: string | null; country?: string | null; area?: [number, number][] | null }) {
  const res = await api.post("/geo-places", { ...p, yandex_kind: "self" });
  return res.data as GeoPlaceV5;
}

export async function reverseGeocode(lat: number, lng: number) {
  const res = await api.get("/geo-places/reverse", { params: { lat, lng } });
  return res.data as { name: string; address?: string | null; district?: string | null; street?: string | null; city?: string | null; region?: string | null; country?: string | null; lat: number; lng: number };
}

export async function fetchSimilarPlaces(name: string, lat?: number, lng?: number) {
  const res = await api.get<GeoPlaceV5[]>("/geo-places/similar", { params: { name, ...(lat !== undefined ? { lat, lng } : {}) } });
  return res.data;
}

export interface PlaceHub { id: number; title: string; author?: string | null; talk_id?: number | null; members: number; }

export interface HubListItem { id: number; title: string; place?: { id: number; name: string } | null; members: number; }

export async function searchHubs(q?: string) {
  const res = await api.get<HubListItem[]>("/threads/hubs", { params: q?.trim() ? { q: q.trim() } : {} });
  return res.data;
}

export interface PickedHub { id: number; title: string; placeId: number; placeName: string; }

export async function fetchPlaceHubs(placeId: number) {
  const res = await api.get<PlaceHub[]>(`/geo-places/${placeId}/hubs`);
  return res.data;
}

export async function createHub(placeId: number, title: string) {
  const res = await api.post<ThreadV5>("/threads/hubs", { place_id: placeId, title });
  return res.data;
}

export async function makeHub(threadId: number, title?: string | null) {
  const res = await api.post<ThreadV5>(`/threads/${threadId}/make-hub`, { title: title ?? null });
  return res.data;
}

export async function attachHub(threadId: number, hubId: number) {
  const res = await api.post<ThreadV5>(`/threads/${threadId}/attach-hub`, { hub_id: hubId });
  return res.data;
}

export async function detachHub(threadId: number) {
  const res = await api.delete<ThreadV5>(`/threads/${threadId}/attach-hub`);
  return res.data;
}

export async function fetchAttached(hubId: number) {
  const res = await api.get<ThreadV5[]>(`/threads/${hubId}/attached`);
  return res.data;
}

export async function uploadThreadPhoto(threadId: number, file: File) {
  const form = new FormData();
  form.append("file", file);
  // Content-Type НЕ ставим вручную: axios добавит boundary сам,
  // иначе FastAPI не распарсит multipart и вернёт ошибку
  const res = await api.post(`/threads/${threadId}/photos`, form);
  return res.data as { id: number; url: string };
}
