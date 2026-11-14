// Firebase Auth giriş yöntemlerini Settings ekranından yönetmek için ortak servis.
// Google'ın native akışı googleAuthService.js'de kalır; burada e-posta/şifre
// ekleme, parola sıfırlama ve harici sağlayıcı kaldırma gibi genel işlemler var.

import {
  EmailAuthProvider,
  linkWithCredential,
  unlink,
} from "firebase/auth";
import { auth } from "../firebase";
import { AuthEmailCode, sendResetEmail } from "./authEmail";
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
  TOO_MANY: "account-connection/too-many-requests",
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
  // services/authEmail.js'in sınıflı hataları (parola sıfırlama e-postası).
  if (error?.name === "AuthEmailError") {
    if (error.code === AuthEmailCode.OFFLINE) {
      return new AccountConnectionError(AccountConnectionCode.NETWORK, null, error);
    }
    if (error.code === AuthEmailCode.TOO_MANY) {
      return new AccountConnectionError(AccountConnectionCode.TOO_MANY, null, error);
    }
    return new AccountConnectionError(AccountConnectionCode.UNKNOWN, null, error);
  }
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
    pt: "Não há nenhuma sessão ativa. Entre novamente.",
    de: "Keine aktive Sitzung. Bitte melde dich erneut an.",

  it: "Nessuna sessione attiva. Accedi di nuovo.",
  fr: "Aucune session active. Reconnecte-toi.",
  ja: "有効なセッションがありません。もう一度サインインしてください。"},
  [AccountConnectionCode.NO_EMAIL]: {
    tr: "Bu hesapta parola bağlanabilecek bir e-posta adresi yok.",
    en: "This account has no email address that can be linked to a password.",
    es: "Esta cuenta no tiene ningún correo electrónico al que se pueda vincular una contraseña.",
    pt: "Esta conta não tem nenhum e-mail ao qual uma senha possa ser vinculada.",
    de: "Dieses Konto hat keine E-Mail-Adresse, die mit einem Passwort verknüpft werden kann.",

  it: "Questo account non ha un indirizzo email che possa essere collegato a una password.",
  fr: "Ce compte n'a pas d'adresse e-mail pouvant être associée à un mot de passe.",
  ja: "このアカウントにはパスワードと連携できるメールアドレスがありません。"},
  [AccountConnectionCode.PASSWORD_MISMATCH]: {
    tr: "Girdiğin parolalar eşleşmiyor.",
    en: "The passwords do not match.",
    es: "Las contraseñas no coinciden.",
    pt: "As senhas não coincidem.",
    de: "Die Passwörter stimmen nicht überein.",

  it: "Le password non corrispondono.",
  fr: "Les mots de passe ne correspondent pas.",
  ja: "パスワードが一致しません。"},
  [AccountConnectionCode.WEAK_PASSWORD]: {
    tr: "Parolan en az 6 karakter olmalı.",
    en: "Your password must be at least 6 characters.",
    es: "Tu contraseña debe tener al menos 6 caracteres.",
    pt: "Sua senha deve ter pelo menos 6 caracteres.",
    de: "Dein Passwort muss mindestens 6 Zeichen lang sein.",

  it: "La tua password deve contenere almeno 6 caratteri.",
  fr: "Ton mot de passe doit contenir au moins 6 caractères.",
  ja: "パスワードは6文字以上にしてください。"},
  [AccountConnectionCode.ALREADY_LINKED]: {
    tr: "E-posta ve parola girişi bu hesapta zaten etkin.",
    en: "Email and password sign-in is already active on this account.",
    es: "El inicio de sesión con correo y contraseña ya está activo en esta cuenta.",
    pt: "O login com e-mail e senha já está ativo nesta conta.",
    de: "Die Anmeldung mit E-Mail und Passwort ist für dieses Konto bereits aktiv.",

  it: "L'accesso tramite email e password è già attivo su questo account.",
  fr: "La connexion par e-mail et mot de passe est déjà active sur ce compte.",
  ja: "このアカウントではすでにメールとパスワードでのサインインが有効です。"},
  [AccountConnectionCode.EMAIL_IN_USE]: {
    tr: "Bu e-posta başka bir giriş kaydı tarafından kullanılıyor.",
    en: "This email is already used by another sign-in record.",
    es: "Este correo ya lo usa otro registro de inicio de sesión.",
    pt: "Este e-mail já é usado por outro registro de login.",
    de: "Diese E-Mail-Adresse wird bereits von einem anderen Anmeldeeintrag verwendet.",

  it: "Questo indirizzo email è già utilizzato da un altro record di accesso.",
  fr: "Cet e-mail est déjà utilisé par une autre méthode de connexion.",
  ja: "このメールアドレスは別のサインイン記録で使われています。"},
  [AccountConnectionCode.REQUIRES_RECENT_LOGIN]: {
    tr: "Güvenlik için çıkış yapıp tekrar giriş yaptıktan sonra yeniden dene.",
    en: "For security, sign out and sign in again before retrying.",
    es: "Por seguridad, cierra sesión y vuelve a iniciarla antes de reintentarlo.",
    pt: "Por segurança, saia e entre de novo antes de tentar novamente.",
    de: "Melde dich aus Sicherheitsgründen ab und wieder an, bevor du es erneut versuchst.",

  it: "Per sicurezza, esci e accedi di nuovo prima di riprovare.",
  fr: "Par sécurité, déconnecte-toi puis reconnecte-toi avant de réessayer.",
  ja: "セキュリティのため、一度サインアウトして再度サインインしてからお試しください。"},
  [AccountConnectionCode.LAST_PROVIDER]: {
    tr: "Hesabındaki tek giriş yöntemi kaldırılamaz.",
    en: "The only sign-in method on your account cannot be removed.",
    es: "El único método de inicio de sesión de tu cuenta no se puede quitar.",
    pt: "O único método de login da sua conta não pode ser removido.",
    de: "Die einzige Anmeldemethode deines Kontos kann nicht entfernt werden.",

  it: "L'unico metodo di accesso sul tuo account non può essere rimosso.",
  fr: "La seule méthode de connexion de ton compte ne peut pas être retirée.",
  ja: "アカウントで唯一のサインイン方法は解除できません。"},
  [AccountConnectionCode.NETWORK]: {
    tr: "İnternet bağlantısı kurulamadı. Bağlantını kontrol et.",
    en: "Could not reach the network. Check your connection.",
    es: "No se pudo conectar a la red. Revisa tu conexión.",
    pt: "Não foi possível conectar à rede. Verifique sua conexão.",
    de: "Das Netzwerk war nicht erreichbar. Prüfe deine Verbindung.",

  it: "Impossibile raggiungere la rete. Controlla la tua connessione.",
  fr: "Impossible d'accéder au réseau. Vérifie ta connexion.",
  ja: "ネットワークに接続できませんでした。接続を確認してください。"},
  [AccountConnectionCode.TOO_MANY]: {
    tr: "Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.",
    en: "Too many attempts. Wait a bit and try again.",
    es: "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
    pt: "Muitas tentativas. Aguarde um pouco e tente novamente.",
    de: "Zu viele Versuche. Warte einen Moment und versuche es erneut.",

  it: "Troppi tentativi. Aspetta un po' e riprova.",
  fr: "Trop de tentatives. Patiente un peu et réessaie.",
  ja: "試行回数が多すぎます。少し待ってからお試しください。"},
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
    pt: "Não foi possível concluir a ação. Tente novamente.",
    de: "Die Aktion konnte nicht abgeschlossen werden. Bitte versuche es erneut.",

  it: "Impossibile completare l'azione. Per favore riprova.",
  fr: "L'action n'a pas pu aboutir. Réessaie.",
  ja: "操作を完了できませんでした。もう一度お試しください。"});
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
    // Şablon uygulama dilinde gider; adres temizlenir (services/authEmail.js).
    await sendResetEmail(user.email);
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

