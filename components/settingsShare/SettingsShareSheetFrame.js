// components/settingsShare/SettingsShareSheetFrame.js
//
// "Görünümümü paylaş" gönderme ve uygulama sayfalarının ORTAK iskeleti:
//
//   ┌ tutamaç
//   │ başlık (simge + başlık + alt yazı)          ← sabit
//   │ ┌ SheetScroll (önizleme + bölüm satırları) ← küçülür, kayar
//   │ └
//   │ [Vazgeç] [Ana eylem]                         ← sabit
//   └ alt güvenli alan payı
//
// Yükseklik sınırı utils/settingsShareLayout.js'ten: sayfa durum çubuğuna asla
// değmez (eskiden sınır yoktu, uzun içerikte tepesi durum çubuğunun altına
// giriyordu). Stil `sheetStyle`e verilir — maxHeight transform sarmalayıcısında
// çözülsün; içerik doğrudan çocuk olur (bkz. components/common/BottomSheetModal.js).
// Tablet / geniş ekranda sayfa ortalanır ve SHEET_MAX_WIDTH'i aşmaz.

import React from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import BottomSheetModal from "../common/BottomSheetModal";
import SheetScroll from "../common/SheetScroll";
import GlassPressable from "../common/GlassPressable";
import { useTheme } from "../../context/ThemeContext";
import { buildUiColors } from "../../screens/tabs/settings/settingsUi";
import { alpha } from "../../theme/colors";
import { settingsSheetLayout } from "../../utils/settingsShareLayout";

/** Ekran boyuna göre sayfa ölçüleri (önizlemenin büyüklüğü/afiş sayısı dahil). */
export function useSettingsSheetLayout() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return settingsSheetLayout({ width, height, insetTop: insets.top, insetBottom: insets.bottom });
}

export default function SettingsShareSheetFrame({
  visible,
  onClose,
  onDismissed,
  icon,
  title,
  subtitle,
  cancelLabel,
  confirmLabel,
  confirmIcon,
  confirmTestID,
  confirmDisabled = false,
  onConfirm,
  children,
}) {
  const { theme } = useTheme();
  const C = buildUiColors(theme);
  const layout = useSettingsSheetLayout();

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      intensity={35}
      dimColor="rgba(0,0,0,0.38)"
      sheetStyle={[
        styles.sheet,
        {
          backgroundColor: C.card,
          borderColor: C.border,
          maxHeight: layout.maxHeight,
          width: layout.width,
          paddingBottom: layout.paddingBottom,
        },
        layout.centered && styles.centered,
      ]}
    >
      <View style={[styles.handle, { backgroundColor: C.handle }]} />

      <View style={styles.head}>
        <View style={[styles.headIcon, { backgroundColor: C.accentDim }]}>
          <Ionicons name={icon} size={21} color={C.accent} />
        </View>
        <View style={styles.headCopy}>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.headTitle, { color: C.text }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text allowFontScaling={false} numberOfLines={2} style={[styles.headSub, { color: C.muted }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <SheetScroll contentContainerStyle={styles.scrollContent}>
        {children}
      </SheetScroll>

      <View style={styles.actions}>
        <GlassPressable
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [styles.cancelBtn, { borderColor: C.border }, pressed && styles.pressed]}
        >
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.cancelText, { color: C.muted }]}>
            {cancelLabel}
          </Text>
        </GlassPressable>
        <GlassPressable
          testID={confirmTestID}
          accessibilityRole="button"
          accessibilityState={{ disabled: confirmDisabled }}
          disabled={confirmDisabled}
          onPress={onConfirm}
          style={({ pressed }) => [
            styles.confirmBtn,
            // Cam yolunda stildeki opacity düşer; pasif hâl zeminin tonuyla anlatılır.
            { backgroundColor: confirmDisabled ? alpha(C.accent, 0.4) : C.accent },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name={confirmIcon} size={17} color="#FFFFFF" />
          <Text allowFontScaling={false} numberOfLines={1} style={styles.confirmText}>
            {confirmLabel}
          </Text>
        </GlassPressable>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 9,
  },
  centered: { alignSelf: "center" },
  handle: { width: 42, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  head: { flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 12 },
  headIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  headCopy: { flex: 1, minWidth: 0 },
  headTitle: { fontSize: 17, fontWeight: "800" },
  headSub: { fontSize: 12, fontWeight: "600", lineHeight: 17, marginTop: 3 },
  scrollContent: { paddingBottom: 4 },
  actions: { flexDirection: "row", gap: 11, marginTop: 12 },
  pressed: { opacity: 0.8 },
  cancelBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  cancelText: { fontSize: 14.5, fontWeight: "800" },
  confirmBtn: {
    flex: 2,
    minHeight: 50,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 10,
  },
  confirmText: { color: "#FFFFFF", fontSize: 14.5, fontWeight: "900", flexShrink: 1 },
});
