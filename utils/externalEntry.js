// utils/externalEntry.js
//
// Uygulamaya DIŞARIDAN giriş yolları — SAF (RN / ağ importu yok):
//   • Paylaş menüsü (share-intent): IMDb / TMDB uygulaması ya da tarayıcıdan "Paylaş → Seelogd" ile gelen bağlantı.
//   • Simge uzun basma kısayolları (quick actions).
// Yan etkili kısım (navigasyon, native modül) components/system/ExternalEntryHost.js'te; burada yalnız kararlar var,
// böylece jest ile doğrudan test edilir.

import { parseMediaLink } from "./mediaLinks";

/**
 * Paylaşılan içerikten film/dizi bağlantısı çıkarır.
 * iOS tarayıcı paylaşımı `webUrl`, bazı uygulamalar (IMDb uygulaması) `text` ("Başlık https://…") verir;
 * önce webUrl, sonra text denenir. Dosya (resim/video) paylaşımı yok sayılır.
 * @returns {ReturnType<typeof parseMediaLink>}
 */
export function linkFromShareIntent(shareIntent) {
  if (!shareIntent) return null;
  return parseMediaLink(shareIntent.webUrl) || parseMediaLink(shareIntent.text);
}

/** Bir paylaşım gerçekten işlenecek bir şey taşıyor mu? (boş / yalnız dosya paylaşımını eler) */
export function hasShareableText(shareIntent) {
  if (!shareIntent) return false;
  return Boolean(
    (typeof shareIntent.webUrl === "string" && shareIntent.webUrl.trim()) ||
      (typeof shareIntent.text === "string" && shareIntent.text.trim()),
  );
}

/**
 * Aynı paylaşımı iki kez işlememek için kararlı anahtar (iOS/Android aynı içeriği tekrar bildirebilir).
 */
export function shareIntentKey(shareIntent) {
  if (!shareIntent) return "";
  return `${shareIntent.webUrl || ""}|${shareIntent.text || ""}`;
}

/**
 * Simge kısayolları. `route` App.js'teki Stack ekran adıdır; adı değişirse kısayol sessizce çalışmaz,
 * bu yüzden __tests__/externalEntry.test.js adları App.js'e karşı denetler.
 * `sfSymbol` yalnız iOS'ta kullanılır (Android kısayol simgesi sistemin uygulama simgesine düşer).
 */
export const QUICK_ACTIONS = Object.freeze([
  { id: "search", route: "UnifiedSearch", params: { initialType: "movie", autoFocus: true }, sfSymbol: "magnifyingglass" },
  { id: "upnext", route: "UpNextScreen", params: undefined, sfSymbol: "play.circle" },
  { id: "reminders", route: "RemindersScreen", params: undefined, sfSymbol: "bell" },
  { id: "lists", route: "ListsViewScreen", params: undefined, sfSymbol: "list.bullet" },
]);

const BY_ID = new Map(QUICK_ACTIONS.map((a) => [a.id, a]));

/** Bilinmeyen kimlik (eski sürümden kalan kısayol) → null. */
export function routeForQuickAction(actionId) {
  const action = BY_ID.get(actionId);
  return action ? { name: action.route, params: action.params } : null;
}

/**
 * Native modüle verilecek liste. `titles` copy tablosundan gelir (dil değişince yeniden kurulur).
 * @param {Record<string,string>} titles
 * @param {"ios"|"android"|string} platform
 */
export function buildQuickActionItems(titles, platform) {
  return QUICK_ACTIONS.map((a) => ({
    id: a.id,
    title: titles?.[a.id] || a.id,
    icon: platform === "ios" ? `symbol:${a.sfSymbol}` : null,
    params: { href: a.route },
  }));
}

/**
 * React Navigation `linking.getStateFromPath` sarmalayıcısı.
 * expo-share-intent iOS'ta uygulamayı `seelogd://dataUrl=…` adresiyle açar; bu bir ekran yolu DEĞİL, paylaşım
 * kancası okur. Yoksayılmazsa React Navigation bilinmeyen yol diye ilk ekrana sıfırlamaya çalışabilir.
 */
export function wrapGetStateFromPath(getStateFromPath) {
  return (path, options) => {
    if (typeof path === "string" && path.includes("dataUrl=")) return undefined;
    return getStateFromPath(path, options);
  };
}
