// utils/aiPrefs.js
//
// CineMatch (yapay zeka) tercihlerinin TEK şeması. Sohbet panelindeki hızlı
// ayarlar ile Ayarlar > Yapay zeka ekranı AYNI kaydı (Keys.aiCinePrefs) okuyup
// yazar; ikisinin sapmaması için doğrulama ve varsayılanlar yalnız burada.
//
// Saf JS: depolamaya ve React'a bağlı değil, testlerde doğrudan çalışır.
// Depoya bağlayan ince katman: hooks/useAiPrefs.js.
//
// ESKİ KAYITLAR: ilk sürümde yalnız enabled/watchList/favorites/custom/watched/
// mediaType/providerIds/genreKeys vardı. Yeni alanlar yoksa varsayılana düşer;
// eski bir kayıt hiçbir koşulda hata vermez ya da bozulmaz.

export const AI_RESPONSE_STYLES = Object.freeze(["concise", "balanced", "detailed"]);
export const AI_SPOILER_LEVELS = Object.freeze(["none", "light"]);
export const AI_MAX_ITEM_CHOICES = Object.freeze([3, 5, 8]);
export const AI_HISTORY_LIMITS = Object.freeze([10, 25, 50]);
export const AI_MEDIA_TYPES = Object.freeze(["all", "movie", "tv"]);

export const DEFAULT_AI_PREFS = Object.freeze({
  // Kütüphane kişiselleştirmesi (kapalıyken modele 0 token gider)
  enabled: false,
  watchList: true,
  favorites: true,
  custom: true,
  watched: true,
  // Keşif filtreleri
  mediaType: "all",
  providerIds: Object.freeze([]),
  genreKeys: Object.freeze([]),
  // Cevap stili
  responseStyle: "balanced",
  spoilerLevel: "none",
  maxItems: 5,
  // Akıllı davranışlar
  timeContext: true,
  avoidRepeats: true,
  showMatchScore: true,
  showFollowUps: true,
  // Sohbet geçmişi: saklanacak en çok konuşma sayısı
  historyLimit: 50,
});

const BOOLEAN_KEYS = [
  "enabled",
  "watchList",
  "favorites",
  "custom",
  "watched",
  "timeContext",
  "avoidRepeats",
  "showMatchScore",
  "showFollowUps",
];

const pickEnum = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

const pickBool = (value, fallback) => (typeof value === "boolean" ? value : fallback);

const pickNumberChoice = (value, allowed, fallback) => {
  const n = Number(value);
  return allowed.includes(n) ? n : fallback;
};

const uniqueNumbers = (list, allowed) => {
  const seen = new Set();
  const out = [];
  (Array.isArray(list) ? list : []).forEach((raw) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || seen.has(n)) return;
    if (allowed && !allowed.has(n)) return;
    seen.add(n);
    out.push(n);
  });
  return out;
};

/**
 * Depodan okunan (güvenilmeyen) kaydı tam, geçerli bir tercih nesnesine çevirir.
 *
 * @param {object|null} saved  Keys.aiCinePrefs değeri
 * @param {object} [context]
 * @param {number[]} [context.fallbackProviderIds]  Kayıtta platform seçimi hiç
 *   yoksa başlangıç olarak kullanılır (uygulamadaki "Platform üyeliklerim").
 * @param {Iterable<number>} [context.validProviderIds]  Bilinen platform kimlikleri
 * @param {Iterable<string>} [context.validGenreKeys]  Bilinen tür anahtarları
 */
export function normalizeAiPrefs(saved, context = {}) {
  const source = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  const validProviders = context.validProviderIds ? new Set(context.validProviderIds) : null;
  const validGenres = context.validGenreKeys ? new Set(context.validGenreKeys) : null;

  const providerIds = Array.isArray(source.providerIds)
    ? uniqueNumbers(source.providerIds, validProviders)
    : uniqueNumbers(context.fallbackProviderIds, validProviders);

  const genreKeys = [...new Set(Array.isArray(source.genreKeys) ? source.genreKeys : [])]
    .filter((key) => typeof key === "string" && (!validGenres || validGenres.has(key)));

  const prefs = {
    ...DEFAULT_AI_PREFS,
    mediaType: pickEnum(source.mediaType, AI_MEDIA_TYPES, DEFAULT_AI_PREFS.mediaType),
    providerIds,
    genreKeys,
    responseStyle: pickEnum(source.responseStyle, AI_RESPONSE_STYLES, DEFAULT_AI_PREFS.responseStyle),
    spoilerLevel: pickEnum(source.spoilerLevel, AI_SPOILER_LEVELS, DEFAULT_AI_PREFS.spoilerLevel),
    maxItems: pickNumberChoice(source.maxItems, AI_MAX_ITEM_CHOICES, DEFAULT_AI_PREFS.maxItems),
    historyLimit: pickNumberChoice(source.historyLimit, AI_HISTORY_LIMITS, DEFAULT_AI_PREFS.historyLimit),
  };
  BOOLEAN_KEYS.forEach((key) => {
    prefs[key] = pickBool(source[key], DEFAULT_AI_PREFS[key]);
  });
  return prefs;
}

/**
 * Kaydedilmemiş ham değerle yama birleştirir ve sonucu yeniden doğrular.
 * Yamadaki geçersiz değer sessizce önceki geçerli değere döner.
 */
export function mergeAiPrefs(current, patch, context) {
  return normalizeAiPrefs({ ...(current || {}), ...(patch || {}) }, context);
}

/** Süslü ayarların kullanıcıya gösterilecek özeti için kaç filtre açık? */
export function countDiscoveryFilters(prefs) {
  if (!prefs) return 0;
  return (
    (prefs.mediaType === "all" ? 0 : 1) +
    (prefs.providerIds?.length || 0) +
    (prefs.genreKeys?.length || 0)
  );
}

/** Varsayılandan farklı kaç AI ayarı var? (Ayarlar satırındaki "N özel ayar" rozeti) */
export function countCustomizedPrefs(prefs) {
  if (!prefs) return 0;
  let count = 0;
  const differs = (key) => prefs[key] !== DEFAULT_AI_PREFS[key];
  [
    "enabled",
    "responseStyle",
    "spoilerLevel",
    "maxItems",
    "timeContext",
    "avoidRepeats",
    "showMatchScore",
    "showFollowUps",
    "historyLimit",
  ].forEach((key) => {
    if (differs(key)) count += 1;
  });
  return count + countDiscoveryFilters(prefs);
}
