// services/googleAuthService.js
//
// Google ile giriş + hesap bağlama.
//
// Akış: native hesap seçici → idToken → Firebase credential →
// signInWithCredential (giriş) veya linkWithCredential (bağlama).
//
// Hata sözleşmesi: bu modülün fırlattığı her hata `code` taşır (GoogleAuthCode).
// UI koda göre yerelleştirir; ham Firebase metni ("Firebase: Error
// (auth/requires-recent-login)") hiçbir zaman kullanıcıya gösterilmez.
//
// NOT (yapılandırma): webClientId, google-services.json içindeki client_type:3
// ile birebir aynı olmalıdır. Android'de ayrıca uygulamayı imzalayan her
// keystore'un SHA-1'i Firebase Console'a eklenmiş olmalıdır — aksi halde native
// SDK DEVELOPER_ERROR döner ve buradaki hiçbir kod bunu kurtaramaz.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import {
  GoogleAuthProvider,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  signInWithCredential,
  signOut as firebaseSignOut,
  unlink,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, fns } from "../firebase";

export const GOOGLE_PROFILE_PENDING_KEY = "googleProfilePendingUid";

// ── Hata kodları ────────────────────────────────────────────────────────────

export const GoogleAuthCode = {
  CANCELLED: "google/cancelled",
  IN_PROGRESS: "google/in-progress",
  PLAY_SERVICES: "google/play-services",
  MISCONFIGURED: "google/misconfigured",
  NO_ID_TOKEN: "google/no-id-token",
  NO_SESSION: "google/no-session",
  NETWORK: "google/network",
  ACCOUNT_REQUIRES_LINK: "google/account-requires-link",
  ALREADY_LINKED_ELSEWHERE: "google/already-linked-elsewhere",
  ALREADY_LINKED_HERE: "google/already-linked-here",
  REQUIRES_RECENT_LOGIN: "google/requires-recent-login",
  LAST_PROVIDER: "google/last-provider",
  UNKNOWN: "google/unknown",
};

export class GoogleAuthError extends Error {
  constructor(code, message, cause) {
    super(message || code);
    this.name = "GoogleAuthError";
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Native SDK ve Firebase hatalarını tek bir kod uzayına indirger.
 * Android'de DEVELOPER_ERROR statusCodes'ta yok; ham "10" olarak gelir.
 */
function toGoogleAuthError(error) {
  if (error instanceof GoogleAuthError) return error;

  const code = error?.code;

  if (isErrorWithCode(error)) {
    if (code === statusCodes.SIGN_IN_CANCELLED)
      return new GoogleAuthError(GoogleAuthCode.CANCELLED, "İptal edildi", error);
    if (code === statusCodes.IN_PROGRESS)
      return new GoogleAuthError(
        GoogleAuthCode.IN_PROGRESS,
        "Google girişi zaten sürüyor.",
        error,
      );
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE)
      return new GoogleAuthError(
        GoogleAuthCode.PLAY_SERVICES,
        "Google Play Hizmetleri bu cihazda kullanılamıyor.",
        error,
      );
    // "10" = DEVELOPER_ERROR: imza/SHA-1 veya client id uyuşmazlığı.
    if (String(code) === "10" || code === "DEVELOPER_ERROR")
      return new GoogleAuthError(
        GoogleAuthCode.MISCONFIGURED,
        "Google girişi bu sürüm için yapılandırılmamış.",
        error,
      );
  }

  switch (code) {
    case "auth/credential-already-in-use":
      return new GoogleAuthError(
        GoogleAuthCode.ALREADY_LINKED_ELSEWHERE,
        "Bu Google hesabı başka bir Watchify hesabına bağlı.",
        error,
      );
    case "auth/email-already-in-use":
    case "auth/account-exists-with-different-credential":
    case "functions/already-exists":
      return new GoogleAuthError(
        GoogleAuthCode.ACCOUNT_REQUIRES_LINK,
        "Bu e-posta ile zaten bir hesap var. Önce e-posta ve şifrenle giriş yapıp Google hesabını Ayarlar'dan bağla.",
        error,
      );
    case "auth/provider-already-linked":
      return new GoogleAuthError(
        GoogleAuthCode.ALREADY_LINKED_HERE,
        "Google hesabın zaten bağlı.",
        error,
      );
    case "auth/requires-recent-login":
      return new GoogleAuthError(
        GoogleAuthCode.REQUIRES_RECENT_LOGIN,
        "Güvenlik için tekrar giriş yapman gerekiyor.",
        error,
      );
    case "auth/network-request-failed":
    case "functions/unavailable":
    case "functions/deadline-exceeded":
      return new GoogleAuthError(
        GoogleAuthCode.NETWORK,
        "İnternet bağlantısı kurulamadı.",
        error,
      );
    default:
      return new GoogleAuthError(
        GoogleAuthCode.UNKNOWN,
        error?.message || "Beklenmeyen bir hata oluştu.",
        error,
      );
  }
}

// ── Kullanıcıya gösterilecek metin ──────────────────────────────────────────

const ERROR_TEXT = {
  [GoogleAuthCode.ALREADY_LINKED_ELSEWHERE]: {
    tr: "Bu Google hesabı başka bir Watchify hesabına bağlı. Önce o hesaptan bağlantıyı kaldır.",
    en: "This Google account is linked to another Watchify account. Disconnect it there first.",
  },
  [GoogleAuthCode.ALREADY_LINKED_HERE]: {
    tr: "Google hesabın zaten bağlı.",
    en: "Your Google account is already connected.",
  },
  [GoogleAuthCode.REQUIRES_RECENT_LOGIN]: {
    tr: "Güvenlik için çıkış yapıp tekrar giriş yaptıktan sonra dene.",
    en: "For security, sign out and sign in again, then retry.",
  },
  [GoogleAuthCode.NETWORK]: {
    tr: "İnternet bağlantısı kurulamadı. Bağlantını kontrol et.",
    en: "Could not reach the network. Check your connection.",
  },
  [GoogleAuthCode.ACCOUNT_REQUIRES_LINK]: {
    tr: "Bu e-posta ile zaten bir Watchify hesabı var. Önce e-posta ve şifrenle giriş yap, ardından Ayarlar > Hesap bağlantıları bölümünden Google'ı bağla.",
    en: "A Watchify account already uses this email. Sign in with email and password first, then connect Google from Settings > Account connections.",
  },
  [GoogleAuthCode.PLAY_SERVICES]: {
    tr: "Google Play Hizmetleri bu cihazda kullanılamıyor.",
    en: "Google Play Services is unavailable on this device.",
  },
  [GoogleAuthCode.MISCONFIGURED]: {
    tr: "Google girişi bu uygulama sürümünde kullanılamıyor.",
    en: "Google sign-in is unavailable in this build.",
  },
  [GoogleAuthCode.LAST_PROVIDER]: {
    tr: "Google şu anda tek giriş yöntemin, kaldırılamaz.",
    en: "Google is your only sign-in method and cannot be removed.",
  },
  [GoogleAuthCode.IN_PROGRESS]: {
    tr: "Google girişi zaten sürüyor.",
    en: "Google sign-in is already in progress.",
  },
  [GoogleAuthCode.NO_ID_TOKEN]: {
    tr: "Google kimlik doğrulaması tamamlanamadı. Tekrar dene.",
    en: "Google could not verify your identity. Please try again.",
  },
  [GoogleAuthCode.NO_SESSION]: {
    tr: "Oturum bulunamadı. Tekrar giriş yap.",
    en: "No active session. Please sign in again.",
  },
};

/**
 * Hata → kullanıcıya gösterilebilir metin. Ham Firebase/native mesajları
 * ("Firebase: Error (auth/...)") hiçbir zaman kullanıcıya sızmaz.
 */
export function describeGoogleAuthError(error, tr = true) {
  const entry = ERROR_TEXT[error?.code];
  if (entry) return tr ? entry.tr : entry.en;
  return tr
    ? "Beklenmeyen bir hata oluştu. Lütfen tekrar dene."
    : "Something went wrong. Please try again.";
}

// ── Yapılandırma ────────────────────────────────────────────────────────────

const WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  "427087836931-in7lreg3vjgnvudn5h8gauradaeo58kc.apps.googleusercontent.com";

// iOS'ta native SDK client id'yi GoogleService-Info.plist'ten okur. Plist
// yoksa iosClientId zorunludur.
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "";

let configured = false;

function configureGoogleSignIn() {
  if (configured) return;
  if (Platform.OS === "ios" && !IOS_CLIENT_ID) {
    // Kriptik native çökme yerine ne yapılması gerektiğini söyleyen bir hata.
    throw new GoogleAuthError(
      GoogleAuthCode.MISCONFIGURED,
      "iOS için Google girişi yapılandırılmamış (GoogleService-Info.plist / iosClientId eksik).",
    );
  }
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    offlineAccess: false,
    ...(IOS_CLIENT_ID ? { iosClientId: IOS_CLIENT_ID } : null),
  });
  configured = true;
}

// ── Eşzamanlılık kilidi ─────────────────────────────────────────────────────
// İki hızlı dokunuş native tarafta IN_PROGRESS'e düşer; JS tarafında keselim.

let busy = false;

async function withLock(fn) {
  if (busy) {
    throw new GoogleAuthError(
      GoogleAuthCode.IN_PROGRESS,
      "Google girişi zaten sürüyor.",
    );
  }
  busy = true;
  try {
    return await fn();
  } finally {
    busy = false;
  }
}

// ── Credential alma ─────────────────────────────────────────────────────────

/**
 * Hesap seçiciyi açar ve Firebase credential döner.
 * İptal edilirse null döner (hata değil — iptal normal bir sonuç).
 */
async function getGoogleCredential() {
  configureGoogleSignIn();

  if (Platform.OS === "android") {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  // Native oturum açık kalırsa SDK son hesabı sessizce yeniden kullanır:
  // kullanıcı hesap değiştiremez ve başarısız bir denemeden sonra hep aynı
  // hesapla tekrar dener. Seçicinin her seferinde çıkması için önce çıkış yap.
  await GoogleSignin.signOut().catch(() => {});

  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) return null; // { type: "cancelled" }

  const idToken = response.data?.idToken;
  if (!idToken) {
    throw new GoogleAuthError(
      GoogleAuthCode.NO_ID_TOKEN,
      "Google kimlik belirteci alınamadı.",
    );
  }
  return {
    credential: GoogleAuthProvider.credential(idToken),
    idToken,
    email: response.data?.user?.email || null,
  };
}

/**
 * Firebase'e Google credential gondermeden once sunucu tarafinda ayni e-posta
 * icin baska bir giris yontemi olup olmadigini denetler. Kontrol basarisizsa
 * guvenli tarafta kalip girisi durdurur; aksi halde Google, dogrulanmamis bir
 * email/sifre hesabini otomatik olarak ezebilir.
 */
async function assertGoogleSignInEligible(idToken, email) {
  try {
    const check = httpsCallable(fns, "checkGoogleSignInEligibility");
    await check({ idToken });
  } catch (error) {
    // Callable henuz yayinlanmadiysa (ornegin Firebase billing/Secret Manager
    // engeli) mevcut uygulamayi tamamen kilitleme. Eski projelerde email
    // enumeration protection kapaliysa bu Firebase kontrolu parola hesabini
    // yine yakalar. Protection aciksa bos liste donebilir; tam garanti icin
    // callable'in yayinlanmasi gerekir.
    if (error?.code === "functions/not-found" && email) {
      let methods;
      try {
        methods = await fetchSignInMethodsForEmail(auth, email);
      } catch (fallbackError) {
        throw toGoogleAuthError(fallbackError);
      }
      if (
        methods.length > 0 &&
        !methods.includes(GoogleAuthProvider.PROVIDER_ID)
      ) {
        throw new GoogleAuthError(
          GoogleAuthCode.ACCOUNT_REQUIRES_LINK,
          "Mevcut hesaba Google, Ayarlar'dan bağlanmalı.",
        );
      }
      return;
    }
    throw toGoogleAuthError(error);
  }
}

// ── Profil durumu ───────────────────────────────────────────────────────────

/**
 * Profil "tamam" mı?
 *
 * Kasıtlı olarak isValidUsername (regex) KULLANMAZ. Eski hesaplarda nokta veya
 * Türkçe karakter içeren, yahut 20 karakterden uzun username'ler var; regex ile
 * ölçseydik bu kullanıcılar Google'ı bağladıkları anda "profilin eksik" deyip
 * tamamlama ekranına düşer ve profilleri sıfırlanırdı. Burada sorulan tek soru:
 * bu hesabın bir username'i var mı?
 */
export function isGoogleProfileComplete(profile) {
  return typeof profile?.username === "string" && profile.username.trim().length > 0;
}

async function readProfile(uid) {
  const snap = await getDoc(doc(db, "Users", uid));
  return snap.exists() ? snap.data() : null;
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function signInWithGoogle() {
  return withLock(async () => {
    let credential;
    try {
      const selected = await getGoogleCredential();
      if (!selected) return { cancelled: true };
      await assertGoogleSignInEligible(selected.idToken, selected.email);
      credential = selected.credential;
    } catch (error) {
      throw toGoogleAuthError(error);
    }

    let user;
    try {
      const result = await signInWithCredential(auth, credential);
      user = result.user;
    } catch (error) {
      // Firebase reddettiyse native oturumu da bırakma; yoksa sonraki deneme
      // aynı hesapla sessizce tekrar başarısız olur.
      await GoogleSignin.signOut().catch(() => {});
      throw toGoogleAuthError(error);
    }

    // Buradan sonrası KRİTİK: Firebase oturumu artık açık. Profil okuması
    // başarısız olsa bile FIRLATMIYORUZ — yoksa kullanıcı "giriş başarısız"
    // toast'ı görürken aslında giriş yapmış olurdu (onAuthStateChanged zaten
    // tetiklendi).
    //
    // Okuma ile işaret yazımı ayrı ele alınır. Tek bir try içinde olsalardı,
    // başarılı bir okumadan sonra gelen AsyncStorage yazım hatası (Android'de
    // SQLite tabanlı: disk doluyken okumalar çalışır, yazımlar düşer) aynı
    // catch'e düşer ve doğru hesapladığımız cevabı, yazamadığı işaretten
    // türetilen YANLIŞ cevapla değiştirirdi — profilsiz kullanıcı TabScreen'e
    // girerdi.
    let profile = null;
    let readOk = true;
    try {
      profile = await readProfile(user.uid);
    } catch {
      readOk = false;
    }

    let needsProfileCompletion;
    if (readOk) {
      needsProfileCompletion = !isGoogleProfileComplete(profile);
      // İşaret yazımı best-effort: kararı değiştirmez, yalnızca kalıcılaştırır.
      await (
        needsProfileCompletion
          ? AsyncStorage.setItem(GOOGLE_PROFILE_PENDING_KEY, user.uid)
          : AsyncStorage.removeItem(GOOGLE_PROFILE_PENDING_KEY)
      ).catch(() => {});
    } else {
      // Profil doğrulanamadı (çevrimdışı / kural). Kararı işarete bırak: onu
      // yazarken profilin eksik olduğunu BİLİYORDUK. AuthContext bir sonraki
      // açılışta Firestore'dan yeniden uzlaştırır.
      const pending = await AsyncStorage.getItem(GOOGLE_PROFILE_PENDING_KEY).catch(
        () => null,
      );
      needsProfileCompletion = pending === user.uid;
    }

    return { user, needsProfileCompletion, cancelled: false };
  });
}

export async function linkGoogleAccount() {
  return withLock(async () => {
    const current = auth.currentUser;
    if (!current) {
      throw new GoogleAuthError(GoogleAuthCode.NO_SESSION, "Oturum bulunamadı.");
    }

    let credential;
    try {
      const selected = await getGoogleCredential();
      if (!selected) return { cancelled: true };
      credential = selected.credential;
    } catch (error) {
      throw toGoogleAuthError(error);
    }

    try {
      await linkWithCredential(current, credential);
    } catch (error) {
      // Bağlama reddedildi: native oturumu bırakma ki kullanıcı bir dahaki
      // denemede başka bir Google hesabı seçebilsin.
      await GoogleSignin.signOut().catch(() => {});
      throw toGoogleAuthError(error);
    }

    // linkWithCredential providerData'yı zaten günceller; reload() yalnızca
    // sunucuyla tazeleme. Başarısız olması bağlamayı geçersiz kılmaz, bu
    // yüzden fatal değil — aksi halde "bağlandı ama UI bağlanmadı" derdi.
    await current.reload().catch(() => {});

    return { cancelled: false };
  });
}

export async function unlinkGoogleAccount() {
  const user = auth.currentUser;
  if (!user) {
    throw new GoogleAuthError(GoogleAuthCode.NO_SESSION, "Oturum bulunamadı.");
  }
  if (user.providerData.length <= 1) {
    throw new GoogleAuthError(
      GoogleAuthCode.LAST_PROVIDER,
      "Hesaba erişimi kaybetmemek için tek giriş yöntemi kaldırılamaz.",
    );
  }
  try {
    await unlink(user, GoogleAuthProvider.PROVIDER_ID);
  } catch (error) {
    throw toGoogleAuthError(error);
  }
  await Promise.allSettled([GoogleSignin.signOut(), user.reload()]);
}

/**
 * Tamamlama ekranındaki "Başka hesap kullan".
 *
 * Profili hiç oluşmamış hesabı Auth'tan da siler. Aksi halde e-posta kalıcı
 * olarak "kullanımda" görünür ve kullanıcı sonradan aynı adresle e-posta/şifre
 * kaydı yapamaz (auth/email-already-in-use) — hiç açmadığı bir hesap yüzünden.
 */
export async function cancelGoogleRegistration() {
  const current = auth.currentUser;
  await AsyncStorage.removeItem(GOOGLE_PROFILE_PENDING_KEY).catch(() => {});
  await GoogleSignin.signOut().catch(() => {});

  if (current) {
    // Silmeden önce profilin GERÇEKTEN yok olduğunu doğrula. Bayat bir pending
    // işareti profili tam olan bir kullanıcıyı da bu ekrana düşürebilir; onun
    // hesabını silmek felaket olur. Okuyamazsak silme.
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
        // requires-recent-login vb. → en azından oturumu kapat.
      }
    }
  }
  await firebaseSignOut(auth);
}
