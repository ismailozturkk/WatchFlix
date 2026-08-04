import AsyncStorage from "@react-native-async-storage/async-storage";
import { ANALYTICS_EVENTS, trackEvent } from "./analytics";

const FIRST_CONTENT_PREFIX = "analytics/first-content/";
const pendingByUser = new Map();

/**
 * Kullanıcının ilk gerçek izleme kaydını cihazda bir kez ölçer.
 *
 * Firestore yazımı başarıyla bittikten sonra çağrılır; ölçüm hiçbir zaman asıl
 * izleme akışını bekletmez veya bozmaz. UID anahtarı hesap değişimlerinde
 * kullanıcıların birbirinin aktivasyon bayrağını paylaşmasını engeller.
 */
export function trackFirstContentActivation(uid, params = {}) {
  if (!uid) return Promise.resolve(false);
  if (pendingByUser.has(uid)) return pendingByUser.get(uid);

  const task = (async () => {
    const key = `${FIRST_CONTENT_PREFIX}${uid}`;
    try {
      if (await AsyncStorage.getItem(key)) return false;
      await AsyncStorage.setItem(key, new Date().toISOString());
      trackEvent(ANALYTICS_EVENTS.FIRST_CONTENT_TRACKED, params);
      return true;
    } catch {
      // AsyncStorage kullanılamıyorsa ürün akışını etkileme. Bu oturumda aynı
      // olayı art arda üretmemek için in-flight guard yine de yeterlidir.
      return false;
    }
  })().finally(() => pendingByUser.delete(uid));

  pendingByUser.set(uid, task);
  return task;
}
