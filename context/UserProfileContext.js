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
import * as cacheStore from "../utils/cacheStore";
import { cacheKeys } from "../utils/cacheKeys";
import { shouldPersistInternetData } from "../utils/dataCacheSettings";
import {
  migrateUserIfNeeded,
  updateUserProfile,
  setAvatarIndex as setAvatarIndexService,
  updatePrivacy as updatePrivacyService,
  changeUsername as changeUsernameService,
  DEFAULT_PRIVACY,
} from "../services/userService";

const UserProfileContext = createContext();
export const useUserProfile = () => useContext(UserProfileContext);

export function UserProfileProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);

  const migrationDoneRef = useRef(new Set());

  // ── 1) Login sonrası migration (yalnızca bir kez per uid) ────────────────
  useEffect(() => {
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
  }, [uid]);

  // ── 2) Realtime listener — kullanıcının kendi profili ────────────────────
  useEffect(() => {
    if (!uid) return;
    // Offline-first: önce cache'ten anında seed et (internet yoksa da gösterir).
    const cached = cacheStore.getJSON(...cacheKeys.profile(uid));
    if (cached) {
      setProfile(cached);
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
          if (shouldPersistInternetData()) {
            cacheStore.setJSON(...cacheKeys.profile(uid), p);
          }
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
  }, [uid]);

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
