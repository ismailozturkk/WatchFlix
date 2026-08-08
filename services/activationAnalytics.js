import { Keys, get, set } from "./storage";
import { ANALYTICS_EVENTS, trackEvent } from "./analytics";

const pendingByUser = new Map();

/**
 * Kullanıcının ilk gerçek izleme kaydını cihazda bir kez ölçer.
 *
 * Firestore yazımı başarıyla bittikten sonra çağrılır; ölçüm hiçbir zaman asıl
 * izleme akışını bekletmez veya bozmaz. UID anahtarı hesap değişimlerinde
 * kullanıcıların birbirinin aktivasyon bayrağını paylaşmasını engeller.
 *
 * Damga çıkışta SİLİNMEZ (registry: firstContentAt → keepOnLogout): silinseydi
 * geri dönen kullanıcı aynı olayı ikinci kez üretir ve metrik şişerdi.
 */
export function trackFirstContentActivation(uid, params = {}) {
  if (!uid) return Promise.resolve(false);
  if (pendingByUser.has(uid)) return pendingByUser.get(uid);

  const task = (async () => {
    if (get(Keys.firstContentAt, { uid })) return false;
    if (!set(Keys.firstContentAt, new Date().toISOString(), { uid })) {
      // Depolama kullanılamıyorsa ürün akışını etkileme. Bu oturumda aynı olayı
      // art arda üretmemek için in-flight guard yine de yeterli.
      return false;
    }
    trackEvent(ANALYTICS_EVENTS.FIRST_CONTENT_TRACKED, params);
    return true;
  })().finally(() => pendingByUser.delete(uid));

  pendingByUser.set(uid, task);
  return task;
}
