"""Alternatif uygulama simgelerini üretir: assets/icon_<ad>/ altında varsayılan setle aynı dosyalar.

Kullanım:  python scripts/generate-app-icons.py            (tümü)
           python scripts/generate-app-icons.py flat        (yalnız biri)
Gereken:   Pillow + numpy

Simge seti (5 Kas 2026): üç Lens + üç S.
  Lens: default (varsayılan, düz), lens3d (kabarık 3B), lensglass (iOS 26 tarzı cam) — üretilir.
  S:    classic (eski 3B "S", elle çizilmiş özgün set), glass (elle çizilmiş cam S) — ÜRETİLMEZ;
        flat (düz 2B: classic'in silüeti, düz renkler, gölge/ışık yok) — üretilir.
30 Eki'de eklenen S renk temaları (gold, midnight, sunset, aurora, cinema, light) 5 Kas'ta kaldırıldı.

Arka plan çapraz gradyandır (sol alt koyu → sağ üst açık) + işaretin arkasında yumuşak ışık; düz
sürümde tek renk. icon.png = arka plan + ön plan (varsayılan sette de birebir böyle). Yeni simge =
THEMES'e satır + utils/appIcons.js, components/appLogoSources.js, app.json plugin listesi,
AppIconRes.kt ve çeviriler.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

from lens_icon_styles import draw_lens_3d, draw_lens_glass

ROOT = Path(__file__).resolve().parent.parent
SRC_FG = ROOT / "assets" / "icon_classic" / "android-icon-foreground.png"
SIZE = 1024


def hexrgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=float)


# draw: işareti nasıl çizileceği (lens / lens3d / lensglass / flat).
# bg: [sol alt, orta, sağ üst]; glow / glow2: işaretin arkasındaki ışık (renk, güç[, (x, y)]).
THEMES = {
    "default": {
        # Varsayılan simge: Lens işareti (marketing/marka/yeni-logo): iki daire, kesişimleri göz.
        # Mürekkep zemin; üst dairenin arkasında camgöbeği, altınkinde kırmızı hafif ışık.
        "draw": "lens",
        "bg": ["#06070c", "#10121b", "#23263a"], "glow": ("#14c8e8", 0.24, (0.5, 0.30)),
        "glow2": ("#ff3d5e", 0.22, (0.5, 0.70)),
    },
    # Lens'in hacimli sürümleri (scripts/lens_icon_styles.py).
    "lens3d": {
        "draw": "lens3d",
        "bg": ["#070812", "#141729", "#2a2f4d"], "glow": ("#14c8e8", 0.18, (0.5, 0.30)),
        "glow2": ("#ff3d5e", 0.16, (0.5, 0.72)),
    },
    "lensglass": {
        # iOS 26 simgeleri gibi yarı saydam cam katmanlar. Zemin varsayılan Lens'le AYNI koyu
        # mürekkep + ışıklar (6 Kas, kullanıcı isteği; eski açık buzlu zemin bırakıldı).
        "draw": "lensglass",
        "bg": ["#06070c", "#10121b", "#23263a"], "glow": ("#14c8e8", 0.24, (0.5, 0.30)),
        "glow2": ("#ff3d5e", 0.22, (0.5, 0.70)),
    },
    # Düz 2B S: klasik S'nin silüeti, tek renk dolgu, tek renk zemin; gölge, ışık, gradyan yok.
    "flat": {
        "draw": "flat",
        "bg": ["#6d4aff", "#6d4aff", "#6d4aff"], "glow": None,
        "fill": "#ffffff",
    },
}

# Lens işareti (512 birimlik tasarım ızgarası): daire r, merkezler arası d, göz bebeği, parıltı.
LENS = {"r": 132, "d": 120, "pupil": 40, "glint": 9.6, "glint_off": 15,
        "cyan": "#14c8e8", "red": "#ff3d5e", "ink": "#0d0e13", "paper": "#f5f2eb"}
LENS_HEIGHT = 460  # işaretin 1024'lük tuvaldeki boyu; uyarlanabilir simgenin güvenli çemberinde kalır
LENS_STYLE = {k: v for k, v in LENS.items()}  # lens_icon_styles için aynı ölçü ve renkler


def draw_lens(mono=False):
    """Lens işaretini 4 kat büyük çizip küçültür (kenar yumuşatma). mono: beyaz siluet, göz oyuk."""
    k = 4
    big = SIZE * k
    u = LENS_HEIGHT * k / (2 * LENS["r"] + LENS["d"])  # tasarım birimi → piksel
    cx = cy = big / 2
    r, half = LENS["r"] * u, LENS["d"] / 2 * u

    def disc(x, y, rad):
        m = Image.new("L", (big, big), 0)
        ImageDraw.Draw(m).ellipse((x - rad, y - rad, x + rad, y + rad), fill=255)
        return m

    top, bottom = disc(cx, cy - half, r), disc(cx, cy + half, r)
    eye = ImageChops.multiply(top, bottom)
    pupil = disc(cx, cy, LENS["pupil"] * u)
    g = LENS["glint_off"] * u
    glint = disc(cx + g, cy - g, LENS["glint"] * u)
    if mono:
        a = ImageChops.lighter(ImageChops.subtract(ImageChops.lighter(top, bottom), eye), pupil)
        a = ImageChops.subtract(a, glint)
        img = Image.new("RGBA", (big, big), (255, 255, 255, 0))
        img.putalpha(a)
    else:
        img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
        for mask, col in ((top, "cyan"), (bottom, "red"), (eye, "ink"), (pupil, "paper"), (glint, "ink")):
            img.paste(Image.new("RGBA", (big, big), tuple(hexrgb(LENS[col]).astype(int)) + (255,)), (0, 0), mask)
    return img.resize((SIZE, SIZE), Image.LANCZOS)


def crisp_silhouette(alpha):
    """3B S'nin alfa kanalından keskin kenarlı düz silüet (4 kat büyütüp eşikle, küçült)."""
    k = 4
    big = alpha.resize((SIZE * k, SIZE * k), Image.BICUBIC).filter(ImageFilter.GaussianBlur(3))
    big = big.point(lambda v: 255 if v >= 128 else 0)
    return big.resize((SIZE, SIZE), Image.LANCZOS)


def draw_flat(theme):
    """Düz 2B S: (ön plan, tek renk beyaz siluet)."""
    a = crisp_silhouette(Image.open(SRC_FG).convert("RGBA").getchannel("A"))
    fg = Image.new("RGBA", (SIZE, SIZE), tuple(hexrgb(theme["fill"]).astype(int)) + (0,))
    fg.putalpha(a)
    mono = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 0))
    mono.putalpha(a)
    return fg, mono


def gradient_map(lum, stops):
    cols = np.stack([hexrgb(c) for c in stops])
    pos = np.linspace(0, 1, len(stops))
    out = np.empty(lum.shape + (3,))
    for ch in range(3):
        out[..., ch] = np.interp(lum, pos, cols[:, ch])
    return out


def recolor(fg, theme):
    if theme["stops"] is None:
        return fg.copy()
    arr = np.asarray(fg).astype(float)
    rgb, alpha = arr[..., :3], arr[..., 3]
    lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    mask = alpha > 128
    lo, hi = np.percentile(lum[mask], [2, 99.5])
    norm = np.clip((lum - lo) / (hi - lo), 0, 1)
    out = gradient_map(norm, theme["stops"])
    top, bottom = (hexrgb(c) for c in theme["tint"])
    ys = np.where(mask)[0]
    t = np.clip((np.arange(SIZE)[:, None] - ys.min()) / max(1, ys.max() - ys.min()), 0, 1)[..., None]
    tint = top * (1 - t) + bottom * t
    # Ton katmanı orta tonlarda en güçlü, parlak ve koyu uçlarda zayıf (parlama bozulmasın).
    w = theme["tint_mix"] * (1 - np.abs(norm - 0.5) * 2)[..., None]
    out = out * (1 - w) + (out * tint / 255.0 * 1.35) * w
    res = np.dstack([np.clip(out, 0, 255), alpha]).astype(np.uint8)
    return Image.fromarray(res, "RGBA")


def background(theme):
    bl, mid, tr = (hexrgb(c) for c in theme["bg"])
    y, x = np.mgrid[0:SIZE, 0:SIZE] / (SIZE - 1)
    d = (x + (1 - y)) / 2  # 0 sol alt → 1 sağ üst
    t1 = np.clip(d / 0.5, 0, 1)[..., None]
    t2 = np.clip((d - 0.5) / 0.5, 0, 1)[..., None]
    lower = bl * (1 - t1) + mid * t1
    upper = mid * (1 - t2) + tr * t2
    img = np.where((d < 0.5)[..., None], lower, upper)
    # Işık: (renk, güç[, (x, y) merkez]); glow2 isteğe bağlı ikinci ışık.
    for glow in (theme["glow"], theme.get("glow2")):
        if not glow:
            continue
        gcol, gpow = hexrgb(glow[0]), glow[1]
        gx, gy = glow[2] if len(glow) > 2 else (0.5, 0.5)
        r = np.sqrt((x - gx) ** 2 + (y - gy) ** 2)
        g = np.clip(1 - r / 0.42, 0, 1) ** 2 * gpow
        img = img * (1 - g[..., None]) + gcol * g[..., None]
    a = np.full((SIZE, SIZE, 1), 255.0)
    return Image.fromarray(np.dstack([np.clip(img, 0, 255), a]).astype(np.uint8), "RGBA")


def soft_shadow(fg, strength):
    """Açık zemin için S'nin altına yumuşak gölge (koyu zeminde gerekmez)."""
    a = np.asarray(fg)[..., 3]
    sh = Image.fromarray((a * strength).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(28))
    layer = Image.new("RGBA", fg.size, (20, 16, 60, 0))
    layer.putalpha(sh)
    out = Image.new("RGBA", fg.size, (0, 0, 0, 0))
    out.alpha_composite(layer, (0, 18))
    out.alpha_composite(fg)
    return out


def build(name, theme):
    out_dir = ROOT / "assets" / f"icon_{name}"
    out_dir.mkdir(exist_ok=True)
    bg = background(theme)
    if theme.get("draw") == "lens":
        fg, mono = draw_lens(), draw_lens(mono=True)
    elif theme.get("draw") == "lens3d":
        fg, mono = draw_lens_3d(SIZE, LENS_HEIGHT, LENS_STYLE), draw_lens(mono=True)
    elif theme.get("draw") == "lensglass":
        # Cam arka planı kırarak gösterir: zemini görmesi gerekir.
        fg, mono = draw_lens_glass(SIZE, LENS_HEIGHT, LENS_STYLE, bg), draw_lens(mono=True)
    elif theme.get("draw") == "flat":
        fg, mono = draw_flat(theme)
    else:
        src = Image.open(SRC_FG).convert("RGBA")
        fg = recolor(src, theme)
        if theme.get("shadow"):
            fg = soft_shadow(fg, theme["shadow"])
        # Android 13+ temalı simge yalnız alfa kanalını kullanır: beyaz siluet.
        mono = Image.new("RGBA", src.size, (255, 255, 255, 0))
        mono.putalpha(src.getchannel("A"))
    icon = Image.alpha_composite(bg, fg)
    fg.save(out_dir / "android-icon-foreground.png", optimize=True)
    bg.save(out_dir / "android-icon-background.png", optimize=True)
    mono.save(out_dir / "android-icon-monochrome.png", optimize=True)
    icon.save(out_dir / "icon.png", optimize=True)
    icon.resize((48, 48), Image.LANCZOS).save(out_dir / "favicon.png", optimize=True)
    # Android bildirim simgesi yalnız alfa kanalını kullanır. Lens'in renkli ön planının alfası
    # göz oyuğunu kaybeder (iki dolu daire kalır) → Lens sürümlerinde göz oyuk tek renk siluet.
    note = mono if theme.get("draw") else fg
    note.resize((96, 96), Image.LANCZOS).save(out_dir / "notification-icon.png", optimize=True)
    print("✓", out_dir.relative_to(ROOT))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    names = sys.argv[1:] or list(THEMES)
    for n in names:
        build(n, THEMES[n])
