// components/floatingNotice/FloatingNoticeBubble.js
//
// Yüzen bildirimin küçük hâli: ekranın sağ ya da sol kenarında duran yuvarlak simge. Dokununca
// kart yeniden açılır (host), sürükleyip bırakınca en yakın kenara oturur ve yeri cihazda saklanır.
//
// YER İKİ PARÇA: yuva (sol-üst köşe) JS durumunda ve düz `left/top` stili; sürükleme farkı paylaşılan
// değerde (dinlenme değeri 0). Bırakınca fark yeni yuvaya kayar, host yuvayı günceller, yeni yuva
// çizilince fark sıfırlanır. Neden: animasyonlu stilin İLK değeri sonraki çizimlerde geri yazılabilir
// (memory "Reanimated ilk-değer kaybolması"); yer paylaşılan değerde kalsaydı, simge dakikalar sonra
// bir sayı değişimiyle eski yerine sıçrayabilirdi. Dinlenme değerleri (0 kayma, ölçek 1) görünür.

import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
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
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "../AppIcon";
import { alpha } from "../../theme/colors";
import { BUBBLE_SIZE, NOTICE_KIND, dockOrigin, noticeAppearance, snapDock } from "../../utils/floatingNotices";

const SNAP_MS = 280;
const POP_SPRING = { damping: 12, stiffness: 260, mass: 0.7 };

function popIn(delay) {
  return () => {
    "worklet";
    return {
      initialValues: { opacity: 0, transform: [{ scale: 0.3 }] },
      animations: {
        opacity: withDelay(delay, withTiming(1, { duration: 140 })),
        transform: [{ scale: withDelay(delay, withSpring(1, POP_SPRING)) }],
      },
    };
  };
}

// Simge açılırken kartın içine "erir": büyüyüp söner.
const melt = () => {
  "worklet";
  return {
    initialValues: { opacity: 1, transform: [{ scale: 1 }] },
    animations: {
      opacity: withTiming(0, { duration: 150 }),
      transform: [{ scale: withTiming(1.4, { duration: 170, easing: Easing.out(Easing.quad) }) }],
    },
  };
};

const REDUCED_ENTER = FadeIn.duration(140);
const REDUCED_EXIT = FadeOut.duration(120);

/** Yanıt bekleyen davetin çevresinde yavaşça yayılan halka (seçim bekliyor). */
const Halo = memo(function Halo({ color }) {
  const wave = useSharedValue(0);
  useEffect(() => {
    wave.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false);
    return () => cancelAnimation(wave);
  }, [wave]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - wave.value),
    transform: [{ scale: 1 + wave.value * 0.55 }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.halo, { backgroundColor: color }, style]} />;
});

function FloatingNoticeBubbleBase({
  notice,
  count,
  dock,
  bounds,
  theme,
  label,
  hint,
  appearDelay = 0,
  reduceMotion,
  onOpen,
  onDockChange,
}) {
  const look = noticeAppearance(notice);
  const origin = dockOrigin(dock, bounds);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const lifted = useSharedValue(0);

  // Yeni yuva çizildi: sürükleme farkı artık yuvanın içinde.
  useLayoutEffect(() => {
    dx.value = 0;
    dy.value = 0;
  }, [origin.x, origin.y, dx, dy]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const entering = useMemo(() => (reduceMotion ? REDUCED_ENTER : popIn(appearDelay)), []);
  const exiting = reduceMotion ? REDUCED_EXIT : melt;

  const settle = useCallback((side, y) => onDockChange({ side, y }), [onDockChange]);
  const release = useCallback(
    (translationX, translationY, velocityX) => {
      const next = snapDock({ x: origin.x + translationX, y: origin.y + translationY, velocityX }, bounds);
      const target = dockOrigin(next, bounds);
      // İki eksen aynı sürede biter: yuva tek geri çağrıyla, ikisi de yerine varınca güncellenir.
      dx.value = withTiming(target.x - origin.x, { duration: SNAP_MS, easing: Easing.out(Easing.back(1.1)) });
      dy.value = withTiming(target.y - origin.y, { duration: SNAP_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
        "worklet";
        if (finished) runOnJS(settle)(next.side, next.y);
      });
    },
    [origin.x, origin.y, bounds, dx, dy, settle],
  );

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(4)
      .onBegin(() => {
        "worklet";
        lifted.value = withTiming(1, { duration: 120 });
      })
      .onUpdate((event) => {
        "worklet";
        dx.value = event.translationX;
        dy.value = event.translationY;
      })
      .onEnd((event) => {
        "worklet";
        runOnJS(release)(event.translationX, event.translationY, event.velocityX);
      })
      .onFinalize(() => {
        "worklet";
        lifted.value = withTiming(0, { duration: 160 });
      });
    const tap = Gesture.Tap()
      .maxDistance(10)
      .onEnd((_event, success) => {
        "worklet";
        if (success) runOnJS(onOpen)();
      });
    return Gesture.Race(pan, tap);
  }, [dx, dy, lifted, release, onOpen]);

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dx.value }, { translateY: dy.value }, { scale: 1 + lifted.value * 0.08 }],
  }));

  const onAccessibilityAction = useCallback(
    (event) => {
      if (event.nativeEvent.actionName === "activate") onOpen();
    },
    [onOpen],
  );

  return (
    <Animated.View
      entering={entering}
      exiting={exiting}
      pointerEvents="box-none"
      style={[styles.slot, { left: origin.x, top: origin.y }]}
    >
      <GestureDetector gesture={gesture}>
        <Animated.View
          testID="floating-notice-bubble"
          accessible
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={hint}
          accessibilityActions={[{ name: "activate" }]}
          onAccessibilityAction={onAccessibilityAction}
          style={[styles.hit, { shadowColor: look.accent }, dragStyle]}
        >
          {notice.kind === NOTICE_KIND.invite && !reduceMotion ? <Halo color={look.accent} /> : null}
          <LinearGradient
            colors={look.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.bubble, { borderColor: alpha("#FFFFFF", 0.85) }]}
          >
            <AppIcon family="Ionicons" name={look.icon} size={25} color="#FFFFFF" />
          </LinearGradient>
          {count > 1 && (
            <View style={[styles.count, { borderColor: theme.primary }]} pointerEvents="none">
              <Text style={styles.countText}>{count > 9 ? "9+" : count}</Text>
            </View>
          )}
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

export default memo(FloatingNoticeBubbleBase);

const styles = StyleSheet.create({
  slot: { position: "absolute", width: BUBBLE_SIZE, height: BUBBLE_SIZE },
  hit: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  halo: { ...StyleSheet.absoluteFillObject, borderRadius: BUBBLE_SIZE / 2 },
  bubble: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  count: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    borderWidth: 2,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
});
