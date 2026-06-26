import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import AppIcon from "@components/AppIcon";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";
import { useApiSettings, useImageQualitySettings } from "@context/AppSettingsContext";
import { useAuth } from "@context/AuthContext";
import { useListStatusContext } from "@context/ListStatusContext";
import { i18nText } from "@utils/i18nText";
import { buildTmdbUrl } from "@utils/tmdbImageUtils";
import { buildGameTokens } from "@theme/gameTokens";
import GameTopBar from "@components/game/GameTopBar";
import GameTimerBar from "@components/game/GameTimerBar";
import JokerBar from "@components/game/JokerBar";
import AnswerOptionCard from "@components/game/AnswerOptionCard";
import ExitGameSheet from "@components/game/ExitGameSheet";
import GameLoadingState from "@components/game/GameLoadingState";
import GameErrorState from "@components/game/GameErrorState";
import {
  buildWatchlistPool,
  fetchLeaderboard,
  loadGameData,
} from "@services/sceneGameService";
import useSceneGame from "@hooks/useSceneGame";
import {
  DEFAULT_DIFFICULTY_ID,
  DEFAULT_MODE_ID,
  SCENE_GAME_ID,
} from "./gameConfig";
import { setGameSessionResult } from "./gameSessionStore";

const SOURCE_OPTIONS = [
  { key: "popular", label: "🔥", labelKey: "autoI18n.populer", fallback: "Popüler" },
  { key: "top_rated_movie", label: "⭐", labelKey: "autoI18n.en_iyi_filmler", fallback: "En İyi Filmler" },
  { key: "top_rated_tv", label: "📺", labelKey: "autoI18n.en_iyi_diziler", fallback: "En İyi Diziler" },
  { key: "popular_movie", label: "🎬", labelKey: "autoI18n.populer_filmler", fallback: "Popüler Filmler" },
  { key: "popular_tv", label: "📡", labelKey: "autoI18n.populer_diziler", fallback: "Popüler Diziler" },
  { key: "watchlist", label: "📋", labelKey: "autoI18n.izleme_listem", fallback: "İzleme Listem" },
  { key: "favorites", label: "❤️", labelKey: "autoI18n.favoriler", fallback: "Favoriler" },
  { key: "watchedMovies", label: "🍿", labelKey: "autoI18n.izlenen_filmler", fallback: "İzlenen Filmler" },
  { key: "watchedTv", label: "📺", labelKey: "autoI18n.izlenen_diziler", fallback: "İzlenen Diziler" },
];

export default function SceneGuessGameScreen({ navigation, route }) {
  const { theme } = useTheme();
  // Part 21.2/21.3: tek seferlik Dimensions.get yerine useWindowDimensions;
  // rotasyon/katlanir cihazda da guncel kalir, kucuk ekranlarda gorsel
  // yuksekligi sabit carpan yerine kullanilabilir alandan turetilir.
  const { width: screenW, height: screenH } = useWindowDimensions();
  const isLandscape = screenW > screenH;
  // Kucuk ekranlarda (21.2) sahne alani ekran yuksekliginin sabit bir orani
  // ile sinirlanir, boylece secenek alani icin her zaman yer kalir; buyuk
  // ekranlarda 16:9 oranina yakin kalmaya calisilir.
  const imageHeight = isLandscape
    ? Math.min(screenW * 0.56, screenH * 0.62)
    : Math.min(screenW * 0.56, screenH * 0.34);
  // Oyun tokenlari (Part 20.1): mevcut temadan turetilir, yeni hex tanitmaz.
  const gameTokens = useMemo(() => buildGameTokens(theme), [theme]);
  const { language } = useLanguage();
  const { API_KEY } = useApiSettings();
  const { getTmdbUrl } = useImageQualitySettings();
  const { user } = useAuth();
  const { allLists } = useListStatusContext();

  const routeSourceId = route?.params?.sourceId;
  const routeGameId = route?.params?.gameId || SCENE_GAME_ID;
  const routeModeId = route?.params?.modeId || DEFAULT_MODE_ID;
  const routeDifficultyId = route?.params?.difficultyId || DEFAULT_DIFFICULTY_ID;

  const {
    phase,
    setPhase,
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
    outcome,
    xpEarned,
    lastPoints,
    isNewRecord,
    modeConfig,
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
    dismissError,
    saveStatsToFirebase,
    useFiftyFiftyJoker,
    useChangeImageJoker,
  } = useSceneGame({
    apiKey: API_KEY,
    language,
    userUid: user?.uid,
    allLists,
    currentUser: user,
    modeId: routeModeId,
    difficultyId: routeDifficultyId,
  });

  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [gameStats, setGameStats] = useState(null);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [leaderboardModalVisible, setLeaderboardModalVisible] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardStatus, setLeaderboardStatus] = useState("idle");
  const [usedHintIndex, setUsedHintIndex] = useState(-1);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [imageRetryKey, setImageRetryKey] = useState(0);
  const [sceneImageReady, setSceneImageReady] = useState(false);
  const [exitSheetVisible, setExitSheetVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const questionTimerStartedRef = useRef(false);
  const autoStartRef = useRef(false);
  const openedResultSessionRef = useRef(null);

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

  useEffect(() => {
    if (phase !== "game_over" || !sessionId) return;

    setGameSessionResult(sessionId, {
      gameId: routeGameId,
      modeId: routeModeId,
      difficultyId: routeDifficultyId,
      sourceId: source,
      score,
      bestStreak,
      round,
      totalCorrect,
      totalWrong,
      sessionHistory,
      outcome,
      xpEarned,
      isNewRecord,
      saveStatus,
      retrySave: saveStatsToFirebase,
    });

    if (openedResultSessionRef.current === sessionId) return;
    openedResultSessionRef.current = sessionId;
    navigation.navigate("SceneGameResultScreen", { sessionId });
  }, [
    bestStreak,
    isNewRecord,
    navigation,
    outcome,
    phase,
    round,
    routeDifficultyId,
    routeGameId,
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
  const optionsAnim = useRef(new Animated.Value(0)).current;
  const scoreScale = useRef(new Animated.Value(1)).current;
  const streakScale = useRef(new Animated.Value(1)).current;
  const resultFlash = useRef(new Animated.Value(0)).current;
  const optionAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    if (!user?.uid || (phase !== "source_select" && phase !== "game_over")) return;
    loadGameData(user.uid).then((data) => {
      if (data) setGameStats(data);
    });
  }, [user?.uid, phase]);

  const loadLeaderboard = useCallback(async () => {
    setLeaderboardStatus("loading");
    try {
      const data = await fetchLeaderboard(50);
      setLeaderboardData(data);
      setLeaderboardStatus("success");
    } catch {
      setLeaderboardData([]);
      setLeaderboardStatus("error");
    }
  }, []);

  useEffect(() => {
    if (phase === "source_select") loadLeaderboard();
  }, [phase, loadLeaderboard]);

  // Part 25.2: "source_select" fazina girildiginde loadLeaderboard zaten
  // calisir (yukaridaki useEffect). Bu buton sadece modali acar; ayrica
  // ag istegi tekrarlamaz (eskiden burada da await loadLeaderboard()
  // cagrilip ayni veri icin gereksiz ikinci bir Firestore okumasi
  // yapiliyordu).
  const handleOpenLeaderboard = useCallback(() => {
    setLeaderboardModalVisible(true);
  }, []);

  const animateQuestionIn = useCallback(() => {
    imageAnim.setValue(0);
    optionsAnim.setValue(0);
    resultFlash.setValue(0);
    optionAnims.forEach((a) => a.setValue(0));

    Animated.sequence([
      Animated.timing(imageAnim, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.stagger(
        60,
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
  }, [imageAnim, optionAnims]);

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

  useEffect(() => {
    if (phase !== "answered") return undefined;

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

    // Devam/bitiş kararı moda göre engine tarafından verilir (Part 8).
    const timerId = setTimeout(() => {
      advanceAfterAnswer();
    }, feedbackDelayMs);

    return () => clearTimeout(timerId);
  }, [phase, selectedIndex, advanceAfterAnswer, feedbackDelayMs, resultFlash, reduceMotion]);

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
            Animated.timing(scoreScale, { toValue: 1.3, duration: 150, useNativeDriver: true }),
            Animated.spring(scoreScale, { toValue: 1, damping: 8, useNativeDriver: true }),
          ]).start();
          Animated.sequence([
            Animated.timing(streakScale, { toValue: 1.4, duration: 120, useNativeDriver: true }),
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

  const handleQuitToHome = useCallback(async () => {
    setExitSheetVisible(false);
    const saved = await quitGame();
    if (saved) navigation.goBack();
  }, [quitGame, navigation]);

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
    endSession();
  }, [endSession]);

  const handlePlayAgain = useCallback(async () => {
    if (saveStatus === "saving") return;
    const saved = await saveStatsToFirebase();
    if (saved) setPhase("source_select");
  }, [saveStatus, saveStatsToFirebase, setPhase]);

  const sceneImageUrl = useMemo(() => {
    if (!question?.imagePath) return null;
    let path = question.imagePath;
    if (usedHintIndex >= 0 && question.hints && question.hints[usedHintIndex]) {
      path = question.hints[usedHintIndex];
    }
    return buildTmdbUrl(path, "backdrop", screenW, "good");
  }, [question, usedHintIndex, screenW]);

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

  const personalSourceCounts = useMemo(
    () => ({
      watchlist: buildWatchlistPool(allLists?.watchList || []).length,
      favorites: buildWatchlistPool(allLists?.favorites || []).length,
      watchedMovies: buildWatchlistPool(allLists?.watchedMovies || []).length,
      watchedTv: buildWatchlistPool(allLists?.watchedTv || []).length,
    }),
    [allLists],
  );

  const flashBg = resultFlash.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["rgba(255,50,50,0.25)", "rgba(0,0,0,0)", "rgba(50,255,100,0.2)"],
  });

  const gameErrorContent = useMemo(() => {
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
  }, [error]);

  if (phase === "error") {
    return (
      <GameErrorState
        theme={theme}
        content={gameErrorContent}
        onRetry={() => startGame(source)}
        onDismiss={dismissError}
      />
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER — KAYNAK SEÇİMİ (SOURCE SELECT)
  // ══════════════════════════════════════════════════════════════════════════════
  if (phase === "source_select") {
    return (
      <View style={[styles.root, { backgroundColor: theme.primary }]}>
        <SafeAreaView style={styles.flex1}>
          <View style={styles.sourceHeader}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={i18nText("autoI18n.geri_don", "Geri Dön")}
              hitSlop={8}
            >
              <AppIcon family="Ionicons" name="arrow-back" size={24} color={theme.text.primary} />
            </TouchableOpacity>
            <Text style={[styles.sourceTitle, { color: theme.text.primary }]}>
              🎬 {i18nText("autoI18n.sahne_tahmin_oyunu", "Sahne Tahmin Oyunu")}
            </Text>
            <View style={styles.sourceHeaderActions}>
              <TouchableOpacity
                onPress={handleOpenLeaderboard}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={i18nText("autoI18n.liderlik_tablosu", "Liderlik Tablosu")}
                hitSlop={8}
              >
                <AppIcon family="Ionicons" name="trophy" size={22} color="#FFD700" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setHistoryModalVisible(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={i18nText("autoI18n.oyun_istatistikleri", "Oyun İstatistikleri")}
                hitSlop={8}
              >
                <AppIcon family="Ionicons" name="stats-chart" size={22} color={theme.text.secondary} />
              </TouchableOpacity>
            </View>
          </View>

          {gameStats && (
            <View style={[styles.statsBanner, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: "#FFD700" }]}>{gameStats.bestScore || 0}</Text>
                <Text style={[styles.statLabel, { color: theme.text.muted }]}>{i18nText("autoI18n.en_iyi_skor", "En İyi Skor")}</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: "#FF6B6B" }]}>🔥 {gameStats.bestStreak || 0}</Text>
                <Text style={[styles.statLabel, { color: theme.text.muted }]}>{i18nText("autoI18n.en_iyi_seri", "En İyi Seri")}</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: "#5BFF6B" }]}>{gameStats.totalCorrect || 0}</Text>
                <Text style={[styles.statLabel, { color: theme.text.muted }]}>{i18nText("autoI18n.dogru", "Doğru")}</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.text.primary }]}>{gameStats.totalPlayed || 0}</Text>
                <Text style={[styles.statLabel, { color: theme.text.muted }]}>{i18nText("autoI18n.oyun", "Oyun")}</Text>
              </View>
            </View>
          )}

          {/* Top 3 Leaderboard Preview */}
          {leaderboardData && leaderboardData.length > 0 && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleOpenLeaderboard}
              style={styles.lbPreviewCard}
            >
              <View style={styles.lbPreviewHeader}>
                <Text style={styles.lbPreviewTitle}>🏆 {i18nText("autoI18n.liderlik_tablosu", "Liderlik Tablosu")}</Text>
                <AppIcon family="Ionicons" name="chevron-forward" size={16} color="#FFD700" />
              </View>
              <View style={styles.lbPreviewRow}>
                {leaderboardData.slice(0, 3).map((lb, idx) => (
                  <View key={lb.uid} style={styles.lbPreviewCol}>
                    <Text style={[styles.lbPreviewRank, { color: idx === 0 ? "#FFD700" : idx === 1 ? "#C0C0C0" : "#CD7F32" }]}>
                      #{idx + 1}
                    </Text>
                    <Text style={[styles.lbPreviewName, { color: theme.text.primary }]} numberOfLines={1}>
                      {lb.displayName || i18nText("autoI18n.anonim_oyuncu", "Anonim")}
                    </Text>
                    <Text style={[styles.lbPreviewScore, { color: theme.text.muted }]}>
                      {lb.bestScore}
                    </Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          )}

          <Text style={[styles.sourceSubtitle, { color: theme.text.secondary }]}>
            {i18nText("autoI18n.kaynak_sec", "Bir içerik kaynağı seçerek başla")}
          </Text>

          <ScrollView contentContainerStyle={styles.sourceList} showsVerticalScrollIndicator={false}>
            {SOURCE_OPTIONS.map((opt, index) => {
              const personalCount = personalSourceCounts[opt.key];
              const isDisabled = Number.isFinite(personalCount) && personalCount < 4;
              const gradients = [
                ["rgba(255,94,98,0.15)", "rgba(255,153,102,0.02)"], // Sunset
                ["rgba(86,204,242,0.15)", "rgba(47,128,237,0.02)"], // Ocean
                ["rgba(242,201,76,0.15)", "rgba(242,153,74,0.02)"], // Gold
                ["rgba(168,255,120,0.15)", "rgba(120,255,214,0.02)"], // Mint
                ["rgba(211,131,18,0.15)", "rgba(168,50,121,0.02)"], // Berry
                ["rgba(20,30,48,0.15)", "rgba(36,59,85,0.02)"], // Midnight
                ["rgba(255,75,43,0.15)", "rgba(255,65,108,0.02)"], // Crimson
                ["rgba(0,176,155,0.15)", "rgba(150,201,61,0.02)"], // Forest
                ["rgba(138,35,135,0.15)", "rgba(233,64,87,0.02)"], // Royal
              ];
              const cardGradient = gradients[index % gradients.length];

              return (
                <TouchableOpacity
                  key={opt.key}
                  activeOpacity={0.8}
                  disabled={isDisabled}
                  onPress={() => startGame(opt.key)}
                  style={[
                    styles.sourceCard,
                    {
                      backgroundColor: theme.secondary,
                      borderColor: theme.border,
                      opacity: isDisabled ? 0.5 : 1,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={cardGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={[styles.sourceEmojiWrap, { backgroundColor: "rgba(255,255,255,0.05)" }]}>
                    <Text style={styles.sourceEmoji}>{opt.label}</Text>
                  </View>
                  <Text style={[styles.sourceCardText, { color: theme.text.primary }]} numberOfLines={2}>
                    {i18nText(opt.labelKey, opt.fallback)}
                  </Text>
                  {Number.isFinite(personalCount) && (
                    <Text style={[styles.sourceCountText, { color: isDisabled ? theme.colors.red : theme.text.muted }]}>
                      {isDisabled
                        ? i18nText("autoI18n.oyun_en_az_dort_icerik", `En az 4 içerik gerekli (${personalCount}/4)`, { count: personalCount })
                        : i18nText("autoI18n.oyun_uygun_icerik", `${personalCount} uygun içerik`, { count: personalCount })}
                    </Text>
                  )}
                  <View style={[styles.sourceArrow, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
                    <AppIcon family="Ionicons" name="chevron-forward" size={14} color={theme.text.muted} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </SafeAreaView>

        {/* History Modal */}
        <Modal visible={historyModalVisible} transparent animationType="slide" onRequestClose={() => setHistoryModalVisible(false)}>
          <View style={styles.historyModalRoot}>
            <BlurView tint="dark" intensity={80} experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
            <SafeAreaView style={styles.flex1}>
              <View style={styles.historyHeader}>
                <Text style={[styles.historyTitle, { color: "#fff" }]}>{i18nText("autoI18n.oyun_istatistikleri", "Oyun İstatistikleri")}</Text>
                <TouchableOpacity
                  onPress={() => setHistoryModalVisible(false)}
                  accessibilityRole="button"
                  accessibilityLabel={i18nText("autoI18n.kapat", "Kapat")}
                  hitSlop={8}
                >
                  <AppIcon family="Ionicons" name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              {gameStats ? (
                <View style={styles.historyContent}>
                  <View style={styles.historyStatRow}>
                    <Text style={styles.historyStatLabel}>{i18nText("autoI18n.en_iyi_skor", "En İyi Skor")}</Text>
                    <Text style={[styles.historyStatVal, { color: "#FFD700" }]}>{gameStats.bestScore || 0}</Text>
                  </View>
                  <View style={styles.historyStatRow}>
                    <Text style={styles.historyStatLabel}>{i18nText("autoI18n.en_iyi_seri", "En İyi Seri")}</Text>
                    <Text style={[styles.historyStatVal, { color: "#FF6B6B" }]}>🔥 {gameStats.bestStreak || 0}</Text>
                  </View>
                  <View style={styles.historyStatRow}>
                    <Text style={styles.historyStatLabel}>{i18nText("autoI18n.toplam_dogru", "Toplam Doğru")}</Text>
                    <Text style={[styles.historyStatVal, { color: "#5BFF6B" }]}>{gameStats.totalCorrect || 0}</Text>
                  </View>
                  <View style={styles.historyStatRow}>
                    <Text style={styles.historyStatLabel}>{i18nText("autoI18n.toplam_yanlis", "Toplam Yanlış")}</Text>
                    <Text style={[styles.historyStatVal, { color: "#FF5555" }]}>{gameStats.totalWrong || 0}</Text>
                  </View>
                  <View style={styles.historyStatRow}>
                    <Text style={styles.historyStatLabel}>{i18nText("autoI18n.toplam_oyun", "Toplam Oyun")}</Text>
                    <Text style={[styles.historyStatVal, { color: "#fff" }]}>{gameStats.totalPlayed || 0}</Text>
                  </View>
                  <View style={styles.historyStatRow}>
                    <Text style={styles.historyStatLabel}>{i18nText("autoI18n.cozulen_soru", "Çözülen Soru")}</Text>
                    <Text style={[styles.historyStatVal, { color: "#64b4ff" }]}>{(gameStats.totalCorrect || 0) + (gameStats.totalWrong || 0)}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.historyContent}>
                  <Text style={{ color: "#aaa", textAlign: "center", marginTop: 40, fontSize: 14 }}>
                    {i18nText("autoI18n.henuz_oyun_oynanmadi", "Henüz oyun oynanmadı")}
                  </Text>
                </View>
              )}
            </SafeAreaView>
          </View>
        </Modal>

        {/* Leaderboard Modal */}
        <Modal visible={leaderboardModalVisible} transparent animationType="slide" onRequestClose={() => setLeaderboardModalVisible(false)}>
          <View style={styles.historyModalRoot}>
            <BlurView tint="dark" intensity={80} experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
            <SafeAreaView style={styles.flex1}>
              <View style={styles.historyHeader}>
                <Text style={[styles.historyTitle, { color: "#FFD700" }]}>🏆 {i18nText("autoI18n.liderlik_tablosu", "Liderlik Tablosu")}</Text>
                <TouchableOpacity
                  onPress={() => setLeaderboardModalVisible(false)}
                  accessibilityRole="button"
                  accessibilityLabel={i18nText("autoI18n.kapat", "Kapat")}
                  hitSlop={8}
                >
                  <AppIcon family="Ionicons" name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={styles.historyContent} showsVerticalScrollIndicator={false}>
                {leaderboardStatus === "loading" ? (
                  <ActivityIndicator size="large" color="#FFD700" style={{ marginTop: 40 }} />
                ) : leaderboardStatus === "error" ? (
                  <View style={styles.leaderboardState}>
                    <AppIcon family="Ionicons" name="cloud-offline-outline" size={32} color="#aaa" />
                    <Text style={styles.leaderboardStateText}>{i18nText("autoI18n.liderlik_yuklenemedi", "Liderlik tablosu yüklenemedi")}</Text>
                    <TouchableOpacity style={styles.leaderboardRetryBtn} onPress={loadLeaderboard}>
                      <Text style={styles.leaderboardRetryText}>{i18nText("autoI18n.tekrar_dene", "Tekrar Dene")}</Text>
                    </TouchableOpacity>
                  </View>
                ) : leaderboardData.length > 0 ? (
                  leaderboardData.map((lbUser, idx) => (
                    <View key={lbUser.uid} style={[styles.historyStatRow, { borderBottomColor: "rgba(255,255,255,0.05)" }]}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <Text style={{ color: idx < 3 ? "#FFD700" : "#aaa", fontSize: 16, fontWeight: "800", width: 24 }}>
                          #{idx + 1}
                        </Text>
                        <Text style={[styles.historyStatLabel, { color: "#fff" }]}>
                          {lbUser.displayName || i18nText("autoI18n.anonim_oyuncu", "Anonim Oyuncu")}
                        </Text>
                      </View>
                      <Text style={[styles.historyStatVal, { color: idx === 0 ? "#FFD700" : "#fff" }]}>
                        {lbUser.bestScore}
                      </Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.leaderboardState}>
                    <AppIcon family="Ionicons" name="trophy-outline" size={32} color="#aaa" />
                    <Text style={styles.leaderboardStateText}>{i18nText("autoI18n.liderlik_henuz_bos", "Henüz sıralamaya giren oyuncu yok")}</Text>
                  </View>
                )}
              </ScrollView>
            </SafeAreaView>
          </View>
        </Modal>
      </View>
    );
  }

  if (phase === "loading") {
    return <GameLoadingState theme={theme} />;
  }

  if (phase === "game_over") {
    return (
      <View style={[styles.root, { backgroundColor: theme.primary }]}>
        <SafeAreaView style={[styles.flex1, { justifyContent: "center", alignItems: "center" }]}>
          <Text style={styles.gameOverEmoji}>🏆</Text>
          <Text style={[styles.gameOverTitle, { color: theme.text.primary }]}>{i18nText("autoI18n.oyun_bitti", "Oyun Bitti!")}</Text>
          <Text style={[styles.gameOverScore, { color: "#FFD700" }]}>{i18nText("autoI18n.skor", "Skor")}: {score}</Text>

          <View style={[styles.gameOverStats, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
            <View style={styles.gameOverStatRow}>
              <Text style={[styles.gameOverStatLabel, { color: theme.text.muted }]}>{i18nText("autoI18n.dogru", "Doğru")}</Text>
              <Text style={[styles.gameOverStatVal, { color: "#5BFF6B" }]}>{totalCorrect}</Text>
            </View>
            <View style={styles.gameOverStatRow}>
              <Text style={[styles.gameOverStatLabel, { color: theme.text.muted }]}>{i18nText("autoI18n.yanlis", "Yanlış")}</Text>
              <Text style={[styles.gameOverStatVal, { color: "#FF5555" }]}>{totalWrong}</Text>
            </View>
            <View style={styles.gameOverStatRow}>
              <Text style={[styles.gameOverStatLabel, { color: theme.text.muted }]}>{i18nText("autoI18n.en_iyi_seri", "En İyi Seri")}</Text>
              <Text style={[styles.gameOverStatVal, { color: "#FF6B6B" }]}>🔥 {bestStreak}</Text>
            </View>
            <View style={styles.gameOverStatRow}>
              <Text style={[styles.gameOverStatLabel, { color: theme.text.muted }]}>{i18nText("autoI18n.toplam_tur", "Toplam Tur")}</Text>
              <Text style={[styles.gameOverStatVal, { color: theme.text.primary }]}>{round}</Text>
            </View>
          </View>

          {/* Oynanan Sorular (Session History) */}
          {sessionHistory && sessionHistory.length > 0 && (
            <View style={{ width: "100%", paddingLeft: 20, marginBottom: 20 }}>
              <Text style={{ color: theme.text.secondary, fontSize: 13, fontWeight: "700", marginBottom: 10 }}>
                {i18nText("autoI18n.cevaplariniz", "Cevaplarınız")}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 40 }}>
                {sessionHistory.map((sh, idx) => {
                  const posterUrl = sh.item?.posterPath ? buildTmdbUrl(sh.item.posterPath, "poster", 185) : null;
                  return (
                    <View key={idx} style={{ width: 80, alignItems: "center", gap: 6 }}>
                      <View style={{ width: 80, height: 120, borderRadius: 12, borderWidth: 2, borderColor: sh.isCorrect ? "#2ECC71" : "#E74C3C", overflow: "hidden" }}>
                        {posterUrl ? (
                          <Image source={{ uri: posterUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={200} />
                        ) : (
                          <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.05)", justifyContent: "center", alignItems: "center" }}>
                            <AppIcon family="Ionicons" name="image-outline" size={24} color={theme.text.muted} />
                          </View>
                        )}
                        <View style={{ position: "absolute", top: 4, right: 4, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 10, padding: 2 }}>
                          <AppIcon family="Ionicons" name={sh.isCorrect ? "checkmark" : "close"} size={16} color={sh.isCorrect ? "#2ECC71" : "#E74C3C"} />
                        </View>
                      </View>
                      <Text style={{ color: theme.text.primary, fontSize: 10, textAlign: "center", fontWeight: "600" }} numberOfLines={2}>
                        {sh.item?.title || "?"}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.85}
            disabled={saveStatus === "saving"}
            style={[styles.playAgainBtn, { backgroundColor: theme.accent, opacity: saveStatus === "saving" ? 0.6 : 1 }]}
            onPress={handlePlayAgain}
          >
            <AppIcon family="Ionicons" name="refresh" size={20} color="#fff" />
            <Text style={styles.playAgainText}>{i18nText("autoI18n.tekrar_oyna", "Tekrar Oyna")}</Text>
          </TouchableOpacity>
          {saveStatus === "error" && (
            <View style={styles.saveErrorWrap}>
              <AppIcon family="Ionicons" name="cloud-offline-outline" size={18} color="#FF6B6B" />
              <Text style={[styles.saveErrorText, { color: theme.text.secondary }]}>{i18nText("autoI18n.oyun_skor_kaydedilemedi", "Oyun sonucu kaydedilemedi")}</Text>
              <TouchableOpacity style={styles.saveRetryBtn} onPress={saveStatsToFirebase} activeOpacity={0.75}>
                <Text style={styles.saveRetryText}>{i18nText("autoI18n.tekrar_dene", "Tekrar Dene")}</Text>
              </TouchableOpacity>
            </View>
          )}
          {saveStatus === "saving" && (
            <View style={styles.saveErrorWrap}>
              <ActivityIndicator size="small" color={theme.accent} />
              <Text style={[styles.saveErrorText, { color: theme.text.secondary }]}>{i18nText("autoI18n.oyun_skor_kaydediliyor", "Oyun sonucu kaydediliyor...")}</Text>
            </View>
          )}
          <TouchableOpacity activeOpacity={0.7} style={styles.goBackBtn} onPress={handleQuitToHome}>
            <Text style={[styles.goBackText, { color: theme.text.muted }]}>{i18nText("autoI18n.geri_don", "Geri Dön")}</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER — OYNANIYOR (PLAYING)
  // ══════════════════════════════════════════════════════════════════════════════
  const isAnswered = phase === "answered";
  // Timer doluluk oranı moda göre (per-question: zorluk süresi, session: 60sn).
  const timerRatio = Math.max(0, Math.min(1, timeLeft / (timerTotalSeconds || 1)));
  const timerWidth = `${timerRatio * 100}%`;
  // Dynamic color for timer (green -> yellow -> red)
  const timerColor = timerRatio > 0.5 ? "#2ECC71" : timerRatio > 0.2 ? "#F1C40F" : "#E74C3C";
  // Zor modda Film/Dizi etiketi cevap verilene kadar gizlenir (Part 9.3).
  const showTypeBadge = routeDifficultyId !== "hard" || isAnswered;

  return (
    <View style={[styles.root, { backgroundColor: theme.primary }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: flashBg, zIndex: 100 }]} pointerEvents="none" />

      <SafeAreaView style={styles.flex1}>
        {/* ── Üst Bar ── */}
        <GameTopBar
          theme={theme}
          gameTokens={gameTokens}
          score={score}
          scoreScale={scoreScale}
          streak={streak}
          streakScale={streakScale}
          isSurvivalMode={routeModeId === "survival"}
          lives={lives}
          round={round}
          questionTotal={questionTotal}
          onClose={handleClosePress}
        />

        {/* ── Zamanlayıcı (Timer Bar) ── */}
        <GameTimerBar
          timeLeft={timeLeft}
          timerRunning={timerRunning}
          timerWidth={timerWidth}
          timerColor={timerColor}
        />

        {/* ── Soru Başlığı ve Jokerler ── */}
        <View style={styles.questionRow}>
          <Text style={[styles.questionLabel, { color: theme.text.secondary, marginBottom: 0 }]}>
            {i18nText("autoI18n.bu_sahne_hangisine_ait", "Bu sahne hangi yapıma ait?")}
          </Text>

          {!isAnswered && (
            <JokerBar
              gameTokens={gameTokens}
              jokers={jokers}
              eliminatedCount={eliminatedOptions.length}
              hasImageHint={Boolean(
                question?.hints && question.hints.length > 0 && usedHintIndex < question.hints.length - 1,
              )}
              onFiftyFiftyPress={handleFiftyFiftyPress}
              onHintPress={handleHintPress}
            />
          )}
        </View>

        {/* ── Sahne Görseli ── */}
        <Animated.View
          style={[
            styles.imageWrap,
            {
              opacity: imageAnim,
              transform: [{ scale: imageAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }],
            },
          ]}
        >
          <View style={[styles.imageContainer, { height: imageHeight, borderColor: theme.border }]}>
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
              <View style={[styles.sceneImage, { backgroundColor: theme.secondary, justifyContent: "center", alignItems: "center" }]}>
                <AppIcon family="Ionicons" name="image-outline" size={48} color={theme.text.muted} />
              </View>
            )}
            <LinearGradient colors={["transparent", "rgba(0,0,0,0.6)"]} style={styles.imageGradient} />

            {/* Görsel yüklenene kadar iskelet (Part 12.2) */}
            {sceneImageUrl && !sceneImageReady && !imageLoadFailed && (
              <View style={[styles.sceneSkeleton, { backgroundColor: theme.secondary }]}>
                <ActivityIndicator color={theme.accent} />
              </View>
            )}

            {imageLoadFailed && (
              <View style={styles.imageErrorOverlay}>
                <AppIcon family="Ionicons" name="image-outline" size={30} color="#fff" />
                <Text style={styles.imageErrorText}>{i18nText("autoI18n.sahne_gorseli_yuklenemedi", "Sahne görseli yüklenemedi")}</Text>
                <TouchableOpacity style={styles.imageRetryBtn} onPress={retrySceneImage} activeOpacity={0.8}>
                  <AppIcon family="Ionicons" name="refresh" size={15} color="#fff" />
                  <Text style={styles.imageRetryText}>{i18nText("autoI18n.tekrar_dene", "Tekrar Dene")}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Cevap geri bildirimi: kazanılan puan / mod cezası (Part 12.4) */}
            {isAnswered && lastPoints > 0 && (
              <View style={[styles.feedbackPop, { backgroundColor: "rgba(0,230,118,0.92)" }]}>
                <Text style={styles.feedbackPopText}>+{lastPoints}</Text>
              </View>
            )}
            {isAnswered && lastPoints === 0 && routeModeId === "survival" && (
              <View style={[styles.feedbackPop, { backgroundColor: "rgba(255,23,68,0.92)" }]}>
                <AppIcon family="Ionicons" name="heart-dislike" size={14} color="#fff" />
                <Text style={styles.feedbackPopText}>-1</Text>
              </View>
            )}
            {isAnswered && lastPoints === 0 && modeConfig?.timerType === "session" && (
              <View style={[styles.feedbackPop, { backgroundColor: "rgba(255,23,68,0.92)" }]}>
                <AppIcon family="Ionicons" name="time-outline" size={14} color="#fff" />
                <Text style={styles.feedbackPopText}>-{modeConfig.wrongPenaltySeconds}{i18nText("autoI18n.saniye_kisa", "sn")}</Text>
              </View>
            )}

            {isAnswered && (
              <View style={styles.answeredOverlay}>
                <Text style={styles.answeredTitle} numberOfLines={2}>
                  {question?.correctItem?.title}
                  {question?.correctItem?.year ? ` (${question.correctItem.year})` : ""}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* ── 4 Şık ── */}
        <View style={styles.optionsWrap}>
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

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  root: { flex: 1 },
  flex1: { flex: 1 },
  sourceHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 14 },
  sourceHeaderActions: { flexDirection: "row", gap: 14 },
  sourceTitle: { fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  sourceSubtitle: { fontSize: 13, fontWeight: "600", textAlign: "center", marginBottom: 14, marginTop: 4 },
  sourceList: { paddingHorizontal: 16, paddingBottom: 40, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  sourceCard: { width: "48%", paddingVertical: 20, paddingHorizontal: 12, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 14, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  sourceEmojiWrap: { width: 54, height: 54, borderRadius: 27, justifyContent: "center", alignItems: "center", marginBottom: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  sourceEmoji: { fontSize: 28 },
  sourceCardText: { fontSize: 13, fontWeight: "800", textAlign: "center", marginBottom: 16, lineHeight: 18, letterSpacing: 0.3 },
  sourceCountText: { fontSize: 9, fontWeight: "700", textAlign: "center", marginTop: -10, marginBottom: 16 },
  sourceArrow: { position: "absolute", bottom: 12, width: 26, height: 26, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  statsBanner: { flexDirection: "row", marginHorizontal: 18, marginVertical: 10, borderRadius: 18, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 8, alignItems: "center", justifyContent: "space-around" },
  statItem: { alignItems: "center", flex: 1 },
  statValue: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 9, fontWeight: "700", marginTop: 3, textTransform: "uppercase", letterSpacing: 0.5 },
  statDivider: { width: 1, height: 32, borderRadius: 1 },
  lbPreviewCard: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,215,0,0.3)", backgroundColor: "rgba(255,215,0,0.05)", paddingVertical: 12, paddingHorizontal: 16 },
  lbPreviewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  lbPreviewTitle: { color: "#FFD700", fontSize: 14, fontWeight: "800" },
  lbPreviewRow: { flexDirection: "row", gap: 8 },
  lbPreviewCol: { flex: 1, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10, padding: 8, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  lbPreviewRank: { fontSize: 16, fontWeight: "900", marginBottom: 2 },
  lbPreviewName: { fontSize: 11, fontWeight: "600", textAlign: "center" },
  lbPreviewScore: { fontSize: 10, fontWeight: "800", marginTop: 2 },
  questionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: 16, marginBottom: 10 },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
  loadingText: { fontSize: 14, fontWeight: "600" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8 },
  quitBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.08)", justifyContent: "center", alignItems: "center" },
  topBarCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  scoreBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,215,0,0.15)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,215,0,0.3)" },
  scoreText: { color: "#FFD700", fontSize: 16, fontWeight: "800" },
  streakBadge: { backgroundColor: "rgba(255,107,107,0.15)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,107,107,0.3)" },
  streakText: { color: "#FF6B6B", fontSize: 14, fontWeight: "800" },
  roundBadge: { minWidth: 38, height: 38, borderRadius: 19, paddingHorizontal: 10, justifyContent: "center", alignItems: "center" },
  roundText: { fontSize: 13, fontWeight: "700" },
  livesBadge: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 38, height: 38, borderRadius: 19, paddingHorizontal: 10, justifyContent: "center", backgroundColor: "rgba(255,90,95,0.15)", borderWidth: 1, borderColor: "rgba(255,90,95,0.3)" },
  livesText: { color: "#FF5A5F", fontSize: 14, fontWeight: "800" },
  timerWrap: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 12, gap: 10 },
  timerTrack: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  timerFill: { height: "100%", borderRadius: 4 },
  timerText: { fontSize: 13, fontWeight: "800", width: 24, textAlign: "right" },
  jokerBar: { flexDirection: "row", alignItems: "center", gap: 8 },
  jokerCountWrap: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,215,0,0.15)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  jokerCountText: { color: "#FFD700", fontSize: 12, fontWeight: "800" },
  jokerBtn: { backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  jokerBtnText: { color: "#FFD700", fontSize: 12, fontWeight: "800" },
  questionLabel: { textAlign: "center", fontSize: 13, fontWeight: "700", marginBottom: 10, letterSpacing: 0.3 },
  imageWrap: { marginHorizontal: 16, marginBottom: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 15, elevation: 12 },
  imageContainer: { borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  sceneImage: { width: "100%", height: "100%" },
  imageGradient: { position: "absolute", left: 0, right: 0, bottom: 0, height: 60 },
  imageErrorOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10,10,14,0.88)", justifyContent: "center", alignItems: "center", gap: 9, paddingHorizontal: 24 },
  imageErrorText: { color: "#fff", fontSize: 13, fontWeight: "700", textAlign: "center" },
  imageRetryBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", paddingHorizontal: 12, paddingVertical: 7 },
  imageRetryText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  sceneSkeleton: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" },
  feedbackPop: { position: "absolute", top: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14 },
  feedbackPopText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  answeredOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingVertical: 14 },
  answeredTitle: { color: "#fff", fontSize: 18, fontWeight: "900", textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  optionsWrap: { flex: 1, paddingHorizontal: 16, gap: 10, justifyContent: "flex-end", paddingBottom: 16 },
  optionCard: { flexDirection: "row", alignItems: "center", minHeight: 56, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, gap: 14 },
  optionTextWrap: { flex: 1, gap: 6 },
  optionTitle: { fontSize: 15, fontWeight: "800", lineHeight: 20, letterSpacing: 0.2 },
  optionTypeBadge: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  optionType: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 },
  resultIcon: { width: 28, justifyContent: "center", alignItems: "center" },
  resultTag: { flexDirection: "row", alignItems: "center", gap: 4 },
  resultTagText: { fontSize: 12, fontWeight: "900" },
  exitSheetRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.58)", justifyContent: "flex-end" },
  exitSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  exitHandle: { width: 42, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  exitTitle: { fontSize: 18, fontWeight: "900" },
  exitSubtitle: { fontSize: 12, fontWeight: "600", lineHeight: 17, marginTop: 6, marginBottom: 16 },
  exitPrimaryBtn: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16, marginBottom: 10 },
  exitPrimaryText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  exitSecondaryBtn: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16, borderWidth: 1, marginBottom: 6 },
  exitSecondaryText: { fontSize: 14, fontWeight: "800" },
  exitTextBtn: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  exitTextBtnText: { fontSize: 13, fontWeight: "700" },
  hintBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  gameOverEmoji: { fontSize: 64, marginBottom: 12 },
  gameOverTitle: { fontSize: 28, fontWeight: "900", marginBottom: 8, letterSpacing: -0.5 },
  gameOverScore: { fontSize: 22, fontWeight: "800", marginBottom: 20 },
  gameOverStats: { width: "80%", borderRadius: 20, borderWidth: 1, paddingVertical: 16, paddingHorizontal: 20, marginBottom: 24, gap: 12 },
  gameOverStatRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  gameOverStatLabel: { fontSize: 13, fontWeight: "600" },
  gameOverStatVal: { fontSize: 16, fontWeight: "800" },
  playAgainBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 20, marginBottom: 12 },
  playAgainText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  goBackBtn: { paddingVertical: 10, paddingHorizontal: 20 },
  goBackText: { fontSize: 13, fontWeight: "600" },
  historyModalRoot: { flex: 1 },
  historyHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16 },
  historyTitle: { fontSize: 20, fontWeight: "800" },
  historyContent: { paddingHorizontal: 24, paddingTop: 10, gap: 18, paddingBottom: 40 },
  historyStatRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  historyStatLabel: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.6)" },
  historyStatVal: { fontSize: 18, fontWeight: "800" },
  leaderboardState: { alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 40 },
  leaderboardStateText: { color: "#aaa", fontSize: 14, fontWeight: "600", textAlign: "center" },
  leaderboardRetryBtn: { borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,215,0,0.5)", paddingHorizontal: 16, paddingVertical: 8 },
  leaderboardRetryText: { color: "#FFD700", fontSize: 12, fontWeight: "800" },
  errorStateRoot: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  errorStateIcon: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", borderWidth: 1, marginBottom: 20 },
  errorStateTitle: { fontSize: 22, fontWeight: "900", textAlign: "center", marginBottom: 10 },
  errorStateMessage: { fontSize: 14, fontWeight: "500", lineHeight: 21, textAlign: "center", marginBottom: 24 },
  errorPrimaryBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 18, paddingHorizontal: 22, paddingVertical: 12, marginBottom: 8 },
  errorPrimaryText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  errorSecondaryBtn: { paddingHorizontal: 18, paddingVertical: 10 },
  errorSecondaryText: { fontSize: 13, fontWeight: "700" },
  saveErrorWrap: { width: "86%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 10, borderRadius: 14, backgroundColor: "rgba(255,107,107,0.08)" },
  saveErrorText: { flexShrink: 1, fontSize: 11, fontWeight: "600", textAlign: "center" },
  saveRetryBtn: { borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,107,107,0.45)", paddingHorizontal: 9, paddingVertical: 5 },
  saveRetryText: { color: "#FF6B6B", fontSize: 10, fontWeight: "800" },
});
