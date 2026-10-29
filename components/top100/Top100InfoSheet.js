// components/top100/Top100InfoSheet.js
//
// Seelogd Top 100 "nasıl çalışır?" sayfası: ekranın üst kartındaki ünlem düğmesinden açılır.
// Sıralama modeli, adil puan, oy verme, aramadan oy ve kaydet/paylaş — metinler utils/top100Copy.js `infoSections`.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import BottomSheetModal from "@components/common/BottomSheetModal";
import GlassCloseButton from "@components/common/GlassCloseButton";
import GlassTouchable from "@components/common/GlassTouchable";
import SheetScroll from "@components/common/SheetScroll";
import { useTheme } from "@context/ThemeContext";
import { GLASS_PRESS_ROOM } from "../../utils/liquidGlass";

const GOLD = "#F59E0B";

export default function Top100InfoSheet({ visible, copy, onClose }) {
  const { theme } = useTheme();
  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      intensity={35}
      dimColor="rgba(0,0,0,0.35)"
      sheetStyle={[styles.sheet, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />
      <SheetScroll style={styles.scrollRoom} contentContainerStyle={styles.scrollRoomContent}>
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: `${GOLD}22` }]}>
            <AppIcon family="Ionicons" name="alert-circle" size={20} color={GOLD} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.title, { color: theme.text.primary }]}>{copy.infoTitle}</Text>
            <Text style={[styles.subtitle, { color: theme.text.muted }]}>{copy.heroBody}</Text>
          </View>
          <GlassCloseButton size={34} fallbackRadius={12} iconSize={19} color={theme.text.secondary} onPress={onClose} />
        </View>

        <View style={styles.sections}>
          {copy.infoSections.map((section) => (
            <View key={section.title} style={[styles.item, { borderColor: theme.border, backgroundColor: theme.primary }]}>
              <View style={[styles.itemIcon, { backgroundColor: `${theme.accent}1F` }]}>
                <AppIcon family="Ionicons" name={section.icon} size={16} color={theme.accent} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.itemTitle, { color: theme.text.primary }]}>{section.title}</Text>
                <Text style={[styles.itemBody, { color: theme.text.secondary }]}>{section.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <GlassTouchable
          glass={false}
          onPress={onClose}
          accessibilityRole="button"
          style={[styles.cta, { backgroundColor: theme.accent }]}
        >
          <Text style={styles.ctaText}>{copy.gotIt}</Text>
        </GlassTouchable>
      </SheetScroll>
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
    maxHeight: "88%",
  },
  handle: { width: 42, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  // Kapat düğmesi kaydırma bölgesinin en üstünde: basılınca kırpılmasın (bkz. SaveSharedListModal).
  scrollRoom: { marginTop: -GLASS_PRESS_ROOM },
  scrollRoomContent: { paddingTop: GLASS_PRESS_ROOM },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 11 },
  iconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, fontWeight: "900" },
  subtitle: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  sections: { gap: 8, marginTop: 16 },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  itemIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  itemTitle: { fontSize: 14, fontWeight: "900" },
  itemBody: { fontSize: 12.5, lineHeight: 18, marginTop: 3 },
  cta: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 16 },
  ctaText: { color: "#fff", fontSize: 15, fontWeight: "900" },
});
