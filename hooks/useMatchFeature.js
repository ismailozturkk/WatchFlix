// hooks/useMatchFeature.js
//
// Zevk Çemberleri (Faz 4) — ekranların tek giriş noktası:
//   available  bayrak açık VE 18+ kanıtlı (ikisinden biri yoksa hiçbir eşleşme öğesi çizilmez)
//   optedIn / lanes / needsConsent  katılım belgesinden (yalnız available iken dinlenir)
//   join(lanes) / leave()            yazım + ölçüm olayı
// Bkz. utils/matchFeature.js (kararlar), services/matchOptIn.js (Firestore).

import { useCallback, useEffect, useState } from "react";
import { useUserProfile } from "../context/UserProfileContext";
import { ANALYTICS_EVENTS, trackEvent } from "../services/analytics";
import { fetchMatchConfig, leaveMatch, saveMatchOptIn, subscribeMatchOptIn } from "../services/matchOptIn";
import { readOptIn, resolveMatchFeature } from "../utils/matchFeature";

const OFF = Object.freeze({ optedIn: false, lanes: [], needsConsent: false });

/** @param {{ subscribe?: boolean }} [options] subscribe:false → yalnız kapı (available); katılım belgesi dinlenmez. */
export default function useMatchFeature({ subscribe = true } = {}) {
  const { uid, profile } = useUserProfile() || {};
  const [config, setConfig] = useState(null);
  const [optIn, setOptIn] = useState(OFF);
  const [optInLoaded, setOptInLoaded] = useState(false);

  // Geliştirici derlemesinde bayrak zorla açık → AppConfig okunmaz.
  useEffect(() => {
    if (__DEV__) return undefined;
    let alive = true;
    fetchMatchConfig().then((c) => alive && setConfig(c));
    return () => {
      alive = false;
    };
  }, []);

  const { flag, adult, available } = resolveMatchFeature({ config, isDev: __DEV__, birthDate: profile?.birthDate });

  useEffect(() => {
    setOptIn(OFF);
    setOptInLoaded(false);
    if (!subscribe || !available || !uid) return undefined;
    return subscribeMatchOptIn(uid, (data) => {
      setOptIn(readOptIn(data));
      setOptInLoaded(true);
    });
  }, [subscribe, available, uid]);

  const join = useCallback(
    async (lanes) => {
      if (!available || !uid) return null;
      const saved = await saveMatchOptIn(uid, lanes);
      trackEvent(saved.optIn ? ANALYTICS_EVENTS.MATCH_OPT_IN : ANALYTICS_EVENTS.MATCH_OPT_OUT, { lanes: saved.lanes.join(",") });
      return saved;
    },
    [available, uid],
  );

  const leave = useCallback(async () => {
    if (!uid) return;
    await leaveMatch(uid);
    trackEvent(ANALYTICS_EVENTS.MATCH_OPT_OUT, { lanes: "" });
  }, [uid]);

  return { flag, adult, available, loaded: optInLoaded, ...optIn, join, leave };
}
