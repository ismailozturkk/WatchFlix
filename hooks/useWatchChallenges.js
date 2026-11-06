// hooks/useWatchChallenges.js
//
// Meydan Okumalar: cihaz-yerel katılım kaydı (Keys.watchChallenges) + ProfileStatsContext'in zaten açık olan izleme
// verisinden türeyen ilerleme. Karar mantığı utils/watchChallenges.js'te (saf, testli); burada yalnız depoya,
// veriye ve film ayrıntısına (services/watchChallengeMeta.js) bağlama.
//
// YENİ FIRESTORE LISTENER AÇMAZ (hooks/useYearlyGoal.js ile aynı sözleşme).
//
// SONUÇLANDIRMA: veri hazır olunca etkin görevler bugüne göre tamamlanır / süresi dolar ve kayda yazılır. Kanca
// birden çok yerde (Eğlence kartı, ekran, profil satırı) açık olabilir; yazım SON KAYITTAN okur (depo senkron), bu
// yüzden ikinci kopya aynı görevi bir daha tamamlamaz ve kutlama tek kez çıkar.

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useApiSettings } from "../context/AppSettingsContext";
import { useLanguage } from "../context/LanguageContext";
import { useListStatusContext } from "../context/ListStatusContext";
import { useProfileStats } from "../context/ProfileStatsContext";
import { toast } from "../components/AppToast";
import { haptic } from "../services/hapticsService";
import { navigateRoot } from "../services/rootNavigation";
import { Keys, get, remove, set, useStored } from "../services/storage";
import { cachedChallengeMeta, fetchChallengeMeta } from "../services/watchChallengeMeta";
import { getWatchChallengesCopy } from "../utils/watchChallengesCopy";
import {
  activeRuns,
  catalogGroups,
  challengeProgress,
  completedRuns,
  dayKeyOf,
  daysLeftOf,
  finishedRuns,
  getChallenge,
  joinBlocker,
  joinChallenge,
  leaveChallenge,
  needsMeta,
  normalizeChallengeState,
  paceOf,
  settleChallenges,
  toStoredChallengeState,
} from "../utils/watchChallenges";

/** Okuma-değiştir-yaz tek turda. @returns {object} yazılan durum */
function write(uid, update) {
  const options = { uid };
  const current = normalizeChallengeState(get(Keys.watchChallenges, options));
  const next = update(current);
  if (next === current) return current;
  const stored = toStoredChallengeState(next);
  if (stored === null) remove(Keys.watchChallenges, options);
  else set(Keys.watchChallenges, stored, options);
  return next;
}

/** Bugünün yerel günü; uygulama ön plana dönünce tazelenir (gece yarısını aşan oturum). */
function useToday() {
  const [today, setToday] = useState(() => dayKeyOf(new Date()));
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setToday(dayKeyOf(new Date()));
    });
    return () => sub?.remove?.();
  }, []);
  return today;
}

export default function useWatchChallenges() {
  const { user } = useAuth() || {};
  const uid = user?.uid || null;
  const today = useToday();
  const { language } = useLanguage();
  const { API_KEY } = useApiSettings();
  const { movieHistoryItems, flatEpisodesTv } = useProfileStats() || {};
  const { loading: listsLoading, watchedTvLoaded } = useListStatusContext() || {};
  const loading = !!listsLoading || !watchedTvLoaded;

  const raw = useStored(Keys.watchChallenges, { uid });
  const state = useMemo(() => normalizeChallengeState(raw), [raw]);
  const active = useMemo(() => activeRuns(state), [state]);

  // ── Film ayrıntısı (yalnız on yıl / ülke görevlerinde, yalnız penceredeki filmler) ──
  const [meta, setMeta] = useState({});
  const data = useMemo(
    () => ({ movies: movieHistoryItems || [], episodes: flatEpisodesTv || [], meta }),
    [movieHistoryItems, flatEpisodesTv, meta],
  );

  const progressOf = useCallback((challenge, joinedAt) => challengeProgress(challenge, joinedAt, data), [data]);

  const missingMeta = useMemo(() => {
    const ids = new Set();
    for (const run of active) {
      const challenge = getChallenge(run.id);
      if (!needsMeta(challenge)) continue;
      for (const id of progressOf(challenge, run.joinedAt).pending) ids.add(String(id));
    }
    return [...ids].sort();
  }, [active, progressOf]);
  const missingKey = missingMeta.join(",");

  useEffect(() => {
    if (!missingMeta.length) return undefined;
    const cached = cachedChallengeMeta(missingMeta);
    if (Object.keys(cached).length) setMeta((prev) => ({ ...prev, ...cached }));
    const rest = missingMeta.filter((id) => !cached[id]);
    if (!rest.length || !API_KEY) return undefined;
    let alive = true;
    fetchChallengeMeta({ ids: rest, apiKey: API_KEY, language }).then((fetched) => {
      if (alive && Object.keys(fetched).length) setMeta((prev) => ({ ...prev, ...fetched }));
    });
    return () => {
      alive = false;
    };
    // missingKey: aynı eksik küme için yeniden okuma yapılmasın.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingKey, API_KEY, language]);

  // ── Sonuçlandırma ──
  useEffect(() => {
    if (loading || !uid || !active.length) return;
    let completed = [];
    write(uid, (current) => {
      const result = settleChallenges(current, progressOf, today);
      completed = result.completed;
      return result.state;
    });
    if (!completed.length) return;
    const copy = getWatchChallengesCopy(language);
    // Rozet toast'ı (toast.badge) izleme rozetinin görünüm şemasını ister; madalya kendi ekranında çizilir.
    for (const id of completed) {
      toast.success(copy.doneToastTitle, copy.titleOf(getChallenge(id)), {
        onPress: () => navigateRoot("ChallengesScreen", { openId: id }),
      });
    }
    haptic("goal");
  }, [loading, uid, active, progressOf, today, language]);

  const activeItems = useMemo(
    () =>
      active.map((run) => {
        const challenge = getChallenge(run.id);
        const progress = progressOf(challenge, run.joinedAt);
        return {
          run,
          challenge,
          progress,
          daysLeft: daysLeftOf(challenge, run.joinedAt, today),
          pace: paceOf(challenge, run.joinedAt, progress.count, today),
        };
      }),
    [active, progressOf, today],
  );

  const join = useCallback(
    (id) => {
      if (!uid) return "unknown";
      const blocker = joinBlocker(normalizeChallengeState(get(Keys.watchChallenges, { uid })), id, today);
      if (blocker !== "ok") return blocker;
      write(uid, (current) => joinChallenge(current, id, today));
      return "ok";
    },
    [uid, today],
  );
  const leave = useCallback((id) => uid && write(uid, (current) => leaveChallenge(current, id)), [uid]);

  return {
    today,
    loading,
    state,
    active: activeItems,
    finished: useMemo(() => finishedRuns(state), [state]),
    completed: useMemo(() => completedRuns(state), [state]),
    catalog: useMemo(() => catalogGroups(state, today), [state, today]),
    /** Katılınmamış görevin önizlemesi: bugün katılsan ne sayılırdı (yönetmende tüm geçmiş). */
    previewOf: useCallback((challenge) => progressOf(challenge, today), [progressOf, today]),
    progressOf,
    blockerOf: useCallback((id) => joinBlocker(state, id, today), [state, today]),
    join,
    leave,
  };
}
