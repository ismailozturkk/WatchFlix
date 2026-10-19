import { copyLanguage, normalizeAppLanguage } from "../../utils/appLanguages";
import { Image } from "expo-image";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { captureRef } from "react-native-view-shot";
import AppIcon from "@components/AppIcon";
import { toast } from "@components/AppToast";
import SceneResultShareCard from "@components/game/SceneResultShareCard";
import UserAvatar from "@components/common/UserAvatar";
import { PressableScale } from "@components/game/ui";
import { useAuth } from "@context/AuthContext";
import { useFriends } from "@context/FriendsContext";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { fetchDailyFriendRows } from "@services/sceneGameService";
import { buildTmdbUrl } from "@utils/tmdbImageUtils";
import { alpha } from "../../theme/colors";
import { GameScreenShell, gameSharedStyles } from "./GameScreenShell";
import {
  getDifficultyConfig,
  getLocalizedGameLabel,
  getModeConfig,
  getSourceConfig,
  isDailyMode,
} from "./gameConfig";
import { getGameTitle } from "./gameLabels";
import { getGameEntry, resolveGameAccentColors } from "./gameRegistry";
import { deleteGameSessionResult, getGameSessionResult } from "./gameSessionStore";

const SHARE_CARD_W = 320;
const SHARE_CARD_H = 569; // ~9:16

// Skoru 0'dan hedefe sayarak gösterir (sonuç ekranının "ödül" anı).
function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!target) {
      setValue(0);
      return undefined;
    }
    const progress = new Animated.Value(0);
    const id = progress.addListener(({ value: v }) => setValue(Math.round(v)));
    Animated.timing(progress, { toValue: target, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => {
      progress.removeListener(id);
      progress.stopAnimation();
    };
  }, [target, duration]);
  return value;
}

// Doğruluğa göre kısa değerlendirme (başlık + ikon).
function verdictFor(accuracy, tr, es, pt) {
  if (accuracy >= 100) return { icon: "ribbon", text: tr ? "Kusursuz!" : es ? "¡Impecable!" : pt ? "Impecável!" : "Flawless!" };
  if (accuracy >= 80) return { icon: "star", text: tr ? "Harika iş!" : es ? "¡Buen trabajo!" : pt ? "Bom trabalho!" : "Great job!" };
  if (accuracy >= 60) return { icon: "thumbs-up", text: tr ? "Fena değil" : es ? "Nada mal" : pt ? "Nada mal" : "Not bad" };
  return { icon: "flash", text: tr ? "Bir dahaki sefere!" : es ? "¡A la próxima!" : pt ? "Na próxima!" : "Next time!" };
}

export default function SceneGameResultScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { friends = [] } = useFriends() || {};
  const sessionId = route.params?.sessionId;
  const [result, setResult] = useState(() => getGameSessionResult(sessionId));
  const [reviewExpanded, setReviewExpanded] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [dailyBoard, setDailyBoard] = useState(null);
  const shareCardRef = useRef(null);
  const tr = copyLanguage(language, ["tr", "en"]) === "tr";
  const es = normalizeAppLanguage(language) === "es";
  const pt = normalizeAppLanguage(language) === "pt";

  useEffect(() => {
    setResult(getGameSessionResult(sessionId));
  }, [sessionId]);

  const isDaily = isDailyMode(result?.modeId);
  const dailyKey = result?.dailyKey;

  // Günlük: arkadaşların bugünkü sonuçları (kendim dahil) → sıramı göster.
  useEffect(() => {
    if (!isDaily || !dailyKey || !user?.uid) return undefined;
    let active = true;
    const uids = [user.uid, ...friends.map((friend) => friend.friendUid || friend.id)];
    // Kayıt (Firestore) birkaç yüz ms sürebilir; kendi girdim henüz görünmeyebilir.
    const timer = setTimeout(() => {
      fetchDailyFriendRows(dailyKey, uids)
        .then((rows) => {
          if (active) setDailyBoard([...rows].sort((a, b) => b.bestScore - a.bestScore));
        })
        .catch(() => {});
    }, 700);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isDaily, dailyKey, user?.uid, friends]);

  const accuracy = useMemo(() => {
    const total = (result?.totalCorrect || 0) + (result?.totalWrong || 0);
    return total ? Math.round(((result?.totalCorrect || 0) / total) * 100) : 0;
  }, [result]);

  const averageMs = useMemo(() => {
    const timed = (result?.sessionHistory || []).filter((a) => Number.isFinite(a?.responseMs));
    if (!timed.length) return null;
    return Math.round(timed.reduce((sum, a) => sum + a.responseMs, 0) / timed.length);
  }, [result]);

  const totalQuestions = (result?.totalCorrect || 0) + (result?.totalWrong || 0);
  const shownScore = useCountUp(result?.score || 0);

  const leaveResult = (routeName, params) => {
    deleteGameSessionResult(sessionId);
    if (routeName === "SceneGamePlayScreen") {
      navigation.replace(routeName, params);
      return;
    }
    if (typeof navigation.popTo === "function") {
      navigation.popTo(routeName, params);
      return;
    }
    navigation.navigate(routeName, params);
  };

  // Cevap incelemesinden bir yapima gidis: oturum sonucu silinmez, kullanici
  // detaydan geri donebilir (Part 13.2 "listeye ekleme" aksiyonu).
  const openTitle = (item) => {
    if (!item?.id) return;
    navigation.navigate(item.type === "tv" ? "TvShowsDetails" : "MovieDetails", { id: item.id });
  };

  const modeConfig = getModeConfig(result?.modeId);
  const difficultyConfig = getDifficultyConfig(result?.difficultyId);
  const sourceConfig = getSourceConfig(result?.sourceId);
  const modeLabel = getLocalizedGameLabel(modeConfig, language);
  const difficultyLabel = getLocalizedGameLabel(difficultyConfig, language);
  const sourceLabel = getLocalizedGameLabel(sourceConfig, language);
  const gameTitle = getGameTitle(result?.gameId);
  const colors = resolveGameAccentColors(getGameEntry(result?.gameId), theme);

  const handleShare = useCallback(async () => {
    if (sharing || !shareCardRef.current) return;
    try {
      setSharing(true);
      await new Promise((r) => requestAnimationFrame(() => r()));
      await new Promise((r) => setTimeout(r, 90));
      const uri = await captureRef(shareCardRef, { format: "png", quality: 1, result: "tmpfile" });
      if (!(await Sharing.isAvailableAsync())) {
        toast.error(tr ? "Paylaşım kullanılamıyor" : es ? "Compartir no está disponible" : pt ? "O compartilhamento não está disponível" : "Sharing is unavailable");
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: gameTitle,
      });
    } catch (e) {
      toast.error(tr ? "Paylaşılamadı" : es ? "No se pudo compartir" : pt ? "Não foi possível compartilhar" : "Could not share", e?.message);
    } finally {
      setSharing(false);
    }
  }, [sharing, tr, gameTitle]);

  if (!result) {
    return (
      <GameScreenShell navigation={navigation} title={tr ? "Oyun Sonucu" : es ? "Resultado de la partida" : pt ? "Resultado da partida" : "Game Result"} scroll={false}>
        <View style={styles.missing}>
          <AppIcon family="Ionicons" name="alert-circle-outline" size={42} color={theme.text.muted} />
          <Text style={[styles.missingText, { color: theme.text.secondary }]}>{tr ? "Bu oturumun sonucu artık kullanılamıyor." : es ? "El resultado de esta sesión ya no está disponible." : pt ? "O resultado desta sessão não está mais disponível." : "This session result is no longer available."}</Text>
          <TouchableOpacity style={[gameSharedStyles.primaryButton, { backgroundColor: theme.accent, alignSelf: "stretch", marginHorizontal: 24 }]} onPress={() => navigation.navigate("GameHubScreen")}>
            <Text style={gameSharedStyles.primaryButtonText}>{tr ? "Oyun Merkezine Dön" : es ? "Volver al centro de juegos" : pt ? "Voltar à central de jogos" : "Back to Game Hub"}</Text>
          </TouchableOpacity>
        </View>
      </GameScreenShell>
    );
  }

  const outcomeLabel =
    result.outcome === "failed"
      ? (tr ? "Oyun bitti" : es ? "Fin de la partida" : pt ? "Fim da partida" : "Game over")
      : result.outcome === "quit"
        ? (tr ? "Yarıda bitirildi" : es ? "Terminada antes de tiempo" : pt ? "Encerrada antes da hora" : "Ended early")
        : (tr ? "Tamamlandı" : es ? "Completada" : pt ? "Concluída" : "Completed");

  const verdict = verdictFor(accuracy, tr, es, pt);
  const progress = result.progressSummary;
  const leveledUp = progress && progress.level > progress.levelBefore;
  const myRank = dailyBoard ? dailyBoard.findIndex((row) => row.uid === user?.uid) + 1 : 0;

  return (
    <GameScreenShell navigation={navigation} onBack={() => leaveResult("GameHubScreen")} title={tr ? "Oyun Sonucu" : es ? "Resultado de la partida" : pt ? "Resultado da partida" : "Game Result"} subtitle={`${modeLabel} · ${outcomeLabel}`}>
      {/* Hero skor */}
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.scoreHero}>
        <View pointerEvents="none" style={styles.heroGlowOne} />
        <View pointerEvents="none" style={styles.heroGlowTwo} />
        <View style={styles.verdictPill}>
          <AppIcon family="Ionicons" name={verdict.icon} size={13} color="#FFD76A" />
          <Text style={styles.verdictText} allowFontScaling={false}>{verdict.text}</Text>
        </View>
        <Text style={styles.scoreLabel} allowFontScaling={false}>{tr ? "TOPLAM SKOR" : es ? "PUNTUACIÓN TOTAL" : pt ? "PONTUAÇÃO TOTAL" : "TOTAL SCORE"}</Text>
        <Text style={styles.score} allowFontScaling={false}>{shownScore}</Text>
        <View style={styles.heroBadges}>
          {result.isNewRecord ? (
            <View style={styles.heroBadge}>
              <AppIcon family="Ionicons" name="ribbon" size={13} color="#FFD76A" />
              <Text style={styles.heroBadgeText}>{tr ? "Yeni Rekor!" : es ? "¡Nuevo récord!" : pt ? "Novo recorde!" : "New Record!"}</Text>
            </View>
          ) : null}
          {result.xpEarned ? (
            <View style={styles.heroBadge}>
              <AppIcon family="Ionicons" name="sparkles" size={13} color="#FFFFFF" />
              <Text style={styles.heroBadgeText}>+{result.xpEarned} XP</Text>
            </View>
          ) : null}
          {isDaily && progress?.dailyStreak > 0 ? (
            <View style={styles.heroBadge}>
              <AppIcon family="Ionicons" name="flame" size={13} color="#FF9F5A" />
              <Text style={styles.heroBadgeText}>{tr ? `${progress.dailyStreak} günlük seri` : es ? `racha de ${progress.dailyStreak} días` : pt ? `sequência de ${progress.dailyStreak} dias` : `${progress.dailyStreak}-day streak`}</Text>
            </View>
          ) : null}
        </View>
      </LinearGradient>

      {/* Seviye atlama */}
      {leveledUp ? (
        <View style={[styles.levelUp, { backgroundColor: alpha(theme.accent, 0.14), borderColor: alpha(theme.accent, 0.5) }]}>
          <View style={[styles.levelUpIcon, { backgroundColor: theme.accent }]}>
            <AppIcon family="Ionicons" name="trending-up" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.levelUpCopy}>
            <Text style={[styles.levelUpTitle, { color: theme.text.primary }]}>{tr ? "Seviye atladın!" : es ? "¡Subes de nivel!" : pt ? "Você subiu de nível!" : "Level up!"}</Text>
            <Text style={[styles.levelUpText, { color: theme.text.muted }]}>
              {tr ? `Seviye ${progress.levelBefore} → ${progress.level}` : es ? `Nivel ${progress.levelBefore} → ${progress.level}` : pt ? `Nível ${progress.levelBefore} → ${progress.level}` : `Level ${progress.levelBefore} → ${progress.level}`}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Soru soru sonuç noktaları */}
      {result.sessionHistory?.length ? (
        <View style={[styles.dotsCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          {result.sessionHistory.map((answer, index) => (
            <View
              key={index}
              style={[styles.dot, { backgroundColor: answer.isCorrect ? "#2ECC71" : "#E74C3C" }]}
            />
          ))}
        </View>
      ) : null}

      {/* Ana metrikler */}
      <View style={gameSharedStyles.metricRow}>
        <Metric value={`${result.totalCorrect || 0}/${totalQuestions}`} label={tr ? "Doğru" : es ? "Aciertos" : pt ? "Acertos" : "Correct"} color="#2ECC71" theme={theme} />
        <Metric value={`${accuracy}%`} label={tr ? "Doğruluk" : es ? "Precisión" : pt ? "Precisão" : "Accuracy"} color={theme.accent} theme={theme} />
        <Metric value={result.bestStreak || 0} label={tr ? "En iyi seri" : es ? "Mejor racha" : pt ? "Melhor sequência" : "Best streak"} color="#FF6B6B" theme={theme} />
      </View>

      {/* Ayrinti seridi: zorluk · kaynak · ortalama sure */}
      <View style={[styles.detailStrip, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        <DetailItem icon="speedometer-outline" label={tr ? "Zorluk" : es ? "Dificultad" : pt ? "Dificuldade" : "Difficulty"} value={difficultyLabel} theme={theme} />
        <View style={[styles.detailDivider, { backgroundColor: theme.border }]} />
        <DetailItem icon="albums-outline" label={tr ? "Kaynak" : es ? "Fuente" : pt ? "Fonte" : "Source"} value={sourceLabel} theme={theme} />
        <View style={[styles.detailDivider, { backgroundColor: theme.border }]} />
        <DetailItem icon="time-outline" label={tr ? "Ort. süre" : es ? "Tiempo medio" : pt ? "Tempo médio" : "Avg time"} value={averageMs != null ? `${(averageMs / 1000).toFixed(1)}s` : "–"} theme={theme} />
      </View>

      {/* Günlük: arkadaş sıralaması */}
      {isDaily && dailyBoard && dailyBoard.length > 0 ? (
        <View style={[styles.boardCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <View style={styles.boardHeader}>
            <AppIcon family="Ionicons" name="podium-outline" size={18} color={theme.accent} />
            <Text style={[styles.boardTitle, { color: theme.text.primary }]}>{tr ? "Arkadaşların arasında" : es ? "Entre tus amigos" : pt ? "Entre seus amigos" : "Among your friends"}</Text>
            {myRank > 0 ? (
              <View style={[styles.rankPill, { backgroundColor: alpha(theme.accent, 0.16) }]}>
                <Text style={[styles.rankPillText, { color: theme.accent }]}>#{myRank}</Text>
              </View>
            ) : null}
          </View>
          {dailyBoard.slice(0, 3).map((row, index) => {
            const isSelf = row.uid === user?.uid;
            return (
              <View key={row.uid} style={[styles.boardRow, { borderTopColor: theme.border }, isSelf && { backgroundColor: alpha(theme.accent, 0.1) }]}>
                <Text style={[styles.boardRank, { color: theme.text.muted }]}>{index + 1}</Text>
                <UserAvatar avatarIndex={row.avatarIndex} photoURL={row.photoURL} isCustomPhoto size={30} />
                <Text style={[styles.boardName, { color: theme.text.primary }]} numberOfLines={1}>
                  {isSelf ? (tr ? "Sen" : es ? "Tú" : pt ? "Você" : "You") : row.displayName || (tr ? "Anonim" : es ? "Anónimo" : pt ? "Anônimo" : "Anonymous")}
                </Text>
                <Text style={[styles.boardScore, { color: theme.accent }]}>{row.bestScore}</Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {/* Cevap incelemesi (acilir/kapanir) */}
      {result.sessionHistory?.length ? (
        <View style={[styles.reviewCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={tr ? "Cevapları incele" : es ? "Revisar respuestas" : pt ? "Revisar respostas" : "Review answers"}
            activeOpacity={0.75}
            onPress={() => setReviewExpanded((v) => !v)}
            style={styles.reviewHeader}
          >
            <AppIcon family="Ionicons" name="list-outline" size={18} color={theme.text.secondary} />
            <Text style={[styles.reviewTitle, { color: theme.text.primary }]}>{tr ? "Cevapları İncele" : es ? "Revisar respuestas" : pt ? "Revisar respostas" : "Review Answers"}</Text>
            <View style={[styles.reviewCount, { backgroundColor: theme.primary }]}><Text style={[styles.reviewCountText, { color: theme.text.muted }]}>{result.sessionHistory.length}</Text></View>
            <AppIcon family="Ionicons" name={reviewExpanded ? "chevron-up" : "chevron-down"} size={18} color={theme.text.muted} />
          </TouchableOpacity>

          {reviewExpanded
            ? result.sessionHistory.map((answer, index) => {
                const poster = answer.item?.posterPath ? buildTmdbUrl(answer.item.posterPath, "poster", 185) : null;
                const wrongAnswer = !answer.isCorrect && answer.userAnswer?.title;
                return (
                  <TouchableOpacity
                    key={`${answer.item?.id || "answer"}_${index}`}
                    activeOpacity={0.75}
                    onPress={() => openTitle(answer.item)}
                    style={[styles.reviewRow, { borderTopColor: theme.border }]}
                  >
                    <View style={[styles.reviewPoster, { borderColor: answer.isCorrect ? "#2ECC71" : "#E74C3C", backgroundColor: theme.primary }]}>
                      {poster ? <Image source={{ uri: poster }} style={styles.reviewPosterImg} contentFit="cover" /> : <AppIcon family="Ionicons" name="image-outline" size={18} color={theme.text.muted} />}
                      <View style={[styles.reviewState, { backgroundColor: answer.isCorrect ? "#2ECC71" : "#E74C3C" }]}>
                        <AppIcon family="Ionicons" name={answer.isCorrect ? "checkmark" : "close"} size={11} color="#fff" />
                      </View>
                    </View>
                    <View style={styles.reviewCopy}>
                      <Text style={[styles.reviewName, { color: theme.text.primary }]} numberOfLines={1}>{answer.item?.title || "?"}</Text>
                      {wrongAnswer ? (
                        <Text style={[styles.reviewWrong, { color: theme.text.muted }]} numberOfLines={1}>{(tr ? "Cevabın: " : es ? "Tú: " : pt ? "Você: " : "You: ") + answer.userAnswer.title}</Text>
                      ) : (
                        <Text style={[styles.reviewMeta, { color: theme.text.muted }]} numberOfLines={1}>{Number.isFinite(answer.responseMs) ? `${(answer.responseMs / 1000).toFixed(1)}s` : ""}</Text>
                      )}
                    </View>
                    <View style={styles.reviewRight}>
                      <Text style={[styles.reviewPoints, { color: answer.isCorrect ? "#2ECC71" : theme.text.muted }]}>{answer.isCorrect ? `+${answer.points || 0}` : "0"}</Text>
                      <AppIcon family="Ionicons" name="chevron-forward" size={15} color={theme.text.muted} />
                    </View>
                  </TouchableOpacity>
                );
              })
            : null}
        </View>
      ) : null}

      {/* Kaydetme durumu */}
      {result.saveStatus === "error" ? (
        <TouchableOpacity style={styles.retry} onPress={async () => { setResult((c) => ({ ...c, saveStatus: "saving" })); const saved = await result.retrySave?.(); setResult((c) => ({ ...c, saveStatus: saved ? "saved" : "error" })); }}>
          <AppIcon family="Ionicons" name="cloud-upload-outline" size={18} color="#FF6B6B" />
          <Text style={[styles.retryText, { color: theme.text.secondary }]}>{tr ? "Sonuç kaydedilemedi. Tekrar dene" : es ? "El resultado no se guardó. Inténtalo de nuevo" : pt ? "O resultado não foi salvo. Tente novamente" : "Result was not saved. Try again"}</Text>
        </TouchableOpacity>
      ) : null}
      {result.saveStatus === "saving" ? (
        <View style={styles.retry}><ActivityIndicator size="small" color={theme.accent} /><Text style={[styles.retryText, { color: theme.text.secondary }]}>{tr ? "Sonuç kaydediliyor..." : es ? "Guardando el resultado..." : pt ? "Salvando o resultado..." : "Saving result..."}</Text></View>
      ) : null}

      {/* Aksiyonlar (Part 13.3). Günlük tek deneme: "Tekrar Oyna" yerine sıralama. */}
      {isDaily ? (
        <PressableScale
          accessibilityRole="button"
          onPress={() => navigation.navigate("GameLeaderboardScreen", { gameId: result.gameId, scope: "daily" })}
          style={styles.primaryWrap}
        >
          <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryGradient}>
            <AppIcon family="Ionicons" name="podium-outline" size={19} color="#fff" />
            <Text style={gameSharedStyles.primaryButtonText}>{tr ? "Günlük Sıralamayı Gör" : es ? "Ver la clasificación diaria" : pt ? "Ver o ranking diário" : "View Daily Ranking"}</Text>
          </LinearGradient>
        </PressableScale>
      ) : (
        <PressableScale
          accessibilityRole="button"
          onPress={() => leaveResult("SceneGamePlayScreen", { gameId: result.gameId, modeId: result.modeId, difficultyId: result.difficultyId, sourceId: result.sourceId })}
          style={styles.primaryWrap}
        >
          <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryGradient}>
            <AppIcon family="Ionicons" name="refresh" size={19} color="#fff" />
            <Text style={gameSharedStyles.primaryButtonText}>{tr ? "Tekrar Oyna" : es ? "Jugar otra vez" : pt ? "Jogar de novo" : "Play Again"}</Text>
          </LinearGradient>
        </PressableScale>
      )}

      <View style={styles.actionRow}>
        {!isDaily ? (
          <SecondaryAction icon="options-outline" label={tr ? "Mod Seçimi" : es ? "Elegir modo" : pt ? "Escolher modo" : "Mode Setup"} theme={theme} onPress={() => leaveResult("SceneGameSetupScreen", { gameId: result.gameId, modeId: result.modeId, difficultyId: result.difficultyId, sourceId: result.sourceId })} />
        ) : null}
        <SecondaryAction icon="trophy-outline" label={tr ? "Liderlik" : es ? "Clasificación" : pt ? "Ranking" : "Leaderboard"} theme={theme} onPress={() => navigation.navigate("GameLeaderboardScreen", { gameId: result.gameId })} />
        <SecondaryAction icon={sharing ? null : "share-social-outline"} label={tr ? "Paylaş" : es ? "Compartir" : pt ? "Compartilhar" : "Share"} theme={theme} loading={sharing} onPress={handleShare} />
      </View>

      <TouchableOpacity style={[styles.ghostButton, { borderColor: theme.border }]} onPress={() => leaveResult("GameHubScreen")}>
        <Text style={[styles.ghostText, { color: theme.text.secondary }]}>{tr ? "Oyun Merkezine Dön" : es ? "Volver al centro de juegos" : pt ? "Voltar à central de jogos" : "Back to Game Hub"}</Text>
      </TouchableOpacity>

      {/* Gizli paylasim karti (captureRef hedefi) — spoiler gorsel icermez */}
      <View style={styles.captureHost} pointerEvents="none">
        <View ref={shareCardRef} collapsable={false}>
          <SceneResultShareCard
            width={SHARE_CARD_W}
            height={SHARE_CARD_H}
            accent={theme.accent}
            bold={theme.bold}
            score={result.score || 0}
            scoreLabel={tr ? "Skor" : es ? "Puntuación" : pt ? "Pontuação" : "Score"}
            modeLabel={modeLabel}
            difficultyLabel={difficultyLabel}
            accuracy={accuracy}
            bestStreak={result.bestStreak || 0}
            correct={result.totalCorrect || 0}
            total={totalQuestions}
            brand={gameTitle}
            isNewRecord={Boolean(result.isNewRecord)}
            recordLabel={tr ? "Yeni Rekor" : es ? "Nuevo récord" : pt ? "Novo recorde" : "New Record"}
            labels={{
              accuracy: tr ? "Doğruluk" : es ? "Precisión" : pt ? "Precisão" : "Accuracy",
              correct: tr ? "Doğru" : es ? "Aciertos" : pt ? "Acertos" : "Correct",
              streak: tr ? "En iyi seri" : es ? "Mejor racha" : pt ? "Melhor sequência" : "Best streak",
            }}
          />
        </View>
      </View>
    </GameScreenShell>
  );
}

function Metric({ value, label, color, theme }) {
  return <View style={[gameSharedStyles.metric, { backgroundColor: theme.secondary, borderColor: theme.border }]}><Text style={[gameSharedStyles.metricValue, { color }]}>{value}</Text><Text style={[gameSharedStyles.metricLabel, { color: theme.text.muted }]} numberOfLines={1}>{label}</Text></View>;
}

function DetailItem({ icon, label, value, theme }) {
  return (
    <View style={styles.detailItem}>
      <AppIcon family="Ionicons" name={icon} size={15} color={theme.text.muted} />
      <Text style={[styles.detailValue, { color: theme.text.primary }]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.detailLabel, { color: theme.text.muted }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function SecondaryAction({ icon, label, theme, onPress, loading }) {
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} activeOpacity={0.8} disabled={loading} onPress={onPress} style={[styles.secondaryAction, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      {loading ? <ActivityIndicator size="small" color={theme.accent} /> : <AppIcon family="Ionicons" name={icon} size={20} color={theme.accent} />}
      <Text style={[styles.secondaryActionText, { color: theme.text.secondary }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scoreHero: { minHeight: 214, borderRadius: 28, alignItems: "center", justifyContent: "center", paddingVertical: 20, overflow: "hidden" },
  heroGlowOne: { position: "absolute", width: 220, height: 220, borderRadius: 110, right: -70, top: -90, backgroundColor: "rgba(255,255,255,0.14)" },
  heroGlowTwo: { position: "absolute", width: 140, height: 140, borderRadius: 70, left: -50, bottom: -50, backgroundColor: "rgba(0,0,0,0.14)" },
  verdictPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.24)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  verdictText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  scoreLabel: { color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: "900", letterSpacing: 1.5, marginTop: 14 },
  score: { color: "#FFFFFF", fontSize: 56, fontWeight: "900", marginTop: 2 },
  heroBadges: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap", justifyContent: "center", paddingHorizontal: 12 },
  heroBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.26)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  heroBadgeText: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "900" },

  levelUp: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, borderWidth: 1.5, padding: 12 },
  levelUpIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  levelUpCopy: { flex: 1 },
  levelUpTitle: { fontSize: 14.5, fontWeight: "900" },
  levelUpText: { fontSize: 11, fontWeight: "700", marginTop: 2 },

  dotsCard: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 7, borderRadius: 16, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14 },
  dot: { width: 14, height: 14, borderRadius: 7 },

  detailStrip: { flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: 1, paddingVertical: 12 },
  detailItem: { flex: 1, alignItems: "center", gap: 3, paddingHorizontal: 4 },
  detailValue: { fontSize: 12, fontWeight: "850" },
  detailLabel: { fontSize: 9, fontWeight: "700" },
  detailDivider: { width: StyleSheet.hairlineWidth, height: 36 },

  boardCard: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  boardHeader: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14, minHeight: 50 },
  boardTitle: { flex: 1, fontSize: 14, fontWeight: "850" },
  rankPill: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  rankPillText: { fontSize: 12, fontWeight: "900" },
  boardRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, minHeight: 48, borderTopWidth: StyleSheet.hairlineWidth },
  boardRank: { width: 16, fontSize: 12, fontWeight: "900" },
  boardName: { flex: 1, fontSize: 13, fontWeight: "800" },
  boardScore: { fontSize: 14, fontWeight: "900" },

  reviewCard: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  reviewHeader: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14 },
  reviewTitle: { flex: 1, fontSize: 14, fontWeight: "850" },
  reviewCount: { minWidth: 24, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", paddingHorizontal: 7 },
  reviewCountText: { fontSize: 11, fontWeight: "850" },
  reviewRow: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  reviewPoster: { width: 38, height: 54, borderRadius: 8, borderWidth: 1.5, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  reviewPosterImg: { width: "100%", height: "100%" },
  reviewState: { position: "absolute", right: -3, top: -3, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(0,0,0,0.25)" },
  reviewCopy: { flex: 1 },
  reviewName: { fontSize: 13, fontWeight: "800" },
  reviewWrong: { fontSize: 10, fontWeight: "650", marginTop: 3 },
  reviewMeta: { fontSize: 10, fontWeight: "650", marginTop: 3 },
  reviewRight: { alignItems: "flex-end", flexDirection: "row", gap: 6 },
  reviewPoints: { fontSize: 13, fontWeight: "900" },
  retry: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  retryText: { fontSize: 12, fontWeight: "700" },
  primaryWrap: { borderRadius: 16, overflow: "hidden", marginTop: 4 },
  primaryGradient: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 20 },
  actionRow: { flexDirection: "row", gap: 10 },
  secondaryAction: { flex: 1, minHeight: 64, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 4 },
  secondaryActionText: { fontSize: 11, fontWeight: "800" },
  ghostButton: { minHeight: 48, borderWidth: 1, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  ghostText: { fontSize: 14, fontWeight: "800" },
  missing: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 30 },
  missingText: { textAlign: "center", fontSize: 14, fontWeight: "650" },
  captureHost: { position: "absolute", left: -9999, top: 0, opacity: 0 },
});
