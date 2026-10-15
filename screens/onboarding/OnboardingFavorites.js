// screens/onboarding/OnboardingFavorites.js
//
// "Dört favori" tanıtım adımı: film, dizi ve oyuncu için en fazla 4'er favori.
// Hiçbiri zorunlu — adım "Devam Et" ile olduğu gibi geçilebilir.
//
// Seçimler oturum açılmadan ÖNCE yapıldığı için hesaba yazılamaz: üst bileşen
// cihaza geçici olarak kaydeder (services/pendingFavorites.js), kayıt/giriş
// sonrası profile taşınır. Burası yalnız görünüm.

import React from "react";
import { Animated, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import FavoritesEditor from "../../components/favorites/FavoritesEditor";
import { alpha } from "../../theme/colors";
import { countFavorites } from "../../utils/fourFavorites";
import {
  FeatureHeading,
  PAGE_W,
  SIDE_PAD,
  slideBottom,
  slideTop,
  useSlideParallax,
} from "./OnboardingParts";

export default function FavoritesSlide({
  copy,
  theme,
  accent,
  topInset,
  bottomInset,
  scrollX,
  slideIndex,
  favorites,
  onChangeFavorites,
}) {
  const parallax = useSlideParallax(scrollX, slideIndex);
  const text = copy.favorites;
  const total = countFavorites(favorites);

  return (
    <View style={{ width: PAGE_W, flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        // Seçici açıkken klavye çıkar; kutulara dokunuş klavyeyi kapatıp
        // ikinci dokunuş istemesin.
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: SIDE_PAD,
          paddingTop: slideTop(topInset),
          paddingBottom: slideBottom(bottomInset),
        }}
      >
        <Animated.View style={parallax.head}>
          <FeatureHeading
            eyebrow={text.eyebrow}
            title={text.title}
            titleAccent={text.titleAccent}
            desc={text.desc}
            icon="heart-circle-outline"
            theme={theme}
            accent={accent}
            size={28}
          />
        </Animated.View>

        <Animated.View style={[styles.body, parallax.stage]}>
          <View style={styles.countRow}>
            <View
              style={[
                styles.countPill,
                { backgroundColor: alpha(accent, 0.12), borderColor: alpha(accent, 0.22) },
              ]}
            >
              <Ionicons name="heart" size={13} color={accent} />
              <Text maxFontSizeMultiplier={1.15} style={[styles.countText, { color: accent }]}>
                {text.selected(total)}
              </Text>
            </View>
            <Text
              maxFontSizeMultiplier={1.15}
              style={[styles.countHint, { color: theme.text.muted }]}
              numberOfLines={2}
            >
              {text.hint}
            </Text>
          </View>

          <FavoritesEditor value={favorites} onChange={onChangeFavorites} accent={accent} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { width: "100%", maxWidth: 400, alignSelf: "center", marginTop: 22, gap: 18 },
  countRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  countPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  countText: { fontSize: 12, fontWeight: "800" },
  countHint: { flex: 1, fontSize: 11.5, fontWeight: "600", lineHeight: 15 },
});
