// components/decor/piratesScene.js
//
// Karayip Korsanları evren sahnesi (OVERLAY.pcVec = 64) — tamamı VEKTÖR:
//   • Dolunay + denizde titreşen ışık yolu; ufukta palmiyeli ada ve kurukafa biçimli kaya.
//   • Ortada Siyah İnci: yüksek kıçlı kalyon, üç direk, yırtık kenarlı siyah yelkenler, halatlar,
//     top lombozları, kıçta yanan fenerler, direk tepesinde bayrak; dalgalarla sallanır.
//   • Katman katman, kayan dalgalar; önde köpüklü dalga sırtı.
//   • Olay (68 sn'de bir ~28 sn): Kraken — sağda denizden dört dokunaç kıvrılarak yükselir, salınır
//     ve geri batar; gemi daha sert yalpalar, yükseldikleri yerde su halkaları.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[64] (PC_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Group, LinearGradient, Path, Rect, Skia, vec } from "@shopify/react-native-skia";
import { restU } from "../../utils/weatherParticles";
import { Glow, groundLayout, hash, rgba, sm, toneMap } from "./seasonKit";
import { addPalm, wavePath } from "./universeKit";

export const PC_TONE = [
  "haze",
  "moon",
  "moonGlow",
  "seaFar",
  "sea",
  "seaHi",
  "foam",
  "island",
  "palm",
  "hull",
  "hullDark",
  "sail",
  "rig",
  "lantern",
  "tentacle",
  "tentacleDark",
  "sucker",
  "flag",
];

export function pcLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  return { ...L, base: ground - 6 * k, horizon: ground - 190 * k, line: ground - 40 * k };
}

// ───────────────────────────── durağan yollar

function buildIsland(L) {
  const { k, width, horizon } = L;
  const land = Skia.Path.Make();
  const x = width * 0.8;
  land.moveTo(x - 90 * k, horizon + 2 * k);
  land.quadTo(x - 40 * k, horizon - 26 * k, x + 10 * k, horizon - 22 * k);
  land.quadTo(x + 60 * k, horizon - 16 * k, x + 100 * k, horizon + 2 * k);
  land.close();
  // kurukafa kaya: yuvarlak kubbe + iki göz oyuğu
  const skull = Skia.Path.Make();
  const sx = x - 56 * k;
  skull.addCircle(sx, horizon - 30 * k, 18 * k);
  skull.addRect(Skia.XYWHRect(sx - 12 * k, horizon - 26 * k, 24 * k, 26 * k));
  const eyes = Skia.Path.Make();
  eyes.addOval(Skia.XYWHRect(sx - 10 * k, horizon - 34 * k, 7 * k, 8 * k));
  eyes.addOval(Skia.XYWHRect(sx + 3 * k, horizon - 34 * k, 7 * k, 8 * k));
  eyes.addRect(Skia.XYWHRect(sx - 1 * k, horizon - 22 * k, 2 * k, 5 * k));
  const trunk = Skia.Path.Make();
  const fronds = Skia.Path.Make();
  addPalm(trunk, fronds, x + 10 * k, horizon - 18 * k, 58 * k, 0.3, 2, k);
  addPalm(trunk, fronds, x + 40 * k, horizon - 12 * k, 44 * k, -0.25, 6, k);
  return { land, skull, eyes, trunk, fronds };
}

/** Siyah İnci: su hattı y = 0, pruva solda. */
function buildShip(k) {
  const u = k * 1.05;
  const hull = Skia.Path.Make();
  const dark = Skia.Path.Make();
  const sails = Skia.Path.Make();
  const rig = Skia.Path.Make();
  hull.moveTo(-104 * u, -28 * u);
  hull.quadTo(-92 * u, 4 * u, -60 * u, 12 * u);
  hull.lineTo(66 * u, 12 * u);
  hull.quadTo(92 * u, 8 * u, 96 * u, -22 * u);
  hull.lineTo(102 * u, -52 * u);
  hull.lineTo(68 * u, -52 * u);
  hull.lineTo(64 * u, -32 * u);
  hull.lineTo(-70 * u, -26 * u);
  hull.close();
  // korkuluk + lomboz sırası + kıç pencereleri
  dark.addRect(Skia.XYWHRect(-96 * u, -34 * u, 162 * u, 2 * u));
  for (let i = 0; i < 10; i += 1) dark.addRect(Skia.XYWHRect(-70 * u + i * 13 * u, -14 * u, 6 * u, 5 * u));
  for (let i = 0; i < 3; i += 1) dark.addRect(Skia.XYWHRect(74 * u + i * 8 * u, -44 * u, 5 * u, 7 * u));
  dark.addRect(Skia.XYWHRect(-60 * u, 2 * u, 126 * u, 3 * u));
  // direkler
  const masts = [
    [-50 * u, 150 * u, 3],
    [2 * u, 178 * u, 4],
    [46 * u, 138 * u, 3],
  ];
  masts.forEach(([x, h, n], m) => {
    dark.addRect(Skia.XYWHRect(x - 2 * u, -26 * u - h, 4 * u, h));
    // yelkenler: yukarıdan aşağı genişleyen, alt kenarı yırtık
    let top = -26 * u - h + 14 * u;
    for (let j = 0; j < n; j += 1) {
      const w = (34 + j * 10) * u;
      const sh = (h - 30 * u) / n - 4 * u;
      dark.addRect(Skia.XYWHRect(x - w * 0.6, top - 2 * u, w * 1.2, 2.2 * u)); // seren
      sails.moveTo(x - w * 0.55, top);
      sails.quadTo(x - w * 0.62, top + sh * 0.5, x - w * 0.5, top + sh);
      const teeth = 6;
      for (let t = 1; t <= teeth; t += 1) {
        const fx = x - w * 0.5 + (w * t) / teeth;
        const fy = top + sh - (t % 2 ? hash(m * 10 + j, t) * 9 * u : 0);
        sails.lineTo(fx, fy);
      }
      sails.quadTo(x + w * 0.62, top + sh * 0.5, x + w * 0.55, top);
      sails.close();
      // delikler
      if (hash(m, j) > 0.4) dark.addCircle(x + (hash(j, m) - 0.5) * w * 0.6, top + sh * 0.5, 3 * u);
      top += sh + 6 * u;
    }
    // halatlar: direk tepesinden güverteye
    rig.moveTo(x, -26 * u - h);
    rig.lineTo(x - 40 * u, -30 * u);
    rig.moveTo(x, -26 * u - h);
    rig.lineTo(x + 40 * u, -30 * u);
  });
  // cıvadra + flok yelkeni
  dark.moveTo(-100 * u, -30 * u);
  dark.lineTo(-150 * u, -56 * u);
  dark.lineTo(-149 * u, -59 * u);
  dark.lineTo(-98 * u, -34 * u);
  dark.close();
  sails.moveTo(-54 * u, -150 * u);
  sails.lineTo(-140 * u, -54 * u);
  sails.quadTo(-100 * u, -64 * u, -58 * u, -44 * u);
  sails.close();
  rig.moveTo(2 * u, -204 * u);
  rig.lineTo(-148 * u, -58 * u);
  rig.moveTo(46 * u, -164 * u);
  rig.lineTo(100 * u, -52 * u);
  return { hull, dark, sails, rig, lanterns: [[100 * u, -58 * u], [70 * u, -58 * u]], flag: [2 * u, -204 * u] };
}

// ───────────────────────────── dokunaç

/** Kıvrık, sivrilen dokunaç: (x0, y0) dipten; h boy, dir kıvrım yönü, t salınım saati. */
function tentaclePath(x0, y0, h, dir, t, k) {
  "worklet";
  const body = Skia.Path.Make();
  const cups = Skia.Path.Make();
  if (h < 4 * k) return { body, cups };
  const n = 26;
  const step = h / n;
  let x = x0;
  let y = y0;
  let a = -Math.PI / 2;
  const left = [];
  const right = [];
  for (let i = 0; i <= n; i += 1) {
    const s = i / n;
    const w = (1 - s) * 15 * k + 1.2 * k;
    const nx = Math.cos(a + Math.PI / 2);
    const ny = Math.sin(a + Math.PI / 2);
    left.push([x + nx * w, y + ny * w]);
    right.push([x - nx * w, y - ny * w]);
    if (i % 3 === 1 && s < 0.85) cups.addCircle(x + nx * w * 0.55 * dir, y + ny * w * 0.55 * dir, w * 0.28);
    a += dir * (0.015 + s * s * s * 0.42 + Math.sin(t * 1.3 + s * 4) * 0.035);
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
  }
  body.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < left.length; i += 1) body.lineTo(left[i][0], left[i][1]);
  for (let i = right.length - 1; i >= 0; i -= 1) body.lineTo(right[i][0], right[i][1]);
  body.close();
  return { body, cups };
}

const TENTACLES = [
  [0.58, 0.7, -1, 0],
  [0.72, 1, 1, 0.06],
  [0.86, 0.85, -1, 0.03],
  [0.98, 0.6, 1, 0.09],
];

function Tentacle({ p, clock, L, c, spec }) {
  const { k, width, line } = L;
  const [fx, hs, dir, delay] = spec;
  const d = useDerivedValue(() => {
    const u = restU(p, clock.value);
    const rise = u > 1 ? 0 : sm(0.12 + delay, 0.34 + delay, u) * (1 - sm(0.7 + delay, 0.9, u));
    return tentaclePath(width * fx, line + 6 * k, rise * hs * 300 * k, dir, clock.value + delay * 20, k);
  });
  const body = useDerivedValue(() => d.value.body);
  const cups = useDerivedValue(() => d.value.cups);
  return (
    <Group>
      <Path path={body} color={c.tentacle} />
      <Path path={cups} color={c.sucker} />
    </Group>
  );
}

function Splash({ p, clock, L, c }) {
  const { k, width, line } = L;
  const ring = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const u = restU(p, clock.value);
    if (u > 1 || u < 0.12) return q;
    TENTACLES.forEach(([fx, , , delay]) => {
      const e = (u - 0.12 - delay) / 0.3;
      if (e < 0 || e > 1) return;
      const r = (10 + e * 40) * k;
      q.addOval(Skia.XYWHRect(width * fx - r, line + 6 * k - r * 0.18, r * 2, r * 0.36));
    });
    return q;
  });
  return <Path path={ring} style="stroke" strokeWidth={1.4 * k} color={c.foam} opacity={0.7} />;
}

function Ship({ p, clock, L, c, night }) {
  const { k, width, line } = L;
  const ship = useMemo(() => buildShip(k), [k]);
  const at = useDerivedValue(() => {
    const u = restU(p, clock.value);
    const storm = u > 1 ? 0 : sm(0.1, 0.3, u) * (1 - sm(0.75, 0.95, u));
    const roll = Math.sin(clock.value * 0.9) * (0.035 + storm * 0.06);
    const heave = Math.sin(clock.value * 1.1 + 1) * (3 + storm * 5) * k;
    return [{ translateX: width * 0.34 }, { translateY: line + heave }, { rotate: roll }];
  });
  const flag = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const [fx, fy] = ship.flag;
    const w = Math.sin(clock.value * 4) * 3 * k;
    q.moveTo(fx, fy);
    q.quadTo(fx + 12 * k, fy - 4 * k + w, fx + 24 * k, fy + w);
    q.lineTo(fx + 24 * k, fy + 14 * k + w);
    q.quadTo(fx + 12 * k, fy + 10 * k + w, fx, fy + 14 * k);
    q.close();
    return q;
  });
  const lampA = useDerivedValue(() => (night ? 0.75 : 0.4) * (0.85 + 0.15 * Math.sin(clock.value * 7)));
  return (
    <Group transform={at}>
      <Path path={ship.rig} style="stroke" strokeWidth={0.8 * k} color={c.rig} />
      <Path path={ship.sails} color={c.sail} />
      <Path path={ship.hull} color={c.hull} />
      <Path path={ship.dark} color={c.hullDark} />
      <Path path={flag} color={c.flag} />
      {ship.lanterns.map(([x, y], i) => (
        <Group key={i} opacity={lampA} transform={[{ translateX: x }, { translateY: y }]}>
          <Glow r={26 * k} color={c.lantern} a={0.9} mid={0.3} />
        </Group>
      ))}
    </Group>
  );
}

function Waves({ clock, L, c, y, amp, len, speed, color, opacity }) {
  const { width, height } = L;
  const q = useDerivedValue(() => wavePath(width + len, y, amp, len, clock.value * speed, height + 10));
  const at = useDerivedValue(() => [{ translateX: ((clock.value * speed * 12) % len) - len }]);
  return (
    <Group transform={at} opacity={opacity}>
      <Path path={q} color={color} />
    </Group>
  );
}

export default function PiratesScene({ p, clock, width, height, tone, lightSurface }) {
  const L = useMemo(() => pcLayout(width, height), [width, height]);
  const island = useMemo(() => buildIsland(L), [L]);
  const c = useMemo(() => toneMap(PC_TONE, tone.colors), [tone]);
  const { k, horizon, line } = L;
  const night = !lightSurface;
  const mx = width * 0.24;
  const my = horizon - 330 * k;
  const path = useMemo(() => {
    const q = Skia.Path.Make();
    for (let i = 0; i < 22; i += 1) {
      const y = horizon + 6 * k + i * 7 * k;
      const w = (8 + i * 3 + hash(i, 2) * 16) * k;
      q.addRect(Skia.XYWHRect(mx - w / 2 + (hash(i, 3) - 0.5) * 20 * k, y, w, 1.6 * k));
    }
    return q;
  }, [horizon, k, mx]);
  const moon = useMemo(() => {
    const q = Skia.Path.Make();
    q.addCircle(mx, my, 34 * k);
    return q;
  }, [mx, my, k]);
  const shimmer = useDerivedValue(() => 0.5 + 0.3 * Math.sin(clock.value * 2.1));
  return (
    <Group opacity={tone.alpha}>
      <Rect x={0} y={horizon - 220 * k} width={width} height={220 * k}>
        <LinearGradient start={vec(0, horizon - 220 * k)} end={vec(0, horizon)} colors={[rgba(c.haze, 0), c.haze]} />
      </Rect>
      {/* ay */}
      <Group transform={[{ translateX: mx }, { translateY: my }]}>
        <Glow r={130 * k} color={c.moonGlow} a={night ? 0.4 : 0.3} mid={0.3} />
      </Group>
      <Path path={moon} color={c.moon} />
      {/* ada */}
      <Path path={island.trunk} color={c.island} />
      <Path path={island.fronds} color={c.palm} />
      <Path path={island.land} color={c.island} />
      <Path path={island.skull} color={c.island} />
      <Path path={island.eyes} color={c.seaFar} />
      {/* deniz */}
      <Rect x={0} y={horizon} width={width} height={L.height - horizon} color={c.seaFar} />
      <Group opacity={shimmer}>
        <Path path={path} color={c.moon} />
      </Group>
      <Waves clock={clock} L={L} c={c} y={horizon + 40 * k} amp={3 * k} len={60 * k} speed={0.6} color={c.sea} opacity={0.6} />
      {TENTACLES.slice(0, 2).map((s, i) => (
        <Tentacle key={i} p={p} clock={clock} L={L} c={c} spec={s} />
      ))}
      <Ship p={p} clock={clock} L={L} c={c} night={night} />
      <Waves clock={clock} L={L} c={c} y={line - 4 * k} amp={5 * k} len={80 * k} speed={0.9} color={c.sea} opacity={1} />
      {TENTACLES.slice(2).map((s, i) => (
        <Tentacle key={i} p={p} clock={clock} L={L} c={c} spec={s} />
      ))}
      <Splash p={p} clock={clock} L={L} c={c} />
      <Waves clock={clock} L={L} c={c} y={line + 30 * k} amp={7 * k} len={110 * k} speed={1.3} color={c.seaHi} opacity={0.9} />
    </Group>
  );
}
