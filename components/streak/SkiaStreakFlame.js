// components/streak/SkiaStreakFlame.js
//
// Seri alevinin Skia çizimi: tek bir runtime shader (utils/streakFlameShader.js
// FLAME_SKSL) tuvali boyar. Alev gövdesi, sıcaklık rampası, kıvılcımlar, hale, taç,
// yıldızlar ve gökkuşağı hepsi aynı geçişte, GPU'da çizilir; React'e kare başına
// yük binmez. Kararlar (kademe, ihtişam, mola) utils/streakFlame.js streakLook().
//
// YERLEŞİM: bileşen eski SVG alevle aynı kutuyu kaplar (size × 0,78 genişlik);
// tuval bu kutudan büyüktür ve ortalanmış durur, efektler kutunun dışına taşar
// ama yerleşimi büyütmez (pointerEvents kapalı).
//
// ZAMAN: Reanimated frame callback'i shader saatini UI thread'de ilerletir.
// Saat en çok 60 fps ilerler: 120 Hz ekranda saniyede 120 kez boyanmaz (30 fps
// denendi, takılıyor gibi görünüyordu — 11 Kas).
//
// ÇÖZÜNÜRLÜK: `renderScale` < 1 → tuval o oranda KÜÇÜK çizilir ve görünümde
// büyütülür (piksel sayısı oranın karesiyle düşer). Shader her pikselde 3 kat
// gürültü + kıvılcım döngüleri çalıştırdığı için büyük alevde (seri sayfası)
// en büyük kazanç bu; alev zaten yumuşak, büyütme görünmez.
// `animated` false (Hareketi Azalt, ekran odakta değil, merdiven önizlemesi) →
// saat durur, alev DİNLENME pozunda (REST_TIME) görünür kalır.
//
// Shader derlenemezse (eski GPU, Skia hatası) SKIA_FLAME_READY false olur;
// StreakFlame o zaman eski SVG alevi çizer.

import React, { memo, useEffect, useMemo } from "react";
import { View } from "react-native";
import { useDerivedValue, useFrameCallback, useSharedValue } from "react-native-reanimated";
import { Canvas, Fill, Shader, Skia } from "@shopify/react-native-skia";
import {
  FLAME_ASPECT,
  FLAME_SKSL,
  flameCanvasBox,
  flameTimeScale,
  flameUniforms,
} from "@utils/streakFlameShader";

let EFFECT = null;
try {
  EFFECT = Skia.RuntimeEffect.Make(FLAME_SKSL);
} catch {
  EFFECT = null;
}

export const SKIA_FLAME_READY = Boolean(EFFECT);

// Dinlenme pozu: alevin dili güzel kıvrıldığı bir an (saat dururken bu çizilir).
const REST_TIME = 1.7;
// Uzun açık kalan ekranda float hassasiyeti düşmesin: saat bu değerde başa sarar.
const TIME_WRAP = 1000;
// Kare aralığı: 60 fps (2 ms pay: vsync titreşimi bir kareyi atlatmasın).
const FRAME_MS = 1000 / 60 - 2;

/**
 * @param {object} props
 * @param {object} props.look   streakLook() çıktısı
 * @param {number} [props.size=24]  alevin yüksekliği (pt)
 * @param {boolean} [props.animated=true]
 * @param {boolean} [props.dimmed=false]  risk/telafi/kalkan: efektler sönük, alev yavaş
 */
function SkiaStreakFlame({ look, size = 24, animated = true, dimmed = false, renderScale = 1, style, testID }) {
  const width = Math.round(size * FLAME_ASPECT);
  const height = Math.round(size);
  const paused = Boolean(look?.paused);
  const canvas = flameCanvasBox(width, height);
  const rs = renderScale > 0 && renderScale < 1 ? renderScale : 1;
  // pixelRatio = rs: shader koordinatları küçük tuvale göre (res/box), ayrıntı
  // eşiği (`detail`) ise gerçek boydan hesaplanır.
  const base = useMemo(
    () => flameUniforms(look, { width, height, dimmed, pixelRatio: rs }),
    [look, width, height, dimmed, rs],
  );

  const time = useSharedValue(REST_TIME);
  const lastFrame = useSharedValue(0);
  const speed = useSharedValue(1);
  useEffect(() => {
    speed.value = flameTimeScale({ paused, dimmed });
  }, [paused, dimmed, speed]);

  const frame = useFrameCallback((info) => {
    "worklet";
    const now = info.timestamp;
    if (lastFrame.value === 0) {
      lastFrame.value = now;
      return;
    }
    const elapsed = now - lastFrame.value;
    if (elapsed < FRAME_MS) return;
    lastFrame.value = now;
    const dt = Math.min(64, elapsed);
    time.value = (time.value + (dt / 1000) * speed.value) % TIME_WRAP;
  }, false);

  useEffect(() => {
    // Yeniden başlarken bekleme süresi tek bir "dev adım" sayılmasın.
    lastFrame.value = 0;
    frame.setActive(Boolean(animated));
    return () => frame.setActive(false);
  }, [animated, frame, lastFrame]);

  const uniforms = useDerivedValue(() => ({ ...base, time: time.value }), [base]);

  if (!EFFECT) return null;
  return (
    <View testID={testID} pointerEvents="none" style={[{ width, height, opacity: dimmed && !paused ? 0.8 : 1 }, style]}>
      <Canvas
        pointerEvents="none"
        style={{
          position: "absolute",
          // Küçük tuval, tam boy tuvalin merkezine oturur ve oradan büyütülür.
          left: canvas.left + (canvas.width * (1 - rs)) / 2,
          top: canvas.top + (canvas.height * (1 - rs)) / 2,
          width: canvas.width * rs,
          height: canvas.height * rs,
          transform: rs < 1 ? [{ scale: 1 / rs }] : undefined,
        }}
      >
        <Fill>
          <Shader source={EFFECT} uniforms={uniforms} />
        </Fill>
      </Canvas>
    </View>
  );
}

export default memo(SkiaStreakFlame);
