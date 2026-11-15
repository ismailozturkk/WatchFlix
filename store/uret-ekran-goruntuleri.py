# -*- coding: utf-8 -*-
# Mağaza telefon ekran görüntüleri, TR + EN başlıklı çerçeve, iki platform:
#   android → store/assets/screenshots/android/<dil>/  1080x1920, kamera deliği (Play)
#   ios     → store/assets/screenshots/ios/<dil>/      1290x2796, Dinamik Ada (App Store 6,9")
# Kaynak: store/raw-screenshots/ios-en/*.jpg (iPhone, 1206x2622). Çalıştır:
#   python store/uret-ekran-goruntuleri.py
# Ekran telefon çerçevesi içinde marka zemini üzerine yerleştirilir; durum çubuğu gizlenir.
import os
import time
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RAW = os.path.join(ROOT, "store", "raw-screenshots", "ios-en")
OUT = os.path.join(ROOT, "store", "assets", "screenshots")
FONT = os.path.join(ROOT, "marketing", "marka", "yeni-logo", "kaynak", "font", "sora-600.ttf")

# platform: (genişlik, yükseklik, kamera biçimi). Yerleşim 1080 genişliğe göre tasarlandı, k ile ölçeklenir.
PLATFORMS = {
    "android": (1080, 1920, "hole"),
    "ios": (1290, 2796, "island"),
}

# (dosya, durum çubuğu yüksekliği px ya da (durum çubuğu, içerik sonu) px, {dil: (başlık, alt satır)})
SHOTS = [
    ("01-kesif", 150, {
        "en-US": ("Find what to watch next", "Trends, top rated and picks for you"),
        "tr-TR": ("Sıradaki filmini bul", "Trendler, en iyiler ve sana özel öneriler")}),
    ("02-film-detay", 150, {
        "en-US": ("Rate out of 10, halves too", "IMDb, Rotten Tomatoes and where to watch"),
        "tr-TR": ("10 üzerinden, yarım puanla", "IMDb, Rotten Tomatoes ve nerede izlenir")}),
    ("03-dizi-takip", 150, {
        "en-US": ("Track every episode", "Always know where you left off"),
        "tr-TR": ("Her bölümü takip et", "Kaldığın yeri hep bil")}),
    ("04-bolum-grafigi", 150, {
        "en-US": ("See how a show held up", "Episode ratings, season by season"),
        "tr-TR": ("Dizinin seyrini gör", "Sezon sezon bölüm puanları")}),
    ("05-istatistik", (178, 1980), {
        "en-US": ("Your watching, in numbers", "Watch time, movies, shows and ratings"),
        "tr-TR": ("İzlemelerin, rakamlarla", "Süre, film, dizi ve puan dağılımı")}),
    ("06-kutuphane", 150, {
        "en-US": ("Your library, in one place", "Ongoing shows, lists and reminders"),
        "tr-TR": ("Kütüphanen tek yerde", "Devam eden diziler, listeler, hatırlatıcılar")}),
    ("07-oyun", 150, {
        "en-US": ("Play with movies", "Poster puzzles, daily frames, weekly league"),
        "tr-TR": ("Filmlerle oyna", "Poster bulmaca, Günün Karesi, Haftalık Lig")}),
    ("08-rozetler", 150, {
        "en-US": ("Collect 160+ badges", "Show your favorites on your profile"),
        "tr-TR": ("160'tan fazla rozet topla", "Favorilerini profilinde sergile")}),
]


def glow(base, xy, r, color, alpha):
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    x, y = xy
    ImageDraw.Draw(layer).ellipse((x - r, y - r, x + r, y + r), fill=color + (alpha,))
    return Image.alpha_composite(base, layer.filter(ImageFilter.GaussianBlur(r * 0.6)))


def background(W, H):
    k = W / 1080
    bg = Image.new("RGBA", (W, H), (6, 8, 12, 255))
    bg = glow(bg, (160 * k, 260 * k), 420 * k, (20, 200, 232), 55)
    bg = glow(bg, (960 * k, 420 * k), 380 * k, (255, 59, 92), 45)
    bg = glow(bg, (540 * k, H - 270 * k), 520 * k, (139, 124, 246), 40)
    return bg


def fit(draw, text, size, maxw):
    while size > 20:
        f = ImageFont.truetype(FONT, size)
        if draw.textlength(text, font=f) <= maxw:
            return f
        size -= 2
    return ImageFont.truetype(FONT, size)


def screen_image(shot, crop):
    """Telefon ekranı: tam iPhone oranı. Durum çubuğu (saat, pil) alttaki satırların uzatılmış
    rengiyle gizlenir; (üst, alt) verilmişse alttan kesilen kısım son satır rengiyle doldurulur."""
    im = Image.open(shot).convert("RGB")
    status_h, bottom_px = crop if isinstance(crop, tuple) else (crop, im.height)
    full_w, full_h = im.width, im.height
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


def draw_camera(im, sw, status_px, style):
    d = ImageDraw.Draw(im)
    if style == "island":
        # Dinamik Ada: iPhone oranları (402 pt genişlikte 126x37 pt, üstten 11 pt)
        pt = sw / 402
        iw, ih = round(126 * pt), round(37 * pt)
        ix, iy = (sw - iw) // 2, round(11 * pt)
        d.rounded_rectangle((ix, iy, ix + iw, iy + ih), radius=ih // 2, fill=(0, 0, 0, 255))
        lr = round(ih * 0.2)
        lx, ly = ix + iw - ih // 2, iy + ih // 2
        d.ellipse((lx - lr, ly - lr, lx + lr, ly + lr), fill=(14, 16, 24, 255))
        d.ellipse((lx - lr // 2, ly - lr // 2, lx, ly), fill=(34, 44, 70, 255))
    else:
        # Android ön kamera deliği, durum çubuğu alanının ortasında
        k = sw / 720
        cx, cy, r = sw // 2, round(status_px * 0.5), round(13 * k)
        ring = round(3 * k)
        d.ellipse((cx - r - ring, cy - r - ring, cx + r + ring, cy + r + ring), fill=(28, 30, 36, 255))
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(4, 5, 8, 255))
        d.ellipse((cx - r * 0.4, cy - r * 0.45, cx + r * 0.05, cy), fill=(40, 52, 80, 255))


def render(name, crop, W, H, style):
    k = W / 1080
    bezel, screen_r = round(20 * k), round(78 * k)
    phone_top = round(286 * k)
    phone_h = H - phone_top - round(44 * k)
    im, status_h = screen_image(os.path.join(RAW, name + ".jpg"), crop)
    sh = phone_h - 2 * bezel
    scale = sh / im.height
    sw = round(im.width * scale)
    im = im.resize((sw, sh), Image.LANCZOS).convert("RGBA")
    draw_camera(im, sw, status_h * scale, style)
    mask = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, sw - 1, sh - 1), radius=screen_r, fill=255)
    pw = sw + 2 * bezel
    return im, mask, (W - pw) // 2, phone_top, pw, phone_h, bezel, screen_r


def draw_phone(canvas, x, y, pw, ph, bezel, screen_r, k):
    W, H = canvas.size
    outer_r = screen_r + bezel
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (x - 4 * k, y + 16 * k, x + pw + 4 * k, y + ph + 30 * k), radius=outer_r, fill=(0, 0, 0, 190))
    canvas = Image.alpha_composite(canvas, shadow.filter(ImageFilter.GaussianBlur(30 * k)))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    key = (52, 56, 66, 255)
    # Yan tuşlar (gövdenin arkasında, kenardan taşan)
    d.rounded_rectangle((x + pw - 2 * k, y + 300 * k, x + pw + 7 * k, y + 430 * k), radius=4 * k, fill=key)
    d.rounded_rectangle((x - 7 * k, y + 250 * k, x + 2 * k, y + 340 * k), radius=4 * k, fill=key)
    d.rounded_rectangle((x - 7 * k, y + 360 * k, x + 2 * k, y + 450 * k), radius=4 * k, fill=key)
    # Gövde: metalik kenar + koyu çerçeve
    e = round(3 * k)
    d.rounded_rectangle((x, y, x + pw - 1, y + ph - 1), radius=outer_r, fill=(58, 62, 72, 255))
    d.rounded_rectangle((x + e, y + e, x + pw - 1 - e, y + ph - 1 - e), radius=outer_r - e, fill=(12, 13, 17, 255))
    d.rounded_rectangle((x + e + 1, y + e + 1, x + pw - 2 - e, y + ph - 2 - e), radius=outer_r - e - 1,
                        outline=(255, 255, 255, 22), width=max(2, round(2 * k)))
    return Image.alpha_composite(canvas, layer)


def save(img, path):
    """Windows'ta dosya önizlemede/izleyicide açıkken yazım ara sıra reddedilir: geçici dosya + yeniden dene."""
    tmp = path + ".tmp.png"
    img.save(tmp)
    for _ in range(20):
        try:
            os.replace(tmp, path)
            return
        except OSError:
            time.sleep(0.5)
    raise OSError("yazılamadı: " + path)


def main():
    for platform, (W, H, style) in PLATFORMS.items():
        k = W / 1080
        for name, crop, texts in SHOTS:
            shot, mask, x, y, pw, ph, bezel, screen_r = render(name, crop, W, H, style)
            for lang, (head, sub) in texts.items():
                canvas = draw_phone(background(W, H), x, y, pw, ph, bezel, screen_r, k)
                canvas.paste(shot, (x + bezel, y + bezel), mask)
                d = ImageDraw.Draw(canvas)
                f1 = fit(d, head, round(72 * k), W - round(120 * k))
                f2 = fit(d, sub, round(38 * k), W - round(140 * k))
                for text, font, ty, fill in ((head, f1, 92 * k, (238, 244, 251)),
                                             (sub, f2, 192 * k, (150, 162, 180))):
                    tw = d.textlength(text, font=font)
                    d.text(((W - tw) / 2, ty), text, font=font, fill=fill)
                out_dir = os.path.join(OUT, platform, lang)
                os.makedirs(out_dir, exist_ok=True)
                save(canvas.convert("RGB"), os.path.join(out_dir, name + ".png"))
    print("ok")


if __name__ == "__main__":
    main()
