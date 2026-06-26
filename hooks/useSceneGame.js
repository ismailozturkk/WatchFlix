import { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions } from "react-native";
import { Image } from "expo-image";
import { buildTmdbUrl } from "@utils/tmdbImageUtils";
import {
  buildWatchlistPool,
  fetchTitlePool,
  generateQuestion,
  loadQuestionHistory,
  saveGameScore,
  saveQuestionHistory,
} from "@services/sceneGameService";
import {
  getDifficultyConfig,
  getModeConfig,
  MODE_SURVIVAL,
} from "@screens/game/gameConfig";
import { computeQuestionScore, computeSessionXp } from "@utils/gameScoring";

const PERSONAL_SOURCES = new Set([
  "watchlist",
  "favorites",
  "watchedMovies",
  "watchedTv",
]);

const questionKey = (question) =>
  question?.correctItem
    ? `${question.correctItem.type}_${question.correctItem.id}`
    : null;

const createSessionId = (uid) =>
  `${uid || "guest"}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const getListForSource = (allLists, selectedSource) => {
  if (selectedSource === "watchlist") return allLists?.watchList || [];
  if (selectedSource === "favorites") return allLists?.favorites || [];
  if (selectedSource === "watchedMovies") return allLists?.watchedMovies || [];
  if (selectedSource === "watchedTv") return allLists?.watchedTv || [];
  return [];
};

export default function useSceneGame({
  apiKey,
  language,
  userUid,
  allLists,
  currentUser,
  modeId = "classic",
  difficultyId = "normal",
}) {
  const modeConfig = getModeConfig(modeId);
  const difficultyConfig = getDifficultyConfig(difficultyId);
  const isSessionTimer = modeConfig.timerType === "session";
  const questionSeconds = difficultyConfig.timeSeconds;
  const timerTotalSeconds = isSessionTimer ? modeConfig.totalSeconds : questionSeconds;
  const questionTotal = modeConfig.questionCount || null;
  const feedbackDelayMs = isSessionTimer ? 650 : 1400;

  const [phase, setPhaseState] = useState("source_select");
  const [source, setSource] = useState("popular");
  const [pool, setPool] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [error, setError] = useState(null);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [sessionId, setSessionId] = useState(null);

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [round, setRound] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [totalWrong, setTotalWrong] = useState(0);
  const [answeredHistory, setAnsweredHistory] = useState([]);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [lives, setLives] = useState(() => getModeConfig(modeId).lives || 0);
  const [outcome, setOutcome] = useState(null);
  const [xpEarned, setXpEarned] = useState(0);
  const [lastPoints, setLastPoints] = useState(0);
  // Bu oturum mod+zorluk rekorunu kirdi mi (Part 13.1). saveGameScore doner.
  const [isNewRecord, setIsNewRecord] = useState(false);

  const [timeLeft, setTimeLeft] = useState(() => timerTotalSeconds);
  const [timerRunning, setTimerRunning] = useState(false);
  const [jokers, setJokers] = useState(() => getModeConfig(modeId).initialJokers ?? 3);
  const [eliminatedOptions, setEliminatedOptions] = useState([]);

  const phaseRef = useRef(phase);
  const poolRef = useRef(pool);
  const questionRef = useRef(currentQuestion);
  const usedIdsRef = useRef(new Set());
  const nextQuestionRef = useRef(null);
  const prefetchPromiseRef = useRef(null);
  // Part 25.2: ilk soru harici, bir soru daha ileriye (toplam 2 soru onde)
  // hazirlamak icin ikinci bir kuyruk yuvasi. nextQuestionRef tuketildiginde
  // queuedQuestionRef varsa onun yerine kullanilir ve hemen arkasindan yeni
  // bir prefetch baslar; boylece "sorular arasi gorunur yukleme" siklikla
  // sifira yaklasir (mevcut tek-adim prefetch'in genisletilmis hali).
  const queuedQuestionRef = useRef(null);
  const queuePrefetchPromiseRef = useRef(null);
  const generationRef = useRef(0);
  const roundRef = useRef(0);
  const streakRef = useRef(0);
  const timeLeftRef = useRef(timerTotalSeconds);
  const timerDeadlineRef = useRef(null);
  // Soru gorseli hazir olup sayac basladigi an; cevap suresi (responseMs) icin.
  const questionStartedAtRef = useRef(0);
  const sessionIdRef = useRef(null);
  const hasSavedSessionRef = useRef(false);
  const savePromiseRef = useRef(null);
  // Part 16.3: gameSessions belgesi icin oturum baslangic zamani ve guncel
  // sessionHistory kopyasi (statsRef gibi closure-safe okuma icin).
  const sessionStartedAtRef = useRef(null);
  const sessionHistoryRef = useRef([]);

  // Mode/difficulty refs so callbacks read the latest config without re-binding.
  const modeConfigRef = useRef(modeConfig);
  const difficultyConfigRef = useRef(difficultyConfig);
  const livesRef = useRef(lives);
  const outcomeRef = useRef(null);
  const sessionRemainingRef = useRef(timerTotalSeconds);
  const sessionStartedRef = useRef(false);
  // Joker kullanimi: o sorudaki joker cezasi + oturum boyu toplam (tie-break/stat).
  const questionJokerRef = useRef({ fifty: false, image: false });
  const sessionJokerCountRef = useRef(0);
  const pausedRef = useRef(false);

  const statsRef = useRef({
    score: 0,
    bestStreak: 0,
    totalCorrect: 0,
    totalWrong: 0,
    answeredHistory: [],
  });

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    poolRef.current = pool;
  }, [pool]);

  useEffect(() => {
    questionRef.current = currentQuestion;
  }, [currentQuestion]);

  useEffect(() => {
    roundRef.current = round;
  }, [round]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    livesRef.current = lives;
  }, [lives]);

  useEffect(() => {
    modeConfigRef.current = modeConfig;
    difficultyConfigRef.current = difficultyConfig;
  }, [modeConfig, difficultyConfig]);

  useEffect(() => {
    statsRef.current = {
      score,
      bestStreak,
      totalCorrect,
      totalWrong,
      answeredHistory,
    };
  }, [score, bestStreak, totalCorrect, totalWrong, answeredHistory]);

  useEffect(() => {
    sessionHistoryRef.current = sessionHistory;
  }, [sessionHistory]);

  useEffect(
    () => () => {
      generationRef.current += 1;
      timerDeadlineRef.current = null;
    },
    [],
  );

  const setPhase = useCallback((nextPhase) => {
    if (typeof nextPhase === "function") {
      setPhaseState((previous) => {
        const resolved = nextPhase(previous);
        phaseRef.current = resolved;
        return resolved;
      });
      return;
    }

    phaseRef.current = nextPhase;
    setPhaseState(nextPhase);
  }, []);

  // Soru zamanlayicisini moda gore sifirlar:
  //   - per_question: zorluk suresine doner.
  //   - session: paused durumda kalan oturum suresini gosterir.
  const resetQuestionTimer = useCallback(() => {
    timerDeadlineRef.current = null;
    setTimerRunning(false);
    const mode = modeConfigRef.current;
    if (mode.timerType === "session") {
      const remaining = sessionStartedRef.current
        ? sessionRemainingRef.current
        : mode.totalSeconds;
      timeLeftRef.current = remaining;
      setTimeLeft(remaining);
    } else {
      const secs = difficultyConfigRef.current.timeSeconds;
      timeLeftRef.current = secs;
      setTimeLeft(secs);
    }
  }, []);

  // Gorsel hazir olunca cagrilir. Session modunda ilk soruda oturum sayacini
  // baslatir, sonraki sorularda kalan sureden devam ettirir (resume).
  const startQuestionTimer = useCallback(() => {
    if (phaseRef.current !== "playing" || timerDeadlineRef.current) return;
    // Cevap suresi olcumu icin sahnenin gorunur oldugu ani isaretle (Part 13.2).
    questionStartedAtRef.current = Date.now();
    const mode = modeConfigRef.current;
    if (mode.timerType === "session") {
      let remaining;
      if (!sessionStartedRef.current) {
        sessionStartedRef.current = true;
        remaining = mode.totalSeconds;
      } else {
        remaining = sessionRemainingRef.current;
      }
      if (remaining <= 0) {
        timeLeftRef.current = 0;
        setTimeLeft(0);
        return;
      }
      sessionRemainingRef.current = remaining;
      timeLeftRef.current = remaining;
      setTimeLeft(remaining);
      timerDeadlineRef.current = Date.now() + remaining * 1000;
      setTimerRunning(true);
    } else {
      timerDeadlineRef.current = Date.now() + timeLeftRef.current * 1000;
      setTimerRunning(true);
    }
  }, []);

  const saveStatsToFirebase = useCallback(async () => {
    if (!userUid || roundRef.current <= 0) {
      setSaveStatus("saved");
      return true;
    }
    if (hasSavedSessionRef.current) {
      setSaveStatus("saved");
      return true;
    }
    if (savePromiseRef.current) return savePromiseRef.current;

    setSaveStatus("saving");
    const savePromise = (async () => {
      const currentStats = statsRef.current;
      const isPersonalList = PERSONAL_SOURCES.has(source);

      // XP skordan bagimsizdir; kisisel liste oyunlari da ilerleme kazandirir
      // (Part 11.3). Liderlik (bestScore) ise saveGameScore icinde Klasik+Normal
      // ve kisisel olmayan kaynak ile sinirlanir.
      const xp = computeSessionXp({
        correctCount: currentStats.totalCorrect,
        bestStreak: currentStats.bestStreak,
        outcome: outcomeRef.current,
      });
      setXpEarned(xp);

      const mode = modeConfigRef.current;
      const difficulty = difficultyConfigRef.current;
      // Part 16.3 gameSessions belgesi icin: oturumdaki tum cevaplarin
      // toplam/ortalama suresi (responseMs zaten her cevapta tutuluyor —
      // Part 13.2). sessionStartedAtRef yoksa ilk soru baslangici kullanilir.
      const history = sessionHistoryRef.current || [];
      const totalAnswerTimeMs = history.reduce(
        (sum, h) => sum + (Number(h.responseMs) || 0),
        0,
      );
      const averageAnswerMs = history.length > 0
        ? Math.round(totalAnswerTimeMs / history.length)
        : 0;
      const payload = {
        sessionId: sessionIdRef.current,
        modeId,
        difficultyId,
        sourceId: source,
        isPersonal: isPersonalList,
        score: currentStats.score,
        bestScore: currentStats.score,
        bestStreak: currentStats.bestStreak,
        totalCorrect: currentStats.totalCorrect,
        totalWrong: currentStats.totalWrong,
        xpEarned: xp,
        jokerCount: sessionJokerCountRef.current,
        lastPlayedAt: new Date().toISOString(),
        // Skor guvenligi (Part 17.3): teorik tavan hesaplamasi icin mod/zorluk
        // baglamini servise iletir; kaydedilen veriyi degistirmez.
        modeQuestionCount: mode?.questionCount || null,
        difficultyMultiplier: difficulty?.scoreMultiplier || 1,
        timerType: mode?.timerType || "per_question",
        totalSeconds: mode?.totalSeconds || 0,
        // Part 16.3: gameSessions belgesi icin ek alanlar.
        startedAt: sessionStartedAtRef.current || null,
        outcome: outcomeRef.current || "completed",
        totalAnswerTimeMs,
        averageAnswerMs,
        gameVersion: 1,
      };
      if (currentUser?.displayName) payload.displayName = currentUser.displayName;
      if (currentUser?.avatarIndex !== undefined) {
        payload.avatarIndex = currentUser.avatarIndex;
      }
      const saveResult = await saveGameScore(userUid, payload);
      // Anomalili oturum reddedildiyse skor kaydedilmedi ama kullaniciya hata
      // gosterilmez (kendi hatasi degil); basarili sayilip akisi durdurmaz.
      const scoreSaved = Boolean(saveResult) && !saveResult.rejected;
      // Yinelenen kayitta rekor durumu degismez; ilk basarili kayitta guncellenir.
      if (saveResult && !saveResult.duplicate && !saveResult.rejected) {
        setIsNewRecord(Boolean(saveResult.newRecord));
      }

      let historySaved = true;
      if (currentStats.answeredHistory.length > 0) {
        historySaved = await saveQuestionHistory(
          userUid,
          currentStats.answeredHistory,
          `${source}_${language || "tr"}`,
        );
      }

      // Anomali nedeniyle reddedilen oturum tekrar denenmemeli (Part 17.3):
      // skor degismeden ayni nedenle tekrar reddedilir. "Basarili" sayilip
      // oturum kapatilir; kullaniciya hata gosterilmez.
      const wasRejected = Boolean(saveResult?.rejected);
      const succeeded = (scoreSaved || wasRejected) && historySaved;
      if (succeeded) hasSavedSessionRef.current = true;
      setSaveStatus(succeeded ? "saved" : "error");
      return succeeded;
    })()
      .catch(() => {
        setSaveStatus("error");
        return false;
      })
      .finally(() => {
        savePromiseRef.current = null;
      });

    savePromiseRef.current = savePromise;
    return savePromise;
  }, [currentUser, difficultyId, language, modeId, source, userUid]);

  const finalizeAndEnd = useCallback(
    async (outcomeValue) => {
      generationRef.current += 1;
      setTimerRunning(false);
      timerDeadlineRef.current = null;
      outcomeRef.current = outcomeValue;
      setOutcome(outcomeValue);
      await saveStatsToFirebase();
      setPhase("game_over");
    },
    [saveStatsToFirebase, setPhase],
  );

  const answerQuestion = useCallback(
    (selectedIndex) => {
      const question = questionRef.current;
      if (phaseRef.current !== "playing" || !question) return false;
      const mode = modeConfigRef.current;

      setTimerRunning(false);
      // Session modunda kalan sureyi yakala (loading suresi tuketmesin).
      if (mode.timerType === "session") {
        const remainingMs = (timerDeadlineRef.current || 0) - Date.now();
        const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
        sessionRemainingRef.current = remaining;
        timeLeftRef.current = remaining;
        setTimeLeft(remaining);
      }
      timerDeadlineRef.current = null;
      setPhase("answered");

      const isCorrect = selectedIndex === question.correctIndex;
      const itemKey = questionKey(question);
      // Cevap suresi: sahne gorunur olduktan sonra gecen sure (Part 13.2).
      const startedAt = questionStartedAtRef.current || Date.now();
      const responseMs = Math.max(0, Date.now() - startedAt);
      let earnedPoints = 0;

      if (isCorrect) {
        // Part 11.1 puan formulu: zorluk carpani + joker cezasi dahil.
        earnedPoints = computeQuestionScore({
          timeLeft: timeLeftRef.current,
          questionSeconds: difficultyConfigRef.current.timeSeconds,
          isSessionTimer: mode.timerType === "session",
          streakBefore: streakRef.current,
          difficultyMultiplier: difficultyConfigRef.current.scoreMultiplier,
          usedFifty: questionJokerRef.current.fifty,
          usedImage: questionJokerRef.current.image,
        });
        setLastPoints(earnedPoints);
        setScore((previous) => previous + earnedPoints);

        const nextStreak = streakRef.current + 1;
        streakRef.current = nextStreak;
        setStreak(nextStreak);
        setBestStreak((best) => Math.max(best, nextStreak));
        setTotalCorrect((previous) => previous + 1);

        // Hayatta Kalma: belirli serilerde can veya joker odulu (Part 8.3).
        if (
          mode.id === MODE_SURVIVAL &&
          mode.streakRewardInterval &&
          nextStreak % mode.streakRewardInterval === 0
        ) {
          if (livesRef.current < (mode.maxLives || 99)) {
            livesRef.current += 1;
            setLives(livesRef.current);
          } else {
            setJokers((previous) => previous + 1);
          }
        }
      } else {
        setLastPoints(0);
        streakRef.current = 0;
        setStreak(0);
        setTotalWrong((previous) => previous + 1);

        if (mode.id === MODE_SURVIVAL) {
          // Yanlis veya sure bitimi bir can eksiltir (Part 8.3).
          livesRef.current = Math.max(0, livesRef.current - 1);
          setLives(livesRef.current);
        } else if (mode.timerType === "session") {
          // Zamana Karsi: yanlis cevap zaman cezasi verir (Part 8.2).
          const penalty = mode.wrongPenaltySeconds || 0;
          const reduced = Math.max(0, sessionRemainingRef.current - penalty);
          sessionRemainingRef.current = reduced;
          timeLeftRef.current = reduced;
          setTimeLeft(reduced);
        }
      }

      // Oturum kaydi puanlama/seri guncellendikten sonra yazilir; sonuc ekraninin
      // cevap incelemesi icin sure ve kazanilan puan da saklanir (Part 13.2).
      setAnsweredHistory((previous) => [...previous, itemKey]);
      setSessionHistory((previous) => [
        ...previous,
        {
          item: question.correctItem,
          // Secilen sahne gorseli oturum kaydina yazilir (Part 10.4).
          imagePath: question.imagePath,
          isCorrect,
          userAnswer:
            selectedIndex >= 0 ? question.options[selectedIndex] : null,
          responseMs,
          points: earnedPoints,
        },
      ]);

      return isCorrect;
    },
    [setPhase],
  );

  // Sure tabanli tetikleyici: deadline'a gore geri sayim yapar.
  useEffect(() => {
    if (phase !== "playing" || !timerRunning) return undefined;

    const updateTimer = () => {
      const remainingMs = (timerDeadlineRef.current || 0) - Date.now();
      const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
      timeLeftRef.current = remainingSeconds;
      setTimeLeft(remainingSeconds);

      const mode = modeConfigRef.current;
      if (mode.timerType === "session") {
        sessionRemainingRef.current = remainingSeconds;
        if (remainingSeconds === 0) {
          setTimerRunning(false);
          timerDeadlineRef.current = null;
          finalizeAndEnd("completed");
        }
      } else if (remainingSeconds === 0) {
        setTimerRunning(false);
        timerDeadlineRef.current = null;
        answerQuestion(-1);
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 250);
    return () => clearInterval(timer);
  }, [phase, timerRunning, answerQuestion, finalizeAndEnd]);

  // Bir sonraki soruyu uretir, gorselini Image.prefetch ile onceden indirir ve
  // sonucu (basari/hata) loglar (Part 25.2 - "gorsel prefetch sonucunu
  // izleme": daha once .catch(() => {}) ile sessizce yutuluyordu, artik
  // __DEV__ altinda basarisizlik gorunur ve cagiran tarafa true/false
  // bilgisi dondurulur).
  const prefetchQuestionImage = useCallback((question) => {
    if (!question?.imagePath) return Promise.resolve(false);
    // Part 21.3: modul yuklenirken bir kez okunan Dimensions.get yerine
    // ihtiyac aninda (rotasyon/katlanir cihazda da guncel) okunur.
    const { width: screenW } = Dimensions.get("window");
    const imageUrl = buildTmdbUrl(question.imagePath, "backdrop", screenW, "good");
    if (!imageUrl) return Promise.resolve(false);
    return Image.prefetch(imageUrl)
      .then(() => true)
      .catch((prefetchError) => {
        if (__DEV__) {
          console.warn("Scene image prefetch failed:", prefetchError?.message);
        }
        return false;
      });
  }, []);

  // Part 25.2: ilk soru disinda bir soru daha (toplam 2 soru onde) hazirlar.
  // queuedQuestionRef bos ise ve oyun "playing" durumundaysa arka planda
  // ikinci bir generateQuestion baslatir; sonuc tuketilene kadar bekler.
  const prepareQueuedQuestion = useCallback(
    (currentPool, currentUsedIds, queuedRound, generation) => {
      if (!currentPool.length || generation !== generationRef.current) return;
      if (queuedQuestionRef.current || queuePrefetchPromiseRef.current) return;

      const promise = generateQuestion(
        currentPool,
        apiKey,
        language,
        new Set(currentUsedIds),
        queuedRound,
        difficultyConfigRef.current.optionCount,
        difficultyConfigRef.current.id,
      )
        .then((question) => {
          if (generation !== generationRef.current) return null;
          const key = questionKey(question);
          if (!question || !question.imagePath || usedIdsRef.current.has(key)) {
            queuedQuestionRef.current = null;
            return null;
          }
          queuedQuestionRef.current = question;
          prefetchQuestionImage(question);
          return question;
        })
        .catch(() => {
          if (generation === generationRef.current) queuedQuestionRef.current = null;
          return null;
        })
        .finally(() => {
          if (queuePrefetchPromiseRef.current === promise) {
            queuePrefetchPromiseRef.current = null;
          }
        });

      queuePrefetchPromiseRef.current = promise;
    },
    [apiKey, language, prefetchQuestionImage],
  );

  const prepareNextQuestion = useCallback(
    (currentPool, currentUsedIds, nextRound, generation) => {
      if (!currentPool.length || generation !== generationRef.current) {
        return Promise.resolve(null);
      }
      if (prefetchPromiseRef.current) return prefetchPromiseRef.current;

      const promise = generateQuestion(
        currentPool,
        apiKey,
        language,
        new Set(currentUsedIds),
        nextRound,
        difficultyConfigRef.current.optionCount,
        difficultyConfigRef.current.id,
      )
        .then((question) => {
          if (generation !== generationRef.current) return null;
          const key = questionKey(question);
          if (!question || !question.imagePath || usedIdsRef.current.has(key)) {
            nextQuestionRef.current = null;
            return null;
          }

          nextQuestionRef.current = question;
          prefetchQuestionImage(question).then(() => {
            if (generation !== generationRef.current) return;
            // Ilk hazirlanan soru ekrana hazir hale gelince, ikinci soruyu
            // (toplam 2 soru onde) hemen kuyruga almaya basla (Part 25.2).
            prepareQueuedQuestion(
              currentPool,
              new Set(currentUsedIds).add(questionKey(question)),
              nextRound + 1,
              generation,
            );
          });
          return question;
        })
        .catch(() => {
          if (generation === generationRef.current) nextQuestionRef.current = null;
          return null;
        })
        .finally(() => {
          if (prefetchPromiseRef.current === promise) {
            prefetchPromiseRef.current = null;
          }
        });

      prefetchPromiseRef.current = promise;
      return promise;
    },
    [apiKey, language, prefetchQuestionImage, prepareQueuedQuestion],
  );

  const reserveQuestion = useCallback((question) => {
    const key = questionKey(question);
    if (!key || usedIdsRef.current.has(key)) return false;
    usedIdsRef.current = new Set(usedIdsRef.current).add(key);
    questionRef.current = question;
    setCurrentQuestion(question);
    return true;
  }, []);

  const startGame = useCallback(
    async (selectedSource) => {
      const generation = generationRef.current + 1;
      generationRef.current = generation;
      const mode = modeConfigRef.current;
      setSource(selectedSource);
      setError(null);
      setPhase("loading");
      setScore(0);
      setStreak(0);
      streakRef.current = 0;
      setBestStreak(0);
      setRound(0);
      roundRef.current = 0;
      setTotalCorrect(0);
      setTotalWrong(0);
      setAnsweredHistory([]);
      setSessionHistory([]);
      setCurrentQuestion(null);
      questionRef.current = null;
      nextQuestionRef.current = null;
      prefetchPromiseRef.current = null;
      queuedQuestionRef.current = null;
      queuePrefetchPromiseRef.current = null;
      setJokers(mode.initialJokers ?? 3);
      setEliminatedOptions([]);
      questionJokerRef.current = { fifty: false, image: false };
      sessionJokerCountRef.current = 0;
      setXpEarned(0);
      setIsNewRecord(false);
      questionStartedAtRef.current = 0;
      setOutcome(null);
      outcomeRef.current = null;
      setLives(mode.lives || 0);
      livesRef.current = mode.lives || 0;
      sessionStartedRef.current = false;
      sessionRemainingRef.current = mode.totalSeconds || 0;
      resetQuestionTimer();
      sessionIdRef.current = createSessionId(userUid);
      setSessionId(sessionIdRef.current);
      hasSavedSessionRef.current = false;
      savePromiseRef.current = null;
      setSaveStatus("idle");
      // Part 16.3: gameSessions.startedAt icin oturum baslangici isaretlenir.
      sessionStartedAtRef.current = new Date().toISOString();

      try {
        if (!apiKey) {
          throw Object.assign(new Error("TMDB API key is unavailable"), {
            code: "api_unavailable",
          });
        }

        const optionCount = difficultyConfigRef.current.optionCount;
        const historyScope = `${selectedSource}_${language || "tr"}`;
        let historySet = new Set();
        if (userUid) {
          historySet = new Set(
            await loadQuestionHistory(userUid, historyScope),
          );
        }

        let titlePool;
        if (PERSONAL_SOURCES.has(selectedSource)) {
          titlePool = buildWatchlistPool(
            getListForSource(allLists, selectedSource),
            selectedSource,
          );
          if (titlePool.length < optionCount) {
            throw Object.assign(new Error("Personal source has too few titles"), {
              code: "insufficient_personal_source",
              availableCount: titlePool.length,
            });
          }
        } else {
          titlePool = await fetchTitlePool(apiKey, language, selectedSource);
        }

        if (generation !== generationRef.current) return;
        if (!Array.isArray(titlePool) || titlePool.length < optionCount) {
          throw Object.assign(new Error("Question pool is too small"), {
            code: "insufficient_pool",
          });
        }

        // Eski gecmis havuzun neredeyse tamamini kapladiysa yeni oturuma izin ver.
        const unseenCount = titlePool.filter(
          (item) => !historySet.has(`${item.type}_${item.id}`),
        ).length;
        if (unseenCount < optionCount) historySet = new Set();

        poolRef.current = titlePool;
        setPool(titlePool);
        usedIdsRef.current = new Set(historySet);

        const firstQuestion = await generateQuestion(
          titlePool,
          apiKey,
          language,
          new Set(usedIdsRef.current),
          1,
          optionCount,
          difficultyConfigRef.current.id,
        );
        if (generation !== generationRef.current) return;
        if (!firstQuestion || !reserveQuestion(firstQuestion)) {
          throw Object.assign(new Error("No suitable scene was found"), {
            code: "question_unavailable",
          });
        }

        roundRef.current = 1;
        setRound(1);
        resetQuestionTimer();
        setPhase("playing");
        prepareNextQuestion(
          titlePool,
          new Set(usedIdsRef.current),
          2,
          generation,
        );
      } catch (startError) {
        if (generation !== generationRef.current) return;
        setError({
          code: startError?.code || "load_failed",
          availableCount: startError?.availableCount,
        });
        setPhase("error");
      }
    },
    [
      allLists,
      apiKey,
      language,
      prepareNextQuestion,
      reserveQuestion,
      resetQuestionTimer,
      setPhase,
      userUid,
    ],
  );

  const goToNextQuestion = useCallback(async () => {
    resetQuestionTimer();
    setEliminatedOptions([]);
    questionJokerRef.current = { fifty: false, image: false };

    const generation = generationRef.current;
    let nextQuestion = nextQuestionRef.current;
    nextQuestionRef.current = null;

    // Part 25.2: ilk tercih kuyrukta (2. soru olarak) onceden hazirlanmis
    // soru varsa onu kullan; boylece nextQuestionRef bosken bile beklemeden
    // devam edilebilir. usedQueuedSlot, asagida kuyruk yenileme kararini
    // (yeni "next" mi yoksa sadece kuyruk mu doldurulmali) belirlemek icin
    // queuedQuestionRef temizlenmeden once durumu hatirlar.
    const usedQueuedSlot = !nextQuestion && Boolean(queuedQuestionRef.current);
    if (usedQueuedSlot) {
      nextQuestion = queuedQuestionRef.current;
      queuedQuestionRef.current = null;
    }

    if (!nextQuestion && prefetchPromiseRef.current) {
      setPhase("loading");
      nextQuestion = await prefetchPromiseRef.current;
      nextQuestionRef.current = null;
    }

    if (generation !== generationRef.current) return;
    if (!nextQuestion && queuePrefetchPromiseRef.current) {
      setPhase("loading");
      nextQuestion = await queuePrefetchPromiseRef.current;
      queuedQuestionRef.current = null;
    }

    if (generation !== generationRef.current) return;
    if (!nextQuestion) {
      setPhase("loading");
      nextQuestion = await generateQuestion(
        poolRef.current,
        apiKey,
        language,
        new Set(usedIdsRef.current),
        roundRef.current + 1,
        difficultyConfigRef.current.optionCount,
        difficultyConfigRef.current.id,
      ).catch(() => null);
    }

    if (generation !== generationRef.current) return;
    if (!nextQuestion || !reserveQuestion(nextQuestion)) {
      // Havuz tukendi: Hayatta Kalma'da basarili tamamlama sayilir (Part 8.3).
      await finalizeAndEnd("completed");
      return;
    }

    const nextRound = roundRef.current + 1;
    roundRef.current = nextRound;
    setRound(nextRound);
    resetQuestionTimer();
    setPhase("playing");
    // Yeni gosterilen soru "next" yuvasindan geldiyse (normal akis), kuyrukta
    // zaten bir soru olabilir -> sadece kuyruk yenilenir. Kuyruk yuvasindan
    // tuketildiyse ("next" bos kalmisti) hem "next" hem kuyruk yeniden
    // doldurulmali; bu da prepareNextQuestion zincirlemesiyle saglanir
    // (icinde kendi kuyrugunu da tetikler).
    if (usedQueuedSlot) {
      prepareNextQuestion(
        poolRef.current,
        new Set(usedIdsRef.current),
        nextRound + 1,
        generation,
      );
    } else if (queuedQuestionRef.current) {
      prepareQueuedQuestion(
        poolRef.current,
        new Set(usedIdsRef.current).add(questionKey(queuedQuestionRef.current)),
        nextRound + 2,
        generation,
      );
    } else {
      prepareQueuedQuestion(
        poolRef.current,
        new Set(usedIdsRef.current),
        nextRound + 2,
        generation,
      );
    }
  }, [
    apiKey,
    finalizeAndEnd,
    language,
    prepareNextQuestion,
    prepareQueuedQuestion,
    reserveQuestion,
    resetQuestionTimer,
    setPhase,
  ]);

  // Cevap geri bildiriminden sonra moda gore devam/bitis karari (Part 8).
  const advanceAfterAnswer = useCallback(async () => {
    if (phaseRef.current !== "answered") return;
    const mode = modeConfigRef.current;

    if (mode.id === "classic") {
      if (roundRef.current >= (mode.questionCount || 10)) {
        await finalizeAndEnd("completed");
        return;
      }
    } else if (mode.id === MODE_SURVIVAL) {
      if (livesRef.current <= 0) {
        await finalizeAndEnd("failed");
        return;
      }
    } else if (mode.timerType === "session") {
      if (sessionRemainingRef.current <= 0) {
        await finalizeAndEnd("completed");
        return;
      }
    }

    await goToNextQuestion();
  }, [finalizeAndEnd, goToNextQuestion]);

  const quitGame = useCallback(async () => {
    generationRef.current += 1;
    setTimerRunning(false);
    timerDeadlineRef.current = null;
    outcomeRef.current = "quit";
    setOutcome("quit");
    const saved = await saveStatsToFirebase();
    setPhase(saved ? "source_select" : "game_over");
    return saved;
  }, [saveStatsToFirebase, setPhase]);

  // Cikis onay sayfasi acilinca sureyi duraklatir (yalnizca aktif timer varsa).
  const pauseGame = useCallback(() => {
    if (phaseRef.current !== "playing" || !timerDeadlineRef.current) return;
    const mode = modeConfigRef.current;
    const remaining = Math.max(
      0,
      Math.ceil(((timerDeadlineRef.current || 0) - Date.now()) / 1000),
    );
    timeLeftRef.current = remaining;
    setTimeLeft(remaining);
    if (mode.timerType === "session") sessionRemainingRef.current = remaining;
    timerDeadlineRef.current = null;
    pausedRef.current = true;
    setTimerRunning(false);
  }, []);

  // "Oyuna devam et": duraklatilan sureden devam ettirir.
  const resumeGame = useCallback(() => {
    if (!pausedRef.current || phaseRef.current !== "playing") return;
    pausedRef.current = false;
    const remaining = timeLeftRef.current;
    if (remaining <= 0) return;
    timerDeadlineRef.current = Date.now() + remaining * 1000;
    setTimerRunning(true);
  }, []);

  // "Oturumu bitir": mevcut skorla oyunu bitirip sonuc ekranina goturur.
  const endSession = useCallback(async () => {
    pausedRef.current = false;
    await finalizeAndEnd("quit");
  }, [finalizeAndEnd]);

  const dismissError = useCallback(() => {
    setError(null);
    setPhase("source_select");
  }, [setPhase]);

  const useFiftyFiftyJoker = useCallback(() => {
    if (jokers <= 0 || eliminatedOptions.length > 0 || !currentQuestion) {
      return false;
    }
    const wrongIndices = currentQuestion.options
      .map((_, index) => index)
      .filter((index) => index !== currentQuestion.correctIndex)
      .sort(() => Math.random() - 0.5);

    // 4 sikta 2, 3 sikta 1 yanlis secenek elenir (her zaman 2 secenek kalir).
    const eliminateCount = Math.max(1, currentQuestion.options.length - 2);
    setEliminatedOptions(wrongIndices.slice(0, eliminateCount));
    setJokers((previous) => previous - 1);
    // Bu soruda %50 joker kullanildi -> puan cezasi (Part 11.1).
    questionJokerRef.current = { ...questionJokerRef.current, fifty: true };
    sessionJokerCountRef.current += 1;
    return true;
  }, [currentQuestion, eliminatedOptions.length, jokers]);

  const useChangeImageJoker = useCallback(() => {
    if (jokers <= 0 || !currentQuestion?.hints?.length) return false;
    setJokers((previous) => previous - 1);
    // Bu soruda gorsel degistirme jokeri kullanildi -> puan cezasi (Part 11.1).
    questionJokerRef.current = { ...questionJokerRef.current, image: true };
    sessionJokerCountRef.current += 1;
    return true;
  }, [currentQuestion, jokers]);

  return {
    phase,
    setPhase,
    source,
    error,
    saveStatus,
    sessionId,
    currentQuestion,
    score,
    streak,
    bestStreak,
    round,
    totalCorrect,
    totalWrong,
    timeLeft,
    timerRunning,
    jokers,
    eliminatedOptions,
    sessionHistory,
    lives,
    outcome,
    xpEarned,
    lastPoints,
    isNewRecord,
    // Mode/difficulty derived values for the UI.
    modeConfig,
    difficultyConfig,
    isSessionTimer,
    timerTotalSeconds,
    questionTotal,
    feedbackDelayMs,
    maxLives: modeConfig.maxLives || 0,
    startGame,
    startQuestionTimer,
    goToNextQuestion,
    advanceAfterAnswer,
    answerQuestion,
    quitGame,
    pauseGame,
    resumeGame,
    endSession,
    dismissError,
    saveStatsToFirebase,
    useFiftyFiftyJoker,
    useChangeImageJoker,
  };
}
