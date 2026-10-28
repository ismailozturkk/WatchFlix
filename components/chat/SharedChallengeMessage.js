// components/chat/SharedChallengeMessage.js
//
// Sohbette paylaşılan GÜNLÜK DÜELLO kartının gövdesi (mesaj kind: "challengeShare", bkz. utils/chatShare.js):
// gönderenin adı, büyük skor, doğru sayısı ve — alıcı için — duruma göre bir eylem:
//   • bugün + alıcı henüz oynamadı  → [Reddet] [Kabul et] (kabul günlük oyunu başlatır)
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
// Profil'deki bildirimi de "kabul edildi" olur (`onAccepted`). Ret (`onDeclined`) bildirimi "reddedildi" yapar.
//
// YANIT DURUMU: alıcı mesaja `accepts.{uid}` ya da `declines.{uid}` yazar (ChatScreen.answerInviteFromCard;
// Profil'deki önemli davetler çubuğundan yanıt da aynı mesaja yazılır — utils/chatInvites). İki tarafın kartı
// buna göre değişir:
//   • alıcı   : yanıtsızsa [Reddet] [Kabul et]; kabul ettiyse "Kabul ettin" hapı ve "Oyuna başla";
//               reddettiyse "Reddettin" hapı, düğme ve skor sorgusu yok
//   • gönderen: "Yanıt bekleniyor" → "Kabul edildi" / "Reddedildi" (grupta "N kişi kabul etti" /
//               "N kişi reddetti") → 1-1 sohbette rakibin skoru tablodan gelince iki skor yan yana ve
//               "Düello bitti" (utils/dailyDuel.challengeHostView)

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
import { myInviteResponse } from "../../utils/chatInvites";
import { dayKeyOf } from "../../utils/dailyChallenge";
import { challengeAcceptors, challengeHostView, formatDuelScore } from "../../utils/dailyDuel";
import { getDuelCopy } from "../../utils/dailyDuelCopy";
import { dailyDuelRoute, duelContextOf } from "../../utils/importantInvites";
import { DUEL_AMBER, DuelStatusChip, DuelVerdict, DuelVersus } from "./DuelVersus";
import InviteActions from "./InviteActions";
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

function SharedChallengeMessage({
  share,
  isOutgoing = false,
  senderUid,
  chatTarget,
  accepts,
  declines,
  onAccepted,
  onDeclined,
}) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { user } = useAuth() || {};
  const navigation = useNavigation();
  const copy = getDuelCopy(language);
  const palette = useMemo(() => sharePalette({ theme, isOutgoing, accent: DUEL_AMBER }), [theme, isOutgoing]);
  const acceptors = useMemo(() => challengeAcceptors(accepts), [accepts]);
  const decliners = useMemo(() => challengeAcceptors(declines), [declines]);
  const myResponse = isOutgoing ? null : myInviteResponse({ accepts, declines, uid: user?.uid });
  const acceptedByMe = myResponse === "accepted";
  const declinedByMe = myResponse === "declined";

  // Oyunlar Premium'da (Hub'daki Oyunlar modülüyle aynı kural): kilitliyse kabul etmek yükseltme sayfasını açar.
  // Reddedilen meydan okumada skor sorulmaz: kart "Reddettin"de kalır.
  const gamesGate = usePremiumGate("games");
  const status = useDuelStatus({ share, hostUid: senderUid, enabled: !isOutgoing && !declinedByMe });
  const { outcome, mine, hostScore, loading } = status;

  // Gönderenin kendi kartı: 1-1 sohbette rakibin skoru (grupta kimin oynadığı belirsiz → yalnız yanıt sayıları).
  const rivalUid = isOutgoing && !chatTarget?.groupId ? chatTarget?.friendUid || null : null;
  const rivalDeclined = !!rivalUid && decliners.includes(rivalUid) && !acceptors.includes(rivalUid);
  const rivalStatus = useDuelStatus({ share, hostUid: senderUid, guestUid: rivalUid, enabled: !!rivalUid && !rivalDeclined });
  const rivalName = chatTarget?.friendName || copy.rival;
  const ownScore = rivalStatus.hostScore ?? share.score;
  const hostView = isOutgoing
    ? challengeHostView({
        dayKey: share.dayKey,
        today: dayKeyOf(),
        acceptedCount: rivalUid ? (acceptors.includes(rivalUid) ? 1 : 0) : acceptors.length,
        declinedCount: rivalUid ? (rivalDeclined ? 1 : 0) : decliners.length,
        rivalScore: rivalUid && !rivalDeclined ? rivalStatus.mine : null,
        hostScore: ownScore,
      })
    : null;

  const accept = useCallback(() => {
    trackEvent(ANALYTICS_EVENTS.DUEL_ACCEPTED, { locked: !gamesGate.allows(0) });
    if (!gamesGate.allows(0)) {
      gamesGate.showUpsell();
      return;
    }
    // Zaten kabul edildiyse (çubuktan ya da önceki basış) yanıt yeniden yazılmaz; yalnız oyun açılır.
    if (!acceptedByMe) onAccepted?.();
    const route = dailyDuelRoute(
      duelContextOf({ dayKey: share.dayKey, hostUid: senderUid, hostName: share.host, chat: chatTarget }),
    );
    navigation.navigate(route.name, route.params);
  }, [gamesGate, navigation, onAccepted, acceptedByMe, share.dayKey, share.host, senderUid, chatTarget]);

  const title = isOutgoing
    ? hostView.phase === "played" && chatTarget?.friendName
      ? copy.resultTitleOut(chatTarget.friendName)
      : copy.titleOut
    : share.host
      ? copy.titleIn(share.host)
      : copy.titleInAnon;
  const dateText = copy.daily(dayLabel(share.dayKey, intlLocaleOf(language)));

  const decline = useCallback(() => {
    onDeclined?.();
  }, [onDeclined]);

  // Durum hapı.
  let chip = null;
  if (isOutgoing) {
    chip =
      hostView.phase === "played"
        ? { tone: "done", label: copy.statusDone }
        : hostView.phase === "accepted"
          ? { tone: "accepted", label: rivalUid ? copy.statusAccepted : copy.acceptedBy(acceptors.length) }
          : hostView.phase === "declined"
            ? { tone: "declined", label: rivalUid ? copy.statusDeclined : copy.declinedBy(decliners.length) }
            : hostView.phase === "expired"
              ? { tone: "expired", label: copy.statusExpired }
              : { tone: "waiting", label: copy.statusWaiting };
  } else if (declinedByMe) {
    chip = { tone: "declined", label: copy.statusYouDeclined };
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
  // Grupta hem kabul hem ret varsa hap kabulü gösterir; ret sayısı altta not olarak kalır.
  const groupDeclinedNote =
    isOutgoing && !rivalUid && hostView.phase === "accepted" && decliners.length > 0 ? copy.declinedBy(decliners.length) : null;

  // İki taraf yan yana: alıcı oynadıysa; gönderende rakip kabul ettiyse (skoru gelene dek "?").
  let versus = null;
  if (!isOutgoing && !declinedByMe && outcome.phase === "played" && Number.isFinite(mine) && hostScore != null) {
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

      {groupDeclinedNote ? <Text style={[styles.note, { color: palette.muted }]}>{groupDeclinedNote}</Text> : null}

      {!isOutgoing && loading ? (
        <Text style={[styles.note, { color: palette.muted }]}>{copy.checking}</Text>
      ) : null}

      {!isOutgoing && !declinedByMe && !loading && outcome.phase === "expired" ? (
        <Text style={[styles.note, { color: palette.muted }]}>{copy.expired}</Text>
      ) : null}

      {!isOutgoing && !declinedByMe && !loading && outcome.phase === "open" ? (
        <InviteActions
          palette={palette}
          accept={
            acceptedByMe
              ? { label: copy.play, icon: "play", onPress: accept }
              : { label: copy.acceptShort, a11y: copy.accept, icon: "play", onPress: accept }
          }
          decline={!acceptedByMe && onDeclined ? { label: copy.decline, a11y: copy.declineA11y, onPress: decline } : null}
        />
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
});
