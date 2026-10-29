// components/top100/Top100CountSheet.js
//
// "Liste olarak kaydet" / "Sohbete gönder" öncesi uzunluk seçimi: İlk 20 · 50 · 70 · 100 (utils/top100.TOP100_PICK_COUNTS).
// Seçilen uzunluğun ilk afişleri önizlenir. "Devam" yalnız seçimi bildirir; sıradaki sayfayı (kayıt modalı ya da
// alıcı seçimi) çağıran bu sayfanın `onDismissed`'ında açar — iOS iki Modal'ı üst üste sunamaz.

import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import AppIcon from "@components/AppIcon";
import BottomSheetModal from "@components/common/BottomSheetModal";
import GlassCloseButton from "@components/common/GlassCloseButton";
import GlassTouchable from "@components/common/GlassTouchable";
import { useTheme } from "@context/ThemeContext";
import { useImageQualitySettings } from "@context/AppSettingsContext";
import { triggerHaptic } from "@services/hapticsService";
import { pickableCounts, TOP100_PICK_COUNTS } from "@utils/top100";

const PREVIEW = 6;

/**
 * @param {object} props
 * @param {"save"|"chat"|null} props.mode
 * @param {object[]} props.ranked
 */
export default function Top100CountSheet({ visible, mode, ranked, copy, onClose, onConfirm, onDismissed }) {
  const { theme } = useTheme();
  const { getTmdbUrl } = useImageQualitySettings();
  const options = pickableCounts(ranked?.length || 0);
  const fallback = options.find((o) => o.enabled)?.count ?? TOP100_PICK_COUNTS[0];
  const [count, setCount] = useState(fallback);

  useEffect(() => {
    if (visible) setCount(fallback);
    // Her açılışta ilk seçilebilir uzunluktan başla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const preview = (ranked || []).slice(0, Math.min(count, PREVIEW));
  const more = Math.min(count, ranked?.length || 0) - preview.length;
  const isChat = mode === "chat";

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      intensity={35}
      dimColor="rgba(0,0,0,0.35)"
      sheetStyle={[styles.sheet, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: `${theme.accent}22` }]}>
          <AppIcon family="Ionicons" name={isChat ? "paper-plane" : "albums"} size={18} color={theme.accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.title, { color: theme.text.primary }]}>
            {isChat ? copy.pickTitleChat : copy.pickTitleSave}
          </Text>
          <Text style={[styles.subtitle, { color: theme.text.muted }]} numberOfLines={2}>
            {copy.pickHint}
          </Text>
        </View>
        <GlassCloseButton size={34} fallbackRadius={12} iconSize={19} color={theme.text.secondary} onPress={onClose} />
      </View>

      <View style={styles.chips}>
        {options.map((option) => {
          const active = option.count === count;
          return (
            <GlassTouchable
              key={option.count}
              glass={false}
              disabled={!option.enabled}
              onPress={() => {
                triggerHaptic("selection");
                setCount(option.count);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled: !option.enabled }}
              style={[
                styles.chip,
                { backgroundColor: theme.primary, borderColor: theme.border },
                active && { backgroundColor: theme.accent, borderColor: theme.accent },
                !option.enabled && styles.chipDisabled,
              ]}
            >
              <Text style={[styles.chipNumber, { color: active ? "#FFFFFF" : theme.text.primary }]}>{option.count}</Text>
              <Text style={[styles.chipLabel, { color: active ? "rgba(255,255,255,0.85)" : theme.text.muted }]}>
                {copy.pickTop(option.count)}
              </Text>
            </GlassTouchable>
          );
        })}
      </View>

      <View style={styles.previewRow}>
        {preview.map((row) => (
          <View key={row.key} style={[styles.poster, { backgroundColor: theme.border }]}>
            {row.poster_path ? (
              <Image
                source={{ uri: getTmdbUrl(row.poster_path, "poster", 200) }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : null}
            <View style={styles.posterRank}>
              <Text style={styles.posterRankText}>{row.rank}</Text>
            </View>
          </View>
        ))}
        {more > 0 ? (
          <View style={[styles.poster, styles.posterMore, { borderColor: theme.border }]}>
            <Text style={[styles.moreText, { color: theme.text.secondary }]}>{`+${more}`}</Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.listName, { color: theme.text.muted }]} numberOfLines={1}>
        {copy.listTitle(count)}
      </Text>

      <GlassTouchable
        glass={false}
        onPress={() => onConfirm?.(count)}
        accessibilityRole="button"
        style={[styles.cta, { backgroundColor: theme.accent }]}
      >
        <AppIcon family="Ionicons" name={isChat ? "paper-plane" : "bookmark"} size={16} color="#fff" />
        <Text style={styles.ctaText}>{`${isChat ? copy.sendChat : copy.saveList} · ${count}`}</Text>
      </GlassTouchable>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 26,
  },
  handle: { width: 42, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 11 },
  iconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, fontWeight: "900" },
  subtitle: { fontSize: 11.5, lineHeight: 16, marginTop: 3 },
  chips: { flexDirection: "row", gap: 8, marginTop: 18 },
  chip: {
    flex: 1,
    minHeight: 62,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipDisabled: { opacity: 0.4 },
  chipNumber: { fontSize: 20, fontWeight: "900", fontVariant: ["tabular-nums"] },
  chipLabel: { fontSize: 10.5, fontWeight: "800", marginTop: 1 },
  previewRow: { flexDirection: "row", gap: 6, marginTop: 16 },
  poster: {
    width: 42,
    height: 63,
    borderRadius: 9,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  posterMore: { borderWidth: StyleSheet.hairlineWidth },
  moreText: { fontSize: 11, fontWeight: "800" },
  posterRank: {
    position: "absolute",
    left: 3,
    top: 3,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  posterRankText: { color: "#fff", fontSize: 9.5, fontWeight: "900" },
  listName: { fontSize: 11.5, fontWeight: "700", marginTop: 10 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 50,
    borderRadius: 14,
    marginTop: 16,
  },
  ctaText: { color: "#fff", fontSize: 15, fontWeight: "900" },
});
