"""Lens simgesinin hacimli çizimleri: generate-app-icons.py tarafından kullanılır.

  draw_lens_3d()    → kil/plastik gibi kabarık iki disk, gözü oyuk, göz bebeği parlak küre
  draw_lens_glass() → iOS 26 simgeleri gibi yarı saydam cam katmanlar, ince parlak kenar

İkisi de saydam zeminli 1024'lük ön plan döndürür (arka plan generate-app-icons.py'de).
Hepsi 2 kat çözünürlükte hesaplanıp küçültülür; ışık sol üstten gelir.
"""
import numpy as np
from PIL import Image, ImageFilter

K = 2  # süper örnekleme


def _hex(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32) / 255.0


def _norm(v):
    v = np.asarray(v, dtype=np.float32)
    return v / np.linalg.norm(v)


class _Canvas:
    """Düz (premultiplied olmayan) RGBA tuval ve "üstüne koy" işlemi."""

    def __init__(self, n):
        self.rgb = np.zeros((n, n, 3), np.float32)
        self.a = np.zeros((n, n), np.float32)

    def over(self, rgb, a):
        a = np.clip(a, 0, 1)
        na = a + self.a * (1 - a)
        safe = np.maximum(na, 1e-6)[..., None]
        self.rgb = (rgb * a[..., None] + self.rgb * (self.a * (1 - a))[..., None]) / safe
        self.a = na

    def image(self, size):
        arr = np.dstack([np.clip(self.rgb, 0, 1), np.clip(self.a, 0, 1)])
        return Image.fromarray((arr * 255 + 0.5).astype(np.uint8), "RGBA").resize((size, size), Image.LANCZOS)


def _geom(size, height, lens):
    n = size * K
    u = height * K / (2 * lens["r"] + lens["d"])
    c = n / 2
    y, x = np.mgrid[0:n, 0:n].astype(np.float32) + 0.5
    g = {"n": n, "u": u, "c": c, "x": x, "y": y, "r": lens["r"] * u,
         "c1": c - lens["d"] / 2 * u, "c2": c + lens["d"] / 2 * u}
    for i, cy in (("1", g["c1"]), ("2", g["c2"])):
        dx, dy = x - c, y - cy
        d = np.sqrt(dx * dx + dy * dy)
        g["d" + i] = d
        g["s" + i] = g["r"] - d                       # içeride pozitif (piksel)
        g["dir" + i] = (dx / np.maximum(d, 1e-3), dy / np.maximum(d, 1e-3))
    return g


def _cov(s, aa=1.2 * K):
    return np.clip(s / aa + 0.5, 0, 1)


def _blur(a, radius):
    img = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(radius))
    return np.asarray(img, np.float32) / 255.0


def _shift(a, dx, dy):
    out = np.zeros_like(a)
    h, w = a.shape
    out[max(0, dy):h + min(0, dy), max(0, dx):w + min(0, dx)] = a[max(0, -dy):h - max(0, dy), max(0, -dx):w - max(0, dx)]
    return out


LIGHT = _norm([-0.45, -0.7, 0.55])
HALF = _norm(LIGHT + np.array([0, 0, 1], np.float32))


def _shade(nx, ny, nz, base, amb=0.36, dif=0.78, spec=0.55, shin=48):
    ndl = np.clip(nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2], 0, 1)
    ndh = np.clip(nx * HALF[0] + ny * HALF[1] + nz * HALF[2], 0, 1)
    col = base * (amb + dif * ndl)[..., None] + (spec * ndh ** shin)[..., None]
    return col


def _dome_normal(d, rad, dirx, diry, thick=0.42, p=3.2):
    """Ortası düz, kenarı yuvarlak kubbe: z = (1 - q^p)^0.5. Eğim → normal."""
    q = np.clip(d / rad, 0, 0.9995)
    dzdq = -(p * q ** (p - 1)) / (2 * np.sqrt(1 - q ** p))
    gmag = -dzdq * thick
    nz = 1 / np.sqrt(1 + gmag ** 2)
    return dirx * gmag * nz, diry * gmag * nz, nz


def draw_lens_3d(size, height, lens):
    g = _geom(size, height, lens)
    cv = _Canvas(g["n"])
    r, u = g["r"], g["u"]
    c1, c2 = _cov(g["s1"]), _cov(g["s2"])
    union = np.maximum(c1, c2)
    eye = np.minimum(c1, c2)

    # Gölge: birleşik şekil aşağıya düşer.
    sh = _blur(_shift(union, 0, int(0.10 * r)), 0.09 * r)
    cv.over(np.broadcast_to(_hex("#05060c"), cv.rgb.shape), sh * 0.55)

    # İki kabarık disk (alttaki önce): kendi kubbe normalleriyle.
    for i, col in (("1", lens["cyan"]), ("2", lens["red"])):
        nx, ny, nz = _dome_normal(g["d" + i], r, *g["dir" + i])
        base = _hex(col) * (1.06 - 0.10 * ((g["y"] - (g["c1"] if i == "1" else g["c2"])) / r))[..., None]
        rgb = _shade(nx, ny, nz, base, amb=0.44, dif=0.68)
        # Alt kenarda zeminden yansıyan yumuşak ışık (kil/plastik hissi).
        rim = (1 - nz) ** 2 * np.clip(ny, 0, 1)
        rgb = rgb + (np.minimum(base * 1.35, 1) * (0.35 * rim)[..., None])
        cv.over(rgb, _cov(g["s" + i]))

    # Göz: oyuk. Üst duvar (alt diskin kenarı) aşağı bakar → karanlık; alt duvar yukarı bakar → aydınlık.
    se = np.minimum(g["s1"], g["s2"])
    wall = 0.16 * r
    t = np.clip(1 - se / wall, 0, 1)                   # 1 kenarda, 0 duvar dibinde
    near1 = g["s1"] < g["s2"]                          # alt kenar (üst diskin sınırı)
    inx = np.where(near1, -g["dir1"][0], -g["dir2"][0])  # göz içine doğru
    iny = np.where(near1, -g["dir1"][1], -g["dir2"][1])
    tilt = t * 0.85
    nz = np.sqrt(1 - tilt ** 2)
    floor = _hex(lens["ink"]) * 1.25
    rgb = _shade(inx * tilt, iny * tilt, nz, floor, amb=0.55, dif=0.55, spec=0.10, shin=20)
    # Duvarın dibinde temas gölgesi.
    rgb *= (1 - 0.35 * np.clip(1 - np.abs(se - wall) / (0.5 * wall), 0, 1))[..., None]
    cv.over(rgb, eye)

    # Göz bebeği: parlak küre, oyuğa düşen gölgesiyle.
    rp = lens["pupil"] * u
    dx, dy = g["x"] - g["c"], g["y"] - g["c"]
    dp = np.sqrt(dx * dx + dy * dy)
    psh = _blur(_shift(_cov(rp - dp), int(0.10 * rp), int(0.22 * rp)), 0.18 * rp) * eye
    cv.over(np.broadcast_to(_hex("#000000"), cv.rgb.shape), psh * 0.55)
    q = np.clip(dp / rp, 0, 0.999)
    nzp = np.sqrt(1 - q ** 2)
    rgb = _shade(dx / rp, dy / rp, nzp, _hex(lens["paper"]), amb=0.42, dif=0.70, spec=0.85, shin=70)
    cv.over(rgb, _cov(rp - dp))
    # Parıltı noktası: küçük koyu, cam gibi parlak bilye.
    go = lens["glint_off"] * u
    rg = lens["glint"] * u * 1.1
    gx, gy = g["x"] - (g["c"] + go), g["y"] - (g["c"] - go)
    dg = np.sqrt(gx * gx + gy * gy)
    qg = np.clip(dg / rg, 0, 0.999)
    rgb = _shade(gx / rg, gy / rg, np.sqrt(1 - qg ** 2), _hex(lens["ink"]) * 1.3, amb=0.6, dif=0.4, spec=0.9, shin=40)
    cv.over(rgb, _cov(rg - dg))
    return cv.image(size)


def _sample(img, xs, ys):
    """Çift doğrusal örnekleme (kırılma için arka planı kaydırarak okur)."""
    h, w = img.shape[:2]
    xs = np.clip(xs - 0.5, 0, w - 1.001)
    ys = np.clip(ys - 0.5, 0, h - 1.001)
    x0, y0 = xs.astype(np.int32), ys.astype(np.int32)
    fx, fy = (xs - x0)[..., None], (ys - y0)[..., None]
    a, b = img[y0, x0], img[y0, x0 + 1]
    c, d = img[y0 + 1, x0], img[y0 + 1, x0 + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def _band(s, at, width):
    """Kenara paralel ince şerit (s: kenardan içeri piksel)."""
    return np.exp(-((s - at) / width) ** 2)


def draw_lens_glass(size, height, lens, bg):
    """iOS 26 "Liquid Glass" gibi kalın cam: arka planı büyüterek kırar, rengini süzer,
    kenarda ortamı yansıtır (Fresnel), sol üstte keskin parlama, zemine renkli ışık düşürür.
    bg: arka plan katmanı (PIL, 1024); kırılma onu örnekler, bu yüzden ön plana gömülür."""
    g = _geom(size, height, lens)
    n, r, u = g["n"], g["r"], g["u"]
    x, y = g["x"], g["y"]
    cv = _Canvas(n)
    white = np.ones(3, np.float32)
    B = np.asarray(bg.convert("RGB").resize((n, n), Image.BICUBIC), np.float32) / 255.0
    frost = np.asarray(bg.convert("RGB").resize((n, n), Image.BICUBIC).filter(ImageFilter.GaussianBlur(0.08 * r)), np.float32) / 255.0
    # Koyu zeminde cam karanlığı kırar, renk solar: zemin koyulaştıkça camın kendi rengi artar
    # (açık zeminde 0,22 — eski görünüm aynen kalır).
    lum = float((B @ np.array([0.2126, 0.7152, 0.0722], np.float32)).mean())
    dark = float(np.clip((0.45 - lum) / 0.45, 0, 1))
    lift = 0.22 + 0.40 * dark
    c1, c2 = _cov(g["s1"]), _cov(g["s2"])
    union = np.maximum(c1, c2)
    eye = np.minimum(c1, c2)
    cols = {"1": _hex(lens["cyan"]), "2": _hex(lens["red"])}
    full = lambda col: np.broadcast_to(col, cv.rgb.shape)

    # 1) Zemin: yumuşak gölge, camdan geçen renkli ışık ve odaklanmış parlak hilal (kostik).
    # Cam ışığı geçirir: gölgesi hafif, asıl iz renkli ışıktır.
    cv.over(full(_hex("#1b2142")), _blur(_shift(union, 0, int(0.09 * r)), 0.11 * r) * 0.15)
    for i in ("1", "2"):
        cy = g["c1"] if i == "1" else g["c2"]
        tint = _blur(_shift(_cov(g["s" + i]), 0, int(0.20 * r)), 0.13 * r) * (1 - union)
        cv.over(full(np.minimum(cols[i] * 1.15, 1)), tint * 0.46)
        fx, fy = x - g["c"], y - (cy + 0.55 * r)
        focus = _cov(0.42 * r - np.sqrt((fx / 1.35) ** 2 + fy ** 2))
        focus = _blur(focus, 0.07 * r) * (1 - union)
        cv.over(full(np.minimum(cols[i] * 0.5 + 0.6, 1)), focus * 0.50)

    def body(i):
        s, (dx, dy), d = g["s" + i], g["dir" + i], g["d" + i]
        nx, ny, nz = _dome_normal(d, r, dx, dy, thick=0.62, p=2.4)
        # Kırılma: dışbükey cam merkeze doğru büyütür.
        k = 0.34 * r
        refr = _sample(frost, x - nx * k, y - ny * k)
        edge = 1 - nz
        # Ortada ince cam (açık, zemin görünür), kenarda ışık daha uzun yol alır (doygun).
        absorb = (0.30 + 0.62 * edge ** 0.6)[..., None]
        col = cols[i]
        # Koyu zeminde orta ince ve saydam kalır (zemin görünür), renk kalın kenarda toplanır.
        tint_amt = lift * (1 - 0.55 * dark * (1 - edge ** 0.8))[..., None]
        rgb = refr * (1 - absorb) + refr * col * absorb + col * tint_amt * absorb
        # Fresnel: kenarda ortam yansır. Açık zeminde üst gökyüzü beyaz, alt mavimsi; koyu zeminde
        # yansıyacak beyaz ortam yok: kenar beyaz halka yerine camın kendi koyu, doygun rengine döner.
        F = (0.05 + (0.95 - 0.60 * dark) * edge ** 3.5)[..., None]
        up = np.clip(ny * 0.5 + 0.5, 0, 1)[..., None]
        sky = white * (1 - dark) + np.minimum(col * 0.55 + 0.12, 1) * dark
        floor = _hex("#8790b8") * (1 - dark) + col * 0.22 * dark
        env = sky * (1 - up) + floor * up
        rgb = rgb * (1 - F) + env * F
        # Kenar kalınlığı: içte ince koyu halka, camın et payını gösterir.
        rgb *= (1 - (0.24 + 0.16 * dark) * _band(s, 0.045 * r, 0.016 * r))[..., None]
        rgb = rgb + (0.16 * (1 - dark) * _band(s, 0.085 * r, 0.02 * r))[..., None]
        # Kalın cam: koyu zeminde ışık kenarda camın içinde dolaşır, renk orada yoğunlaşır.
        rgb = rgb + (0.30 * dark * _band(s, 0.07 * r, 0.05 * r))[..., None] * col
        # Parlamalar: keskin (pencere yansıması) + geniş yumuşak.
        ndh = np.clip(nx * HALF[0] + ny * HALF[1] + nz * HALF[2], 0, 1)
        rgb = rgb + (0.85 * ndh ** 160 + 0.10 * ndh ** 14)[..., None]
        # Üstte yatay, yumuşak "pencere" parlaması.
        ex, ey = (x - (g["c"] - 0.12 * r)) / (0.60 * r), (y - (g["c" + i] - 0.52 * r)) / (0.24 * r)
        win = np.clip(1 - (ex * ex + ey * ey), 0, 1) ** 1.5 * _cov(s - 0.10 * r)
        rgb = rgb * (1 - 0.30 * win)[..., None] + white * (0.30 * win)[..., None]
        # İnce kenar ışığı: sol üstte beyaz, sağ altta camdan çıkan renkli ışık.
        tl = np.clip(-(dx * 0.55 + dy * 0.83), 0, 1)
        br = np.clip(dx * 0.55 + dy * 0.83, 0, 1)
        rim = _band(s, 1.6 * K, 1.1 * K + 0.006 * r)
        # Koyu zeminde beyaz çizgi yalnız ışığa bakan kısa yayda kalır (çevre boyu halka değil).
        tl_pow, tl_amp = 1.3 + 2.2 * dark, 0.95 - 0.10 * dark
        rgb = rgb + (rim * tl ** tl_pow * tl_amp)[..., None] + (rim * br ** 2 * (0.55 - 0.15 * dark))[..., None] * np.minimum(col * 0.6 + 0.5, 1)
        # İç kostik: ışık camın içinde sağ alta toplanır.
        glow = _band(s, 0.11 * r, 0.09 * r) * br ** 1.5
        rgb = rgb + (glow * 0.42)[..., None] * np.minimum(col * 0.55 + 0.55, 1)
        cv.over(np.clip(rgb, 0, 1), _cov(s))

    body("1")
    body("2")

    # 2) Göz: kesişimde dumanlı, koyu cam. Üst kenar duvarı gölgede, alt kenar ışık yakalar.
    se = np.minimum(g["s1"], g["s2"])
    near1 = g["s1"] < g["s2"]                              # alt kenar (üst diskin sınırı)
    k = 0.10 * r
    refr = _sample(frost, x, y - k)
    smoke = _hex("#0c0f1e")
    rgb = refr * 0.20 + smoke * 0.80
    vy = np.clip((y - g["c"]) / (0.5 * r), -1, 1)
    rgb = rgb * (1.0 + 0.45 * vy)[..., None]
    # Dumanlı camın üst yarısında hafif yansıma.
    ex, ey = (x - (g["c"] - 0.20 * r)) / (0.55 * r), (y - (g["c"] - 0.16 * r)) / (0.10 * r)
    rgb = rgb + (0.10 * np.clip(1 - (ex * ex + ey * ey), 0, 1) ** 1.5 * _cov(se - 0.03 * r))[..., None]
    wall = _band(se, 0.05 * r, 0.04 * r)
    rgb = rgb * (1 - 0.35 * wall * (~near1))[..., None]
    rgb = rgb + (_band(se, 1.4 * K, 1.0 * K + 0.004 * r) * np.where(near1, 0.65, 0.22) * (1 - 0.55 * dark))[..., None]
    cv.over(np.clip(rgb, 0, 1), eye)

    # 3) Göz bebeği: süt beyazı cam küre, oyuğa düşen gölgesi ve koyu parıltı bilyesi.
    rp = lens["pupil"] * u
    dx, dy = x - g["c"], y - g["c"]
    dp = np.sqrt(dx * dx + dy * dy)
    cv.over(full(_hex("#000000")), _blur(_shift(_cov(rp - dp), int(0.06 * rp), int(0.20 * rp)), 0.16 * rp) * 0.55 * eye)
    q = np.clip(dp / rp, 0, 0.999)
    nzp = np.sqrt(1 - q ** 2)
    pnx, pny = dx / rp, dy / rp
    milk = _hex(lens["paper"])
    rgb = milk * (0.78 + 0.26 * np.clip(pnx * LIGHT[0] + pny * LIGHT[1] + nzp * LIGHT[2], 0, 1))[..., None]
    Fp = (0.04 + 0.6 * (1 - nzp) ** 3)[..., None]
    rgb = rgb * (1 - Fp) + _hex("#9aa2c4") * Fp
    ndh = np.clip(pnx * HALF[0] + pny * HALF[1] + nzp * HALF[2], 0, 1)
    rgb = rgb + (0.9 * ndh ** 200)[..., None]
    cv.over(np.clip(rgb, 0, 1), _cov(rp - dp))
    go, rg = lens["glint_off"] * u, lens["glint"] * u * 1.1
    gx, gy = x - (g["c"] + go), y - (g["c"] - go)
    dg = np.sqrt(gx * gx + gy * gy)
    qg = np.clip(dg / rg, 0, 0.999)
    rgb = _shade(gx / rg, gy / rg, np.sqrt(1 - qg ** 2), _hex(lens["ink"]) * 1.3, amb=0.7, dif=0.3, spec=0.9, shin=60)
    cv.over(np.clip(rgb, 0, 1), _cov(rg - dg))
    return cv.image(size)
