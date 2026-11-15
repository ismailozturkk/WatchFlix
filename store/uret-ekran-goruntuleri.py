# -*- coding: utf-8 -*-
# Mağaza telefon ekran görüntüleri (TR + EN), iki platform:
#   android → store/assets/screenshots/android/<dil>/  1080x1920, kamera deliği (Play)
#   ios     → store/assets/screenshots/ios/<dil>/      1290x2796, Dinamik Ada (App Store 6,9")
# Kaynak: store/raw-screenshots/ios-en/*.jpg (iPhone, 1206x2622). Çalıştır:
#   python store/uret-ekran-goruntuleri.py
#
# Tasarım: büyük harfli kalın başlık (Unbounded Black, ikinci satır marka geçişi), büyük ve
# alttan taşan telefon, ekrandan büyütülüp dışarı taşan "çıkıntı kartı". 01 ve 02 tek bir
# panoramadır: eğik telefon iki görselin sınırından geçer, mağazada yan yana bağlı görünür.
import os
import time
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RAW = os.path.join(ROOT, "store", "raw-screenshots", "ios-en")
OUT = os.path.join(ROOT, "store", "assets", "screenshots")
FONTS = os.path.join(ROOT, "store", "fonts")
F_BLACK = os.path.join(FONTS, "Unbounded_900Black.ttf")
F_SEMI = os.path.join(FONTS, "Unbounded_600SemiBold.ttf")

PLATFORMS = {
    "android": (1080, 1920, "hole"),
    "ios": (1290, 2796, "island"),
}
LANGS = ("tr-TR", "en-US")

# Ham ekranlar: durum çubuğu yüksekliği ya da (durum çubuğu, içerik sonu) — 1206x2622 piksel.
CROPS = {
    "01-kesif": 150, "02-film-detay": 150, "03-dizi-takip": 150, "04-bolum-grafigi": 150,
    "05-istatistik": (178, 1980), "06-kutuphane": 150, "07-oyun": 150, "08-rozetler": 150,
}

ACCENT = [(46, 230, 214), (19, 141, 240), (139, 124, 246)]   # marka geçişi
WHITE = (238, 244, 251)
MUTED = (150, 162, 180)

# Panorama (01 + 02)
HERO = {
    "tr-TR": (["FİLM VE DİZİ", "HAYATIN"], "TEK YERDE",
              ["İzleme geçmişi", "İnceleme ve puan", "Yorumlar", "Listeler", "Rozetler", "Arkadaşlarla paylaş"]),
    "en-US": (["YOUR MOVIE", "& TV LIFE"], "IN ONE PLACE",
              ["Watch history", "Reviews & ratings", "Comments", "Lists", "Badges", "Share with friends"]),
}

# Tekil görseller: (dosya, {dil: (beyaz satır, renkli satır)}, çıkıntı kartı kaynağı (x0,y0,x1,y1) ya da None,
#                   kartın dikey yeri (H oranı), telefon eğimi derece)
SINGLES = [
    ("03-dizi-takip", {"tr-TR": ("HER BÖLÜMÜ", "TAKİP ET"), "en-US": ("TRACK EVERY", "EPISODE")},
     (30, 1380, 1176, 1700), 0.66, 0),
    ("04-bolum-grafigi", {"tr-TR": ("DİZİNİN", "SEYRİNİ GÖR"), "en-US": ("SEE HOW A SHOW", "HELD UP")},
     (30, 680, 1180, 1060), 0.60, 0),
    ("05-istatistik", {"tr-TR": ("İZLEMELERİN", "RAKAMLARLA"), "en-US": ("YOUR WATCHING", "IN NUMBERS")},
     (40, 180, 1166, 380), 0.52, 0),
    ("06-kutuphane", {"tr-TR": ("KALDIĞIN YERİ", "UNUTMA"), "en-US": ("NEVER LOSE", "YOUR PLACE")},
     None, 0, -6),
    ("07-oyun", {"tr-TR": ("FİLMLERLE", "OYNA"), "en-US": ("PLAY WITH", "MOVIES")},
     (40, 340, 1166, 450), 0.47, 0),
    ("08-rozetler", {"tr-TR": ("ROZETLERİ", "TOPLA"), "en-US": ("COLLECT", "BADGES")},
     (40, 1010, 1166, 1425), 0.62, 0),
]


# ─── Yardımcılar ───────────────────────────────────────────────────────────────

def glow(base, xy, r, color, alpha):
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    x, y = xy
    ImageDraw.Draw(layer).ellipse((x - r, y - r, x + r, y + r), fill=color + (alpha,))
    return Image.alpha_composite(base, layer.filter(ImageFilter.GaussianBlur(r * 0.6)))


def background(w, h, k, spots):
    bg = Image.new("RGBA", (w, h), (6, 8, 12, 255))
    for (fx, fy, r, color, a) in spots:
        bg = glow(bg, (fx * w, fy * h), r * k, color, a)
    return bg


def font(path, size):
    return ImageFont.truetype(path, max(10, int(size)))


def fit_font(path, text, size, maxw):
    probe = ImageDraw.Draw(Image.new("L", (1, 1)))
    while size > 20:
        f = font(path, size)
        if probe.textlength(text, font=f) <= maxw:
            return f
        size -= 2
    return font(path, size)


def gradient(w, h, colors):
    g = Image.new("RGBA", (w, 1))
    n = len(colors) - 1
    for x in range(w):
        t = x / max(1, w - 1) * n
        i = min(int(t), n - 1)
        u = t - i
        c = tuple(round(colors[i][j] + (colors[i + 1][j] - colors[i][j]) * u) for j in range(3))
        g.putpixel((x, 0), c + (255,))
    return g.resize((w, h))


def draw_text(canvas, xy, text, f, fill=WHITE, anchor="la"):
    """fill bir renk ya da 'accent' (marka geçişi) olabilir."""
    d = ImageDraw.Draw(canvas)
    if fill != "accent":
        d.text(xy, text, font=f, fill=fill, anchor=anchor)
        return
    l, t, r, b = d.textbbox(xy, text, font=f, anchor=anchor)
    mask = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(mask).text(xy, text, font=f, fill=255, anchor=anchor)
    grad = gradient(r - l, b - t, ACCENT)
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    layer.paste(grad, (l, t))
    canvas.paste(layer, (0, 0), mask)


def screen_image(name):
    """Tam iPhone oranında ekran: durum çubuğu (saat, pil) alttaki satırların uzatılmış rengiyle
    gizlenir; içerik sonu verilmişse alttaki kısım son satır rengiyle doldurulur."""
    im = Image.open(os.path.join(RAW, name + ".jpg")).convert("RGB")
    crop = CROPS[name]
    status_h, bottom_px = crop if isinstance(crop, tuple) else (crop, im.height)
    full_w, full_h = im.size
    if bottom_px < full_h:
        filler = im.crop((0, bottom_px - 4, full_w, bottom_px - 2)).resize((1, 1)).getpixel((0, 0))
        base = Image.new("RGB", (full_w, full_h), filler)
        base.paste(im.crop((0, 0, full_w, bottom_px)), (0, 0))
        im = base
    fade = 40
    row = im.crop((0, status_h, full_w, status_h + 4)).resize((full_w, status_h + fade))
    row = row.filter(ImageFilter.GaussianBlur(4))
    alpha = Image.new("L", (1, status_h + fade))
    for yy in range(status_h + fade):
        alpha.putpixel((0, yy), 255 if yy < status_h else round(255 * (1 - (yy - status_h) / fade)))
    im.paste(row, (0, 0), alpha.resize((full_w, status_h + fade)))
    return im, status_h


def draw_camera(im, status_px, style):
    sw = im.width
    d = ImageDraw.Draw(im)
    if style == "island":
        pt = sw / 402   # iPhone: 402 pt genişlikte 126x37 pt ada, üstten 11 pt
        iw, ih = round(126 * pt), round(37 * pt)
        ix, iy = (sw - iw) // 2, round(11 * pt)
        d.rounded_rectangle((ix, iy, ix + iw, iy + ih), radius=ih // 2, fill=(0, 0, 0, 255))
        lr = round(ih * 0.2)
        lx, ly = ix + iw - ih // 2, iy + ih // 2
        d.ellipse((lx - lr, ly - lr, lx + lr, ly + lr), fill=(14, 16, 24, 255))
        d.ellipse((lx - lr // 2, ly - lr // 2, lx, ly), fill=(34, 44, 70, 255))
    else:
        k = sw / 720
        cx, cy, r = sw // 2, round(status_px * 0.5), round(13 * k)
        ring = round(3 * k)
        d.ellipse((cx - r - ring, cy - r - ring, cx + r + ring, cy + r + ring), fill=(28, 30, 36, 255))
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(4, 5, 8, 255))
        d.ellipse((cx - r * 0.4, cy - r * 0.45, cx + r * 0.05, cy), fill=(40, 52, 80, 255))


def make_phone(name, screen_w, style):
    """Gövdesiyle birlikte telefon (RGBA). Döndürür: (görsel, ekran ölçeği, ekran ofseti)."""
    src, status_h = screen_image(name)
    scale = screen_w / src.width
    sh = round(src.height * scale)
    scr = src.resize((screen_w, sh), Image.LANCZOS).convert("RGBA")
    draw_camera(scr, status_h * scale, style)
    k = screen_w / 720
    bezel, screen_r = round(20 * k), round(78 * k)
    side = round(9 * k)
    pw, ph = screen_w + 2 * bezel, sh + 2 * bezel
    phone = Image.new("RGBA", (pw + 2 * side, ph), (0, 0, 0, 0))
    d = ImageDraw.Draw(phone)
    key = (52, 56, 66, 255)
    x = side
    d.rounded_rectangle((x + pw - 3 * k, 300 * k, x + pw + 7 * k, 430 * k), radius=4 * k, fill=key)
    d.rounded_rectangle((x - 7 * k, 250 * k, x + 3 * k, 340 * k), radius=4 * k, fill=key)
    d.rounded_rectangle((x - 7 * k, 360 * k, x + 3 * k, 450 * k), radius=4 * k, fill=key)
    outer_r = screen_r + bezel
    e = max(2, round(3 * k))
    d.rounded_rectangle((x, 0, x + pw - 1, ph - 1), radius=outer_r, fill=(62, 66, 78, 255))
    d.rounded_rectangle((x + e, e, x + pw - 1 - e, ph - 1 - e), radius=outer_r - e, fill=(12, 13, 17, 255))
    mask = Image.new("L", scr.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, screen_w - 1, sh - 1), radius=screen_r, fill=255)
    phone.paste(scr, (x + bezel, bezel), mask)
    return phone, scale, (x + bezel, bezel), src


def place(canvas, img, center, angle, k, shadow=True):
    """Görseli (isteğe bağlı döndürüp) merkezine göre gölgesiyle yerleştirir."""
    if angle:
        img = img.rotate(angle, resample=Image.BICUBIC, expand=True)
    x, y = round(center[0] - img.width / 2), round(center[1] - img.height / 2)
    if shadow:
        a = img.split()[3].point(lambda v: min(200, v))
        sh = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        blk = Image.new("RGBA", img.size, (0, 0, 0, 255))
        sh.paste(blk, (x, y + round(24 * k)), a)
        canvas = Image.alpha_composite(canvas, sh.filter(ImageFilter.GaussianBlur(36 * k)))
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    layer.paste(img, (x, y), img)
    return Image.alpha_composite(canvas, layer)


def callout(src, box, width, k):
    """Ekrandan kesit: büyütülmüş, yuvarlak köşeli, ince marka kenarlı kart."""
    part = src.crop(box)
    h = round(part.height * width / part.width)
    part = part.resize((width, h), Image.LANCZOS).convert("RGBA")
    r = round(34 * k)
    pad = round(6 * k)
    card = Image.new("RGBA", (width + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    edge = gradient(card.width, card.height, ACCENT)
    emask = Image.new("L", card.size, 0)
    ImageDraw.Draw(emask).rounded_rectangle((0, 0, card.width - 1, card.height - 1), radius=r + pad, fill=255)
    card.paste(edge, (0, 0), emask)
    inner = Image.new("L", part.size, 0)
    ImageDraw.Draw(inner).rounded_rectangle((0, 0, width - 1, h - 1), radius=r, fill=255)
    card.paste(part, (pad, pad), inner)
    return card


def headline(canvas, lines_white, line_accent, x, y, maxw, size, k, align="center"):
    """Satırları alt alta yazar; son satır renkli. Döndürür: son satırın altı."""
    W = canvas.width
    rows = [(t, WHITE) for t in lines_white] + [(line_accent, "accent")]
    longest = max(rows, key=lambda r: len(r[0]))[0]
    f = fit_font(F_BLACK, longest, size, maxw)
    for t, fill in rows:
        f_row = fit_font(F_BLACK, t, f.size, maxw)
        if align == "center":
            draw_text(canvas, (x, y), t, f_row, fill, anchor="ma")
        else:
            draw_text(canvas, (x, y), t, f_row, fill, anchor="la")
        y += round(f.size * 1.12)
    return y


def save(img, path):
    """Windows'ta dosya önizlemede açıkken yazım ara sıra reddedilir: geçici dosya + yeniden dene."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp.png"
    img.convert("RGB").save(tmp)
    for _ in range(20):
        try:
            os.replace(tmp, path)
            return
        except OSError:
            time.sleep(0.5)
    raise OSError("yazılamadı: " + path)


# ─── Sahneler ──────────────────────────────────────────────────────────────────

def hero(platform, W, H, style, lang):
    k = W / 1080
    tall = H / W > 2   # iOS daha uzun: telefonlar biraz aşağı
    PW, PH = 2 * W, H
    c = background(PW, PH, k, [
        (0.12, 0.18, 520, (20, 200, 232), 60), (0.45, 0.70, 560, (255, 59, 92), 45),
        (0.80, 0.30, 600, (139, 124, 246), 50), (0.98, 0.95, 420, (19, 141, 240), 40)])
    whites, accent, chips = HERO[lang]
    m = round(70 * k)
    y = round((150 if not tall else 230) * k)
    y = headline(c, whites, accent, m, y, W - 2 * m, 118 * k, k, align="left")
    # Özellik çipleri (yarı saydam: ayrı katmanda çizilip harmanlanır)
    fy = y + round(48 * k)
    f = font(F_SEMI, 32 * k)
    h = round(72 * k)
    gap = round((20 if not tall else 30) * k)
    layer = Image.new("RGBA", c.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for i, chip in enumerate(chips):
        tw = d.textlength(chip, font=f)
        col = ACCENT[i % len(ACCENT)]
        d.rounded_rectangle((m, fy, m + tw + 82 * k, fy + h), radius=h // 2,
                            fill=(255, 255, 255, 20), outline=col + (150,), width=max(2, round(2 * k)))
        d.ellipse((m + 26 * k, fy + h / 2 - 9 * k, m + 44 * k, fy + h / 2 + 9 * k), fill=col + (255,))
        d.text((m + 60 * k, fy + h / 2), chip, font=f, fill=WHITE + (255,), anchor="lm")
        fy += h + gap
    c = Image.alpha_composite(c, layer)
    # Arka telefon (02) — 2. görselde, hafif sağa eğik
    p2, _, _, _ = make_phone("02-film-detay", round(740 * k), style)
    c = place(c, p2, (1.60 * W, H * (0.60 if not tall else 0.57)), -6, k)
    # Ön telefon (01) — iki görselin sınırında, sola eğik
    p1, _, _, _ = make_phone("01-kesif", round(720 * k), style)
    c = place(c, p1, (1.0 * W, H * (0.80 if not tall else 0.72)), 9, k)
    return c.crop((0, 0, W, H)), c.crop((W, 0, 2 * W, H))


def single(platform, W, H, style, lang, spec, idx):
    name, texts, box, cy_frac, angle = spec
    k = W / 1080
    tall = H / W > 2
    side = 1 if idx % 2 == 0 else -1
    c = background(W, H, k, [
        (0.5 + 0.35 * side, 0.12, 460, (20, 200, 232), 55), (0.5 - 0.4 * side, 0.55, 420, (255, 59, 92), 40),
        (0.5, 0.95, 560, (139, 124, 246), 45)])
    white, accent = texts[lang]
    y = round((120 if not tall else 200) * k)
    y = headline(c, [white], accent, W // 2, y, W - round(110 * k), 112 * k, k)
    sw = round((780 if not tall else 800) * k)
    phone, scale, off, src = make_phone(name, sw, style)
    top = y + round(70 * k)
    c = place(c, phone, (W / 2, top + phone.height / 2), angle, k)
    if box:
        # Kart, kaynağının tam üstüne büyütülerek oturur (yakınlaştırma etkisi)
        card = callout(src, box, round(990 * k), k)
        src_cy = top + off[1] + (box[1] + box[3]) / 2 * scale
        c = place(c, card, (W / 2, src_cy), 0, k)
    return c


def main():
    for platform, (W, H, style) in PLATFORMS.items():
        for lang in LANGS:
            out = os.path.join(OUT, platform, lang)
            a, b = hero(platform, W, H, style, lang)
            save(a, os.path.join(out, "01-kesif.png"))
            save(b, os.path.join(out, "02-film-detay.png"))
            for i, spec in enumerate(SINGLES):
                save(single(platform, W, H, style, lang, spec, i), os.path.join(out, spec[0] + ".png"))
    print("ok")


if __name__ == "__main__":
    main()
