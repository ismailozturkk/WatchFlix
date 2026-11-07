// components/club/ClubChatBanner.js
//
// Grup sohbetinin üstünde (sabitlenmiş mesaj şeridiyle aynı yerde) FİLM KULÜBÜ şeridi: kulüp açıkken ve açık bir
// tur varken görünür — "Tur #3 · oylama sürüyor" / "İzleniyor: Dune". Dokununca kulüp ekranı.
// Dinleyici yalnız kulüp açıkken kurulur (tek alanlı `status in` sorgusu; services/filmClubService).

import React, { memo, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import GlassTouchable from "@components/common/GlassTouchable";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { subscribeOpenClubRounds } from "@services/filmClubService";
import { activeRoundOf, hasWatched, myVoteOf } from "@utils/filmClub";
import { getFilmClubCopy } from "@utils/filmClubCopy";
import { CLUB_ACCENT } from "./ClubCandidatePicker";

function ClubChatBanner({ groupId, enabled, uid, onPress }) {
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

  return (
    <GlassTouchable
      onPress={() => onPress?.(round)}
      activeOpacity={0.82}
      style={[styles.banner, { backgroundColor: theme.secondary, borderColor: theme.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${copy.title}. ${text}`}
      testID="club-chat-banner"
    >
      <View style={[styles.icon, { backgroundColor: `${CLUB_ACCENT}29` }]}>
        <Ionicons name="ticket" size={15} color={CLUB_ACCENT} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: CLUB_ACCENT }]} numberOfLines={1}>
          {copy.title}
        </Text>
        <Text style={[styles.text, { color: theme.text.secondary }]} numberOfLines={1}>
          {text}
        </Text>
      </View>
      <View style={[styles.cta, { backgroundColor: done ? theme.primary : CLUB_ACCENT }]}>
        {done ? (
          <Ionicons name="checkmark" size={14} color={CLUB_ACCENT} />
        ) : (
          <Text style={styles.ctaText} allowFontScaling={false}>
            {voting ? copy.chatVote : copy.markWatched}
          </Text>
        )}
      </View>
    </GlassTouchable>
  );
}

export default memo(ClubChatBanner);

const styles = StyleSheet.create({
  banner: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 2,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    zIndex: 2,
  },
  icon: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, marginHorizontal: 9 },
  title: { fontSize: 10.5, fontWeight: "800" },
  text: { fontSize: 12.5, fontWeight: "700", marginTop: 2 },
  cta: { minWidth: 28, height: 28, borderRadius: 14, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  ctaText: { color: "#fff", fontSize: 11.5, fontWeight: "900" },
});
