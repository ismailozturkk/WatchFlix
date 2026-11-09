// components/favorites/FavoritesShowcase.js
//
// Arkadaş profilindeki salt-okunur "favori seçimleri" kartı. KOMPAKT: tek kart,
// kategori başına tek satır — solda tür ikonu + etiket, sağda küçük posterler
// (oyuncuda yuvarlak portre). Görsele dokunmak detay sayfasını açar; başlıklar
// görünmez ama erişilebilirlik etiketinde (ve detayda) duruyor. Hiç favori yoksa
// HİÇBİR ŞEY çizilmez (boş kart, "bu kişi henüz seçmemiş" demek yerine profili
// uzatırdı).
//
// Bölüm başlığını çağıran verir (arkadaş profili SectionHeader kullanıyor).
//
// DÜZENLEME MODU (`editing` + `onChange`, kendi profil önizlemesi): aynı kart, aynı
// satırlar; üç kategori de çizilir, dolu yuvanın köşesinde "×" (kaldır), boş yuvada
// "+" — dokununca ortak seçici sayfası (FavoritePickerSheet) o kategoride açılır.
// Bileşen kontrollüdür: kayıt yeri çağıranın (taslak, Kaydet ile yazılır).

import React, { memo, useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { alpha } from "../../theme/colors";
import { getFavoritesCopy } from "../../utils/favoritesCopy";
import {
  FAVORITE_KINDS,
  normalizeFavorites,
  removeFavorite,
  toggleFavorite,
} from "../../utils/fourFavorites";
import * as Haptics from "../../services/hapticsService";
import FavoriteSlots from "./FavoriteSlots";
import FavoritePickerSheet from "./FavoritePickerSheet";
import GlassBox from "../common/GlassBox";

const ROUTE = { movies: "MovieDetails", shows: "TvShowsDetails", people: "ActorViewScreen" };

// Yuva genişliği satırdan türer ama bu tavanı aşmaz: geniş ekranda posterler
// şişip kartı uzatmasın. 54 → poster 54x81.
const THUMB_MAX_WIDTH = 54;
const THUMB_GAP = 8;
const THUMB_RADIUS = 10;

const paramsFor = (kind, entry) =>
  kind === "people" ? { personId: entry.id } : { id: entry.id };

function FavoritesShowcase({ favorites, navigation, editing = false, onChange }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const copy = getFavoritesCopy(language);
  const safe = normalizeFavorites(favorites);
  const kinds = editing ? FAVORITE_KINDS : FAVORITE_KINDS.filter((kind) => safe[kind].length > 0);
  const [pickerKind, setPickerKind] = useState(null);

  // Peş peşe iki dokunuş aynı render'a düşerse ikincisi eski değeri görmesin.
  const latest = useRef(safe);
  latest.current = safe;
  const commit = useCallback(
    (next) => {
      if (next === latest.current) return;
      latest.current = next;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onChange?.(next);
    },
    [onChange],
  );
  const onToggle = useCallback((kind, entry) => commit(toggleFavorite(latest.current, kind, entry)), [commit]);
  const onRemove = useCallback((kind, entry) => commit(removeFavorite(latest.current, kind, entry.id)), [commit]);
  const openPicker = useCallback((kind) => setPickerKind(kind), []);
  const closePicker = useCallback(() => setPickerKind(null), []);

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
    <>
    <GlassBox role="card" style={[styles.card, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      {kinds.map((kind, index) => {
        const kindCopy = copy.kinds[kind];
        return (
          <View
            key={kind}
            style={[
              styles.row,
              index > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: alpha(theme.border, 0.9),
              },
            ]}
          >
            <View style={styles.kind}>
              <View style={[styles.kindIcon, { backgroundColor: alpha(theme.accent, 0.14) }]}>
                <Ionicons name={kindCopy.icon} size={15} color={theme.accent} />
              </View>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.kindLabel, { color: theme.text.secondary }]}
              >
                {kindCopy.label}
              </Text>
            </View>
            <View style={styles.slots}>
              <FavoriteSlots
                kind={kind}
                items={safe[kind]}
                theme={theme}
                readOnly={!editing}
                showTitles={false}
                gap={THUMB_GAP}
                maxSlotWidth={THUMB_MAX_WIDTH}
                radius={THUMB_RADIUS}
                openLabel={copy.profile.open}
                addLabel={editing ? kindCopy.add : ""}
                removeLabel={copy.picker.removeLabel}
                onOpen={open}
                onAdd={openPicker}
                onRemove={onRemove}
              />
            </View>
          </View>
        );
      })}
    </GlassBox>
    {editing ? (
      <FavoritePickerSheet
        visible={!!pickerKind}
        kind={pickerKind}
        favorites={safe}
        onToggle={onToggle}
        onClose={closePicker}
      />
    ) : null}
    </>
  );
}

export default memo(FavoritesShowcase);

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 2,
    marginBottom: 6,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 },
  kind: { width: 64, alignItems: "center", gap: 6 },
  kindIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  kindLabel: { fontSize: 11, fontWeight: "800", textAlign: "center" },
  // Soldaki etiket sütunundan kalan genişlik: FavoriteSlots bunu ölçüp yuvalar.
  slots: { flex: 1, minWidth: 0 },
});
