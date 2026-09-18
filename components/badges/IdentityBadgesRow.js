// components/badges/IdentityBadgesRow.js
//
// Profil başlığındaki kimlik rozeti satırı (Kurucu / Premium / Premium Max).
// Kendi profilinde (ProfileScreen) ve arkadaşın gördüğü profilde
// (FriendProfileScreen) AYNI görünüm: premium rozetinin statü değeri
// başkaları da görebildiği için var (bkz. utils/premiumFeatures.js
// identity_badge).
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import AppBadge from "./AppBadge";
import { badgeLabel } from "./badgeCatalog";

export default function IdentityBadgesRow({ badges, theme, language, style }) {
  if (!badges?.length) return null;
  return (
    <View style={[styles.row, style]}>
      {badges.map((badge) => (
        <View
          key={badge.id}
          style={[
            styles.chip,
            { backgroundColor: theme.accent + "12", borderColor: theme.border },
          ]}
        >
          <AppBadge
            glyph={badge.glyph}
            glyphSolid={badge.glyphSolid}
            rarity={badge.rarity}
            ornate={badge.ornate}
            size={25}
            accessibilityLabel={badgeLabel(badge, language)}
          />
          <Text numberOfLines={1} style={[styles.label, { color: theme.text.primary }]}>
            {badgeLabel(badge, language)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 6,
    marginBottom: 4,
  },
  chip: {
    minHeight: 30,
    maxWidth: "100%",
    borderWidth: 1,
    borderRadius: 10,
    paddingLeft: 3,
    paddingRight: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  label: { flexShrink: 1, fontSize: 9, fontWeight: "800" },
});
