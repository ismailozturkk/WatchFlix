// components/cineswipe/CineSheet.js
//
// CineSwipe alt sayfalarının ortak kabuğu. Hareket ve blur kuralı
// components/common/BottomSheetModal.js'te (blur yerinde solar, sayfa kayar);
// burası yalnızca başlık satırı, kaydırılabilir gövde ve alt çubuk düzenini
// verir. Beş sayfada kopyalanan ~60 satırlık Modal/blur/başlık kodunun yerini alır.
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheetModal from "../common/BottomSheetModal";
import AppIcon from "../AppIcon";
import GlassCloseButton from "../common/GlassCloseButton";
import PressableScale from "./PressableScale";
import { cineColors } from "./cineTheme";
import useCineCopy from "./useCineCopy";
import { useTheme } from "../../context/ThemeContext";
import { alpha } from "../../theme/colors";

/**
 * @param {string} [icon]        Başlık rozeti ikonu.
 * @param {string} [iconColor]
 * @param {React.ReactNode} [headerRight]  Verilmezse kapat düğmesi.
 * @param {React.ReactNode} [footer]       Kaydırmanın dışında, altta sabit.
 * @param {boolean} [scroll=true]
 */
export default function CineSheet({
  visible,
  onClose,
  icon,
  iconColor,
  title,
  subtitle,
  headerRight,
  footer,
  scroll = true,
  maxHeight = "88%",
  intensity = 38,
  contentContainerStyle,
  children,
}) {
  const { theme } = useTheme();
  const colors = cineColors(theme);
  const copy = useCineCopy();
  const insets = useSafeAreaInsets();
  const tint = iconColor || colors.accent;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      intensity={intensity}
      sheetStyle={[
        styles.sheet,
        {
          backgroundColor: theme.primary,
          borderColor: theme.border,
          maxHeight,
          paddingBottom: Math.max(insets.bottom, 16),
        },
      ]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />

      {title ? (
        <View style={[styles.header, { borderBottomColor: alpha(colors.text, 0.08) }]}>
          {icon ? (
            <View style={[styles.headerIcon, { backgroundColor: alpha(tint, 0.15) }]}>
              <AppIcon family="Ionicons" name={icon} size={19} color={tint} />
            </View>
          ) : null}
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {headerRight || (
            <GlassCloseButton
              size={34}
              fallbackRadius={17}
              iconSize={19}
              color={colors.textSecondary}
              backgroundColor={alpha(colors.text, 0.07)}
              accessibilityLabel={copy.close}
              onPress={onClose}
            />
          )}
        </View>
      ) : null}

      {scroll ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
      {footer}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 16,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    marginBottom: 12,
    opacity: 0.6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  content: {
    paddingTop: 14,
    paddingBottom: 10,
  },
});
