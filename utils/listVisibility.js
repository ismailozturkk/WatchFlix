// utils/listVisibility.js
//
// "Profilinde görünen listeler" (Users/{uid}.listVisible) için saf çekirdek.
//
// NE KONTROL EDER: arkadaşın (ya da profilini görebilen biri) profiline baktığında
// hangi listelerinin orada çizileceğini (FriendProfileScreen `visibleLists`) ve zevk
// uyumu hesabına hangi öntanımlı listelerin gireceğini (`friendSide`). Harita ADA
// bağlıdır; yeni oluşturulan her liste `true` ile açık başlar.
//
// NE KONTROL ETMEZ: sunucu tarafı erişim. Kural (firestore.rules → canReadLists)
// yalnız `privacy.lists` (herkes / arkadaşlar / yalnız ben) düzeyinde çalışır;
// kök doküman tüm listeleri birlikte taşıdığı için liste-başına ayrım kuralda
// yapılamaz. Bu yüzden ekrandaki metin "profilde gösterilmez" der, "kimse
// okuyamaz" demez.
//
// Eski dizi biçimi ([{ ad: true }, …]) okunurken haritaya çevrilir; yazımı
// migrateUserIfNeeded dönüştürür (services/userService.js).

export const PREDEFINED_LIST_ORDER = ["favorites", "watchList", "watchedMovies", "watchedTv"];

/** Ham `listVisible` değerini `{ ad: boolean }` haritasına indirger. */
export function normalizeListVisible(raw) {
  if (Array.isArray(raw)) {
    const map = {};
    raw.forEach((entry) => {
      if (entry && typeof entry === "object") Object.assign(map, entry);
    });
    return map;
  }
  return raw && typeof raw === "object" ? { ...raw } : {};
}

/** Profilde gösterilme kuralı FriendProfileScreen ile aynı: yalnız açıkça `true`. */
export const isListShown = (visibleMap, name) => visibleMap?.[name] === true;

/**
 * Ekran satırları: dört öntanımlı liste sabit sırada, ardından özel listeler ada
 * göre. `lists` → `{ ad: öğeDizisi }` (ListStatusContext.combinedLists biçimi).
 */
export function buildListVisibilityRows(lists, visibleMap, locale) {
  const entries = Object.entries(lists || {}).filter(([, items]) => Array.isArray(items));
  const predefined = PREDEFINED_LIST_ORDER.filter((name) => entries.some(([n]) => n === name));
  const custom = entries
    .map(([name]) => name)
    .filter((name) => !PREDEFINED_LIST_ORDER.includes(name))
    .sort((a, b) => a.localeCompare(b, locale));
  return [...predefined, ...custom].map((name) => ({
    name,
    count: lists[name].length,
    shown: isListShown(visibleMap, name),
    predefined: PREDEFINED_LIST_ORDER.includes(name),
  }));
}

/** `{ shown, total }` — kaç liste açık. */
export function summarizeListVisibility(rows) {
  return { shown: rows.filter((row) => row.shown).length, total: rows.length };
}

// Kitle sıralaması: dar olan kazanır.
const AUDIENCE_RANK = { private: 0, friends: 1, public: 2 };
const audienceOf = (value) => (value in AUDIENCE_RANK ? value : "public");

/**
 * Listeleri GERÇEKTE kimin görebildiği. FriendProfileScreen `canViewLists`
 * profil görünürlüğünü de şart koşar: profil "arkadaşlar"ken listeler "herkese
 * açık" olsa bile yalnız arkadaşlar görür. `limitedByProfile` bu durumu işaretler
 * (ekran "neden" diye açıklar).
 */
export function effectiveListAudience(privacy) {
  const profile = audienceOf(privacy?.profile);
  const lists = audienceOf(privacy?.lists);
  const limitedByProfile = AUDIENCE_RANK[profile] < AUDIENCE_RANK[lists];
  return { audience: limitedByProfile ? profile : lists, limitedByProfile };
}

/** Tümünü aç/kapat yazımı: yalnız DEĞİŞEN listeler (gereksiz alan yazımı yok). */
export function bulkVisibilityChanges(rows, shown) {
  const changes = {};
  rows.forEach((row) => {
    if (row.shown !== shown) changes[row.name] = shown;
  });
  return changes;
}
