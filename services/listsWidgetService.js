import { callWidget, widgetPosterUrl } from "./widgetBridge";
import { sortItemsByListOrder } from "../utils/listOrder";
import { getListAccent, getListIcon } from "../utils/listAppearance";

/**
 * "Listelerim" ana ekran widget'ının veri katmanı.
 *
 * Widget Firestore'a İKİNCİ bir bağlantı açmaz: ProfileStatsContext'in zaten
 * canlı tuttuğu liste verisinin küçük bir özetini (ad + aksan + poster URL'leri)
 * yerel native depoya aktarır. Widget buradan çizilir, uygulama kapalıyken de
 * son senkronize listeleri gösterir.
 *
 * Payload sözleşmesi (Android ListsWidgetProvider.kt / iOS lists-widget.swift):
 *   [{ key, name, accent, icon, count, posters: [url] }]
 */

const ANDROID_MODULE = "ListsWidgetModule";

// Profil rayındaki (ProfileLists.js) korunan liste sırası — widget'taki
// seçici de aynı sırayla dolaşsın diye birebir aynı.
const PROTECTED_ORDER = ["watchedTv", "watchedMovies", "watchList", "favorites"];

// Seçicide dolaşılabilir liste sayısı. 12'nin üstü ok tuşlarıyla gezilemez
// hale gelir; SharedPreferences payload'u da gereksiz şişer.
export const MAX_LISTS = 12;

// Liste başına gönderilen poster sayısı — 3 sütunlu ızgarada 12 satır.
// Üst sınır bitmap cache'ine göre seçildi (bkz. ListsWidgetRemoteViewsService).
export const MAX_POSTERS = 36;

// w342: ızgara hücresi ~90dp; w185 büyütülünce yumuşuyor.
const posterUrl = (path) => widgetPosterUrl(path, "w342");

const displayName = (key, labels) => {
  switch (key) {
    case "watchedMovies":
      return labels?.watchedMovies || "İzlenen Filmler";
    case "watchedTv":
      return labels?.watchedTvSeries || "İzlenen Diziler";
    case "favorites":
      return labels?.favorite || "Favoriler";
    case "watchList":
      return labels?.watchList || "İzlenecekler";
    default:
      return key;
  }
};

/**
 * @param {Array<[string, Array]>} lists ProfileStatsContext.lists (displayLists)
 * @param {object} labels t.profileScreen.ProfileLists — korunan liste adları
 */
export const buildListsWidgetPayload = (lists, labels) => {
  const entries = Array.isArray(lists) ? lists : [];
  const byKey = new Map(
    entries.filter((entry) => Array.isArray(entry)).map(([key, items]) => [key, items]),
  );

  const ordered = [
    // Korunan listeler sabit sırada; olmayanı atla.
    ...PROTECTED_ORDER.filter((key) => byKey.has(key)).map((key) => [key, byKey.get(key)]),
    // Özel listeler alfabetik — profil rayıyla aynı.
    ...entries
      .filter(([key]) => !PROTECTED_ORDER.includes(key))
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  ];

  return ordered.slice(0, MAX_LISTS).map(([key, items]) => {
    const sorted = sortItemsByListOrder(items);
    return {
      key,
      name: displayName(key, labels),
      accent: getListAccent(key),
      icon: getListIcon(key),
      // Sayı TÜM listeyi anlatır; posters yalnız gösterilen ilk parçadır.
      count: sorted.length,
      posters: sorted
        .slice(0, MAX_POSTERS)
        .map((item) => posterUrl(item?.imagePath))
        .filter(Boolean),
    };
  });
};

export const syncListsWidget = (lists, labels, language = "tr") =>
  callWidget(
    ANDROID_MODULE,
    "updateLists",
    JSON.stringify(buildListsWidgetPayload(lists, labels)),
    language,
  );

export const clearListsWidget = () => callWidget(ANDROID_MODULE, "clearLists");
