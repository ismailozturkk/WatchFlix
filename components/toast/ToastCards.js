// components/toast/ToastCards.js
//
// Toast kartlarının İÇERİĞİ (sürükleme/animasyon kabuğu ToastItem.js'te):
//   • StatusCard  success | error | warning | info | loading | premium
//   • BadgeCard   rozet / ödül kutlaması (kendi rozetini çizer)
//
// Yazı sistem yazı boyutuna uyar ama 1,25 katında durur: kart kompakt kalsın, büyük yazı kullanan
// kullanıcı yine de okuyabilsin (eski kart ölçeklemeyi tamamen kapatıyordu).
//
// Ortak kabuk (CardShell): tema yüzeyi + türün rengiyle hafif yıkama, üstte ince vurgu
// çizgisi, altta kalan süreyi gösteren ilerleme çubuğu. Çubuk kendiliğinden kapanan
// toast'ta SOLA doğru erir; kalıcı ("yükleniyor") toast'ta sağa doğru akan belirsiz bir
// parça gösterir.

import React, { memo, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  Extrapolation,
  ZoomIn,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { alpha } from "../../theme/colors";
import { ToastOrb } from "./ToastOrb";
import AppBadge from "../badges/AppBadge";
import { kademeRengi, kademeSekli, rarityStyle } from "../../theme/badgeTokens";
import { paletteFor, paletteFromAccent } from "./toastPalette";

const CARD_RADIUS = 22;

// ── İlerleme çubuğu ──────────────────────────────────────────────────────────
function ToastProgress({ progress, indeterminate, palette }) {
  const slide = useSharedValue(0);
  useEffect(() => {
    if (!indeterminate) return undefined;
    slide.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, false);
    return () => cancelAnimation(slide);
  }, [indeterminate, slide]);

  // Dinlenme değeri GÖRÜNÜR (dolu çubuk); kalan süre `progress` ile eriyip bitince kart zaten kalkar.
  const fillStyle = useAnimatedStyle(() => {
    if (indeterminate) {
      return { width: "34%", left: `${-34 + slide.value * 134}%` };
    }
    const p = Math.max(0, Math.min(1, progress.value));
    return { width: `${p * 100}%`, left: "0%" };
  });

  return (
    <View pointerEvents="none" style={[styles.track, { backgroundColor: palette.trackColor }]}>
      <Animated.View style={[styles.fill, { backgroundColor: palette.main }, fillStyle]} />
    </View>
  );
}

// ── Kabuk ────────────────────────────────────────────────────────────────────
function CardShell({ children, theme, palette, progress, indeterminate, showProgress, onLayoutWidth, overlay }) {
  return (
    <View
      onLayout={onLayoutWidth}
      style={[styles.surface, { backgroundColor: theme.secondary, borderColor: palette.border }]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[palette.washFrom, palette.washTo, "transparent"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={["transparent", palette.main, "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.accentLine}
      />
      {children}
      {overlay}
      {showProgress ? (
        <ToastProgress progress={progress} indeterminate={indeterminate} palette={palette} />
      ) : null}
    </View>
  );
}

// ── Sağ uç: eylem düğmesi ya da kapat ───────────────────────────────────────
function ActionButton({ action, palette, theme, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: alpha(palette.main, pressed ? 0.28 : 0.14),
          borderColor: alpha(palette.main, 0.45),
        },
      ]}
    >
      {action.icon ? <Ionicons name={action.icon} size={14} color={palette.main} /> : null}
      <Text maxFontSizeMultiplier={1.25} numberOfLines={1} style={[styles.actionText, { color: theme.text.primary }]}>
        {action.label}
      </Text>
    </Pressable>
  );
}

function CloseDot({ palette, theme }) {
  return (
    <View style={[styles.closeButton, { backgroundColor: alpha(palette.main, 0.12) }]}>
      <Ionicons name="close" size={15} color={theme.text.secondary} />
    </View>
  );
}

// ── Tekrar sayacı (×2) ───────────────────────────────────────────────────────
function CountPill({ count, palette }) {
  if (!(count > 1)) return null;
  // `key={count}`: sayı her artışta yeniden yaylanarak belirir.
  return (
    <Animated.View
      key={count}
      entering={ZoomIn.springify().damping(11).stiffness(260)}
      style={[styles.countPill, { backgroundColor: palette.deep, borderColor: palette.main }]}
    >
      <Text maxFontSizeMultiplier={1.25} style={styles.countText}>
        ×{count > 9 ? "9+" : count}
      </Text>
    </Animated.View>
  );
}

/**
 * Durum kartı. `onAction`: eylem düğmesine basıldı (kart kapatma + işleyici ToastItem'da).
 */
export const StatusCard = memo(function StatusCard({
  toast,
  theme,
  reduceMotion,
  progress,
  onAction,
}) {
  const palette = paletteFor(toast.kind, theme);
  const sticky = toast.totalMs == null;
  return (
    <CardShell
      theme={theme}
      palette={palette}
      progress={progress}
      indeterminate={sticky}
      showProgress
    >
      <View style={styles.row}>
        <View style={styles.orbHolder}>
          <ToastOrb key={toast.kind} kind={toast.kind} palette={palette} reduceMotion={reduceMotion} />
          <CountPill count={toast.count} palette={palette} />
        </View>

        <View style={styles.textWrap}>
          <Text
            maxFontSizeMultiplier={1.25}
            numberOfLines={2}
            style={[styles.title, { color: theme.text.primary }]}
          >
            {toast.title}
          </Text>
          {toast.message ? (
            <Text
              maxFontSizeMultiplier={1.25}
              numberOfLines={3}
              style={[styles.message, { color: theme.text.secondary }]}
            >
              {toast.message}
            </Text>
          ) : null}
        </View>

        {toast.action ? (
          <ActionButton action={toast.action} palette={palette} theme={theme} onPress={onAction} />
        ) : (
          <CloseDot palette={palette} theme={theme} />
        )}
      </View>
    </CardShell>
  );
});

/**
 * Rozet kartı: ödülün KENDİ rozetini çizer (şekil = aile kademesi, renk = kademe/nadirlik).
 * data: { gorunum: odulGorunumu(), ek?: number, ipucu?: string }
 */
export const BadgeCard = memo(function BadgeCard({ toast, theme, reduceMotion, progress }) {
  const g = toast.data?.gorunum;
  const nadirlik = rarityStyle(g.rarity, theme);
  const sekil = kademeSekli(g.tier, g.aileToplam);
  const kadRenk = kademeRengi(sekil.kademe, theme);
  const vurgu = kadRenk || nadirlik.color;
  const palette = paletteFromAccent(vurgu);

  const pop = useSharedValue(1);
  const wobble = useSharedValue(0);
  const halo = useSharedValue(0);
  const sheen = useSharedValue(0);
  const cardWidth = useSharedValue(360);

  useEffect(() => {
    if (reduceMotion) return;
    pop.value = withSequence(
      withTiming(0.4, { duration: 0 }),
      withDelay(70, withSpring(1, { damping: 8, stiffness: 190, mass: 0.8 })),
    );
    wobble.value = withSequence(
      withTiming(-14, { duration: 0 }),
      withDelay(70, withSpring(0, { damping: 6, stiffness: 150, mass: 0.8 })),
    );
    halo.value = withDelay(120, withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }));
    sheen.value = withDelay(380, withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }));
  }, [toast.id, reduceMotion, pop, wobble, halo, sheen]);

  const medalStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }, { rotate: `${wobble.value}deg` }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(halo.value, [0, 0.04, 1], [0, 0.55, 0], Extrapolation.CLAMP),
    transform: [{ scale: 0.7 + halo.value * 0.9 }],
  }));
  const sheenStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheen.value, [0, 0.08, 0.9, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(sheen.value, [0, 1], [-70, cardWidth.value + 40]) },
      { rotate: "16deg" },
    ],
  }));

  return (
    <CardShell
      theme={theme}
      palette={palette}
      progress={progress}
      indeterminate={false}
      showProgress
      onLayoutWidth={(e) => {
        cardWidth.value = e.nativeEvent.layout.width;
      }}
      overlay={
        <Animated.View pointerEvents="none" style={[styles.sheen, sheenStyle]}>
          <LinearGradient
            colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.26)", "rgba(255,255,255,0)"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      }
    >
      <View style={[styles.row, styles.badgeRow]}>
        <View style={styles.medalHolder}>
          <Animated.View
            pointerEvents="none"
            style={[styles.halo, { backgroundColor: alpha(vurgu, 0.5) }, haloStyle]}
          />
          <Animated.View style={medalStyle}>
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
          </Animated.View>
        </View>

        <View style={styles.textWrap}>
          <Text maxFontSizeMultiplier={1.25} numberOfLines={1} style={[styles.eyebrow, { color: vurgu }]}>
            {toast.title}
          </Text>
          <Text
            maxFontSizeMultiplier={1.25}
            numberOfLines={2}
            style={[styles.badgeTitle, { color: theme.text.primary }]}
          >
            {toast.message}
          </Text>
          {toast.data?.ipucu ? (
            <Text
              maxFontSizeMultiplier={1.25}
              numberOfLines={1}
              style={[styles.message, { color: theme.text.secondary }]}
            >
              {toast.data.ipucu}
            </Text>
          ) : null}
        </View>

        {toast.data?.ek > 0 ? (
          <View style={[styles.ekPill, { backgroundColor: alpha(vurgu, 0.16), borderColor: alpha(vurgu, 0.5) }]}>
            <Text maxFontSizeMultiplier={1.25} style={[styles.ekText, { color: vurgu }]}>
              +{toast.data.ek}
            </Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={16} color={theme.text.secondary} />
      </View>
    </CardShell>
  );
});

const styles = StyleSheet.create({
  surface: {
    width: "100%",
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    overflow: "hidden",
  },
  accentLine: {
    position: "absolute",
    top: 0,
    left: 22,
    right: 22,
    height: 2,
  },
  row: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 13,
    paddingBottom: 15,
    paddingLeft: 13,
    paddingRight: 11,
  },
  badgeRow: { minHeight: 84, gap: 13, paddingLeft: 14 },
  orbHolder: { width: 42, height: 42 },
  medalHolder: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", width: 56, height: 56, borderRadius: 28 },
  sheen: { position: "absolute", top: -24, bottom: -24, left: 0, width: 54 },
  textWrap: { flex: 1, gap: 3, paddingVertical: 1 },
  title: { fontSize: 15, fontWeight: "800", letterSpacing: -0.15, lineHeight: 20 },
  message: { fontSize: 12.5, fontWeight: "500", lineHeight: 17.5 },
  eyebrow: { fontSize: 10.5, fontWeight: "900", letterSpacing: 0.9, textTransform: "uppercase" },
  badgeTitle: { fontSize: 16.5, fontWeight: "900", letterSpacing: -0.2, lineHeight: 21 },
  ekPill: { borderRadius: 9, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3 },
  ekText: { fontSize: 11, fontWeight: "900" },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexShrink: 0,
  },
  actionText: { fontSize: 13, fontWeight: "800" },
  countPill: {
    position: "absolute",
    top: -7,
    right: -9,
    minWidth: 22,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  track: { position: "absolute", left: 0, right: 0, bottom: 0, height: 3 },
  fill: { position: "absolute", top: 0, bottom: 0 },
});
