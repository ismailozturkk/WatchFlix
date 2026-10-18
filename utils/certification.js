// utils/certification.js
//
// Yaş sınırı / içerik derecelendirmesi (PG-13, TV-MA, 13+, 18+ …) — SAF çekirdek (RN importu yok).
//
// VERİ ZATEN GELİYORDU: film detayı `release_dates`, dizi detayı `content_ratings` ile TMDB'den
// çekiliyor ama ekranda hiç gösterilmiyordu. Burada bölgeye göre doğru kaydı seçer ve rozet tonunu belirler.
//
// BÖLGE: kullanıcının bölgesi (TR/US/ES …) önce denenir; o bölgede kayıt yoksa ABD'ye düşülür ve sonuç
// `fallback: true` işaretlenir (rozet bölgeyi de yazar — "PG-13 · US" — Türkiye'de ABD derecesi
// Türkiye derecesi sanılmasın).
//
// FİLM tarafında bir bölgenin birden çok sürümü olur (sinema, dijital, TV …); sinema sürümünün
// derecesi tercih edilir, yoksa sırayla diğerleri.
// "NR / Not Rated / Unrated" gibi bilgi vermeyen değerler YOK sayılır (rozet çıkarmak yerine hiç çıkarma).

const FALLBACK_REGION = "US";

/** TMDB sürüm türü → öncelik (küçük = önce): 3 sinema, 4 dijital, 5 fiziksel, 6 TV, 2 sınırlı sinema, 1 prömiyer. */
const TYPE_PRIORITY = Object.freeze({ 3: 0, 4: 1, 5: 2, 6: 3, 2: 4, 1: 5 });

const UNINFORMATIVE = new Set(["nr", "not rated", "unrated", "ur", "n/a", "na", "-", "none", "tbd", "pending"]);

const clean = (value) => (typeof value === "string" ? value.trim() : "");
const usable = (value) => {
  const text = clean(value);
  return text.length > 0 && text.length <= 20 && !UNINFORMATIVE.has(text.toLowerCase());
};

const regionEntry = (results, region) =>
  Array.isArray(results) ? results.find((entry) => entry?.iso_3166_1 === region) : undefined;

/** Bir film kaydından (bölge girdisi) en uygun derece; yoksa null. */
function movieLabel(entry) {
  const candidates = (Array.isArray(entry?.release_dates) ? entry.release_dates : [])
    .filter((release) => usable(release?.certification))
    .map((release) => ({
      label: clean(release.certification),
      priority: TYPE_PRIORITY[release.type] ?? 99,
      date: String(release.release_date || ""),
    }))
    .sort((a, b) => a.priority - b.priority || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return candidates[0]?.label ?? null;
}

/** Bir dizi kaydından (bölge girdisi) derece; yoksa null. */
const tvLabel = (entry) => (usable(entry?.rating) ? clean(entry.rating) : null);

/**
 * @param {"movie"|"tv"} mediaType
 * @param {object} details  TMDB detay cevabı (`release_dates` / `content_ratings` eklenmiş)
 * @param {string} region   Kullanıcının TMDB bölgesi ("TR")
 * @returns {{ label: string, region: string, fallback: boolean } | null}
 */
export function certificationOf(mediaType, details, region) {
  const isTv = mediaType === "tv";
  const results = isTv ? details?.content_ratings?.results : details?.release_dates?.results;
  const pick = isTv ? tvLabel : movieLabel;
  const regions = region && region !== FALLBACK_REGION ? [region, FALLBACK_REGION] : [FALLBACK_REGION];
  for (const code of regions) {
    const label = pick(regionEntry(results, code));
    if (label) return { label, region: code, fallback: code !== region };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Ton                                                                 */
/* ------------------------------------------------------------------ */

// Harfli dereceler (sayı içermeyenler). Katlanmış, küçük harf.
const ALL_AGES = new Set([
  "g", "pg", "u", "uc", "l", "al", "all", "todos", "tp", "tv-y", "tv-g", "tv-pg", "genel izleyici", "genel", "0",
]);
const MATURE = new Set(["r", "nc-17", "tv-ma", "x", "ma", "ma15+", "r18+", "18"]);

/**
 * Rozet tonu: "all" (her yaş) · "teen" (genç/ebeveyn rehberliği) · "mature" (yetişkin) · "unknown".
 * Sayı varsa yaşa göre (≤8 her yaş, ≤14 genç, üstü yetişkin); yoksa bilinen harfli derecelere göre.
 */
export function certificationTone(label) {
  // Katlama: "Genel İzleyici".toLowerCase() "i̇" (i + birleşik nokta) üretir ve "izleyici" ile eşleşmezdi.
  const text = clean(label)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i");
  if (!text) return "unknown";
  if (ALL_AGES.has(text)) return "all";
  if (MATURE.has(text)) return "mature";
  const match = text.match(/\d+/);
  if (match) {
    const age = Number(match[0]);
    if (age <= 8) return "all";
    if (age <= 14) return "teen";
    return "mature";
  }
  return "unknown";
}
