// Açılış ekranındaki "seelogd" yazısının harf yollarını üretir → data/splashWordmark.js
//
// Yazı Lens logosunun yazısıdır: Sora SemiBold, küçük harf, harf aralığı -0,025 em
// (marketing/marka/yeni-logo/README.md). Splash yazı tipi YÜKLEMEZ: harfler
// react-native-svg yolu olarak çizilir, ilk karede hazırdır ve her cihazda aynıdır.
//
// Kullanım: node scripts/generate-splash-wordmark.cjs [opentype.js modül yolu]
// (opentype.js projede bağımlılık değil; geçici bir klasöre kurup yolunu ver.)
const fs = require("fs");
const path = require("path");

const opentype = require(process.argv[2] || "opentype.js");
const ROOT = path.resolve(__dirname, "..");
const FONT = path.join(ROOT, "marketing/marka/yeni-logo/kaynak/font/sora-600.ttf");
const TEXT = "seelogd";
const SIZE = 1000; // yazı boyu = 1000 birim; bileşen ölçekler
const TRACKING = -0.025;

const font = opentype.loadSync(FONT);
const scale = SIZE / font.unitsPerEm;
const glyphs = font.stringToGlyphs(TEXT);
let x = 0;
const all = new opentype.Path();
const letters = glyphs.map((g, i) => {
  const p = g.getPath(x, 0, SIZE);
  all.extend(p);
  const d = p.toPathData(1);
  x += g.advanceWidth * scale + TRACKING * SIZE;
  if (glyphs[i + 1]) x += font.getKerningValue(g, glyphs[i + 1]) * scale;
  return d;
});
const b = all.getBoundingBox();
const box = { x1: Math.floor(b.x1), y1: Math.floor(b.y1), x2: Math.ceil(b.x2), y2: Math.ceil(b.y2) };

const out = `// data/splashWordmark.js — ÜRETİLDİ: node scripts/generate-splash-wordmark.cjs
// "seelogd" (Sora SemiBold, harf aralığı -0,025 em), yazı boyu ${SIZE} birim, taban çizgisi y=0.
// box: tüm yazının sınır kutusu (y1 üst, y2 alt; 'g' alt çıkıntısı dahil).

export const WORDMARK_FONT_SIZE = ${SIZE};
export const WORDMARK_BOX = Object.freeze(${JSON.stringify(box)});
export const WORDMARK_LETTERS = Object.freeze(${JSON.stringify(letters, null, 2)});
`;
fs.writeFileSync(path.join(ROOT, "data/splashWordmark.js"), out);
console.log("ok", box, letters.length);
