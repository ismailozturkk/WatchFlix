// components/chat/SharedFrameMessage.js
//
// Sohbette paylaşılan GÜNÜN KARESİ sonucu (mesaj kind: "frameShare", gövde utils/chatShare.buildFrameShare).
// Kendi koyu çivit kartı (balon rengi gelen/giden fark etmeden aynı): üstte oyun adı + numara, gönderenin skoru
// ve kararı, altı büyük kutucuk (her kutuda kare numarası). Filmin adı kartta YOK — alıcı henüz oynamamış olabilir.
//
// Alıcı (gelen balon), gün BUGÜNSE:
//   • hiç oynamadıysa → kartın içinde doğrudan "Oyna" düğmesi (DailyFrameScreen)
//   • yarıda bıraktıysa → "Devam et"
//   • bitirdiyse      → "Sen" satırı: kendi skoru + kutucukları (yan yana kıyas)
// Gün geçmişse "Bu günün karesi kapandı". Gönderen kendi kartında eylem görmez. Metinler İZLEYİCİNİN dilinde.
// Premium (registry "daily_frame"): Free alıcı kartı görür, "Oyna" düğmesi elmas simgeli ve yükseltme sayfasını açar.

import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useDailyFrameSummary } from "../../hooks/useDailyFrame";
import { usePremiumGate } from "../../hooks/usePremiumGate";
import { getFrameCopy } from "../../utils/dailyFrameCopy";
import GlassPressable from "../common/GlassPressable";
import { upperText } from "@utils/i18nText";
import { FRAME_CARD_BORDER, FRAME_CARD_PADDING, FRAME_MARK_GAP, frameMarkSize } from "../../utils/chatCardFit";

const COLORS = ["#312E81", "#4338CA", "#6366F1"];
const MARK_COLORS = { miss: "#EF4444", skip: "#94A3B8", hit: "#22C55E", empty: "rgba(255,255,255,0.14)" };
const CARD_WIDTH = 252;
// Tahmin kareleri kartın iç genişliğine yayılır (utils/chatCardFit).
const CARD_PADDING = FRAME_CARD_PADDING;
const CARD_BORDER = FRAME_CARD_BORDER;
const MARK_GAP = FRAME_MARK_GAP;

const scoreOf = (marks, copy) => {
  const hit = marks.indexOf("hit");
  return hit >= 0 ? copy.resultWon(hit + 1) : copy.resultLost;
};

function MarkRow({ marks, size, numbered, label }) {
  return (
    <View style={styles.marks} accessible accessibilityLabel={label}>
      {marks.map((mark, index) => (
        <View key={index} style={[styles.mark, { width: size, height: size, backgroundColor: MARK_COLORS[mark] }]}>
          {numbered ? (
            <Text style={[styles.markNo, mark === "empty" && styles.markNoEmpty]} allowFontScaling={false}>
              {index + 1}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function SharedFrameMessage({ share, isOutgoing = false, cardWidth = CARD_WIDTH }) {
  const { language } = useLanguage();
  const { user } = useAuth() || {};
  const navigation = useNavigation();
  const copy = getFrameCopy(language);
  const mine = useDailyFrameSummary({ uid: user?.uid || null });
  const frameGate = usePremiumGate("daily_frame");
  const locked = !frameGate.allows(0);

  const hit = share.marks.indexOf("hit");
  const verdict = hit >= 0 ? copy.chatWonBy(hit + 1) : copy.chatLostBy;
  const markLabel = (marks) => marks.map((m) => copy.markA11y[m]).join(", ");
  const today = share.dayKey === mine.dayKey;
  const done = mine.status === "won" || mine.status === "lost";
  const open = () => {
    if (locked) {
      frameGate.showUpsell();
      return;
    }
    navigation.navigate("DailyFrameScreen");
  };

  let footer = null;
  if (!isOutgoing) {
    if (!today) {
      footer = (
        <View style={styles.closed}>
          <Ionicons name="lock-closed" size={12} color="rgba(255,255,255,0.7)" />
          <Text style={styles.closedText}>{copy.chatExpired}</Text>
        </View>
      );
    } else if (done && mine.marks) {
      footer = (
        <View style={styles.mine}>
          <View style={styles.mineHead}>
            <Text style={styles.mineLabel} allowFontScaling={false}>
              {copy.chatYou}
            </Text>
            <Text style={styles.mineScore} allowFontScaling={false}>
              {scoreOf(mine.marks, copy)}
            </Text>
          </View>
          <MarkRow marks={mine.marks} size={16} label={markLabel(mine.marks)} />
        </View>
      );
    } else {
      const resume = mine.status === "playing";
      footer = (
        <View style={styles.cta}>
          <Text style={styles.ctaHint} allowFontScaling={false}>
            {resume ? copy.chatInProgress : copy.chatNotPlayed}
          </Text>
          <GlassPressable
            glass={false}
            accessibilityRole="button"
            accessibilityLabel={`${copy.title} #${share.number}. ${resume ? copy.chatResume : copy.chatPlay}`}
            onPress={open}
            style={({ pressed }) => [styles.play, pressed && styles.pressed]}
          >
            <Ionicons name={locked ? "diamond" : "play"} size={15} color={COLORS[1]} />
            <Text allowFontScaling={false} style={styles.playText}>
              {resume ? copy.chatResume : copy.chatPlay}
            </Text>
          </GlassPressable>
        </View>
      );
    }
  }

  return (
    <LinearGradient colors={COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, { width: cardWidth }]}>
      <View pointerEvents="none" style={styles.watermark}>
        <Ionicons name="aperture" size={110} color="rgba(255,255,255,0.07)" />
      </View>

      <View style={styles.header}>
        <View style={styles.tile}>
          <Ionicons name="aperture" size={16} color="#FFFFFF" />
        </View>
        <View style={styles.headerCopy}>
          <Text allowFontScaling={false} numberOfLines={1} style={styles.kicker}>
            {`${upperText(copy.title)} · #${share.number}`}
          </Text>
          <Text numberOfLines={1} style={styles.sub}>
            {share.host || verdict}
          </Text>
        </View>
      </View>

      <View style={styles.scoreRow}>
        <Text allowFontScaling={false} style={styles.score}>
          {scoreOf(share.marks, copy)}
        </Text>
        <Text numberOfLines={2} style={styles.verdict}>
          {verdict}
        </Text>
      </View>

      <MarkRow marks={share.marks} size={frameMarkSize(share.marks.length, cardWidth)} numbered label={markLabel(share.marks)} />

      {footer}
    </LinearGradient>
  );
}

export default memo(SharedFrameMessage);

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    alignSelf: "flex-start",
    borderRadius: 18,
    padding: CARD_PADDING,
    gap: 11,
    overflow: "hidden",
    borderWidth: CARD_BORDER,
    borderColor: "rgba(255,255,255,0.14)",
    marginBottom: 2,
  },
  watermark: { position: "absolute", right: -22, top: -20 },
  header: { flexDirection: "row", alignItems: "center", gap: 9 },
  tile: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.18)" },
  headerCopy: { flex: 1, minWidth: 0 },
  kicker: { color: "#FFFFFF", fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  sub: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "700", marginTop: 1 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  score: { color: "#FFFFFF", fontSize: 30, fontWeight: "900", letterSpacing: -0.5 },
  verdict: { flex: 1, color: "rgba(255,255,255,0.88)", fontSize: 12.5, fontWeight: "700", lineHeight: 16 },
  marks: { flexDirection: "row", gap: MARK_GAP },
  mark: { borderRadius: 7, alignItems: "center", justifyContent: "center" },
  markNo: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  markNoEmpty: { color: "rgba(255,255,255,0.45)" },
  closed: { flexDirection: "row", alignItems: "center", gap: 6 },
  closedText: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "700" },
  mine: { borderRadius: 12, padding: 9, gap: 7, backgroundColor: "rgba(0,0,0,0.22)" },
  mineHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mineLabel: { color: "rgba(255,255,255,0.8)", fontSize: 11.5, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  mineScore: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  cta: { gap: 7 },
  ctaHint: { color: "rgba(255,255,255,0.78)", fontSize: 12, fontWeight: "700" },
  play: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 42,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
  },
  playText: { color: COLORS[1], fontSize: 15, fontWeight: "900" },
  pressed: { opacity: 0.85 },
});
