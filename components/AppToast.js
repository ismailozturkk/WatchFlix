// components/AppToast.js
//
// Uygulama genelinde tek, tutarlı ve performanslı toast yapısı.
// react-native-toast-message üzerine ince, temalı bir katman.
//
// KURULUM (App.js — bir kez):
//   import { toastConfig } from "@components/AppToast";
//   <Toast config={toastConfig} position="top" visibilityTime={3000} />
//
// KULLANIM (her yerde):
//   import { toast } from "@components/AppToast";
//   toast.success("Kaydedildi", "Değişiklikler uygulandı");
//   toast.error("Hata", "İşlem başarısız");
//   toast.warning("Dikkat");
//   toast.info("Bilgi");
//   toast.hide();
//
// Eski `Toast.show({ type, text1, text2 })` çağrıları da aynen çalışmaya devam eder
// (config bu alanları okur), yani mevcut sayfalar bozulmaz.
//
// Performans/stabilite:
//   - toastConfig MODÜL düzeyinde (her render'da yeniden oluşmaz → <Toast> stabil).
//   - Kart React.memo + tema hook'u içeride (config referansı sabit kalır).
//   - Native sürücülü giriş/çıkış animasyonu kütüphane tarafından yönetilir.

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "react-native-toast-message";
import { useTheme } from "@context/ThemeContext";

const TYPE_META = {
  success: { icon: "checkmark-circle", color: "#22C55E" },
  error: { icon: "alert-circle", color: "#EF4444" },
  warning: { icon: "warning", color: "#F59E0B" },
  info: { icon: "information-circle", color: "#3B82F6" },
};

const ToastCard = React.memo(function ToastCard({ type, text1, text2 }) {
  const { theme } = useTheme();
  const meta = TYPE_META[type] || TYPE_META.info;

  return (
    <Pressable
      onPress={() => Toast.hide()}
      style={[
        styles.card,
        {
          backgroundColor: theme.secondary,
          borderColor: theme.border,
          borderLeftColor: meta.color,
          shadowColor: "#000",
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: meta.color + "22" }]}>
        <Ionicons name={meta.icon} size={20} color={meta.color} />
      </View>
      <View style={styles.textWrap}>
        {text1 ? (
          <Text
            allowFontScaling={false}
            numberOfLines={2}
            style={[styles.title, { color: theme.text.primary }]}
          >
            {text1}
          </Text>
        ) : null}
        {text2 ? (
          <Text
            allowFontScaling={false}
            numberOfLines={3}
            style={[styles.message, { color: theme.text.secondary }]}
          >
            {text2}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});

// ── react-native-toast-message config (MODÜL düzeyinde — stabil referans) ──
export const toastConfig = {
  success: (p) => <ToastCard type="success" text1={p.text1} text2={p.text2} />,
  error: (p) => <ToastCard type="error" text1={p.text1} text2={p.text2} />,
  warning: (p) => <ToastCard type="warning" text1={p.text1} text2={p.text2} />,
  info: (p) => <ToastCard type="info" text1={p.text1} text2={p.text2} />,
};

// ── Programatik API ──
export const showToast = ({ type = "info", title, message, ...rest } = {}) =>
  Toast.show({ type, text1: title, text2: message, ...rest });

export const toast = {
  success: (title, message, opts) => showToast({ type: "success", title, message, ...opts }),
  error: (title, message, opts) => showToast({ type: "error", title, message, ...opts }),
  warning: (title, message, opts) => showToast({ type: "warning", title, message, ...opts }),
  info: (title, message, opts) => showToast({ type: "info", title, message, ...opts }),
  hide: () => Toast.hide(),
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "92%",
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  textWrap: { flex: 1, gap: 2 },
  title: { fontSize: 14.5, fontWeight: "800", letterSpacing: -0.2 },
  message: { fontSize: 12.5, fontWeight: "500", lineHeight: 17 },
});

export default toast;
