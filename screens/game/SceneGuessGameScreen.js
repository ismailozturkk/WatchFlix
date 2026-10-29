// screens/game/SceneGuessGameScreen.js
//
// Aktif oyun ekranı (rota: SceneGamePlayScreen, eski ad SceneGuessGameScreen).
// Hem Sahne Tahmin hem Poster Bulmaca burada oynanır — fark yalnızca sahnenin
// (görselin) çizimidir; soru, süre, joker, puan ve kayıt mantığı ortak motorda
// (hooks/useSceneGame).
//
// AKIŞ GARANTİLERİ (eski sürümde olmayanlar):
//   • Uygulama arka plana giderse süre DURUR ve çıkış sayfası açılır.
//   • Android geri tuşu / çıkış jesti oyunu sessizce kapatmaz; önce duraklatıp
//     onay ister (beforeRemove).
//   • Oyun bitince sonuç ekranı bu ekranın YERİNE geçer (replace): geri
//     dönüşte eski, bitmiş oyun ekranı geri gelmez.
//   • Cevap sonrası sabit bekleme yok: sonuç + doğru ad okunur, "Sonraki" ile
//     hemen geçilir.

import { Image } from "expo-image";
import * as Haptics from "@services/hapticsService";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  AppState,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
// Ekran kökü: Premium şeridi yüzerken üst boşluğu ona göre büyür.
import SafeAreaView from "@components/common/ScreenSafeAreaView";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";
import { useApiSettings } from "@context/AppSettingsContext";
import { useAuth } from "@context/AuthContext";
import { useUserProfile } from "@context/UserProfileContext";
import { useProfileUi } from "@context/ProfileUiContext";
import { avatarSnapshot } from "@utils/avatarPhotos";
import { useListStatusContext } from "@context/ListStatusContext";
import { i18nText } from "@utils/i18nText";
import { buildQuestionImageUrl } from "@utils/gameImage";
import { buildGameTokens } from "@theme/gameTokens";
import GameTopBar, { GameScoreRow } from "@components/game/GameTopBar";
import GameTimerBar from "@components/game/GameTimerBar";
import JokerBar from "@components/game/JokerBar";
import AnswerOptionCard from "@components/game/AnswerOptionCard";
import AnswerFeedbackBar from "@components/game/AnswerFeedbackBar";
import PosterReveal from "@components/game/PosterReveal";
import ExitGameSheet from "@components/game/ExitGameSheet";
import GameLoadingState from "@components/game/GameLoadingState";
import GameErrorState from "@components/game/GameErrorState";
import useSceneGame from "@hooks/useSceneGame";
import { usePremium } from "@context/PremiumContext";
import { buildLimitCopy } from "@utils/premiumFeatures";
import { alpha } from "../../theme/colors";
import {
  DEFAULT_DIFFICULTY_ID,
  DEFAULT_MODE_ID,
  MODE_SURVIVAL,
  MODE_TIME_ATTACK,
  SCENE_GAME_ID,
} from "./gameConfig";
import { setGameSessionResult } from "./gameSessionStore";

// Düzen bütçesi: sahne yüksekliği ekrandan KALAN yerden türetilir (sabit oran
// değil), böylece küçük telefonda bile dört şık ekrana sığar.
const HUD_HEIGHT = 54 + 44; // üst bar + skor satırı
const TIMER_BLOCK = 16; // zamanlayıcı çubuğu + boşluk

export default function SceneGuessGameScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = screenH < 720;
  // Oyun tokenlari (Part 20.1): mevcut temadan turetilir, yeni hex tanitmaz.
  const gameTokens = useMemo(() => buildGameTokens(theme), [theme]);
  const { language } = useLanguage();
  const { plan: premiumPlan } = usePremium();
  const { API_KEY } = useApiSettings();
  const { user } = useAuth();
  const { displayName: profileDisplayName } = useUserProfile();
  const { myAvatar } = useProfileUi();
  // Liderlik tablosuna yazılan kimlik: profildeki ad + avatar. Eskiden Auth
  // kullanıcısı geçiliyordu — avatarIndex hiç yoktu, fotoğraf da Auth'un
  // tazelenmeyen kopyasıydı (tabloda yanlış avatar).
  const gameIdentity = useMemo(() => {
    if (!user) return null;
    return {
      uid: user.uid,
      displayName: profileDisplayName || user.displayName || "",
      ...avatarSnapshot(myAvatar),
    };
  }, [user, profileDisplayName, myAvatar]);
  // combinedLists: öntanımlı listeler + watchedTv subcollection'dan türetilir
  // (yeni model — eski allLists kök-array yerine).
  const { combinedLists: allLists } = useListStatusContext();

  // Kaynaksız açılış (eski SceneGuessGameScreen rotası) Popüler havuzla başlar;
  // eskiden ayrı kurulum ekranına devrediliyordu, o ekran artık yok (kurulum
  // Eğlence'deki alt sayfada: components/game/GameSetupSheet.js).
  const routeSourceId = route?.params?.sourceId || "popular";
  const routeGameId = route?.params?.gameId || SCENE_GAME_ID;
  const routeModeId = route?.params?.modeId || DEFAULT_MODE_ID;
  const routeDifficultyId = route?.params?.difficultyId || DEFAULT_DIFFICULTY_ID;
  // Kabul edilen düello (yüzen davet kartı ya da sohbetteki kart, bkz. utils/importantInvites
  // .duelContextOf): sonuç ekranı skoru davetin geldiği sohbete yazar.
  const routeDuel = route?.params?.duel || null;

  const {
    phase,
    source,
    error,
    saveStatus,
    sessionId,
    currentQuestion: question,
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
    maxLives,
    outcome,
    xpEarned,
    lastPoints,
    isNewRecord,
    progressSummary,
    isDaily,
    isPoster,
    dailyKey,
    modeConfig,
    difficultyConfig,
    timerTotalSeconds,
    questionTotal,
    feedbackDelayMs,
    startGame,
    startQuestionTimer,
    advanceAfterAnswer,
    answerQuestion,
    quitGame,
    pauseGame,
    resumeGame,
    endSession,
    saveStatsToFirebase,
    useFiftyFiftyJoker,
    useChangeImageJoker,
  } = useSceneGame({
    apiKey: API_KEY,
    language,
    userUid: user?.uid,
    allLists,
    currentUser: gameIdentity,
    modeId: routeModeId,
    difficultyId: routeDifficultyId,
    gameId: routeGameId,
  });

  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [usedHintIndex, setUsedHintIndex] = useState(-1);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [imageRetryKey, setImageRetryKey] = useState(0);
  const [sceneImageReady, setSceneImageReady] = useState(false);
  const [exitSheetVisible, setExitSheetVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const questionTimerStartedRef = useRef(false);
  const autoStartRef = useRef(false);
  const openedResultSessionRef = useRef(null);
  // Bilerek çıkarken (kaydedip geri dön / sonuca geç) beforeRemove engellemesin.
  const allowLeaveRef = useRef(false);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const answeredCountRef = useRef(0);
  answeredCountRef.current = sessionHistory.length;

  // Reduce Motion ayarini izle (Part 12.4 / 20.3).
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((enabled) => { if (active) setReduceMotion(Boolean(enabled)); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", (enabled) =>
      setReduceMotion(Boolean(enabled)),
    );
    return () => { active = false; sub?.remove?.(); };
  }, []);

  useEffect(() => {
    if (!routeSourceId || autoStartRef.current) return;
    autoStartRef.current = true;
    startGame(routeSourceId);
  }, [routeSourceId, startGame]);

  // Oyun bitti → sonuç ekranı bu ekranın YERİNE geçer.
  useEffect(() => {
    if (phase !== "game_over" || !sessionId) return;

    setGameSessionResult(sessionId, {
      gameId: routeGameId,
      modeId: routeModeId,
      difficultyId: routeDifficultyId,
      sourceId: source,
      dailyKey: isDaily ? dailyKey : null,
      score,
      bestStreak,
      round,
      totalCorrect,
      totalWrong,
      sessionHistory,
      outcome,
      xpEarned,
      isNewRecord,
      progressSummary,
      saveStatus,
      retrySave: saveStatsToFirebase,
    });

    if (openedResultSessionRef.current === sessionId) return;
    openedResultSessionRef.current = sessionId;
    allowLeaveRef.current = true;
    // Düello yalnız AYNI günün günlük denemesine bağlanır (gün dönümünde açık kalan davet yeni günün
    // skorunu eski düelloya yazmasın).
    const duel = isDaily && routeDuel?.dayKey === dailyKey ? routeDuel : null;
    navigation.replace("SceneGameResultScreen", { sessionId, ...(duel ? { duel } : {}) });
  }, [
    bestStreak,
    dailyKey,
    isDaily,
    isNewRecord,
    navigation,
    outcome,
    phase,
    progressSummary,
    round,
    routeDifficultyId,
    routeGameId,
    routeDuel,
    routeModeId,
    saveStatsToFirebase,
    saveStatus,
    score,
    sessionHistory,
    sessionId,
    source,
    totalCorrect,
    totalWrong,
    xpEarned,
  ]);

  const imageAnim = useRef(new Animated.Value(0)).current;
  const scoreScale = useRef(new Animated.Value(1)).current;
  const streakScale = useRef(new Animated.Value(1)).current;
  const resultFlash = useRef(new Animated.Value(0)).current;
  const optionAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const animateQuestionIn = useCallback(() => {
    imageAnim.setValue(0);
    resultFlash.setValue(0);
    optionAnims.forEach((a) => a.setValue(0));

    Animated.sequence([
      Animated.timing(imageAnim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.stagger(
        55,
        optionAnims.map((a) =>
          Animated.spring(a, {
            toValue: 1,
            damping: 14,
            stiffness: 180,
            mass: 0.7,
            useNativeDriver: true,
          })
        )
      ),
    ]).start();
  }, [imageAnim, optionAnims, resultFlash]);

  useEffect(() => {
    if (phase === "playing" && question) {
      setSelectedIndex(-1);
      setUsedHintIndex(-1);
      setImageLoadFailed(false);
      setImageRetryKey(0);
      setSceneImageReady(false);
      questionTimerStartedRef.current = false;
      animateQuestionIn();
    }
  }, [question, phase, animateQuestionIn]);

  // Cevap sonrası otomatik geçiş. Çıkış sayfası açıkken ilerleme (yoksa sayfa
  // açıkken arkada yeni soru başlar). "Sonraki" butonu aynı fonksiyonu çağırır;
  // motor ikinci çağrıyı yok sayar (phase artık "answered" değil).
  useEffect(() => {
    if (phase !== "answered" || exitSheetVisible) return undefined;

    // Süre dolduysa (kullanıcı cevap vermedi) hata geri bildirimi göster.
    if (selectedIndex === -1) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      if (!reduceMotion) {
        Animated.sequence([
          Animated.timing(resultFlash, { toValue: -1, duration: 200, useNativeDriver: true }),
          Animated.timing(resultFlash, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]).start();
      }
    }

    const timerId = setTimeout(() => {
      advanceAfterAnswer();
    }, feedbackDelayMs);

    return () => clearTimeout(timerId);
  }, [phase, selectedIndex, exitSheetVisible, advanceAfterAnswer, feedbackDelayMs, resultFlash, reduceMotion]);

  // Son 3 saniye: her saniye hafif titreşim (süre baskısı hissi).
  useEffect(() => {
    if (!timerRunning || timeLeft > 3 || timeLeft <= 0) return;
    Haptics.selectionAsync().catch(() => {});
  }, [timeLeft, timerRunning]);

  const handleAnswerPress = useCallback(
    (index) => {
      if (phase !== "playing" || selectedIndex >= 0) return;
      setSelectedIndex(index);

      const isCorrect = answerQuestion(index);

      if (isCorrect) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        // Reduce Motion etkinse scale ve flash animasyonlari atlanir (Part 12.4).
        if (!reduceMotion) {
          Animated.sequence([
            Animated.timing(scoreScale, { toValue: 1.25, duration: 140, useNativeDriver: true }),
            Animated.spring(scoreScale, { toValue: 1, damping: 8, useNativeDriver: true }),
          ]).start();
          Animated.sequence([
            Animated.timing(streakScale, { toValue: 1.3, duration: 120, useNativeDriver: true }),
            Animated.spring(streakScale, { toValue: 1, damping: 8, useNativeDriver: true }),
          ]).start();
          Animated.sequence([
            Animated.timing(resultFlash, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.timing(resultFlash, { toValue: 0, duration: 500, useNativeDriver: true }),
          ]).start();
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        if (!reduceMotion) {
          Animated.sequence([
            Animated.timing(resultFlash, { toValue: -1, duration: 200, useNativeDriver: true }),
            Animated.timing(resultFlash, { toValue: 0, duration: 500, useNativeDriver: true }),
          ]).start();
        }
      }
    },
    [phase, selectedIndex, answerQuestion, scoreScale, streakScale, resultFlash, reduceMotion]
  );

  const leave = useCallback(() => {
    allowLeaveRef.current = true;
    navigation.goBack();
  }, [navigation]);

  const handleQuitToHome = useCallback(async () => {
    setExitSheetVisible(false);
    const saved = await quitGame();
    // Kayıt başarısızsa motor game_over'a geçer ve sonuç ekranı yeniden-dene sunar.
    if (saved) leave();
  }, [quitGame, leave]);

  // Üst bardaki kapatma butonu doğrudan çıkmaz; süreyi duraklatıp onay sayfası açar (Part 12.5).
  const handleClosePress = useCallback(() => {
    pauseGame();
    setExitSheetVisible(true);
  }, [pauseGame]);

  const handleResumeGame = useCallback(() => {
    setExitSheetVisible(false);
    resumeGame();
  }, [resumeGame]);

  const handleEndSession = useCallback(() => {
    setExitSheetVisible(false);
    // Hiç cevap yoksa gösterilecek bir sonuç da yok → doğrudan çık.
    if (answeredCountRef.current === 0) {
      handleQuitToHome();
      return;
    }
    endSession();
  }, [endSession, handleQuitToHome]);

  // Geri tuşu / çıkış jesti / üst bar: oyun sürerken hep aynı onay yolundan geçer.
  const requestExitRef = useRef(handleClosePress);
  requestExitRef.current = handleClosePress;
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (allowLeaveRef.current) return;
      const current = phaseRef.current;
      const inGame =
        current === "playing" ||
        current === "answered" ||
        (current === "loading" && answeredCountRef.current > 0);
      if (!inGame) return;
      event.preventDefault();
      requestExitRef.current();
    });
    return unsubscribe;
  }, [navigation]);

  // Arka plana gidince süre akmasın (bildirim/çağrı sorusu yanlış saydırmasın).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") return;
      if (phaseRef.current === "playing") requestExitRef.current();
    });
    return () => sub.remove();
  }, []);

  const sceneImageUrl = useMemo(() => {
    if (!question?.imagePath) return null;
    if (isPoster) return buildQuestionImageUrl(question.imagePath, "poster", screenW);
    let path = question.imagePath;
    if (usedHintIndex >= 0 && question.hints && question.hints[usedHintIndex]) {
      path = question.hints[usedHintIndex];
    }
    return buildQuestionImageUrl(path, "scene", screenW);
  }, [question, usedHintIndex, screenW, isPoster]);

  const handleHintPress = useCallback(() => {
    if (question?.hints && usedHintIndex < question.hints.length - 1) {
      if (useChangeImageJoker()) {
        setUsedHintIndex(usedHintIndex + 1);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    }
  }, [question, usedHintIndex, useChangeImageJoker]);

  const handleFiftyFiftyPress = useCallback(() => {
    if (!useFiftyFiftyJoker()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  }, [useFiftyFiftyJoker]);

  const handleSceneImageLoad = useCallback(() => {
    setImageLoadFailed(false);
    setSceneImageReady(true);
    if (!questionTimerStartedRef.current) {
      questionTimerStartedRef.current = true;
      startQuestionTimer();
    }
  }, [startQuestionTimer]);

  const handleSceneImageError = useCallback(() => {
    if (usedHintIndex >= 0 && questionTimerStartedRef.current) {
      setUsedHintIndex(-1);
      return;
    }
    setImageLoadFailed(true);
  }, [usedHintIndex]);

  const retrySceneImage = useCallback(() => {
    setImageLoadFailed(false);
    setImageRetryKey((previous) => previous + 1);
  }, []);

  const flashBg = resultFlash.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["rgba(255,50,50,0.22)", "rgba(0,0,0,0)", "rgba(50,255,100,0.18)"],
  });

  const gameErrorContent = useMemo(() => {
    // Günlük premium oyun hakkı bitti (hooks/useSceneGame → "daily_limit").
    if (error?.code === "daily_limit") {
      const copy = buildLimitCopy("games", premiumPlan, language);
      return {
        icon: "game-controller-outline",
        title: copy.title,
        message: copy.message,
        retryable: false,
        upgrade: copy.canUpgrade,
        upgradeLabel: language === "tr" ? "Planları gör" : language === "es" ? "Ver planes" : language === "pt" ? "Ver planos" : language === "de" ? "Pläne ansehen" : "See plans",
      };
    }
    if (error?.code === "insufficient_personal_source") {
      return {
        icon: "albums-outline",
        title: i18nText("autoI18n.oyun_liste_yetersiz_baslik", "Yeterli içerik yok"),
        message: i18nText(
          "autoI18n.oyun_liste_yetersiz_aciklama",
          `Bu listede ${error.availableCount || 0} uygun içerik var. Oynamak için en az 4 içerik eklemelisin.`,
          { count: error.availableCount || 0 },
        ),
        retryable: false,
      };
    }
    if (error?.code === "api_unavailable") {
      return {
        icon: "key-outline",
        title: i18nText("autoI18n.oyun_servis_hazir_degil", "Oyun servisi hazır değil"),
        message: i18nText("autoI18n.oyun_api_anahtari_yok", "TMDB bağlantı ayarı bulunamadı."),
        retryable: false,
      };
    }
    if (error?.code === "insufficient_pool" || error?.code === "question_unavailable") {
      return {
        icon: "images-outline",
        title: i18nText("autoI18n.oyun_soru_bulunamadi", "Uygun soru bulunamadı"),
        message: i18nText("autoI18n.oyun_baska_kaynak_sec", "Başka bir içerik kaynağı seçerek tekrar dene."),
        retryable: true,
      };
    }
    return {
      icon: "cloud-offline-outline",
      title: i18nText("autoI18n.oyun_yuklenemedi", "Oyun yüklenemedi"),
      message: i18nText("autoI18n.oyun_baglanti_kontrol", "Bağlantını kontrol edip yeniden dene."),
      retryable: true,
    };
  }, [error, language, premiumPlan]);

  if (phase === "error") {
    return (
      <GameErrorState
        theme={theme}
        content={gameErrorContent}
        onRetry={() => startGame(source)}
        onDismiss={leave}
        onUpgrade={() => navigation.navigate("PremiumScreen", { source: "games" })}
      />
    );
  }

  // Yükleme, bitiş (sonuç ekranına geçiliyor) ve çıkış sonrası geçiş anları:
  // eski kaynak-seçimi arayüzü artık yok; ara durumlar sade bir yükleme çizer.
  if (phase === "loading" || phase === "game_over" || phase === "source_select" || !question) {
    return (
      <GameLoadingState
        theme={theme}
        icon={isPoster ? "grid" : "film"}
        message={
          isDaily
            ? i18nText("autoI18n.oyun_gunluk_hazirlaniyor", "Günün sahneleri hazırlanıyor...")
            : phase === "game_over"
              ? i18nText("autoI18n.oyun_sonuc_hazirlaniyor", "Sonuç hazırlanıyor...")
              : undefined
        }
      />
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // OYNANIYOR
  // ══════════════════════════════════════════════════════════════════════════
  const isAnswered = phase === "answered";
  const isSession = modeConfig?.timerType === "session";
  const timerRatio = Math.max(0, Math.min(1, timeLeft / (timerTotalSeconds || 1)));
  const timerColor =
    timerRatio > 0.5 ? gameTokens.correct : timerRatio > 0.2 ? gameTokens.warning : gameTokens.incorrect;
  // Zor modda Film/Dizi etiketi cevap verilene kadar gizlenir (Part 9.3).
  const showTypeBadge = routeDifficultyId !== "hard" || isAnswered;

  // Sahne ölçüleri: kalan yerden türetilir.
  const optionH = compact ? 50 : 60;
  const optionGap = compact ? 8 : 10;
  const headerSlotH = compact ? 52 : 58;
  const chrome =
    HUD_HEIGHT + TIMER_BLOCK + headerSlotH + 4 * optionH + 3 * optionGap + 14;
  const room = Math.max(150, screenH - insets.top - insets.bottom - chrome);
  const sceneH = Math.min(room, Math.round((screenW - 32) * 0.5625));
  const posterH = Math.min(room, Math.round(screenW * 0.62 * 1.5));
  const posterW = Math.round(posterH / 1.5);
  const stageW = isPoster ? posterW : screenW - 32;
  const stageH = isPoster ? posterH : sceneH;

  const answerOutcome = !isAnswered
    ? null
    : selectedIndex === -1
      ? "timeout"
      : selectedIndex === question.correctIndex
        ? "correct"
        : "wrong";
  const results = sessionHistory.map((entry) => entry.isCorrect);
  const penaltyLabel =
    answerOutcome && answerOutcome !== "correct"
      ? routeModeId === MODE_SURVIVAL
        ? "-1 ♥"
        : routeModeId === MODE_TIME_ATTACK
          ? `-${modeConfig.wrongPenaltySeconds}${i18nText("autoI18n.saniye_kisa", "sn")}`
          : null
      : null;
  const isLastQuestion = Boolean(questionTotal) && round >= questionTotal;

  return (
    <View style={[styles.root, { backgroundColor: theme.primary }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: flashBg, zIndex: 100 }]} pointerEvents="none" />

      <SafeAreaView style={styles.flex1}>
        <GameTopBar
          theme={theme}
          gameTokens={gameTokens}
          mode={routeModeId}
          results={results}
          round={round}
          questionTotal={questionTotal}
          lives={lives}
          maxLives={maxLives}
          correctCount={totalCorrect}
          onClose={handleClosePress}
        />

        <GameScoreRow
          theme={theme}
          gameTokens={gameTokens}
          score={score}
          scoreScale={scoreScale}
          streak={streak}
          streakScale={streakScale}
        >
          {!isAnswered ? (
            <JokerBar
              theme={theme}
              gameTokens={gameTokens}
              jokers={jokers}
              eliminatedCount={eliminatedOptions.length}
              hasImageHint={
                !isPoster &&
                Boolean(question?.hints && question.hints.length > 0 && usedHintIndex < question.hints.length - 1)
              }
              onFiftyFiftyPress={handleFiftyFiftyPress}
              onHintPress={handleHintPress}
            />
          ) : null}
        </GameScoreRow>

        {/* ── Sahne ── */}
        <Animated.View
          style={[
            styles.stageWrap,
            {
              opacity: imageAnim,
              transform: [{ scale: imageAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
            },
          ]}
        >
          <View style={{ width: stageW, height: stageH }}>
            {isPoster ? (
              <PosterReveal
                uri={sceneImageUrl && imageRetryKey > 0 ? `${sceneImageUrl}#${imageRetryKey}` : sceneImageUrl}
                width={stageW}
                height={stageH}
                running={timerRunning}
                revealMs={(difficultyConfig?.timeSeconds || 12) * 1000}
                resetKey={`${round}_${question?.correctItem?.id}`}
                answered={isAnswered}
                ready={sceneImageReady}
                failed={imageLoadFailed}
                theme={theme}
                onLoad={handleSceneImageLoad}
                onError={handleSceneImageError}
              />
            ) : (
              <View style={[styles.sceneFrame, { borderColor: theme.border, backgroundColor: theme.secondary }]}>
                {sceneImageUrl ? (
                  <Image
                    key={`${sceneImageUrl}_${imageRetryKey}`}
                    source={{ uri: sceneImageUrl }}
                    style={styles.sceneImage}
                    contentFit="cover"
                    transition={300}
                    onLoad={handleSceneImageLoad}
                    onError={handleSceneImageError}
                  />
                ) : (
                  <View style={[styles.sceneImage, styles.center]}>
                    <AppIcon family="Ionicons" name="image-outline" size={48} color={theme.text.muted} />
                  </View>
                )}
                <LinearGradient colors={["transparent", "rgba(0,0,0,0.62)"]} style={styles.imageGradient} />

                {/* Görsel yüklenene kadar iskelet (Part 12.2) */}
                {sceneImageUrl && !sceneImageReady && !imageLoadFailed ? (
                  <View style={[styles.sceneSkeleton, { backgroundColor: theme.secondary }]}>
                    <ActivityIndicator color={theme.accent} />
                  </View>
                ) : null}

                {isAnswered ? (
                  <View style={styles.answeredOverlay}>
                    <Text style={styles.answeredTitle} numberOfLines={2}>
                      {question?.correctItem?.title}
                      {question?.correctItem?.year ? ` (${question.correctItem.year})` : ""}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* Süre hapı */}
            <View style={[styles.timePill, { backgroundColor: "rgba(0,0,0,0.55)", borderColor: alpha(timerColor, 0.7) }]}>
              <AppIcon family="Ionicons" name="time-outline" size={13} color={timerColor} />
              <Text style={[styles.timeText, { color: "#FFFFFF" }]} allowFontScaling={false}>
                {timerRunning || isAnswered ? `${timeLeft}${i18nText("autoI18n.saniye_kisa", "sn")}` : "…"}
              </Text>
            </View>

            {isPoster && isAnswered ? (
              <View style={styles.posterTitle} pointerEvents="none">
                <Text style={styles.answeredTitle} numberOfLines={2}>
                  {question?.correctItem?.title}
                </Text>
              </View>
            ) : null}

            {imageLoadFailed ? (
              <View style={styles.imageErrorOverlay}>
                <AppIcon family="Ionicons" name="image-outline" size={30} color="#fff" />
                <Text style={styles.imageErrorText}>
                  {i18nText("autoI18n.sahne_gorseli_yuklenemedi", "Sahne görseli yüklenemedi")}
                </Text>
                <TouchableOpacity style={styles.imageRetryBtn} onPress={retrySceneImage} activeOpacity={0.8}>
                  <AppIcon family="Ionicons" name="refresh" size={15} color="#fff" />
                  <Text style={styles.imageRetryText}>{i18nText("autoI18n.tekrar_dene", "Tekrar Dene")}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </Animated.View>

        <View style={styles.timerBlock}>
          <GameTimerBar
            timeLeft={timeLeft}
            totalSeconds={timerTotalSeconds}
            running={timerRunning}
            resetKey={isSession ? "session" : round}
            color={timerColor}
            trackColor={theme.border}
            syncOnStop={isSession}
          />
        </View>

        {/* ── Soru etiketi / cevap geri bildirimi (aynı yükseklikte: kayma yok) ── */}
        <View style={[styles.headerSlot, { height: headerSlotH }]}>
          {isAnswered && answerOutcome ? (
            <AnswerFeedbackBar
              theme={theme}
              gameTokens={gameTokens}
              outcome={answerOutcome}
              points={lastPoints}
              penalty={penaltyLabel}
              title={question?.correctItem?.title}
              year={question?.correctItem?.year}
              autoAdvanceMs={feedbackDelayMs}
              isLast={isLastQuestion}
              reduceMotion={reduceMotion}
              onNext={advanceAfterAnswer}
            />
          ) : (
            <Text style={[styles.questionLabel, { color: theme.text.secondary }]} allowFontScaling={false}>
              {isPoster
                ? i18nText("autoI18n.oyun_bu_afis_hangisine_ait", "Bu afiş hangi yapıma ait?")
                : i18nText("autoI18n.bu_sahne_hangisine_ait", "Bu sahne hangi yapıma ait?")}
            </Text>
          )}
        </View>

        {/* ── Şıklar ── */}
        <View style={[styles.optionsWrap, { gap: optionGap }]}>
          {question?.options?.map((item, idx) => (
            <AnswerOptionCard
              key={`${item.id}_${item.type}_${idx}`}
              theme={theme}
              gameTokens={gameTokens}
              item={item}
              index={idx}
              isCorrectOption={idx === question.correctIndex}
              isSelected={idx === selectedIndex}
              isAnswered={isAnswered}
              isEliminated={eliminatedOptions.includes(idx)}
              showTypeBadge={showTypeBadge}
              compact={compact}
              anim={optionAnims[idx]}
              onPress={handleAnswerPress}
            />
          ))}
        </View>
      </SafeAreaView>

      {/* ── Çıkış Onay Sayfası (Part 12.5) ── */}
      <ExitGameSheet
        theme={theme}
        visible={exitSheetVisible}
        onResume={handleResumeGame}
        onEndSession={handleEndSession}
        onQuitToHome={handleQuitToHome}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  center: { justifyContent: "center", alignItems: "center" },
  stageWrap: { alignItems: "center", marginBottom: 10 },
  sceneFrame: { flex: 1, borderRadius: 24, overflow: "hidden", borderWidth: 1 },
  sceneImage: { width: "100%", height: "100%" },
  imageGradient: { position: "absolute", left: 0, right: 0, bottom: 0, height: 70 },
  sceneSkeleton: { ...StyleSheet.absoluteFill, justifyContent: "center", alignItems: "center" },
  timePill: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
  },
  timeText: { fontSize: 12.5, fontWeight: "900" },
  answeredOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingVertical: 12 },
  posterTitle: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: "rgba(0,0,0,0.5)", borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
  answeredTitle: { color: "#fff", fontSize: 17, fontWeight: "900", textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  imageErrorOverlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(10,10,14,0.88)", borderRadius: 24, justifyContent: "center", alignItems: "center", gap: 9, paddingHorizontal: 24 },
  imageErrorText: { color: "#fff", fontSize: 13, fontWeight: "700", textAlign: "center" },
  imageRetryBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", paddingHorizontal: 12, paddingVertical: 7 },
  imageRetryText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  timerBlock: { marginBottom: 10 },
  headerSlot: { justifyContent: "center", paddingHorizontal: 16 },
  questionLabel: { textAlign: "center", fontSize: 12.5, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  optionsWrap: { flex: 1, paddingHorizontal: 16, justifyContent: "flex-start", paddingBottom: 12 },
});
