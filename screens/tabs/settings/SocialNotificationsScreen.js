// screens/tabs/settings/SocialNotificationsScreen.js
//
// Ayarlar > Bildirimler > Sosyal & mesajlar. Arkadaşlık, mesaj, beğeni, yorum,
// bahsetme bildirim türleri. Ana anahtar (tüm bildirimler) burada da var.
// (DEV) tek cihazla arka plan push zincirini test eden buton da burada.

import React, { useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import SwitchToggle from "@components/SwitchToggle";
import AppIcon from "@components/AppIcon";
import { appAlert } from "@components/AppAlert";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { useNotificationSettings } from "@context/AppSettingsContext";
import { useDeviceNotifications } from "@context/DeviceNotificationsContext";
import { auth, db } from "../../../firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { SettingsSubScreen, SettingRow, buildUiColors } from "./settingsUi";

const NOTIFICATION_ROWS = [
  {
    key: "friendRequestsEnabled",
    titleKey: "friendRequestNotifications",
    subtitleKey: "friendRequestNotificationsSubtitle",
    iconName: "person-add-outline",
    colorKey: "blue",
    bgKey: "iconBlue",
  },
  {
    key: "friendAcceptedEnabled",
    titleKey: "friendAcceptedNotifications",
    subtitleKey: "friendAcceptedNotificationsSubtitle",
    iconName: "people-outline",
    colorKey: "green",
    bgKey: "iconGreen",
  },
  {
    key: "messagesEnabled",
    titleKey: "messageNotifications",
    subtitleKey: "messageNotificationsSubtitle",
    iconName: "chatbubble-ellipses-outline",
    colorKey: "teal",
    bgKey: "iconTeal",
  },
  {
    key: "postLikesEnabled",
    titleKey: "postLikeNotifications",
    subtitleKey: "postLikeNotificationsSubtitle",
    iconName: "heart-outline",
    colorKey: "amber",
    bgKey: "iconAmber",
  },
  {
    key: "postCommentsEnabled",
    titleKey: "postCommentNotifications",
    subtitleKey: "postCommentNotificationsSubtitle",
    iconName: "chatbox-outline",
    colorKey: "purple",
    bgKey: "iconPurple",
  },
  {
    key: "mentionsEnabled",
    titleKey: "mentionNotifications",
    subtitleKey: "mentionNotificationsSubtitle",
    iconName: "at-outline",
    colorKey: "blue",
    bgKey: "iconBlue",
  },
];

export default function SocialNotificationsScreen() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const C = buildUiColors(theme);
  const { notificationSettings, changeNotificationSettings } =
    useNotificationSettings();
  const { permissionStatus, requestPermission } = useDeviceNotifications();

  const notificationsEnabled = notificationSettings.enabled;
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

  // ── DEV-ONLY: arka plan push zincirini tek cihazla test eder ──
  const [sendingTestPush, setSendingTestPush] = useState(false);
  const handleSendTestPush = async () => {
    if (sendingTestPush) return;
    const uid = auth.currentUser?.uid;
    if (!uid) {
      appAlert("Test push", "Oturum açık değil.");
      return;
    }
    setSendingTestPush(true);
    try {
      await addDoc(collection(db, "Users", uid, "notifications"), {
        type: "post_like",
        fromUid: uid,
        fromName: "Test (kendin)",
        fromAvatarIndex: 0,
        read: false,
        createdAt: serverTimestamp(),
      });
      appAlert(
        "Test push gönderildi",
        "Şimdi uygulamayı TAMAMEN kapat. Birkaç saniye içinde arka plan bildirimi gelmeli. Loglar: firebase functions:log",
      );
    } catch (e) {
      appAlert("Test push hatası", e?.message || String(e));
    } finally {
      setSendingTestPush(false);
    }
  };

  return (
    <SettingsSubScreen title={t.socialNotificationGroup}>
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
        {NOTIFICATION_ROWS.map((row, index) => (
          <SettingRow
            key={row.key}
            colors={C}
            iconBg={C[row.bgKey]}
            iconColor={C[row.colorKey]}
            iconName={row.iconName}
            title={t[row.titleKey]}
            subtitle={t[row.subtitleKey]}
            last={index === NOTIFICATION_ROWS.length - 1 && !__DEV__}
            right={
              <SwitchToggle
                value={notificationsEnabled && notificationSettings[row.key]}
                onValueChange={(value) => updateNotifications({ [row.key]: value })}
                disabled={!notificationsEnabled}
                size={36}
              />
            }
          />
        ))}
        {__DEV__ && (
          <SettingRow
            colors={C}
            iconBg={C.iconBlue}
            iconColor={C.blue}
            iconName={sendingTestPush ? "hourglass-outline" : "paper-plane-outline"}
            title="Test push gönder (bana)"
            subtitle="DEV-only · arka plan push zincirini test eder"
            last
            onPress={handleSendTestPush}
            right={
              sendingTestPush ? (
                <ActivityIndicator size="small" color={C.blue} />
              ) : (
                <AppIcon name="chevron-forward" size={16} color={C.muted} />
              )
            }
          />
        )}
      </View>
    </SettingsSubScreen>
  );
}

const ns = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
});
