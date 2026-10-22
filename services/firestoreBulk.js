// services/firestoreBulk.js
//
// Toplu Firestore silme yardımcıları — hesap silme / sıfırlama (accountService,
// accountResetService) ve arkadaşlıktan çıkarırken sohbeti silme (friendsService)
// ortak kullanır. Yalnız firebase/firestore'a bağlıdır; hafif kalsın diye ayrı dosya
// (friendsService, accountService'in ağır bağımlılık zincirini çekmesin).

import { getDocs, writeBatch } from "firebase/firestore";
import { db } from "../firebase";

const CHUNK = 450; // Firestore batch limiti 500 — güvenli pay bıraktık.

/** Verilen referansları 450'lik batch'ler hâlinde siler. */
export async function deleteRefsInChunks(refs) {
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = writeBatch(db);
    refs.slice(i, i + CHUNK).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

/**
 * Bir koleksiyonun tüm (üst seviye) dokümanlarını siler. Alt koleksiyonları
 * otomatik silmez — onları çağıran taraf ayrıca temizlemeli.
 * @returns silinen doküman anlık görüntüleri
 */
export async function deleteCollection(colRef) {
  const snap = await getDocs(colRef);
  if (!snap.empty) await deleteRefsInChunks(snap.docs.map((d) => d.ref));
  return snap.docs;
}
