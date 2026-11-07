// components/chat/SharedClubMessage.js
//
// Grup sohbetindeki FİLM KULÜBÜ duyurusu (mesaj kind: "clubShare", gövde utils/chatShare.buildClubShare; yazan
// services/filmClubService.js). Kehribar kart (gelen/giden aynı), üç olay:
//   • voting → aday afişleri + "N aday arasından seçin" + kalan süre · düğme "Oy ver"
//   • picked → seçilen film + kalan izleme süresi · düğme "Kulübü aç"
//   • done   → film + kulüp ortalaması + "N/M izledi" · düğme "Kulübü aç"
// Kart anlık görüntüdür; canlı durum kulüp ekranında (rota FilmClubScreen, o tur seçili). Katılmak serbest —
// Premium kapısı yalnız kulübü KURMAKTA (bkz. hooks/usePremiumGate KURAL). Metinler İZLEYİCİNİN dilinde.

import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLanguage } from "../../context/LanguageContext";
import { splitLeft } from "../../utils/filmClub";
import { getFilmClubCopy } from "../../utils/filmClubCopy";
import { buildTmdbUrl } from "../../utils/tmdbImageUtils";
import { CLUB_CARD_BORDER, CLUB_CARD_PADDING, CLUB_STRIP_GAP, clubStripLayout } from "../../utils/chatCardFit";
import GlassPressable from "../common/GlassPressable";

const COLORS = ["#3B2410", "#7A4A12", "#E8A33D"];
const INK = "#7A4A12";
const CARD_WIDTH = 260;
// Kart iç boşluğu + çerçeve; aday şeridi kalan genişliğe göre boyutlanır (utils/chatCardFit).
const CARD_PADDING = CLUB_CARD_PADDING;
const CARD_BORDER = CLUB_CARD_BORDER;
const STRIP_GAP = CLUB_STRIP_GAP;

function Poster({ path, width }) {
  const uri = buildTmdbUrl(path, "poster", width * 2);
  return (
    <View style={[styles.poster, { width, height: width * 1.5 }]}>
      {uri ? (
        <Image source={{ uri }} style={styles.fill} contentFit="cover" />
      ) : (
        <Ionicons name="film-outline" size={width * 0.4} color="rgba(255,255,255,0.7)" />
      )}
    </View>
  );
}

function SharedClubMessage({ share, cardWidth = CARD_WIDTH }) {
  const { language } = useLanguage();
  const navigation = useNavigation();
  const copy = getFilmClubCopy(language);
  const voting = share.event === "voting";
  const done = share.event === "done";
  const left = share.endsAt ? share.endsAt - Date.now() : null;

  const strip = clubStripLayout(voting ? share.candidates.length : 0, cardWidth);

  const title = voting ? copy.chatVotingTitle : done ? copy.chatDoneTitle : copy.chatPickedTitle;
  const open = () => navigation.navigate("FilmClubScreen", { groupId: share.groupId, roundId: share.roundId });

  return (
    <LinearGradient colors={COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, { width: cardWidth }]}>
      <View pointerEvents="none" style={styles.watermark}>
        <Ionicons name="ticket" size={120} color="rgba(255,255,255,0.07)" />
      </View>

      <View style={styles.header}>
        <View style={styles.tile}>
          <Ionicons name="ticket" size={16} color="#FFFFFF" />
        </View>
        <View style={styles.headerCopy}>
          <Text allowFontScaling={false} numberOfLines={1} style={styles.kicker}>
            {`${copy.kicker} · ${copy.roundLabel(share.number)}`}
          </Text>
          <Text numberOfLines={1} style={styles.sub}>
            {title}
          </Text>
        </View>
      </View>

      {voting ? (
        <View style={styles.block}>
          <View style={styles.strip}>
            {share.candidates.slice(0, strip.shown).map((media) => (
              <Poster key={`${media.media_type}-${media.id}`} path={media.poster_path} width={strip.posterW} />
            ))}
            {strip.more > 0 ? (
              <View style={[styles.more, { width: strip.posterW, height: strip.posterW * 1.5 }]}>
                <Text allowFontScaling={false} style={styles.moreText}>{`+${strip.more}`}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.body}>{copy.chatVotingBody(share.candidates.length)}</Text>
        </View>
      ) : (
        <View style={styles.pickRow}>
          <Poster path={share.pick.poster_path} width={64} />
          <View style={styles.pickCopy}>
            <Text numberOfLines={3} style={styles.pickTitle}>
              {share.pick.title}
            </Text>
            {share.pick.year ? <Text style={styles.meta}>{share.pick.year}</Text> : null}
            {done && share.avgRating != null ? (
              <View style={styles.avg}>
                <Ionicons name="star" size={13} color="#FFD76A" />
                <Text style={styles.avgText}>{copy.clubAverage(share.avgRating)}</Text>
              </View>
            ) : null}
            {done && share.memberCount ? (
              <Text style={styles.meta}>{copy.chatDoneBody(share.watchedCount || 0, share.memberCount)}</Text>
            ) : null}
          </View>
        </View>
      )}

      {!done && left != null ? (
        <View style={styles.timeRow}>
          <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.8)" />
          <Text style={styles.meta}>{left > 0 ? copy.timeLeft(splitLeft(left)) : copy.timeUp}</Text>
        </View>
      ) : null}

      <GlassPressable
        glass={false}
        accessibilityRole="button"
        accessibilityLabel={`${copy.title}. ${voting ? copy.chatVote : copy.chatOpen}`}
        onPress={open}
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      >
        <Ionicons name={voting ? "podium" : "ticket"} size={15} color={INK} />
        <Text allowFontScaling={false} style={styles.actionText}>
          {voting ? copy.chatVote : copy.chatOpen}
        </Text>
      </GlassPressable>
    </LinearGradient>
  );
}

export default memo(SharedClubMessage);

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    alignSelf: "flex-start",
    borderRadius: 18,
    padding: CARD_PADDING,
    gap: 12,
    overflow: "hidden",
    borderWidth: CARD_BORDER,
    borderColor: "rgba(255,255,255,0.14)",
    marginBottom: 2,
  },
  fill: { width: "100%", height: "100%" },
  watermark: { position: "absolute", right: -26, top: -24 },
  header: { flexDirection: "row", alignItems: "center", gap: 9 },
  tile: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.18)" },
  headerCopy: { flex: 1, minWidth: 0 },
  kicker: { color: "#FFFFFF", fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  sub: { color: "rgba(255,255,255,0.88)", fontSize: 13, fontWeight: "800", marginTop: 1 },
  block: { gap: 8 },
  strip: { flexDirection: "row", gap: STRIP_GAP, alignItems: "center" },
  poster: {
    borderRadius: 7,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  more: { borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.22)" },
  moreText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  body: { color: "rgba(255,255,255,0.92)", fontSize: 12.5, fontWeight: "700" },
  pickRow: { flexDirection: "row", gap: 11 },
  pickCopy: { flex: 1, minWidth: 0, gap: 3 },
  pickTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900", lineHeight: 20 },
  meta: { color: "rgba(255,255,255,0.8)", fontSize: 11.5, fontWeight: "700" },
  avg: { flexDirection: "row", alignItems: "center", gap: 4 },
  avgText: { color: "#FFFFFF", fontSize: 12.5, fontWeight: "900" },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 42,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
  },
  actionText: { color: INK, fontSize: 15, fontWeight: "900" },
  pressed: { opacity: 0.85 },
});
