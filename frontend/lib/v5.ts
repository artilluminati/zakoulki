import { api } from "@/lib/api";
import type { ThreadV5, GeoPlaceV5 } from "@/types/v5";

export async function fetchThreads(params: Record<string, string | number | boolean | undefined> = {}) {
  const clean: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined) clean[k] = v;
  const res = await api.get<ThreadV5[]>("/threads", { params: clean });
  return res.data;
}

export async function fetchThread(id: number | string) {
  const res = await api.get<ThreadV5 & { comments: { id: number; parent_id?: number | null; author_id: number; author_username?: string | null; body_md: string; body_html: string; created_at: string }[] }>(`/threads/${id}`);
  return res.data;
}

export async function createThread(payload: { title?: string | null; body_md: string; place_id?: number | null; category_ids?: number[]; tags?: string[] }) {
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

export async function updateThread(id: number, payload: { title?: string | null; body_md?: string }) {
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

export async function fetchMapPoints(bbox: { north: number; south: number; east: number; west: number }) {
  const res = await api.get("/geo-places/map-points", { params: bbox });
  return res.data as { id: number; lat: number; lng: number; is_offtop: boolean; comments: number; has_photo: boolean; cover_url?: string | null }[];
}

export async function createGeoPlace(p: { name: string; latitude: number; longitude: number; address?: string | null; district?: string | null; street?: string | null }) {
  const res = await api.post("/geo-places", { ...p, yandex_kind: "self" });
  return res.data as GeoPlaceV5;
}

export async function uploadThreadPhoto(threadId: number, file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post(`/threads/${threadId}/photos`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data as { id: number; url: string };
}
