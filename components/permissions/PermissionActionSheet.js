// components/permissions/PermissionActionSheet.js
//
// Ayarlar > İzinlerim: izin isterken, kalıcı reddedilmiş izni açarken ve izni geri
// çekerken açılan sayfa. Düzeni bildirim ön-açıklamasıyla (NotificationPrimingSheet)
// aynı: üstte sahne, başlık + açıklama, satırlar, sabit altta düğmeler.
//
//   mode "request" → neyin karşılığında izin verildiği; ana düğme sistem diyaloğunu açar.
//   mode "blocked" → sistem artık sormuyor; ana düğme sistem ayarlarını açar.
//   mode "revoke"  → kapatınca ne değişeceği; ana düğme sistem ayarlarını açar
//                    (işletim sistemi uygulamanın kendi iznini kapatmasına izin vermez).
//
// KARAR BURADA DEĞİL: hangi kipin açılacağını ve düğmelerin ne yapacağını
// PermissionsSection belirler. Sistem diyaloğu/ayarları sayfa TAM kapandıktan sonra
// açılır (`onDismissed`): iOS kapanan Modal'ın üstünde sunum yapamaz.

import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppIcon from "@components/AppIcon";
import BottomSheetModal from "../common/BottomSheetModal";
import PressableScale from "../cineswipe/PressableScale";
import PermissionHero, { SheetGlow } from "./PermissionHero";
import { getPermissionSheetCopy } from "./permissionSheetCopy";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import useReduceMotion from "../../hooks/useReduceMotion";
import { alpha } from "../../theme/colors";
import { isLightSurface, shiftLightness } from "../../utils/colorUtils";

const GAIN_ICONS = {
  notifications: ["alarm-outline", "chatbubble-ellipses-outline", "heart-outline"],
  mediaLibrary: ["download-outline", "eye-off-outline", "hand-left-outline"],
};
const LOSE_ICONS = {
  notifications: ["notifications-off-outline", "volume-mute-outline"],
  mediaLibrary: ["close-circle-outline", "images-outline"],
};
const HERO_ICONS = {
  notifications: { request: "notifications", blocked: "notifications-off", revoke: "notifications-off" },
  mediaLibrary: { request: "images", blocked: "lock-closed", revoke: "images" },
};

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {"notifications"|"mediaLibrary"} props.kind
 * @param {"request"|"blocked"|"revoke"} props.mode
 * @param {() => void} props.onPrimary
 * @param {() => void} props.onClose
 * @param {() => void} [props.onDismissed]  Sayfa tamamen kapanınca.
 */
export default function PermissionActionSheet({ visible, kind, mode, onPrimary, onClose, onDismissed }) {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  const copy = getPermissionSheetCopy(language);
  const kindCopy = copy[kind] || copy.notifications;
  const revoke = mode === "revoke";
  const tone = revoke ? theme.colors.red : theme.accent;
  const foreground = isLightSurface(tone) ? "#111827" : "#FFFFFF";
  const rows = revoke ? kindCopy.lose : kindCopy.gain;
  const rowIcons = (revoke ? LOSE_ICONS : GAIN_ICONS)[kind] || [];
  const title = revoke ? kindCopy.revokeTitle : mode === "blocked" ? kindCopy.blockedTitle : kindCopy.requestTitle;
  const body = revoke ? kindCopy.revokeBody : mode === "blocked" ? kindCopy.blockedBody : kindCopy.requestBody;
  const primary = revoke ? copy.shared.revokeAction : mode === "blocked" ? copy.shared.openSettings : kindCopy.allow;
  const footnote = mode === "request" ? copy.shared.requestFootnote : copy.shared.settingsFootnote;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      sheetStyle={[styles.sheet, { backgroundColor: theme.primary, borderColor: theme.border }]}
    >
      <SheetGlow accent={tone} isLightTheme={isLightSurface(theme.primary)} />
      <LinearGradient
        pointerEvents="none"
        colors={[alpha(tone, 0), alpha(tone, 0.75), alpha(tone, 0)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topLine}
      />
      <View style={[styles.grabber, { backgroundColor: alpha(theme.text.muted, 0.4) }]} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
      >
        <PermissionHero icon={HERO_ICONS[kind]?.[mode] || "shield-checkmark"} tone={tone} animate={!reduceMotion} />
        <Text accessibilityRole="header" style={[styles.title, { color: theme.text.primary }]}>
          {title}
        </Text>
        <Text style={[styles.subtitle, { color: theme.text.secondary }]}>{body}</Text>

        <View style={styles.rows}>
          {rows.map((row, index) => (
            <View
              key={row.t}
              style={[styles.row, { backgroundColor: theme.secondary, borderColor: theme.border }]}
            >
              <View style={[styles.rowIcon, { backgroundColor: alpha(tone, 0.16) }]}>
                <AppIcon name={rowIcons[index] || "ellipse-outline"} size={20} color={tone} />
              </View>
              <View style={styles.rowCopy}>
                <Text numberOfLines={1} style={[styles.rowTitle, { color: theme.text.primary }]}>
                  {row.t}
                </Text>
                <Text numberOfLines={2} style={[styles.rowDesc, { color: theme.text.muted }]}>
                  {row.d}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 10 }]}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={primary}
          onPress={onPrimary}
          scaleTo={0.97}
          style={[styles.primary, { backgroundColor: tone, shadowColor: tone }]}
        >
          <View style={styles.primaryClip}>
            <LinearGradient
              colors={[shiftLightness(tone, 8), tone, shiftLightness(tone, -14)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.primaryIcon, { backgroundColor: alpha(foreground, 0.16) }]}>
              <AppIcon name={mode === "request" ? "checkmark" : "settings-outline"} size={16} color={foreground} />
            </View>
            <Text numberOfLines={1} style={[styles.primaryText, { color: foreground }]}>
              {primary}
            </Text>
          </View>
        </PressableScale>

        <PressableScale accessibilityRole="button" onPress={onClose} scaleTo={0.96} style={styles.ghost}>
          <Text style={[styles.ghostText, { color: theme.text.secondary }]}>
            {mode === "request" ? copy.shared.notNow : copy.shared.cancel}
          </Text>
        </PressableScale>

        <View style={styles.footnoteRow}>
          <AppIcon name="information-circle-outline" size={14} color={theme.text.muted} />
          <Text style={[styles.footnote, { color: theme.text.muted }]}>{footnote}</Text>
        </View>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  // `maxHeight` yüzdesi çözülür çünkü sayfa kaplayıcının DOĞRUDAN çocuğu.
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: "hidden",
    paddingTop: 10,
  },
  topLine: { position: "absolute", top: 0, left: 0, right: 0, height: 1.5 },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 6 },
  scroll: { flexShrink: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 8 },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.4,
    textAlign: "center",
    marginTop: 2,
  },
  subtitle: { fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 8, paddingHorizontal: 6 },
  rows: { marginTop: 18, gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  rowIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  rowCopy: { flex: 1 },
  rowTitle: { fontSize: 14.5, fontWeight: "700" },
  rowDesc: { fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  footer: { paddingHorizontal: 20, paddingTop: 14 },
  // Gölge dış kabukta, kırpma iç kabukta: iOS `overflow: hidden` ile gölgeyi keser.
  primary: {
    height: 56,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryClip: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 14,
  },
  primaryIcon: { width: 28, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  primaryText: { flexShrink: 1, fontSize: 16, fontWeight: "800", letterSpacing: 0.1 },
  ghost: { marginTop: 6, height: 46, alignItems: "center", justifyContent: "center" },
  ghostText: { fontSize: 14.5, fontWeight: "600" },
  footnoteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 2,
    paddingHorizontal: 8,
  },
  footnote: { flexShrink: 1, fontSize: 11.5, lineHeight: 16, textAlign: "center" },
});
