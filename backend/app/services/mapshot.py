"""Статичное превью места: OSM-тайлы + полигон + метка, PNG 1256x288.
Показ: 628x144 (карточка треда / страница треда, object-cover) — файл в x2,
чтобы не было мыла от апскейла. Мобайл даунскейлит, ему тоже хватает.
Генерируется ОДИН раз при создании места (BackgroundTasks), отдается статикой —
никаких запросов к API на просмотр.
"""
import math
import os
import urllib.request

from PIL import Image, ImageDraw

UA = {"User-Agent": "zakoulki-app/1.0"}
W, H = 1256, 288
MIN_Z, MAX_Z = 10, 18
TILE = 256


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
    """Центр (lat,lng) и зум по размеру полигона. Без полигона — точка, Z=16."""
    if not area or len(area) < 3:
        return None, None, 16
    lats = [float(p[0]) for p in area if len(p) >= 2]
    lngs = [float(p[1]) for p in area if len(p) >= 2]
    if not lats:
        return None, None, 16
    clat = (min(lats) + max(lats)) / 2
    clng = (min(lngs) + max(lngs)) / 2
    span = max(max(lats) - min(lats), max(lngs) - min(lngs))
    # span=0.02 (~2км) -> Z=15, span вдвое меньше -> +1 зум
    z = int(round(15 - math.log2(max(span, 0.0002) / 0.02)))
    return clat, clng, max(MIN_Z, min(MAX_Z, z))


def _label_font(size: int):
    try:
        from PIL import ImageFont
        for path in (
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
        ):
            if os.path.exists(path):
                return ImageFont.truetype(path, size)
    except Exception:
        pass
    return None


def render_preview(lat: float, lng: float, out_path: str, area: list | None = None) -> bool:
    """True если получилось с тайлами, False если заглушка (тоже пишется)."""
    clat, clng, Z = _pick_zoom(area)
    if clat is not None and clng is not None:
        lat, lng = clat, clng
    to_px = None
    try:
        # +3 тайла запаса: кроп W/2 от центра обязан лежать внутри холста
        # при любом дробном остатке тайловых координат
        nx, ny = W // TILE + 3, H // TILE + 3
        xt, yt = _tile_xy(lat, lng, Z)
        x0, y0 = math.floor(xt) - nx // 2, math.floor(yt) - ny // 2
        canvas = Image.new("RGB", (TILE * nx, TILE * ny), (238, 238, 238))
        for dx in range(nx):
            for dy in range(ny):
                try:
                    tile = _fetch_tile(x0 + dx, y0 + dy, Z)
                except Exception:
                    tile = Image.new("RGB", (TILE, TILE), (238, 238, 238))
                canvas.paste(tile, (dx * TILE, dy * TILE))
        cx = int((xt - x0) * TILE)
        cy = int((yt - y0) * TILE)

        # ВАЖНО: смещения фиксируем в ox/oy — ниже cx/cy переиспользуются
        # под центр холста, замыкание обязано читать неизменные значения
        ox, oy = cx - W // 2, cy - H // 2

        def to_px(la: float, ln: float) -> tuple[int, int]:
            px, py = _tile_xy(la, ln, Z)
            return int((px - x0) * TILE - ox), int((py - y0) * TILE - oy)

        canvas = canvas.crop((ox, oy, ox + W, oy + H))
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
                # белая подложка-окантовка: полигон виден на любом фоне
                # (зелёный по зелёному парку иначе не читается)
                d.polygon(pts, fill=(5, 150, 105, 130))
                d.line(pts + [pts[0]], fill=(255, 255, 255, 230), width=9, joint="curve")
                d.line(pts + [pts[0]], fill=(4, 120, 87, 255), width=4, joint="curve")
        except Exception:
            pass
    # метка-точка
    d.ellipse([cx - 40, cy - 40, cx + 40, cy + 40], fill=(163, 230, 53, 90))
    d.ellipse([cx - 18, cy - 18, cx + 18, cy + 18], fill=(5, 150, 105), outline=(255, 255, 255), width=5)
    # масштабная линейка: круглое расстояние ~140px
    if to_px:
        try:
            mpp = 156543.03 * math.cos(math.radians(lat)) / (2 ** Z)
            target_m = 140 * mpp
            best, best_d = 100, abs(100 - target_m)
            for cand in (100, 200, 500, 1000, 2000, 5000, 10000):
                dd = abs(cand - target_m)
                if dd < best_d:
                    best, best_d = cand, dd
            length = int(best / mpp)
            y = H - 26
            bar, tick, txt = (15, 23, 42, 220), (15, 23, 42, 220), (15, 23, 42, 255)
            d.line([(16, y), (16 + length, y)], fill=bar, width=4)
            d.line([(16, y - 9), (16, y + 9)], fill=tick, width=4)
            d.line([(16 + length, y - 9), (16 + length, y + 9)], fill=tick, width=4)
            label = f"{best // 1000} км" if best >= 1000 else f"{best} м"
            font = _label_font(26)
            if font:
                d.text((16 + length + 10, y - 20), label, fill=txt, font=font)
        except Exception:
            pass
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    canvas.save(out_path, "PNG")
    return True


def preview_name(place_id: int) -> str:
    return f"map_{place_id}.png"
