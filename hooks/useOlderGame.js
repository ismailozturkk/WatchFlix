// hooks/useOlderGame.js
//
// "Önce hangisi?" oyununun durum makinesi. Kurallar utils/olderGame.js'te (saf, testli); burada yalnız havuzun
// çekilmesi, can/skor akışı, gösterim süreleri ve cihaz-yerel kayıt.
//
// AŞAMALAR: "loading" → "playing" (çift ekranda, cevap bekliyor) → "revealed" (yıllar gösterildi, kısa bekleme)
// → "playing" … → "over" (üç can bitti) | "error" (havuz kurulamadı).
//
// HAVUZ: services/quickGamePool (tüm hızlı oyunlarla ortak). Hiçbir kaynak gelmezse "error" (yeniden dene).
//
// ÇİFT ÜRETİMİ ANA THREAD'İ BLOKLAMAZ: `pickPair` en kötü durumda O(n²) tarar ama yalnız hedef fark havuzda hiç
// yokken (nadir) ve havuz ≤ 400 öğe.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Keys, get, set, remove, useStored } from "../services/storage";
import { ANALYTICS_EVENTS, trackEvent } from "../services/analytics";
import { MIN_USABLE_POOL, loadQuickPool } from "../services/quickGamePool";
import {
  OLDER_LIVES,
  judgeAnswer,
  normalizeOlderStats,
  pickPair,
  pushRecent,
  recordOlderRun,
  toStoredOlderStats,
} from "../utils/olderGame";

export const REVEAL_MS = 1500;

function writeStats(uid, update) {
  const options = { uid };
  const current = normalizeOlderStats(get(Keys.olderGame, options));
  const result = update(current);
  const stored = toStoredOlderStats(result.stats);
  if (stored === null) remove(Keys.olderGame, options);
  else set(Keys.olderGame, stored, options);
  return result;
}

/**
 * @param {{ apiKey: string, language: string, uid: string|null, source?: string }} p
 */
export default function useOlderGame({ apiKey, language, uid, source = "hub" }) {
  const raw = useStored(Keys.olderGame, { uid });
  const stats = useMemo(() => normalizeOlderStats(raw), [raw]);

  const [phase, setPhase] = useState("loading");
  const [pair, setPair] = useState(null);
  const [lives, setLives] = useState(OLDER_LIVES);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [reveal, setReveal] = useState(null); // { chosenKey, correct, olderKey, years }
  const [summary, setSummary] = useState(null); // { newBest, previousBest }

  const poolRef = useRef([]);
  const recentRef = useRef(new Set());
  const runRef = useRef({ score: 0, answered: 0, lives: OLDER_LIVES });
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

  const nextPair = useCallback((streak) => {
    const next = pickPair({ pool: poolRef.current, streak, recent: recentRef.current });
    if (!next) return false;
    recentRef.current = pushRecent(recentRef.current, next);
    setPair(next);
    setReveal(null);
    setPhase("playing");
    return true;
  }, []);

  const start = useCallback(async () => {
    const run = generation.current + 1;
    generation.current = run;
    clearTimer();
    runRef.current = { score: 0, answered: 0, lives: OLDER_LIVES };
    setScore(0);
    setAnswered(0);
    setLives(OLDER_LIVES);
    setSummary(null);
    setReveal(null);
    setPair(null);
    setPhase("loading");
    try {
      if (!apiKey) throw new Error("api_unavailable");
      if (poolRef.current.length < MIN_USABLE_POOL) poolRef.current = await loadQuickPool(apiKey, language);
      if (!alive.current || run !== generation.current) return;
      if (poolRef.current.length < MIN_USABLE_POOL || !nextPair(0)) throw new Error("pool_too_small");
      trackEvent(ANALYTICS_EVENTS.OLDER_GAME_STARTED, { source });
    } catch {
      if (alive.current && run === generation.current) setPhase("error");
    }
  }, [apiKey, language, nextPair, source]);

  useEffect(() => {
    start();
    // Dil değişirse havuz yeniden kurulmalı (başlıklar dile bağlı); bellek havuzunu boşalt.
    return () => { poolRef.current = []; };
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = useCallback(() => {
    const { score: finalScore, answered: finalAnswered } = runRef.current;
    let result = { newBest: false, previousBest: 0 };
    if (uid) {
      result = writeStats(uid, (current) => recordOlderRun(current, { score: finalScore, answered: finalAnswered }));
    }
    trackEvent(ANALYTICS_EVENTS.OLDER_GAME_FINISHED, {
      score: finalScore,
      answered: finalAnswered,
      new_best: !!result.newBest,
      best: Math.max(result.previousBest || 0, finalScore),
    });
    if (!alive.current) return;
    setSummary({ newBest: !!result.newBest, previousBest: result.previousBest || 0 });
    setPhase("over");
  }, [uid]);

  const advance = useCallback(() => {
    clearTimer();
    if (!alive.current) return;
    if (runRef.current.lives <= 0) {
      finish();
      return;
    }
    if (!nextPair(runRef.current.score)) setPhase("error");
  }, [finish, nextPair]);

  const choose = useCallback(
    (chosenKey) => {
      if (phase !== "playing" || !pair) return;
      const verdict = judgeAnswer(pair, chosenKey);
      const run = runRef.current;
      run.answered += 1;
      if (verdict.correct) run.score += 1;
      else run.lives -= 1;
      setAnswered(run.answered);
      setScore(run.score);
      setLives(run.lives);
      setReveal({ chosenKey, ...verdict });
      setPhase("revealed");
      clearTimer();
      timerRef.current = setTimeout(advance, REVEAL_MS);
    },
    [advance, pair, phase],
  );

  return { phase, pair, lives, score, answered, reveal, summary, stats, choose, advance, restart: start };
}
