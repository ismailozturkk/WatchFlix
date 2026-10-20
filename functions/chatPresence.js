"use strict";

// functions/chatPresence.js
//
// "Alıcı bu sohbeti şu an GERÇEKTEN ekranda tutuyor mu?" — push'u susturma kararı.
//
// İSTEMCİDEKİ KARŞILIĞI: services/presenceModel.js (isLiveFlag) ve
// services/chatSignals.js. İkisi AYNI tanımı kullanmak zorunda.
//
// ESKİ HATA: karar yalnız `chatMeta/{chatId}/inChat/{uid} === true` bayrağına
// bakıyordu. Bayrak, ani kapanışta (yeniden bağlanma sonrası) temizlenmeden
// kalabiliyordu; alıcı uygulamayı kapatmış olsa da o sohbetten gelen TÜM push'lar
// sonsuza dek susuyordu. Artık bayrağın değeri alıcının presence BAĞLANTI
// KİMLİĞİDİR ve push, yalnız o bağlantının /presence/{uid}/conns/{connId} kaydı
// hâlâ duruyorsa (soket açık + uygulama ön planda) susturulur. Soket ölünce kayıt
// silinir; bayrak takılı kalsa bile geçersizdir. Eski istemcinin boolean `true`
// bayrağı kanıtlanabilir olmadığından SAYILMAZ (push gider).

const MAX_CONN_ID_LENGTH = 64;

/** chatMeta bayrağından bağlantı kimliğini çıkarır; geçersizse null. */
function connIdFromFlag(value) {
  if (typeof value !== "string") return null;
  if (value.length === 0 || value.length > MAX_CONN_ID_LENGTH) return null;
  // RTDB yolu olarak kullanılacak: ayraç/izinsiz karakter içeremez.
  if (/[.#$\[\]/]/.test(value)) return null;
  return value;
}

/**
 * @param {{ ref: (path: string) => { get: () => Promise<{ val: () => any, exists: () => boolean }> } }} rtdb
 * @returns {Promise<boolean>}
 */
async function isRecipientViewingChat(rtdb, chatId, recipientUid) {
  if (!rtdb || !chatId || !recipientUid) return false;
  const flagSnap = await rtdb
    .ref(`chatMeta/${chatId}/inChat/${recipientUid}`)
    .get();
  const connId = connIdFromFlag(flagSnap.val());
  if (!connId) return false;
  const connSnap = await rtdb
    .ref(`presence/${recipientUid}/conns/${connId}`)
    .get();
  return connSnap.exists();
}

module.exports = { connIdFromFlag, isRecipientViewingChat };
