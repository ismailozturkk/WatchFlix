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
import { LinearGradient } from "expo-linear-gradient";
import Toast from "react-native-toast-message";
import { useTheme } from "@context/ThemeContext";
import AppBadge from "@components/badges/AppBadge";
import { kademeRengi, kademeSekli, rarityStyle } from "@theme/badgeTokens";

const TYPE_META = {
  success: { icon: "checkmark", color: "#22C55E", softColor: "#86EFAC" },
  error: { icon: "close", color: "#EF4444", softColor: "#FDA4AF" },
  warning: { icon: "alert", color: "#F59E0B", softColor: "#FCD34D" },
  info: { icon: "information", color: "#3B82F6", softColor: "#7DD3FC" },
};

const ToastCard = React.memo(function ToastCard({ type, text1, text2, onPress }) {
  const { theme } = useTheme();
  const meta = TYPE_META[type] || TYPE_META.info;

  return (
    <Pressable
      // `onPress` (Toast.show seçeneği) varsa kapanmadan ÖNCE çalışır; yoksa eski
      // davranış: dokununca kapanır.
      onPress={() => {
        Toast.hide();
        onPress?.();
      }}
      accessibilityRole="button"
      accessibilityLabel={[text1, text2].filter(Boolean).join(". ")}
      style={[
        styles.card,
        {
          backgroundColor: theme.secondary,
          borderColor: `${meta.color}38`,
          shadowColor: "#000",
        },
      ]}
    >
      <View style={styles.cardClip}>
        <LinearGradient
          pointerEvents="none"
          colors={[`${meta.color}1F`, `${meta.color}08`, "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          pointerEvents="none"
          colors={[meta.softColor, meta.color, `${meta.color}00`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.accentLine}
        />

        <LinearGradient
          colors={[meta.softColor, meta.color]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.iconWrap, { shadowColor: meta.color }]}
        >
          <Ionicons name={meta.icon} size={19} color="#FFFFFF" />
        </LinearGradient>

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

        <View style={[styles.closeButton, { backgroundColor: `${meta.color}12` }]}>
          <Ionicons name="close" size={16} color={theme.text.secondary} />
        </View>
      </View>
    </Pressable>
  );
});

// ── ROZET kartı ──────────────────────────────────────────────────────────────
// Kazanılan ödülün KENDİ rozetini çizer (şekil = aile kademesi, renk = kademe/
// nadirlik): düz "tik" ikonlu başarı toast'ı rozet kazanmayı sıradan bir kayıt
// işlemiyle aynı seviyeye indiriyordu. Dokununca Toast.show'un `onPress` seçeneği
// çalışır (rozet sayfasını o rozet açık olarak açar).
//
// props: { gorunum: odulGorunumu(), ek?: number, ipucu?: string }
const BadgeToastCard = React.memo(function BadgeToastCard({ text1, text2, props, onPress }) {
  const { theme } = useTheme();
  const g = props?.gorunum;
  if (!g) return null;
  const nadirlik = rarityStyle(g.rarity, theme);
  const sekil = kademeSekli(g.tier, g.aileToplam);
  const kadRenk = kademeRengi(sekil.kademe, theme);
  const vurgu = kadRenk || nadirlik.color;

  return (
    <Pressable
      onPress={() => {
        Toast.hide();
        onPress?.();
      }}
      accessibilityRole="button"
      accessibilityLabel={[text1, text2].filter(Boolean).join(". ")}
      style={[
        styles.card,
        { backgroundColor: theme.secondary, borderColor: `${vurgu}55`, shadowColor: vurgu },
      ]}
    >
      <View style={[styles.cardClip, styles.badgeClip]}>
        <LinearGradient
          pointerEvents="none"
          colors={[`${vurgu}30`, `${vurgu}0D`, "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          pointerEvents="none"
          colors={["transparent", vurgu, "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.accentLine}
        />

        <AppBadge
          glyph={g.icon}
          glyphSolid={g.iconSolid}
          rarity={g.rarity}
          unlocked
          size={56}
          sides={sekil.kenar}
          color={kadRenk}
          ornate={sekil.ornate}
        />

        <View style={styles.textWrap}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.eyebrow, { color: vurgu }]}
          >
            {text1}
          </Text>
          <Text
            allowFontScaling={false}
            numberOfLines={2}
            style={[styles.badgeTitle, { color: theme.text.primary }]}
          >
            {text2}
          </Text>
          {props?.ipucu ? (
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.message, { color: theme.text.secondary }]}
            >
              {props.ipucu}
            </Text>
          ) : null}
        </View>

        {props?.ek > 0 ? (
          <View style={[styles.ekPill, { backgroundColor: `${vurgu}22`, borderColor: `${vurgu}55` }]}>
            <Text allowFontScaling={false} style={[styles.ekText, { color: vurgu }]}>
              +{props.ek}
            </Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={16} color={theme.text.secondary} />
      </View>
    </Pressable>
  );
});

// ── react-native-toast-message config (MODÜL düzeyinde — stabil referans) ──
export const toastConfig = {
  success: (p) => <ToastCard type="success" text1={p.text1} text2={p.text2} onPress={p.onPress} />,
  error: (p) => <ToastCard type="error" text1={p.text1} text2={p.text2} onPress={p.onPress} />,
  warning: (p) => <ToastCard type="warning" text1={p.text1} text2={p.text2} onPress={p.onPress} />,
  info: (p) => <ToastCard type="info" text1={p.text1} text2={p.text2} onPress={p.onPress} />,
  badge: (p) => <BadgeToastCard text1={p.text1} text2={p.text2} props={p.props} onPress={p.onPress} />,
};

// ── Programatik API ──
export const showToast = ({ type = "info", title, message, ...rest } = {}) =>
  Toast.show({ type, text1: title, text2: message, ...rest });

export const toast = {
  success: (title, message, opts) => showToast({ type: "success", title, message, ...opts }),
  error: (title, message, opts) => showToast({ type: "error", title, message, ...opts }),
  warning: (title, message, opts) => showToast({ type: "warning", title, message, ...opts }),
  info: (title, message, opts) => showToast({ type: "info", title, message, ...opts }),
  // Rozet/ödül kutlaması: ödülün kendi rozetini çizer. `props` için badge kartının
  // başındaki sözleşmeye bak. Normal toast'tan uzun kalır (okumak + dokunmak için).
  badge: (title, message, props, opts) =>
    showToast({ type: "badge", title, message, props, visibilityTime: 5200, ...opts }),
  hide: () => Toast.hide(),
};

const styles = StyleSheet.create({
  card: {
    width: "92%",
    maxWidth: 520,
    alignSelf: "center",
    borderRadius: 20,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 10,
  },
  cardClip: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 13,
    paddingRight: 11,
    borderRadius: 19,
    overflow: "hidden",
  },
  accentLine: {
    position: "absolute",
    top: 0,
    left: 20,
    right: 20,
    height: 2,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 7,
    elevation: 4,
  },
  badgeClip: { minHeight: 82, paddingVertical: 13, paddingLeft: 14, gap: 13 },
  eyebrow: { fontSize: 10.5, fontWeight: "900", letterSpacing: 0.9, textTransform: "uppercase" },
  badgeTitle: { fontSize: 16.5, fontWeight: "900", letterSpacing: -0.2, lineHeight: 21 },
  ekPill: { borderRadius: 9, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3 },
  ekText: { fontSize: 11, fontWeight: "900" },
  textWrap: { flex: 1, gap: 3, paddingVertical: 1 },
  title: { fontSize: 14.5, fontWeight: "800", letterSpacing: -0.15, lineHeight: 19 },
  message: { fontSize: 12.5, fontWeight: "500", lineHeight: 17.5 },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default toast;
