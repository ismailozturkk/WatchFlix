// context/UserProfileContext.js
//
// Kullanıcının kendi Users/{uid} dokümanı için tek doğru kaynak.
//   - Login sonrası `migrateUserIfNeeded` çağırır (eski şema → yeni şema)
//   - Sonra `onSnapshot` ile gerçek zamanlı dinler
//   - UI: `useUserProfile()` ile herhangi bir alanı okur
//
// AuthContext'in DAİMA üstünde değil ALTINDA render edilmelidir.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";
import { isAuthTransitionError } from "../utils/firestoreError";
import { cacheKeys } from "../utils/cacheKeys";
import { publish, seed } from "../services/snapshotCache";
import { getActiveUser } from "../services/storage";
import {
  migrateUserIfNeeded,
  updateUserProfile,
  setAvatarIndex as setAvatarIndexService,
  updatePrivacy as updatePrivacyService,
  changeUsername as changeUsernameService,
  DEFAULT_PRIVACY,
} from "../services/userService";
import {
  migrateRootAccountFields,
  subscribeAccountPrivate,
} from "../services/accountPrivateService";
import { adoptPendingFavorites } from "../services/fourFavoritesService";
import { readPendingFavorites } from "../services/pendingFavorites";
import useStartupGate from "../hooks/useStartupGate";
import {
  calculateAge,
  clearAgeRestriction,
  isAgeRestrictedProfile,
  syncAgeRestriction,
} from "../utils/ageGate";
import { trackFirestoreRead } from "../services/usageTrackerService";

const UserProfileContext = createContext();
export const useUserProfile = () => useContext(UserProfileContext);

// Doğum tarihi artık kök belgede değil, gizli belgede (private/account; kök
// herkese okunur). Uygulamanın geri kalanı `profile.birthDate` okumaya devam
// etsin diye iki kaynak burada birleşir. Gizli belge KAZANIR; kökteki alan yalnız
// henüz taşınmamış eski hesabın yedeği.
function withAccount(root, account) {
  if (!root || !account?.birthDate) return root;
  return { ...root, birthDate: account.birthDate };
}

// Kökte taşınması gereken eski kopya var mı? (alan VAR olması yeterli: geçersiz
// değer de kökten temizlenir.)
function hasLegacyAccountFields(data) {
  return !!data && ("birthDate" in data || "email" in data);
}

export function UserProfileProvider({ children }) {
  // `loading`: Firebase oturumu HENÜZ çözmedi. Yaş kısıtı aynasında "çıkış
  // yapılmış" ile "daha bilmiyoruz" durumlarını ayırmak için gerekli.
  const { user, loading: authLoading } = useAuth();
  const uid = user?.uid;

  // AÇILIŞ TOHUMU — son oturumun profili diskten SENKRON okunur, yani ilk
  // karede çizilir. Aşağıdaki listener efekti de aynı tohumu okuyordu ama
  // efekt ilk boyamadan SONRA çalıştığı için önbellek dolu olsa bile bir kare
  // "yükleniyor" görünüyordu.
  //
  // `useMemo(..., [])`: yalnız ilk render. uid sonradan değişirse (giriş) o
  // geçişi listener efekti kendi tohumuyla karşılıyor.
  const ilkTohum = useMemo(
    () => {
      // Firebase oturumu ASENKRON çözülüyor; ilk render'da `uid` çoğu zaman
      // henüz null olur ve tohum hiç okunmazdı. Depodaki son aktif kullanıcı
      // senkron okunabildiği için tohumu ondan alıyoruz (aynı desen:
      // ListStatusContext).
      const tohumUid = uid ?? getActiveUser();
      return tohumUid ? seed(cacheKeys.profile(tohumUid)) : null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [profile, setProfile] = useState(ilkTohum?.data ?? null);
  const [loading, setLoading] = useState(!ilkTohum?.hasCache);
  const [migrating, setMigrating] = useState(false);

  const migrationDoneRef = useRef(new Set());

  // Kök belge ve gizli belge AYRI dinleniyor; `profile` ikisinin birleşimi.
  // `accountRef`: undefined = henüz bilinmiyor, null = belge yok, nesne = veri.
  const rootRef = useRef(null);
  const accountRef = useRef(undefined);
  const accountMigrationTried = useRef(new Set());
  const [accountUid, setAccountUid] = useState(null);
  const applyProfile = useCallback((forUid) => {
    // Kök henüz gelmediyse DOKUNMA: state'te önbellekten tohumlanmış profil var,
    // null'lamak onu boşa düşürürdü.
    if (!rootRef.current) return;
    const merged = withAccount(rootRef.current, accountRef.current);
    setProfile(merged);
    // "Verileri indir" ayarına bilerek TABİ DEĞİL: o ayar TMDB içeriğini
    // indirmekle ilgili, bu kullanıcının kendi profili. Tutmamak veri
    // tasarrufu sağlamıyor, yalnızca her açılışı yavaşlatıyordu.
    // Birleşik hâl yayınlanıyor: soğuk açılışta tohumda tarih de olsun, yaş
    // kapısı gizli belge okunana kadar boşa düşmesin.
    publish(cacheKeys.profile(forUid), merged);
  }, []);

  // Açılış karesi profili tohumdan çiziyor (yukarıdaki ilkTohum, senkron);
  // migration round-trip'i ve canlı listener splash penceresinin dışına
  // ertelenebilir. Kademeler: hooks/useStartupGate.js.
  const startupReady = useStartupGate(1200);

  // ── 1) Login sonrası migration (yalnızca bir kez per uid) ────────────────
  useEffect(() => {
    if (!startupReady) return;
    if (!uid) {
      setProfile(null);
      setLoading(false);
      return;
    }
    if (migrationDoneRef.current.has(uid)) return;

    setMigrating(true);
    migrateUserIfNeeded(uid)
      .then((res) => {
        migrationDoneRef.current.add(uid);
        if (__DEV__ && res.migrated) {
          console.log("[UserProfile] migration ok:", res.fieldsAdded);
        }
      })
      .catch((e) => {
        if (__DEV__) console.warn("[UserProfile] migration failed:", e.message);
      })
      .finally(() => setMigrating(false));
  }, [uid, startupReady]);

  // ── 2) Realtime listener — kullanıcının kendi profili ────────────────────
  useEffect(() => {
    if (!startupReady) return undefined;
    if (!uid) return;
    // Offline-first: önce cache'ten anında seed et (internet yoksa da gösterir).
    // İlk render için bu iş yukarıdaki `ilkTohum` ile zaten yapıldı; burası
    // uid DEĞİŞİMİ (hesap geçişi) içindir.
    const cached = seed(cacheKeys.profile(uid));
    if (cached.hasCache) {
      setProfile(cached.data);
      setLoading(false);
    } else {
      setLoading(true);
    }
    const unsub = onSnapshot(
      doc(db, "Users", uid),
      (snap) => {
        trackFirestoreRead("Users", 1);
        if (snap.exists()) {
          const data = snap.data();
          rootRef.current = { uid: snap.id, ...data };
          applyProfile(uid);
          // Kökte eski e-posta/doğum tarihi kopyası kaldıysa sahibi olarak
          // gizli belgeye taşı ve kökten sil (oturum + hesap başına bir kez; bir
          // hata sessizce geçilir — kurallar henüz yayında değilse silme
          // reddedilir, sonraki oturumda yeniden denenir).
          if (hasLegacyAccountFields(data) && !accountMigrationTried.current.has(uid)) {
            accountMigrationTried.current.add(uid);
            migrateRootAccountFields(uid, data).catch((e) => {
              if (__DEV__) console.warn("[UserProfile] hesap göçü:", e?.message);
            });
          }
        } else {
          rootRef.current = null;
          setProfile(null);
        }
        setLoading(false);
      },
      (err) => {
        if (!isAuthTransitionError(err) && __DEV__)
          console.warn("[UserProfile] snapshot error:", err.message);
        setLoading(false);
      },
    );
    return () => {
      unsub();
      rootRef.current = null;
    };
  }, [uid, startupReady, applyProfile]);

  // ── 2b) Gizli hesap belgesi (private/account) ────────────────────────────
  //
  // Doğum tarihi burada. Tek küçük belge; tarih yazılırken (kayıt, profil
  // düzenleme) anında yansısın diye tek seferlik okuma yerine dinleniyor.
  // `accountUid`: hangi hesap için ilk anlık görüntünün geldiği — hesap
  // değişince önceki hesabın "biliniyor" durumu yeni hesaba SIZMASIN.
  useEffect(() => {
    if (!startupReady) return undefined;
    if (!uid) return undefined;
    accountRef.current = undefined;
    const unsub = subscribeAccountPrivate(
      uid,
      (data) => {
        trackFirestoreRead("Users", 1);
        accountRef.current = data;
        setAccountUid(uid);
        applyProfile(uid);
      },
      (err) => {
        // Okunamadı = BİLİNMİYOR (izin/ağ). "Tarih yok" sayılmaz; yaş kapısı
        // elindeki değeri korur (aşağıdaki efekt).
        if (!isAuthTransitionError(err) && __DEV__)
          console.warn("[UserProfile] private/account error:", err.message);
      },
    );
    return () => {
      unsub();
      accountRef.current = undefined;
    };
  }, [uid, startupReady, applyProfile]);

  // ── 3) Yaş kısıtı aynası ─────────────────────────────────────────────────
  //
  // Yetişkin içerik süzgeci (utils/tmdbAdultGuard.js) her TMDB isteğinde SENKRON
  // bir cevap istiyor, Firestore ise asenkron. Profilden türetilen tek bir
  // boolean cihaza yazılıyor; süzgeç ve Ayarlar ekranı onu okuyor.
  //
  // `startupReady`i BEKLEMİYOR: yukarıdaki `ilkTohum` profili ilk render'da
  // diskten senkron veriyor, yani uygulama yeniden açıldığında kısıt daha ilk
  // karede yerinde oluyor. Kapak açık kalan tek pencere, HİÇ önbelleği olmayan
  // taze bir girişte listener'ın ilk anlık görüntüsüne kadar geçen süre.
  //
  // BAYRAĞA "BİLMİYORUM" DURUMUNDA DOKUNULMAZ. Bayrak oturum deposunda, yani
  // uygulama yeniden açıldığında geçen oturumdan kalan doğru değerle geliyor.
  // Firebase oturumu çözene kadar `uid` null; bunu "çıkış yapılmış" sayıp
  // temizleseydik 18 altı bir cihaz her açılışta birkaç saniye korumasız
  // kalırdı. Aynı şekilde profil henüz gelmediyse de eldeki değer korunur.
  //
  // DOĞUM TARİHİ GİZLİ BELGEDE (private/account). Taşınmış bir hesapta kök
  // belgede tarih YOKTUR; gizli belge okunmadan "tarih yok" sonucuna varmak
  // 18 altı hesabın kısıtını kaldırırdı. Bu yüzden tarih elde yokken (önbellek
  // tohumu da tarihi taşır) karar, gizli belgenin ilk anlık görüntüsüne kadar
  // BEKLER; okunamazsa (izin/ağ) bayrak olduğu gibi kalır.
  const birthDate = profile?.birthDate ?? null;
  const profilVar = !!profile;
  const accountKnown = accountUid === uid;
  useEffect(() => {
    if (authLoading) return;
    if (!uid) {
      clearAgeRestriction();
      return;
    }
    if (!profilVar) return;
    if (!birthDate && !accountKnown) return;
    syncAgeRestriction(birthDate);
  }, [authLoading, uid, profilVar, birthDate, accountKnown]);

  // ── 4) Tanıtımda seçilen "dört favori"yi hesaba taşı ──────────────────────
  //
  // Tanıtım hesap açılmadan ÖNCE gösterilir; orada seçilen favoriler cihazda
  // bekler (services/pendingFavorites.js). Profil belgesi ilk yüklendiğinde —
  // yeni kayıt ya da ilk giriş — bir kez Users/{uid}.fourFavorites'e aktarılır.
  // Hesapta alan zaten varsa ona dokunulmaz (bkz. adoptPendingFavorites).
  //
  // Bekleyen kopya yoksa (neredeyse her açılış) efekt tek bir senkron depo
  // okumasıyla biter. Çevrimdışı düşerse bir sonraki profil anlık görüntüsünde
  // yeniden denenir.
  const favoritesAdoptTried = useRef(new Set());
  useEffect(() => {
    if (!uid || !profile || profile.uid !== uid) return;
    if (favoritesAdoptTried.current.has(uid)) return;
    if (!readPendingFavorites()) return;
    favoritesAdoptTried.current.add(uid);
    adoptPendingFavorites(uid)
      .then((outcome) => {
        if (outcome === "offline") favoritesAdoptTried.current.delete(uid);
      })
      .catch(() => favoritesAdoptTried.current.delete(uid));
  }, [uid, profile]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const updateField = useCallback(
    async (partial) => {
      if (!uid) return;
      await updateUserProfile(uid, partial);
    },
    [uid],
  );

  const changeAvatarIndex = useCallback(
    async (index, photoURL = null) => {
      if (!uid) return;
      await setAvatarIndexService(uid, index, photoURL);
    },
    [uid],
  );

  const updatePrivacy = useCallback(
    async (partialPrivacy) => {
      if (!uid) return;
      await updatePrivacyService(uid, partialPrivacy);
    },
    [uid],
  );

  const changeUsername = useCallback(
    async (newUsername) => {
      if (!uid) return;
      await changeUsernameService(uid, newUsername);
    },
    [uid],
  );

  // ── Derived helpers ──────────────────────────────────────────────────────

  const privacy = profile?.privacy || DEFAULT_PRIVACY;
  const avatarIndex = typeof profile?.avatarIndex === "number" ? profile.avatarIndex : 0;
  const photoURL = profile?.photoURL || user?.photoURL || null;
  // Yaş her okumada doğum tarihinden türetilir — 18'ine giren kullanıcının
  // kısıtı doğru günde kendiliğinden kalkar (bkz. utils/ageGate.js).
  const age = calculateAge(birthDate);
  const ageRestricted = isAgeRestrictedProfile(birthDate);

  const value = useMemo(
    () => ({
      // state
      profile,
      loading: loading || migrating,
      uid,

      // common shortcuts
      username: profile?.username || "",
      displayName: profile?.displayName || "",
      avatarIndex,
      photoURL,
      privacy,
      birthDate,
      age,
      ageRestricted,

      // counters (denormalize)
      friendsCount: profile?.friendsCount || 0,
      postsCount: Math.max(0, profile?.postsCount || 0), // sayaç sürüklenip negatife düşebilir
      followersCount: profile?.followersCount || 0,
      followingCount: profile?.followingCount || 0,
      pendingRequestsInCount: profile?.pendingRequestsInCount || 0,
      pendingRequestsOutCount: profile?.pendingRequestsOutCount || 0,
      unreadNotifsCount: profile?.unreadNotifsCount || 0,

      // actions
      updateField,
      changeAvatarIndex,
      updatePrivacy,
      changeUsername,
    }),
    [
      profile,
      loading,
      migrating,
      uid,
      avatarIndex,
      privacy,
      birthDate,
      age,
      ageRestricted,
      updateField,
      changeAvatarIndex,
      updatePrivacy,
      changeUsername,
    ],
  );

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}
