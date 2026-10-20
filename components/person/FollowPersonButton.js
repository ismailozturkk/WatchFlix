// components/person/FollowPersonButton.js
//
// Oyuncu / yönetmen sayfasındaki "Takip et" hapı (screens/actor/ActorViewScreen.js, hero'nun
// altında). Takipteyken dolu ve "Takipte"; dokununca takipten çıkar ve toast'ta "Geri Al" sunar.
//
// HERO ÜSTÜ: yazı HER ZAMAN beyaz (hero koyu degradeye biner, tema açık olsa da). Takipteki hâl
// vurgu rengiyle dolar; vurgu üstü yazı beyaz kuralı (theme-studio-oct15) burada da geçerli.
//
// SINIR: en fazla MAX_FOLLOWED kişi (utils/followedPeople.js). Dolunca takip EDİLMEZ, toast nedenini
// söyler. Plan kapısı YOK (açık soru 2: ücretsiz kalsın — docs/planlama/GELISTIRME_ONERI_ADAYLARI).
import React, { memo, useCallback } from "react";
import { StyleSheet, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { toast } from "../AppToast";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import useFollowedPeople from "../../hooks/useFollowedPeople";
import { trackEvent, ANALYTICS_EVENTS } from "../../services/analytics";
import { triggerHaptic } from "../../services/hapticsService";
import { MAX_FOLLOWED } from "../../utils/followedPeople";
import { getFollowedPeopleCopy } from "../../utils/followedPeopleCopy";
import GlassPressable from "../common/GlassPressable";

function FollowPersonButton({ person, source = "profile", style }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const copy = getFollowedPeopleCopy(language);
  const { isFollowing, follow, unfollow } = useFollowedPeople();

  const personId = person?.id;
  const name = person?.name || "";
  const following = isFollowing(personId);

  const onPress = useCallback(() => {
    if (!personId) return;
    const department = person?.known_for_department || "other";
    if (following) {
      if (!unfollow(personId)) return;
      triggerHaptic("selection");
      trackEvent(ANALYTICS_EVENTS.PERSON_FOLLOW, { action: "unfollow", source, department });
      toast.undo(copy.toast.unfollowed(name), () => {
        if (follow(person) === "added") {
          trackEvent(ANALYTICS_EVENTS.PERSON_FOLLOW, { action: "follow", source: "undo", department });
        }
      });
      return;
    }
    const status = follow(person);
    if (status === "added") {
      triggerHaptic("success");
      trackEvent(ANALYTICS_EVENTS.PERSON_FOLLOW, { action: "follow", source, department });
      toast.success(copy.toast.followed(name), copy.toast.followedHint);
    } else if (status === "limit") {
      triggerHaptic("warning");
      toast.warning(copy.toast.limit(MAX_FOLLOWED), copy.toast.limitHint);
    }
  }, [copy, follow, following, name, person, personId, source, unfollow]);

  if (!personId || !name) return null;

  return (
    <GlassPressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={following ? copy.button.unfollowLabel(name) : copy.button.followLabel(name)}
      accessibilityHint={following ? copy.button.unfollowHint : copy.button.followHint}
      accessibilityState={{ selected: following }}
      style={({ pressed }) => [
        styles.pill,
        following
          ? { backgroundColor: theme.accent, borderColor: theme.accent }
          : styles.pillIdle,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Ionicons name={following ? "notifications" : "notifications-outline"} size={15} color="#FFFFFF" />
      <Text style={styles.label} numberOfLines={1}>
        {following ? copy.button.following : copy.button.follow}
      </Text>
    </GlassPressable>
  );
}

export default memo(FollowPersonButton);

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillIdle: { backgroundColor: "rgba(255,255,255,0.18)", borderColor: "rgba(255,255,255,0.35)" },
  pressed: { opacity: 0.8 },
  label: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
});
