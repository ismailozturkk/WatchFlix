// components/chat/SharedChainMessage.js
//
// Sohbette paylaşılan FİLM ZİNCİRİ meydan okuması (mesaj kind: "chainShare", gövde utils/chatShare.buildChainShare).
// Koyu turkuaz kart (gelen/giden aynı): üstte oyun adı + numara ve davet cümlesi, ortada bulmacanın kendisi
// (başlangıç → hedef, "en kısa N"), altında gönderenin SONUCU — oyuncu / film sayısı ve puan. Zincirin halkaları
// kartta YOK (spoiler): alıcı aynı bulmacayı karttan oynar.
//
// Alıcı (gelen balon):
//   • bu bulmacayı oynamadıysa → "Zinciri kur" (günlük + bugünse günlük modda, değilse serbest modda o bulmaca)
//   • oynadıysa              → "Sen / Arkadaşın" puan kıyası + Kazandın / Geride kaldın / Berabere
//   • bulmaca bu sürümde yoksa → güncelleme notu
// Gönderen kendi kartında eylem görmez. Metinler İZLEYİCİNİN dilinde.

import React, { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { usePremiumGate } from "../../hooks/usePremiumGate";
import { Keys, useStored } from "../../services/storage";
import { dayKeyOf } from "../../utils/dailyChallenge";
import { chainPuzzleById, chainResultOf } from "../../utils/filmChain";
import { getFilmChainCopy } from "../../utils/filmChainCopy";
import { buildTmdbUrl } from "../../utils/tmdbImageUtils";
import GlassPressable from "../common/GlassPressable";

const COLORS = ["#134E4A", "#0F766E", "#14B8A6"];
const GOLD = "#FFD76A";
const CARD_WIDTH = 260;
const AVATAR = 46;

function Person({ person, target }) {
  const uri = buildTmdbUrl(person.profilePath, "profile", AVATAR);
  return (
    <View style={styles.person}>
      <View style={[styles.avatar, target && styles.avatarTarget]}>
        {uri ? (
          <Image source={{ uri }} style={styles.fill} contentFit="cover" />
        ) : (
          <Ionicons name="person" size={20} color="rgba(255,255,255,0.7)" />
        )}
      </View>
      <Text numberOfLines={2} style={styles.personName}>
        {person.name}
      </Text>
    </View>
  );
}

function SharedChainMessage({ share, isOutgoing = false }) {
  const { language } = useLanguage();
  const { user } = useAuth() || {};
  const navigation = useNavigation();
  const copy = getFilmChainCopy(language);
  const chainGate = usePremiumGate("film_chain");
  const raw = useStored(Keys.filmChain, { uid: user?.uid || null });
  const mine = useMemo(() => chainResultOf(raw, share.puzzleId), [raw, share.puzzleId]);
  const known = useMemo(() => !!chainPuzzleById(share.puzzleId), [share.puzzleId]);

  const kicker = share.number ? `${copy.title.toLocaleUpperCase()} · #${share.number}` : copy.title.toLocaleUpperCase();
  const actors = share.links + 1;

  const open = () => {
    // Film Zinciri Premium: Free alıcı kartı görür, "Zinciri kur" yükseltme sayfasını açar.
    if (!chainGate.allows(0)) {
      chainGate.showUpsell();
      return;
    }
    const todayDaily = share.mode === "daily" && share.dayKey === dayKeyOf();
    navigation.navigate("FilmChainScreen", todayDaily ? { mode: "daily" } : { mode: "free", puzzleId: share.puzzleId });
  };

  let footer = null;
  if (isOutgoing) {
    footer = <Text style={styles.note}>{copy.chatWaiting}</Text>;
  } else if (mine) {
    const verdict = mine.points > share.points ? copy.chatWin : mine.points < share.points ? copy.chatLose : copy.chatTie;
    const won = mine.points > share.points;
    footer = (
      <View style={styles.compare}>
        <View style={styles.compareRow}>
          <View style={styles.compareCell}>
            <Text style={styles.compareLabel} allowFontScaling={false}>
              {copy.chatYou}
            </Text>
            <Text style={[styles.comparePoints, won && { color: GOLD }]} allowFontScaling={false}>
              {mine.points}
            </Text>
            <Text style={styles.compareSub} numberOfLines={1}>
              {mine.gaveUp ? copy.chatMineGaveUp : copy.chatMine(mine.links, mine.points)}
            </Text>
          </View>
          <View style={styles.compareDivider} />
          <View style={styles.compareCell}>
            <Text style={styles.compareLabel} allowFontScaling={false} numberOfLines={1}>
              {share.host || copy.chatThem}
            </Text>
            <Text style={styles.comparePoints} allowFontScaling={false}>
              {share.points}
            </Text>
            <Text style={styles.compareSub} numberOfLines={1}>
              {share.gaveUp ? copy.chatHostGaveUp : copy.chatMine(share.links, share.points)}
            </Text>
          </View>
        </View>
        <View style={styles.verdict}>
          <Ionicons name={won ? "trophy" : mine.points === share.points ? "git-compare" : "flag"} size={13} color={won ? GOLD : "#FFFFFF"} />
          <Text style={styles.verdictText}>{verdict}</Text>
        </View>
      </View>
    );
  } else if (!known) {
    footer = (
      <View style={styles.closed}>
        <Ionicons name="cloud-download-outline" size={12} color="rgba(255,255,255,0.75)" />
        <Text style={styles.note}>{copy.chatUnknown}</Text>
      </View>
    );
  } else {
    footer = (
      <GlassPressable
        glass={false}
        accessibilityRole="button"
        accessibilityLabel={`${copy.title}: ${share.start.name} → ${share.target.name}. ${copy.chatPlay}`}
        onPress={open}
        style={({ pressed }) => [styles.play, pressed && styles.pressed]}
      >
        <Ionicons name={chainGate.allows(0) ? "git-network" : "diamond"} size={15} color={COLORS[1]} />
        <Text allowFontScaling={false} style={styles.playText}>
          {copy.chatPlay}
        </Text>
        {chainGate.allows(0) ? null : (
          <Text allowFontScaling={false} style={styles.premiumTag}>
            Premium
          </Text>
        )}
      </GlassPressable>
    );
  }

  return (
    <LinearGradient colors={COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <View pointerEvents="none" style={styles.watermark}>
        <Ionicons name="git-network" size={120} color="rgba(255,255,255,0.07)" />
      </View>

      <View style={styles.header}>
        <View style={styles.tile}>
          <Ionicons name="git-network" size={16} color="#FFFFFF" />
        </View>
        <View style={styles.headerCopy}>
          <Text allowFontScaling={false} numberOfLines={1} style={styles.kicker}>
            {kicker}
          </Text>
          <Text numberOfLines={1} style={styles.sub}>
            {copy.chatInvite(share.host)}
          </Text>
        </View>
      </View>

      <View style={styles.route}>
        <Person person={share.start} />
        <View style={styles.routeMid}>
          <View style={styles.routeLine}>
            <View style={styles.dash} />
            <Ionicons name="help-circle" size={16} color="rgba(255,255,255,0.85)" />
            <View style={styles.dash} />
          </View>
          <View style={styles.parPill}>
            <Text style={styles.parText} allowFontScaling={false} numberOfLines={1}>
              {`${copy.statPar} ${share.par}`}
            </Text>
          </View>
        </View>
        <Person person={share.target} target />
      </View>

      <View style={styles.result}>
        <Text allowFontScaling={false} style={styles.points}>
          {share.points}
        </Text>
        <View style={styles.resultCopy}>
          <Text style={styles.pointsLabel} allowFontScaling={false}>
            {copy.pointsLabel}
          </Text>
          <Text numberOfLines={2} style={styles.resultText}>
            {share.gaveUp ? copy.chatHostGaveUp : copy.chatHostSolved(share.links, actors)}
          </Text>
        </View>
      </View>

      {footer}
    </LinearGradient>
  );
}

export default memo(SharedChainMessage);

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    alignSelf: "flex-start",
    borderRadius: 18,
    padding: 13,
    gap: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    marginBottom: 2,
  },
  fill: { width: "100%", height: "100%" },
  watermark: { position: "absolute", right: -26, top: -24 },
  header: { flexDirection: "row", alignItems: "center", gap: 9 },
  tile: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.18)" },
  headerCopy: { flex: 1, minWidth: 0 },
  kicker: { color: "#FFFFFF", fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  sub: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "700", marginTop: 1 },

  route: { flexDirection: "row", alignItems: "flex-start", borderRadius: 14, paddingVertical: 10, paddingHorizontal: 6, backgroundColor: "rgba(0,0,0,0.2)" },
  person: { width: 76, alignItems: "center", gap: 5 },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.55)",
  },
  avatarTarget: { borderColor: GOLD, borderWidth: 2 },
  personName: { color: "#FFFFFF", fontSize: 11.5, fontWeight: "800", textAlign: "center", lineHeight: 14 },
  routeMid: { flex: 1, alignItems: "center", gap: 6, paddingTop: AVATAR / 2 - 8 },
  routeLine: { flexDirection: "row", alignItems: "center", alignSelf: "stretch", gap: 3 },
  dash: { flex: 1, height: 2, borderRadius: 1, backgroundColor: "rgba(255,255,255,0.45)" },
  parPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.16)" },
  parText: { color: "#FFFFFF", fontSize: 10.5, fontWeight: "900" },

  result: { flexDirection: "row", alignItems: "center", gap: 10 },
  points: { color: "#FFFFFF", fontSize: 34, fontWeight: "900", letterSpacing: -0.5 },
  resultCopy: { flex: 1, minWidth: 0 },
  pointsLabel: { color: "rgba(255,255,255,0.7)", fontSize: 10.5, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" },
  resultText: { color: "rgba(255,255,255,0.92)", fontSize: 12.5, fontWeight: "700", lineHeight: 16, marginTop: 1 },

  note: { flexShrink: 1, color: "rgba(255,255,255,0.75)", fontSize: 11.5, fontWeight: "700", lineHeight: 15 },
  closed: { flexDirection: "row", alignItems: "center", gap: 6 },
  compare: { borderRadius: 12, padding: 10, gap: 8, backgroundColor: "rgba(0,0,0,0.22)" },
  compareRow: { flexDirection: "row", alignItems: "stretch" },
  compareCell: { flex: 1, minWidth: 0, alignItems: "center" },
  compareDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.18)", marginHorizontal: 6 },
  compareLabel: { color: "rgba(255,255,255,0.75)", fontSize: 10.5, fontWeight: "900", letterSpacing: 0.5, textTransform: "uppercase" },
  comparePoints: { color: "#FFFFFF", fontSize: 24, fontWeight: "900" },
  compareSub: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "700" },
  verdict: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  verdictText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
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
  premiumTag: { color: "#FFFFFF", fontSize: 10, fontWeight: "900", overflow: "hidden", borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: COLORS[1] },
  pressed: { opacity: 0.85 },
});
