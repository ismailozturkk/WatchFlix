// components/game/PlayerStrip.js
//
// Oyuncu özeti şeridi: seviye halkası + unvan + XP + günlük seri. Hub
// modülünde kompakt tek satır (compact), Oyun Merkezi'nde büyük kart (compact
// değil) olarak kullanılır.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import UserAvatar from "@components/common/UserAvatar";
import { i18nText } from "@utils/i18nText";
import { getPlayerTitle } from "@screens/game/gameRegistry";
import { alpha } from "../../theme/colors";
import LevelRing from "./LevelRing";
import { MiniProgress, PressableScale, StatPill } from "./ui";

export default function PlayerStrip({ progress, theme, user, onPress, compact = false }) {
  const title = getPlayerTitle(progress.level);
  const xpLabel = i18nText("autoI18n.oyun_xp_ilerleme", "{{current}} / {{next}} XP", {
    current: progress.xpIntoLevel,
    next: progress.xpForNext,
  });
  const body = (
    <>
      <LevelRing
        size={compact ? 52 : 70}
        stroke={compact ? 5 : 6}
        progress={progress.levelProgress}
        color={theme.accent}
        trackColor={alpha(theme.accent, 0.2)}
      >
        {compact ? (
          <Text style={[styles.ringLevel, { color: theme.text.primary }]} allowFontScaling={false}>
            {progress.level}
          </Text>
        ) : (
          <UserAvatar
            avatarIndex={user?.avatarIndex}
            photoURL={user?.photoURL}
            isCustomPhoto
            size={50}
          />
        )}
      </LevelRing>

      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={[styles.name, { color: theme.text.primary }]} allowFontScaling={false} numberOfLines={1}>
            {compact
              ? i18nText(title.key, title.fallback)
              : user?.displayName || i18nText("autoI18n.oyuncu", "Sinema Oyuncusu")}
          </Text>
          <View style={[styles.levelBadge, { backgroundColor: alpha(theme.accent, 0.16) }]}>
            <Text style={[styles.levelBadgeText, { color: theme.accent }]} allowFontScaling={false}>
              {i18nText("autoI18n.seviye_degeri", "Seviye {{level}}", { level: progress.level })}
            </Text>
          </View>
        </View>
        {!compact ? (
          <Text style={[styles.rank, { color: theme.text.muted }]} allowFontScaling={false}>
            {i18nText(title.key, title.fallback)}
          </Text>
        ) : null}
        <MiniProgress
          ratio={progress.levelProgress}
          color={theme.accent}
          trackColor={theme.primary}
          height={compact ? 5 : 7}
          style={styles.bar}
        />
        <Text style={[styles.xp, { color: theme.text.muted }]} allowFontScaling={false}>
          {xpLabel}
        </Text>
      </View>

      {compact ? (
        <View style={styles.right}>
          <StatPill
            icon="flame"
            iconColor={progress.dayStreak > 0 ? "#FF8A3D" : theme.text.muted}
            value={progress.dayStreak}
            theme={theme}
          />
          <AppIcon family="Ionicons" name="chevron-forward" size={17} color={theme.text.muted} />
        </View>
      ) : null}
    </>
  );

  const containerStyle = [
    styles.card,
    compact ? styles.cardCompact : styles.cardLarge,
    { backgroundColor: theme.secondary, borderColor: theme.border },
  ];

  if (!onPress) return <View style={containerStyle}>{body}</View>;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={i18nText("autoI18n.oyun_merkezi", "Oyun Merkezi")}
      onPress={onPress}
      scaleTo={0.985}
      style={containerStyle}
    >
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 14 },
  cardCompact: { padding: 12 },
  cardLarge: { padding: 16 },
  ringLevel: { fontSize: 17, fontWeight: "900" },
  copy: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontSize: 15, fontWeight: "900", flexShrink: 1 },
  levelBadge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  levelBadgeText: { fontSize: 9.5, fontWeight: "900" },
  rank: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  bar: { marginTop: 8 },
  xp: { fontSize: 10, fontWeight: "750", marginTop: 5 },
  right: { alignItems: "flex-end", gap: 8 },
});
