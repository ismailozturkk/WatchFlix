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
// Gönderen kendi kartında eylem görmez; yalnız 1-1 sohbette rakibin skoru sorgulanır (grupta sorgu yok).
// Metinler İZLEYİCİNİN diliyle (utils/dailyDuelCopy).
//
// Kabul, oyuna düello bağlamını verir (`chatTarget` = bu sohbet, utils/importantInvites.duelContextOf):
// oyun bitince sonuç ekranı iki skoru bu sohbete bir "düello sonucu" kartı olarak yazar ve aynı davetin
// Profil'deki bildirimi de "kabul edildi" olur (`onAccepted`).
//
// KABUL DURUMU: kabul eden mesaja `accepts.{uid}` yazar (ChatScreen.acceptInviteFromCard). İki tarafın kartı
// buna göre değişir:
//   • alıcı   : "Kabul ettin" hapı; oynamadıysa düğme "Oyuna başla" olur
//   • gönderen: "Yanıt bekleniyor" → "Kabul edildi" (grupta "N kişi kabul etti") → 1-1 sohbette rakibin
//               skoru tablodan gelince iki skor yan yana ve "Düello bitti" (utils/dailyDuel.challengeHostView)

import React, { memo, useCallback, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { usePremiumGate } from "../../hooks/usePremiumGate";
import useDuelStatus from "../../hooks/useDuelStatus";
import { ANALYTICS_EVENTS, trackEvent } from "../../services/analytics";
import { intlLocaleOf } from "../../utils/appLanguages";
import { dayKeyOf } from "../../utils/dailyChallenge";
import { challengeAcceptors, challengeHostView, formatDuelScore } from "../../utils/dailyDuel";
import { getDuelCopy } from "../../utils/dailyDuelCopy";
import { dailyDuelRoute, duelContextOf } from "../../utils/importantInvites";
import GlassPressable from "../common/GlassPressable";
import { DUEL_AMBER, DuelStatusChip, DuelVerdict, DuelVersus } from "./DuelVersus";
import { sharePalette } from "./shareKit";

function dayLabel(dayKey, locale) {
  const [y, m, d] = String(dayKey).split("-").map(Number);
  try {
    return new Date(y, m - 1, d).toLocaleDateString(locale, { day: "numeric", month: "short" });
  } catch {
    return dayKey;
  }
}

const verdictTextOf = (copy, verdict, diff) =>
  verdict === "win"
    ? copy.win(formatDuelScore(diff))
    : verdict === "lose"
      ? copy.lose(formatDuelScore(diff))
      : verdict === "tie"
        ? copy.tie
        : null;

function SharedChallengeMessage({ share, isOutgoing = false, senderUid, chatTarget, accepts, onAccepted }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { user } = useAuth() || {};
  const navigation = useNavigation();
  const copy = getDuelCopy(language);
  const palette = useMemo(() => sharePalette({ theme, isOutgoing, accent: DUEL_AMBER }), [theme, isOutgoing]);
  const acceptors = useMemo(() => challengeAcceptors(accepts), [accepts]);

  // Oyunlar Premium'da (Hub'daki Oyunlar modülüyle aynı kural): kilitliyse kabul etmek yükseltme sayfasını açar.
  const gamesGate = usePremiumGate("games");
  const status = useDuelStatus({ share, hostUid: senderUid, enabled: !isOutgoing });
  const { outcome, mine, hostScore, loading } = status;

  // Gönderenin kendi kartı: 1-1 sohbette rakibin skoru (grupta kimin oynadığı belirsiz → yalnız kabul sayısı).
  const rivalUid = isOutgoing && !chatTarget?.groupId ? chatTarget?.friendUid || null : null;
  const rivalStatus = useDuelStatus({ share, hostUid: senderUid, guestUid: rivalUid, enabled: !!rivalUid });
  const rivalName = chatTarget?.friendName || copy.rival;
  const ownScore = rivalStatus.hostScore ?? share.score;
  const hostView = isOutgoing
    ? challengeHostView({
        dayKey: share.dayKey,
        today: dayKeyOf(),
        acceptedCount: acceptors.length,
        rivalScore: rivalUid ? rivalStatus.mine : null,
        hostScore: ownScore,
      })
    : null;
  const acceptedByMe = !isOutgoing && !!user?.uid && acceptors.includes(user.uid);

  const accept = useCallback(() => {
    trackEvent(ANALYTICS_EVENTS.DUEL_ACCEPTED, { locked: !gamesGate.allows(0) });
    if (!gamesGate.allows(0)) {
      gamesGate.showUpsell();
      return;
    }
    onAccepted?.();
    const route = dailyDuelRoute(
      duelContextOf({ dayKey: share.dayKey, hostUid: senderUid, hostName: share.host, chat: chatTarget }),
    );
    navigation.navigate(route.name, route.params);
  }, [gamesGate, navigation, onAccepted, share.dayKey, share.host, senderUid, chatTarget]);

  const title = isOutgoing
    ? hostView.phase === "played" && chatTarget?.friendName
      ? copy.resultTitleOut(chatTarget.friendName)
      : copy.titleOut
    : share.host
      ? copy.titleIn(share.host)
      : copy.titleInAnon;
  const dateText = copy.daily(dayLabel(share.dayKey, intlLocaleOf(language)));

  // Durum hapı.
  let chip = null;
  if (isOutgoing) {
    chip =
      hostView.phase === "played"
        ? { tone: "done", label: copy.statusDone }
        : hostView.phase === "accepted"
          ? { tone: "accepted", label: rivalUid ? copy.statusAccepted : copy.acceptedBy(acceptors.length) }
          : hostView.phase === "expired"
            ? { tone: "expired", label: copy.statusExpired }
            : { tone: "waiting", label: copy.statusWaiting };
  } else if (!loading) {
    chip =
      outcome.phase === "played"
        ? { tone: "done", label: copy.statusDone }
        : acceptedByMe
          ? { tone: "accepted", label: copy.statusYouAccepted }
          : outcome.phase === "expired"
            ? { tone: "expired", label: copy.statusExpired }
            : null;
  }

  // İki taraf yan yana: alıcı oynadıysa; gönderende rakip kabul ettiyse (skoru gelene dek "?").
  let versus = null;
  if (!isOutgoing && outcome.phase === "played" && Number.isFinite(mine) && hostScore != null) {
    versus = {
      left: { label: copy.you, score: mine },
      right: { label: share.host || copy.rival, score: hostScore },
      winner: outcome.verdict === "win" ? "left" : outcome.verdict === "lose" ? "right" : null,
      verdict: outcome.verdict,
      diff: outcome.diff,
    };
  } else if (isOutgoing && rivalUid && (hostView.phase === "played" || hostView.phase === "accepted")) {
    versus = {
      left: { label: copy.you, score: ownScore },
      right: { label: rivalName, score: hostView.phase === "played" ? rivalStatus.mine : null },
      winner: hostView.verdict === "win" ? "left" : hostView.verdict === "lose" ? "right" : null,
      verdict: hostView.verdict,
      diff: hostView.diff,
    };
  }
  const verdictText = versus ? verdictTextOf(copy, versus.verdict, versus.diff) : null;
  const scoreText = (value) => (Number.isFinite(value) ? formatDuelScore(value) : "?");

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

      {chip ? <DuelStatusChip tone={chip.tone} label={chip.label} palette={palette} isOutgoing={isOutgoing} /> : null}

      <Text style={[styles.date, { color: palette.muted }]} numberOfLines={1}>
        {dateText}
      </Text>

      {versus ? (
        <DuelVersus
          left={versus.left}
          right={versus.right}
          winner={versus.winner}
          palette={palette}
          isOutgoing={isOutgoing}
          accessibilityLabel={`${versus.left.label} ${scoreText(versus.left.score)}, ${versus.right.label} ${scoreText(versus.right.score)}`}
        />
      ) : (
        <View style={[styles.scoreBox, { backgroundColor: palette.surface, borderColor: palette.surfaceBorder }]}>
          <Text allowFontScaling={false} style={[styles.score, { color: palette.primary }]}>
            {formatDuelScore(isOutgoing ? ownScore : hostScore ?? share.score)}
          </Text>
          <Text allowFontScaling={false} style={[styles.points, { color: palette.muted }]}>
            {copy.points}
          </Text>
          <Text allowFontScaling={false} style={[styles.correct, { color: palette.secondary }]}>
            {copy.correct(share.correct, share.total)}
          </Text>
        </View>
      )}

      {verdictText ? (
        <DuelVerdict verdict={versus.verdict} text={verdictText} palette={palette} isOutgoing={isOutgoing} />
      ) : null}

      {isOutgoing && rivalUid && hostView.phase === "accepted" ? (
        <Text style={[styles.note, { color: palette.muted }]}>{copy.rivalPlaying(rivalName)}</Text>
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
          accessibilityLabel={acceptedByMe ? copy.play : copy.accept}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          style={[styles.action, { backgroundColor: palette.buttonBg }]}
        >
          <Ionicons name="play" size={15} color={palette.buttonInk} />
          <Text allowFontScaling={false} style={[styles.actionText, { color: palette.buttonInk }]} numberOfLines={1}>
            {acceptedByMe ? copy.play : copy.accept}
          </Text>
        </GlassPressable>
      ) : null}
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

  date: { fontSize: 11.5, fontWeight: "700", marginTop: 6 },

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
