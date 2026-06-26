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
  Modal,
  Animated,
  Dimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@context/ThemeContext";
import { i18nText } from "@utils/i18nText";

const { width: SCREEN_W } = Dimensions.get("window");

// Tür → ikon + renk. 'confirm' rengi render'da theme.accent ile değişir.
const ALERT_TYPES = {
  info: { icon: "information-circle", color: "#3B82F6" },
  success: { icon: "checkmark-circle", color: "#22C55E" },
  warning: { icon: "warning", color: "#F59E0B" },
  error: { icon: "alert-circle", color: "#EF4444" },
  confirm: { icon: "help-circle", color: "#6C63FF" },
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

  const scale = useRef(new Animated.Value(0.9)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    listener = (payload) => {
      setData(payload);
      setVisible(true);
    };
    if (queue.length) {
      setData(queue.shift());
      setVisible(true);
    }
    return () => {
      listener = null;
    };
  }, []);

  useEffect(() => {
    if (visible) {
      openHaptic(data?.type);
      scale.setValue(0.9);
      backdrop.setValue(0);
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          damping: 18,
          stiffness: 220,
          mass: 0.8,
        }),
        Animated.timing(backdrop, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const close = useCallback(
    (cb) => {
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 0.92,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(backdrop, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setVisible(false);
        if (typeof cb === "function") cb();
      });
    },
    [scale, backdrop],
  );

  if (!data) return null;
  const { title, message, buttons, options, type } = data;
  const meta = ALERT_TYPES[type] || ALERT_TYPES.info;
  const iconColor = type === "confirm" ? theme.accent : meta.color;

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
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onBackdrop}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
        <BlurView
          tint="dark"
          intensity={18}
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={onBackdrop} />
      </Animated.View>

      <View style={styles.center} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: theme.secondary,
              borderColor: theme.border,
              transform: [{ scale }],
            },
          ]}
        >
          {/* Tür ikonu */}
          <View style={[styles.iconCircle, { backgroundColor: iconColor + "1F" }]}>
            <Ionicons name={meta.icon} size={30} color={iconColor} />
          </View>

          {title ? (
            <Text allowFontScaling={false} style={[styles.title, { color: theme.text.primary }]}>
              {title}
            </Text>
          ) : null}
          {message ? (
            <Text allowFontScaling={false} style={[styles.message, { color: theme.text.secondary }]}>
              {message}
            </Text>
          ) : null}

          <View style={[styles.buttons, stacked && styles.buttonsCol]}>
            {buttons.map((b, i) => {
              const destructive = b.style === "destructive";
              const cancel = b.style === "cancel";
              const bg = cancel
                ? "transparent"
                : destructive
                  ? "#EF444418"
                  : theme.accent + "1A";
              const fg = destructive
                ? "#EF4444"
                : cancel
                  ? theme.text.muted
                  : theme.accent;
              return (
                <Pressable
                  key={i}
                  onPress={() => pressButton(b)}
                  style={({ pressed }) => [
                    styles.btn,
                    stacked && styles.btnFull,
                    {
                      backgroundColor: bg,
                      borderColor: cancel ? theme.border : "transparent",
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text allowFontScaling={false} style={[styles.btnText, { color: fg }]}>
                    {b.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 28 },
  card: {
    width: Math.min(SCREEN_W - 56, 380),
    borderRadius: 22,
    borderWidth: 1,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 24,
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  title: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3, textAlign: "center" },
  message: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
  },
  buttons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  buttonsCol: { flexDirection: "column" },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  btnFull: { flex: 0, width: "100%" },
  btnText: { fontSize: 15, fontWeight: "700" },
});

export default appAlert;
