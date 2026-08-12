// components/AppAlert.js
//
// Uygulama genelinde React Native Alert.alert yerine MODERN, temalı modal.
// İmperatif API (her yerden, component dışından da çağrılabilir) + tek root host.
//
// KURULUM (App.js — bir kez, ThemeProvider içinde):
//   import { AppAlertHost } from "@components/AppAlert";
//   <AppAlertHost />
//
// KULLANIM (Alert.alert ile AYNI imza — mekanik değişim):
//   import { appAlert } from "@components/AppAlert";
//   appAlert("Başlık", "Mesaj", [
//     { text: "Vazgeç", style: "cancel" },
//     { text: "Sil", style: "destructive", onPress: () => ... },
//   ]);
//   appAlert("Bilgi", "Tek butonlu");   // → otomatik "Tamam"

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "@services/hapticsService";
import { useTheme } from "@context/ThemeContext";
import { i18nText } from "@utils/i18nText";
import BottomSheetModal from "./common/BottomSheetModal";

// Tür → ikon + vurgu geçişi. 'confirm' rengi render'da theme.accent olur.
const ALERT_TYPES = {
  info: {
    icon: "information-circle-outline",
    gradient: ["#60A5FA", "#2563EB"],
  },
  success: {
    icon: "checkmark-circle-outline",
    gradient: ["#4ADE80", "#16A34A"],
  },
  warning: {
    icon: "warning-outline",
    gradient: ["#FBBF24", "#F97316"],
  },
  error: {
    icon: "alert-circle-outline",
    gradient: ["#F87171", "#DC2626"],
  },
  confirm: {
    icon: "help-circle-outline",
    gradient: ["#8B5CF6", "#6D5DFB"],
  },
};

// options.type açıkça verilmişse onu kullan; yoksa butonlardan çıkar:
// destructive varsa 'warning', 2+ buton varsa 'confirm', aksi halde 'info'.
function resolveAlertType(options, buttons) {
  if (options?.type && ALERT_TYPES[options.type]) return options.type;
  if (buttons.some((b) => b.style === "destructive")) return "warning";
  if (buttons.length >= 2) return "confirm";
  return "info";
}

function openHaptic(type) {
  try {
    const N = Haptics.NotificationFeedbackType;
    if (type === "success") Haptics.notificationAsync(N.Success);
    else if (type === "error") Haptics.notificationAsync(N.Error);
    else if (type === "warning" || type === "confirm") Haptics.notificationAsync(N.Warning);
    else Haptics.selectionAsync();
  } catch (e) {}
}

// ── İmperatif kontrolcü ──────────────────────────────────────────────────────
let listener = null;
const queue = [];

/**
 * Alert.alert(title, message?, buttons?, options?) ile uyumlu.
 * @param {string} title
 * @param {string} [message]
 * @param {Array<{text:string,onPress?:Function,style?:'default'|'cancel'|'destructive'}>} [buttons]
 * @param {{cancelable?:boolean}} [options]
 */
export function appAlert(title, message, buttons, options) {
  const btns =
    Array.isArray(buttons) && buttons.length
      ? buttons
      : [{ text: i18nText("autoI18n.tamam", "Tamam") }];
  const payload = {
    title: title ?? "",
    message: message ?? "",
    buttons: btns,
    options: options || {},
    type: resolveAlertType(options, btns),
  };
  if (listener) listener(payload);
  else queue.push(payload); // host henüz hazır değilse kuyruğa al
}

export function AppAlertHost() {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState(null);

  // Görünür bir alert varken gelenler burada bekler; kapanınca sıradaki
  // gösterilir. Önceki davranış: yeni alert görünenin içeriğini anında ezer,
  // ilkinin buton callback'leri kaybolurdu; mount kuyruğundan da yalnız ilk
  // kayıt gösterilir, kalanı sonsuza dek asılı kalırdı.
  const pendingRef = useRef([]);
  const visibleRef = useRef(false);
  const closingRef = useRef(false);
  const closeTimerRef = useRef(null);

  const showNow = (payload) => {
    setData(payload);
    setVisible(true);
    visibleRef.current = true;
    closingRef.current = false;
  };

  useEffect(() => {
    listener = (payload) => {
      if (visibleRef.current) pendingRef.current.push(payload);
      else showNow(payload);
    };
    if (queue.length) {
      const first = queue.shift();
      pendingRef.current.push(...queue.splice(0));
      showNow(first);
    }
    return () => {
      listener = null;
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (visible) openHaptic(data?.type);
  }, [visible, data?.type]);

  const close = useCallback(
    (cb) => {
      if (closingRef.current) return;
      closingRef.current = true;
      setVisible(false);
      // BottomSheetModal kapanış hareketini 260 ms'de tamamlar. İçerik ve
      // callback bu pencere boyunca korunur; sıradaki uyarı ancak sonra açılır.
      closeTimerRef.current = setTimeout(() => {
        visibleRef.current = false;
        if (typeof cb === "function") cb();
        const next = pendingRef.current.shift();
        if (next) showNow(next);
        else closingRef.current = false;
      }, 280);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (!data) return null;
  const { title, message, buttons, options, type } = data;
  const meta = ALERT_TYPES[type] || ALERT_TYPES.info;
  const iconGradient =
    type === "confirm" ? [theme.accent, theme.accent] : meta.gradient;

  const pressButton = (btn) => {
    try {
      Haptics.impactAsync(
        btn.style === "destructive"
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light,
      );
    } catch (e) {}
    close(btn.onPress);
  };

  const onBackdrop = () => {
    if (options?.cancelable === false) return;
    const cancelBtn = buttons.find((b) => b.style === "cancel");
    close(cancelBtn?.onPress);
  };

  const stacked = buttons.length > 2;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onBackdrop}
      intensity={30}
      dimColor="rgba(0,0,0,0.18)"
      dismissOnBackdropPress={options?.cancelable !== false}
      liftWithKeyboard={false}
      sheetStyle={[
        styles.sheet,
        { backgroundColor: theme.primary, borderColor: theme.border },
      ]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />
      <LinearGradient colors={iconGradient} style={styles.iconCircle}>
        <Ionicons name={meta.icon} size={28} color="#FFFFFF" />
      </LinearGradient>

      {title ? (
        <Text
          allowFontScaling={false}
          style={[styles.title, { color: theme.text.primary }]}
        >
          {title}
        </Text>
      ) : null}
      {message ? (
        <Text
          allowFontScaling={false}
          style={[styles.message, { color: theme.text.secondary }]}
        >
          {message}
        </Text>
      ) : null}

      <View style={[styles.buttons, stacked && styles.buttonsCol]}>
        {buttons.map((b, i) => {
          const destructive = b.style === "destructive";
          const cancel = b.style === "cancel";
          const bg = cancel
            ? theme.secondary
            : destructive
              ? "#EF4444"
              : theme.accent;
          const fg = cancel ? theme.text.secondary : "#FFFFFF";
          return (
            <Pressable
              key={`${b.text}-${i}`}
              accessibilityRole="button"
              onPress={() => pressButton(b)}
              style={({ pressed }) => [
                styles.btn,
                stacked && styles.btnFull,
                {
                  backgroundColor: bg,
                  borderColor: cancel ? theme.border : bg,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
            >
              <Text
                allowFontScaling={false}
                style={[styles.btnText, { color: fg }]}
              >
                {b.text}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 28,
  },
  handle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 18,
    opacity: 0.65,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 13,
  },
  title: {
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: -0.35,
    textAlign: "center",
  },
  message: {
    fontSize: 13.5,
    fontWeight: "500",
    lineHeight: 19.5,
    textAlign: "center",
    marginTop: 7,
    paddingHorizontal: 6,
  },
  buttons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  buttonsCol: { flexDirection: "column" },
  btn: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  btnFull: { flex: 0, width: "100%" },
  btnText: { fontSize: 14.5, fontWeight: "800" },
});

export default appAlert;
