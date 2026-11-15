# -*- coding: utf-8 -*-
# Play feature graphic (1024x500, TR + EN). Çalıştır: python store/uret-feature-graphic.py
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import os
ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "store", "assets")
FONT = ROOT + "/marketing/marka/yeni-logo/kaynak/font/sora-600.ttf"
TEXTS = {
  "tr": ("Film ve dizi hayatın, tek bir yerde.", "Takip et  ·  keşfet  ·  paylaş  ·  oyna"),
  "en": ("Your movie & TV life, all in one place.", "Track  ·  discover  ·  share  ·  play"),
}
W, H = 1024, 500
def glow(base, xy, r, color, alpha):
    layer = Image.new("RGBA", base.size, (0,0,0,0))
    d = ImageDraw.Draw(layer)
    x, y = xy
    d.ellipse((x-r, y-r, x+r, y+r), fill=color + (alpha,))
    layer = layer.filter(ImageFilter.GaussianBlur(r * 0.6))
    return Image.alpha_composite(base, layer)
for lang, (head, sub) in TEXTS.items():
    im = Image.new("RGBA", (W, H), (6, 8, 12, 255))
    im = glow(im, (190, 150), 230, (20, 200, 232), 70)
    im = glow(im, (210, 370), 230, (255, 59, 92), 60)
    im = glow(im, (900, 80), 260, (139, 124, 246), 35)
    logo = Image.open(ROOT + "/marketing/marka/yeni-logo/lens/png/lens-yatay-koyu-zemin.png").convert("RGBA")
    lw = 560; lh = round(logo.height * lw / logo.width)
    logo = logo.resize((lw, lh), Image.LANCZOS)
    lx = (W - lw) // 2; ly = 112
    im.alpha_composite(logo, (lx, ly))
    d = ImageDraw.Draw(im)
    f1 = ImageFont.truetype(FONT, 40); f2 = ImageFont.truetype(FONT, 24)
    def center(text, font, y, fill):
        w = d.textlength(text, font=font); d.text(((W - w) / 2, y), text, font=font, fill=fill)
    center(head, f1, ly + lh + 52, (238, 244, 251))
    center(sub, f2, ly + lh + 112, (150, 162, 180))
    im.convert("RGB").save(f"{OUT}/feature-graphic-{lang}.png")
print("ok")
