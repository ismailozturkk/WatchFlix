// services/referralService.js
//
// Arkadaş daveti + promosyon kodu: sunucu callable'ları (functions/index.js).
// Tüm veri Cloud Functions'a ait (firestore.rules kapalı); istemci yalnız bunları çağırır.

import { httpsCallable } from "firebase/functions";
import { fns } from "../firebase";

const call = (name) => async (payload = {}) => {
  const { data } = await httpsCallable(fns, name)(payload);
  return data;
};

/** Kodum, davet ettiklerim, kazandığım aylar ve (davetle geldiysem) indirimim. */
export const fetchReferralOverview = call("getReferralOverview");

/** Davet ya da promosyon kodunu kullanır. @returns {Promise<{kind: "promo"|"referral"}>} */
export const redeemCode = (code) => call("redeemCode")({ code });

/** Birikmiş davet ödülünü (1 ay ücretsiz Premium) başlatır. */
export const claimReferralReward = call("claimReferralReward");

/**
 * Callable hatasından sunucunun red gerekçesi (functions/referral.js REASONS).
 * Tanınmayan hata (ağ, kimlik) için null: çağıran genel mesaj gösterir.
 */
export function referralErrorReason(error) {
  const reason = error?.details?.reason || error?.message;
  return typeof reason === "string" && /^[a-z]+(-[a-z]+)+$/.test(reason) ? reason : null;
}
