// hooks/useQuickGame.js
//
// Hızlı oyunların (popular | decade | kind | genre | blur) ortak durum makinesi. Kurallar utils/quickGames.js'te
// (saf, testli); burada yalnız havuzun çekilmesi, can/skor akışı, gösterim süreleri ve cihaz-yerel kayıt.
// "Önce hangisi?" (hooks/useOlderGame.js) aynı iskeletin ilk örneğidir ve kendi anahtarında kalır.
//
// AŞAMALAR: "loading" → "playing" (soru ekranda) → "revealed" (doğru cevap gösterildi, kısa bekleme)
// → "playing" … → "over" (üç can bitti) | "error" (havuz kurulamadı / soru üretilemedi).
//
// ZAMANLI OYUN (Bulanık Afiş, QUICK_GAME_META.timed): soru gelince saat HENÜZ işlemez; ekran afiş yüklenince
// `arm()` çağırır (yüklenmezse BLUR_ARM_FALLBACK_MS sonra kendiliğinden). Saat tek kaynaktır: puan cevap anındaki
// `Date.now() − roundStartedAt`ten hesaplanır, ekrandaki bulanıklık/çubuk yalnız görseldir. Süre dolunca soru
// yanlış sayılır (can gider). Skor = puan toplamı; doğru sayısı ayrıca kaydedilir (recordOlderRun `correct`).
// Soru AĞDAN gelir: doğru cevabın YAZISIZ afişi aranır (services/quickGamePool buildTextlessBlurQuestion). Bekleme
// hissedilmesin diye sıradaki soru cevap anında, 1,5 sn'lik gösterim sırasında hazırlanır ve afişi önceden indirilir.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image } from "expo-image";
import { Keys, get, set, remove, useStored } from "../services/storage";
import { ANALYTICS_EVENTS, trackEvent } from "../services/analytics";
import { MIN_USABLE_POOL, buildTextlessBlurQuestion, loadQuickPool } from "../services/quickGamePool";
import { saveQuickBoardEntry } from "../services/gameLeaderboards";
import { buildTmdbUrl } from "../utils/tmdbImageUtils";
import {
  BLUR_ROUND_MS,
  QUICK_LIVES,
  blurPoints,
  buildQuickQuestion,
  isTimedQuickGame,
  isQuickGame,
  judgeQuickAnswer,
  pushQuickRecent,
  recordQuickRun,
  statsOfQuickGame,
  toStoredQuickStats,
} from "../utils/quickGames";

export const QUICK_REVEAL_MS = 1500;
/** Afiş bu sürede yüklenmezse saat yine başlar (yavaş ağda soru sonsuza dek beklemesin). */
export const BLUR_ARM_FALLBACK_MS = 4000;
/** Süre dolduğunda `chosenKey` (hiçbir şık bu anahtarı taşımaz). */
export const QUICK_TIMEOUT_KEY = "__timeout__";

/** Afiş (BlurPoster ile aynı boy) indirilip önbelleğe alınır; yükleme anında beklenmez. Başarısızlık sessiz. */
function prefetchPoster(question) {
  const uri = buildTmdbUrl(question?.items?.[0]?.posterPath, "poster", 342);
  if (!uri || typeof Image?.prefetch !== "function") return;
  Promise.resolve(Image.prefetch(uri)).catch(() => {});
}

function writeStats(uid, gameId, run) {
  const options = { uid };
  const result = recordQuickRun(get(Keys.quickGames, options), gameId, run);
  const stored = toStoredQuickStats(result.all);
  if (stored === null) remove(Keys.quickGames, options);
  else set(Keys.quickGames, stored, options);
  return result;
}

/**
 * `identity`: liderlik tablosuna yazılacak ad/avatar (hooks/useGameIdentity). Oyun sonunda oyunun REKORU
 * GameLeaderboards/quick_<oyun> tablosuna yazılır (services/gameLeaderboards; tablodakinden büyükse).
 * @param {{ gameId: string, apiKey: string, language: string, uid: string|null, source?: string, identity?: object|null }} p
 */
export default function useQuickGame({ gameId, apiKey, language, uid, source = "hub", identity = null }) {
  const raw = useStored(Keys.quickGames, { uid });
  const stats = useMemo(() => statsOfQuickGame(raw, gameId), [raw, gameId]);

  const [phase, setPhase] = useState("loading");
  const [question, setQuestion] = useState(null);
  const [lives, setLives] = useState(QUICK_LIVES);
  const [score, setScore] = useState(0);
  const [reveal, setReveal] = useState(null); // { chosenKey, correct, correctKey }
  const [summary, setSummary] = useState(null); // { newBest, previousBest }
  const [roundStartedAt, setRoundStartedAt] = useState(null); // zamanlı oyunda saat başladıysa ms
  const timed = isTimedQuickGame(gameId);

  const poolRef = useRef([]);
  const recentRef = useRef(new Set());
  const runRef = useRef({ score: 0, correct: 0, answered: 0, lives: QUICK_LIVES });
  const timerRef = useRef(null);
  const roundRef = useRef({ startedAt: null, timer: null }); // zamanlı oyunun saati
  const chooseRef = useRef(null);
  const pendingRef = useRef(null); // zamanlı: hazırlanan sıradaki soru { run, promise }
  const rejectedRef = useRef(new Set()); // zamanlı: yazısız afişi olmayan yapımlar
  const advancingRef = useRef(false); // zamanlı: sıradaki soru bekleniyor (çift ilerleme yok)
  const alive = useRef(true);
  const generation = useRef(0);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };
  const clearRound = () => {
    if (roundRef.current.timer) clearTimeout(roundRef.current.timer);
    roundRef.current = { startedAt: null, timer: null };
  };
  useEffect(() => {
    alive.current = true; // StrictMode'un sahte sökümünden sonra yeniden canlı
    return () => { alive.current = false; clearTimer(); clearRound(); };
  }, []);

  /** Zamanlı oyunda saati başlatır (afiş yüklendi). İkinci çağrı / zamansız oyun etkisiz. */
  const arm = useCallback(() => {
    if (!timed || !alive.current || roundRef.current.startedAt !== null) return;
    if (roundRef.current.timer) clearTimeout(roundRef.current.timer);
    const startedAt = Date.now();
    roundRef.current = {
      startedAt,
      timer: setTimeout(() => chooseRef.current?.(QUICK_TIMEOUT_KEY), BLUR_ROUND_MS),
    };
    setRoundStartedAt(startedAt);
  }, [timed]);

  /** Zamanlı oyunun sıradaki sorusunu (yazısız afişli) hazırlamaya başlar; sonuç pendingRef'te. */
  const prepareTimed = useCallback(
    (streak) => {
      const promise = buildTextlessBlurQuestion(apiKey, poolRef.current, {
        streak,
        recent: recentRef.current,
        rejected: rejectedRef.current,
      })
        .catch(() => null)
        .then((next) => {
          if (next) prefetchPoster(next);
          return next;
        });
      pendingRef.current = { run: generation.current, promise };
      return promise;
    },
    [apiKey],
  );

  const showQuestion = useCallback(
    (next) => {
      recentRef.current = pushQuickRecent(recentRef.current, next);
      clearRound();
      setRoundStartedAt(null);
      if (timed) {
        // Yedek: afiş yüklenmese de saat başlar (arm ikinci kez çağrılırsa etkisiz).
        roundRef.current.timer = setTimeout(() => arm(), BLUR_ARM_FALLBACK_MS);
      }
      setQuestion(next);
      setReveal(null);
      setPhase("playing");
      return true;
    },
    [arm, timed],
  );

  /**
   * Sıradaki soru. Zamansız oyunda EŞZAMANLI (true/false); zamanlıda Promise<boolean> — hazırlanmışsa onu bekler.
   * Bayat (yeniden başlatılmış koşu) sonuç gösterilmez.
   */
  const nextQuestion = useCallback(
    (streak) => {
      if (!timed) {
        const next = buildQuickQuestion(gameId, { pool: poolRef.current, streak, recent: recentRef.current });
        return next ? showQuestion(next) : false;
      }
      const run = generation.current;
      const pending = pendingRef.current?.run === run ? pendingRef.current.promise : prepareTimed(streak);
      pendingRef.current = null;
      advancingRef.current = true;
      return pending.then((next) => {
        if (!alive.current || run !== generation.current) return true;
        advancingRef.current = false;
        return next ? showQuestion(next) : false;
      });
    },
    [gameId, prepareTimed, showQuestion, timed],
  );

  const start = useCallback(async () => {
    const run = generation.current + 1;
    generation.current = run;
    clearTimer();
    clearRound();
    setRoundStartedAt(null);
    pendingRef.current = null;
    advancingRef.current = false;
    rejectedRef.current = new Set(); // ağ hatasıyla elenenler "tekrar dene"de yeniden denensin
    runRef.current = { score: 0, correct: 0, answered: 0, lives: QUICK_LIVES };
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
      if (poolRef.current.length < MIN_USABLE_POOL) throw new Error("pool_too_small");
      if (!(await nextQuestion(0))) throw new Error("no_question");
      if (!alive.current || run !== generation.current) return;
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
    const { score: finalScore, correct, answered } = runRef.current;
    let result = { newBest: false, previousBest: 0 };
    if (uid) {
      result = writeStats(uid, gameId, { score: finalScore, correct, answered });
      saveQuickBoardEntry(uid, gameId, result.stats, identity);
    }
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
  }, [gameId, identity, uid]);

  const advance = useCallback(() => {
    clearTimer();
    if (!alive.current) return;
    if (runRef.current.lives <= 0) {
      finish();
      return;
    }
    if (timed && advancingRef.current) return; // sıradaki soru zaten bekleniyor (şerit + zamanlayıcı)
    // Zorluk doğru SAYISIYLA yükselir (zamanlı oyunda skor puandır).
    const result = nextQuestion(runRef.current.correct);
    if (result === false) setPhase("error");
    else if (result !== true) {
      const run = generation.current;
      result.then((ok) => {
        if (!ok && alive.current && run === generation.current) setPhase("error");
      });
    }
  }, [finish, nextQuestion, timed]);

  const choose = useCallback(
    (chosenKey) => {
      if (phase !== "playing" || !question) return;
      // Zamanlı oyunda saat başlamadan (afiş yüklenmeden) cevap yok.
      if (timed && roundRef.current.startedAt === null) return;
      const timedOut = chosenKey === QUICK_TIMEOUT_KEY;
      const verdict = judgeQuickAnswer(question, chosenKey);
      const elapsed = timed ? Date.now() - roundRef.current.startedAt : 0;
      const points = timed && verdict.correct ? blurPoints(elapsed) : verdict.correct ? 1 : 0;
      // Saat dolma anında basılan doğru (puan 0) da süre dolmuş sayılır.
      const correct = verdict.correct && points > 0;
      clearRound();
      const run = runRef.current;
      run.answered += 1;
      if (correct) {
        run.score += points;
        run.correct += 1;
      } else run.lives -= 1;
      setScore(run.score);
      setLives(run.lives);
      setReveal({ chosenKey, ...verdict, correct, points: correct ? points : 0, timedOut: timedOut || (verdict.correct && !correct) });
      setPhase("revealed");
      // Gösterim süresince sıradaki yazısız afişli soruyu ara (oyun bitmediyse).
      if (timed && run.lives > 0) prepareTimed(run.correct);
      clearTimer();
      timerRef.current = setTimeout(advance, QUICK_REVEAL_MS);
    },
    [advance, phase, prepareTimed, question, timed],
  );
  chooseRef.current = choose;

  return { phase, question, lives, score, reveal, summary, stats, choose, advance, restart: start, arm, roundStartedAt };
}
