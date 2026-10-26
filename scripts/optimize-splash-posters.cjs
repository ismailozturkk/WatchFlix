// scripts/optimize-splash-posters.cjs
//
// Açılış ekranı afişlerini (assets/splash-posters/*.jpg) karo boyutuna indirir:
//   node scripts/optimize-splash-posters.cjs
//
// NEDEN: afişler pakette gelir (ağ yok) ama her biri açılışın en yoğun anında
// çözülür (decode). TMDB w342 (342×513, PROGRESSIVE) dosyaları karo boyutunun
// (78×117 dp → 3x ekranda 234×351 px) üstündeydi; progressive JPEG çözümü de
// baseline'dan pahalı. Çıktı: POSTER_W×POSTER_H baseline JPEG.
//
// Yeni afiş eklerken TMDB'den indirip bu betiği çalıştır; yeniden çalıştırmak
// zararsızdır (zaten hedef boyuttaki dosyaya dokunmaz).

const fs = require("fs");
const path = require("path");
const Jimp = require("jimp-compact");

const POSTER_W = 240;
const POSTER_H = 360;
const QUALITY = 82;
const DIR = path.join(__dirname, "..", "assets", "splash-posters");

async function main() {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".jpg"));
  let before = 0;
  let after = 0;
  for (const file of files) {
    const full = path.join(DIR, file);
    const input = fs.readFileSync(full);
    before += input.length;
    const image = await Jimp.read(input);
    if (image.bitmap.width === POSTER_W && image.bitmap.height === POSTER_H) {
      after += input.length;
      continue;
    }
    image.cover(POSTER_W, POSTER_H).quality(QUALITY);
    const output = await image.getBufferAsync(Jimp.MIME_JPEG);
    fs.writeFileSync(full, output);
    after += output.length;
  }
  console.log(`${files.length} afiş: ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
