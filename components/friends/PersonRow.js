// components/friends/PersonRow.js
//
// Arkadaş / sohbet / arama sonucu satırının ORTAK iskeleti.
//
// Görünüm: satırlar tek bir yuvarlatılmış "grup kartı"nın parçalarıdır — ilk
// satır üst, son satır alt köşeleri yuvarlar, aralarında avatarın hizasından
// başlayan ince ayraç durur. Eskiden her satır kendi çerçeveli kartıydı: 12 satır
// = 12 kutu, ekran gürültülü ve yoğundu.
//
//   first / last → grup içindeki konum (köşe yuvarlama + ayraç)
//   highlighted  → okunmamış vb.: satır vurgu renginde hafifçe aydınlanır
//   meta         → başlığın sağında küçük metin (saat); metaAccent → vurgu rengi
//   trailing     → sağ uçta düğme/rozet alanı

import React, { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import UserAvatar from "@components/common/UserAvatar";
import { useTheme } from "@context/ThemeContext";
import { alpha } from "@theme/colors";

const RADIUS = 20;
const PAD_X = 14;
const AVATAR_GAP = 13;

function PersonRow({
  avatar,
  avatarNode,
  avatarSize = 52,
  ringColor,
  title,
  titleStrong = false,
  subtitle,
  subtitleStrong = false,
  meta,
  metaAccent = false,
  trailing,
  onPress,
  first = true,
  last = true,
  highlighted = false,
  accessibilityLabel,
}) {
  const { theme } = useTheme();
  const text = theme.text?.primary ?? "#fff";
  const muted = theme.text?.muted ?? "#888";

  return (
    <View
      style={[
        styles.cell,
        {
          backgroundColor: theme.secondary,
          borderColor: alpha(theme.border, 0.7),
          borderTopWidth: first ? 1 : 0,
          borderBottomWidth: last ? 1 : 0,
          borderTopLeftRadius: first ? RADIUS : 0,
          borderTopRightRadius: first ? RADIUS : 0,
          borderBottomLeftRadius: last ? RADIUS : 0,
          borderBottomRightRadius: last ? RADIUS : 0,
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? "button" : undefined}
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [
          styles.row,
          highlighted && { backgroundColor: alpha(theme.accent, 0.09) },
          pressed && { backgroundColor: alpha(text, 0.06) },
        ]}
      >
        {avatarNode || (
          <UserAvatar
            {...avatar}
            size={avatarSize}
            borderWidth={ringColor ? 2 : 0}
            borderColor={ringColor || "transparent"}
          />
        )}

        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.title, { color: text, fontWeight: titleStrong ? "800" : "700" }]}
            >
              {title}
            </Text>
            {meta ? (
              <Text
                allowFontScaling={false}
                style={[
                  styles.meta,
                  { color: metaAccent ? theme.accent : muted },
                  metaAccent && styles.metaStrong,
                ]}
              >
                {meta}
              </Text>
            ) : null}
          </View>
          {typeof subtitle === "string" ? (
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[
                styles.subtitle,
                subtitleStrong
                  ? { color: theme.text?.secondary ?? text, fontWeight: "600" }
                  : { color: muted },
              ]}
            >
              {subtitle}
            </Text>
          ) : (
            subtitle || null
          )}
        </View>

        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </Pressable>

      {!last ? (
        <View
          pointerEvents="none"
          style={[
            styles.divider,
            {
              left: PAD_X + avatarSize + AVATAR_GAP,
              backgroundColor: alpha(theme.border, 0.55),
            },
          ]}
        />
      ) : null}
    </View>
  );
}

export default memo(PersonRow);

/** Harf başlığı (A, B, …) — bölümlü listelerde grup kartının üstünde durur. */
export const FriendsSectionLabel = memo(function FriendsSectionLabel({ label, first }) {
  const { theme } = useTheme();
  return (
    <Text
      allowFontScaling={false}
      style={[
        styles.sectionLabel,
        { color: theme.text?.muted ?? "#888", marginTop: first ? 2 : 18 },
      ]}
    >
      {label}
    </Text>
  );
});

const styles = StyleSheet.create({
  cell: {
    marginHorizontal: 16,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: AVATAR_GAP,
    paddingVertical: 12,
    paddingHorizontal: PAD_X,
    minHeight: 76,
  },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flexShrink: 1, fontSize: 15.5, letterSpacing: -0.1 },
  meta: { marginLeft: "auto", fontSize: 11.5, fontWeight: "600" },
  metaStrong: { fontWeight: "800" },
  subtitle: { fontSize: 13 },
  trailing: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 },
  divider: {
    position: "absolute",
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
  sectionLabel: {
    marginLeft: 20,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
});
