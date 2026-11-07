// utils/decorLayout.js
//
// Arka plan dekorunun (ikon deseni + ambiyans) SAF yerleşim ve yoğunluk
// mantığı. RN importu YOK (jest yalnız saf modülleri test ediyor); çizim
// components/IconBacground.js ve components/AmbientBackground.js'te.
//
// TEK TOHUM, HER YERDE AYNI DESEN
//   Desen ve leke renkleri artık her açılışta/ekranda Math.random ile değil,
//   cihazda BİR KEZ üretilip saklanan bir tohumdan (`Keys.decorSeed`) türer:
//   • ilk açılışta rastgele üretilir, sonra her ekranda ve her açılışta aynı
//     desen görünür (ekran geçişinde desen "zıplamaz");
//   • yerleşim ekran/oturum başına yeniden hesaplanmaz — tohum + yoğunluk
//     anahtarıyla bir kez üretilip modül önbelleğinde paylaşılır;
//   • kullanıcı Kişiselleştirme'den "Yeniden oluştur" derse yeni tohum yazılır.
//
// YOĞUNLUK
//   "auto" efekt modunun (Tam/Orta/Kapalı) hazır değerini izler; diğerleri
//   kullanıcının açık seçimidir ve efekt modundan bağımsızdır.

/** Kullanıcının seçebildiği yoğunluk basamakları (sıra = ekrandaki sıra). */
export const DECOR_DENSITIES = Object.freeze(["auto", "low", "medium", "high"]);

/**
 * İkon deseni ızgaraları. Öğe sayısı = sütun × satır; her öğe bir görsel
 * görünümü (expo-image) demek, yani yoğunluk doğrudan ekran açılışındaki
 * görünüm sayısıdır: 15 → 28 → 45.
 */
export const ICON_DENSITY_GRIDS = Object.freeze({
  low: Object.freeze({ cols: 3, rows: 5 }),
  medium: Object.freeze({ cols: 4, rows: 7 }),
  high: Object.freeze({ cols: 5, rows: 9 }),
});

/** Ambiyans leke sayıları (en fazla AMBIENT_MAX_BLOBS = 5). */
export const AMBIENT_DENSITY_BLOBS = Object.freeze({ low: 2, medium: 3, high: 5 });

/** Ambiyans saydamlık çarpanının alt sınırı (altında lekeler görünmez oluyor). */
export const AMBIENT_OPACITY_MIN = 0.2;

export const normalizeDensity = (value) =>
  DECOR_DENSITIES.includes(value) ? value : "auto";

/**
 * Izgarayı çözer. `preset` efekt modunun hazır değeri
 * ({ iconBackgroundCols, iconBackgroundRows }).
 */
export function resolveIconGrid(density, preset) {
  const fixed = ICON_DENSITY_GRIDS[normalizeDensity(density)];
  if (fixed) return fixed;
  const cols = Math.max(1, Math.floor(Number(preset?.iconBackgroundCols) || 4));
  const rows = Math.max(1, Math.floor(Number(preset?.iconBackgroundRows) || 7));
  return { cols, rows };
}

/** Leke sayısını çözer; `preset.ambientBlobCount` "auto" için kullanılır. */
export function resolveAmbientBlobCount(density, preset) {
  const fixed = AMBIENT_DENSITY_BLOBS[normalizeDensity(density)];
  if (fixed) return fixed;
  const n = Math.floor(Number(preset?.ambientBlobCount) || 3);
  return Math.min(5, Math.max(1, n));
}

/** Saydamlık çarpanını [AMBIENT_OPACITY_MIN, 1] aralığına sıkıştırır. */
export function clampAmbientOpacity(value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return 1;
  return Math.min(1, Math.max(AMBIENT_OPACITY_MIN, v));
}

// ── Tohumlu rastgelelik ─────────────────────────────────────────────────────

const UINT32 = 4294967296;

/** Geçerli tohum: 1..2^32-1 tam sayı. 0 "henüz üretilmedi" demek. */
export const isValidSeed = (seed) =>
  Number.isInteger(seed) && seed > 0 && seed < UINT32;

/** Yeni tohum üretir (asla 0 değil). */
export function newDecorSeed(rand = Math.random) {
  return 1 + Math.floor(rand() * (UINT32 - 2));
}

/**
 * mulberry32: küçük, hızlı, tekrarlanabilir [0,1) üreteci. Aynı tohum aynı
 * diziyi verir — desen her ekranda/açılışta birebir aynı çıkar.
 */
export function seededRandom(seed) {
  let a = (Number(seed) >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32;
  };
}

/**
 * Aynı ana tohumdan bağımsız alt diziler (ikon / ambiyans ayrı tuz). Böylece
 * ikon yoğunluğunu değiştirmek ambiyans renklerini oynatmaz.
 */
export function deriveSeed(seed, salt) {
  let h = ((Number(seed) >>> 0) ^ Math.imul(Number(salt) >>> 0 || 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h || 1;
}

export const ICON_SEED_SALT = 0x1c0;
export const AMBIENT_SEED_SALT = 0xa3b;

// ── İkon deseni yerleşimi ───────────────────────────────────────────────────

/** Öğe boyu (dp). Küçük, zarif ikonlar. */
export const ICON_SIZE_MIN = 25;
export const ICON_SIZE_MAX = 40;

/**
 * Izgara mantığıyla dağıtır: her hücreye bir öğe, hücre içinde rastgele
 * kaydırılır (üst üste binmez, boşluk kalmaz). Hücre öğeden küçükse öğe
 * hücreye sığacak şekilde küçülür.
 *
 * @param {() => number} rand
 * @param {{cols:number, rows:number, width:number, height:number, iconCount:number}} opts
 * @returns {Array<{top:number, left:number, size:number, imgIndex:number}>}
 */
export function buildIconLayout(rand, { cols, rows, width, height, iconCount }) {
  const C = Math.max(1, Math.floor(cols));
  const R = Math.max(1, Math.floor(rows));
  const cellW = width / C;
  const cellH = height / R;
  const items = [];
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const want = ICON_SIZE_MIN + rand() * (ICON_SIZE_MAX - ICON_SIZE_MIN);
      const size = Math.max(8, Math.min(want, cellW, cellH));
      const top = r * cellH + rand() * Math.max(0, cellH - size);
      const left = c * cellW + rand() * Math.max(0, cellW - size);
      const imgIndex = Math.min(iconCount - 1, Math.floor(rand() * iconCount));
      items.push({
        top: Math.round(top * 10) / 10,
        left: Math.round(left * 10) / 10,
        size: Math.round(size * 10) / 10,
        imgIndex,
      });
    }
  }
  return items;
}
