"""Городские данные: единый реестр провайдеров.

- nominatim: OpenStreetMap, бесплатно, без ключа (геокодинг + реверс).
- yandex_geocoder: HTTP Геокодер Яндекса, нужен YANDEX_GEOCODER_KEY.
- mosru_opendata: портал открытых данных data.mos.ru — STUB: нужен ключ и согласование
  набора данных (например, дорожные работы, благоустройство). Интерфейс готов,
  реализация — после получения доступа.
"""
import urllib.parse
import urllib.request
import json as _json
import threading as _threading
import time as _time

from app.core.config import settings

UA = {"User-Agent": "zakoulki-app/1.0"}

# Nominatim: лимит 1 req/s с IP. Кэш + троттлинг, иначе 429 при
# параллельных подсказках (ScopePicker шлёт city+district+region разом).
_NOMINATIM_MIN_INTERVAL = 1.2
_NOMINATIM_CACHE_TTL = 3600.0
_nominatim_lock = _threading.Lock()
_nominatim_last_call = 0.0
_nominatim_cache: dict = {}


class _NominatimBusy(Exception):
    """Сеть уже занята другим запросом — fallback пропускаем, не копим очередь."""


def _nominatim_get(url: str, cache_key: tuple):
    """GET с кэшем и троттлингом. При 429/ошибке/занятости — исключение наружу,
    вызывающий отдаёт локальные данные. Очередь НЕ копим: иначе запросы держат
    DB-коннекты пула и кладут весь бэкенд (502)."""
    now = _time.monotonic()
    hit = _nominatim_cache.get(cache_key)
    if hit and now - hit[1] < _NOMINATIM_CACHE_TTL:
        return hit[0]
    global _nominatim_last_call
    if not _nominatim_lock.acquire(blocking=False):
        raise _NominatimBusy()
    try:
        # перепроверка кэша: пока ждали, другой поток мог уже сходить
        now = _time.monotonic()
        hit = _nominatim_cache.get(cache_key)
        if hit and now - hit[1] < _NOMINATIM_CACHE_TTL:
            return hit[0]
        wait = _NOMINATIM_MIN_INTERVAL - (now - _nominatim_last_call)
        if wait > 0:
            _time.sleep(wait)
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=5) as r:
            data = _json.load(r)
        _nominatim_last_call = _time.monotonic()
        _nominatim_cache[cache_key] = (data, _nominatim_last_call)
        # чистим старые записи, чтобы не рос бесконечно
        if len(_nominatim_cache) > 500:
            cutoff = _nominatim_last_call - _NOMINATIM_CACHE_TTL
            for k in [k for k, (_, ts) in _nominatim_cache.items() if ts < cutoff]:
                _nominatim_cache.pop(k, None)
        return data
    finally:
        _nominatim_lock.release()


def _nominatim_kind(item: dict) -> str | None:
    """Уровень объекта по addresstype/type Nominatim -> наш уровень."""
    t = (item.get("addresstype") or item.get("type") or "").lower()
    if t in ("state", "province"):
        return "region"
    if t in ("county",):
        return "district"
    if t in ("city", "town", "village", "hamlet", "municipality", "borough", "locality"):
        return "city"
    if t in ("country",):
        return "country"
    if t in ("suburb", "neighbourhood", "district", "quarter"):
        return "district"
    return None


def nominatim_search(q: str, limit: int = 5) -> list[dict]:
    params = urllib.parse.urlencode({
        "q": q, "format": "json", "limit": limit,
        "accept-language": "ru", "countrycodes": "ru",
    })
    data = _nominatim_get(f"https://nominatim.openstreetmap.org/search?{params}",
                          ("search", q.strip().lower(), limit))
    out = []
    for item in data:
        addr = item.get("address", {}) or {}
        out.append({
            "name": item.get("display_name", q).split(",")[0],
            "address": item.get("display_name"),
            "district": addr.get("suburb") or addr.get("district") or addr.get("borough"),
            "street": addr.get("road"),
            "city": addr.get("city") or addr.get("town") or addr.get("village") or addr.get("municipality"),
            "region": addr.get("state"),
            "country": addr.get("country"),
            "kind": _nominatim_kind(item),
            "lat": float(item.get("lat", 0)), "lng": float(item.get("lon", 0)),
        })
    return out


def nominatim_reverse(lat: float, lng: float) -> dict | None:
    params = urllib.parse.urlencode({"lat": lat, "lon": lng, "format": "json", "accept-language": "ru"})
    data = _nominatim_get(f"https://nominatim.openstreetmap.org/reverse?{params}",
                          ("reverse", round(lat, 4), round(lng, 4)))
    addr = data.get("address", {})
    disp = data.get("display_name", "")
    city = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("municipality")
    return {
        "name": addr.get("road", addr.get("suburb", city or (disp.split(",")[0] if disp else "Точка на карте"))),
        "address": disp or None,
        "district": addr.get("suburb") or addr.get("district") or addr.get("borough"),
        "street": addr.get("road"),
        "city": city,
        "region": addr.get("state"),
        "country": addr.get("country"),
        "lat": lat, "lng": lng,
    }


def yandex_search(q: str, limit: int = 5) -> list[dict]:
    key = settings.YANDEX_GEOCODER_KEY
    if not key:
        return []
    params = urllib.parse.urlencode({"apikey": key, "geocode": q, "format": "json", "results": limit, "lang": "ru_RU"})
    with urllib.request.urlopen(f"https://geocode-maps.yandex.ru/v1/?{params}", timeout=5) as r:
        data = _json.load(r)
    out = []
    for f in data.get("response", {}).get("GeoObjectCollection", {}).get("featureMember", []):
        g = f.get("GeoObject", {})
        pos = g.get("Point", {}).get("pos", "").split()
        if len(pos) != 2:
            continue
        meta = g.get("metaDataProperty", {}).get("GeocoderMetaData", {})
        out.append({
            "name": g.get("name", q),
            "address": meta.get("text"),
            "district": None, "street": None,
            "lat": float(pos[1]), "lng": float(pos[0]),
        })
    return out


def mosru_datasets() -> list[dict]:
    """STUB: витрина открытых данных data.mos.ru. Требует ключ и выбор наборов."""
    return []


PROVIDERS = [
    {"id": "own", "name": "Своя база", "kind": "places", "status": "live",
     "desc": "Места и организации, добавленные пользователями"},
    {"id": "nominatim", "name": "OpenStreetMap Nominatim", "kind": "geocoder", "status": "live",
     "desc": "Адреса и реверс-геокодинг, бесплатно, без ключа"},
    {"id": "yandex_geocoder", "name": "Яндекс Геокодер", "kind": "geocoder",
     "status": "live" if settings.YANDEX_GEOCODER_KEY else "needs_key",
     "desc": "Адресный поиск по России"},
    {"id": "yandex_maps", "name": "Яндекс.Карты", "kind": "map", "status": "live",
     "desc": "Картографическая подложка"},
    {"id": "mosru_opendata", "name": "data.mos.ru", "kind": "datasets", "status": "planned",
     "desc": "Городские наборы данных (работы, благоустройство) — требуется доступ"},
]
