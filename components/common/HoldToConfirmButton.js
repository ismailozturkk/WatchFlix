import React, { useCallback, useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import LensLoader from "../LensLoader";
import * as Haptics from "@services/hapticsService";

/**
 * Basılı tutarak onaylanan düğme (geri alınamaz işlemler: grubu sil vb.).
 *
 *   • Basınca soldan sağa bir dolgu ilerler; `duration` ms boyunca bırakılmazsa
 *     `onConfirm` çağrılır.
 *   • Erken bırakılırsa dolgu hızla geri boşalır, hiçbir şey olmaz; kısa
 *     dokunuşta `hint` metni gösterilir (kullanıcı "basılı tut" demek olduğunu
 *     anlasın diye).
 *   • Dinlenme durumu GÖRÜNÜR: düğme ve metin hiç animasyonlanmaz, yalnız
 *     dolgu (dinlenmede boş) — Reanimated ilk-değer tuzağı bu yüzeyi gizleyemez.
 */
export default function HoldToConfirmButton({
  label,
  holdingLabel,
  hint,
  onConfirm,
  onShortPress,
  duration = 1600,
  color = "#FF6B6B",
  icon = "trash-outline",
  busy = false,
  disabled = false,
  testID,
  style,
}) {
  const progress = useSharedValue(0);
  const [holding, setHolding] = React.useState(false);
  const firedRef = useRef(false);
  const pressStartRef = useRef(0);

  useEffect(() => () => cancelAnimation(progress), [progress]);

  const complete = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    setHolding(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType?.Warning);
    onConfirm?.();
  }, [onConfirm]);

  const handlePressIn = useCallback(() => {
    if (disabled || busy) return;
    firedRef.current = false;
    pressStartRef.current = Date.now();
    setHolding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle?.Light);
    cancelAnimation(progress);
    const remaining = Math.max(80, duration * (1 - progress.value));
    progress.value = withTiming(
      1,
      { duration: remaining, easing: Easing.linear },
      (finished) => {
        if (finished) runOnJS(complete)();
      },
    );
  }, [busy, complete, disabled, duration, progress]);

  const handlePressOut = useCallback(() => {
    if (firedRef.current) {
      // Tamamlandı: dolgu kısa süre dolu kalsın, sonra sessizce boşalsın.
      progress.value = withTiming(0, { duration: 600 });
      return;
    }
    setHolding(false);
    cancelAnimation(progress);
    progress.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
    if (!disabled && !busy && Date.now() - pressStartRef.current < 350) {
      onShortPress?.();
    }
  }, [busy, disabled, onShortPress, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const inactive = disabled || busy;

  return (
    <View style={style}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityState={{ disabled: inactive, busy }}
        // Ekran okuyucuda basılı tutma hareketi zor; çift dokunup tutma yerine
        // erişilebilirlik eylemi doğrudan onaylar.
        accessibilityActions={[{ name: "activate", label }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "activate" && !inactive) onConfirm?.();
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={inactive}
        style={[
          styles.button,
          { borderColor: color + "55", backgroundColor: color + "14" },
          inactive && styles.inactive,
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.fill, { backgroundColor: color + "40" }, fillStyle]}
        />
        <View style={styles.content} pointerEvents="none">
          {busy ? (
            <LensLoader size="small" color={color} />
          ) : (
            <Ionicons name={icon} size={18} color={color} />
          )}
          <Text style={[styles.label, { color }]} numberOfLines={1}>
            {holding && holdingLabel ? holdingLabel : label}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "center",
  },
  inactive: {
    opacity: 0.55,
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
  },
});
