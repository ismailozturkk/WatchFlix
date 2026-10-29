// components/floatingNotice/FloatingNoticeCard.js
//
// Yüzen bildirimin açık hâli: ekranın üstünde toast gibi duran kart. Kabuk FloatingNoticeHost'ta;
// burada yalnız çizim, giriş/çıkış hareketi ve sürükleme.
//
// HAREKET
//   • Giriş: yeni bildirim yukarıdan iner (toast); simgeden açılınca simgenin yerinden büyür.
//   • Çıkış: küçülerek kenardaki simgenin yerine süzülür ("dock"); yanıtlanan son bildirim yukarı
//     solar ("away"). Çıkış türü SON çizimdeki `exitTo` ile seçilir — host önce türü verir, sonra kaldırır.
//   • Yukarı ya da yana sürüklemek kartı simgeye küçültür (kapatmaz: davette seçim zorunlu).
//   Giriş/çıkış Reanimated YERLEŞİM animasyonu (dış görünüm), sürükleme iç görünümde: iki animasyon
//   aynı `transform`u ezmesin. Dinlenme değerleri görünür (kayma 0, opaklık 1) — bkz.
//   memory "Reanimated ilk-değer kaybolması": animasyonlu stilin ilk değeri her çizimde geri yazılabilir.
//
// Düğmeler bilerek cam DEĞİL: atanın opaklığı animasyonlu (cam opaklıkla soldurulamaz; ToastCards ile aynı).

import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "../AppIcon";
import { alpha } from "../../theme/colors";
import { NOTICE_KIND, morphToDock, noticeAppearance } from "../../utils/floatingNotices";

const CARD_MAX_WIDTH = 520;
const SIDE_PADDING = 14;
// Ölçülmeden önce (simgeden büyürken) kartın tahmini yüksekliği.
const ESTIMATED_HEIGHT = 156;
const SPRING = { damping: 18, stiffness: 230, mass: 0.8 };
const MORPH_MS = 320;
// Sürükleme eşikleri (px, px/sn): geçilirse kart simgeye küçülür.
const MINIMIZE_UP = 28;
const MINIMIZE_SIDE = 90;
const MINIMIZE_VELOCITY = 700;

const dropIn = () => {
  "worklet";
  return {
    initialValues: { opacity: 0, transform: [{ translateX: 0 }, { translateY: -34 }, { scale: 0.92 }] },
    animations: {
      opacity: withTiming(1, { duration: 170 }),
      transform: [
        { translateX: withTiming(0, { duration: 1 }) },
        { translateY: withSpring(0, SPRING) },
        { scale: withSpring(1, SPRING) },
      ],
    },
  };
};

const fadeAway = () => {
  "worklet";
  return {
    initialValues: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] },
    animations: {
      opacity: withTiming(0, { duration: 180 }),
      transform: [
        { translateX: withTiming(0, { duration: 1 }) },
        { translateY: withTiming(-24, { duration: 200, easing: Easing.in(Easing.quad) }) },
        { scale: withTiming(0.96, { duration: 200 }) },
      ],
    },
  };
};

// Simgenin yerinden büyüme / simgeye küçülme: değerler çizim anında kapanışa alınır.
function growFromDock({ dx, dy, scale }) {
  return () => {
    "worklet";
    return {
      initialValues: { opacity: 0, transform: [{ translateX: dx }, { translateY: dy }, { scale }] },
      animations: {
        opacity: withTiming(1, { duration: 150 }),
        transform: [
          { translateX: withSpring(0, SPRING) },
          { translateY: withSpring(0, SPRING) },
          { scale: withSpring(1, SPRING) },
        ],
      },
    };
  };
}

function shrinkToDock({ dx, dy, scale }) {
  return () => {
    "worklet";
    const easing = Easing.inOut(Easing.cubic);
    return {
      initialValues: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] },
      animations: {
        // Yolun çoğunda görünür kalır; simgenin yerine varırken söner (simge orada belirir).
        opacity: withDelay(MORPH_MS - 150, withTiming(0, { duration: 150 })),
        transform: [
          { translateX: withTiming(dx, { duration: MORPH_MS, easing }) },
          { translateY: withTiming(dy, { duration: MORPH_MS, easing }) },
          { scale: withTiming(scale, { duration: MORPH_MS, easing }) },
        ],
      },
    };
  };
}

const REDUCED_ENTER = FadeIn.duration(140);
const REDUCED_EXIT = FadeOut.duration(120);

/** Toast süresinin kalan kısmı: kartın altında sönen ince çizgi. Yalnız `token` değişince yeniden kurulur. */
const CountdownLine = memo(function CountdownLine({ durationMs, color, track }) {
  const progress = useSharedValue(1);
  useEffect(() => {
    progress.value = withSequence(
      withTiming(1, { duration: 0 }),
      withTiming(0, { duration: durationMs, easing: Easing.linear }),
    );
    return () => cancelAnimation(progress);
  }, [durationMs, progress]);
  // Dinlenme değeri GÖRÜNÜR (dolu çizgi); süre bitince kart zaten simgeye küçülür.
  const style = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, progress.value)) * 100}%` }));
  return (
    <View style={[styles.track, { backgroundColor: track }]} pointerEvents="none">
      <Animated.View style={[styles.fill, { backgroundColor: color }, style]} />
    </View>
  );
});

function FloatingNoticeCardBase({
  notice,
  text,
  index,
  count,
  theme,
  copy,
  top,
  screenWidth,
  dock,
  enterFrom,
  exitTo,
  countdownMs,
  timerToken,
  busy,
  error,
  reduceMotion,
  onPrimary,
  onSecondary,
  onNext,
  onMinimize,
  onTouch,
}) {
  const look = noticeAppearance(notice);
  const isInvite = notice.kind === NOTICE_KIND.invite;
  const cardWidth = Math.min(CARD_MAX_WIDTH, Math.max(1, screenWidth - SIDE_PADDING * 2));
  const [size, setSize] = useState({ width: cardWidth, height: ESTIMATED_HEIGHT });

  const morph = useMemo(
    () => morphToDock({
      screenWidth,
      cardTop: top,
      cardWidth: size.width,
      cardHeight: size.height,
      dockX: dock.x,
      dockY: dock.y,
    }),
    [screenWidth, top, size.width, size.height, dock.x, dock.y],
  );

  // `entering` yalnız ilk çizimde okunur; `exiting` son çizimdeki değerle çalışır.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const entering = useMemo(() => (reduceMotion ? REDUCED_ENTER : enterFrom === "dock" ? growFromDock(morph) : dropIn), []);
  const exiting = useMemo(
    () => (reduceMotion ? REDUCED_EXIT : exitTo === "dock" ? shrinkToDock(morph) : fadeAway),
    [reduceMotion, exitTo, morph],
  );

  const onLayout = useCallback((event) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((previous) => (previous.width === width && previous.height === height ? previous : { width, height }));
  }, []);

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-14, 14])
        .activeOffsetY([-8, 8])
        .onBegin(() => {
          "worklet";
          runOnJS(onTouch)();
        })
        .onUpdate((event) => {
          "worklet";
          dragX.value = event.translationX * 0.6;
          // Yukarı serbest; aşağı lastik gibi direnir.
          dragY.value = event.translationY < 0 ? event.translationY : Math.min(event.translationY * 0.2, 18);
        })
        .onEnd((event) => {
          "worklet";
          const up = event.translationY < -MINIMIZE_UP || event.velocityY < -MINIMIZE_VELOCITY;
          const side = Math.abs(event.translationX) > MINIMIZE_SIDE || Math.abs(event.velocityX) > MINIMIZE_VELOCITY;
          if (up || side) {
            runOnJS(onMinimize)();
          } else {
            dragX.value = withSpring(0, SPRING);
            dragY.value = withSpring(0, SPRING);
          }
        }),
    [dragX, dragY, onMinimize, onTouch],
  );
  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }, { translateY: dragY.value }],
  }));

  const a11yActions = useMemo(
    () => [
      { name: "primary", label: text.primary },
      { name: "secondary", label: text.secondary },
      { name: "minimize", label: copy.minimize },
    ],
    [text.primary, text.secondary, copy.minimize],
  );
  const onAccessibilityAction = useCallback(
    (event) => {
      const name = event.nativeEvent.actionName;
      if (name === "primary") onPrimary();
      else if (name === "secondary") onSecondary();
      else if (name === "minimize") onMinimize();
    },
    [onPrimary, onSecondary, onMinimize],
  );

  return (
    <Animated.View entering={entering} exiting={exiting} pointerEvents="box-none" style={[styles.slot, { top }]}>
      <GestureDetector gesture={pan}>
        <Animated.View
          testID="floating-notice-card"
          onLayout={onLayout}
          style={[
            styles.card,
            { width: cardWidth, backgroundColor: theme.secondary, borderColor: alpha(look.accent, 0.42), shadowColor: look.accent },
            dragStyle,
          ]}
        >
          <Pressable
            onPress={onTouch}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            accessibilityLabel={[text.eyebrow, text.title, text.detail, text.meta].filter(Boolean).join(". ")}
            accessibilityActions={a11yActions}
            onAccessibilityAction={onAccessibilityAction}
          >
            <LinearGradient
              pointerEvents="none"
              colors={[alpha(look.accent, 0.16), alpha(look.accent, 0)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.row}>
              <LinearGradient colors={look.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
                <AppIcon family="Ionicons" name={look.icon} size={21} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.body}>
                <View style={styles.eyebrowRow}>
                  <Text style={[styles.eyebrow, { color: look.accent }]} numberOfLines={1}>
                    {text.eyebrow}
                    {count > 1 ? ` · ${index + 1}/${count}` : ""}
                  </Text>
                  {count > 1 && (
                    <Pressable
                      testID="floating-notice-next"
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={copy.next}
                      disabled={busy}
                      onPress={onNext}
                      style={[styles.iconButton, { backgroundColor: alpha(theme.text.primary, 0.08) }]}
                    >
                      <AppIcon family="Ionicons" name="chevron-forward" size={16} color={theme.text.primary} />
                    </Pressable>
                  )}
                  <Pressable
                    testID="floating-notice-minimize"
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={copy.minimize}
                    onPress={onMinimize}
                    style={[styles.iconButton, { backgroundColor: alpha(theme.text.primary, 0.08) }]}
                  >
                    <AppIcon family="Ionicons" name="remove" size={18} color={theme.text.primary} />
                  </Pressable>
                </View>
                <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={2}>{text.title}</Text>
                {!!text.detail && (
                  <Text style={[styles.detail, { color: theme.text.secondary || theme.text.primary }]} numberOfLines={2}>
                    {text.detail}
                  </Text>
                )}
                {!!text.meta && <Text style={[styles.meta, { color: theme.text.muted }]} numberOfLines={1}>{text.meta}</Text>}
              </View>
            </View>
            {error && (
              <Text accessibilityRole="alert" style={[styles.error, { color: theme.text.primary }]}>{text.error}</Text>
            )}
            <View style={styles.actions}>
              <Pressable
                testID={isInvite ? "floating-notice-decline" : "floating-notice-done"}
                accessibilityRole="button"
                accessibilityLabel={text.secondary}
                disabled={busy}
                onPress={onSecondary}
                style={({ pressed }) => [
                  styles.button,
                  { borderColor: theme.border, backgroundColor: theme.primary, opacity: pressed ? 0.75 : 1 },
                ]}
              >
                <Text style={[styles.buttonText, { color: theme.text.primary }]}>{text.secondary}</Text>
              </Pressable>
              <Pressable
                testID={isInvite ? "floating-notice-accept" : "floating-notice-open"}
                accessibilityRole="button"
                accessibilityLabel={text.primary}
                disabled={busy}
                onPress={onPrimary}
                style={({ pressed }) => [
                  styles.button,
                  { borderColor: look.colors[1], backgroundColor: look.colors[1], opacity: pressed ? 0.85 : 1 },
                ]}
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={[styles.buttonText, { color: "#FFFFFF" }]} numberOfLines={1}>{text.primary}</Text>
                )}
              </Pressable>
            </View>
            {countdownMs ? (
              <CountdownLine key={timerToken} durationMs={countdownMs} color={look.accent} track={alpha(look.accent, 0.14)} />
            ) : null}
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

export default memo(FloatingNoticeCardBase);

const styles = StyleSheet.create({
  slot: { position: "absolute", left: 0, right: 0, alignItems: "center", paddingHorizontal: SIDE_PADDING },
  card: {
    maxWidth: CARD_MAX_WIDTH,
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 9,
  },
  row: { flexDirection: "row", gap: 12, paddingTop: 14, paddingHorizontal: 14 },
  badge: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, minWidth: 0 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 26 },
  eyebrow: { flex: 1, fontSize: 11, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  iconButton: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, lineHeight: 20, fontWeight: "800", marginTop: 1 },
  detail: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  meta: { fontSize: 11, marginTop: 3 },
  error: { fontSize: 12, marginTop: 8, paddingHorizontal: 14 },
  actions: { flexDirection: "row", gap: 8, padding: 14, paddingTop: 12 },
  button: {
    flex: 1,
    minHeight: 40,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  buttonText: { fontSize: 13, fontWeight: "800" },
  track: { height: 3, width: "100%" },
  fill: { height: 3 },
});
