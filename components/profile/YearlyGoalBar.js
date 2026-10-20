// components/profile/YearlyGoalBar.js
//
// Hedef çubuğu: iz + dolu kısım + PLAN İŞARETİ. İşaret, planın bugün olması gereken yeri
// (yılın ne kadarı geçtiyse o oranda) gösterir: dolu kısım işaretin önündeyse tempoda önde,
// gerisindeyse geridesin — "tempodan 6 önde" yazısının görsel karşılığı.
//
// Dolu kısım oran değişince yumuşakça uzar (UI thread, Reanimated; "Hareketi azalt" açıkken
// doğrudan atlar). İLK DEĞER = HEDEF ORAN (0 değil): Reanimated 4.5 animasyonlu stilin ilk
// değerini render'larda geri yazabiliyor; ilk değer 0 olsaydı bir yeniden çizim dolu çubuğu
// boşaltabilirdi. Bedeli: açılışta dolum animasyonu yok, yalnız değişimler animasyonlu.

import React, { memo, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const RM = ReduceMotion.System;
const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));

function YearlyGoalBar({
  ratio = 0,
  markerRatio = null,
  color = "#3B82F6",
  trackColor = "rgba(255,255,255,0.14)",
  markerColor = "#FFFFFF",
  height = 10,
}) {
  const progress = useSharedValue(clamp01(ratio));

  useEffect(() => {
    progress.value = withTiming(clamp01(ratio), {
      duration: 600,
      easing: Easing.out(Easing.cubic),
      reduceMotion: RM,
    });
  }, [ratio, progress]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const radius = height / 2;

  return (
    <View style={[styles.track, { height, borderRadius: radius, backgroundColor: trackColor }]}>
      <Animated.View
        style={[
          styles.fill,
          // Çok küçük oran yuvarlak bir nokta olarak görünsün (sıfır hariç).
          { height, borderRadius: radius, backgroundColor: color, minWidth: ratio > 0 ? height : 0 },
          fillStyle,
        ]}
      />
      {markerRatio == null ? null : (
        <View
          pointerEvents="none"
          style={[
            styles.marker,
            {
              left: `${clamp01(markerRatio) * 100}%`,
              top: -3,
              bottom: -3,
              backgroundColor: markerColor,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: "100%" },
  fill: { position: "absolute", left: 0, top: 0 },
  marker: { position: "absolute", width: 2, marginLeft: -1, borderRadius: 1 },
});

export default memo(YearlyGoalBar);
