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
Z = 15


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


def render_preview(lat: float, lng: float, out_path: str) -> bool:
    """True если получилось с тайлами, False если заглушка (тоже пишется)."""
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
        canvas = canvas.crop((cx - W // 2, cy - H // 2, cx + W // 2, cy + H // 2))
    except Exception:
        canvas = Image.new("RGB", (W, H), (226, 232, 240))
        cx, cy = W // 2, H // 2
    d = ImageDraw.Draw(canvas)
    cx, cy = W // 2, H // 2
    d.ellipse([cx - 26, cy - 26, cx + 26, cy + 26], fill=(163, 230, 53, 90))
    d.ellipse([cx - 13, cy - 13, cx + 13, cy + 13], fill=(5, 150, 105), outline=(255, 255, 255), width=3)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    canvas.save(out_path, "PNG")
    return True


def preview_name(place_id: int) -> str:
    return f"map_{place_id}.png"
