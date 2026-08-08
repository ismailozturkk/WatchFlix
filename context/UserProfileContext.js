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
import useStartupGate from "../hooks/useStartupGate";

const UserProfileContext = createContext();
export const useUserProfile = () => useContext(UserProfileContext);

export function UserProfileProvider({ children }) {
  const { user } = useAuth();
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

  // Açılış karesi profili tohumdan çiziyor (yukarıdaki ilkTohum, senkron);
  // migration round-trip'i ve canlı listener splash penceresinin dışına
  // ertelenebilir. ChatModal ~3,8 sn'de kurulduğu için kapı ondan önce açılır.
  // Kademeler: hooks/useStartupGate.js.
  const startupReady = useStartupGate(2800);

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
        if (snap.exists()) {
          const p = { uid: snap.id, ...snap.data() };
          setProfile(p);
          // "Verileri indir" ayarına bilerek TABİ DEĞİL: o ayar TMDB içeriğini
          // indirmekle ilgili, bu kullanıcının kendi profili. Tutmamak veri
          // tasarrufu sağlamıyor, yalnızca her açılışı yavaşlatıyordu.
          publish(cacheKeys.profile(uid), p);
        } else {
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
    return () => unsub();
  }, [uid, startupReady]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const updateField = useCallback(
    async (partial) => {
      if (!uid) return;
      await updateUserProfile(uid, partial);
    },
    [uid],
  );

  const changeAvatarIndex = useCallback(
    async (index) => {
      if (!uid) return;
      await setAvatarIndexService(uid, index);
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
      privacy,

      // counters (denormalize)
      friendsCount: profile?.friendsCount || 0,
      postsCount: profile?.postsCount || 0,
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
