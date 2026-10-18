// components/profile/YearlyGoalRing.js
//
// Yıllık hedef halkası: iz (soluk tam daire) + ilerleme yayı. Yay, oran değişince
// yumuşakça uzar (UI thread, Reanimated); "Hareketi azalt" açıkken doğrudan son değere
// atlar. Ortası çocuklara bırakılır (sayı/simge).
//
// react-native-svg `Circle` + `strokeDashoffset` kalıbı components/toast/ToastOrb.js'te
// zaten kullanılıyor. Yay 12 yönünden başlasın diye daire -90° döndürülür.
//
// İLK DEĞER = HEDEF ORAN (0 değil): Reanimated 4.5 animasyonlu değerin ilkini render'larda geri
// yazabiliyor (bkz. proje notu reanimated-initial-value-vanish); ilk değer 0 olsaydı bir yeniden
// çizim dolu halkayı boşaltabilirdi. Bedeli: açılışta dolum animasyonu yok, yalnız değişimler
// (yeni izleme, hedef ayarı) animasyonlu. İz hep çizili, yay kaybolsa bile halka kaybolmaz.

import React, { memo, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RM = ReduceMotion.System;

function YearlyGoalRing({
  size = 76,
  stroke = 8,
  ratio = 0,
  color = "#3B82F6",
  trackColor = "rgba(255,255,255,0.14)",
  children,
}) {
  const radius = (size - stroke) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  // İlk değer = hedef oran (bkz. üstteki not): 0 olsaydı bir yeniden çizim dolu halkayı boşaltabilirdi.
  const progress = useSharedValue(Math.min(1, Math.max(0, Number(ratio) || 0)));

  useEffect(() => {
    const target = Math.min(1, Math.max(0, Number(ratio) || 0));
    progress.value = withTiming(target, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
      reduceMotion: RM,
    });
  }, [ratio, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          // Oran 0 iken yuvarlak uç sıfır uzunluklu yayı bir NOKTA olarak çizer.
          strokeLinecap={ratio > 0 ? "round" : "butt"}
          fill="none"
          strokeDasharray={[circumference, circumference]}
          animatedProps={animatedProps}
          rotation={-90}
          origin={`${center}, ${center}`}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default memo(YearlyGoalRing);
