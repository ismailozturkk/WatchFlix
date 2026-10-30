// hooks/useFilmChain.js
//
// Film Zinciri'nin durum makinesi. Kurallar utils/filmChain.js'te (saf, testli); burada yalnız bulmacanın
// seçilmesi, sıradaki seçenek listesinin TMDB'den çekilmesi, bitişte cihaz-yerel kayıt ve ölçüm.
//
// AŞAMALAR: "playing" (zincir kuruluyor) → "solved" (hedefe ulaşıldı) | "gaveUp" (pes edildi).
// Günlük bulmaca bugün zaten bittiyse ekran doğrudan sonuçla açılır (kayıttaki zincirle); ikinci deneme sayılmaz.
//
// SEÇENEKLER: zincirin son düğümüne bağlı — oyuncuysa filmleri, filmse kadrosu. Her değişimde yeni istek; eski
// yanıt geç gelirse `generation` ile atılır (hızlı geri al / seç yarışı).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Keys, get, remove, set, useStored } from "../services/storage";
import { ANALYTICS_EVENTS, trackEvent } from "../services/analytics";
import { fetchChainCast, fetchChainFilms } from "../services/filmChainService";
import { dayKeyOf } from "../utils/dailyChallenge";
import {
  appendChainNode,
  chainFilmCount,
  chainPuzzleById,
  chainPoints,
  chainStreak,
  dailyChainPuzzle,
  dailyChainRecord,
  isChainSolved,
  nextPickKind,
  normalizeChainStats,
  randomChainPuzzle,
  recordChainResult,
  startChain,
  toStoredChainStats,
  undoChainNode,
} from "../utils/filmChain";

const RECENT_FREE = 12;

function writeStats(uid, update) {
  const options = { uid };
  const result = update(normalizeChainStats(get(Keys.filmChain, options)));
  const stored = toStoredChainStats(result.stats);
  if (stored === null) remove(Keys.filmChain, options);
  else set(Keys.filmChain, stored, options);
  return result;
}

/**
 * Bulmaca + başlangıç durumu (günlükte bugünün kaydı varsa sonuçtan). Serbestte `puzzleId` (sohbetteki meydan
 * okumadan) verilirse o bulmaca; listede yoksa rastgele.
 */
function initialState(mode, stats, recent, dayKey, puzzleId = null) {
  if (mode === "daily") {
    const puzzle = dailyChainPuzzle(dayKey);
    const record = dailyChainRecord(stats, dayKey);
    if (puzzle && record && record.puzzleId === puzzle.id) {
      return {
        puzzle,
        chain: record.path.length ? record.path : startChain(puzzle),
        phase: record.gaveUp ? "gaveUp" : "solved",
        restored: true,
      };
    }
    return { puzzle, chain: startChain(puzzle), phase: "playing", restored: false };
  }
  const daily = dailyChainPuzzle(dayKey);
  const puzzle =
    chainPuzzleById(puzzleId) || randomChainPuzzle({ exclude: [daily?.id, ...recent].filter(Boolean) });
  return { puzzle, chain: startChain(puzzle), phase: "playing", restored: false };
}

/**
 * @param {{ apiKey: string, language: string, uid: string|null, mode?: "daily"|"free", puzzleId?: string|null }} p
 */
export default function useFilmChain({ apiKey, language, uid, mode = "daily", puzzleId = null }) {
  const raw = useStored(Keys.filmChain, { uid });
  const stats = useMemo(() => normalizeChainStats(raw), [raw]);
  const [dayKey] = useState(() => dayKeyOf());
  const recentRef = useRef([]);

  const [state, setState] = useState(() =>
    initialState(mode, normalizeChainStats(get(Keys.filmChain, { uid })), [], dayKey, mode === "free" ? puzzleId : null),
  );
  const [options, setOptions] = useState({ status: "loading", items: [] });
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState(null); // { points, streak, counted }
  const generation = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const { puzzle, chain, phase } = state;
  const last = chain[chain.length - 1] || null;
  const pickKind = phase === "playing" ? nextPickKind(chain, puzzle) : null;

  // Mod değişince yeni bulmaca.
  const firstMode = useRef(mode);
  useEffect(() => {
    if (firstMode.current === mode) return;
    firstMode.current = mode;
    setResult(null);
    setState(initialState(mode, normalizeChainStats(get(Keys.filmChain, { uid })), recentRef.current, dayKey));
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Açılış ölçümü: bulmaca başına bir kez (sonuçla açılan günlük sayılmaz).
  const trackedRef = useRef(null);
  useEffect(() => {
    if (!puzzle || state.restored || trackedRef.current === puzzle.id) return;
    trackedRef.current = puzzle.id;
    trackEvent(ANALYTICS_EVENTS.FILM_CHAIN_STARTED, { mode, number: puzzle.number || 0, par: puzzle.par });
  }, [mode, puzzle, state.restored]);

  // Sıradaki seçenek listesi.
  useEffect(() => {
    if (!pickKind || !last) return undefined;
    const run = generation.current + 1;
    generation.current = run;
    setOptions({ status: "loading", items: [] });
    const request =
      pickKind === "film"
        ? fetchChainFilms({ apiKey, language, personId: last.id })
        : fetchChainCast({ apiKey, language, movieId: last.id });
    Promise.resolve(request)
      .then((items) => {
        if (alive.current && run === generation.current) setOptions({ status: "ready", items: items || [] });
      })
      .catch(() => {
        if (alive.current && run === generation.current) setOptions({ status: "error", items: [] });
      });
    return undefined;
  }, [apiKey, language, pickKind, last?.kind, last?.id, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = useCallback(
    (finalChain, gaveUp) => {
      let outcome = { counted: false, streak: chainStreak(stats, dayKey) };
      if (uid) {
        outcome = writeStats(uid, (current) =>
          recordChainResult(current, { mode, dayKey, puzzle, chain: finalChain, gaveUp }),
        );
      }
      const links = gaveUp ? 0 : chainFilmCount(finalChain);
      const points = chainPoints(links, puzzle.par, gaveUp);
      if (mode === "free") recentRef.current = [puzzle.id, ...recentRef.current].slice(0, RECENT_FREE);
      trackEvent(ANALYTICS_EVENTS.FILM_CHAIN_FINISHED, {
        mode,
        number: puzzle.number || 0,
        par: puzzle.par,
        links,
        gave_up: !!gaveUp,
        points,
      });
      setResult({ points, streak: outcome.streak, counted: outcome.counted });
    },
    [dayKey, mode, puzzle, stats, uid],
  );

  const pick = useCallback(
    (item) => {
      if (!pickKind || !item) return;
      const next = appendChainNode(chain, { ...item, kind: pickKind }, puzzle);
      if (next === chain) return;
      const solved = isChainSolved(next, puzzle);
      setState((current) => ({ ...current, chain: next, phase: solved ? "solved" : "playing" }));
      if (solved) finish(next, false);
    },
    [chain, finish, pickKind, puzzle],
  );

  const undo = useCallback(() => {
    if (phase !== "playing") return;
    setState((current) => ({ ...current, chain: undoChainNode(current.chain) }));
  }, [phase]);

  const giveUp = useCallback(() => {
    if (phase !== "playing") return;
    setState((current) => ({ ...current, phase: "gaveUp" }));
    finish(chain, true);
  }, [chain, finish, phase]);

  const newPuzzle = useCallback(() => {
    if (mode !== "free") return;
    setResult(null);
    setState(initialState("free", stats, recentRef.current, dayKey));
  }, [dayKey, mode, stats]);

  const retry = useCallback(() => setReload((n) => n + 1), []);

  const daily = dailyChainRecord(stats, dayKey);
  const points =
    result?.points ??
    (state.restored && daily ? daily.points : chainPoints(chainFilmCount(chain), puzzle?.par || 0, phase === "gaveUp"));

  return {
    puzzle,
    chain,
    phase,
    pickKind,
    options,
    stats,
    points,
    streak: result?.streak ?? chainStreak(stats, dayKey),
    links: chainFilmCount(chain),
    pick,
    undo,
    giveUp,
    newPuzzle,
    retry,
  };
}
