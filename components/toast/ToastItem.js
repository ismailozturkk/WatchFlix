// components/toast/ToastItem.js
//
// Tek bir toast'ın kabuğu: giriş/çıkış hareketi, sürükleyerek kapatma, basılı tutunca
// süreyi durdurma, erişilebilirlik. İçerik kartları ToastCards.js'te.
//
// PERFORMANS
//   • Giriş/çıkış Reanimated YERLEŞİM animasyonu (UI iş parçacığı). Eski kütüphane
//     Android'de JS iş parçacığında çalışıyordu; JS meşgulken (liste yükleme, TMDB) kare atlıyordu.
//   • Sürükleme RNGH Pan + paylaşılan değerler: parmak hareketi JS'e HİÇ uğramaz;
//     yalnız bırakma/kapatma kararı JS'e döner.
//   • Kalan süre çubuğu tek paylaşılan değer; yeniden çizim yok.
//   • Kart memo'lu: depo anlık görüntüsü değişse de aynı toast nesnesi için yeniden çizilmez.
//
// Giriş/çıkış ayrı bir dış görünümde, sürükleme/basma ölçeği iç görünümde: iki animasyon
// aynı `transform` anahtarını ezmesin diye bilerek iki katman.
//
// "Hareketi Azalt": yaylanma/ölçek yok; yalnız kısa solma.

import React, { memo, useCallback, useEffect, useMemo } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";
import useReduceMotion from "../../hooks/useReduceMotion";
import { i18nText } from "../../utils/i18nText";
import { toastStore } from "../../utils/toastStore";
import { paletteFor } from "./toastPalette";
import { BadgeCard, StatusCard } from "./ToastCards";

const ENTER_SPRING = { damping: 17, stiffness: 250, mass: 0.75 };

// Dış kap: girişte yukarıdan yaylanarak iner, çıkışta yukarı süzülüp solar.
const enteringAnimation = () => {
  "worklet";
  return {
    initialValues: { opacity: 0, transform: [{ translateY: -30 }, { scale: 0.92 }] },
    animations: {
      opacity: withTiming(1, { duration: 170 }),
      transform: [{ translateY: withSpring(0, ENTER_SPRING) }, { scale: withSpring(1, ENTER_SPRING) }],
    },
  };
};

const exitingAnimation = () => {
  "worklet";
  return {
    initialValues: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
    animations: {
      opacity: withTiming(0, { duration: 170 }),
      transform: [
        { translateY: withTiming(-20, { duration: 190, easing: Easing.in(Easing.quad) }) },
        { scale: withTiming(0.96, { duration: 190 }) },
      ],
    },
  };
};

const REDUCED_ENTER = FadeIn.duration(140);
const REDUCED_EXIT = FadeOut.duration(120);

// Kapatma eşikleri (px, px/sn).
const DISMISS_UP = 24;
const DISMISS_SIDE = 96;
const DISMISS_VELOCITY_Y = 650;
const DISMISS_VELOCITY_X = 900;

function callSafely(fn) {
  try {
    fn?.();
  } catch (error) {
    if (typeof __DEV__ !== "undefined" && __DEV__) console.warn("[toast] callback:", error?.message);
  }
}

function ToastItemBase({ toast, topInset, scoped }) {
  const { theme } = useTheme();
  const reduceMotion = useReduceMotion();
  const id = toast.id;

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const pressed = useSharedValue(0);
  const progress = useSharedValue(
    toast.totalMs && toast.resumeFrom != null ? Math.min(1, toast.resumeFrom / toast.totalMs) : 1,
  );

  // Kalan süre çubuğu: yeni toast, yineleme (sayaç) ya da host devrinde baştan/kalandan.
  useEffect(() => {
    if (toast.totalMs == null || toast.resumeFrom == null) {
      progress.value = 1;
      return undefined;
    }
    const from = Math.min(1, toast.resumeFrom / toast.totalMs);
    progress.value = withSequence(
      withTiming(from, { duration: 0 }),
      withTiming(0, { duration: toast.resumeFrom, easing: Easing.linear }),
    );
    return () => cancelAnimation(progress);
  }, [id, toast.count, toast.resumeFrom, toast.totalMs, progress]);

  const hold = useCallback(() => {
    toastStore.pause(id);
  }, [id]);

  const release = useCallback(() => {
    const left = toastStore.resume(id);
    if (left != null) {
      progress.value = withTiming(0, { duration: left, easing: Easing.linear });
    }
  }, [id, progress]);

  const dismissBySwipe = useCallback(() => {
    toastStore.dismiss(id, "swipe");
  }, [id]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(toast.swipeable)
        .activeOffsetX([-12, 12])
        .activeOffsetY([-6, 6])
        .onBegin(() => {
          "worklet";
          pressed.value = withTiming(1, { duration: 90 });
          cancelAnimation(progress);
          runOnJS(hold)();
        })
        .onUpdate((event) => {
          "worklet";
          dragX.value = event.translationX;
          // Yukarı serbest; aşağı lastik gibi direnir (kart aşağı atılmaz).
          dragY.value =
            event.translationY < 0 ? event.translationY : Math.min(event.translationY * 0.25, 22);
        })
        .onEnd((event) => {
          "worklet";
          const side =
            Math.abs(event.translationX) > DISMISS_SIDE || Math.abs(event.velocityX) > DISMISS_VELOCITY_X;
          const up = event.translationY < -DISMISS_UP || event.velocityY < -DISMISS_VELOCITY_Y;
          if (side) {
            const dir = event.translationX === 0 ? Math.sign(event.velocityX) || 1 : Math.sign(event.translationX);
            dragX.value = withTiming(dir * 420, { duration: 170 }, (finished) => {
              if (finished) runOnJS(dismissBySwipe)();
            });
          } else if (up) {
            dragY.value = withTiming(-150, { duration: 150 }, (finished) => {
              if (finished) runOnJS(dismissBySwipe)();
            });
          } else {
            dragX.value = withSpring(0, { damping: 16, stiffness: 240 });
            dragY.value = withSpring(0, { damping: 16, stiffness: 240 });
          }
        })
        .onFinalize(() => {
          "worklet";
          pressed.value = withTiming(0, { duration: 140 });
          runOnJS(release)();
        }),
    [toast.swipeable, dragX, dragY, pressed, progress, hold, release, dismissBySwipe],
  );

  // Dinlenme değerleri görünür (opaklık 1, kayma 0, ölçek 1).
  const dragStyle = useAnimatedStyle(() => {
    const dx = dragX.value;
    const dy = dragY.value;
    const fade = 1 - Math.min(Math.abs(dx) / 240, 0.7) - Math.min(Math.max(-dy, 0) / 150, 1);
    return {
      opacity: Math.max(0, fade),
      transform: [{ translateX: dx }, { translateY: dy }, { scale: 1 - pressed.value * 0.018 }],
    };
  });

  const onPressCard = useCallback(() => {
    toastStore.dismiss(id, "press");
    callSafely(toast.onPress);
  }, [id, toast.onPress]);

  const onAction = useCallback(() => {
    toastStore.dismiss(id, "action");
    callSafely(toast.action?.onPress);
  }, [id, toast.action]);

  const closeLabel = i18nText("autoI18n.kapat", "Kapat");
  const a11yActions = useMemo(
    () =>
      toast.action
        ? [
            { name: "toast-action", label: toast.action.label },
            { name: "toast-dismiss", label: closeLabel },
          ]
        : [{ name: "toast-dismiss", label: closeLabel }],
    [toast.action, closeLabel],
  );
  const onAccessibilityAction = useCallback(
    (event) => {
      if (event.nativeEvent.actionName === "toast-action") onAction();
      else if (event.nativeEvent.actionName === "toast-dismiss") toastStore.dismiss(id, "a11y");
    },
    [id, onAction],
  );

  const isBadge = toast.kind === "badge" && toast.data?.gorunum;
  const shadowColor = isBadge ? "#000000" : paletteFor(toast.kind, theme).main;

  const card = isBadge ? (
    <BadgeCard toast={toast} theme={theme} reduceMotion={reduceMotion} progress={progress} />
  ) : (
    <StatusCard
      toast={toast}
      theme={theme}
      reduceMotion={reduceMotion}
      progress={progress}
      onAction={onAction}
    />
  );

  const body = (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[styles.cardWrap, { shadowColor, backgroundColor: theme.secondary }, dragStyle]}
      >
        <Pressable
          onPress={onPressCard}
          testID="toast-card"
          accessibilityRole="alert"
          accessibilityLabel={[toast.title, toast.message].filter(Boolean).join(". ")}
          accessibilityLiveRegion="polite"
          accessibilityActions={a11yActions}
          onAccessibilityAction={onAccessibilityAction}
        >
          {card}
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );

  return (
    <Animated.View
      entering={reduceMotion ? REDUCED_ENTER : enteringAnimation}
      exiting={reduceMotion ? REDUCED_EXIT : exitingAnimation}
      pointerEvents="box-none"
      style={[styles.slot, { top: topInset }]}
    >
      {/* RN Modal ayrı bir pencere: Android'de RNGH'in kendi kökü o pencerede de olmalı. */}
      {scoped ? (
        <GestureHandlerRootView style={styles.fillWidth} pointerEvents="box-none">
          {body}
        </GestureHandlerRootView>
      ) : (
        body
      )}
    </Animated.View>
  );
}

export const ToastItem = memo(ToastItemBase);

const styles = StyleSheet.create({
  slot: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 14,
  },
  fillWidth: { width: "100%", alignItems: "center" },
  cardWrap: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 8,
  },
});
