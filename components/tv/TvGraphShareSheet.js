// components/tv/TvGraphShareSheet.js
//
// Bölüm grafiği ekranının paylaş seçenekleri: akışta paylaş · sohbete gönder. Üstte kartın önizlemesi (alıcının
// göreceği hâl). Seçim YALNIZ kaydedilir; işi ekran sayfa tamamen kapandıktan sonra (`onDismissed(choice)`) yapar —
// sohbet alıcı sayfası açık bir Modal'ın üstüne iOS'ta sunulamaz (components/common/BottomSheetModal.js).

import React, { useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import GlassTouchable from "@components/common/GlassTouchable";
import { TierSheet } from "@components/tierList/tierSheetKit";
import { i18nText } from "@utils/i18nText";
import TvGraphShareCard from "./TvGraphShareCard";

const OPTIONS = [
  { id: "feed", icon: "newspaper", color: "#5EEAD4" },
  { id: "chat", icon: "paper-plane", color: "#FF7F7F" },
];

const copyOf = (id) =>
  id === "feed"
    ? {
        title: i18nText("autoI18n.tvgraph_akista", "Akışta paylaş"),
        sub: i18nText(
          "autoI18n.tvgraph_akista_alt",
          "Paylaşımlar'da gönderi olarak yayımla",
        ),
      }
    : {
        title: i18nText("autoI18n.tvgraph_sohbete", "Sohbete gönder"),
        sub: i18nText(
          "autoI18n.tvgraph_sohbete_alt",
          "Bir arkadaşına ya da gruba gönder",
        ),
      };

export default function TvGraphShareSheet({
  visible,
  graph,
  theme,
  onClose,
  onDismissed,
}) {
  const choice = useRef(null);
  const pick = (id) => {
    choice.current = id;
    onClose();
  };
  return (
    <TierSheet
      visible={visible}
      onClose={onClose}
      onDismissed={() => {
        const picked = choice.current;
        choice.current = null;
        onDismissed?.(picked);
      }}
      theme={theme}
      title={i18nText("autoI18n.tvgraph_paylas", "Grafiği paylaş")}
    >
      {graph ? (
        <TvGraphShareCard
          graph={graph}
          maxGraphHeight={220}
          style={styles.preview}
          testID="tvgraph-share-preview"
        />
      ) : null}
      <View
        style={[
          styles.list,
          { backgroundColor: theme.between, borderColor: theme.border },
        ]}
      >
        {OPTIONS.map((option, index) => {
          const copy = copyOf(option.id);
          return (
            <GlassTouchable
              key={option.id}
              glass={false}
              activeOpacity={0.7}
              onPress={() => pick(option.id)}
              accessibilityRole="button"
              accessibilityLabel={copy.title}
              testID={`tvgraph-share-${option.id}`}
              style={[
                styles.row,
                index < OPTIONS.length - 1 && {
                  borderBottomColor: theme.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
              ]}
            >
              <View style={[styles.icon, { backgroundColor: option.color }]}>
                <AppIcon
                  family="Ionicons"
                  name={option.icon}
                  size={18}
                  color="#1A1A1A"
                />
              </View>
              <View style={styles.copy}>
                <Text
                  style={[styles.title, { color: theme.text.primary }]}
                  numberOfLines={1}
                >
                  {copy.title}
                </Text>
                <Text
                  style={[styles.sub, { color: theme.text.muted }]}
                  numberOfLines={2}
                >
                  {copy.sub}
                </Text>
              </View>
              <AppIcon
                family="Ionicons"
                name="chevron-forward"
                size={18}
                color={theme.text.muted}
              />
            </GlassTouchable>
          );
        })}
      </View>
    </TierSheet>
  );
}

const styles = StyleSheet.create({
  preview: { marginBottom: 12 },
  list: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: "800" },
  sub: { fontSize: 12, fontWeight: "600", marginTop: 2, lineHeight: 16 },
});
