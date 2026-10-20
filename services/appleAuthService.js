// Native Sign in with Apple + Firebase Auth hesap yasam dongusu.
//
// Apple yalniz ilk yetkilendirmede ad/e-posta verebilir. Kimlik icin her zaman
// identityToken + nonce kullanilir; profil bilgisi ise eksikse kullanicidan
// ortak profil tamamlama ekraninda istenir.

import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import {
  OAuthProvider,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  reauthenticateWithCredential,
  signInWithCredential,
  signOut as firebaseSignOut,
  unlink,
  updateProfile,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, fns } from "../firebase";
import { Keys, get, remove, set } from "./storage";
import { isGoogleProfileComplete } from "./googleAuthService";
import { legacyFlagToLanguage, pickByLanguage } from "../utils/appLanguages";

export const APPLE_PROVIDER_ID = "apple.com";

export const AppleAuthCode = Object.freeze({
  CANCELLED: "apple/cancelled",
  IN_PROGRESS: "apple/in-progress",
  UNAVAILABLE: "apple/unavailable",
  NO_ID_TOKEN: "apple/no-id-token",
  NO_SESSION: "apple/no-session",
  NETWORK: "apple/network",
  ACCOUNT_REQUIRES_LINK: "apple/account-requires-link",
  ALREADY_LINKED_ELSEWHERE: "apple/already-linked-elsewhere",
  ALREADY_LINKED_HERE: "apple/already-linked-here",
  WRONG_ACCOUNT: "apple/wrong-account",
  REQUIRES_RECENT_LOGIN: "apple/requires-recent-login",
  LAST_PROVIDER: "apple/last-provider",
  REVOCATION_FAILED: "apple/revocation-failed",
  UNKNOWN: "apple/unknown",
});

export class AppleAuthError extends Error {
  constructor(code, message, cause) {
    super(message || code);
    this.name = "AppleAuthError";
    this.code = code;
    this.cause = cause;
  }
}

function toAppleAuthError(error) {
  if (error instanceof AppleAuthError) return error;
  const code = error?.code;
  if (code === "ERR_REQUEST_CANCELED") {
    return new AppleAuthError(AppleAuthCode.CANCELLED, "Iptal edildi", error);
  }
  switch (code) {
    case "auth/credential-already-in-use":
      return new AppleAuthError(
        AppleAuthCode.ALREADY_LINKED_ELSEWHERE,
        "Bu Apple hesabi baska bir Seelogd hesabina bagli.",
        error,
      );
    case "auth/email-already-in-use":
    case "auth/account-exists-with-different-credential":
    case "functions/already-exists":
      return new AppleAuthError(
        AppleAuthCode.ACCOUNT_REQUIRES_LINK,
        "Mevcut hesaba Apple, Ayarlar'dan baglanmali.",
        error,
      );
    case "auth/provider-already-linked":
      return new AppleAuthError(
        AppleAuthCode.ALREADY_LINKED_HERE,
        "Apple hesabin zaten bagli.",
        error,
      );
    case "auth/user-mismatch":
      return new AppleAuthError(
        AppleAuthCode.WRONG_ACCOUNT,
        "Secilen Apple hesabi oturumdaki hesap degil.",
        error,
      );
    case "auth/requires-recent-login":
      return new AppleAuthError(
        AppleAuthCode.REQUIRES_RECENT_LOGIN,
        "Guvenlik icin tekrar giris yapman gerekiyor.",
        error,
      );
    case "auth/network-request-failed":
    case "functions/unavailable":
    case "functions/deadline-exceeded":
      return new AppleAuthError(
        AppleAuthCode.NETWORK,
        "Internet baglantisi kurulamadi.",
        error,
      );
    default:
      return new AppleAuthError(
        AppleAuthCode.UNKNOWN,
        error?.message || "Beklenmeyen bir hata olustu.",
        error,
      );
  }
}

const ERROR_TEXT = {
  [AppleAuthCode.UNAVAILABLE]: {
    tr: "Apple ile giriş bu cihazda kullanılamıyor.",
    en: "Sign in with Apple is unavailable on this device.",
    es: "Iniciar sesión con Apple no está disponible en este dispositivo.",
    pt: "Entrar com a Apple não está disponível neste dispositivo.",
    de: "Die Anmeldung mit Apple ist auf diesem Gerät nicht verfügbar.",
  },
  [AppleAuthCode.ACCOUNT_REQUIRES_LINK]: {
    tr: "Bu e-posta ile zaten bir Seelogd hesabı var. Önce mevcut yönteminle giriş yap, ardından Ayarlar > Hesap bağlantıları bölümünden Apple'ı bağla.",
    en: "A Seelogd account already uses this email. Sign in with the existing method, then connect Apple from Settings > Account connections.",
    es: "Ya existe una cuenta de Seelogd con este correo. Inicia sesión con tu método actual y después vincula Apple desde Ajustes > Cuentas vinculadas.",
    pt: "Já existe uma conta do Seelogd com este e-mail. Entre com seu método atual e depois vincule a Apple em Configurações > Contas vinculadas.",
    de: "Ein Seelogd-Konto verwendet diese E-Mail-Adresse bereits. Melde dich mit der bisherigen Methode an und verknüpfe Apple dann unter Einstellungen > Kontoverknüpfungen.",
  },
  [AppleAuthCode.ALREADY_LINKED_ELSEWHERE]: {
    tr: "Bu Apple hesabı başka bir Seelogd hesabına bağlı.",
    en: "This Apple account is linked to another Seelogd account.",
    es: "Esta cuenta de Apple está vinculada a otra cuenta de Seelogd.",
    pt: "Esta conta da Apple está vinculada a outra conta do Seelogd.",
    de: "Dieses Apple-Konto ist mit einem anderen Seelogd-Konto verknüpft.",
  },
  [AppleAuthCode.ALREADY_LINKED_HERE]: {
    tr: "Apple hesabın zaten bağlı.",
    en: "Your Apple account is already connected.",
    es: "Tu cuenta de Apple ya está vinculada.",
    pt: "Sua conta da Apple já está vinculada.",
    de: "Dein Apple-Konto ist bereits verknüpft.",
  },
  [AppleAuthCode.WRONG_ACCOUNT]: {
    tr: "Oturumu açtığın Apple hesabını seç.",
    en: "Choose the Apple account used for this session.",
    es: "Elige la cuenta de Apple que usaste para esta sesión.",
    pt: "Escolha a conta da Apple que você usou nesta sessão.",
    de: "Wähle das Apple-Konto, das für diese Sitzung verwendet wurde.",
  },
  [AppleAuthCode.REQUIRES_RECENT_LOGIN]: {
    tr: "Güvenlik için çıkış yapıp tekrar giriş yaptıktan sonra dene.",
    en: "For security, sign out and sign in again, then retry.",
    es: "Por seguridad, cierra sesión, vuelve a iniciarla e inténtalo de nuevo.",
    pt: "Por segurança, saia, entre de novo e tente novamente.",
    de: "Melde dich aus Sicherheitsgründen ab und wieder an und versuche es dann erneut.",
  },
  [AppleAuthCode.LAST_PROVIDER]: {
    tr: "Apple şu anda tek giriş yöntemin, kaldırılamaz.",
    en: "Apple is your only sign-in method and cannot be removed.",
    es: "Apple es ahora tu único método de inicio de sesión y no se puede quitar.",
    pt: "A Apple agora é seu único método de login e não pode ser removida.",
    de: "Apple ist deine einzige Anmeldemethode und kann nicht entfernt werden.",
  },
  [AppleAuthCode.NETWORK]: {
    tr: "İnternet bağlantısı kurulamadı. Bağlantını kontrol et.",
    en: "Could not reach the network. Check your connection.",
    es: "No se pudo conectar a la red. Revisa tu conexión.",
    pt: "Não foi possível conectar à rede. Verifique sua conexão.",
    de: "Das Netzwerk war nicht erreichbar. Prüfe deine Verbindung.",
  },
  [AppleAuthCode.NO_ID_TOKEN]: {
    tr: "Apple kimliğini doğrulayamadı. Lütfen tekrar dene.",
    en: "Apple could not verify your identity. Please try again.",
    es: "Apple no pudo verificar tu identidad. Inténtalo de nuevo.",
    pt: "A Apple não conseguiu verificar sua identidade. Tente novamente.",
    de: "Apple konnte deine Identität nicht bestätigen. Bitte versuche es erneut.",
  },
  [AppleAuthCode.NO_SESSION]: {
    tr: "Oturum bulunamadı. Tekrar giriş yap.",
    en: "No active session. Please sign in again.",
    es: "No hay ninguna sesión activa. Inicia sesión de nuevo.",
    pt: "Não há nenhuma sessão ativa. Entre novamente.",
    de: "Keine aktive Sitzung. Bitte melde dich erneut an.",
  },
  [AppleAuthCode.IN_PROGRESS]: {
    tr: "Apple ile giriş zaten sürüyor.",
    en: "Sign in with Apple is already in progress.",
    es: "Ya hay un inicio de sesión con Apple en curso.",
    pt: "Já há um login com a Apple em andamento.",
    de: "Die Anmeldung mit Apple läuft bereits.",
  },
  [AppleAuthCode.REVOCATION_FAILED]: {
    tr: "Apple yetkilendirmesi kaldırılamadı. Lütfen tekrar dene.",
    en: "Apple authorization could not be revoked. Please try again.",
    es: "No se pudo revocar la autorización de Apple. Inténtalo de nuevo.",
    pt: "Não foi possível revogar a autorização da Apple. Tente novamente.",
    de: "Die Apple-Autorisierung konnte nicht widerrufen werden. Bitte versuche es erneut.",
  },
};

/**
 * @param {boolean|string} language  Eski çağrılar `true` (Türkçe) / `false` (İngilizce)
 *   geçiyordu; artık uygulama dili ("tr" | "en" | "es") da verilebilir.
 */
export function describeAppleAuthError(error, language = "tr") {
  const code = legacyFlagToLanguage(language);
  const entry = ERROR_TEXT[error?.code];
  if (entry) return entry[code] ?? entry.en;
  return pickByLanguage(code, {
    tr: "İşlem tamamlanamadı. Lütfen tekrar dene.",
    en: "The action could not be completed. Please try again.",
    es: "No se pudo completar la acción. Inténtalo de nuevo.",
    pt: "Não foi possível concluir a ação. Tente novamente.",
    de: "Die Aktion konnte nicht abgeschlossen werden. Bitte versuche es erneut.",
  });
}

let busy = false;
async function withLock(fn) {
  if (busy) {
    throw new AppleAuthError(
      AppleAuthCode.IN_PROGRESS,
      "Apple ile giris zaten suruyor.",
    );
  }
  busy = true;
  try {
    return await fn();
  } finally {
    busy = false;
  }
}

export async function isAppleAuthenticationAvailable() {
  if (Platform.OS !== "ios") return false;
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

function bytesToHex(bytes) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function createAppleNonce() {
  const bytes = await Crypto.getRandomBytesAsync(32);
  const rawNonce = bytesToHex(bytes);
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );
  return { rawNonce, hashedNonce };
}

function appleProvider() {
  return new OAuthProvider(APPLE_PROVIDER_ID);
}

async function getAppleCredential() {
  if (!(await isAppleAuthenticationAvailable())) {
    throw new AppleAuthError(
      AppleAuthCode.UNAVAILABLE,
      "Apple ile giris bu cihazda kullanilamiyor.",
    );
  }
  const { rawNonce, hashedNonce } = await createAppleNonce();
  const response = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });
  if (!response.identityToken) {
    throw new AppleAuthError(
      AppleAuthCode.NO_ID_TOKEN,
      "Apple identityToken vermedi.",
    );
  }
  const displayName = response.fullName
    ? AppleAuthentication.formatFullName(response.fullName).trim()
    : "";
  return {
    credential: appleProvider().credential({
      idToken: response.identityToken,
      rawNonce,
    }),
    identityToken: response.identityToken,
    authorizationCode: response.authorizationCode || null,
    email: response.email || null,
    displayName,
  };
}

async function assertAppleSignInEligible(identityToken, email) {
  try {
    const check = httpsCallable(fns, "checkAppleSignInEligibility");
    await check({ identityToken });
  } catch (error) {
    // Callable yayinlanana kadar ilk Apple yetkilendirmesinde gelen e-postayla
    // yerel fallback. Apple sonraki girislerde e-postayi vermeyebilir; o durum
    // zaten daha once baglanmis Apple kullanicisidir ve Firebase karar verir.
    if (error?.code === "functions/not-found") {
      if (!email) return;
      let methods;
      try {
        methods = await fetchSignInMethodsForEmail(auth, email);
      } catch (fallbackError) {
        throw toAppleAuthError(fallbackError);
      }
      if (methods.length > 0 && !methods.includes(APPLE_PROVIDER_ID)) {
        throw new AppleAuthError(AppleAuthCode.ACCOUNT_REQUIRES_LINK);
      }
      return;
    }
    throw toAppleAuthError(error);
  }
}

async function readProfile(uid) {
  const snap = await getDoc(doc(db, "Users", uid));
  return snap.exists() ? snap.data() : null;
}

async function profileCompletionResult(user) {
  let profile = null;
  let readOk = true;
  try {
    profile = await readProfile(user.uid);
  } catch {
    readOk = false;
  }
  if (readOk) {
    const needsProfileCompletion = !isGoogleProfileComplete(profile);
    if (needsProfileCompletion) set(Keys.googleProfilePendingUid, user.uid);
    else remove(Keys.googleProfilePendingUid);
    return needsProfileCompletion;
  }
  return get(Keys.googleProfilePendingUid) === user.uid;
}

export async function signInWithApple() {
  return withLock(async () => {
    let selected;
    try {
      selected = await getAppleCredential();
      await assertAppleSignInEligible(selected.identityToken, selected.email);
    } catch (error) {
      throw toAppleAuthError(error);
    }

    let user;
    try {
      user = (await signInWithCredential(auth, selected.credential)).user;
    } catch (error) {
      throw toAppleAuthError(error);
    }

    // Apple ad bilgisini yalniz ilk izinde verir. Firebase JS credential bu
    // native fullName'i tasimadigi icin ilk firsatta Auth profiline ekle.
    if (selected.displayName && !user.displayName) {
      await updateProfile(user, { displayName: selected.displayName }).catch(() => {});
    }

    const needsProfileCompletion = await profileCompletionResult(user);
    return { user, needsProfileCompletion, cancelled: false };
  });
}

export async function linkAppleAccount() {
  return withLock(async () => {
    const current = auth.currentUser;
    if (!current) throw new AppleAuthError(AppleAuthCode.NO_SESSION);
    let selected;
    try {
      selected = await getAppleCredential();
      await linkWithCredential(current, selected.credential);
    } catch (error) {
      throw toAppleAuthError(error);
    }
    await current.reload().catch(() => {});
    return { cancelled: false };
  });
}

export async function reauthenticateWithApple() {
  return withLock(async () => {
    const current = auth.currentUser;
    if (!current) throw new AppleAuthError(AppleAuthCode.NO_SESSION);
    let selected;
    try {
      selected = await getAppleCredential();
      await reauthenticateWithCredential(current, selected.credential);
    } catch (error) {
      throw toAppleAuthError(error);
    }
    return {
      cancelled: false,
      appleAuthorizationCode: selected.authorizationCode,
    };
  });
}

export async function revokeAppleAuthorization(authorizationCode) {
  if (!authorizationCode) {
    throw new AppleAuthError(AppleAuthCode.REVOCATION_FAILED);
  }
  try {
    const revoke = httpsCallable(fns, "revokeAppleAuthorization");
    await revoke({ authorizationCode });
  } catch (error) {
    throw new AppleAuthError(
      AppleAuthCode.REVOCATION_FAILED,
      "Apple yetkilendirmesi kaldirilamadi.",
      error,
    );
  }
}

export async function unlinkAppleAccount() {
  const user = auth.currentUser;
  if (!user) throw new AppleAuthError(AppleAuthCode.NO_SESSION);
  const providerIds = [...new Set(user.providerData.map((item) => item.providerId))];
  if (providerIds.length <= 1) throw new AppleAuthError(AppleAuthCode.LAST_PROVIDER);

  const reauth = await reauthenticateWithApple();
  await revokeAppleAuthorization(reauth.appleAuthorizationCode);
  try {
    await unlink(user, APPLE_PROVIDER_ID);
    await user.reload().catch(() => {});
  } catch (error) {
    throw toAppleAuthError(error);
  }
  return { cancelled: false };
}

export async function cancelAppleRegistration() {
  const current = auth.currentUser;
  remove(Keys.googleProfilePendingUid);
  if (current) {
    let profileExists = true;
    try {
      profileExists = !!(await readProfile(current.uid));
    } catch {
      profileExists = true;
    }
    if (!profileExists) {
      try {
        await current.delete();
        return;
      } catch {
        // recent-login vb. durumda en azindan oturumu kapat.
      }
    }
  }
  await firebaseSignOut(auth);
}
