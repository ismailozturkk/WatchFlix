// Firebase Auth giriş yöntemlerini Settings ekranından yönetmek için ortak servis.
// Google'ın native akışı googleAuthService.js'de kalır; burada e-posta/şifre
// ekleme, parola sıfırlama ve harici sağlayıcı kaldırma gibi genel işlemler var.

import {
  EmailAuthProvider,
  linkWithCredential,
  sendPasswordResetEmail,
  unlink,
} from "firebase/auth";
import { auth } from "../firebase";
import { legacyFlagToLanguage, pickByLanguage } from "../utils/appLanguages";

export const AccountConnectionCode = {
  NO_SESSION: "account-connection/no-session",
  NO_EMAIL: "account-connection/no-email",
  PASSWORD_MISMATCH: "account-connection/password-mismatch",
  WEAK_PASSWORD: "account-connection/weak-password",
  ALREADY_LINKED: "account-connection/already-linked",
  EMAIL_IN_USE: "account-connection/email-in-use",
  REQUIRES_RECENT_LOGIN: "account-connection/requires-recent-login",
  LAST_PROVIDER: "account-connection/last-provider",
  NETWORK: "account-connection/network",
  UNKNOWN: "account-connection/unknown",
};

export class AccountConnectionError extends Error {
  constructor(code, message, cause) {
    super(message || code);
    this.name = "AccountConnectionError";
    this.code = code;
    this.cause = cause;
  }
}

function providerIds(user) {
  return [...new Set((user?.providerData || []).map((item) => item.providerId))];
}

function toAccountConnectionError(error) {
  if (error instanceof AccountConnectionError) return error;
  switch (error?.code) {
    case "auth/weak-password":
      return new AccountConnectionError(AccountConnectionCode.WEAK_PASSWORD, null, error);
    case "auth/provider-already-linked":
      return new AccountConnectionError(AccountConnectionCode.ALREADY_LINKED, null, error);
    case "auth/email-already-in-use":
    case "auth/credential-already-in-use":
      return new AccountConnectionError(AccountConnectionCode.EMAIL_IN_USE, null, error);
    case "auth/requires-recent-login":
      return new AccountConnectionError(AccountConnectionCode.REQUIRES_RECENT_LOGIN, null, error);
    case "auth/network-request-failed":
      return new AccountConnectionError(AccountConnectionCode.NETWORK, null, error);
    default:
      return new AccountConnectionError(AccountConnectionCode.UNKNOWN, error?.message, error);
  }
}

const ERROR_TEXT = {
  [AccountConnectionCode.NO_SESSION]: {
    tr: "Oturum bulunamadı. Lütfen tekrar giriş yap.",
    en: "No active session. Please sign in again.",
    es: "No hay ninguna sesión activa. Inicia sesión de nuevo.",
  },
  [AccountConnectionCode.NO_EMAIL]: {
    tr: "Bu hesapta parola bağlanabilecek bir e-posta adresi yok.",
    en: "This account has no email address that can be linked to a password.",
    es: "Esta cuenta no tiene ningún correo electrónico al que se pueda vincular una contraseña.",
  },
  [AccountConnectionCode.PASSWORD_MISMATCH]: {
    tr: "Girdiğin parolalar eşleşmiyor.",
    en: "The passwords do not match.",
    es: "Las contraseñas no coinciden.",
  },
  [AccountConnectionCode.WEAK_PASSWORD]: {
    tr: "Parolan en az 6 karakter olmalı.",
    en: "Your password must be at least 6 characters.",
    es: "Tu contraseña debe tener al menos 6 caracteres.",
  },
  [AccountConnectionCode.ALREADY_LINKED]: {
    tr: "E-posta ve parola girişi bu hesapta zaten etkin.",
    en: "Email and password sign-in is already active on this account.",
    es: "El inicio de sesión con correo y contraseña ya está activo en esta cuenta.",
  },
  [AccountConnectionCode.EMAIL_IN_USE]: {
    tr: "Bu e-posta başka bir giriş kaydı tarafından kullanılıyor.",
    en: "This email is already used by another sign-in record.",
    es: "Este correo ya lo usa otro registro de inicio de sesión.",
  },
  [AccountConnectionCode.REQUIRES_RECENT_LOGIN]: {
    tr: "Güvenlik için çıkış yapıp tekrar giriş yaptıktan sonra yeniden dene.",
    en: "For security, sign out and sign in again before retrying.",
    es: "Por seguridad, cierra sesión y vuelve a iniciarla antes de reintentarlo.",
  },
  [AccountConnectionCode.LAST_PROVIDER]: {
    tr: "Hesabındaki tek giriş yöntemi kaldırılamaz.",
    en: "The only sign-in method on your account cannot be removed.",
    es: "El único método de inicio de sesión de tu cuenta no se puede quitar.",
  },
  [AccountConnectionCode.NETWORK]: {
    tr: "İnternet bağlantısı kurulamadı. Bağlantını kontrol et.",
    en: "Could not reach the network. Check your connection.",
    es: "No se pudo conectar a la red. Revisa tu conexión.",
  },
};

/**
 * @param {boolean|string} language  Eski çağrılar `true` (Türkçe) / `false` (İngilizce)
 *   geçiyordu; artık uygulama dili ("tr" | "en" | "es") da verilebilir.
 */
export function describeAccountConnectionError(error, language = "tr") {
  const code = legacyFlagToLanguage(language);
  const entry = ERROR_TEXT[error?.code];
  if (entry) return entry[code] ?? entry.en;
  return pickByLanguage(code, {
    tr: "İşlem tamamlanamadı. Lütfen tekrar dene.",
    en: "The action could not be completed. Please try again.",
    es: "No se pudo completar la acción. Inténtalo de nuevo.",
  });
}

export async function addPasswordSignIn({ password, confirmation }) {
  const user = auth.currentUser;
  if (!user) throw new AccountConnectionError(AccountConnectionCode.NO_SESSION);
  if (!user.email) throw new AccountConnectionError(AccountConnectionCode.NO_EMAIL);
  if (providerIds(user).includes(EmailAuthProvider.PROVIDER_ID)) {
    throw new AccountConnectionError(AccountConnectionCode.ALREADY_LINKED);
  }
  if (password !== confirmation) {
    throw new AccountConnectionError(AccountConnectionCode.PASSWORD_MISMATCH);
  }
  if (typeof password !== "string" || password.length < 6) {
    throw new AccountConnectionError(AccountConnectionCode.WEAK_PASSWORD);
  }

  try {
    const credential = EmailAuthProvider.credential(user.email, password);
    await linkWithCredential(user, credential);
    await user.reload().catch(() => {});
  } catch (error) {
    throw toAccountConnectionError(error);
  }
}

export async function sendCurrentUserPasswordReset() {
  const user = auth.currentUser;
  if (!user) throw new AccountConnectionError(AccountConnectionCode.NO_SESSION);
  if (!user.email) throw new AccountConnectionError(AccountConnectionCode.NO_EMAIL);
  try {
    await sendPasswordResetEmail(auth, user.email);
  } catch (error) {
    throw toAccountConnectionError(error);
  }
}

export async function unlinkAccountProvider(providerId) {
  const user = auth.currentUser;
  if (!user) throw new AccountConnectionError(AccountConnectionCode.NO_SESSION);
  const providers = providerIds(user);
  if (!providers.includes(providerId)) return;
  if (providers.length <= 1) {
    throw new AccountConnectionError(AccountConnectionCode.LAST_PROVIDER);
  }
  try {
    await unlink(user, providerId);
    await user.reload().catch(() => {});
  } catch (error) {
    throw toAccountConnectionError(error);
  }
}

