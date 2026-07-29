import React, { memo, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import useAppActive from "@hooks/useAppActive";
import { perfPreset } from "@services/deviceTier";

// ─── Sprite sheet geometrisi ──────────────────────────────────────────────
// astro.webp / jonsnow.webp: 1536 x 1872, 8 sütun x 9 satır → her kare 192 x 208.
// Satırlar soldan sağa, üstten alta. Bazı satırlar 8'den az kare içerir.
const SHEET_W = 1536;
const SHEET_H = 1872;
const COLS = 8;
const ROWS = 9;
const FRAME_W = SHEET_W / COLS; // 192
const FRAME_H = SHEET_H / ROWS; // 208

// Durum → { satır indeksi, kare sayısı, fps, döngü }. Daha sonra ince ayar yapılacak.
// fps daha düşük = animasyon daha yavaş. Tek yerden ölçeklemek için SPEED kullan.
const SPEED = 0.55; // global hız çarpanı (1 = ham fps, <1 = daha yavaş)
const f = (fps) => Math.max(1, Math.round(fps * SPEED));
export const PET_STATES = {
  idle: { row: 0, frames: 6, fps: f(6), loop: true },
  runRight: { row: 1, frames: 8, fps: f(12), loop: true },
  runLeft: { row: 2, frames: 8, fps: f(12), loop: true },
  wave: { row: 3, frames: 4, fps: f(7), loop: true },
  jump: { row: 4, frames: 5, fps: f(9), loop: true },
  sad: { row: 5, frames: 8, fps: f(7), loop: true },
  happy: { row: 6, frames: 6, fps: f(9), loop: true },
  working: { row: 7, frames: 6, fps: f(8), loop: true },
  research: { row: 8, frames: 6, fps: f(8), loop: true },
};

// Tap ile dönülecek sıra (tab nav üstündeki pet'e dokunuldukça bu sırayla değişir).
export const PET_STATE_ORDER = [
  "idle",
  "runRight",
  "runLeft",
  "wave",
  "jump",
  "sad",
  "happy",
  "working",
  "research",
];

/**
 * Tek bir sprite sheet karesini gösterir ve durumun karelerini animasyonlar.
 * `size` = gösterilecek kare YÜKSEKLİĞİ (px); genişlik orana göre hesaplanır.
 *
 * KARE İLERLETME NEDEN REANIMATED İLE: pet tab navigator'ın üstünde YAŞAR,
 * yani uygulama açık olduğu sürece animasyon hiç durmaz. Eski hâlinde her kare
 * bir `setInterval` + `setState` idi → saniyede 3-7 React render'ı, sonsuza
 * kadar, JS thread'inde (aynı thread scroll/dokunma olaylarını da işliyor).
 * Şimdi kare sayacı UI thread'inde bir shared value; JS tarafı yalnız durum
 * değişince (tap/sürükleme) çalışır. `Easing.steps` ara değer üretmeden
 * kareden kareye atlatır — görüntü birebir aynı, JS maliyeti sıfır.
 */
function SpritePet({ source, state = "idle", size = 130, playing = true }) {
  const cfg = PET_STATES[state] || PET_STATES.idle;
  const scale = size / FRAME_H;
  const appActive = useAppActive();
  const frame = useSharedValue(0);

  // Düşük katman cihazda kare hızını kıs (görüntü aynı, iş daha az).
  const fps = Math.max(1, Math.round(cfg.fps * (perfPreset.spriteFpsScale ?? 1)));
  const shouldPlay = playing && appActive && cfg.frames > 1;

  useEffect(() => {
    cancelAnimation(frame);
    frame.value = 0;
    if (!shouldPlay) return undefined;

    // withTiming hedefi kare SAYISI; steps easing değeri 0,1,2,…,frames-1
    // basamaklarında tutar. Döngü olmayan durumlarda son karede kalır.
    const duration = Math.max(50, Math.round((cfg.frames / fps) * 1000));
    const step = withTiming(cfg.frames, {
      duration,
      easing: Easing.steps(cfg.frames, false),
      // "Hareketi azalt" sistem ayarı açıkken Reanimated animasyonu atlar ve
      // değeri son karede bırakır — pet donmuş/bozuk görünürdü. Buradaki
      // hareket ekranda gezinen bir geçiş değil, karakterin ÇİZİMİ; eski
      // setInterval davranışıyla aynı kalsın diye muaf tutuluyor.
      reduceMotion: ReduceMotion.Never,
    });
    frame.value = cfg.loop
      ? withRepeat(step, -1, false, undefined, ReduceMotion.Never)
      : step;

    return () => cancelAnimation(frame);
    // `state` bilerek bağımlılıkta: iki durumun kare sayısı/hızı aynı olsa bile
    // (working ↔ research) animasyon eski davranıştaki gibi 0. kareden başlasın.
  }, [frame, state, shouldPlay, cfg.frames, cfg.loop, fps]);

  const frameStyle = useAnimatedStyle(() => {
    const col = Math.min(Math.max(Math.floor(frame.value), 0), cfg.frames - 1);
    return {
      transform: [
        { translateX: -col * FRAME_W * scale },
        { translateY: -cfg.row * FRAME_H * scale },
      ],
    };
  }, [cfg.frames, cfg.row, scale]);

  // Pet henüz indirilmediyse source null gelir — boş bir kare alanı ayır.
  if (!source) {
    return (
      <View
        style={[
          styles.window,
          { width: FRAME_W * scale, height: FRAME_H * scale },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.window,
        { width: FRAME_W * scale, height: FRAME_H * scale },
      ]}
    >
      <Animated.View
        style={[
          styles.sheet,
          { width: SHEET_W * scale, height: SHEET_H * scale },
          frameStyle,
        ]}
      >
        <Image
          source={source}
          contentFit="fill"
          cachePolicy="memory-disk"
          style={styles.fill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  window: {
    overflow: "hidden",
  },
  sheet: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  fill: {
    width: "100%",
    height: "100%",
  },
});

// Pet ölçülerini dışarıda (clamp vb.) kullanmak için yardımcı.
export const spriteFrameWidth = (size) => (FRAME_W * size) / FRAME_H;

export default memo(SpritePet);
