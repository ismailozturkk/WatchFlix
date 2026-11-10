// services/usageSharing.js
//
// "Kullanım istatistikleri ve hata raporları" tercihi — TEK SAHİP.
// Gizlilik Ayarları'ndaki anahtar burayı çağırır; analitik (Firebase Analytics)
// ve hata raporlama (Sentry) sarmalayıcıları kararı buradan alır.
//
// Varsayılan AÇIK. Kapatınca:
//   • Firebase Analytics: olay/ekran/kullanıcı özelliği gönderilmez, native
//     otomatik toplama da kapanır (kalıcı).
//   • Sentry: o oturumda hiçbir olay çıkmaz; sonraki açılışlarda SDK hiç başlamaz.
// Tercih cihazda tutulur (hesaba ya da yedeğe bağlı değil).
//
// Yayın denetimi 9 Kas 2026, G-2: kapatma fonksiyonu yazılmıştı ama hiçbir yerden
// çağrılmıyordu; kullanıcının toplamayı durdurma yolu yoktu.
import { Keys, get, set } from "./storage";
import { setAnalyticsEnabled, setAnalyticsUser } from "./analytics";
import {
  initCrashReporting,
  setCrashReportingEnabled,
  setCrashUser,
} from "./crashReporting";

export function isUsageSharingEnabled() {
  try {
    return get(Keys.usageSharing) !== false;
  } catch {
    return true;
  }
}

/**
 * Açılışta, initCrashReporting'den ÖNCE çağrılır: kayıtlı tercih iki
 * sarmalayıcıya uygulanır. Kapalıysa Sentry hiç başlamaz.
 */
export function applyUsageSharingPreference() {
  const enabled = isUsageSharingEnabled();
  setCrashReportingEnabled(enabled);
  // Açıkken native çağrıya gerek yok (varsayılan açık) — açılışta native modülü
  // boşuna uyandırmayalım; kapalıysa her açılışta yeniden bildir.
  if (!enabled) setAnalyticsEnabled(false);
  return enabled;
}

/** Kullanıcı anahtarı çevirdi. `uid`: yeniden açılırken oturumu geri bağlamak için. */
export function setUsageSharingEnabled(enabled, uid = null) {
  const next = Boolean(enabled);
  set(Keys.usageSharing, next);
  if (!next) {
    // Kimlik bağını da kopar: kapatıldıktan sonra kalan hiçbir şey kullanıcıya bağlanmasın.
    setAnalyticsUser(null);
  }
  setAnalyticsEnabled(next);
  setCrashReportingEnabled(next);
  if (next) {
    initCrashReporting();
    setAnalyticsUser(uid || null);
    setCrashUser(uid || null);
  }
  return next;
}
