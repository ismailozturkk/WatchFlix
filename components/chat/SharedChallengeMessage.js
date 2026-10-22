// components/chat/SharedChallengeMessage.js
//
// Sohbette paylaşılan GÜNLÜK DÜELLO kartının gövdesi (mesaj kind: "challengeShare", bkz. utils/chatShare.js):
// gönderenin adı, büyük skor, doğru sayısı ve — alıcı için — duruma göre bir eylem:
//   • bugün + alıcı henüz oynamadı  → "Meydan okumayı kabul et" (günlük oyunu başlatır)
//   • alıcı o günü oynamış          → iki skor yan yana + kazandın / geride kaldın / berabere
//   • gün geçmiş + oynamamış        → yalnız gönderenin skoru ve "artık oynanamıyor"
//
// Karttaki skor gönderenin cihazında yazıldığı için karşılaştırmada GÜVENİLMEZ; iki tarafın skoru günlük
// tablodan okunur (hooks/useDuelStatus). Tablo okunamazsa karttaki skor gösterilir ve karşılaştırma yapılmaz.
//
// Gönderen kendi kartında eylem/sorgu görmez. Metinler ALICININ diliyle (utils/dailyDuelCopy).

import React, { memo, useCallback, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { usePremiumGate } from "../../hooks/usePremiumGate";
import useDuelStatus from "../../hooks/useDuelStatus";
import { ANALYTICS_EVENTS, trackEvent } from "../../services/analytics";
import { intlLocaleOf } from "../../utils/appLanguages";
import { DAILY_MODE_ID, DAILY_SOURCE_ID } from "../../utils/dailyChallenge";
import { formatDuelScore } from "../../utils/dailyDuel";
import { getDuelCopy } from "../../utils/dailyDuelCopy";
import { SCENE_GAME_ID } from "../../screens/game/gameConfig";
import GlassPressable from "../common/GlassPressable";
import { sharePalette } from "./shareKit";

// Günlük meydan okumanın kimlik rengi (turuncu/altın: Hub'daki günlük kartla aynı sıcaklık).
const AMBER = "#F59E0B";
const WIN = "#22C55E";
const LOSE = "#EF4444";

function dayLabel(dayKey, locale) {
  const [y, m, d] = String(dayKey).split("-").map(Number);
  try {
    return new Date(y, m - 1, d).toLocaleDateString(locale, { day: "numeric", month: "short" });
  } catch {
    return dayKey;
  }
}

function SharedChallengeMessage({ share, isOutgoing = false, senderUid }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const navigation = useNavigation();
  const copy = getDuelCopy(language);
  const palette = useMemo(() => sharePalette({ theme, isOutgoing, accent: AMBER }), [theme, isOutgoing]);

  // Oyunlar Premium'da (Hub'daki Oyunlar modülüyle aynı kural): kilitliyse kabul etmek yükseltme sayfasını açar.
  const gamesGate = usePremiumGate("games");
  const status = useDuelStatus({ share, hostUid: senderUid, enabled: !isOutgoing });
  const { outcome, mine, hostScore, loading } = status;

  const accept = useCallback(() => {
    trackEvent(ANALYTICS_EVENTS.DUEL_ACCEPTED, { locked: !gamesGate.allows(0) });
    if (!gamesGate.allows(0)) {
      gamesGate.showUpsell();
      return;
    }
    navigation.navigate("SceneGamePlayScreen", {
      gameId: SCENE_GAME_ID,
      modeId: DAILY_MODE_ID,
      difficultyId: "normal",
      sourceId: DAILY_SOURCE_ID,
    });
  }, [gamesGate, navigation]);

  const title = isOutgoing
    ? copy.titleOut
    : share.host
      ? copy.titleIn(share.host)
      : copy.titleInAnon;
  const dateText = copy.daily(dayLabel(share.dayKey, intlLocaleOf(language)));
  const showCompare = !isOutgoing && outcome.phase === "played" && Number.isFinite(mine) && hostScore != null;
  const verdictColor = outcome.verdict === "win" ? WIN : outcome.verdict === "lose" ? LOSE : AMBER;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={[styles.tile, { backgroundColor: palette.tile }]}>
          <Ionicons name="flash" size={17} color={palette.tileInk} />
        </View>
        <View style={styles.headerCopy}>
          <Text allowFontScaling={false} style={[styles.kicker, { color: palette.tileInk }]} numberOfLines={1}>
            {copy.kicker}
          </Text>
          <Text style={[styles.title, { color: palette.primary }]} numberOfLines={2}>
            {title}
          </Text>
        </View>
      </View>

      <Text style={[styles.date, { color: palette.muted }]} numberOfLines={1}>
        {dateText}
      </Text>

      {showCompare ? (
        <View style={styles.versus} accessible accessibilityLabel={`${copy.you} ${mine}, ${copy.rival} ${hostScore}`}>
          <Side label={copy.you} score={mine} palette={palette} strong={outcome.verdict === "win"} />
          <Text allowFontScaling={false} style={[styles.vs, { color: palette.muted }]}>
            VS
          </Text>
          <Side label={share.host || copy.rival} score={hostScore} palette={palette} strong={outcome.verdict === "lose"} />
        </View>
      ) : (
        <View style={[styles.scoreBox, { backgroundColor: palette.surface, borderColor: palette.surfaceBorder }]}>
          <Text allowFontScaling={false} style={[styles.score, { color: palette.primary }]}>
            {formatDuelScore(hostScore ?? share.score)}
          </Text>
          <Text allowFontScaling={false} style={[styles.points, { color: palette.muted }]}>
            {copy.points}
          </Text>
          <Text allowFontScaling={false} style={[styles.correct, { color: palette.secondary }]}>
            {copy.correct(share.correct, share.total)}
          </Text>
        </View>
      )}

      {showCompare ? (
        <View style={[styles.verdict, { borderColor: isOutgoing ? palette.surfaceBorder : verdictColor }]}>
          <Ionicons
            name={outcome.verdict === "win" ? "trophy" : outcome.verdict === "lose" ? "trending-down" : "remove-circle"}
            size={15}
            color={isOutgoing ? palette.primary : verdictColor}
          />
          <Text allowFontScaling={false} style={[styles.verdictText, { color: palette.primary }]} numberOfLines={2}>
            {outcome.verdict === "win"
              ? copy.win(formatDuelScore(outcome.diff))
              : outcome.verdict === "lose"
                ? copy.lose(formatDuelScore(outcome.diff))
                : copy.tie}
          </Text>
        </View>
      ) : null}

      {!isOutgoing && loading ? (
        <Text style={[styles.note, { color: palette.muted }]}>{copy.checking}</Text>
      ) : null}

      {!isOutgoing && !loading && outcome.phase === "expired" ? (
        <Text style={[styles.note, { color: palette.muted }]}>{copy.expired}</Text>
      ) : null}

      {!isOutgoing && !loading && outcome.phase === "open" ? (
        <GlassPressable
          onPress={accept}
          accessibilityRole="button"
          accessibilityLabel={copy.accept}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          style={[styles.action, { backgroundColor: palette.buttonBg }]}
        >
          <Ionicons name="play" size={15} color={palette.buttonInk} />
          <Text allowFontScaling={false} style={[styles.actionText, { color: palette.buttonInk }]} numberOfLines={1}>
            {copy.accept}
          </Text>
        </GlassPressable>
      ) : null}
    </View>
  );
}

function Side({ label, score, palette, strong }) {
  return (
    <View style={styles.side}>
      <Text allowFontScaling={false} style={[styles.sideLabel, { color: palette.muted }]} numberOfLines={1}>
        {label}
      </Text>
      <Text
        allowFontScaling={false}
        style={[styles.sideScore, { color: palette.primary }, strong ? styles.sideScoreStrong : null]}
        numberOfLines={1}
      >
        {formatDuelScore(score)}
      </Text>
    </View>
  );
}

export default memo(SharedChallengeMessage);

const styles = StyleSheet.create({
  wrap: { alignSelf: "flex-start", width: 240, marginBottom: 2 },

  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  tile: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0 },
  kicker: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.8 },
  title: { fontSize: 15, fontWeight: "900", lineHeight: 19, marginTop: 1 },

  date: { fontSize: 11.5, fontWeight: "700", marginTop: 8 },

  scoreBox: {
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  score: { fontSize: 34, fontWeight: "900", lineHeight: 40, letterSpacing: -0.5 },
  points: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase", marginTop: -2 },
  correct: { fontSize: 12, fontWeight: "700", marginTop: 4 },

  versus: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 6 },
  side: { flex: 1, alignItems: "center", minWidth: 0 },
  sideLabel: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.4 },
  sideScore: { fontSize: 26, fontWeight: "800", lineHeight: 32 },
  sideScoreStrong: { fontWeight: "900", fontSize: 30, lineHeight: 36 },
  vs: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },

  verdict: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  verdictText: { fontSize: 12.5, fontWeight: "800", flexShrink: 1, textAlign: "center" },

  note: { fontSize: 12, fontWeight: "600", lineHeight: 16, marginTop: 10 },

  action: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 38,
    marginTop: 12,
    paddingHorizontal: 10,
    borderRadius: 19,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  actionText: { fontSize: 13, fontWeight: "800", flexShrink: 1 },
});
