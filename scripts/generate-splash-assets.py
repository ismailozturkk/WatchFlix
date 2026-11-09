"""Açılış ekranının (components/SplashLensIntro.js) bitmap'lerini üretir → assets/splash/

  glow-cyan.png, glow-red.png  yıldızların ışık halesi (Lens camgöbeği / kırmızı)
  glow-paper.png               çarpışma parlaması (kâğıt rengi)
  native-blank.png             yerel splash görseli: TAM SAYDAM. Yerel splash yalnız mürekkep
                               zemini gösterir; yıldızlar JS tarafında ilk kareden doğar
                               (logo yerelde dursaydı animasyon başlarken parçalanmış görünürdü).

Hale profili logo animasyonundakiyle aynı (marketing/marka/yeni-logo/kaynak/anim2.cjs `halo`):
yarıçapın %7,7'sine kadar tam renk, oradan kenara doğru saydamlaşır. Kenarlar tam saydam.

Kullanım: python scripts/generate-splash-assets.py   (Pillow + numpy)
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "splash"
SIZE = 192
INNER = 0.2 / 2.6  # anim2.cjs: createRadialGradient(x, y, r*.2, x, y, r*2.6)

COLORS = {"cyan": "#14C8E8", "red": "#FF3D5E", "paper": "#F5F2EB"}


def glow(hex_color):
    rgb = [int(hex_color[i:i + 2], 16) for i in (1, 3, 5)]
    y, x = np.mgrid[0:SIZE, 0:SIZE] + 0.5
    d = np.sqrt((x - SIZE / 2) ** 2 + (y - SIZE / 2) ** 2) / (SIZE / 2)
    t = np.clip((d - INNER) / (1 - INNER), 0, 1)
    # Doğrusal düşüş + yumuşak kuyruk (kenarda basamak görünmesin).
    a = (1 - t) ** 1.6
    a[d >= 1] = 0
    img = np.zeros((SIZE, SIZE, 4), dtype=np.uint8)
    img[..., 0], img[..., 1], img[..., 2] = rgb
    img[..., 3] = np.round(a * 255).astype(np.uint8)
    return Image.fromarray(img, "RGBA")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, col in COLORS.items():
        glow(col).save(OUT / f"glow-{name}.png", optimize=True)
    Image.new("RGBA", (288, 288), (0, 0, 0, 0)).save(OUT / "native-blank.png", optimize=True)
    print("ok", sorted(p.name for p in OUT.iterdir()))
