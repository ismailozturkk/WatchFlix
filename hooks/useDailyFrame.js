// hooks/useDailyFrame.js
//
// "Günün Karesi"nin veri bağı. Kurallar utils/dailyFrame.js'te (saf, testli); bulmaca services/dailyFrameService.js'ten.
//
//   useDailyFrame        → oyun ekranı: bulmacayı yükler, tahmin / geç uygular, cihaz-yerel kayda (Keys.dailyFrame) yazar.
//   useDailyFrameSummary → Eğlence kartı: yalnız kayıttan bugünün durumu + seri (ağ yok, bulmaca yüklenmez).
//
// Gün ön plana dönüşte tazelenir (gece yarısı sonrası yeni kare). Bugünün kaydı bulmacanın cevabıyla eşleşmiyorsa
// (ör. bulmaca önbelleği silinip TMDB'den farklı film geldi) kayıt yok sayılır — yanlış filme ait tahminler gösterilmez.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { Keys, get, set, useStored } from "../services/storage";
import { ANALYTICS_EVENTS, trackEvent } from "../services/analytics";
import { awardDailyXp } from "../services/leagueService";
import { loadDailyFramePuzzle } from "../services/dailyFrameService";
import { dayKeyOf } from "../utils/dailyChallenge";
import {
  applyGuess,
  emptyRound,
  normalizeFrameStore,
  openFrameCount,
  puzzleNumberOf,
  roundMarks,
  solvedAt,
  storeRound,
  visibleFrameStreak,
} from "../utils/dailyFrame";

export function useTodayKey() {
  const [key, setKey] = useState(() => dayKeyOf());
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setKey(dayKeyOf());
    });
    return () => sub?.remove?.();
  }, []);
  return key;
}

/** Eğlence kartı için: bugünün kaydı (varsa) + görünen seri. */
export function useDailyFrameSummary({ uid }) {
  const dayKey = useTodayKey();
  const raw = useStored(Keys.dailyFrame, { uid });
  return useMemo(() => {
    const store = normalizeFrameStore(raw);
    const round = store.rounds[dayKey] || null;
    return {
      dayKey,
      number: puzzleNumberOf(dayKey),
      status: round ? round.status : "new",
      guesses: round ? round.guesses.length : 0,
      marks: round && round.status !== "playing" ? roundMarks(round) : null,
      streak: visibleFrameStreak(store.stats),
    };
  }, [raw, dayKey]);
}

/**
 * @param {{ apiKey: string, language: string, uid: string|null }} p
 */
export default function useDailyFrame({ apiKey, language, uid }) {
  const dayKey = useTodayKey();
  const raw = useStored(Keys.dailyFrame, { uid });
  const store = useMemo(() => normalizeFrameStore(raw), [raw]);

  const [puzzle, setPuzzle] = useState(null);
  const [phase, setPhase] = useState("loading"); // loading | ready | error
  const [attempt, setAttempt] = useState(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    loadDailyFramePuzzle(apiKey, language, dayKey)
      .then((next) => {
        if (cancelled || !alive.current) return;
        setPuzzle(next);
        setPhase("ready");
      })
      .catch(() => {
        if (cancelled || !alive.current) return;
        setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey, language, dayKey, attempt]);

  const round = useMemo(() => {
    if (!puzzle) return null;
    const saved = store.rounds[dayKey];
    return saved && saved.answerKey === puzzle.answerKey ? saved : emptyRound(dayKey, puzzle.answerKey);
  }, [puzzle, store, dayKey]);

  const submit = useCallback(
    (guess) => {
      if (!round || !puzzle) return { changed: false, correct: false };
      const result = applyGuess(round, guess);
      if (!result.changed) return result;
      const options = { uid };
      set(Keys.dailyFrame, storeRound(get(Keys.dailyFrame, options), result.round), options);
      const number = puzzle.number;
      if (round.guesses.length === 0) trackEvent(ANALYTICS_EVENTS.DAILY_FRAME_STARTED, { number });
      if (result.round.status !== "playing") {
        awardDailyXp("frame", dayKey); // Haftalık Lig: günde bir kez (kazan ya da 6 hakkı bitir)
        trackEvent(ANALYTICS_EVENTS.DAILY_FRAME_FINISHED, {
          number,
          won: result.round.status === "won",
          guesses: result.round.guesses.length,
        });
      }
      return result;
    },
    [round, puzzle, uid, dayKey],
  );

  const guess = useCallback(
    (item) => submit({ key: item?.key, title: item?.title, year: item?.year, posterPath: item?.posterPath }),
    [submit],
  );
  const skip = useCallback(() => submit({ skip: true }), [submit]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return {
    dayKey,
    phase,
    puzzle,
    round,
    stats: store.stats,
    streak: visibleFrameStreak(store.stats),
    openCount: openFrameCount(round),
    marks: roundMarks(round),
    solvedAt: solvedAt(round),
    guess,
    skip,
    retry,
  };
}
