// services/authEmail.js
//
// Firebase Auth e-postaları (şifre sıfırlama + e-posta doğrulama) için TEK giriş.
// Üç şeyi toplar ki ekranlar kopyalamasın:
//   1) ADRES TEMİZLİĞİ  — Android/iOS otomatik tamamlama adrese boşluk bırakabiliyor;
//      Firebase bunu `invalid-email` sayıyordu.
//   2) E-POSTA DİLİ     — `auth.languageCode` hiç ayarlanmıyordu, bu yüzden Firebase şablonları
//      (sıfırlama, doğrulama) uygulama dili ne olursa olsun varsayılan dilde gidiyordu. Her
//      gönderimden önce uygulama diline ayarlanır.
//   3) HATA SINIFLAMA   — çevrimdışı / çok fazla deneme / geçersiz adres ayrı kodlarla döner
//      (eskiden hepsi "Geçersiz e posta adresi" idi). Ekran metni utils/authEmailCopy.js.
//
// ŞİFRE SIFIRLAMADA `auth/user-not-found` BAŞARI SAYILIR: e-posta numaralandırma koruması
// açık projelerde Firebase zaten hata vermez; kapalı olanlarda hesap var/yok bilgisini
// sızdırmamak için aynı davranış korunur.

import { sendEmailVerification, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import i18n from "../translations";
import { normalizeAppLanguage } from "../utils/appLanguages";
import { fillAuthEmailText, getAuthEmailCopy } from "../utils/authEmailCopy";

/** Uygulama dili → Firebase şablon dili. Brezilya Portekizcesi `pt-BR`. */
const FIREBASE_LANGUAGE = Object.freeze({ tr: "tr", en: "en", es: "es", pt: "pt-BR", de: "de" });

export const authLanguageCode = (language) => FIREBASE_LANGUAGE[normalizeAppLanguage(language)] || "en";

/** Adresteki TÜM boşlukları (başta, sonda, ortada) siler. */
export const cleanEmail = (value) => String(value ?? "").replace(/\s+/g, "");

export const AuthEmailCode = Object.freeze({
  INVALID_EMAIL: "invalid-email",
  OFFLINE: "offline",
  TOO_MANY: "too-many-requests",
  NO_SESSION: "no-session",
  ALREADY_VERIFIED: "already-verified",
  UNKNOWN: "unknown",
});

export class AuthEmailError extends Error {
  constructor(code, cause) {
    super(code);
    this.name = "AuthEmailError";
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}

/** Firebase hatasını kararlı bir koda indirger. */
export function classifyAuthEmailError(error) {
  if (error?.name === "AuthEmailError") return error.code;
  switch (String(error?.code || "")) {
    case "auth/invalid-email":
    case "auth/missing-email":
    case "auth/invalid-recipient-email":
      return AuthEmailCode.INVALID_EMAIL;
    case "auth/network-request-failed":
      return AuthEmailCode.OFFLINE;
    case "auth/too-many-requests":
      return AuthEmailCode.TOO_MANY;
    default:
      return AuthEmailCode.UNKNOWN;
  }
}

/** Hata kodunun kullanıcı metni (uygulama dilinde). */
export function authEmailErrorMessage(error, language = i18n.language) {
  const copy = getAuthEmailCopy(language);
  switch (classifyAuthEmailError(error)) {
    case AuthEmailCode.INVALID_EMAIL:
      return copy.invalidEmail;
    case AuthEmailCode.OFFLINE:
      return copy.offline;
    case AuthEmailCode.TOO_MANY:
      return copy.tooMany;
    case AuthEmailCode.NO_SESSION:
      return copy.noSession;
    default:
      return copy.generic;
  }
}

const wrap = (error) => (error?.name === "AuthEmailError" ? error : new AuthEmailError(classifyAuthEmailError(error), error));

/**
 * Şifre sıfırlama e-postası gönderir (adres temizlenir, şablon uygulama dilinde).
 * @returns {Promise<string>} gönderilen (temizlenmiş) adres
 */
export async function sendResetEmail(email, { language = i18n.language, authInstance = auth } = {}) {
  const address = cleanEmail(email);
  if (!/^\S+@\S+\.\S+$/.test(address)) throw new AuthEmailError(AuthEmailCode.INVALID_EMAIL);
  try {
    authInstance.languageCode = authLanguageCode(language);
    await sendPasswordResetEmail(authInstance, address);
  } catch (error) {
    // Hesap yok: numaralandırmayı sızdırmamak için başarı gibi davran.
    if (error?.code !== "auth/user-not-found") throw wrap(error);
  }
  return address;
}

/**
 * Doğrulama e-postası gönderir. Önce kullanıcıyı tazeler: bağlantıya başka cihazda
 * tıklanmışsa `emailVerified` bayattır ve gereksiz e-posta gitmesin.
 *
 * @returns {Promise<{ sent: boolean, alreadyVerified: boolean }>}
 */
export async function sendVerificationEmail(user = auth.currentUser, { language = i18n.language, authInstance = auth } = {}) {
  if (!user) throw new AuthEmailError(AuthEmailCode.NO_SESSION);
  await user.reload().catch(() => {});
  if (user.emailVerified) return { sent: false, alreadyVerified: true };
  try {
    authInstance.languageCode = authLanguageCode(language);
    await sendEmailVerification(user);
  } catch (error) {
    throw wrap(error);
  }
  return { sent: true, alreadyVerified: false };
}

export { fillAuthEmailText };
