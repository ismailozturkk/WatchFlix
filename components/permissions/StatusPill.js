// components/permissions/StatusPill.js
//
// İzin durum rozeti (Verildi / Reddedildi / Belirsiz). PermissionsSection satırları
// ve CalendarPermissionSheet başlığı aynı görünümü paylaşır.

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import AppIcon from "@components/AppIcon";

export default function StatusPill({ status, colors: C, t }) {
  let label = t.permUndetermined || "Belirsiz";
  let color = C.muted;
  let bg = C.borderMuted;
  let icon = "help-circle-outline";
  if (status === "granted") {
    label = t.permGranted || "Verildi";
    color = C.green;
    bg = C.iconGreen;
    icon = "checkmark-circle";
  } else if (status === "denied") {
    label = t.permDenied || "Reddedildi";
    color = C.danger;
    bg = C.dangerDim;
    icon = "close-circle";
  }
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <AppIcon name={icon} size={12} color={color} />
      <Text allowFontScaling={false} style={[styles.pillText, { color }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 9,
    fontWeight: "700",
  },
});
