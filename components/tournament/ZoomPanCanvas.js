// components/tournament/ZoomPanCanvas.js
//
// Tam ekran eleme ağacının tuvali: iki parmakla yakınlaştırma (odak noktası
// parmakların altında kalır, iki parmakla sürüklenir) ve tek parmakla HER
// YÖNE serbest kaydırma (bırakınca ataletle süzülür, kenarda durur).
// Açılışta ağacın tamamı sığar (fitScale); en fazla `maxScale` kat büyür.
// Hesap saf modülde: zoomPanMath.js.
//
// Tüm hareket UI thread'de (Reanimated shared value + RNGH). Maç düğmeleri
// (Pressable) çalışmaya devam eder: Pan ancak parmak kayınca etkinleşir ve
// etkinleşince JS dokunuşunu iptal eder → kaydırırken yanlışlıkla maç açılmaz.
// Modal ayrı bir kök olduğu için çağıran (BracketFullscreen) içeriği
// GestureHandlerRootView ile sarar.
//
// Ref API: zoomBy(factor) — görünüm ortası etrafında animasyonlu büyüt/küçült
// (üst şeritteki +/− düğmeleri).

import React, { forwardRef, useEffect, useImperativeHandle } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withDecay, withTiming, cancelAnimation,
  ReduceMotion,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  fitScale, clampOffset, offsetBounds, clampScale, zoomAround,
} from "@components/tournament/zoomPanMath";

const TIMING = { duration: 220, reduceMotion: ReduceMotion.System };

function ZoomPanCanvas({ content, view, maxScale = 2, children }, ref) {
  const minScale = fitScale(content, view);
  const s = useSharedValue(minScale);
  const x = useSharedValue(clampOffset(0, content.w * minScale, view.w));
  const y = useSharedValue(clampOffset(0, content.h * minScale, view.h));
  const start = useSharedValue({ s: 1, x: 0, y: 0, fx: 0, fy: 0 });

  // Görünüm (ya da ağaç) ölçüsü değişince baştan: tamamı sığsın.
  useEffect(() => {
    s.value = minScale;
    x.value = clampOffset(0, content.w * minScale, view.w);
    y.value = clampOffset(0, content.h * minScale, view.h);
  }, [content.w, content.h, view.w, view.h, minScale, s, x, y]);

  useImperativeHandle(ref, () => ({
    zoomBy(factor) {
      const next = clampScale(s.value * factor, minScale, maxScale);
      const c = { x: view.w / 2, y: view.h / 2 };
      const r = zoomAround({ s: s.value, x: x.value, y: y.value }, c, c, next, content, view);
      cancelAnimation(x);
      cancelAnimation(y);
      s.value = withTiming(r.s, TIMING);
      x.value = withTiming(r.x, TIMING);
      y.value = withTiming(r.y, TIMING);
    },
  }), [content, view, minScale, maxScale, s, x, y]);

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      cancelAnimation(x);
      cancelAnimation(y);
      start.value = { s: s.value, x: x.value, y: y.value, fx: e.focalX, fy: e.focalY };
    })
    .onUpdate((e) => {
      const st = start.value;
      const next = clampScale(st.s * e.scale, minScale, maxScale);
      const r = zoomAround(st, { x: st.fx, y: st.fy }, { x: e.focalX, y: e.focalY }, next, content, view);
      s.value = r.s;
      x.value = r.x;
      y.value = r.y;
    });

  const pan = Gesture.Pan()
    .maxPointers(1)
    .onStart(() => {
      cancelAnimation(x);
      cancelAnimation(y);
      start.value = { s: s.value, x: x.value, y: y.value, fx: 0, fy: 0 };
    })
    .onUpdate((e) => {
      const st = start.value;
      x.value = clampOffset(st.x + e.translationX, content.w * s.value, view.w);
      y.value = clampOffset(st.y + e.translationY, content.h * s.value, view.h);
    })
    .onEnd((e) => {
      x.value = withDecay({
        velocity: e.velocityX,
        clamp: offsetBounds(content.w * s.value, view.w),
        reduceMotion: ReduceMotion.System,
      });
      y.value = withDecay({
        velocity: e.velocityY,
        clamp: offsetBounds(content.h * s.value, view.h),
        reduceMotion: ReduceMotion.System,
      });
    });

  const gesture = Gesture.Simultaneous(pinch, pan);

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: s.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.viewport, { width: view.w, height: view.h }]} collapsable={false}>
        <Animated.View
          style={[styles.canvas, { width: content.w, height: content.h }, canvasStyle]}
        >
          {children}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  viewport: { overflow: "hidden" },
  // Ölçek sol-üst köşeden: ekrandaki konum = öteleme + ölçek × tuval noktası.
  canvas: { position: "absolute", left: 0, top: 0, transformOrigin: "0 0" },
});

export default forwardRef(ZoomPanCanvas);
