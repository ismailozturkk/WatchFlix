// utils/authPosterLayout.js
//
// Giriş / kayıt / şifre ekranlarının arka planındaki dağınık poster alanı için
// SAF yerleşim: her poster rastgele konum, boyut, eğim ve süzülme parametresi alır.
// Rastgelelik dışarıdan verilir (testte sabit tohum).
//
// Yerleşim "en iyi aday" yöntemiyle yapılır: her poster için birkaç rastgele aday
// denenir, önceden yerleşmişlerle en az örtüşen seçilir. Böylece posterler
// yığılmaz ama düzen de ızgara gibi görünmez.

export const POSTER_RATIO = 1.5; // yükseklik / genişlik (TMDB afişi 2:3)

/** Küçük, tohumlanabilir üreteç (mulberry32). */
export function seededRandom(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const overlapArea = (a, b) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

/**
 * @param {object} p
 * @param {number} p.width  alan genişliği
 * @param {number} p.height alan yüksekliği
 * @param {number} [p.count] poster sayısı
 * @param {() => number} [p.random] 0..1 üreteç
 * @returns {Array<{x,y,w,h,rotate,delay,duration,drift,opacity}>}
 *   x/y sol-üst köşe (alan dışına hafif taşabilir), rotate derece,
 *   delay/duration ms, drift px (dikey süzülme genliği), opacity 0..1 (göreli).
 */
export function generatePosterLayout({ width, height, count = 9, random = Math.random }) {
  if (!(width > 0) || !(height > 0) || count <= 0) return [];
  const minW = Math.max(54, width * 0.17);
  const maxW = Math.max(minW + 1, width * 0.38);
  const placed = [];
  const out = [];

  for (let i = 0; i < count; i++) {
    let best = null;
    for (let attempt = 0; attempt < 14; attempt++) {
      const w = minW + random() * (maxW - minW);
      const h = w * POSTER_RATIO;
      // Kenardan biraz taşmasına izin ver: kesik posterler "dağınık" hissi verir.
      const x = -w * 0.25 + random() * (width + w * 0.5 - w);
      const y = -h * 0.2 + random() * (height + h * 0.4 - h);
      const rect = { x, y, w, h };
      const score = placed.reduce((sum, other) => sum + overlapArea(rect, other), 0) / (w * h);
      if (!best || score < best.score) best = { rect, score };
      if (score === 0) break;
    }
    const { rect } = best;
    placed.push(rect);
    // Büyük (yakın) poster daha belirgin, küçük (uzak) daha silik: derinlik hissi.
    const depth = (rect.w - minW) / (maxW - minW);
    out.push({
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      rotate: (random() - 0.5) * 24,
      delay: Math.round(random() * 1800),
      duration: Math.round(5200 + random() * 4200),
      drift: Math.round(8 + random() * 14),
      opacity: 0.55 + depth * 0.45,
    });
  }
  return out;
}

/** Posterleri sırayla, tekrarsız dağıtır (liste kısaysa başa sarar). */
export function pickPosters(posters, count) {
  if (!Array.isArray(posters) || !posters.length) return [];
  return Array.from({ length: count }, (_, i) => posters[i % posters.length]);
}
