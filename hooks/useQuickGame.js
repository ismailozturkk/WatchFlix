// hooks/useQuickGame.js
//
// Hızlı oyunların (popular | decade | kind | genre) ortak durum makinesi. Kurallar utils/quickGames.js'te
// (saf, testli); burada yalnız havuzun çekilmesi, can/skor akışı, gösterim süreleri ve cihaz-yerel kayıt.
// "Önce hangisi?" (hooks/useOlderGame.js) aynı iskeletin ilk örneğidir ve kendi anahtarında kalır.
//
// AŞAMALAR: "loading" → "playing" (soru ekranda) → "revealed" (doğru cevap gösterildi, kısa bekleme)
// → "playing" … → "over" (üç can bitti) | "error" (havuz kurulamadı / soru üretilemedi).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Keys, get, set, remove, useStored } from "../services/storage";
import { ANALYTICS_EVENTS, trackEvent } from "../services/analytics";
import { MIN_USABLE_POOL, loadQuickPool } from "../services/quickGamePool";
import {
  QUICK_LIVES,
  buildQuickQuestion,
  isQuickGame,
  judgeQuickAnswer,
  pushQuickRecent,
  recordQuickRun,
  statsOfQuickGame,
  toStoredQuickStats,
} from "../utils/quickGames";

export const QUICK_REVEAL_MS = 1500;

function writeStats(uid, gameId, run) {
  const options = { uid };
  const result = recordQuickRun(get(Keys.quickGames, options), gameId, run);
  const stored = toStoredQuickStats(result.all);
  if (stored === null) remove(Keys.quickGames, options);
  else set(Keys.quickGames, stored, options);
  return result;
}

/**
 * @param {{ gameId: string, apiKey: string, language: string, uid: string|null, source?: string }} p
 */
export default function useQuickGame({ gameId, apiKey, language, uid, source = "hub" }) {
  const raw = useStored(Keys.quickGames, { uid });
  const stats = useMemo(() => statsOfQuickGame(raw, gameId), [raw, gameId]);

  const [phase, setPhase] = useState("loading");
  const [question, setQuestion] = useState(null);
  const [lives, setLives] = useState(QUICK_LIVES);
  const [score, setScore] = useState(0);
  const [reveal, setReveal] = useState(null); // { chosenKey, correct, correctKey }
  const [summary, setSummary] = useState(null); // { newBest, previousBest }

  const poolRef = useRef([]);
  const recentRef = useRef(new Set());
  const runRef = useRef({ score: 0, answered: 0, lives: QUICK_LIVES });
  const timerRef = useRef(null);
  const alive = useRef(true);
  const generation = useRef(0);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };
  useEffect(() => {
    alive.current = true; // StrictMode'un sahte sökümünden sonra yeniden canlı
    return () => { alive.current = false; clearTimer(); };
  }, []);

  const nextQuestion = useCallback(
    (streak) => {
      const next = buildQuickQuestion(gameId, { pool: poolRef.current, streak, recent: recentRef.current });
      if (!next) return false;
      recentRef.current = pushQuickRecent(recentRef.current, next);
      setQuestion(next);
      setReveal(null);
      setPhase("playing");
      return true;
    },
    [gameId],
  );

  const start = useCallback(async () => {
    const run = generation.current + 1;
    generation.current = run;
    clearTimer();
    runRef.current = { score: 0, answered: 0, lives: QUICK_LIVES };
    setScore(0);
    setLives(QUICK_LIVES);
    setSummary(null);
    setReveal(null);
    setQuestion(null);
    setPhase("loading");
    try {
      if (!isQuickGame(gameId)) throw new Error("unknown_game");
      if (!apiKey) throw new Error("api_unavailable");
      if (poolRef.current.length < MIN_USABLE_POOL) poolRef.current = await loadQuickPool(apiKey, language);
      if (!alive.current || run !== generation.current) return;
      if (poolRef.current.length < MIN_USABLE_POOL || !nextQuestion(0)) throw new Error("pool_too_small");
      trackEvent(ANALYTICS_EVENTS.QUICK_GAME_STARTED, { game_id: gameId, source });
    } catch {
      if (alive.current && run === generation.current) setPhase("error");
    }
  }, [apiKey, gameId, language, nextQuestion, source]);

  useEffect(() => {
    start();
    // Dil değişirse havuz yeniden kurulmalı (başlıklar dile bağlı); bellek havuzunu boşalt.
    return () => { poolRef.current = []; };
  }, [language, gameId]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = useCallback(() => {
    const { score: finalScore, answered } = runRef.current;
    let result = { newBest: false, previousBest: 0 };
    if (uid) result = writeStats(uid, gameId, { score: finalScore, answered });
    trackEvent(ANALYTICS_EVENTS.QUICK_GAME_FINISHED, {
      game_id: gameId,
      score: finalScore,
      answered,
      new_best: !!result.newBest,
      best: Math.max(result.previousBest || 0, finalScore),
    });
    if (!alive.current) return;
    setSummary({ newBest: !!result.newBest, previousBest: result.previousBest || 0 });
    setPhase("over");
  }, [gameId, uid]);

  const advance = useCallback(() => {
    clearTimer();
    if (!alive.current) return;
    if (runRef.current.lives <= 0) {
      finish();
      return;
    }
    if (!nextQuestion(runRef.current.score)) setPhase("error");
  }, [finish, nextQuestion]);

  const choose = useCallback(
    (chosenKey) => {
      if (phase !== "playing" || !question) return;
      const verdict = judgeQuickAnswer(question, chosenKey);
      const run = runRef.current;
      run.answered += 1;
      if (verdict.correct) run.score += 1;
      else run.lives -= 1;
      setScore(run.score);
      setLives(run.lives);
      setReveal({ chosenKey, ...verdict });
      setPhase("revealed");
      clearTimer();
      timerRef.current = setTimeout(advance, QUICK_REVEAL_MS);
    },
    [advance, phase, question],
  );

  return { phase, question, lives, score, reveal, summary, stats, choose, advance, restart: start };
}
