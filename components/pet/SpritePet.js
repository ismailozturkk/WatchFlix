import React, { memo, useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";

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
 */
function SpritePet({ source, state = "idle", size = 130, playing = true }) {
  const cfg = PET_STATES[state] || PET_STATES.idle;
  const [frame, setFrame] = useState(0);
  const scale = size / FRAME_H;

  useEffect(() => {
    setFrame(0);
    if (!playing || cfg.frames <= 1) return undefined;
    const interval = Math.max(50, Math.round(1000 / cfg.fps));
    const id = setInterval(() => {
      setFrame((f) => {
        const next = f + 1;
        if (next >= cfg.frames) return cfg.loop ? 0 : cfg.frames - 1;
        return next;
      });
    }, interval);
    return () => clearInterval(id);
  }, [state, playing, cfg.frames, cfg.fps, cfg.loop]);

  const col = Math.min(frame, cfg.frames - 1);

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
      <Image
        source={source}
        contentFit="fill"
        cachePolicy="memory-disk"
        style={{
          position: "absolute",
          width: SHEET_W * scale,
          height: SHEET_H * scale,
          left: -col * FRAME_W * scale,
          top: -cfg.row * FRAME_H * scale,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  window: {
    overflow: "hidden",
  },
});

// Pet ölçülerini dışarıda (clamp vb.) kullanmak için yardımcı.
export const spriteFrameWidth = (size) => (FRAME_W * size) / FRAME_H;

export default memo(SpritePet);
