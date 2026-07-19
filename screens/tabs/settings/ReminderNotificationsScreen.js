// screens/tabs/settings/ReminderNotificationsScreen.js
//
// Ayarlar > Bildirimler > Hatırlatmalar. Yerel hatırlatma bildirimleri
// (film/dizi/not) + zamanlama (lead-time) + Android pil optimizasyonu uyarısı.
// Ana anahtar (tüm bildirimler) burada da var — hem hatırlatma hem sosyal onu paylaşır.

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import SwitchToggle from "@components/SwitchToggle";
import AppIcon from "@components/AppIcon";
import BatteryOptimizationNotice from "@components/BatteryOptimizationNotice";
import { appAlert } from "@components/AppAlert";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { useNotificationSettings } from "@context/AppSettingsContext";
import { useDeviceNotifications } from "@context/DeviceNotificationsContext";
import { SettingsSubScreen, SettingRow, buildUiColors } from "./settingsUi";

const REMINDER_NOTIFICATION_TIMINGS = [
  { labelKey: "onReleaseDay", value: 0 },
  { labelKey: "oneDayBefore", value: 1 },
  { labelKey: "threeDaysBefore", value: 3 },
  { labelKey: "oneWeekBefore", value: 7 },
];

export default function ReminderNotificationsScreen() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const C = buildUiColors(theme);
  const { notificationSettings, changeNotificationSettings } =
    useNotificationSettings();
  const { permissionStatus, requestPermission } = useDeviceNotifications();

  const notificationsEnabled = notificationSettings.enabled;
  const remindersEnabled =
    notificationsEnabled && notificationSettings.remindersEnabled;
  const updateNotifications = (patch) => changeNotificationSettings(patch);

  const handleToggleMaster = async (enabled) => {
    updateNotifications({ enabled });
    if (enabled && permissionStatus !== "granted") {
      const granted = await requestPermission();
      if (!granted) appAlert(t.notifPermissionTitle, t.notifPermissionMessage);
    }
  };

  const masterSubtitle =
    notificationsEnabled && permissionStatus === "denied"
      ? t.notifPermissionDenied
      : t.allNotificationsSubtitle;

  return (
    <SettingsSubScreen title={t.reminderNotificationGroup}>
      <View
        style={[
          ns.card,
          { backgroundColor: C.card, borderColor: C.border, marginTop: 8 },
        ]}
      >
        <SettingRow
          colors={C}
          iconBg={C.iconBlue}
          iconColor={C.blue}
          iconName={
            notificationsEnabled
              ? "notifications-outline"
              : "notifications-off-outline"
          }
          title={t.allNotifications}
          subtitle={masterSubtitle}
          right={
            <SwitchToggle
              value={notificationsEnabled}
              onValueChange={handleToggleMaster}
              size={36}
            />
          }
        />
        <SettingRow
          colors={C}
          iconBg={C.iconGreen}
          iconColor={C.green}
          iconName="alarm-outline"
          title={t.reminderNotifications}
          subtitle={t.reminderNotificationsSubtitle}
          right={
            <SwitchToggle
              value={remindersEnabled}
              onValueChange={(v) => updateNotifications({ remindersEnabled: v })}
              disabled={!notificationsEnabled}
              size={36}
            />
          }
        />
        <SettingRow
          colors={C}
          iconBg={C.iconAmber}
          iconColor={C.amber}
          iconName="film-outline"
          title={t.movieReminderNotifications}
          subtitle={t.movieReminderNotificationsSubtitle}
          right={
            <SwitchToggle
              value={remindersEnabled && notificationSettings.moviesEnabled}
              onValueChange={(v) => updateNotifications({ moviesEnabled: v })}
              disabled={!remindersEnabled}
              size={36}
            />
          }
        />
        <SettingRow
          colors={C}
          iconBg={C.iconPurple}
          iconColor={C.purple}
          iconName="tv-outline"
          title={t.tvReminderNotifications}
          subtitle={t.tvReminderNotificationsSubtitle}
          right={
            <SwitchToggle
              value={remindersEnabled && notificationSettings.tvShowsEnabled}
              onValueChange={(v) => updateNotifications({ tvShowsEnabled: v })}
              disabled={!remindersEnabled}
              size={36}
            />
          }
        />
        <SettingRow
          colors={C}
          iconBg={C.iconTeal}
          iconColor={C.teal}
          iconName="document-text-outline"
          title={t.noteReminderNotifications}
          subtitle={t.noteReminderNotificationsSubtitle}
          right={
            <SwitchToggle
              value={remindersEnabled && notificationSettings.noteRemindersEnabled}
              onValueChange={(v) =>
                updateNotifications({ noteRemindersEnabled: v })
              }
              disabled={!remindersEnabled}
              size={36}
            />
          }
        />
        <SettingRow
          colors={C}
          iconBg={C.iconBlue}
          iconColor={C.blue}
          iconName="play-circle-outline"
          title={t.streamingNotifications || "Yayına gelince bildir"}
          subtitle={
            t.streamingNotificationsSubtitle ||
            "İzleme listendeki yapım, abone olduğun platforma eklenince haber ver"
          }
          right={
            <SwitchToggle
              value={notificationsEnabled && notificationSettings.streamingEnabled}
              onValueChange={(v) => updateNotifications({ streamingEnabled: v })}
              disabled={!notificationsEnabled}
              size={36}
            />
          }
        />
        <View style={ns.notificationTiming}>
          <View style={ns.notificationTimingHeader}>
            <View style={[ns.iconWrap, { backgroundColor: C.iconGreen }]}>
              <AppIcon name="time-outline" size={15} color={C.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text allowFontScaling={false} style={[ns.rowTitle, { color: C.text }]}>
                {t.reminderNotificationTiming}
              </Text>
              <Text allowFontScaling={false} style={[ns.rowSub, { color: C.muted }]}>
                {t.reminderNotificationTimingSubtitle}
              </Text>
            </View>
          </View>
          <View
            style={[
              ns.segment,
              ns.notificationTimingSegment,
              { backgroundColor: C.cardAlt, borderTopColor: C.border },
            ]}
          >
            {REMINDER_NOTIFICATION_TIMINGS.map((item) => {
              const active = notificationSettings.leadTimeDays === item.value;
              return (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    ns.segOpt,
                    active && remindersEnabled && { backgroundColor: C.accent },
                    !remindersEnabled && { opacity: 0.45 },
                  ]}
                  disabled={!remindersEnabled}
                  onPress={() => updateNotifications({ leadTimeDays: item.value })}
                  activeOpacity={0.7}
                >
                  <Text
                    allowFontScaling={false}
                    style={[
                      ns.segText,
                      {
                        color: active && remindersEnabled ? C.white : C.muted,
                        fontWeight: active && remindersEnabled ? "700" : "500",
                      },
                    ]}
                  >
                    {t[item.labelKey]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        {/* Android: pil optimizasyonu yerel hatırlatmaları engelleyebilir */}
        <BatteryOptimizationNotice colors={C} />
      </View>
    </SettingsSubScreen>
  );
}

const ns = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowTitle: { fontSize: 14, fontWeight: "500" },
  rowSub: { fontSize: 11, marginTop: 2 },
  notificationTiming: { paddingTop: 13 },
  notificationTimingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  notificationTimingSegment: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  segment: {
    flexDirection: "row",
    borderTopWidth: 1,
    padding: 4,
    gap: 2,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  segOpt: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 10,
  },
  segText: { fontSize: 11, textAlign: "center" },
});
