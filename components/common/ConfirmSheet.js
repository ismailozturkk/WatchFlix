// components/common/ConfirmSheet.js
//
// Tek soruluk onay sayfası (alttan açılır): ikon + başlık + açıklama + iki
// buton. Liste yönetim sayfasının silme adımıyla AYNI dille çizilir —
// uygulamadaki yıkıcı onaylar tek bir görünüşe sahip olsun diye.
//
// Hareket ortak hook'tan gelir: blur yerinde solar, sayfa aşağıdan kayar
// (bkz. hooks/useSheetTransition.js).

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import ModalBlurBackdrop from "./ModalBlurBackdrop";
import useSheetTransition from "@hooks/useSheetTransition";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";

// Yıkıcı eylem paleti — ListManageSheet'in silme adımıyla aynı.
const TONES = {
  danger: { solid: "#ef4444", gradient: ["#f87171", "#ef4444"], on: "#fff" },
  accent: { solid: "#fbbf24", gradient: ["#fbbf24", "#f59e0b"], on: "#000" },
};

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {() => void} props.onClose
 * @param {() => void} props.onConfirm
 * @param {string} props.title
 * @param {string} [props.message]
 * @param {string} [props.icon="alert-circle-outline"]  Ionicons adı.
 * @param {"danger"|"accent"} [props.tone="danger"]
 * @param {string} [props.confirmLabel]
 * @param {string} [props.cancelLabel]
 * @param {boolean} [props.busy]  Onay çalışırken butonda spinner.
 */
export default function ConfirmSheet({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  icon = "alert-circle-outline",
  tone = "danger",
  confirmLabel,
  cancelLabel,
  busy = false,
}) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const sheet = useSheetTransition(visible);
  const palette = TONES[tone] || TONES.danger;

  // Kapanış animasyonu boyunca (≈260 ms) sayfa hâlâ çiziliyor; metinler o
  // sırada boşalmasın diye açıkken son değerler tutulur.
  const [shown, setShown] = useState({ title: "", message: "" });
  useEffect(() => {
    if (visible) setShown({ title, message });
  }, [visible, title, message]);

  return (
    <Modal
      animationType="none"
      transparent
      visible={sheet.mounted}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay} onLayout={sheet.onOverlayLayout}>
        {/* Blur YERİNDE solar — sayfayla birlikte kaymaz. */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: sheet.backdropOpacity }]}
        >
          <ModalBlurBackdrop intensity={30} />
        </Animated.View>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          onLayout={sheet.onSheetLayout}
          style={[
            styles.sheet,
            { backgroundColor: theme.primary, borderColor: theme.border },
            sheet.sheetStyle,
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          <LinearGradient colors={palette.gradient} style={styles.icon}>
            <Ionicons name={icon} size={24} color={palette.on} />
          </LinearGradient>

          <Text style={[styles.title, { color: theme.text.primary }]}>
            {shown.title}
          </Text>
          {shown.message ? (
            <Text style={[styles.message, { color: theme.text.muted }]}>
              {shown.message}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: theme.secondary }]}
              onPress={onClose}
              disabled={busy}
            >
              <Text style={[styles.btnText, { color: theme.text.secondary }]}>
                {cancelLabel ?? t.cancel}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.btn,
                { backgroundColor: palette.solid, opacity: busy ? 0.6 : 1 },
              ]}
              onPress={onConfirm}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator size="small" color={palette.on} />
              ) : (
                <>
                  <Ionicons name={icon} size={15} color={palette.on} />
                  <Text style={[styles.btnText, { color: palette.on }]}>
                    {confirmLabel ?? t.confirm}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 10,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    marginBottom: 8,
    opacity: 0.6,
  },
  icon: {
    alignSelf: "center",
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.2,
  },
  message: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  actions: { flexDirection: "row", gap: 10, marginTop: 6 },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
  },
  btnText: { fontSize: 14, fontWeight: "800" },
});
