// utils/notificationPresentation.js
//
// Uygulama ÖN PLANDAYKEN gelen bir bildirimin OS tarafından gösterilip
// gösterilmeyeceğinin tek karar noktası (expo-notifications handler'ı bunu
// çağırır). Saf fonksiyon: RN importu yok, jest doğrudan test eder.
//
// Kurallar (yalnız uygulama "active" iken; arka planda handler çağrılmaz, OS
// push'u kendi gösterir):
//   1. Backend'den gelen UZAK sosyal push → gizle. Aynı olayı Firestore
//      listener'ından üretilen yerel kopya (data.local === true) zaten, tür
//      ayarlarına saygı göstererek gösteriyor; ikisi birden çift bildirim olur.
//   2. Kullanıcı o mesajın sohbetini şu an izliyorsa → yerel kopya dahil
//      HİÇBİR banner/ses/liste kaydı yok. Mesajı sohbette canlı görüyor.
//      Karar, bildirim çıkmadan hemen önce handler'da verilir — listener'daki
//      erken kontrolden sonra kullanıcı sohbete girmiş olabilir (yarış).
//   3. Gerisi → göster.
//
// Rozet (`shouldSetBadge`) HER ZAMAN false: sayıyı uygulama kendisi hesaplayıp
// yazıyor (utils/appBadge.js). Handler'ın payload'daki sayıyı uygulaması, iki
// kaynağın birbirini ezip rozetin zıplamasına yol açardı.

export const SUPPRESSED = Object.freeze({
  shouldShowBanner: false,
  shouldShowList: false,
  shouldPlaySound: false,
  shouldSetBadge: false,
});

export const PRESENTED = Object.freeze({
  shouldShowBanner: true,
  shouldShowList: true,
  shouldPlaySound: true,
  shouldSetBadge: false,
});

/**
 * @param {object} args
 * @param {object} [args.data]               notification.request.content.data
 * @param {boolean} args.appActive            AppState === "active"
 * @param {(chatId: string) => boolean} args.chatIsActive
 */
export function decideForegroundPresentation({ data, appActive, chatIsActive }) {
  const payload = data || {};
  if (!appActive || payload.kind !== "social") return PRESENTED;

  if (payload.local !== true) return SUPPRESSED;

  if (payload.type === "message" && payload.chatId && chatIsActive?.(String(payload.chatId))) {
    return SUPPRESSED;
  }
  return PRESENTED;
}
