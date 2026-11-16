// utils/emailVerificationGate.js
//
// E-POSTA DOĞRULAMA KAPISI (16 Kas 2026). Rastgele (sahibi olmadığı) bir e-postayla kayıt
// olup liste ekleme / oy verme / mesaj atma gibi spam işlemleri yapılabiliyordu. Artık
// e-posta + şifre hesabı, e-postası doğrulanana kadar uygulamaya GİREMEZ:
//   • İstemci: AuthContext bu kullanıcıyı `user` olarak yayınlamaz; App.js gezgin yerine
//     EmailVerificationScreen'i çizer (sekme, dinleyici, yazım hiçbiri kurulmaz).
//   • Sunucu: firestore.rules `isSignedIn()` → e-posta doğrulanmış olmalı; callable'lar
//     functions/emailVerifiedGate.js; RTDB sohbet meta yazımları database.rules.json.
//
// Google / Apple hesapları sağlayıcı tarafından doğrulanmış sayılır (kuraldaki
// sign_in_provider istisnasıyla aynı).

const FEDERATED_PROVIDERS = ["google.com", "apple.com"];

export function isFederatedUser(user) {
  return Array.isArray(user?.providerData)
    && user.providerData.some((p) => FEDERATED_PROVIDERS.includes(p?.providerId));
}

/** Oturum açık ama e-posta doğrulanmadı → uygulamaya alınmaz. */
export function requiresEmailVerification(user) {
  if (!user) return false;
  if (user.emailVerified) return false;
  return !isFederatedUser(user);
}

/**
 * Kullanıcıyı sunucudan tazeler; doğrulanmışsa ID token'ı da ZORLA yeniler — kurallar
 * token'daki `email_verified` iddiasına bakar ve o, token yenilenene kadar (≤ 1 saat)
 * eski (false) kalır. Yenilenmezse kapı açılır ama her yazım reddedilir.
 * @returns {Promise<boolean>} doğrulandı mı
 */
export async function refreshVerification(user) {
  if (!user) return false;
  await user.reload();
  if (!user.emailVerified) return false;
  await user.getIdToken(true);
  return true;
}
