"use strict";

// Arkadaş araması (`searchUsers` callable) için saf çekirdek: arama teriminin normalizasyonu/doğrulaması ve
// sonucun yalnız arama kartının kullandığı alanlara indirgenmesi. Firestore bağlantısı index.js'te.
// Testler emülatörsüz çalışır: userSearch.test.js.
//
// NEDEN CALLABLE (2026-10-31 denetimi H-1): arama eskiden istemcide Users koleksiyonunu doğrudan sorguluyordu;
// bunun için kural koleksiyonun LİSTELENMESİNE izin vermek zorundaydı ve oturum açan herkes kullanıcı tabanını
// sayfalayıp kazıyabiliyordu. Callable kullanıcı başına hız sınırlıdır ve tüm profil belgesi (plan, gizlilik
// ayarları…) yerine yalnız beş alan döndürür.
//
// İstemci aynası: services/userService.normalizeUsername (aynı dönüşüm).

const SEARCH_LIMIT = 20;
// Kullanıcı adları [a-z0-9_] ve en fazla 20 karakter (services/userService.USERNAME_REGEX). Bu kümenin
// dışındaki bir terim hiçbir adla eşleşemez → sorguya hiç gitmez.
const TERM_RE = /^[a-z0-9_]{1,20}$/;
// Ön-ek aralığının üst ucu: Firestore dizgeleri UTF-8 sırasıyla karşılaştırır, U+F8FF her adın üstünde kalır.
const PREFIX_END = "";

/** Ham terim → küçük harfli ön-ek; geçersizse null. */
function normalizeSearchTerm(raw) {
  if (typeof raw !== "string") return null;
  const term = raw.trim().replace(/İ/g, "i").replace(/I/g, "i").toLowerCase();
  return TERM_RE.test(term) ? term : null;
}

/** Profil belgesi → arama kartının alanları (başka hiçbir alan dışarı çıkmaz). */
function toSearchResult(uid, data) {
  const d = data || {};
  return {
    uid,
    username: typeof d.username === "string" ? d.username : "",
    displayName: typeof d.displayName === "string" ? d.displayName : "",
    avatarIndex: typeof d.avatarIndex === "number" ? d.avatarIndex : 0,
    photoURL: typeof d.photoURL === "string" ? d.photoURL : null,
  };
}

/**
 * Sorgu sonucunu (fazladan bir kayıtla çekilir) aramayı yapanı çıkarıp sınıra keser.
 * @param {Array<{id: string, data: () => object}>} docs
 */
function pickResults(docs, callerUid, max = SEARCH_LIMIT) {
  return (docs || [])
    .filter((doc) => doc.id !== callerUid)
    .slice(0, max)
    .map((doc) => toSearchResult(doc.id, doc.data()));
}

module.exports = { SEARCH_LIMIT, PREFIX_END, normalizeSearchTerm, toSearchResult, pickResults };
