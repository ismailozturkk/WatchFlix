// hooks/useYearlyGoal.js
//
// Profildeki yıllık izleme hedefi: depodaki hedef + ProfileStatsContext'in zaten açık olan
// izleme verisinden türeyen sayım. Karar mantığı utils/yearlyGoal.js'te (saf, testli); burada
// yalnız depoya ve veriye bağlama.
//
// YENİ FIRESTORE LISTENER AÇMAZ (hooks/useWatchProgress.js ile aynı sözleşme): sayım
// `useProfileStats`ın verdiği listelerden türer. Hedefin kendisi yalnız bu cihazda,
// kullanıcı kapsamlı depoda tutulur (registry: yearlyGoals).
//
// YAZMA SON KAYITTAN OKUR (kapanıştaki state'ten değil): arka arkaya iki hızlı
// dokunuş, ilk yazımın sonucunu ezmesin. Depo senkron olduğu için okuma-değiştir-yaz
// tek turda biter (hooks/useSectionVisibility.js ile aynı kural).
//
// "BUGÜN" yalnız açılışta okunur: gece yarısını aşan oturumda yıl değişirse kart bir
// sonraki ön plana dönüşte (AppState) tazelenir.

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useListStatusContext } from "../context/ListStatusContext";
import { useProfileStats } from "../context/ProfileStatsContext";
import { Keys, get, set, remove, useStored } from "../services/storage";
import {
  buildTrackProgress,
  clearYearlyGoal,
  combineProgress,
  computeYearClock,
  countYearTitles,
  getYearlyGoal,
  normalizeYearlyGoals,
  setYearlyGoal,
  suggestDraft,
  toStoredYearlyGoals,
} from "../utils/yearlyGoal";

/** Depoya yazar; hiç hedef kalmadıysa anahtarı SİLER. @returns {boolean} yazım başarılı mı */
function write(uid, update) {
  const options = { uid };
  const current = normalizeYearlyGoals(get(Keys.yearlyGoals, options));
  const stored = toStoredYearlyGoals(update(current));
  return stored === null ? remove(Keys.yearlyGoals, options) : set(Keys.yearlyGoals, stored, options);
}

/** Cihaz saatine bağlı "şimdi"; uygulama ön plana dönünce tazelenir. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(new Date());
    });
    return () => sub?.remove?.();
  }, []);
  return now;
}

/**
 * @returns {{
 *   year: number, now: Date,
 *   clock: ReturnType<typeof computeYearClock>,
 *   goal: {movies: {target: number}|null, shows: {target: number, measure: string}|null} | null,
 *   counts: {movies: number, shows: number, episodes: number},
 *   tracks: ReturnType<typeof buildTrackProgress>,
 *   overall: ReturnType<typeof combineProgress>,
 *   suggestion: ReturnType<typeof suggestDraft>,
 *   loading: boolean,
 *   saveGoal: (goal: {movies?: object|null, shows?: object|null}) => boolean,
 *   removeGoal: () => boolean,
 * }}
 */
export default function useYearlyGoal() {
  const { user } = useAuth() || {};
  const uid = user?.uid || null;
  const now = useNow();
  const year = now.getFullYear();

  const { movieHistoryItems, flatEpisodesTv } = useProfileStats() || {};
  // Listeler gelmeden sayı 0 görünür (açılışta ~birkaç sn). Hazır sinyali useKesifSignals ile
  // aynı: kök belge indi (`loading` false) VE diziler alt koleksiyondan geldi.
  const { loading: listsLoading, watchedTvLoaded } = useListStatusContext() || {};

  // `uid` null iken (çıkış anı) kullanıcı kapsamlı okuma `guest` kovasına düşer; boş döner.
  const raw = useStored(Keys.yearlyGoals, { uid });
  const goals = useMemo(() => normalizeYearlyGoals(raw), [raw]);
  const goal = useMemo(() => getYearlyGoal(goals, year), [goals, year]);

  const counts = useMemo(
    () => countYearTitles({ movieEntries: movieHistoryItems || [], episodes: flatEpisodesTv || [], year }),
    [movieHistoryItems, flatEpisodesTv, year],
  );
  const previousCounts = useMemo(
    () =>
      countYearTitles({ movieEntries: movieHistoryItems || [], episodes: flatEpisodesTv || [], year: year - 1 }),
    [movieHistoryItems, flatEpisodesTv, year],
  );

  const clock = useMemo(() => computeYearClock({ year, now }), [year, now]);
  const tracks = useMemo(() => buildTrackProgress({ goal, counts, year, now }), [goal, counts, year, now]);
  const overall = useMemo(() => combineProgress(tracks), [tracks]);
  const suggestion = useMemo(
    () => suggestDraft({ goals, year, previous: previousCounts }),
    [goals, year, previousCounts],
  );

  const saveGoal = useCallback(
    (next) => {
      if (!next || (!next.movies && !next.shows)) return false;
      return write(uid, (current) => setYearlyGoal(current, year, next));
    },
    [uid, year],
  );
  const removeGoal = useCallback(
    () => write(uid, (current) => clearYearlyGoal(current, year)),
    [uid, year],
  );

  return {
    year,
    now,
    clock,
    goal,
    counts,
    tracks,
    overall,
    suggestion,
    // İzleme listeleri henüz gelmediyse sayı 0 görünür; düğme bu pencerede "%0" demesin.
    loading: !!listsLoading || !watchedTvLoaded,
    saveGoal,
    removeGoal,
  };
}
