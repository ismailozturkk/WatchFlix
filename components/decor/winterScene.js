// components/decor/winterScene.js
//
// Kar atmosferi sahnesi (OVERLAY.winter = 37) — tamamı VEKTÖR, kar taneleri (parçacık) önünde:
//   • Ay (açık temada soluk kış güneşi) ve halesi; arkada karlı sivri dağlar (tepe karları, gölgeli
//     yamaçlar), aralarında sis; önde karlı tepeler üstünde iki sıra karlı çam ormanı.
//   • Tepede kütük kulübe: kar örtülü çatı (saçak sarkıtları), bacadan kıvrılarak yükselen duman,
//     sıcak ışıklı pencere (titrer) ve kardaki ışık lekesi; önde yarı gömülü çit, sokak lambası ve
//     ışık havuzu, kar yüzeyinde parıldayan kristaller.
//   • Olay (70 sn'de bir ~27 sn): kızıl tilki soldan gelir, kar üstünde iz bırakarak yürür, ortada
//     durup burnunu kara sokar, kuyruğunu sallar, sağdan çıkar; bu arada esen rüzgâr çam tepelerindeki
//     karı savurur. İzler olay sonunda kaybolur.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift (sekme çubuğu). Renkler OVERLAY_TONES[37] (WINTER_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import {
  Circle,
  Group,
  LinearGradient,
  Oval,
  Path,
  Rect,
  Skia,
  vec,
} from "@shopify/react-native-skia";
import { restU } from "../../utils/weatherParticles";
import {
  Glow,
  addPine,
  groundLayout,
  hash,
  peaksPath,
  rgba,
  ridgePath,
  ridgeY,
  sm,
  toneMap,
} from "./seasonKit";

export const WINTER_TONE = [
  "sky",
  "moon",
  "mtnFar",
  "mtnNear",
  "peakSnow",
  "pine",
  "pineSnow",
  "snow",
  "snowShade",
  "wood",
  "roof",
  "window",
  "smoke",
  "fox",
  "glow",
  "sparkle",
];

/** Sahne yerleşimi (dp). */
export function winterLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  return {
    ...L,
    moon: [width * 0.78, height * 0.11, 22 * k],
    farBase: ground - 112 * k,
    hillBase: ground - 64 * k,
    driftBase: ground - 8 * k,
    cabin: [width * 0.56, 58 * k, 34 * k],
    lamp: [width * 0.87, 112 * k],
  };
}

function buildWinter(L) {
  const { k, width, height, ground } = L;
  const bottom = height + 20;
  const far = peaksPath(
    width,
    [
      [0.06, 92],
      [0.22, 136],
      [0.37, 104],
      [0.55, 150],
      [0.71, 118],
      [0.9, 138],
    ].map(([f, h]) => [width * f, L.farBase - h * k]),
    L.farBase,
    bottom,
    3,
  );
  const hill = ridgePath(width, L.hillBase, 34 * k, 3, 1.1, bottom);
  const drift = ridgePath(width, L.driftBase, 16 * k, 2, 2.4, bottom);
  // çamlar: arka sıra küçük, ön sıra büyük
  const pinesBack = Skia.Path.Make();
  const snowBack = Skia.Path.Make();
  const pines = Skia.Path.Make();
  const snowCaps = Skia.Path.Make();
  const tops = [];
  for (let i = 0; i < 22; i += 1) {
    const x = width * (-0.02 + i * 0.05) + hash(i, 1) * 8 * k;
    if (x > width * 0.47 && x < width * 0.66) continue;
    const h = (26 + hash(i, 2) * 22) * k;
    addPine(
      pinesBack,
      x,
      ridgeY(hill.pts, x) - 10 * k,
      h,
      h * 0.5,
      4,
      snowBack,
    );
  }
  const front = [
    -0.03, 0.04, 0.1, 0.17, 0.25, 0.33, 0.4, 0.74, 0.8, 0.88, 0.95, 1.02,
  ];
  front.forEach((f, i) => {
    const x = width * f + (hash(i, 3) - 0.5) * 10 * k;
    const h = (46 + hash(i, 4) * 40) * k;
    const base = ridgeY(hill.pts, x) + 6 * k;
    addPine(pines, x, base, h, h * 0.52, 5, snowCaps);
    tops.push([x, base - h]);
  });
  // kulübe
  const [cx, cw, ch] = L.cabin;
  const cb = ridgeY(hill.pts, cx) + 8 * k;
  const wall = Skia.XYWHRect(cx - cw / 2, cb - ch, cw, ch);
  const logs = Skia.Path.Make();
  for (let j = 1; j < 6; j += 1) {
    const y = cb - (ch * j) / 6;
    logs.moveTo(cx - cw / 2, y);
    logs.lineTo(cx + cw / 2, y);
  }
  const roofTop = cb - ch - 28 * k;
  const roof = Skia.Path.Make();
  roof.moveTo(cx - cw / 2 - 9 * k, cb - ch + 2 * k);
  roof.lineTo(cx, roofTop);
  roof.lineTo(cx + cw / 2 + 9 * k, cb - ch + 2 * k);
  roof.close();
  const roofSnow = Skia.Path.Make();
  roofSnow.moveTo(cx - cw / 2 - 12 * k, cb - ch + 1 * k);
  roofSnow.lineTo(cx, roofTop - 6 * k);
  roofSnow.lineTo(cx + cw / 2 + 12 * k, cb - ch + 1 * k);
  // saçak: sarkan kar dilleri
  for (let j = 0; j <= 8; j += 1) {
    const x = cx + cw / 2 + 12 * k - (j * (cw + 24 * k)) / 8;
    roofSnow.lineTo(x, cb - ch + (j % 2 ? 6 + hash(j, 5) * 4 : 2) * k);
  }
  roofSnow.close();
  const icicles = Skia.Path.Make();
  for (let j = 0; j < 9; j += 1) {
    const x = cx - cw / 2 - 6 * k + j * ((cw + 12 * k) / 8);
    const l = (4 + hash(j, 6) * 7) * k;
    icicles.moveTo(x - 1.4 * k, cb - ch + 3 * k);
    icicles.lineTo(x, cb - ch + 3 * k + l);
    icicles.lineTo(x + 1.4 * k, cb - ch + 3 * k);
    icicles.close();
  }
  const chimney = Skia.XYWHRect(cx + cw * 0.18, roofTop + 2 * k, 9 * k, 20 * k);
  const chimneySnow = Skia.Path.Make();
  chimneySnow.addRRect(
    Skia.RRectXY(
      Skia.XYWHRect(cx + cw * 0.18 - 2 * k, roofTop - 1 * k, 13 * k, 5 * k),
      2.5 * k,
      2.5 * k,
    ),
  );
  const win = Skia.XYWHRect(cx - cw * 0.3, cb - ch * 0.72, 13 * k, 12 * k);
  const mullion = Skia.Path.Make();
  mullion.moveTo(cx - cw * 0.3 + 6.5 * k, cb - ch * 0.72);
  mullion.lineTo(cx - cw * 0.3 + 6.5 * k, cb - ch * 0.72 + 12 * k);
  mullion.moveTo(cx - cw * 0.3, cb - ch * 0.72 + 6 * k);
  mullion.lineTo(cx - cw * 0.3 + 13 * k, cb - ch * 0.72 + 6 * k);
  const door = Skia.Path.Make();
  door.addRRect(
    Skia.RRectXY(
      Skia.XYWHRect(cx + cw * 0.08, cb - ch * 0.66, 11 * k, ch * 0.66),
      2 * k,
      2 * k,
    ),
  );
  const cabinDrift = Skia.Path.Make();
  cabinDrift.moveTo(cx - cw / 2 - 14 * k, cb + 2 * k);
  cabinDrift.quadTo(cx - cw * 0.2, cb - 9 * k, cx, cb - 3 * k);
  cabinDrift.quadTo(
    cx + cw * 0.3,
    cb - 7 * k,
    cx + cw / 2 + 16 * k,
    cb + 2 * k,
  );
  cabinDrift.close();
  // çit (ön sol, yarı gömülü)
  const fence = Skia.Path.Make();
  const fenceSnow = Skia.Path.Make();
  const rails = Skia.Path.Make();
  const posts = [];
  for (let j = 0; j < 6; j += 1) {
    const x = width * (0.03 + j * 0.068);
    const base = ridgeY(drift.pts, x) + 4 * k;
    const h = (30 - j * 1.5) * k;
    const lean = (hash(j, 7) - 0.5) * 4 * k;
    fence.moveTo(x - 2.6 * k, base);
    fence.lineTo(x - 2.6 * k + lean, base - h);
    fence.lineTo(x + lean, base - h - 3 * k);
    fence.lineTo(x + 2.6 * k + lean, base - h);
    fence.lineTo(x + 2.6 * k, base);
    fence.close();
    fenceSnow.addOval(
      Skia.XYWHRect(x - 4 * k + lean, base - h - 5.5 * k, 8 * k, 4.5 * k),
    );
    posts.push([x + lean * 0.5, base - h * 0.7, base - h * 0.35]);
  }
  for (let j = 0; j < posts.length - 1; j += 1) {
    rails.moveTo(posts[j][0], posts[j][1]);
    rails.lineTo(posts[j + 1][0], posts[j + 1][1] + 1.5 * k);
    rails.moveTo(posts[j][0], posts[j][2]);
    rails.lineTo(posts[j + 1][0], posts[j + 1][2] + 1 * k);
  }
  // lamba
  const [lx, lh] = L.lamp;
  const lb = ridgeY(drift.pts, lx) + 6 * k;
  const pole = Skia.Path.Make();
  pole.addRect(Skia.XYWHRect(lx - 1.6 * k, lb - lh, 3.2 * k, lh));
  pole.addRect(Skia.XYWHRect(lx - 4 * k, lb - 8 * k, 8 * k, 8 * k));
  pole.moveTo(lx - 7 * k, lb - lh - 2 * k);
  pole.lineTo(lx + 7 * k, lb - lh - 2 * k);
  pole.lineTo(lx + 4 * k, lb - lh - 16 * k);
  pole.lineTo(lx - 4 * k, lb - lh - 16 * k);
  pole.close();
  const lampCap = Skia.Path.Make();
  lampCap.moveTo(lx - 9 * k, lb - lh - 15 * k);
  lampCap.quadTo(lx, lb - lh - 24 * k, lx + 9 * k, lb - lh - 15 * k);
  lampCap.close();
  // kar parıltıları
  const sparkle = [Skia.Path.Make(), Skia.Path.Make(), Skia.Path.Make()];
  for (let j = 0; j < 36; j += 1) {
    const x = width * hash(j, 8);
    const y = ridgeY(drift.pts, x) + (3 + hash(j, 9) * 50) * k;
    const s = (1 + hash(j, 10) * 1.6) * k;
    const q = sparkle[j % 3];
    q.moveTo(x - s, y);
    q.lineTo(x, y - s * 0.25);
    q.lineTo(x + s, y);
    q.lineTo(x, y + s * 0.25);
    q.close();
    q.moveTo(x, y - s);
    q.lineTo(x + s * 0.25, y);
    q.lineTo(x, y + s);
    q.lineTo(x - s * 0.25, y);
    q.close();
  }
  // tilki izleri (tüm yol; tilkinin geçtiği yere kadar kırpılır)
  const prints = Skia.Path.Make();
  for (let x = -20 * k; x < width + 20 * k; x += 9 * k) {
    const y = ridgeY(drift.pts, x) + 10 * k;
    const side = Math.round(x / (9 * k)) % 2 ? 1 : -1;
    prints.addOval(Skia.XYWHRect(x, y + side * 2 * k, 3.2 * k, 2 * k));
  }
  const craters = Skia.Path.Make();
  const [mx, my, mr] = L.moon;
  craters.addCircle(mx - mr * 0.3, my - mr * 0.2, mr * 0.22);
  craters.addCircle(mx + mr * 0.35, my + mr * 0.25, mr * 0.16);
  craters.addCircle(mx + mr * 0.05, my + mr * 0.45, mr * 0.1);
  craters.addCircle(mx - mr * 0.4, my + mr * 0.35, mr * 0.08);
  return {
    far,
    hill,
    drift,
    pinesBack,
    snowBack,
    pines,
    snowCaps,
    tops,
    wall,
    logs,
    roof,
    roofSnow,
    icicles,
    chimney,
    chimneySnow,
    win,
    mullion,
    door,
    cabinDrift,
    cabinBase: cb,
    roofTop,
    fence,
    fenceSnow,
    rails,
    pole,
    lampCap,
    lampBase: lb,
    sparkle,
    prints,
    craters,
  };
}

// ── Duman ────────────────────────────────────────────────────────────────────
function SmokePuff({ clock, i, x, y, k, color }) {
  const transform = useDerivedValue(() => {
    const f = (clock.value / 11 + i / 7) % 1;
    const dx = f * 46 * k + Math.sin(clock.value * 0.6 + i * 1.7) * 5 * k * f;
    return [
      { translateX: x + dx },
      { translateY: y - f * 120 * k },
      { scale: 0.35 + f * 1.4 },
    ];
  });
  const opacity = useDerivedValue(() => {
    const f = (clock.value / 11 + i / 7) % 1;
    return (1 - f) * (f < 0.1 ? f / 0.1 : 1) * 0.42;
  });
  return (
    <Group transform={transform} opacity={opacity}>
      <Circle cx={0} cy={0} r={9 * k} color={color} />
      <Circle cx={6 * k} cy={-3 * k} r={6 * k} color={color} />
    </Group>
  );
}

// ── Tilki ────────────────────────────────────────────────────────────────────
function foxState(p, t, width, k) {
  "worklet";
  const u = restU(p, t);
  if (u > 1) return { on: 0, x: -999, u, stop: 0, step: 0 };
  const x0 = -0.12 * width;
  const xs = 0.46 * width;
  const x1 = 1.14 * width;
  let x;
  if (u < 0.38) x = x0 + (xs - x0) * (u / 0.38);
  else if (u < 0.56) x = xs;
  else x = xs + (x1 - xs) * ((u - 0.56) / 0.44);
  const stop = sm(0.36, 0.41, u) * (1 - sm(0.52, 0.57, u));
  return { on: 1, x, u, stop, step: t * 9 };
}

function FoxLeg({ s, hx, phase, color }) {
  const transform = useDerivedValue(() => {
    const q = s.value;
    const a = Math.sin(q.step + phase) * 0.55 * (1 - q.stop);
    return [{ translateX: hx }, { translateY: -12 }, { rotate: a }];
  });
  return (
    <Group transform={transform}>
      <Rect x={-1.6} y={0} width={3.2} height={12} color={color} />
    </Group>
  );
}

function Fox({ p, clock, width, k, L, geo, c }) {
  const s = useDerivedValue(() => foxState(p, clock.value, width, k));
  const transform = useDerivedValue(() => {
    const q = s.value;
    const y = ridgeY(geo.drift.pts, q.x) + 8 * k;
    const bob = Math.abs(Math.sin(q.step)) * 1.2 * (1 - q.stop);
    return [{ translateX: q.x }, { translateY: y - bob * k }, { scale: k }];
  });
  const head = useDerivedValue(() => {
    const q = s.value;
    return [
      { translateX: 14 },
      { translateY: -22 },
      { rotate: q.stop * 0.75 + Math.sin(q.step * 0.5) * 0.04 },
    ];
  });
  const tail = useDerivedValue(() => {
    const q = s.value;
    return [
      { translateX: -14 },
      { translateY: -19 },
      {
        rotate:
          -0.15 +
          Math.sin(clock.value * (q.stop ? 6 : 3)) * (0.12 + q.stop * 0.18),
      },
    ];
  });
  const printsClip = useDerivedValue(() =>
    Skia.XYWHRect(-40, 0, Math.max(0, s.value.x + 40), L.height),
  );
  const printsOpacity = useDerivedValue(() =>
    s.value.on ? 0.5 * (1 - sm(0.84, 1, s.value.u)) : 0,
  );
  const opacity = useDerivedValue(() => s.value.on);
  const leg = c.wood;
  return (
    <Group>
      <Group clip={printsClip} opacity={printsOpacity}>
        <Path path={geo.prints} color={c.snowShade} />
      </Group>
      <Group opacity={opacity} transform={transform}>
        <Oval
          x={-20}
          y={-3}
          width={40}
          height={5}
          color={rgba(c.snowShade, 0.5)}
        />
        <FoxLeg s={s} hx={-9} phase={Math.PI} color={leg} />
        <FoxLeg s={s} hx={9} phase={0} color={leg} />
        <Group transform={tail}>
          <Path
            path="M0 0 C-10 -4 -20 -2 -26 4 C-30 8 -27 12 -22 10 C-16 8 -8 6 0 4 Z"
            color={c.fox}
          />
          <Path
            path="M-22 2 C-27 4 -29 9 -24 10 C-21 10 -19 8 -18 6 Z"
            color={c.sparkle}
          />
        </Group>
        <Path
          path="M-16 -18 C-14 -26 8 -27 15 -21 C18 -17 15 -11 8 -11 L-12 -11 C-17 -11 -18 -14 -16 -18 Z"
          color={c.fox}
        />
        <Path path="M6 -12 C10 -12 13 -15 14 -19 L10 -13 Z" color={c.sparkle} />
        <FoxLeg s={s} hx={-6} phase={0} color={c.fox} />
        <FoxLeg s={s} hx={12} phase={Math.PI} color={c.fox} />
        <Group transform={head}>
          <Path path="M-2 -2 L3 -12 L6 -3 Z" color={c.fox} />
          <Path path="M4 -2 L9 -11 L11 -2 Z" color={c.fox} />
          <Path path="M3 -10 L5 -5 L4 -4 Z" color={leg} />
          <Path
            path="M-4 0 C-2 -5 8 -6 11 -1 L18 3 C18 5 16 6 14 6 C8 6 1 6 -3 4 Z"
            color={c.fox}
          />
          <Path path="M4 3 C8 5 12 6 16 5 C12 7 6 7 3 5 Z" color={c.sparkle} />
          <Circle cx={18} cy={3.4} r={1.4} color={leg} />
          <Circle cx={7} cy={-0.5} r={1} color={leg} />
        </Group>
      </Group>
    </Group>
  );
}

// ── Çam tepesinden savrulan kar (rüzgâr) ──────────────────────────────────────
function GustPuff({ p, clock, top, i, k, color }) {
  const transform = useDerivedValue(() => {
    const u = restU(p, clock.value);
    const f = (u - 0.6 - i * 0.012) / 0.22;
    const g = f < 0 ? 0 : f > 1 ? 1 : f;
    return [
      { translateX: top[0] + g * 90 * k },
      { translateY: top[1] + 4 * k - g * 14 * k + g * g * 30 * k },
      { scale: 0.6 + g * 2.2 },
    ];
  });
  const opacity = useDerivedValue(() => {
    const u = restU(p, clock.value);
    const f = (u - 0.6 - i * 0.012) / 0.22;
    return f <= 0 || f >= 1 ? 0 : Math.sin(f * Math.PI) * 0.55;
  });
  return (
    <Group transform={transform} opacity={opacity}>
      <Circle cx={0} cy={0} r={6 * k} color={color} />
      <Circle cx={7 * k} cy={2 * k} r={4 * k} color={color} />
      <Circle cx={-5 * k} cy={3 * k} r={3.5 * k} color={color} />
    </Group>
  );
}

function Sparkles({ clock, paths, color }) {
  const o0 = useDerivedValue(
    () => 0.25 + 0.75 * Math.max(0, Math.sin(clock.value * 1.7)),
  );
  const o1 = useDerivedValue(
    () => 0.25 + 0.75 * Math.max(0, Math.sin(clock.value * 1.3 + 2.1)),
  );
  const o2 = useDerivedValue(
    () => 0.25 + 0.75 * Math.max(0, Math.sin(clock.value * 2.1 + 4.2)),
  );
  return (
    <Group>
      <Path path={paths[0]} color={color} opacity={o0} />
      <Path path={paths[1]} color={color} opacity={o1} />
      <Path path={paths[2]} color={color} opacity={o2} />
    </Group>
  );
}

export default function WinterScene({
  p,
  clock,
  width,
  height,
  tone,
  lightSurface,
}) {
  const L = useMemo(() => winterLayout(width, height), [width, height]);
  const geo = useMemo(() => buildWinter(L), [L]);
  const c = useMemo(() => toneMap(WINTER_TONE, tone.colors), [tone]);
  const { k, ground } = L;
  const [mx, my, mr] = L.moon;
  const [cx, cw, ch] = L.cabin;
  const windowGlow = useDerivedValue(
    () =>
      0.75 +
      0.12 * Math.sin(clock.value * 7.3) +
      0.08 * Math.sin(clock.value * 13.1),
  );
  const chimneyX = cx + cw * 0.18 + 4.5 * k;
  const chimneyY = geo.roofTop - 2 * k;
  const lampY = geo.lampBase - L.lamp[1] - 9 * k;
  const lx = L.lamp[0];
  const night = !lightSurface;
  return (
    <Group opacity={tone.alpha}>
      {/* gök ışığı + ay */}
      <Glow cx={mx} cy={my} r={mr * 6} color={c.moon} a={night ? 0.22 : 0.4} />
      <Circle cx={mx} cy={my} r={mr} color={c.moon} />
      {night ? (
        <Path path={geo.craters} color={rgba(c.mtnNear, 0.16)} />
      ) : (
        <Glow cx={mx} cy={my} r={mr * 2.2} color={c.moon} a={0.7} />
      )}
      {/* uzak dağlar */}
      <Group opacity={0.9}>
        <Path path={geo.far.path}>
          <LinearGradient
            start={vec(0, L.farBase - 180 * k)}
            end={vec(0, L.farBase)}
            colors={[c.mtnNear, c.mtnFar]}
          />
        </Path>
        <Path
          path={geo.far.shade}
          color={rgba("#000000", night ? 0.18 : 0.08)}
        />
        <Path path={geo.far.snow} color={c.peakSnow} />
      </Group>
      {/* sis */}
      <Rect x={0} y={L.farBase - 50 * k} width={width} height={70 * k}>
        <LinearGradient
          start={vec(0, L.farBase - 50 * k)}
          end={vec(0, L.farBase + 20 * k)}
          colors={[rgba(c.sky, 0), rgba(c.sky, 0.7)]}
        />
      </Rect>
      {/* tepeler + arka çamlar */}
      <Path path={geo.pinesBack} color={rgba(c.pine, 0.75)} />
      <Path path={geo.snowBack} color={rgba(c.pineSnow, 0.75)} />
      <Path path={geo.hill.path}>
        <LinearGradient
          start={vec(0, L.hillBase - 40 * k)}
          end={vec(0, ground)}
          colors={[c.snow, c.snowShade]}
        />
      </Path>
      {/* kulübe */}
      <Glow
        cx={cx - cw * 0.3 + 6 * k}
        cy={geo.cabinBase + 4 * k}
        r={46 * k}
        color={c.glow}
        a={night ? 0.35 : 0.15}
      />
      <Rect rect={geo.chimney} color={c.wood} />
      <Path path={geo.chimneySnow} color={c.roof} />
      <Rect rect={geo.wall} color={c.wood} />
      <Path
        path={geo.logs}
        style="stroke"
        strokeWidth={1.1 * k}
        color={rgba("#000000", 0.28)}
      />
      <Path path={geo.door} color={rgba("#000000", 0.3)} />
      <Group opacity={windowGlow}>
        <Glow
          cx={cx - cw * 0.3 + 6.5 * k}
          cy={geo.cabinBase - ch * 0.72 + 6 * k}
          r={26 * k}
          color={c.window}
          a={night ? 0.6 : 0.3}
        />
        <Rect rect={geo.win} color={c.window} />
      </Group>
      <Path
        path={geo.mullion}
        style="stroke"
        strokeWidth={1.4 * k}
        color={c.wood}
      />
      <Path path={geo.roof} color={c.wood} />
      <Path path={geo.roofSnow} color={c.roof} />
      <Path path={geo.icicles} color={rgba(c.roof, 0.85)} />
      <Path path={geo.cabinDrift} color={c.snow} />
      {Array.from({ length: 7 }, (_, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <SmokePuff
          key={i}
          clock={clock}
          i={i}
          x={chimneyX}
          y={chimneyY}
          k={k}
          color={c.smoke}
        />
      ))}
      {/* ön çamlar */}
      <Path path={geo.pines} color={c.pine} />
      <Path path={geo.snowCaps} color={c.pineSnow} />
      {geo.tops.map((top, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <GustPuff
          key={i}
          p={p}
          clock={clock}
          top={top}
          i={i}
          k={k}
          color={c.pineSnow}
        />
      ))}
      {/* ön kar yığını, çit, lamba */}
      <Path path={geo.drift.path}>
        <LinearGradient
          start={vec(0, L.driftBase - 20 * k)}
          end={vec(0, height)}
          colors={[c.snow, c.snow, c.snowShade]}
          positions={[0, 0.25, 1]}
        />
      </Path>
      <Group
        transform={[
          { translateX: lx },
          { translateY: geo.lampBase + 1 * k },
          { scaleY: 0.2 },
        ]}
      >
        <Glow r={58 * k} color={c.glow} a={night ? 0.55 : 0.3} />
      </Group>
      <Path
        path={geo.rails}
        style="stroke"
        strokeWidth={2.4 * k}
        strokeCap="round"
        color={c.wood}
      />
      <Path path={geo.fence} color={c.wood} />
      <Path path={geo.fenceSnow} color={c.roof} />
      <Path path={geo.pole} color={c.pine} />
      <Glow
        cx={lx}
        cy={lampY}
        r={60 * k}
        color={c.glow}
        a={night ? 0.45 : 0.2}
      />
      <Circle cx={lx} cy={lampY} r={4.5 * k} color={c.window} />
      <Path path={geo.lampCap} color={c.roof} />
      <Sparkles clock={clock} paths={geo.sparkle} color={c.sparkle} />
      <Fox p={p} clock={clock} width={width} k={k} L={L} geo={geo} c={c} />
    </Group>
  );
}
