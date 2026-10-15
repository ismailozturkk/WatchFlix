// components/friends/FriendsEmptyState.js
//
// Arkadaş ekranlarının ortak boş durumu: yumuşak renkli ikon madalyonu, başlık,
// açıklama ve (varsa) tek bir çağrı düğmesi. Eskiden boş ekran yalnız soluk bir
// ikon + tek satır metindi; kullanıcıya NE YAPABİLECEĞİNİ söylemiyordu.

import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@context/ThemeContext";
import { alpha } from "@theme/colors";
import PillButton from "./PillButton";

function FriendsEmptyState({
  icon,
  tone,
  title,
  description,
  actionLabel,
  actionIcon,
  onAction,
  art,
}) {
  const { theme } = useTheme();
  const color = tone || theme.accent;

  return (
    <View style={styles.wrap}>
      {/* `art` (ör. Lottie) verilirse ikon madalyonunun YERİNE çizilir. */}
      {art || (
        <View style={[styles.ring, { borderColor: alpha(color, 0.18) }]}>
          <View style={[styles.medallion, { backgroundColor: alpha(color, 0.13) }]}>
            <Ionicons name={icon} size={36} color={color} />
          </View>
        </View>
      )}
      <Text
        allowFontScaling={false}
        style={[styles.title, { color: theme.text?.primary ?? "#fff" }]}
      >
        {title}
      </Text>
      {description ? (
        <Text style={[styles.description, { color: theme.text?.muted ?? "#888" }]}>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <PillButton
          label={actionLabel}
          icon={actionIcon}
          variant="primary"
          tone={color}
          onPress={onAction}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

export default memo(FriendsEmptyState);

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    paddingBottom: 72,
  },
  ring: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  medallion: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "800", textAlign: "center", letterSpacing: -0.2 },
  description: { fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 8 },
  action: { marginTop: 22, minWidth: 180 },
});
