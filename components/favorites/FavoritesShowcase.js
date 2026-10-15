// components/favorites/FavoritesShowcase.js
//
// Profildeki salt-okunur "favori seçimleri" kartı: dolu kategorilerin satırları,
// görsele dokunmak detay sayfasını açar. Arkadaş profilinde ve kendi
// profilinde aynı kart. Hiç favori yoksa HİÇBİR ŞEY çizilmez (boş kart, "bu kişi
// henüz seçmemiş" demek yerine profili uzatırdı).
//
// Bölüm başlığını çağıran verir (arkadaş profili SectionHeader kullanıyor).

import React, { memo, useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { alpha } from "../../theme/colors";
import { getFavoritesCopy } from "../../utils/favoritesCopy";
import { FAVORITE_KINDS, normalizeFavorites } from "../../utils/fourFavorites";
import FavoriteSlots from "./FavoriteSlots";

const ROUTE = { movies: "MovieDetails", shows: "TvShowsDetails", people: "ActorViewScreen" };

const paramsFor = (kind, entry) =>
  kind === "people" ? { personId: entry.id } : { id: entry.id };

/**
 * @param {boolean} [props.bare=false] Kart zemini/çerçevesi OLMADAN (çağıran kendi
 *   kartının içine koyuyor — kart içinde kart çift çerçeve olurdu).
 */
function FavoritesShowcase({ favorites, navigation, bare = false }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const copy = getFavoritesCopy(language);
  const safe = normalizeFavorites(favorites);
  const kinds = FAVORITE_KINDS.filter((kind) => safe[kind].length > 0);

  const open = useCallback(
    (kind, entry) => {
      // Detay üstüne detay açılabilsin (rayların yaptığı gibi) → push; yoksa navigate.
      const go = navigation?.push || navigation?.navigate;
      go?.call(navigation, ROUTE[kind], paramsFor(kind, entry));
    },
    [navigation],
  );

  if (!kinds.length) return null;

  return (
    <View
      style={
        bare
          ? styles.bare
          : [styles.card, { backgroundColor: theme.secondary, borderColor: theme.border }]
      }
    >
      {kinds.map((kind) => {
        const kindCopy = copy.kinds[kind];
        return (
          <View key={kind} style={styles.block}>
            <View style={styles.head}>
              <View style={[styles.headIcon, { backgroundColor: alpha(theme.accent, 0.14) }]}>
                <Ionicons name={kindCopy.icon} size={14} color={theme.accent} />
              </View>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.headLabel, { color: theme.text.primary }]}
              >
                {kindCopy.label}
              </Text>
            </View>
            <FavoriteSlots
              kind={kind}
              items={safe[kind]}
              theme={theme}
              readOnly
              openLabel={copy.profile.open}
              addLabel=""
              removeLabel={copy.picker.removeLabel}
              onOpen={open}
            />
          </View>
        );
      })}
    </View>
  );
}

export default memo(FavoritesShowcase);

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, padding: 16, gap: 20, marginBottom: 6 },
  bare: { gap: 20 },
  block: { gap: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  headIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  headLabel: { flex: 1, fontSize: 13.5, fontWeight: "800" },
});
