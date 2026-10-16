// services/feedbackService.js
//
// Uygulama içi geri bildirim (hata bildirimi / özellik isteği) → `Feedback`
// koleksiyonu. Şekil ve sınırlar utils/feedbackValidation.js'te, plan kapısı
// firestore.rules'ta (Premium+ hata, yalnız Max özellik isteği).
//
// Koleksiyon yalnız create + "kendi kayıtlarını oku": durum (`status`) ve yönetici
// yanıtı (`reply`) Firebase konsolundan değişir, kullanıcı "Gönderdiklerim"
// listesinde görür. Gönderim metni analytics'e ASLA gitmez (yalnız tür/kategori).

import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { getIsOnline } from "../context/ConnectivityContext";
import {
  FEEDBACK_HISTORY_LIMIT,
  buildFeedback,
  normalizeFeedbackDoc,
  sortFeedback,
} from "../utils/feedbackValidation";
import { ANALYTICS_EVENTS, trackEvent } from "./analytics";

/** Sunucu bu süre içinde onaylamazsa kullanıcıya "sürüyor" denir (yazma kuyrukta kalır). */
export const FEEDBACK_SUBMIT_TIMEOUT_MS = 20000;

/**
 * Ekranın kullanıcıya doğru cümleyi seçebilmesi için kodlu hata:
 *   "invalid"  — form alanı geçersiz (`field` hangisi)
 *   "offline"  — cihaz çevrimdışı; yazma HİÇ başlatılmadı, taslak kalır
 *   "denied"   — kural reddetti (plan düşmüş / abonelik bitmiş olabilir)
 *   "timeout"  — sunucu zamanında yanıt vermedi; yazma kuyrukta, gitmiş olabilir
 *   "failed"   — diğer
 */
export class FeedbackError extends Error {
  constructor(code, { field = null, cause = null } = {}) {
    super(`feedback: ${code}${field ? ` (${field})` : ""}`);
    this.name = "FeedbackError";
    this.code = code;
    this.field = field;
    this.cause = cause;
  }
}

/**
 * Doğrulanmış geri bildirimi yazar.
 * @param {Parameters<typeof buildFeedback>[0]} input
 * @returns {Promise<{ id: string }>}
 */
export async function submitFeedback(input) {
  const built = buildFeedback(input);
  if (!built.ok) throw new FeedbackError("invalid", { field: built.error });
  // Çevrimdışıyken addDoc sunucu onayına kadar asılı kalır; kullanıcı metni yazıp
  // "gönderdim" sanmasın diye baştan reddedilir ve taslak ekranda durur.
  if (!getIsOnline()) throw new FeedbackError("offline");

  const write = addDoc(collection(db, "Feedback"), {
    ...built.data,
    createdAt: serverTimestamp(),
  });
  // Zaman aşımını kazanırsa `write` sonradan reddedilebilir; yakalanmamış kalmasın.
  write.catch(() => {});

  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new FeedbackError("timeout")), FEEDBACK_SUBMIT_TIMEOUT_MS);
  });

  try {
    const ref = await Promise.race([write, timeout]);
    trackEvent(ANALYTICS_EVENTS.FEEDBACK_SUBMITTED, {
      kind: built.data.kind,
      category: built.data.category,
    });
    return { id: ref.id };
  } catch (error) {
    if (error instanceof FeedbackError) throw error;
    throw new FeedbackError(error?.code === "permission-denied" ? "denied" : "failed", {
      cause: error,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Kullanıcının bu türdeki gönderdikleri, en yeni üstte. Sorgu `uid` süzgeci
 * taşımak zorunda (kural bunu ister); iki eşitlik süzgeci bileşik indeks istemez.
 *
 * @param {string} uid
 * @param {"bug"|"feature"} kind
 */
export async function loadMyFeedback(uid, kind) {
  if (!uid) return [];
  const snapshot = await getDocs(
    query(
      collection(db, "Feedback"),
      where("uid", "==", uid),
      where("kind", "==", kind),
      limit(FEEDBACK_HISTORY_LIMIT),
    ),
  );
  return sortFeedback(snapshot.docs.map((item) => normalizeFeedbackDoc(item.id, item.data())));
}
