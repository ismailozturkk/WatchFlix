import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase"; // Firebase bağlantını ekle
import {
  Keys,
  get,
  set,
  remove,
  setActiveUser,
  getActiveUser,
  clearUserScope,
} from "../services/storage";
import { resetSnapshotCache } from "../services/snapshotCache";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import {
  GOOGLE_PROFILE_PENDING_KEY,
  isGoogleProfileComplete,
} from "../services/googleAuthService";

const AuthContext = createContext();

/**
 * Google kullanıcısı profilini tamamlamadan uygulamaya giremez.
 *
 * GOOGLE_PROFILE_PENDING_KEY yalnızca bir İPUCU'dur, karar değil. Tek başına
 * güvenilirse işaret bayatladığı anda (profil başka cihazda tamamlandı, ya da
 * temizleme adımı hata aldı) kullanıcı tamamlama ekranına kilitlenir: kendi
 * username'ini "alınmış" görür ve profilini yeniden yazmaya zorlanır. Bu yüzden
 * işareti her açılışta Firestore'dan uzlaştırıyoruz.
 */
async function resolveInitialRoute(user) {
  const isGoogleUser = user.providerData.some(
    (provider) => provider.providerId === "google.com",
  );
  const pendingUid = get(Keys.googleProfilePendingUid);

  if (!isGoogleUser) return "TabScreen";

  try {
    const profileSnap = await getDoc(doc(db, "Users", user.uid));
    const profile = profileSnap.exists() ? profileSnap.data() : null;

    if (isGoogleProfileComplete(profile)) {
      // Profil tamam: bayat işareti temizle, yoksa her açılışta geri düşer.
      if (pendingUid === user.uid) remove(Keys.googleProfilePendingUid);
      return "TabScreen";
    }

    set(Keys.googleProfilePendingUid, user.uid);
    return "GoogleProfileCompletionScreen";
  } catch {
    // Profil okunamadı (çevrimdışı / kural). İşaret varsa ona uy: onu yazarken
    // profilin eksik olduğunu BİLİYORDUK. İşaret yoksa kullanıcıyı dışarıda
    // bırakma — profil zaten çevrimdışı tamamlanamaz, kapıda tutmak da çözmez.
    return pendingUid === user.uid ? "GoogleProfileCompletionScreen" : "TabScreen";
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState("LoginScreen");
  // "Girişli ama profilsiz" gerçek bir durum: Google kullanıcısı tamamlama
  // ekranındayken oturum açıktır. Bu bayrak, o aradaki kullanıcı için hesaba
  // bağlı doküman yazılmasını engeller — profil hiç oluşmadan hesap silinirse
  // (bkz. cancelGoogleRegistration) o dokümanlar sahipsiz kalır ve kural
  // isOwner(uid) bir daha asla doğru olamayacağı için kalıcı olarak erişilemez
  // hale gelir.
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);

  // Profil tamamlandığında onAuthStateChanged yeniden tetiklenmez; ekran bunu
  // çağırarak kapıyı açar.
  const markProfileCompleted = useCallback(() => {
    setNeedsProfileCompletion(false);
    setInitialRoute("TabScreen");
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Kullanıcı kapsamlı anahtarların (taslaklar, AI sohbetleri, avatar)
        // hangi kovaya yazılacağını bu belirler — resolveInitialRoute'tan da
        // ÖNCE kurulmalı, o yol depolamayı okuyor.
        setActiveUser(user.uid);
        let route = "TabScreen";
        try {
          route = await resolveInitialRoute(user);
        } catch {
          route = "TabScreen";
        }
        setInitialRoute(route);
        setNeedsProfileCompletion(route === "GoogleProfileCompletionScreen");
        setUser(user);
        setLoading(false);
        set(Keys.cachedUserId, user.uid);
      } else {
        // İlk açılışta (onboarding görülmediyse) tanıtım akışına, sonrasında
        // doğrudan giriş ekranına yönlendir.
        const seenOnboarding = get(Keys.hasSeenOnboarding);
        // ⚠️ GELİŞTİRME MODU: onboarding'i her açılışta göster.
        // __DEV__ kapısı sayesinde release build'de normal akış çalışır:
        // onboarding yalnızca ilk açılışta görünür.
        const FORCE_ONBOARDING_DEV = __DEV__;
        setInitialRoute(
          FORCE_ONBOARDING_DEV || !seenOnboarding
            ? "OnboardingScreen"
            : "LoginScreen",
        );
        setUser(null);
        setNeedsProfileCompletion(false);
        setLoading(false);

        // ÇIKIŞ TEMİZLİĞİ. Eskiden yalnız `cachedUserId` siliniyordu; avatar,
        // liste durumu, aktivite önbelleği, taslaklar ve AI sohbet geçmişi
        // cihazda kalıyordu — sonraki hesap aynı cihazda öncekinin verisini
        // görüyordu. clearUserScope registry'deki kapsam bilgisini kullanır ve
        // `keepOnLogout` işaretlilere (izleme defteri serileri, aktivasyon
        // damgası, oyun tercihleri) DOKUNMAZ; oturum deposunu komple boşaltır,
        // yani `cachedUserId` de orada silinir.
        const previousUid = getActiveUser();
        setActiveUser(null);
        clearUserScope(previousUid);
        // Anlık görüntü katmanının SÜREÇ İÇİ belleği de sıfırlanmalı: disk
        // temizlense bile "en son şunu yazmıştım" kaydı kalırsa aynı oturumda
        // geri giren kullanıcının ilk snapshot'ı diske hiç inmez, üstelik
        // okuma önbelleği önceki hesabın verisini döndürürdü.
        resetSnapshotCache();
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        initialRoute,
        needsProfileCompletion,
        markProfileCompleted,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Kullanımı kolaylaştıran özel hook
export const useAuth = () => useContext(AuthContext);
