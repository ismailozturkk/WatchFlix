// hooks/useBadgeShowcase.js
//
// Kullanıcının profil vitrininde (ve arkadaş profilinde) sergilediği en fazla 4
// rozetin okuma, seçme/çıkarma ve yerel (MMKV) + bulut (Users/{uid}.showcaseBadges)
// senkronizasyon kancası.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@context/AuthContext";
import { useUserProfile } from "@context/UserProfileContext";
import { useWatchProgressContext } from "@context/WatchProgressContext";
import { Keys, has as hasStored, set as setStored, useStored } from "@services/storage";
import { updateUserProfile } from "@services/userService";
import {
  MAX_SHOWCASE_BADGES,
  isBadgeInShowcase,
  normalizeShowcaseBadges,
  readProfileShowcaseBadges,
   removeShowcaseBadge,
  resolveShowcaseBadges,
  toggleShowcaseBadge,
  upgradeShowcaseIdsWithCards,
} from "@utils/badgeShowcase";

export default function useBadgeShowcase() {
  const { user } = useAuth() || {};
  const uid = user?.uid || null;
  const { profile } = useUserProfile() || {};
  const watchProgress = useWatchProgressContext() || {};
  const kartlar = watchProgress.kartlar;

  const localRaw = useStored(Keys.showcaseBadges, { uid });
  const remoteIds = useMemo(() => readProfileShowcaseBadges(profile), [profile]);
  const localNormalized = useMemo(() => normalizeShowcaseBadges(localRaw), [localRaw]);

  // Yeni cihazda yerel kayıt henüz hiç yazılmamışsa buluttaki seçimleri içeri al.
  const hydratedUidRef = useRef(null);
  useEffect(() => {
    if (!uid) return;
    if (hydratedUidRef.current === uid) return;
    const localExists = hasStored(Keys.showcaseBadges, { uid });
    if (!localExists && remoteIds.length > 0) {
      hydratedUidRef.current = uid;
      setStored(Keys.showcaseBadges, remoteIds, { uid });
      return;
    }
    if (localExists) {
      hydratedUidRef.current = uid;
    }
  }, [uid, remoteIds]);

  const baseIds = useMemo(() => {
    if (localNormalized.length > 0) return localNormalized;
    if (uid && !hasStored(Keys.showcaseBadges, { uid }) && remoteIds.length > 0) {
      return remoteIds;
    }
    return localNormalized;
  }, [localNormalized, remoteIds, uid]);

  // Kademeli ailede üst kademeye geçildiyse vitrin id'sini güncel kademeye yükselt.
  const showcaseIds = useMemo(
    () => upgradeShowcaseIdsWithCards(baseIds, kartlar),
    [baseIds, kartlar],
  );

  const lastSyncedSigRef = useRef("");
  useEffect(() => {
    if (!uid || !Array.isArray(kartlar) || !kartlar.length) return;
    const baseSig = baseIds.join(",");
    const nextSig = showcaseIds.join(",");
    if (baseSig !== nextSig && lastSyncedSigRef.current !== nextSig) {
      lastSyncedSigRef.current = nextSig;
      setStored(Keys.showcaseBadges, showcaseIds, { uid });
      updateUserProfile(uid, { showcaseBadges: showcaseIds }).catch(() => {});
    }
  }, [uid, kartlar, baseIds, showcaseIds]);

  const persistShowcase = useCallback(
    (nextIds) => {
      const clean = normalizeShowcaseBadges(nextIds);
      setStored(Keys.showcaseBadges, clean, { uid });
      if (uid) {
        lastSyncedSigRef.current = clean.join(",");
        updateUserProfile(uid, { showcaseBadges: clean }).catch(() => {});
      }
      return clean;
    },
    [uid],
  );

  const toggleBadge = useCallback(
    (badgeOrId) => {
      const res = toggleShowcaseBadge(showcaseIds, badgeOrId);
      if (res.action === "added" || res.action === "removed") {
        persistShowcase(res.next);
      }
      return res;
    },
    [showcaseIds, persistShowcase],
  );

  const removeBadge = useCallback(
    (badgeOrId) => {
      const next = removeShowcaseBadge(showcaseIds, badgeOrId);
      if (next.length !== showcaseIds.length) {
        persistShowcase(next);
      }
      return next;
    },
    [showcaseIds, persistShowcase],
  );

  const isShowcased = useCallback(
    (badgeOrId) => isBadgeInShowcase(showcaseIds, badgeOrId),
    [showcaseIds],
  );

  const showcaseCards = useMemo(
    () => resolveShowcaseBadges(showcaseIds, kartlar),
    [showcaseIds, kartlar],
  );

  return useMemo(
    () => ({
      showcaseIds,
      showcaseCards,
      toggleBadge,
      removeBadge,
      isShowcased,
      canAddMore: showcaseIds.length < MAX_SHOWCASE_BADGES,
      maxSlots: MAX_SHOWCASE_BADGES,
    }),
    [showcaseIds, showcaseCards, toggleBadge, removeBadge, isShowcased],
  );
}
