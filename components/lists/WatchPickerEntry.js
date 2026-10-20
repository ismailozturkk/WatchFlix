// components/lists/WatchPickerEntry.js
//
// İzleme listesinin üstündeki "Ne izlesem?" satırı: arama satırıyla AYNI genişlikte, tek sırada üç düğme —
//   [ 🎲 Ne izlesem? ]  [ 🎬 Film ]  [ 📺 Dizi ]
// Zar düğmesi karışık havuzdan, Film / Dizi düğmeleri doğrudan o türden seçtirir (eskiden bu seçim gizli bir
// kaydırma hareketiydi, sonra sayfanın içindeki çiplerdi). Her düğme seçim sayfasını İSTENEN türle açar;
// sayfa açılır açılmaz ilk seçimi yapar. Havuz boş olan tür düğmesi kapalıdır. Liste süzülmüşse altta tek
// satırlık not durur (kullanıcı "neden hep aynı birkaç şey çıkıyor?" demesin).

import React, { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { readableTextOn } from "@utils/colorUtils";
import { countsOf } from "@utils/watchPicker";
import GlassPressable from "../common/GlassPressable";

function TypeButton({ testID, icon, label, count, theme, disabled, accessibilityLabel, onPress }) {
  return (
    <GlassPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${accessibilityLabel}. ${count}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles.typeButton,
        {
          backgroundColor: theme.secondary,
          borderColor: theme.border,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        disabled && styles.disabled,
      ]}
    >
      <Ionicons name={icon} size={18} color={theme.accent} />
      <Text allowFontScaling={false} numberOfLines={1} style={[styles.typeLabel, { color: theme.text.primary }]}>
        {label}
      </Text>
    </GlassPressable>
  );
}

function WatchPickerEntry({ theme, copy, items, filtered = false, onPick }) {
  const accent = theme.accent;
  const onAccent = readableTextOn(accent);
  const counts = useMemo(() => countsOf(items), [items]);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <GlassPressable
          testID="watch-picker-entry"
          accessibilityRole="button"
          accessibilityLabel={copy.entry.a11yRandom}
          onPress={() => onPick("mixed")}
          style={({ pressed }) => [
            styles.button,
            styles.randomButton,
            { backgroundColor: accent, transform: [{ scale: pressed ? 0.97 : 1 }] },
          ]}
        >
          <Ionicons name="dice" size={22} color={onAccent} />
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.randomLabel, { color: onAccent }]}>
            {copy.entry.title}
          </Text>
        </GlassPressable>

        <TypeButton
          testID="watch-picker-entry-movie"
          icon="film-outline"
          label={copy.entry.movie}
          count={counts.movie}
          theme={theme}
          disabled={counts.movie === 0}
          accessibilityLabel={copy.entry.a11yMovie}
          onPress={() => onPick("movie")}
        />
        <TypeButton
          testID="watch-picker-entry-tv"
          icon="tv-outline"
          label={copy.entry.tv}
          count={counts.tv}
          theme={theme}
          disabled={counts.tv === 0}
          accessibilityLabel={copy.entry.a11yTv}
          onPress={() => onPick("tv")}
        />
      </View>

      {filtered ? (
        <Text
          testID="watch-picker-entry-note"
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.note, { color: theme.text.muted }]}
        >
          {copy.entry.filteredNote}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Arama satırı (ListSearchBar) ile aynı genişlik / hizalama.
  wrap: { width: "95%", alignSelf: "center", marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  button: {
    height: 52,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  // 320 pt'te satır 288 pt (95% - boşluklar): zar ≈136, türler ≈76 — etiketler kesilmeden sığar (Yoga ile ölç).
  randomButton: { flex: 1.8, minWidth: 0, paddingHorizontal: 10, gap: 6 },
  randomLabel: { fontSize: 14, fontWeight: "800", letterSpacing: -0.2, flexShrink: 1 },
  typeButton: { flex: 1, minWidth: 0, paddingHorizontal: 8, gap: 6, borderWidth: 1 },
  typeLabel: { fontSize: 13, fontWeight: "800", flexShrink: 1 },
  disabled: { opacity: 0.4 },
  note: { marginTop: 6, fontSize: 11.5, fontWeight: "600", textAlign: "center" },
});

export default memo(WatchPickerEntry);
