// components/favorites/OwnFavoritesCard.js
//
// Kendi profil ekranındaki "favori seçimleri" kartı. İKİ HÂLİ var:
//
//   favori VAR  → arkadaşların profilinde gördüğünün aynısı + "Düzenle"
//   favori YOK  → "Dört favorini seç" daveti (kapatılabilir, cihaza hatırlanır)
//
// Davet olmasa özellik yalnız Profili Düzenle'nin içinde kalır ve mevcut
// kullanıcılar onu hiç bulamazdı; kapatılabilir olması, umursamayanı her açılışta
// rahatsız etmemek için.

import React, { memo, useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useUserProfile } from "../../context/UserProfileContext";
import { Keys, set, useStored } from "../../services/storage";
import { alpha } from "../../theme/colors";
import { isLightSurface } from "../../utils/colorUtils";
import { getFavoritesCopy } from "../../utils/favoritesCopy";
import { hasAnyFavorites, readProfileFavorites } from "../../utils/fourFavorites";
import FavoritesShowcase from "./FavoritesShowcase";

function OwnFavoritesCard({ navigation }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { profile } = useUserProfile();
  const dismissed = useStored(Keys.favoritesInviteDismissed);
  const copy = getFavoritesCopy(language);
  const accent = theme.accent;
  const favorites = readProfileFavorites(profile);

  const edit = useCallback(() => navigation.navigate("EditProfileScreen"), [navigation]);
  const dismiss = useCallback(() => set(Keys.favoritesInviteDismissed, true), []);

  // Profil gelmeden (soğuk açılış) davet çakıp sönmesin.
  if (!profile) return null;

  const surface = [styles.card, { backgroundColor: theme.secondary, borderColor: theme.border }];

  if (hasAnyFavorites(favorites)) {
    return (
      <View style={surface}>
        <View style={styles.head}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.title, { color: theme.text.primary }]}
          >
            {copy.profile.title}
          </Text>
          <Pressable
            onPress={edit}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={copy.own.edit}
            style={[styles.editPill, { backgroundColor: alpha(accent, 0.12) }]}
          >
            <Ionicons name="pencil" size={12} color={accent} />
            <Text allowFontScaling={false} style={[styles.editText, { color: accent }]}>
              {copy.own.edit}
            </Text>
          </Pressable>
        </View>
        <FavoritesShowcase favorites={favorites} navigation={navigation} bare />
      </View>
    );
  }

  if (dismissed) return null;

  const onAccent = isLightSurface(accent) ? "#111827" : "#FFFFFF";
  return (
    <View style={surface}>
      <View style={styles.inviteRow}>
        <View style={[styles.medallion, { backgroundColor: alpha(accent, 0.14) }]}>
          <Ionicons name="heart-circle-outline" size={26} color={accent} />
        </View>
        <View style={styles.inviteCopy}>
          <Text style={[styles.inviteTitle, { color: theme.text.primary }]}>
            {copy.own.emptyTitle}
          </Text>
          <Text style={[styles.inviteDesc, { color: theme.text.secondary }]}>
            {copy.own.emptyDesc}
          </Text>
        </View>
        <Pressable
          onPress={dismiss}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={copy.own.dismiss}
          style={styles.dismiss}
        >
          <Ionicons name="close" size={16} color={theme.text.muted} />
        </Pressable>
      </View>
      <Pressable
        onPress={edit}
        accessibilityRole="button"
        style={[styles.cta, { backgroundColor: accent }]}
      >
        <Text allowFontScaling={false} style={[styles.ctaText, { color: onAccent }]}>
          {copy.own.cta}
        </Text>
        <Ionicons name="arrow-forward" size={15} color={onAccent} />
      </Pressable>
    </View>
  );
}

export default memo(OwnFavoritesCard);

const styles = StyleSheet.create({
  card: {
    alignSelf: "stretch",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 16,
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  title: { flex: 1, fontSize: 15, fontWeight: "800" },
  editPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  editText: { fontSize: 12, fontWeight: "800" },
  inviteRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  medallion: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteCopy: { flex: 1, minWidth: 0, gap: 3 },
  inviteTitle: { fontSize: 15, fontWeight: "800" },
  inviteDesc: { fontSize: 12.5, fontWeight: "600", lineHeight: 18 },
  dismiss: { padding: 2 },
  cta: {
    height: 44,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: { fontSize: 14, fontWeight: "800" },
});
