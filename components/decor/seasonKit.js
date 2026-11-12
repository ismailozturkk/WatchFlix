// components/decor/seasonKit.js
//
// Mevsim / gökyüzü sahnelerinin (kar, bahar, yaz, sonbahar, yağmur, fırtına, aurora, yıldız tozu,
// kamp ateşi) ORTAK yardımcıları: renk, hash, yumuşak geçiş, zemin yerleşimi ve bir kez kurulan
// silüet yolları (sırt, çam, bulut, yuvarlak ağaç). Kare başına çalışanlar "worklet".
//
// Zemin: evren sahneleriyle aynı kural — silüetler sekme çubuğunun üstüne (SCENERY.lift) oturur,
// altı zemin rengiyle dolar.

import React from "react";
import { Circle, RadialGradient, Skia, vec } from "@shopify/react-native-skia";
import { sceneScale } from "../../utils/weatherParticles";
import { SCENERY } from "../../utils/weatherUniverses";

export const TAU = Math.PI * 2;

export function rgba(hex, a) {
  const h = String(hex).replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Ton adları → renk (OVERLAY_TONES dizisi ad sırasıyla). */
export const toneMap = (names, colors) =>
  Object.fromEntries(names.map((name, i) => [name, colors[i] || colors[0]]));

export const hash = (i, s) => {
  "worklet";
  const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/** 0–1 yumuşak geçiş (a → b). */
export const sm = (a, b, x) => {
  "worklet";
  const v = (x - a) / (b - a);
  const c = v < 0 ? 0 : v > 1 ? 1 : v;
  return c * c * (3 - 2 * c);
};

/** Sahne ölçeği ve zemin çizgisi (dp). */
export function groundLayout(width, height) {
  const k = sceneScale(width, height);
  return { k, ground: height - SCENERY.lift * k, width, height };
}

/**
 * Yumuşak tepe sırtı: x boyunca birkaç sinüs + hash; altı `bottom`a kapanır.
 * amp dp, n tepe sayısı, seed desen.
 */
export function ridgePath(width, baseY, amp, n, seed, bottom, jag = 0) {
  const path = Skia.Path.Make();
  const steps = Math.max(24, n * 8);
  const pts = [];
  for (let i = 0; i <= steps; i += 1) {
    const x = (width * i) / steps;
    const f = i / steps;
    const y =
      baseY -
      amp *
        (0.55 +
          0.3 * Math.sin(f * n * Math.PI + seed) +
          0.15 * Math.sin(f * n * 2.7 * Math.PI + seed * 2.3)) -
      (jag ? (hash(i, seed) - 0.5) * jag : 0);
    pts.push([x, y]);
  }
  path.moveTo(-10, bottom);
  path.lineTo(-10, pts[0][1]);
  for (let i = 0; i < pts.length - 1; i += 1) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    path.quadTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  path.lineTo(width + 10, pts[pts.length - 1][1]);
  path.lineTo(width + 10, bottom);
  path.close();
  return { path, pts };
}

/** Sırtın x'teki yüksekliği (ridgePath noktalarından doğrusal). */
export function ridgeY(pts, x) {
  "worklet";
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i += 1) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
}

/** Sivri dağ silüeti: peaks [[x, tepeY], ...] (x sıralı); vadiler aradaki derinlikte. */
export function peaksPath(width, peaks, baseY, bottom, seed) {
  const path = Skia.Path.Make();
  const shade = Skia.Path.Make();
  const snow = Skia.Path.Make();
  path.moveTo(-10, bottom);
  path.lineTo(-10, baseY);
  let prev = [-10, baseY];
  peaks.forEach(([x, y], i) => {
    const next = peaks[i + 1] || [width + 10, baseY];
    const vx = (x + next[0]) / 2;
    const vy =
      Math.max(y, next[1]) +
      (baseY - Math.max(y, next[1])) * (0.35 + hash(i, seed) * 0.3);
    // sol yamaç (küçük kırıklarla)
    path.lineTo(
      prev[0] + (x - prev[0]) * 0.55,
      prev[1] + (y - prev[1]) * 0.6 + (hash(i, seed + 1) - 0.5) * 6,
    );
    path.lineTo(x, y);
    path.lineTo(
      x + (vx - x) * 0.4,
      y + (vy - y) * 0.35 + (hash(i, seed + 2) - 0.5) * 5,
    );
    path.lineTo(vx, vy);
    // güneş görmeyen sağ yamaç gölgesi
    shade.moveTo(x, y);
    shade.lineTo(x + (vx - x) * 0.4, y + (vy - y) * 0.35);
    shade.lineTo(vx, vy);
    shade.lineTo(x + (vx - x) * 0.15, baseY + 6);
    shade.close();
    // tepe karı: tepeden aşağı dişli örtü
    const h = (baseY - y) * 0.32;
    const wl = (x - prev[0]) * 0.3;
    const wr = (vx - x) * 0.32;
    snow.moveTo(x, y);
    snow.lineTo(x + wr, y + h * 0.8);
    snow.lineTo(x + wr * 0.55, y + h * 0.62);
    snow.lineTo(x + wr * 0.25, y + h);
    snow.lineTo(x - wl * 0.15, y + h * 0.7);
    snow.lineTo(x - wl * 0.5, y + h * 0.95);
    snow.lineTo(x - wl * 0.7, y + h * 0.6);
    snow.lineTo(x - wl, y + h * 0.75);
    snow.close();
    prev = [vx, vy];
  });
  path.lineTo(width + 10, baseY);
  path.lineTo(width + 10, bottom);
  path.close();
  return { path, shade, snow };
}

/** Çam: tabandan tepeye `tiers` kat; `snowPath` verilirse katların üstüne kar kapakları ekler. */
export function addPine(path, x, base, h, w, tiers = 4, snowPath = null) {
  const trunkH = h * 0.08;
  path.addRect(
    Skia.XYWHRect(x - w * 0.06, base - trunkH, w * 0.12, trunkH + 1),
  );
  const top = base - h;
  for (let j = 0; j < tiers; j += 1) {
    const f0 = j / tiers;
    const yTop = top + (h - trunkH) * f0 * 0.92;
    const yBot = top + (h - trunkH) * Math.min(1, (j + 1.35) / tiers);
    const half = w * 0.5 * (0.35 + 0.65 * ((j + 1) / tiers));
    path.moveTo(x, yTop);
    path.lineTo(x + half, yBot);
    path.quadTo(x, yBot - h * 0.05, x - half, yBot);
    path.close();
    if (snowPath) {
      const sh = (yBot - yTop) * 0.42;
      snowPath.moveTo(x, yTop - 0.5);
      snowPath.lineTo(x + half * 0.62, yTop + sh * 1.3);
      snowPath.quadTo(
        x + half * 0.3,
        yTop + sh * 0.9,
        x + half * 0.12,
        yTop + sh * 1.15,
      );
      snowPath.quadTo(
        x - half * 0.15,
        yTop + sh * 0.85,
        x - half * 0.38,
        yTop + sh * 1.2,
      );
      snowPath.lineTo(x - half * 0.58, yTop + sh * 1.25);
      snowPath.close();
    }
  }
}

/** Kabarık bulut: tabanı düz, üstü daireler. */
export function addCloud(path, cx, cy, w, h, seed) {
  const n = 5;
  for (let i = 0; i < n; i += 1) {
    const f = (i + 0.5) / n;
    const x = cx - w / 2 + f * w;
    const r =
      h * (0.42 + 0.5 * Math.sin(f * Math.PI)) * (0.85 + hash(i, seed) * 0.3);
    path.addCircle(x, cy - r * 0.35, r);
  }
  path.addRRect(
    Skia.RRectXY(
      Skia.XYWHRect(cx - w / 2 - h * 0.2, cy - h * 0.35, w + h * 0.4, h * 0.7),
      h * 0.35,
      h * 0.35,
    ),
  );
}

/** Yuvarlak taçlı ağaç (uzak orman lekesi). */
export function addRoundTree(path, x, base, h, seed) {
  const r = h * 0.32;
  path.addRect(Skia.XYWHRect(x - h * 0.035, base - h * 0.4, h * 0.07, h * 0.4));
  path.addCircle(x, base - h + r, r);
  path.addCircle(x - r * 0.6, base - h * 0.55, r * (0.7 + hash(seed, 1) * 0.2));
  path.addCircle(x + r * 0.6, base - h * 0.58, r * (0.7 + hash(seed, 2) * 0.2));
}

/** Merkezden saydama inen yuvarlak ışık. */
export function Glow({ cx = 0, cy = 0, r, color, a = 1, mid = 0.4 }) {
  return (
    <Circle cx={cx} cy={cy} r={r}>
      <RadialGradient
        c={vec(cx, cy)}
        r={r}
        colors={[rgba(color, a), rgba(color, a * mid), rgba(color, 0)]}
        positions={[0, 0.4, 1]}
      />
    </Circle>
  );
}
