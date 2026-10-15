// components/favorites/FavoritesEditor.js
//
// "Dört favori"yi seçme/düzenleme yüzeyi: film, dizi ve oyuncu için üçer satır
// (her biri 4 yuva) + ortak seçici sayfası. Tanıtım (oturum açılmadan önce) ve
// Profili Düzenle AYNI bileşeni kullanır; kayıt yeri çağıranındır:
//
//   tanıtım          → cihaza (pendingFourFavorites), kayıt sonrası profile taşınır
//   Profili Düzenle  → taslak durum, Kaydet ile Users/{uid}.fourFavorites
//
// Bileşen KONTROLLÜDÜR: `value` + `onChange(next)`. Her kategoride 0–4 seçim
// geçerli; hiçbir şey zorunlu değil.

import React, { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import * as Haptics from "../../services/hapticsService";
import { alpha } from "../../theme/colors";
import { getFavoritesCopy } from "../../utils/favoritesCopy";
import {
  FAVORITE_KINDS,
  MAX_FAVORITES,
  countFavorites,
  removeFavorite,
  toggleFavorite,
} from "../../utils/fourFavorites";
import FavoriteSlots from "./FavoriteSlots";
import FavoritePickerSheet from "./FavoritePickerSheet";

const tick = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

/**
 * @param {object} props.value                normalize edilmiş favoriler
 * @param {(next:object)=>void} props.onChange
 * @param {string} [props.accent]             vurgu rengi (varsayılan tema)
 */
export default function FavoritesEditor({ value, onChange, accent: accentProp }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const copy = getFavoritesCopy(language);
  const accent = accentProp || theme.accent;
  const [pickerKind, setPickerKind] = useState(null);

  // Peş peşe iki dokunuş aynı render'a düşerse ikincisi eski `value`yu görürdü;
  // son değer burada tutulup her değişiklikte anında güncellenir.
  const latest = useRef(value);
  latest.current = value;

  const commit = useCallback(
    (next) => {
      if (next === latest.current) return;
      latest.current = next;
      tick();
      onChange(next);
    },
    [onChange],
  );

  const onToggle = useCallback(
    (kind, entry) => commit(toggleFavorite(latest.current, kind, entry)),
    [commit],
  );
  const onRemove = useCallback(
    (kind, entry) => commit(removeFavorite(latest.current, kind, entry.id)),
    [commit],
  );
  const openPicker = useCallback((kind) => setPickerKind(kind), []);
  const closePicker = useCallback(() => setPickerKind(null), []);

  return (
    <View style={styles.root}>
      {FAVORITE_KINDS.map((kind) => {
        const kindCopy = copy.kinds[kind];
        const count = countFavorites(value, kind);
        return (
          <View key={kind} style={styles.block}>
            <View style={styles.head}>
              <View style={[styles.headIcon, { backgroundColor: alpha(accent, 0.14) }]}>
                <Ionicons name={kindCopy.icon} size={15} color={accent} />
              </View>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.headLabel, { color: theme.text.primary }]}
              >
                {kindCopy.label}
              </Text>
              <Text
                allowFontScaling={false}
                style={[
                  styles.headCount,
                  { color: count >= MAX_FAVORITES ? accent : theme.text.muted },
                ]}
              >
                {copy.counter(count, MAX_FAVORITES)}
              </Text>
            </View>
            <FavoriteSlots
              kind={kind}
              items={value?.[kind]}
              theme={theme}
              accent={accent}
              addLabel={kindCopy.add}
              removeLabel={copy.picker.removeLabel}
              onAdd={openPicker}
              onRemove={onRemove}
            />
          </View>
        );
      })}

      <FavoritePickerSheet
        visible={!!pickerKind}
        kind={pickerKind}
        favorites={value}
        onToggle={onToggle}
        onClose={closePicker}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 20 },
  block: { gap: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  headIcon: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  headLabel: { flex: 1, fontSize: 14, fontWeight: "800" },
  headCount: { fontSize: 12.5, fontWeight: "800" },
});
