# -*- coding: utf-8 -*-
# Play telefon ekran görüntüleri (1080x1920, TR + EN başlıklı çerçeve).
# Kaynak: store/raw-screenshots/ios-en/*.jpg (iPhone, 1206x2622). Çalıştır:
#   python store/uret-ekran-goruntuleri.py
# iPhone oranı (~1:2,17) Play'in 2:1 sınırını aşar; bu yüzden ekran küçültülüp
# telefon çerçevesi içinde marka zemini üzerine yerleştirilir; durum çubuğu bulanıklaştırılır.
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RAW = os.path.join(ROOT, "store", "raw-screenshots", "ios-en")
OUT = os.path.join(ROOT, "store", "assets", "screenshots")
FONT = os.path.join(ROOT, "marketing", "marka", "yeni-logo", "kaynak", "font", "sora-600.ttf")
W, H = 1080, 1920

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

def background():
    bg = Image.new("RGBA", (W, H), (6, 8, 12, 255))
    bg = glow(bg, (160, 260), 420, (20, 200, 232), 55)
    bg = glow(bg, (960, 420), 380, (255, 59, 92), 45)
    bg = glow(bg, (540, 1650), 520, (139, 124, 246), 40)
    return bg

def fit(draw, text, size, maxw):
    while size > 20:
        f = ImageFont.truetype(FONT, size)
        if draw.textlength(text, font=f) <= maxw:
            return f
        size -= 2
    return ImageFont.truetype(FONT, size)

BEZEL = 20          # çerçeve kalınlığı
SCREEN_R = 78       # ekran köşe yarıçapı
PHONE_TOP = 286
PHONE_H = H - PHONE_TOP - 44

def screen_image(shot, crop):
    """Telefon ekranı: tam iPhone oranı. Üstteki durum çubuğu (saat, pil) bulanıklaştırılır,
    (üst, alt) verilmişse alttan kesilen kısım ekranın son satır rengiyle doldurulur."""
    im = Image.open(shot).convert("RGB")
    status_h, bottom_px = crop if isinstance(crop, tuple) else (crop, im.height)
    full_w, full_h = im.width, im.height
    if bottom_px < full_h:
        filler = im.crop((0, bottom_px - 4, full_w, bottom_px - 2)).resize((1, 1)).getpixel((0, 0))
        base = Image.new("RGB", (full_w, full_h), filler)
        base.paste(im.crop((0, 0, full_w, bottom_px)), (0, 0))
        im = base
    # Saat/pil yazısını silmek için şerit, hemen altındaki satırların uzatılmış
    # kopyasıyla doldurulur; sınır 40 px'lik yumuşak geçişle içeriğe karışır.
    fade = 40
    row = im.crop((0, status_h, full_w, status_h + 4)).resize((full_w, status_h + fade))
    row = row.filter(ImageFilter.GaussianBlur(4))
    alpha = Image.new("L", (1, status_h + fade))
    for yy in range(status_h + fade):
        alpha.putpixel((0, yy), 255 if yy < status_h else round(255 * (1 - (yy - status_h) / fade)))
    im.paste(row, (0, 0), alpha.resize((full_w, status_h + fade)))
    return im, status_h

def frame(shot, crop):
    im, status_h = screen_image(shot, crop)
    sh = PHONE_H - 2 * BEZEL
    scale = sh / im.height
    sw = round(im.width * scale)
    im = im.resize((sw, sh), Image.LANCZOS).convert("RGBA")
    # Dinamik Ada: iPhone oranlarıyla (402 pt genişlikte 126x37 pt, üstten 11 pt)
    d = ImageDraw.Draw(im)
    pt = sw / 402
    iw, ih = round(126 * pt), round(37 * pt)
    ix, iy = (sw - iw) // 2, round(11 * pt)
    d.rounded_rectangle((ix, iy, ix + iw, iy + ih), radius=ih // 2, fill=(0, 0, 0, 255))
    # Sağ uçta kamera merceği izi
    lr = round(ih * 0.2)
    lx, ly = ix + iw - ih // 2, iy + ih // 2
    d.ellipse((lx - lr, ly - lr, lx + lr, ly + lr), fill=(14, 16, 24, 255))
    d.ellipse((lx - lr // 2, ly - lr // 2, lx, ly), fill=(34, 44, 70, 255))
    mask = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, sw - 1, sh - 1), radius=SCREEN_R, fill=255)
    pw, ph = sw + 2 * BEZEL, PHONE_H
    return im, mask, (W - pw) // 2, PHONE_TOP, pw, ph

def draw_phone(canvas, x, y, pw, ph):
    outer_r = SCREEN_R + BEZEL
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((x - 4, y + 16, x + pw + 4, y + ph + 30), radius=outer_r, fill=(0, 0, 0, 190))
    canvas = Image.alpha_composite(canvas, shadow.filter(ImageFilter.GaussianBlur(30)))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    # Yan tuşlar (gövdenin arkasında, kenardan taşan)
    d.rounded_rectangle((x + pw - 2, y + 300, x + pw + 7, y + 430), radius=4, fill=(52, 56, 66, 255))
    d.rounded_rectangle((x - 7, y + 250, x + 2, y + 340), radius=4, fill=(52, 56, 66, 255))
    d.rounded_rectangle((x - 7, y + 360, x + 2, y + 450), radius=4, fill=(52, 56, 66, 255))
    # Gövde: metalik kenar + koyu çerçeve
    d.rounded_rectangle((x, y, x + pw - 1, y + ph - 1), radius=outer_r, fill=(58, 62, 72, 255))
    d.rounded_rectangle((x + 3, y + 3, x + pw - 4, y + ph - 4), radius=outer_r - 3, fill=(12, 13, 17, 255))
    d.rounded_rectangle((x + 4, y + 4, x + pw - 5, y + ph - 5), radius=outer_r - 4, outline=(255, 255, 255, 22), width=2)
    return Image.alpha_composite(canvas, layer)

def save(img, path):
    """Windows'ta dosya önizlemede/izleyicide açıkken yazım ara sıra reddedilir: geçici dosya + yeniden dene."""
    import time
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
    for name, crop, texts in SHOTS:
        shot, mask, x, y, pw, ph = frame(os.path.join(RAW, name + ".jpg"), crop)
        for lang, (head, sub) in texts.items():
            canvas = draw_phone(background(), x, y, pw, ph)
            canvas.paste(shot, (x + BEZEL, y + BEZEL), mask)
            d = ImageDraw.Draw(canvas)
            f1 = fit(d, head, 72, W - 120)
            f2 = fit(d, sub, 38, W - 140)
            for text, font, ty, fill in ((head, f1, 92, (238, 244, 251)), (sub, f2, 192, (150, 162, 180))):
                tw = d.textlength(text, font=font)
                d.text(((W - tw) / 2, ty), text, font=font, fill=fill)
            os.makedirs(os.path.join(OUT, lang), exist_ok=True)
            save(canvas.convert("RGB"), os.path.join(OUT, lang, name + ".png"))
    print("ok")

if __name__ == "__main__":
    main()
