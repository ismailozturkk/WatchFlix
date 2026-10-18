// components/home/DiscoverFilterChip.js
//
// "Ne izlesem?" (Filtreli Keşif) çipi: filtre sayfasındaki seçenekler, sonuç ekranındaki etkin süzgeç
// çipleri, ana ekrandaki hazır süzgeç çipleri ve "Şaşırt beni" düğmesi AYNI bileşendir — dört yerde
// dört ayrı çip bakım yükü olurdu.
//
// DÜZ yüzey (cam değil): çipler kaydırılan içeriğin ve bir alt sayfanın içinde duruyor; cam kuralları
// (components/common/GlassSurface.js) burada devreye girmez, opaklık/gölge serbest.
//
// DURUMLAR
//   selected : vurgu rengi (seçili seçenek)
//   filled   : dolu vurgu (birincil eylem — "Filtreler · 2")
//   disabled : tıklanmaz, soluk (tür sınırına ulaşıldı)
//   icon     : Ionicons adı; `trailingIcon` sağda (ör. kaldırma çarpısı)
import React, { memo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { alpha } from "../../theme/colors";

export const DISCOVER_CHIP_HEIGHT = 36;

function DiscoverFilterChip({
  label,
  icon,
  trailingIcon,
  selected = false,
  filled = false,
  disabled = false,
  onPress,
  onLongPress,
  testID,
  accessibilityLabel,
  accessibilityRole = "button",
  style,
}) {
  const { theme } = useTheme();
  const accent = theme.accent ?? "#3B82F6";

  const backgroundColor = filled ? accent : selected ? alpha(accent, 0.16) : theme.secondary;
  const borderColor = filled ? accent : selected ? accent : theme.border;
  const color = filled ? "#FFFFFF" : selected ? theme.text.primary : theme.text.secondary;
  const iconColor = filled ? "#FFFFFF" : selected ? accent : theme.text.muted;

  return (
    <Pressable
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor, borderColor, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={15} color={iconColor} /> : null}
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.label, { color, fontWeight: selected || filled ? "700" : "600" }]}
      >
        {label}
      </Text>
      {trailingIcon ? <Ionicons name={trailingIcon} size={14} color={iconColor} /> : null}
    </Pressable>
  );
}

export default memo(DiscoverFilterChip);

const styles = StyleSheet.create({
  chip: {
    minHeight: DISCOVER_CHIP_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 13,
    borderRadius: DISCOVER_CHIP_HEIGHT / 2,
    borderWidth: 1,
  },
  label: { fontSize: 13, flexShrink: 1 },
});
