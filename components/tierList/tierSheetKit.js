// components/tierList/tierSheetKit.js
//
// Tier list sayfalarının ortak kabuğu ve küçük parçaları:
//   TierSheet      BottomSheetModal + tutamak + başlık satırı (kapat düğmeli) + kaydırılan gövde + sabit alt alan
//   SheetButton    birincil / ikincil / tehlikeli tam genişlik düğme (GlassPillButton)
//   SheetLabel     küçük büyük-harf alan başlığı
//
// iOS iki Modal kuralı: sayfadan başka bir Modal / sistem penceresi açılacaksa iş `onDismissed`'te başlar
// (bkz. components/common/BottomSheetModal.js). Bu kabuk yalnız çizer; sıralamayı çağıran yönetir.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import BottomSheetModal from "@components/common/BottomSheetModal";
import GlassCloseButton from "@components/common/GlassCloseButton";
import GlassPillButton from "@components/common/GlassPillButton";
import SheetScroll from "@components/common/SheetScroll";
import { GLASS_PRESS_ROOM } from "../../utils/liquidGlass";
import { upperText } from "@utils/i18nText";

export function TierSheet({ visible, onClose, onDismissed, theme, title, subtitle, footer, scroll = true, children }) {
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
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: theme.text.muted }]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <GlassCloseButton size={34} fallbackRadius={12} iconSize={19} color={theme.text.secondary} onPress={onClose} />
      </View>
      {scroll ? (
        <SheetScroll style={styles.scrollRoom} contentContainerStyle={styles.scrollRoomContent}>
          {children}
        </SheetScroll>
      ) : (
        <View style={styles.fixed}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </BottomSheetModal>
  );
}

export function SheetButton({ theme, label, icon, onPress, tone = "primary", disabled, loading, style, accessibilityLabel }) {
  const fill = tone === "danger" ? "#E5484D" : tone === "primary" ? theme.accent : theme.between;
  const ink = tone === "secondary" ? theme.text.primary : "#FFFFFF";
  return (
    <GlassPillButton
      label={label}
      icon={icon}
      iconSize={17}
      onPress={onPress}
      tint={tone === "secondary" ? undefined : fill}
      color={ink}
      disabledColor={theme.text.muted}
      height={48}
      fontSize={15}
      fallbackRadius={16}
      fallbackStyle={{ backgroundColor: fill }}
      disabled={disabled}
      loading={loading}
      accessibilityLabel={accessibilityLabel || label}
      style={style}
    />
  );
}

export function SheetLabel({ theme, text, style }) {
  return <Text style={[styles.label, { color: theme.text.muted }, style]}>{upperText(text)}</Text>;
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 26,
    maxHeight: "90%",
  },
  handle: { width: 42, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 18, fontWeight: "900", letterSpacing: -0.2 },
  subtitle: { fontSize: 12.5, fontWeight: "600", marginTop: 2, lineHeight: 17 },
  scrollRoom: { marginTop: -GLASS_PRESS_ROOM, flexShrink: 1 },
  scrollRoomContent: { paddingTop: GLASS_PRESS_ROOM, paddingBottom: 4 },
  fixed: { flexShrink: 1 },
  footer: { paddingTop: 12, gap: 8 },
  label: { fontSize: 11, fontWeight: "900", letterSpacing: 0.9, marginTop: 14, marginBottom: 8 },
});
