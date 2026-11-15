# -*- coding: utf-8 -*-
# Play telefon ekran görüntüleri (1080x1920, TR + EN başlıklı çerçeve).
# Kaynak: store/raw-screenshots/ios-en/*.jpg (iPhone, 1206x2622). Çalıştır:
#   python store/uret-ekran-goruntuleri.py
# iPhone oranı (~1:2,17) Play'in 2:1 sınırını aşar; bu yüzden ekran küçültülüp
# marka zemini üzerine yerleştirilir, üstteki durum çubuğu kırpılır.
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RAW = os.path.join(ROOT, "store", "raw-screenshots", "ios-en")
OUT = os.path.join(ROOT, "store", "assets", "screenshots")
FONT = os.path.join(ROOT, "marketing", "marka", "yeni-logo", "kaynak", "font", "sora-600.ttf")
W, H = 1080, 1920

# (dosya, kırpma: üst px ya da (üst, alt) px, {dil: (başlık, alt satır)})
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

def frame(shot, crop):
    im = Image.open(shot).convert("RGB")
    top_px, bottom_px = crop if isinstance(crop, tuple) else (crop, im.height)
    im = im.crop((0, top_px, im.width, bottom_px))
    box_top, box_w, box_h = 330, 900, H - 330 - 70
    scale = min(box_w / im.width, box_h / im.height)
    sw, sh = round(im.width * scale), round(im.height * scale)
    im = im.resize((sw, sh), Image.LANCZOS).convert("RGBA")
    mask = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, sw - 1, sh - 1), radius=52, fill=255)
    return im, mask, (W - sw) // 2, box_top + (box_h - sh) // 2

def main():
    for name, crop_top, texts in SHOTS:
        shot, mask, x, y = frame(os.path.join(RAW, name + ".jpg"), crop_top)
        for lang, (head, sub) in texts.items():
            canvas = background()
            shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            ImageDraw.Draw(shadow).rounded_rectangle(
                (x - 6, y + 10, x + shot.width + 6, y + shot.height + 22), radius=58, fill=(0, 0, 0, 170))
            canvas = Image.alpha_composite(canvas, shadow.filter(ImageFilter.GaussianBlur(26)))
            canvas.paste(shot, (x, y), mask)
            border = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            ImageDraw.Draw(border).rounded_rectangle(
                (x, y, x + shot.width - 1, y + shot.height - 1), radius=52, outline=(255, 255, 255, 34), width=3)
            canvas = Image.alpha_composite(canvas, border)
            d = ImageDraw.Draw(canvas)
            f1 = fit(d, head, 72, W - 120)
            f2 = fit(d, sub, 38, W - 140)
            for text, font, ty, fill in ((head, f1, 112, (238, 244, 251)), (sub, f2, 214, (150, 162, 180))):
                tw = d.textlength(text, font=font)
                d.text(((W - tw) / 2, ty), text, font=font, fill=fill)
            os.makedirs(os.path.join(OUT, lang), exist_ok=True)
            canvas.convert("RGB").save(os.path.join(OUT, lang, name + ".png"))
    print("ok")

if __name__ == "__main__":
    main()
