// utils/olderGame.js
//
// "Önce hangisi?" hızlı oyununun SAF çekirdeği: iki afiş çıkar, oyuncu hangisinin DAHA ÖNCE çıktığını
// seçer. Üç can, art arda doğru sayısı skor. RN/Firebase importu YOK.
//
// SORU KAYNAĞI: Sahne Tahmin'in başlık havuzu (services/sceneGameService.fetchTitlePool). Havuz öğelerinde
// çıkış YILI var (film `release_date`, dizi `first_air_date` ilk dört hanesi), oy ortalaması YOK; bu yüzden
// soru yalnız "hangisi daha eski". Aynı yılda çıkanlar asla eşleşmez (cevabı olmayan soru olmaz).
//
// ZORLUK = yıl farkı: seri ilerledikçe iki yapım arasındaki en küçük fark düşer (20 yıl → 1 yıl). Uygun çift
// bulunamazsa fark kademeli gevşetilir; oyun, "çift çıkmadığı için" bitmez.
//
// SKOR KAYDI cihaz-yerel (Keys.olderGame): liderlik tablosu, XP ve günlük hak YOK. Sahne Tahmin'in skor/oturum
// hattına dokunulmaz (o hat sunucu doğrulamalı ve karmaşık); bu oyun hafif ve çevrimdışı havuzla da çalışır.

export const OLDER_LIVES = 3;
export const OLDER_RECENT_WINDOW = 40; // art arda tekrarı önlemek için son kaç yapım "kullanılmış" sayılır

/** Seri → izin verilen EN KÜÇÜK yıl farkı. */
export function gapForStreak(streak) {
  const s = Math.max(0, Math.trunc(Number(streak)) || 0);
  if (s < 3) return 20;
  if (s < 6) return 12;
  if (s < 10) return 7;
  if (s < 15) return 4;
  if (s < 22) return 2;
  return 1;
}

const yearOf = (item) => {
  const year = Number(String(item?.year ?? "").slice(0, 4));
  return Number.isInteger(year) && year >= 1888 ? year : null; // ilk film 1888
};

const keyOf = (item) => item?.mediaKey || `${item?.type}_${item?.id}`;

/** Soru olabilecek öğe: yılı ve afişi var. */
export const isUsable = (item, maxYear = new Date().getFullYear() + 1) => {
  const year = yearOf(item);
  return year !== null && year <= maxYear && !!item?.posterPath && !!item?.id;
};

/**
 * Bir çift seçer.
 *
 * @param {object} p
 * @param {Array}  p.pool          havuz öğeleri
 * @param {number} p.streak        şu anki seri (zorluğu belirler)
 * @param {Set<string>} [p.recent] yakın zamanda sorulmuş mediaKey'ler
 * @param {() => number} [p.rng]   [0,1) üreteç (test için)
 * @param {number} [p.maxYear]
 * @returns {{ a: object, b: object, olderKey: string, gap: number } | null} Havuz çok küçükse null.
 */
export function pickPair({ pool, streak = 0, recent = new Set(), rng = Math.random, maxYear } = {}) {
  const usable = (Array.isArray(pool) ? pool : []).filter((item) => isUsable(item, maxYear));
  if (usable.length < 2) return null;
  // Önce "yakın zamanda sorulmamış" olanlar; yetmezse tümü.
  const fresh = usable.filter((item) => !recent.has(keyOf(item)));
  const base = fresh.length >= 2 ? fresh : usable;

  const target = gapForStreak(streak);
  // Hedef farktan başlayıp 1'e kadar gevşet; her adımda uygun çiftleri topla.
  for (let gap = target; gap >= 1; gap = gap > 12 ? gap - 8 : gap > 4 ? gap - 3 : gap - 1) {
    const first = base[Math.floor(rng() * base.length)];
    const firstYear = yearOf(first);
    // Önce rastgele birinci öğeyle eşleşen adaylar (ucuz); yoksa tüm çiftleri tara.
    let candidates = base.filter((item) => item !== first && Math.abs(yearOf(item) - firstYear) >= gap);
    let left = first;
    if (candidates.length === 0) {
      const pairs = [];
      for (let i = 0; i < base.length; i += 1) {
        for (let j = i + 1; j < base.length; j += 1) {
          if (Math.abs(yearOf(base[i]) - yearOf(base[j])) >= gap) pairs.push([base[i], base[j]]);
        }
      }
      if (pairs.length === 0) continue;
      const [x, y] = pairs[Math.floor(rng() * pairs.length)];
      left = x;
      candidates = [y];
    }
    const right = candidates[Math.floor(rng() * candidates.length)];
    // Sol/sağ yerleşim de rastgele: eski olan hep solda olmasın.
    const flip = rng() < 0.5;
    const a = flip ? right : left;
    const b = flip ? left : right;
    return {
      a,
      b,
      olderKey: yearOf(a) < yearOf(b) ? keyOf(a) : keyOf(b),
      gap: Math.abs(yearOf(a) - yearOf(b)),
    };
  }
  return null;
}

/**
 * Cevap değerlendirmesi.
 * @returns {{ correct: boolean, olderKey: string, years: {a: number, b: number} }}
 */
export function judgeAnswer(pair, chosenKey) {
  return {
    correct: chosenKey === pair.olderKey,
    olderKey: pair.olderKey,
    years: { a: yearOf(pair.a), b: yearOf(pair.b) },
  };
}

export const pairKeys = (pair) => [keyOf(pair.a), keyOf(pair.b)];
export const keyOfItem = keyOf;

/** Yakın-zaman penceresine ekler (en eski çıkar). Yeni küme döner. */
export function pushRecent(recent, pair, windowSize = OLDER_RECENT_WINDOW) {
  const list = [...recent, ...pairKeys(pair)];
  return new Set(list.slice(-windowSize));
}

// ── Kayıt (cihaz-yerel) ─────────────────────────────────────────────────────

const clampInt = (value, max = 1e9) => Math.max(0, Math.min(max, Math.trunc(Number(value)) || 0));

/** Depodan okunan ham değer → güvenli biçim: { best, plays, correct, answered }. */
export function normalizeOlderStats(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const answered = clampInt(source.answered);
  return {
    best: clampInt(source.best, 100000),
    plays: clampInt(source.plays),
    correct: Math.min(clampInt(source.correct), answered),
    answered,
  };
}

/**
 * Biten bir koşuyu kayda işler. `score` = doğru sayısı, `answered` = cevaplanan soru.
 * @returns {{ stats: object, newBest: boolean, previousBest: number }}
 */
export function recordOlderRun(rawStats, { score, answered }) {
  const stats = normalizeOlderStats(rawStats);
  const s = clampInt(score, 100000);
  const a = Math.max(s, clampInt(answered));
  const next = {
    best: Math.max(stats.best, s),
    plays: stats.plays + 1,
    correct: stats.correct + s,
    answered: stats.answered + a,
  };
  return { stats: next, newBest: s > stats.best && s > 0, previousBest: stats.best };
}

export const olderAccuracy = (stats) => {
  const { correct, answered } = normalizeOlderStats(stats);
  return answered ? Math.round((correct / answered) * 100) : 0;
};

/** Depoya yazılacak değer: hiç oynanmadıysa `null` (anahtar silinir). */
export const toStoredOlderStats = (stats) => {
  const normalized = normalizeOlderStats(stats);
  return normalized.plays > 0 ? normalized : null;
};
