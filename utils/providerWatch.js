// utils/providerWatch.js
//
// İzleme listesinde "Platformlarımda" süzgeci — SAF çekirdek. Burada RN/Firebase importu YOK
// (jest yalnız saf modülleri test edebiliyor).
//
// VERİ KAYNAĞI: `ProviderWatch/{uid}` (functions/index.js `dailyStreamingAvailability` yazar, istemci
// yalnız okur): { region, items: { "<movie|tv>_<id>": { a: [sağlayıcıId…], n: […] } }, updatedAt }.
// `a` = o bölgede ABONELİKLE / ücretsiz / reklamlı izlenebilen TÜM sağlayıcılar (kiralama/satın alma
// yok — functions/streamingDiff.js).
//
// ÜÇ SINIR (süzgeç bunları dürüstçe söyler, sessizce "yok" saymaz):
//   1. Belge YALNIZ "Yayına gelince bildir" açık, platform seçmiş ve bildirim jetonu olan kullanıcı
//      için yazılır. Diğerlerinde belge hiç yoktur → durum "no-data".
//   2. Belge yalnız TAKİP edilen başlıkları kapsar (Free 10 / Premium 100, izleme listesine en son
//      eklenenler). Kapsam dışı başlık "bilinmiyor"dur, "platformda yok" DEĞİL → `unknown`.
//   3. Günde bir yazılır (18:00 TR). `updatedAt` eskiyse kullanıcıya yaşı söylenir.
//
// BÖLGE: sağlayıcı kümesi bölgeye bağlıdır. Belgenin bölgesi, uygulama dilinden türeyen şimdiki
// bölgeden farklıysa (dil değişti, sunucu henüz yeniden yazmadı) veri KULLANILMAZ → "region".

/** Bu kadar günden eski denetim için yaş notu gösterilir. */
export const STALE_AFTER_DAYS = 2;

const DAY_MS = 86400000;

const toIds = (list) =>
  (Array.isArray(list) ? list : []).map(Number).filter((id) => Number.isInteger(id) && id > 0);

const toMillis = (value) => {
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return 0;
};

/** İzleme listesi öğesinin belgedeki anahtarı: "movie_123" / "tv_456". */
export function providerKey(item) {
  const id = Number(item?.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  return `${item?.type === "tv" ? "tv" : "movie"}_${id}`;
}

/**
 * Firestore belge verisini güvenli biçime çevirir. Belge yoksa/bozuksa null.
 * @returns {{ region: string, updatedAtMs: number, items: Record<string, number[]> } | null}
 */
export function normalizeProviderWatch(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const items = {};
  const source = raw.items && typeof raw.items === "object" && !Array.isArray(raw.items) ? raw.items : {};
  for (const [key, value] of Object.entries(source)) {
    if (!/^(movie|tv)_\d+$/.test(key)) continue;
    items[key] = toIds(value?.a);
  }
  return {
    region: typeof raw.region === "string" ? raw.region : "",
    updatedAtMs: toMillis(raw.updatedAt),
    items,
  };
}

/**
 * Bir başlık kullanıcının platformlarında izlenebilir mi?
 * @returns {"yes"|"no"|"unknown"} `unknown`: belge bu başlığı hiç taramamış
 */
export function classifyTitle(snapshot, item, myProviderIds) {
  const key = providerKey(item);
  if (!snapshot || !key) return "unknown";
  const available = snapshot.items[key];
  if (!available) return "unknown";
  const mine = new Set(toIds(myProviderIds));
  return available.some((id) => mine.has(id)) ? "yes" : "no";
}

/** Kullanıcının platformlarından hangilerinde izlenebilir (kimlikler; rozet/metin için). */
export function platformsOfTitle(snapshot, item, myProviderIds) {
  const key = providerKey(item);
  const available = snapshot && key ? snapshot.items[key] : null;
  if (!available) return [];
  const mine = new Set(toIds(myProviderIds));
  return available.filter((id) => mine.has(id));
}

/**
 * Süzgecin durumu ve sayıları.
 *
 * state:
 *   "off"      kullanıcı hiç platform seçmemiş
 *   "no-data"  belge yok / hiçbir başlık taranmamış (bildirim kapalı, ilk çalışma bekleniyor…)
 *   "region"   belgenin bölgesi şimdiki bölgeden farklı
 *   "ready"    kullanılabilir (`yes` 0 olabilir)
 *
 * @param {object} p
 * @param {ReturnType<typeof normalizeProviderWatch>} p.snapshot
 * @param {number[]} p.myProviderIds
 * @param {string} p.region şimdiki bölge ("TR" …)
 * @param {Array<{id:number,type?:string}>} p.items süzülecek izleme listesi
 * @param {number} [p.now]
 */
export function planPlatformFilter({ snapshot, myProviderIds, region, items, now = Date.now() }) {
  const mine = toIds(myProviderIds);
  const base = { counts: { yes: 0, no: 0, unknown: 0, total: 0 }, ageDays: null };
  if (mine.length === 0) return { state: "off", ...base };
  if (!snapshot || Object.keys(snapshot.items).length === 0) return { state: "no-data", ...base };
  if (snapshot.region && region && snapshot.region !== region) return { state: "region", ...base };

  const counts = { yes: 0, no: 0, unknown: 0, total: 0 };
  for (const item of Array.isArray(items) ? items : []) {
    counts[classifyTitle(snapshot, item, mine)] += 1;
    counts.total += 1;
  }
  const ageDays = snapshot.updatedAtMs > 0 ? Math.max(0, Math.floor((now - snapshot.updatedAtMs) / DAY_MS)) : null;
  return { state: "ready", counts, ageDays };
}

/** Yaş notu gerekir mi? (denetim beklenenden eskiyse) */
export const isStale = (ageDays) => ageDays !== null && ageDays > STALE_AFTER_DAYS;
