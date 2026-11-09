// components/club/ClubChatBanner.js
//
// Grup sohbetinin üstünde (sabitlenmiş mesaj şeridiyle AYNI SATIRDA, yan yana) FİLM KULÜBÜ şeridi: kulüp açıkken ve açık bir
// tur varken görünür — "Tur #3 · oylama sürüyor" / "İzleniyor: Dune". Dokununca kulüp ekranı.
// Dinleyici yalnız kulüp açıkken kurulur (tek alanlı `status in` sorgusu; services/filmClubService).

import React, { memo, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import GlassTouchable from "@components/common/GlassTouchable";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { alpha } from "../../theme/colors";
import { subscribeOpenClubRounds } from "@services/filmClubService";
import { activeRoundOf, hasWatched, myVoteOf } from "@utils/filmClub";
import { getFilmClubCopy } from "@utils/filmClubCopy";
import { CLUB_ACCENT } from "./ClubCandidatePicker";

function ClubChatBanner({ groupId, enabled, uid, onPress, compact = false }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const copy = getFilmClubCopy(language);
  const [round, setRound] = useState(null);

  useEffect(() => {
    if (!enabled || !groupId) {
      setRound(null);
      return undefined;
    }
    return subscribeOpenClubRounds(groupId, (rounds) => setRound(activeRoundOf(rounds)));
  }, [groupId, enabled]);

  if (!enabled || !round) return null;
  const voting = round.status === "voting";
  const done = voting ? !!myVoteOf(round, uid) : hasWatched(round, uid);
  const text = voting ? copy.bannerVoting(round.number) : copy.bannerWatching(round.pick?.title || "");
  const ctaLabel = voting ? copy.chatVote : copy.markWatched;

  // Tek satırlık ince şerit. `compact` = sabitlenmiş mesaj şeridiyle yan yana (yarım genişlik): eylem yazısı
  // yerine simgenin köşesinde nokta; yalnızken küçük "Oy ver / İzledim" hapı.
  return (
    <GlassTouchable
      onPress={() => onPress?.(round)}
      activeOpacity={0.82}
      style={[styles.banner, { backgroundColor: alpha(theme.secondary, 0.72), borderColor: theme.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${copy.title}. ${text}${done ? "" : `. ${ctaLabel}`}`}
      testID="club-chat-banner"
    >
      <View style={[styles.icon, { backgroundColor: `${CLUB_ACCENT}29` }]}>
        <Ionicons name="ticket" size={13} color={CLUB_ACCENT} />
        {compact && !done ? (
          <View style={[styles.dot, { backgroundColor: CLUB_ACCENT, borderColor: theme.secondary }]} />
        ) : null}
      </View>
      <Text style={[styles.text, { color: theme.text.primary }]} numberOfLines={1}>
        {compact ? (
          text
        ) : (
          <>
            <Text style={{ color: CLUB_ACCENT }}>{copy.title}</Text>
            <Text style={{ color: theme.text.muted }}>{"  ·  "}</Text>
            {text}
          </>
        )}
      </Text>
      {done ? (
        <Ionicons name="checkmark-circle" size={16} color={CLUB_ACCENT} />
      ) : !compact ? (
        <View style={[styles.cta, { backgroundColor: CLUB_ACCENT }]}>
          <Text style={styles.ctaText} allowFontScaling={false}>
            {ctaLabel}
          </Text>
        </View>
      ) : null}
    </GlassTouchable>
  );
}

export default memo(ClubChatBanner);

const styles = StyleSheet.create({
  banner: {
    flex: 1,
    minWidth: 0,
    height: 38,
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 6,
    paddingRight: 8,
    borderRadius: 19,
    borderWidth: 1,
  },
  icon: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", top: -1, right: -1, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
  text: { flex: 1, fontSize: 12.5, fontWeight: "700", marginHorizontal: 7 },
  cta: { height: 22, borderRadius: 11, paddingHorizontal: 9, alignItems: "center", justifyContent: "center" },
  ctaText: { color: "#fff", fontSize: 11, fontWeight: "900" },
});
