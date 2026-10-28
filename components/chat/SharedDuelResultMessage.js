// components/chat/SharedDuelResultMessage.js
//
// Kabul edilen günlük düellonun SONUÇ kartı (mesaj kind: "duelResultShare", bkz. utils/chatShare.js).
// Kabul eden oyunu bitirince sonuç ekranı bu kartı davetin geldiği sohbete yazar
// (hooks/useDuelResultReport); böylece meydan okuyan da iki skoru sohbette görür.
//
//   • İzleyici kendi skorunu SOLDA görür ve kazandın / geride kaldın / berabere satırı onun gözünden.
//   • Grupta üçüncü kişi: "kabul eden – meydan okuyan" ve "X kazandı · N puan fark".
//
// Karttaki skorlar gönderenin cihazında yazıldığı için ilk görünümdür; iki tarafın skoru günlük tablodan
// (services/dailyDuelService) yeniden okunur ve doğrulanan değer karttakini ezer. Okunamazsa kart değeri kalır.
// Metinler İZLEYİCİNİN diliyle (utils/dailyDuelCopy).

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { loadDuelScores, notifyDuelScores } from "../../services/dailyDuelService";
import { intlLocaleOf } from "../../utils/appLanguages";
import { duelResultView, formatDuelScore } from "../../utils/dailyDuel";
import { getDuelCopy } from "../../utils/dailyDuelCopy";
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

const announced = new Set(); // "gün|kabul eden" — notifyDuelScores bir kez

/** Tablodan iki tarafın doğrulanmış skoru; ekrana her odaklanışta tazelenir. */
function useVerifiedScores({ dayKey, guestUid, hostUid }) {
  const [scores, setScores] = useState({ guest: null, host: null });
  const alive = useRef(true);
  useFocusEffect(
    useCallback(() => {
      alive.current = true;
      if (!dayKey || !guestUid || !hostUid) return undefined;
      loadDuelScores({ dayKey, myUid: guestUid, hostUid })
        .then((rows) => {
          if (alive.current) setScores({ guest: rows.mine, host: rows.host });
        })
        .catch(() => {});
      return () => {
        alive.current = false;
      };
    }, [dayKey, guestUid, hostUid]),
  );
  return scores;
}

function SharedDuelResultMessage({ share, isOutgoing = false, senderUid, senderName }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { user } = useAuth() || {};
  const copy = getDuelCopy(language);
  const palette = useMemo(() => sharePalette({ theme, isOutgoing, accent: DUEL_AMBER }), [theme, isOutgoing]);

  // Aynı günün meydan okuma kartı (özellikle meydan okuyanın kendi kartı) rakibin skorunu yeniden okusun.
  // Liste kaydırılırken kart tekrar tekrar bağlanır: her sonuç oturumda bir kez duyurulur.
  useEffect(() => {
    const key = `${share.dayKey}|${senderUid}`;
    if (announced.has(key)) return;
    announced.add(key);
    notifyDuelScores(share.dayKey);
  }, [share.dayKey, senderUid]);

  const verified = useVerifiedScores({ dayKey: share.dayKey, guestUid: senderUid, hostUid: share.hostUid });
  const guestScore = Number.isFinite(verified.guest) ? verified.guest : share.guestScore;
  const hostScore = Number.isFinite(verified.host) ? verified.host : share.hostScore;
  const view = duelResultView({
    viewerUid: user?.uid,
    guestUid: senderUid,
    hostUid: share.hostUid,
    guestScore,
    hostScore,
  });

  const guestName = share.guest || senderName || copy.rival;
  const hostName = share.host || copy.rival;
  const nameOf = (side) => (side === view.role ? copy.you : side === "guest" ? guestName : hostName);
  const title =
    view.role === "guest"
      ? copy.resultTitleOut(hostName)
      : view.role === "host"
        ? copy.resultTitleHost(guestName)
        : copy.resultTitleOther(guestName, hostName);
  const diff = formatDuelScore(view.diff);
  const verdictText =
    view.verdict === "win"
      ? copy.win(diff)
      : view.verdict === "lose"
        ? copy.lose(diff)
        : view.verdict === "tie"
          ? copy.tie
          : view.verdict === "decided"
            ? copy.leads(view.winner === "guest" ? guestName : hostName, diff)
            : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={[styles.tile, { backgroundColor: palette.tile }]}>
          <Ionicons name="trophy" size={17} color={palette.tileInk} />
        </View>
        <View style={styles.headerCopy}>
          <Text allowFontScaling={false} style={[styles.kicker, { color: palette.tileInk }]} numberOfLines={1}>
            {copy.resultKicker}
          </Text>
          <Text style={[styles.title, { color: palette.primary }]} numberOfLines={2}>
            {title}
          </Text>
        </View>
      </View>

      <DuelStatusChip tone="done" label={copy.statusDone} palette={palette} isOutgoing={isOutgoing} />

      <Text style={[styles.date, { color: palette.muted }]} numberOfLines={1}>
        {copy.daily(dayLabel(share.dayKey, intlLocaleOf(language)))}
      </Text>

      <DuelVersus
        left={{ label: nameOf(view.left.side), score: view.left.score }}
        right={{ label: nameOf(view.right.side), score: view.right.score }}
        winner={view.winner ? (view.winner === view.left.side ? "left" : "right") : null}
        palette={palette}
        isOutgoing={isOutgoing}
        accessibilityLabel={`${nameOf(view.left.side)} ${view.left.score ?? "?"}, ${nameOf(view.right.side)} ${view.right.score ?? "?"}`}
      />

      <Text allowFontScaling={false} style={[styles.correct, { color: palette.secondary }]} numberOfLines={1}>
        {`${guestName}: ${copy.correct(share.correct, share.total)}`}
      </Text>

      {verdictText ? (
        <DuelVerdict verdict={view.verdict} text={verdictText} palette={palette} isOutgoing={isOutgoing} />
      ) : null}
    </View>
  );
}

export default memo(SharedDuelResultMessage);

const styles = StyleSheet.create({
  wrap: { alignSelf: "flex-start", width: 240, marginBottom: 2 },

  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  tile: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0 },
  kicker: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.8 },
  title: { fontSize: 15, fontWeight: "900", lineHeight: 19, marginTop: 1 },

  date: { fontSize: 11.5, fontWeight: "700", marginTop: 6 },

  correct: { fontSize: 11.5, fontWeight: "700", marginTop: 6, textAlign: "center" },
});
