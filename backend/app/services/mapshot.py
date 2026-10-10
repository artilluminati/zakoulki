"""Статичное превью места: OSM-тайлы + метка, PNG 400x250.
Генерируется ОДИН раз при создании места (BackgroundTasks), отдается статикой —
никаких запросов к API на просмотр.
"""
import math
import os
import urllib.request

from PIL import Image, ImageDraw

UA = {"User-Agent": "zakoulki-app/1.0"}
W, H = 400, 250
MIN_Z, MAX_Z = 10, 18


def _tile_xy(lat: float, lng: float, z: int) -> tuple[float, float]:
    n = 2 ** z
    xt = (lng + 180.0) / 360.0 * n
    lat_r = math.radians(lat)
    yt = (1.0 - math.log(math.tan(lat_r) + 1.0 / math.cos(lat_r)) / math.pi) / 2.0 * n
    return xt, yt


def _fetch_tile(x: int, y: int, z: int, timeout: int = 4):
    url = f"https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read()
    import io
    return Image.open(io.BytesIO(data)).convert("RGB")


def _pick_zoom(area: list | None) -> tuple[float | None, float | None, int]:
    """Центр (lat,lng) и зум по размеру полигона. Без полигона — точка, Z=15."""
    if not area or len(area) < 3:
        return None, None, 15
    lats = [float(p[0]) for p in area if len(p) >= 2]
    lngs = [float(p[1]) for p in area if len(p) >= 2]
    if not lats:
        return None, None, 15
    clat = (min(lats) + max(lats)) / 2
    clng = (min(lngs) + max(lngs)) / 2
    span = max(max(lats) - min(lats), max(lngs) - min(lngs))
    # span=0.0001 (~10м) → Z=18, span=0.1 (~10км) → Z=12
    z = int(round(15 - math.log2(max(span, 0.0001) / 0.005)))
    return clat, clng, max(MIN_Z, min(MAX_Z, z))


def render_preview(lat: float, lng: float, out_path: str, area: list | None = None) -> bool:
    """True если получилось с тайлами, False если заглушка (тоже пишется)."""
    clat, clng, Z = _pick_zoom(area)
    if clat is not None and clng is not None:
        lat, lng = clat, clng
    to_px = None
    try:
        xt, yt = _tile_xy(lat, lng, Z)
        x0, y0 = math.floor(xt) - 1, math.floor(yt) - 1
        canvas = Image.new("RGB", (256 * 3, 256 * 3), (238, 238, 238))
        for dx in range(3):
            for dy in range(3):
                try:
                    tile = _fetch_tile(x0 + dx, y0 + dy, Z)
                except Exception:
                    tile = Image.new("RGB", (256, 256), (238, 238, 238))
                canvas.paste(tile, (dx * 256, dy * 256))
        cx = int((xt - x0) * 256)
        cy = int((yt - y0) * 256)

        def to_px(la: float, ln: float) -> tuple[int, int]:
            px, py = _tile_xy(la, ln, Z)
            return int((px - x0) * 256 - (cx - W // 2)), int((py - y0) * 256 - (cy - H // 2))

        canvas = canvas.crop((cx - W // 2, cy - H // 2, cx + W // 2, cy + H // 2))
    except Exception:
        canvas = Image.new("RGB", (W, H), (226, 232, 240))
        cx, cy = W // 2, H // 2
        to_px = None
    d = ImageDraw.Draw(canvas, "RGBA")
    cx, cy = W // 2, H // 2
    if area and to_px:
        try:
            pts = [to_px(float(p[0]), float(p[1])) for p in area if len(p) >= 2]
            if len(pts) >= 3:
                d.polygon(pts, fill=(5, 150, 105, 110), outline=(5, 150, 105), width=4)
        except Exception:
            pass
    d.ellipse([cx - 18, cy - 18, cx + 18, cy + 18], fill=(163, 230, 53, 90))
    d.ellipse([cx - 9, cy - 9, cx + 9, cy + 9], fill=(5, 150, 105), outline=(255, 255, 255), width=3)
    # масштабная линейка (1 км на центре широты)
    if to_px:
        try:
            km_px = int(111.0 * math.cos(math.radians(lat)) / (2 ** Z) * 256)
            y = H - 14
            d.line([(8, y), (8 + km_px, y)], fill=(15, 23, 42), width=2)
            d.line([(8, y - 4), (8, y + 4)], fill=(15, 23, 42), width=2)
            d.line([(8 + km_px, y - 4), (8 + km_px, y + 4)], fill=(15, 23, 42), width=2)
        except Exception:
            pass
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    canvas.save(out_path, "PNG")
    return True


def preview_name(place_id: int) -> str:
    return f"map_{place_id}.png"
