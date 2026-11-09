import React from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import GlassTouchable from "../common/GlassTouchable";
import { alpha } from "@theme/colors";
import { isLightSurface } from "@utils/colorUtils";

// Film ve dizi detayındaki liste işlemlerinin kompakt hücresi. Dört hücre TEK
// yatay satırda yan yana durur (ListView / ListViewTv): üstte ikon yuvası,
// altta tek satırlık etiket, sağ üst köşede küçük durum rozeti
// (+ ekle · ✓ eklendi · ▶ kısmen · 🔒 kilitli · sayı = seçili liste).
// `compact` kipi MediaQuickActionsSheet içinde (opaklığı animasyonlu üst katman)
// kullanıldığı için GlassSurface kural 1 gereği cam yalnızca tam detay ekranında açılır.
export default function DetailListActionTile({
  label,
  color,
  active = false,
  locked = false,
  kind = "toggle",
  activeIcon = "checkmark",
  theme,
  compact = false,
  scale,
  opacity,
  badge,
  onPress,
  children,
}) {
  const tone = color || theme?.accent || "#3B82F6";
  const light = isLightSurface(theme?.primary || "#000000");
  const primaryText = theme?.text?.primary || "#FFFFFF";
  const secondaryText = theme?.text?.secondary || primaryText;
  const mutedText = theme?.text?.muted || "#888888";
  const surface = theme?.secondary || "#181B22";
  const border = theme?.border || "#303641";

  const surfaceColor = locked
    ? alpha(surface, light ? 0.72 : 0.56)
    : active
      ? alpha(tone, light ? 0.12 : 0.15)
      : alpha(surface, light ? 0.94 : 0.78);

  const borderColor = locked
    ? alpha(border, 0.6)
    : active
      ? alpha(tone, light ? 0.42 : 0.5)
      : alpha(border, 0.9);

  const wellBg = locked
    ? alpha(mutedText, 0.11)
    : alpha(tone, active ? (light ? 0.18 : 0.24) : light ? 0.1 : 0.13);

  const labelColor = locked ? mutedText : active ? tone : secondaryText;
  const longLabel = typeof label === "string" && label.length > 15;

  const renderCorner = () => {
    const orbStyle = [styles.cornerOrb, compact && styles.cornerOrbCompact];

    if (kind === "sheet") {
      if (!(badge > 0)) return null;
      return (
        <View
          style={[
            styles.countPill,
            compact && styles.countPillCompact,
            { backgroundColor: tone },
          ]}
        >
          <Text
            allowFontScaling={false}
            style={[styles.countText, compact && styles.countTextCompact]}
          >
            {badge}
          </Text>
        </View>
      );
    }

    if (locked) {
      return (
        <View style={[orbStyle, { backgroundColor: alpha(mutedText, 0.16) }]}>
          <Ionicons name="lock-closed" size={compact ? 7.5 : 8.5} color={mutedText} />
        </View>
      );
    }

    if (active) {
      const isPlay = activeIcon === "play";
      return (
        <View style={[orbStyle, { backgroundColor: tone }]}>
          <Ionicons
            name={activeIcon}
            size={isPlay ? (compact ? 7 : 8) : compact ? 8.5 : 9.5}
            color="#FFFFFF"
            style={isPlay ? styles.playNudge : null}
          />
        </View>
      );
    }

    return (
      <View
        style={[
          orbStyle,
          { backgroundColor: alpha(primaryText, light ? 0.07 : 0.1) },
        ]}
      >
        <Ionicons name="add" size={compact ? 9.5 : 10.5} color={mutedText} />
      </View>
    );
  };

  const content = (
    <>
      <Animated.View
        style={[
          styles.iconWell,
          compact && styles.iconWellCompact,
          { backgroundColor: wellBg },
          {
            transform: [{ scale: scale || 1 }],
            opacity: opacity === undefined ? 1 : opacity,
          },
        ]}
      >
        {children}
      </Animated.View>

      <Text
        allowFontScaling={false}
        // Dört hücre ~75 dp: TR/EN etiketleri tek satırda küçülerek sığar;
        // "Lista de seguimiento" (es/pt) gibi uzunlar iki satıra iner, satırdaki
        // öteki hücreler `alignItems: stretch` ile aynı yüksekliğe uzar.
        numberOfLines={longLabel ? 2 : 1}
        adjustsFontSizeToFit
        minimumFontScale={longLabel ? 0.86 : 0.74}
        style={[
          styles.label,
          compact && styles.labelCompact,
          active && !locked && styles.labelActive,
          { color: labelColor },
        ]}
      >
        {label}
      </Text>

      {renderCorner()}
    </>
  );

  const tileStyle = [
    styles.tile,
    compact && styles.tileCompact,
    { backgroundColor: surfaceColor, borderColor },
  ];

  if (!onPress) return <View style={tileStyle}>{content}</View>;
  return (
    <GlassTouchable
      glass={!compact}
      onPress={onPress}
      activeOpacity={0.82}
      style={tileStyle}
      accessibilityRole="button"
      accessibilityLabel={badge > 0 ? `${label} (${badge})` : label}
      accessibilityState={{ selected: active, disabled: locked }}
    >
      {content}
    </GlassTouchable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 0,
    minHeight: 64,
    paddingTop: 9,
    paddingBottom: 8,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 16,
  },
  tileCompact: {
    minHeight: 54,
    paddingTop: 7,
    paddingBottom: 6,
    paddingHorizontal: 4,
    gap: 4,
    borderRadius: 14,
  },
  iconWell: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWellCompact: {
    width: 26,
    height: 26,
    borderRadius: 9,
  },
  label: {
    alignSelf: "stretch",
    textAlign: "center",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: -0.15,
  },
  labelCompact: {
    fontSize: 10,
    lineHeight: 13,
  },
  labelActive: {
    fontWeight: "800",
  },
  cornerOrb: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 15,
    height: 15,
    borderRadius: 7.5,
    alignItems: "center",
    justifyContent: "center",
  },
  cornerOrbCompact: {
    top: 4,
    right: 4,
    width: 13,
    height: 13,
    borderRadius: 6.5,
  },
  playNudge: { marginLeft: 1 },
  countPill: {
    position: "absolute",
    top: 5,
    right: 5,
    minWidth: 16,
    height: 15,
    borderRadius: 7.5,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  countPillCompact: {
    top: 4,
    right: 4,
    minWidth: 14,
    height: 13,
    borderRadius: 6.5,
    paddingHorizontal: 3.5,
  },
  countText: {
    color: "#FFFFFF",
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "800",
  },
  countTextCompact: {
    fontSize: 8,
    lineHeight: 10,
  },
});
