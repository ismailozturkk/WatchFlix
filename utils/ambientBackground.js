// utils/ambientBackground.js
//
// "Ambiyans arka planı"nın SAF mantığı: leke paleti + her lekenin hareket yolu.
// Burada RN importu YOK (jest yalnız saf modülleri test edebiliyor, bkz.
// jest.config.js); çizim ve animasyon components/AmbientBackground.js'te.
//
// Görünüm: ekranın arkasında, bulanık (yumuşak kenarlı) rengârenk ışık
// lekeleri yavaşça süzülür. Leke = renkli radyal degrade; ayrıca bir blur
// filtresi çalıştırılmaz (Android'de hedefsiz blur sessizce düz katmana düşüyor
// ve her karede GPU'da yeniden çizilir — bkz. components/auth/AuthKit.js
// AuthBackdrop aynı gerekçeyle degrade kullanıyor).

import { clamp, hslToHex } from "./colorUtils";

/** Üretilen en fazla leke; efekt modu bunun bir ÖN DİLİMİNİ gösterir. */
export const AMBIENT_MAX_BLOBS = 5;

/** Hız 1'de yolun bir tur süresi. Tüm lekeler aynı turda tam sayıda salınır. */
export const AMBIENT_LOOP_MS = 48000;

/** Yol örnek sayısı. Native interpolasyon parçalı doğrusal; 48 adım, 3 salınımlı
 * sinüste bile kırılma görünmeyecek kadar sık (leke zaten yumuşak). */
export const AMBIENT_PATH_STEPS = 48;

const TAU = Math.PI * 2;
// Altın açı: ardışık lekelerin tonları birbirinden olabildiğince uzak düşer.
// Böylece 3 lekeye inen (Kapalı modu) dilim de "rengârenk" kalır.
const GOLDEN_ANGLE = 137.508;

// Çapa noktaları (ekran oranı). SIRA ÖNEMLİ: ilk üçü ekranı zaten dengeli
// kaplıyor (sol üst, sağ orta, sol alt); 4. ve 5. leke yalnız doldurur.
const ANCHORS = [
  [0.18, 0.16],
  [0.84, 0.42],
  [0.26, 0.84],
  [0.82, 0.9],
  [0.5, 0.5],
];

// Yumuşak kenarın gauss'a yakın profili: [yarıçap oranı, merkez opaklığının payı].
export const AMBIENT_FALLOFF = Object.freeze([
  [0, 1],
  [0.18, 0.88],
  [0.36, 0.62],
  [0.55, 0.34],
  [0.75, 0.12],
  [1, 0],
]);

const clamp01 = (v) => clamp(v, 0, 1);

/**
 * Rastgele ama dengeli bir leke seti üretir.
 *
 * @param {() => number} [rand]  [0,1) üreteci (testte tohumlanabilir)
 * @param {number} [count]       kaç leke (0..AMBIENT_MAX_BLOBS)
 * @returns {Array<object>} her leke: renk/ton, boyut, çapa, salınım genlik-frekans-fazı
 */
export function buildAmbientBlobs(rand = Math.random, count = AMBIENT_MAX_BLOBS) {
  const n = clamp(Math.floor(Number(count) || 0), 0, AMBIENT_MAX_BLOBS);
  const between = (lo, hi) => lo + rand() * (hi - lo);
  const pick = (list) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
  const baseHue = rand() * 360;

  return Array.from({ length: n }, (_, i) => {
    const hue = (((baseHue + i * GOLDEN_ANGLE + between(-12, 12)) % 360) + 360) % 360;
    const [ax, ay] = ANCHORS[i % ANCHORS.length];
    return {
      hue,
      // LOŞ palet: doygunluk ve açıklık bilerek düşük. İlk sürümde (78–95 / 52–62
      // ve alpha 0.46–0.62) renkler fazla canlı bulundu; ışık "ortamı" tonlasın,
      // gözü çekmesin.
      color: hslToHex(hue, between(62, 80), between(46, 56)),
      // Boyut `birim`in (ekranın uzun kenarının yarısı) katı.
      size: between(0.78, 1.2),
      cx: clamp01(ax + between(-0.07, 0.07)),
      cy: clamp01(ay + between(-0.07, 0.07)),
      // Salınım genliği ekran oranı; yatay daha geniş, dikey daha dar.
      ampX: between(0.1, 0.26),
      ampY: between(0.07, 0.18),
      // TAM SAYI frekans: tur bittiğinde leke başladığı noktada olur → döngü
      // atlamasız. Ondalık frekans buradaki en kolay yapılan hata.
      cyclesX: pick([1, 2, 3]),
      cyclesY: pick([1, 2]),
      phaseX: rand(),
      phaseY: rand(),
      // "Nefes alma": lekenin boyu da hafifçe değişir.
      scaleAmp: between(0.1, 0.22),
      scaleCycles: pick([1, 2]),
      scalePhase: rand(),
      alpha: between(0.3, 0.42),
    };
  });
}

/**
 * Bir lekenin tur boyunca konumu: 0..1 ilerleme → {x, y, scale}.
 * x/y EKRAN ORANI cinsinden sapmadır (çapadan), ölçekleme çizen tarafta.
 * Son örnek ilkine BİREBİR eşitlenir (kayan nokta hatası bile döngüde sıçrama
 * yaratmasın).
 */
export function sampleAmbientPath(blob, steps = AMBIENT_PATH_STEPS) {
  const input = [];
  const x = [];
  const y = [];
  const scale = [];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    input.push(t);
    x.push(Math.sin(TAU * (blob.cyclesX * t + blob.phaseX)) * blob.ampX);
    y.push(Math.sin(TAU * (blob.cyclesY * t + blob.phaseY)) * blob.ampY);
    scale.push(1 + Math.sin(TAU * (blob.scaleCycles * t + blob.scalePhase)) * blob.scaleAmp);
  }
  x[steps] = x[0];
  y[steps] = y[0];
  scale[steps] = scale[0];
  return { input, x, y, scale };
}

/** Hız çarpanına göre bir turun süresi. Çarpan [0.25, 2] aralığına sıkıştırılır. */
export function ambientLoopMs(speedScale = 1) {
  const s = clamp(Number(speedScale) || 1, 0.25, 2);
  return Math.round(AMBIENT_LOOP_MS / s);
}

/** Degrade durakları: merkez opaklığı `alpha` (0..1) ile ölçeklenir. */
export function ambientStops(alpha) {
  const a = clamp01(Number(alpha) || 0);
  return AMBIENT_FALLOFF.map(([offset, factor]) => ({
    offset,
    opacity: Math.round(a * factor * 1000) / 1000,
  }));
}
