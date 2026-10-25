// components/game/DuelReportStatus.js
//
// Günlük sonuç ekranında, kabul edilen düellonun skorlarının sohbete yazılma durumu
// (hooks/useDuelResultReport): yazılıyor → "Skorlar sohbete yazıldı · Ali" + "Sohbeti aç",
// hata → "Yeniden dene". Düello yoksa (`status: "off"`) hiçbir şey çizilmez.

import React, { memo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import GlassPressable from "@components/common/GlassPressable";
import { useLanguage } from "@context/LanguageContext";
import { getDuelCopy } from "@utils/dailyDuelCopy";

const AMBER = "#F59E0B";
const DONE = "#22C55E";

function DuelReportStatus({ status, chatName, onOpenChat, onRetry, theme, style }) {
  const { language } = useLanguage();
  const copy = getDuelCopy(language);
  if (!status || status === "off") return null;

  const failed = status === "failed";
  const sent = status === "sent";
  const action = failed
    ? { label: copy.reportRetry, onPress: onRetry, icon: "refresh" }
    : sent && onOpenChat
      ? { label: copy.openChat, onPress: onOpenChat, icon: "chatbubbles-outline" }
      : null;

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.row, { backgroundColor: theme.secondary, borderColor: failed ? theme.border : sent ? DONE : AMBER }, style]}
    >
      {status === "sending" ? (
        <ActivityIndicator size="small" color={AMBER} />
      ) : (
        <AppIcon
          family="Ionicons"
          name={failed ? "alert-circle" : "checkmark-circle"}
          size={18}
          color={failed ? theme.text.muted : DONE}
        />
      )}
      <Text style={[styles.text, { color: theme.text.primary }]} numberOfLines={2}>
        {failed ? copy.reportFailed : sent ? copy.reportSent(chatName) : copy.reportSending}
      </Text>
      {action ? (
        <GlassPressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          style={[styles.action, { backgroundColor: AMBER }]}
        >
          <AppIcon family="Ionicons" name={action.icon} size={14} color="#FFFFFF" />
          <Text style={styles.actionText} numberOfLines={1}>
            {action.label}
          </Text>
        </GlassPressable>
      ) : null}
    </View>
  );
}

export default memo(DuelReportStatus);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  text: { flex: 1, fontSize: 13, fontWeight: "700", lineHeight: 17 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 32,
    paddingHorizontal: 11,
    borderRadius: 16,
  },
  actionText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
});
