// components/navigation/NativeTabBarScale.js
//
// Hiçbir şey çizmez: ortak kaydırma ilerlemesini (`tabBarCollapse`, 0..1) yerel
// iOS sekme çubuğunu ölçekleyen köprüye iletir. İlerleme zaten her sekme
// ekranından (usePullToRefresh / useTabBarScrollSync) tek yerde toplanıyor —
// JS çubuğu (Android) onu `useAnimatedStyle`la okuyor, burada aynı değer yerel
// çubuğa gidiyor; böylece iki çubuk AYNI kaydırma davranışını paylaşır.
//
// Her karede değil, ilerleme ~%1 değiştikçe (veya iki uçta) gönderilir:
// her gönderim UI→JS geçişi, %20'lik bir küçülme daha ince adım göstermez.

import { useCallback, useEffect } from "react";
import { runOnJS, useAnimatedReaction, useSharedValue } from "react-native-reanimated";
import { resetNativeTabBarScale, setNativeTabBarProgress } from "../../services/tabBarScale";
import { shouldForwardCollapse } from "../../utils/tabBarCollapse";

export default function NativeTabBarScale({ progress }) {
  const lastSent = useSharedValue(-1);
  const push = useCallback((value) => setNativeTabBarProgress(value), []);

  useAnimatedReaction(
    () => progress.value,
    (value) => {
      if (!shouldForwardCollapse(lastSent.value, value)) return;
      lastSent.value = value;
      runOnJS(push)(value);
    },
  );

  // Kabuk kapanırken ya da çubuk modu değişirken (ör. "Saydamlığı azalt" →
  // JS çubuk) yerel çubuk küçülmüş halde kalmasın.
  useEffect(() => () => resetNativeTabBarScale(), []);

  return null;
}
