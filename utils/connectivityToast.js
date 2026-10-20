// utils/connectivityToast.js
//
// Bağlantı durumu → toast kararı (saf; React yok, bkz. __tests__/connectivityToast.test.js).
//
// Kurallar
//   • Çevrimdışılık, `offlineDelayMs` boyunca SÜRERSE duyurulur: tünel/asansör gibi anlık
//     kopmalar (NetInfo `isInternetReachable` sık salınır) ekranı kirletmesin.
//   • "Tekrar çevrimiçi" yalnız çevrimdışı DUYURULMUŞSA söylenir; duyurulmayan kopma
//     için "döndü" demek anlamsız olurdu.
//   • Her çevrimdışı dönem tek duyuru: kopma sürerken tekrar tekrar toast açılmaz.
//   • Çevrimdışı toast'ı bağlantı dönünce kapatılır (başarı toast'ı daha düşük öncelikli,
//     kapatılmazsa uyarı bitene dek sırada beklerdi).

export const OFFLINE_DELAY_MS = 2500;

/**
 * @param {object} handlers
 * @param {() => (string|null|undefined)} handlers.onOffline  Toast'ı açar, kimliğini döndürür.
 * @param {(offlineToastId: string|null|undefined) => void} handlers.onOnline  Çevrimdışı toast'ı kapatıp "döndü" gösterir.
 * @param {number} [handlers.offlineDelayMs]
 * @param {{setTimeout?:Function, clearTimeout?:Function}} [timers]  Yalnız testler için.
 */
export function createConnectivityAnnouncer({ onOffline, onOnline, offlineDelayMs = OFFLINE_DELAY_MS }, timers = {}) {
  const setT = (fn, ms) => (timers.setTimeout || setTimeout)(fn, ms);
  const clearT = (handle) => (timers.clearTimeout || clearTimeout)(handle);

  let timer = null;
  let announced = false;
  let offlineToastId = null;
  let lastOnline = true;

  const cancelTimer = () => {
    if (timer != null) clearT(timer);
    timer = null;
  };

  return {
    /** Bağlantı durumu her değiştiğinde (ve ilk okumada) çağrılır. */
    update(isOnline) {
      const online = isOnline !== false;
      if (online === lastOnline) return;
      lastOnline = online;

      if (!online) {
        cancelTimer();
        timer = setT(() => {
          timer = null;
          announced = true;
          offlineToastId = onOffline() ?? null;
        }, offlineDelayMs);
        return;
      }

      cancelTimer();
      if (announced) {
        announced = false;
        const id = offlineToastId;
        offlineToastId = null;
        onOnline(id);
      }
    },
    /** Bileşen sökülürken bekleyen duyuruyu iptal eder. */
    dispose() {
      cancelTimer();
    },
  };
}
