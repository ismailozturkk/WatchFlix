// scripts/generate-splash-glow.cjs
//
// Açılış ekranının ışıma görselini (assets/splash-glow.png) üretir:
//   node scripts/generate-splash-glow.cjs
//
// NEDEN BİTMAP: ışıma eskiden react-native-svg ile (3 radyal degrade) her açılışta
// çiziliyordu. Splash'in en yoğun anında SVG ayrıştırma + yazılım çizimi yerine
// hazır, küçük bir doku GPU'da yalnız ölçeklenip döndürülür; iki platformda da
// birebir aynı görünür (Android'de degrade bantlanması yok).
//
// İÇERİK: logonun üç rengi (mor/mavi/turkuaz) merkezde toplanmış yumuşak bir ışıma.
// Her leke, utils/ambientBackground.js'teki AMBIENT_FALLOFF profiliyle sönümlenir ve
// koyu zemine göre pişirilmiş tepe alfa (0.62) ile alfa-bileşimlenir. Açık zeminde
// bileşen görünürlüğü (utils/splashMotion.js glowPeakAlpha) kısar — görseli değil.
//
// Lekeleri/renkleri değiştirirsen yalnız bu dosyayı düzenle, yeniden çalıştır ve
// çıkan PNG'yi commit et (__tests__/splashGlowAsset.test.js profili doğrular).

const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const SIZE = 192; // 380 dp'ye gerilir; yumuşak degrade için fazlasıyla yeterli
const PEAK_ALPHA = 0.62;

// [yarıçap oranı, çarpan] — utils/ambientBackground.js AMBIENT_FALLOFF ile aynı.
const FALLOFF = [
  [0, 1],
  [0.18, 0.88],
  [0.36, 0.62],
  [0.55, 0.34],
  [0.75, 0.12],
  [1, 0],
];

// cx/cy/r: görselin kesri. Alttan üste doğru bileşimlenir.
const LOBES = [
  { rgb: [0x8b, 0x5c, 0xf6], cx: 0.56, cy: 0.44, r: 0.4 }, // mor
  { rgb: [0x3b, 0x82, 0xf6], cx: 0.5, cy: 0.5, r: 0.46 }, // mavi
  { rgb: [0x2d, 0xd4, 0xbf], cx: 0.44, cy: 0.57, r: 0.4 }, // turkuaz
];

function falloff(t) {
  if (t >= 1) return 0;
  for (let i = 1; i < FALLOFF.length; i++) {
    if (t <= FALLOFF[i][0]) {
      const [t0, f0] = FALLOFF[i - 1];
      const [t1, f1] = FALLOFF[i];
      return f0 + ((f1 - f0) * (t - t0)) / (t1 - t0);
    }
  }
  return 0;
}

const png = new PNG({ width: SIZE, height: SIZE });
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    // "over" bileşimi, premultiplied alfa ile
    let pr = 0;
    let pg = 0;
    let pb = 0;
    let pa = 0;
    for (const lobe of LOBES) {
      const dx = (x + 0.5) / SIZE - lobe.cx;
      const dy = (y + 0.5) / SIZE - lobe.cy;
      const a = PEAK_ALPHA * falloff(Math.hypot(dx, dy) / lobe.r);
      const [r, g, b] = lobe.rgb;
      pr = r * a + pr * (1 - a);
      pg = g * a + pg * (1 - a);
      pb = b * a + pb * (1 - a);
      pa = a + pa * (1 - a);
    }
    const i = (y * SIZE + x) * 4;
    // PNG düz (straight) alfa ister
    png.data[i] = pa > 0 ? Math.round(pr / pa) : 0;
    png.data[i + 1] = pa > 0 ? Math.round(pg / pa) : 0;
    png.data[i + 2] = pa > 0 ? Math.round(pb / pa) : 0;
    png.data[i + 3] = Math.round(pa * 255);
  }
}

const out = path.join(__dirname, "..", "assets", "splash-glow.png");
const buffer = PNG.sync.write(png, { colorType: 6 });
fs.writeFileSync(out, buffer);
console.log(`yazıldı: ${out} (${buffer.length} bayt, ${SIZE}x${SIZE})`);
