import { Image } from "expo-image";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import AppIcon from "@components/AppIcon";
import { toast } from "@components/AppToast";
import SceneResultShareCard from "@components/game/SceneResultShareCard";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { i18nText } from "@utils/i18nText";
import { buildTmdbUrl } from "@utils/tmdbImageUtils";
import { GameScreenShell, gameSharedStyles } from "./GameScreenShell";
import {
  getDifficultyConfig,
  getLocalizedGameLabel,
  getModeConfig,
  getSourceConfig,
} from "./gameConfig";
import { deleteGameSessionResult, getGameSessionResult } from "./gameSessionStore";

const SHARE_CARD_W = 320;
const SHARE_CARD_H = 569; // ~9:16

export default function SceneGameResultScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const sessionId = route.params?.sessionId;
  const [result, setResult] = useState(() => getGameSessionResult(sessionId));
  const [reviewExpanded, setReviewExpanded] = useState(false);
  const [sharing, setSharing] = useState(false);
  const shareCardRef = useRef(null);
  const tr = language !== "en";

  useEffect(() => {
    setResult(getGameSessionResult(sessionId));
  }, [sessionId]);

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

  const handleShare = useCallback(async () => {
    if (sharing || !shareCardRef.current) return;
    try {
      setSharing(true);
      await new Promise((r) => requestAnimationFrame(() => r()));
      await new Promise((r) => setTimeout(r, 90));
      const uri = await captureRef(shareCardRef, { format: "png", quality: 1, result: "tmpfile" });
      if (!(await Sharing.isAvailableAsync())) {
        toast.error(tr ? "Paylaşım kullanılamıyor" : "Sharing is unavailable");
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: i18nText("autoI18n.sahne_tahmin_oyunu_title", "Sahne Tahmin"),
      });
    } catch (e) {
      toast.error(tr ? "Paylaşılamadı" : "Could not share", e?.message);
    } finally {
      setSharing(false);
    }
  }, [sharing, tr]);

  if (!result) {
    return (
      <GameScreenShell navigation={navigation} title={tr ? "Oyun Sonucu" : "Game Result"} scroll={false}>
        <View style={styles.missing}>
          <AppIcon family="Ionicons" name="alert-circle-outline" size={42} color={theme.text.muted} />
          <Text style={[styles.missingText, { color: theme.text.secondary }]}>{tr ? "Bu oturumun sonucu artık kullanılamıyor." : "This session result is no longer available."}</Text>
          <TouchableOpacity style={[gameSharedStyles.primaryButton, { backgroundColor: theme.accent, alignSelf: "stretch", marginHorizontal: 24 }]} onPress={() => navigation.navigate("GameHubScreen")}>
            <Text style={gameSharedStyles.primaryButtonText}>{tr ? "Oyun Merkezine Dön" : "Back to Game Hub"}</Text>
          </TouchableOpacity>
        </View>
      </GameScreenShell>
    );
  }

  const outcomeLabel =
    result.outcome === "failed"
      ? (tr ? "Oyun bitti" : "Game over")
      : result.outcome === "quit"
        ? (tr ? "Yarıda bitirildi" : "Ended early")
        : (tr ? "Tamamlandı" : "Completed");

  return (
    <GameScreenShell navigation={navigation} onBack={() => leaveResult("GameHubScreen")} title={tr ? "Oyun Sonucu" : "Game Result"} subtitle={`${modeLabel} · ${outcomeLabel}`}>
      {/* Hero skor */}
      <View style={[styles.scoreHero, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        <View style={styles.trophy}><AppIcon family="Ionicons" name="trophy" size={32} color="#E8B931" /></View>
        <Text style={[styles.scoreLabel, { color: theme.text.muted }]}>{tr ? "TOPLAM SKOR" : "TOTAL SCORE"}</Text>
        <Text style={[styles.score, { color: theme.text.primary }]}>{result.score || 0}</Text>
        <View style={styles.heroBadges}>
          {result.isNewRecord ? (
            <View style={[styles.heroBadge, { backgroundColor: "rgba(232,185,49,0.16)", borderColor: "rgba(232,185,49,0.45)" }]}>
              <AppIcon family="Ionicons" name="ribbon" size={13} color="#E8B931" />
              <Text style={[styles.heroBadgeText, { color: "#E8B931" }]}>{tr ? "Yeni Rekor!" : "New Record!"}</Text>
            </View>
          ) : null}
          {result.xpEarned ? (
            <View style={[styles.heroBadge, { backgroundColor: `${theme.accent}1A`, borderColor: `${theme.accent}55` }]}>
              <AppIcon family="Ionicons" name="sparkles" size={13} color={theme.accent} />
              <Text style={[styles.heroBadgeText, { color: theme.accent }]}>+{result.xpEarned} XP</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Ana metrikler */}
      <View style={gameSharedStyles.metricRow}>
        <Metric value={`${result.totalCorrect || 0}/${totalQuestions}`} label={tr ? "Doğru" : "Correct"} color="#2ECC71" theme={theme} />
        <Metric value={`${accuracy}%`} label={tr ? "Doğruluk" : "Accuracy"} color={theme.accent} theme={theme} />
        <Metric value={result.bestStreak || 0} label={tr ? "En iyi seri" : "Best streak"} color="#FF6B6B" theme={theme} />
      </View>

      {/* Ayrinti seridi: zorluk · kaynak · ortalama sure */}
      <View style={[styles.detailStrip, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
        <DetailItem icon="speedometer-outline" label={tr ? "Zorluk" : "Difficulty"} value={difficultyLabel} theme={theme} />
        <View style={[styles.detailDivider, { backgroundColor: theme.border }]} />
        <DetailItem icon="albums-outline" label={tr ? "Kaynak" : "Source"} value={sourceLabel} theme={theme} />
        <View style={[styles.detailDivider, { backgroundColor: theme.border }]} />
        <DetailItem icon="time-outline" label={tr ? "Ort. süre" : "Avg time"} value={averageMs != null ? `${(averageMs / 1000).toFixed(1)}s` : "–"} theme={theme} />
      </View>

      {/* Cevap incelemesi (acilir/kapanir) */}
      {result.sessionHistory?.length ? (
        <View style={[styles.reviewCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={tr ? "Cevapları incele" : "Review answers"}
            activeOpacity={0.75}
            onPress={() => setReviewExpanded((v) => !v)}
            style={styles.reviewHeader}
          >
            <AppIcon family="Ionicons" name="list-outline" size={18} color={theme.text.secondary} />
            <Text style={[styles.reviewTitle, { color: theme.text.primary }]}>{tr ? "Cevapları İncele" : "Review Answers"}</Text>
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
                        <Text style={[styles.reviewWrong, { color: theme.text.muted }]} numberOfLines={1}>{(tr ? "Cevabın: " : "You: ") + answer.userAnswer.title}</Text>
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
          <Text style={[styles.retryText, { color: theme.text.secondary }]}>{tr ? "Sonuç kaydedilemedi. Tekrar dene" : "Result was not saved. Try again"}</Text>
        </TouchableOpacity>
      ) : null}
      {result.saveStatus === "saving" ? (
        <View style={styles.retry}><ActivityIndicator size="small" color={theme.accent} /><Text style={[styles.retryText, { color: theme.text.secondary }]}>{tr ? "Sonuç kaydediliyor..." : "Saving result..."}</Text></View>
      ) : null}

      {/* Aksiyonlar (Part 13.3) */}
      <TouchableOpacity style={[gameSharedStyles.primaryButton, { backgroundColor: theme.accent, marginTop: 4 }]} onPress={() => leaveResult("SceneGamePlayScreen", { gameId: result.gameId, modeId: result.modeId, difficultyId: result.difficultyId, sourceId: result.sourceId })}>
        <AppIcon family="Ionicons" name="refresh" size={19} color="#fff" />
        <Text style={gameSharedStyles.primaryButtonText}>{tr ? "Tekrar Oyna" : "Play Again"}</Text>
      </TouchableOpacity>

      <View style={styles.actionRow}>
        <SecondaryAction icon="options-outline" label={tr ? "Mod Seçimi" : "Mode Setup"} theme={theme} onPress={() => leaveResult("SceneGameSetupScreen", { gameId: result.gameId, modeId: result.modeId, difficultyId: result.difficultyId, sourceId: result.sourceId })} />
        <SecondaryAction icon="trophy-outline" label={tr ? "Liderlik" : "Leaderboard"} theme={theme} onPress={() => navigation.navigate("GameLeaderboardScreen", { gameId: result.gameId })} />
        <SecondaryAction icon={sharing ? null : "share-social-outline"} label={tr ? "Paylaş" : "Share"} theme={theme} loading={sharing} onPress={handleShare} />
      </View>

      <TouchableOpacity style={[styles.ghostButton, { borderColor: theme.border }]} onPress={() => leaveResult("GameHubScreen")}>
        <Text style={[styles.ghostText, { color: theme.text.secondary }]}>{tr ? "Oyun Merkezine Dön" : "Back to Game Hub"}</Text>
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
            scoreLabel={tr ? "Skor" : "Score"}
            modeLabel={modeLabel}
            difficultyLabel={difficultyLabel}
            accuracy={accuracy}
            bestStreak={result.bestStreak || 0}
            correct={result.totalCorrect || 0}
            total={totalQuestions}
            brand={i18nText("autoI18n.sahne_tahmin_oyunu_title", "Sahne Tahmin")}
            isNewRecord={Boolean(result.isNewRecord)}
            recordLabel={tr ? "Yeni Rekor" : "New Record"}
            labels={{
              accuracy: tr ? "Doğruluk" : "Accuracy",
              correct: tr ? "Doğru" : "Correct",
              streak: tr ? "En iyi seri" : "Best streak",
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
  scoreHero: { minHeight: 196, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingVertical: 18 },
  trophy: { width: 58, height: 58, borderRadius: 20, backgroundColor: "rgba(232,185,49,0.14)", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  scoreLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  score: { fontSize: 48, fontWeight: "900", marginTop: 2 },
  heroBadges: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap", justifyContent: "center" },
  heroBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  heroBadgeText: { fontSize: 13, fontWeight: "900" },
  detailStrip: { flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: 1, paddingVertical: 12 },
  detailItem: { flex: 1, alignItems: "center", gap: 3, paddingHorizontal: 4 },
  detailValue: { fontSize: 12, fontWeight: "850" },
  detailLabel: { fontSize: 9, fontWeight: "700" },
  detailDivider: { width: StyleSheet.hairlineWidth, height: 36 },
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
  actionRow: { flexDirection: "row", gap: 10 },
  secondaryAction: { flex: 1, minHeight: 64, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 4 },
  secondaryActionText: { fontSize: 11, fontWeight: "800" },
  ghostButton: { minHeight: 48, borderWidth: 1, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  ghostText: { fontSize: 14, fontWeight: "800" },
  missing: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 30 },
  missingText: { textAlign: "center", fontSize: 14, fontWeight: "650" },
  captureHost: { position: "absolute", left: -9999, top: 0, opacity: 0 },
});
