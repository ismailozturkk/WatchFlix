import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import SwitchToggle from "@components/SwitchToggle";
import { i18nText } from "@utils/i18nText";
import { readableTextOn } from "@utils/colorUtils";
import GlassPressable from "../common/GlassPressable";

const OPTIONS = [
  {
    key: "mediaType",
    icon: "pricetag-outline",
    labelKey: "autoI18n.poster_tur_etiketi",
    fallback: "Film / dizi etiketi",
    defaultValue: true,
  },
  {
    key: "duration",
    icon: "time-outline",
    labelKey: "autoI18n.poster_sure_bilgisi",
    fallback: "Süre bilgisi",
    defaultValue: true,
  },
  {
    key: "title",
    icon: "text-outline",
    labelKey: "autoI18n.poster_icerik_adi",
    fallback: "İçerik adı",
    defaultValue: false,
  },
  {
    key: "addedBy",
    icon: "person-outline",
    labelKey: "autoI18n.poster_ekleyen_kisi",
    fallback: "Ekleyen kişi",
    defaultValue: true,
    sharedOnly: true,
  },
  {
    key: "rating",
    icon: "star-outline",
    labelKey: "autoI18n.poster_puan_bilgisi",
    fallback: "Puanım (yıldız)",
    defaultValue: true,
  },
  {
    key: "comment",
    icon: "chatbubble-ellipses-outline",
    labelKey: "autoI18n.poster_yorum_ikonu",
    fallback: "Yorum ikonu",
    defaultValue: true,
  },
];

export default function ListPosterInfoControls({
  theme,
  accent,
  value,
  onValueChange,
  showAddedBy = false,
  // "rows": anahtarlı satırlar (eski, ~48 pt/satır). "chips": simge + ad çipleri, sarılır — "Sırala & Filtrele"
  // sayfasında ~3 kat daha az yer tutar; dokununca açılıp kapanır (erişilebilirlik: switch rolü).
  variant = "rows",
}) {
  const visibleOptions = OPTIONS.filter(
    (option) => !option.sharedOnly || showAddedBy,
  );

  if (variant === "chips") {
    const onAccent = readableTextOn(accent);
    return (
      <View style={styles.chips}>
        {visibleOptions.map((option) => {
          const on = value?.[option.key] ?? option.defaultValue;
          return (
            <GlassPressable
              key={option.key}
              testID={`poster-info-${option.key}`}
              accessibilityRole="switch"
              accessibilityState={{ checked: on }}
              onPress={() => onValueChange(option.key, !on)}
              style={[
                styles.chip,
                {
                  backgroundColor: on ? accent : theme.primary,
                  borderColor: on ? accent : theme.border,
                },
              ]}
            >
              <Ionicons name={option.icon} size={15} color={on ? onAccent : theme.text.muted} />
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.chipText, { color: on ? onAccent : theme.text.secondary }]}
              >
                {i18nText(option.labelKey, option.fallback)}
              </Text>
            </GlassPressable>
          );
        })}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
    >
      {visibleOptions.map((option, index) => (
        <View
          key={option.key}
          style={[
            styles.row,
            index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
          ]}
        >
          <Ionicons name={option.icon} size={17} color={accent} />
          <Text style={[styles.label, { color: theme.text.secondary }]}>
            {i18nText(option.labelKey, option.fallback)}
          </Text>
          <SwitchToggle
            value={value?.[option.key] ?? option.defaultValue}
            onValueChange={(next) => onValueChange(option.key, next)}
            size={24}
            onColor={accent}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 13,
  },
  label: { flex: 1, fontSize: 13.5, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
  },
  chipText: { fontSize: 12.5, fontWeight: "700", flexShrink: 1 },
});
