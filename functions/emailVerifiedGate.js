// functions/emailVerifiedGate.js
//
// E-POSTA DOĞRULAMA KAPISI (16 Kas 2026) — callable tarafı. firestore.rules'taki
// emailVerified() ile AYNI tanım: token'da email_verified == true YA DA oturum Google /
// Apple ile açılmış. Rastgele e-postayla açılan hesap AI, arama, oy, lig, eşleşme,
// referans kodu gibi callable'ları kullanamaz.
//
// KAPI DIŞINDA bırakılanlar (index.js): deleteAccountData + revokeAppleAuthorization
// (hesabını silmek isteyen engellenmez), check*SignInEligibility (giriş öncesi).

const { HttpsError } = require("firebase-functions/v2/https");

const FEDERATED = new Set(["google.com", "apple.com"]);

function isEmailVerifiedAuth(auth) {
  const token = auth?.token || {};
  if (token.email_verified === true) return true;
  return FEDERATED.has(token.firebase?.sign_in_provider);
}

/** Oturum + doğrulanmış e-posta şart; uid döner. */
function requireVerified(request) {
  if (!request?.auth) throw new HttpsError("unauthenticated", "Sign-in required");
  if (!isEmailVerifiedAuth(request.auth)) {
    throw new HttpsError("permission-denied", "email-not-verified");
  }
  return request.auth.uid;
}

module.exports = { isEmailVerifiedAuth, requireVerified };
