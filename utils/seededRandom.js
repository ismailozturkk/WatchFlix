// utils/seededRandom.js
//
// Oyun motorunun rastgelelik kaynağı. İKİ KAYNAK var ve ikisi aynı arayüzü
// paylaşır (`shuffle(dizi, tuz)` + `int(min, max, tuz)`), böylece soru üreten
// kod hangisinin takılı olduğunu bilmeden çalışır:
//
//   • randomSource            → her oyunda farklı (Math.random, Fisher–Yates)
//   • createStableSource(...) → aynı tohum = aynı sonuç (Günlük Meydan Okuma)
//
// NEDEN "mulberry32 ile diziyi karıştır" DEĞİL, hash sıralaması: günlük sorular
// herkeste aynı olmalı ama TMDB listesi gün içinde kıyıda 1-2 kayıt oynatabilir.
// Sıralı bir rastgele sayı akışıyla karıştırılan dizide TEK bir kayıt eklenip
// çıkınca bütün seçimler kayar. Her kaydı kendi anahtarının hash'iyle sıralarsak
// (rendezvous hashing) yalnız o kaydın yeri değişir; geri kalan seçim aynı kalır.
//
// Saf modül: React/RN/Firebase bağımlılığı yok, jest'te doğrudan çalışır.

/** Dizgeyi 32-bit işaretsiz tam sayıya karıştırır (xmur3 tabanlı). */
export function hashString(input) {
  const str = String(input);
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Tohumdan [0, 1) üreten deterministik üreteç (mulberry32). */
export function createRng(seed) {
  let state = (typeof seed === "number" ? seed : hashString(seed)) >>> 0;
  return function rng() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** [min, max] aralığında (uçlar dahil) tam sayı. */
export const randomIntWith = (rng, min, max) =>
  Math.floor(rng() * (max - min + 1)) + min;

/** Fisher–Yates; girdiyi bozmaz. `Array.sort(() => Math.random() - 0.5)` ÇARPIK
 *  dağılım verir (ilk elemanlar yerinde kalmaya meyleder). */
export function shuffleWith(list, rng = Math.random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const keyOfItem = (item) => {
  if (item && typeof item === "object") {
    if (item.mediaKey) return String(item.mediaKey);
    if (item.type !== undefined && item.id !== undefined) return `${item.type}_${item.id}`;
    if (item.id !== undefined) return String(item.id);
  }
  return String(item);
};

/** Her oyunda farklı sonuç veren kaynak. */
export const randomSource = Object.freeze({
  stable: false,
  shuffle: (list) => shuffleWith(list),
  int: (min, max) => randomIntWith(Math.random, min, max),
  // (0, 1) açık aralığında sayı; ağırlıklı seçim (utils/gameSelection) kullanır.
  float: () => Math.random() || Number.EPSILON,
});

/**
 * Aynı tohum + aynı tuz → aynı sonuç. `tuz`, aynı tohumdan bağımsız birden çok
 * karar çıkarmak içindir ("correct:3", "opt:movie_550"...).
 */
export function createStableSource(seed) {
  const base = String(seed);
  return {
    stable: true,
    shuffle(list, salt = "") {
      return list
        .map((item) => {
          const key = keyOfItem(item);
          return { item, key, rank: hashString(`${base}|${salt}|${key}`) };
        })
        .sort((a, b) => a.rank - b.rank || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
        .map((entry) => entry.item);
    },
    int(min, max, salt = "") {
      const span = max - min + 1;
      if (span <= 1) return min;
      return min + (hashString(`${base}|${salt}`) % span);
    },
    // (0, 1) açık aralığı: 0 ve 1 hariç olduğundan log() güvenle alınabilir.
    float(salt = "") {
      return (hashString(`${base}|${salt}`) + 0.5) / 4294967296;
    },
  };
}
