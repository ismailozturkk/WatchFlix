// components/profile/ProfileNotificationsButton.js
//
// Profil başlığındaki bildirim kutusu girişi: 36 pt'lik İKON düğmesi (Düzenle / Paylaş ile
// aynı boy), okunmamış sayısı köşede kırmızı rozetle. Eskiden profilin altında tam genişlik
// bir kartlı satırdı. ProfileIdentityBlock'a `notificationsAction` olarak verilir.
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import GlassIconButton from "../common/GlassIconButton";
import { useUserProfile } from "../../context/UserProfileContext";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { notificationInboxCopy } from "../../utils/notificationInboxCopy";
import { alpha } from "../../theme/colors";
import useNoteReminderInbox from "../../hooks/useNoteReminderInbox";

export default function ProfileNotificationsButton({
  navigation,
  size = 36,
  iconSize,
  fallbackRadius,
  hitSlop = 4,
}) {
  const { profile } = useUserProfile();
  const { theme } = useTheme();
  const { language } = useLanguage();
  const copy = notificationInboxCopy(language);
  // Sunucu sayacı + cihazda çalan, henüz okunmamış not hatırlatmaları.
  const { unreadCount: reminderCount } = useNoteReminderInbox();
  const count = Math.max(0, Number(profile?.unreadNotifsCount) || 0) + reminderCount;
  const resolvedSize = Number(size) > 0 ? Number(size) : 36;
  const resolvedIconSize = iconSize ?? Math.max(13, Math.round(resolvedSize * 0.5));
  const resolvedRadius = fallbackRadius ?? Math.max(8, Math.round(resolvedSize / 3));
  const compactBadge = resolvedSize < 32;
  return (
    <GlassIconButton
      testID="profile-notifications-button"
      icon="notifications-outline"
      iconSize={resolvedIconSize}
      size={resolvedSize}
      fallbackRadius={resolvedRadius}
      color={theme.text.primary}
      hitSlop={hitSlop}
      fallbackStyle={{
        backgroundColor: theme.secondary,
        borderColor: alpha(theme.border, 0.9),
        borderWidth: 1,
      }}
      accessibilityLabel={`${copy.title}. ${copy.summary(count)}`}
      onPress={() => navigation.navigate("NotificationsScreen")}
      overlay={
        count > 0 ? (
          <View pointerEvents="none" style={[styles.badge, compactBadge && styles.badgeCompact]}>
            <Text allowFontScaling={false} style={[styles.badgeText, compactBadge && styles.badgeTextCompact]}>
              {count > 99 ? "99+" : count}
            </Text>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  // Rozet düğmenin sağ üst köşesine biner (cam çocuğu kırptığı için `overlay`).
  badge: {
    position: "absolute",
    top: -5,
    right: -6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: "#D92D45",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeCompact: {
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
  },
  badgeText: { color: "#fff", fontWeight: "800", fontSize: 10 },
  badgeTextCompact: { fontSize: 9 },
});
