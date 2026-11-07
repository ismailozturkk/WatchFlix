// screens/onboarding/OnboardingFavorites.js
//
// "Dört favori" tanıtım adımı: film, dizi ve oyuncu için en fazla 4'er favori.
// Hiçbiri zorunlu — adım "Devam Et" ile olduğu gibi geçilebilir.
//
// Seçimler oturum açılmadan ÖNCE yapıldığı için hesaba yazılamaz: üst bileşen
// cihaza geçici olarak kaydeder (services/pendingFavorites.js), kayıt/giriş
// sonrası profile taşınır. Burası yalnız görünüm.

import React, { useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import FavoritesEditor from "../../components/favorites/FavoritesEditor";
import { useLanguage } from "../../context/LanguageContext";
import { alpha } from "../../theme/colors";
import { FAVORITE_KINDS, MAX_FAVORITES, countFavorites } from "../../utils/fourFavorites";
import { getFavoritesCopy } from "../../utils/favoritesCopy";
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
  const { language } = useLanguage();
  const favoriteCopy = getFavoritesCopy(language);
  const [activeKind, setActiveKind] = useState(FAVORITE_KINDS[0]);

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
            title={text.title}
            titleAccent={text.titleAccent}
            desc={text.desc}
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

          <View style={[styles.tabs, { backgroundColor: alpha(theme.secondary, 0.8), borderColor: theme.border }]}>
            {FAVORITE_KINDS.map((kind) => {
              const active = activeKind === kind;
              const kindCopy = favoriteCopy.kinds[kind];
              return (
                <Pressable
                  key={kind}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${kindCopy.label}, ${favoriteCopy.counter(countFavorites(favorites, kind), MAX_FAVORITES)}`}
                  onPress={() => setActiveKind(kind)}
                  style={[styles.tab, active && { backgroundColor: alpha(accent, 0.16) }]}
                >
                  <Ionicons name={kindCopy.icon} size={16} color={active ? accent : theme.text.muted} />
                  <Text numberOfLines={1} style={[styles.tabText, { color: active ? theme.text.primary : theme.text.secondary }]}>
                    {kindCopy.label}
                  </Text>
                  {countFavorites(favorites, kind) > 0 && (
                    <View style={[styles.tabDot, { backgroundColor: accent }]} />
                  )}
                </Pressable>
              );
            })}
          </View>
          <FavoritesEditor value={favorites} onChange={onChangeFavorites} accent={accent} visibleKinds={[activeKind]} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { width: "100%", maxWidth: 400, alignSelf: "center", marginTop: 22, gap: 18 },
  countRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 },
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
  countHint: { flexGrow: 1, flexShrink: 1, fontSize: 11.5, fontWeight: "600", lineHeight: 16 },
  tabs: { flexDirection: "row", borderRadius: 17, borderWidth: 1, padding: 4, gap: 3 },
  tab: { flex: 1, minWidth: 0, height: 46, borderRadius: 13, alignItems: "center", justifyContent: "center", gap: 2 },
  tabText: { fontSize: 10.5, fontWeight: "800" },
  tabDot: { position: "absolute", top: 5, right: 7, width: 5, height: 5, borderRadius: 3 },
});
