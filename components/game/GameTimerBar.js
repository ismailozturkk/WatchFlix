// components/game/GameTimerBar.js
//
// Geri sayım çubuğu. ESKİ HÂLİ: genişlik `timeLeft` state'inden (saniyede bir
// değişen tam sayı) türetiliyordu → çubuk saniyede bir "sıçrıyordu". ŞİMDİ:
// sayaç çalışınca kalan süreye kadar DOĞRUSAL, native sürücüyle akıcı kısalır;
// duraklatınca/cevaplayınca olduğu yerde donar.
//
// Çubuk saniyeyi ölçmez; ölçen tek şey hook'taki deadline'dır (useSceneGame).
// Buradaki animasyon yalnızca görsel — küçük sapma oyun sonucunu etkilemez.

import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

const clamp01 = (value) => Math.max(0, Math.min(1, value));

/**
 * @param {number} timeLeft     Kalan tam saniye (hook state'i).
 * @param {number} totalSeconds Çubuğun %100'ü.
 * @param {boolean} running     Sayaç işliyor mu.
 * @param {string|number} resetKey  Değişince çubuk yeniden dolar (soru/tur no).
 * @param {boolean} syncOnStop  Durunca çubuğu `timeLeft` oranına çek (Zamana
 *   Karşı: yanlış cevap cezası süreyi doğrudan düşürür).
 */
export default function GameTimerBar({
  timeLeft,
  totalSeconds,
  running,
  resetKey,
  color,
  trackColor,
  syncOnStop = false,
}) {
  const progress = useRef(new Animated.Value(1)).current;
  const timeLeftRef = useRef(timeLeft);
  timeLeftRef.current = timeLeft;
  const total = Math.max(1, Number(totalSeconds) || 1);

  // Yeni soru/oturum: dolu (ya da gerçek orana) dön.
  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(clamp01(timeLeftRef.current / total));
  }, [progress, resetKey, total]);

  useEffect(() => {
    if (!running) {
      progress.stopAnimation();
      if (syncOnStop) progress.setValue(clamp01(timeLeftRef.current / total));
      return undefined;
    }
    const remainingMs = Math.max(0, timeLeftRef.current) * 1000;
    progress.setValue(clamp01(timeLeftRef.current / total));
    Animated.timing(progress, {
      toValue: 0,
      duration: remainingMs,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
    return () => progress.stopAnimation();
  }, [progress, running, syncOnStop, total]);

  return (
    <View style={[styles.track, { backgroundColor: trackColor }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: color, transform: [{ scaleX: progress }], transformOrigin: "left center" },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: 3, overflow: "hidden", marginHorizontal: 16 },
  fill: { height: "100%", width: "100%", borderRadius: 3 },
});
