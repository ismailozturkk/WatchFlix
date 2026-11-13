// components/decor/witcherScene.js
//
// The Witcher evren sahnesi (OVERLAY.wiVec = 73) — tamamı VEKTÖR:
//   • Dolunaylı, sisli bozkır: uzak tepede yıkık kale kulesi (tek pencerede kandil), dalgalı sırtta
//     kuru, kıvrık ağaçlar; önde koyu çayır. Sis bantları yavaşça kayar, kargalar ağaç üstünde döner.
//   • İKİ olay (döngüde sırayla, eventPick):
//       A) Sırtın üstünde, sırtında kılıç taşıyan ak saçlı bir atlı dörtnala gelir, ortada durur,
//          elini kaldırıp önüne YELPAZE gibi açılan bir ateş dalgası savurur, sonra yoluna devam eder.
//       B) Kanatlı bir yaratık (kartal başlı, aslan gövdeli) ayın önünden süzülür; kargalar ağaçtan
//          dağılır.
//
// Logo / amblem YOK (madalyon, okul işareti çizilmez): yalnız esinli silüet.
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[73] (WI_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Group, LinearGradient, Path, Rect, Skia, vec } from "@shopify/react-native-skia";
import { eventPick, restU } from "../../utils/weatherParticles";
import { Glow, groundLayout, hash, ridgePath, ridgeY, rgba, sm, toneMap } from "./seasonKit";
import { addStars } from "./universeKit";

export const WI_TONE = [
  "moon",
  "moonGlow",
  "fog",
  "hill",
  "hillFar",
  "ruin",
  "ruinLit",
  "tree",
  "grass",
  "horse",
  "rider",
  "hair",
  "steel",
  "fire",
  "fireCore",
  "beast",
  "beastWing",
  "crow",
  "star",
];

const RS = 1.5; // atlının ölçeği (× k)

export function wiLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  return {
    ...L,
    ridgeBase: ground - 54 * k,
    farBase: ground - 150 * k,
    moonX: width * 0.68,
    moonY: ground - 430 * k,
    moonR: 58 * k,
  };
}

// ───────────────────────────── statik

/** Kıvrık kuru ağaç: gövde + 2 kat dallanma (kalın çizgi yerine ince dolgu). */
function addDeadTree(q, x, base, h, seed, k) {
  const branch = (x0, y0, ang, len, w, depth) => {
    const x1 = x0 + Math.sin(ang) * len;
    const y1 = y0 - Math.cos(ang) * len;
    const nx = Math.cos(ang) * w;
    const ny = Math.sin(ang) * w;
    const bend = (hash(depth * 7 + len, seed) - 0.5) * len * 0.35;
    q.moveTo(x0 - nx, y0 - ny);
    q.quadTo((x0 + x1) / 2 + bend, (y0 + y1) / 2, x1 - nx * 0.3, y1 - ny * 0.3);
    q.lineTo(x1 + nx * 0.3, y1 + ny * 0.3);
    q.quadTo((x0 + x1) / 2 + bend, (y0 + y1) / 2, x0 + nx, y0 + ny);
    q.close();
    if (depth >= 3) return;
    const n = depth === 0 ? 3 : 2;
    for (let i = 0; i < n; i += 1) {
      const a = ang + (i - (n - 1) / 2) * 0.7 + (hash(i + depth * 3, seed) - 0.5) * 0.4;
      branch(x1, y1, a, len * (0.55 + hash(i, seed + depth) * 0.15), w * 0.55, depth + 1);
    }
  };
  branch(x, base, (hash(1, seed) - 0.5) * 0.25, h * 0.45, 3.4 * k, 0);
}

function buildLand(L) {
  const { width, k, ridgeBase, farBase, height } = L;
  const far = ridgePath(width, farBase, 46 * k, 3, 4.1, height);
  const ridge = ridgePath(width, ridgeBase, 40 * k, 3, 1.7, height);
  // yıkık kale: uzak tepenin sol omzunda
  const ruin = Skia.Path.Make();
  const lit = Skia.Path.Make();
  const rx = width * 0.2;
  const ry = ridgeY(far.pts, rx) + 4 * k;
  ruin.moveTo(rx - 16 * k, ry);
  ruin.lineTo(rx - 15 * k, ry - 96 * k);
  ruin.lineTo(rx - 10 * k, ry - 96 * k);
  ruin.lineTo(rx - 10 * k, ry - 104 * k);
  ruin.lineTo(rx - 4 * k, ry - 104 * k);
  ruin.lineTo(rx - 4 * k, ry - 98 * k);
  ruin.lineTo(rx + 2 * k, ry - 98 * k);
  ruin.lineTo(rx + 6 * k, ry - 86 * k); // yıkık tepe
  ruin.lineTo(rx + 10 * k, ry - 90 * k);
  ruin.lineTo(rx + 15 * k, ry - 70 * k);
  ruin.lineTo(rx + 16 * k, ry);
  ruin.close();
  // yıkık sur + kemer
  ruin.moveTo(rx + 14 * k, ry);
  ruin.lineTo(rx + 14 * k, ry - 34 * k);
  ruin.lineTo(rx + 30 * k, ry - 38 * k);
  ruin.lineTo(rx + 40 * k, ry - 26 * k);
  ruin.lineTo(rx + 54 * k, ry - 30 * k);
  ruin.lineTo(rx + 60 * k, ry - 14 * k);
  ruin.lineTo(rx + 70 * k, ry);
  ruin.close();
  ruin.moveTo(rx - 14 * k, ry);
  ruin.lineTo(rx - 40 * k, ry - 22 * k);
  ruin.lineTo(rx - 48 * k, ry - 16 * k);
  ruin.lineTo(rx - 60 * k, ry);
  ruin.close();
  const holes = Skia.Path.Make();
  holes.addRRect(Skia.RRectXY(Skia.XYWHRect(rx + 34 * k, ry - 20 * k, 10 * k, 20 * k), 5 * k, 5 * k));
  holes.addRect(Skia.XYWHRect(rx - 6 * k, ry - 60 * k, 2.4 * k, 8 * k));
  lit.addRect(Skia.XYWHRect(rx - 3 * k, ry - 78 * k, 3 * k, 6 * k));
  // ağaçlar: sırtın üstünde 3 kuru ağaç
  const trees = Skia.Path.Make();
  const treeSpots = [
    [width * 0.08, 70],
    [width * 0.86, 96],
    [width * 0.96, 60],
  ];
  treeSpots.forEach(([x, h], i) => addDeadTree(trees, x, ridgeY(ridge.pts, x) + 4 * k, h * k, i + 3, k));
  // önde çayır: koyu bant + ot uçları
  const grass = Skia.Path.Make();
  const gy = L.ground - 18 * k;
  grass.moveTo(-10, height);
  grass.lineTo(-10, gy);
  for (let x = -10; x <= width + 10; x += 5 * k) {
    const h = (6 + hash(Math.round(x), 2) * 12) * k;
    grass.lineTo(x + 1.5 * k, gy - h);
    grass.lineTo(x + 3 * k, gy - 1 * k);
  }
  grass.lineTo(width + 10, gy);
  grass.lineTo(width + 10, height);
  grass.close();
  const stars = Skia.Path.Make();
  addStars(stars, width, 30 * k, farBase - 240 * k, 70, 21, k);
  return { far, ridge, ruin, holes, lit, trees, grass, stars, ruinAt: [rx, ry - 75 * k], crowAt: [width * 0.86, ridgeY(ridge.pts, width * 0.86) - 80 * k] };
}

// ───────────────────────────── atlı (yan görünüş, burun sağda; taban y = 0, birim 1 = k)

const HORSE_BODY =
  "M -15 -18 Q -14 -25 -4 -24.5 L 8 -24.5 Q 12 -25 14 -28.5 L 18.6 -36 Q 20.6 -38.6 23 -36.4 L 28.4 -29.4 Q 29 -26.4 25.6 -26.4 L 18 -28 Q 14.6 -21 12.6 -15.4 Q 4 -12 -8 -12.4 Q -15.4 -12.6 -15 -18 Z";
const RIDER =
  // pelerinli gövde, baş (saç ayrı), sırtta kılıç
  "M -6 -24 Q -7 -32 -3 -37 L 2 -37 Q 4 -32 3 -24 Z M -4 -24 L -8 -16 L -2 -16 L 0 -24 Z";

function horseLegs(ph, run) {
  "worklet";
  const q = Skia.Path.Make();
  // [kalça x, faz]
  const legs = [
    [9, 0],
    [7, 0.55],
    [-10, Math.PI],
    [-12, Math.PI + 0.55],
  ];
  for (let i = 0; i < 4; i += 1) {
    const hx = legs[i][0];
    const a = Math.sin(ph + legs[i][1]) * 0.7 * run;
    const b = a + (Math.cos(ph + legs[i][1]) > 0 ? 0.9 : 0.1) * run * (i < 2 ? -1 : 1);
    const kx = hx + Math.sin(a) * 7;
    const ky = -14 + Math.cos(a) * 7;
    q.moveTo(hx, -14);
    q.lineTo(kx, ky);
    q.lineTo(kx + Math.sin(b) * 7, ky + Math.cos(b) * 7);
  }
  return q;
}

function Rider({ p, clock, L, land, c }) {
  const { k, width } = L;
  const pts = land.ridge.pts;
  // u → x: dörtnala gelir (0.06–0.34), durur (0.34–0.6: ateş), sonra çıkar (0.6–0.86)
  const xAt = (u) => {
    "worklet";
    const stop = width * 0.42;
    if (u < 0.34) return -40 * k + (stop + 40 * k) * sm(0.06, 0.34, u) * 0.98 + (stop + 40 * k) * 0.02 * sm(0.3, 0.34, u);
    if (u < 0.6) return stop;
    return stop + (width + 60 * k - stop) * sm(0.6, 0.88, u);
  };
  const run = (u) => {
    "worklet";
    return 1 - sm(0.3, 0.35, u) * (1 - sm(0.58, 0.64, u));
  };
  const show = useDerivedValue(() => {
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 0) return 0;
    return sm(0.05, 0.08, u) * (1 - sm(0.84, 0.88, u));
  });
  const at = useDerivedValue(() => {
    const u = Math.min(1, restU(p, clock.value));
    const x = xAt(u);
    const r = run(u);
    const y = ridgeY(pts, x) + 3 * k - Math.abs(Math.sin(clock.value * 9)) * 2.2 * k * r;
    return [{ translateX: x }, { translateY: y }, { scale: k * RS }, { rotate: Math.sin(clock.value * 9) * 0.03 * r }];
  });
  const legs = useDerivedValue(() => {
    const u = Math.min(1, restU(p, clock.value));
    return horseLegs(clock.value * 9, Math.max(0.12, run(u)));
  });
  const tail = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const s = Math.sin(clock.value * 7) * 3;
    q.moveTo(-15, -20);
    q.quadTo(-22, -20 + s, -25, -10 + s);
    return q;
  });
  // el kalkar (ateş anı)
  const arm = useDerivedValue(() => {
    const u = Math.min(1, restU(p, clock.value));
    const raise = sm(0.36, 0.4, u) * (1 - sm(0.54, 0.58, u));
    const q = Skia.Path.Make();
    q.moveTo(0, -33);
    q.lineTo(4 + raise * 8, -28 - raise * 6);
    return q;
  });
  return (
    <Group opacity={show}>
      <Group transform={at}>
        <Path path={tail} style="stroke" strokeWidth={2.2} strokeCap="round" color={c.horse} />
        <Path path={legs} style="stroke" strokeWidth={2.4} strokeCap="round" strokeJoin="round" color={c.horse} />
        <Path path={HORSE_BODY} color={c.horse} />
        <Path path="M -6 -38 L 6 -48" style="stroke" strokeWidth={1.2} color={c.steel} />
        <Path path={RIDER} color={c.rider} />
        <Path path={arm} style="stroke" strokeWidth={2.2} strokeCap="round" color={c.rider} />
        <Path path="M 0 -40 m -2.8 0 a 2.8 2.8 0 1 0 5.6 0 a 2.8 2.8 0 1 0 -5.6 0" color={c.hair} />
        <Path path="M -2.6 -40 Q -5 -36 -4.4 -33 L -2 -36 Z" color={c.hair} />
      </Group>
    </Group>
  );
}

function FireSign({ p, clock, L, land, c }) {
  const { k, width } = L;
  const hx = width * 0.42 + 12 * k * RS;
  const hy = ridgeY(land.ridge.pts, width * 0.42) + 3 * k - 34 * k * RS;
  const amt = useDerivedValue(() => {
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 0) return 0;
    return sm(0.4, 0.43, u) * (1 - sm(0.5, 0.58, u));
  });
  // yelpaze gibi açılan alev dalgası: dışarı akan parçalar
  const flames = useDerivedValue(() => {
    const outer = Skia.Path.Make();
    const a = amt.value;
    if (a < 0.02) return outer;
    for (let i = 0; i < 34; i += 1) {
      const f = (clock.value * 1.4 + hash(i, 1)) % 1;
      const ang = (hash(i, 2) - 0.5) * 0.7 - 0.08;
      const d = (8 + f * 110) * k * a;
      const r = (2.5 + f * 9) * k * (1 - f * 0.45) * a;
      outer.addCircle(hx + Math.cos(ang) * d, hy + Math.sin(ang) * d - f * 10 * k, r);
    }
    return outer;
  });
  const core = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const a = amt.value;
    if (a < 0.02) return q;
    for (let i = 0; i < 18; i += 1) {
      const f = (clock.value * 1.4 + hash(i, 5)) % 1;
      const ang = (hash(i, 6) - 0.5) * 0.45 - 0.08;
      const d = (6 + f * 70) * k * a;
      q.addCircle(hx + Math.cos(ang) * d, hy + Math.sin(ang) * d - f * 6 * k, (1.6 + f * 4) * k * (1 - f * 0.6) * a);
    }
    return q;
  });
  return (
    <Group opacity={amt}>
      <Group transform={[{ translateX: hx + 40 * k }, { translateY: hy }]}>
        <Glow r={110 * k} color={c.fire} a={0.45} mid={0.3} />
      </Group>
      <Path path={flames} color={c.fire} opacity={0.85} />
      <Path path={core} color={c.fireCore} />
    </Group>
  );
}

// ───────────────────────────── kanatlı yaratık (sağa uçar; gövde merkezi 0,0)

const BEAST_BODY =
  // aslan gövdesi + kartal başı/gagası + püsküllü kuyruk
  "M -22 2 Q -18 -6 -6 -6 L 10 -7 Q 16 -9 20 -14 Q 24 -17 28 -14 L 33 -12 L 28 -10.6 Q 25 -9 22 -6 Q 18 0 10 3 L -10 4 Q -18 5 -22 2 Z M -21 1 Q -30 -2 -36 4 Q -38 7 -35 7 Q -31 3 -22 4 Z M 6 2 L 9 10 L 11 10 L 9 2 Z M -12 3 L -15 10 L -13 10 L -9 3 Z";
const BEAST_WING =
  // kök (0,−5) ; açık (yukarı) poz — scaleY ile çırpılır
  "M -6 -5 Q -10 -30 -2 -46 L 2 -40 L 6 -44 L 8 -36 L 13 -38 L 13 -29 L 18 -28 Q 14 -14 8 -5 Z";

function Beast({ p, clock, L, c }) {
  const { k, width, moonY } = L;
  const show = useDerivedValue(() => {
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 1) return 0;
    return sm(0.06, 0.12, u) * (1 - sm(0.8, 0.86, u));
  });
  const at = useDerivedValue(() => {
    const u = Math.min(1, restU(p, clock.value));
    const e = sm(0.06, 0.86, u);
    const x = -80 * k + (width + 160 * k) * e;
    const y = moonY + 70 * k - Math.sin(e * Math.PI) * 60 * k + Math.sin(clock.value * 2.4) * 6 * k;
    return [{ translateX: x }, { translateY: y }, { scale: k * 2 }, { rotate: -0.08 + Math.sin(clock.value * 2.4) * 0.05 }];
  });
  const flap = useDerivedValue(() => {
    const f = Math.sin(clock.value * 5.2);
    return [{ translateY: -5 }, { scaleY: 0.25 + 0.75 * (0.5 + 0.5 * f) }, { translateY: 5 }];
  });
  const flapFar = useDerivedValue(() => {
    const f = Math.sin(clock.value * 5.2 - 0.35);
    return [{ translateX: 4 }, { translateY: -5 }, { scaleY: 0.2 + 0.7 * (0.5 + 0.5 * f) }, { translateY: 5 }];
  });
  return (
    <Group opacity={show}>
      <Group transform={at}>
        <Group transform={flapFar}>
          <Path path={BEAST_WING} color={c.beastWing} />
        </Group>
        <Path path={BEAST_BODY} color={c.beast} />
        <Group transform={flap}>
          <Path path={BEAST_WING} color={c.beast} />
        </Group>
      </Group>
    </Group>
  );
}

// kargalar: ağaç üstünde gevşek daire; B olayında dışarı dağılır
function Crows({ p, clock, L, at, c }) {
  const { k } = L;
  const q = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const u = restU(p, clock.value);
    const scatter = u <= 1 && eventPick(p, clock.value, 2) === 1 ? sm(0.3, 0.55, u) * (1 - sm(0.85, 1, u)) : 0;
    for (let i = 0; i < 5; i += 1) {
      const a = clock.value * (0.35 + hash(i, 1) * 0.2) + i * 1.3;
      const r = (26 + hash(i, 2) * 30) * k * (1 + scatter * 6);
      const x = at[0] + Math.cos(a) * r;
      const y = at[1] + Math.sin(a) * r * 0.35 - scatter * 60 * k * hash(i, 3);
      const w = (5 + hash(i, 4) * 2) * k;
      const fl = Math.sin(clock.value * 8 + i * 2) * 2.4 * k;
      path.moveTo(x - w, y - fl);
      path.quadTo(x - w * 0.4, y - w * 0.3, x, y);
      path.quadTo(x + w * 0.4, y - w * 0.3, x + w, y - fl);
    }
    return path;
  });
  return <Path path={q} style="stroke" strokeWidth={1.4 * k} strokeCap="round" strokeJoin="round" color={c.crow} />;
}

function Fog({ clock, L, y, h, speed, c, a }) {
  const { width } = L;
  const at = useDerivedValue(() => [{ translateX: Math.sin(clock.value * speed) * 30 * L.k }]);
  return (
    <Group transform={at}>
      <Rect x={-40} y={y - h} width={width + 80} height={h * 2}>
        <LinearGradient start={vec(0, y - h)} end={vec(0, y + h)} colors={[rgba(c.fog, 0), rgba(c.fog, a), rgba(c.fog, 0)]} />
      </Rect>
    </Group>
  );
}

export default function WitcherScene({ p, clock, width, height, tone, lightSurface }) {
  const L = useMemo(() => wiLayout(width, height), [width, height]);
  const land = useMemo(() => buildLand(L), [L]);
  const c = useMemo(() => toneMap(WI_TONE, tone.colors), [tone]);
  const { k, moonX, moonY, moonR, ridgeBase, farBase } = L;
  const night = !lightSurface;
  const litOp = useDerivedValue(() => 0.7 + 0.3 * Math.sin(clock.value * 3.3) * Math.sin(clock.value * 1.9));
  return (
    <Group opacity={tone.alpha}>
      <Path path={land.stars} color={c.star} opacity={night ? 0.6 : 0} />
      <Group transform={[{ translateX: moonX }, { translateY: moonY }]}>
        <Glow r={moonR * 3.2} color={c.moonGlow} a={night ? 0.3 : 0.35} mid={0.3} />
      </Group>
      <Path path={`M ${moonX} ${moonY} m ${-moonR} 0 a ${moonR} ${moonR} 0 1 0 ${moonR * 2} 0 a ${moonR} ${moonR} 0 1 0 ${-moonR * 2} 0`} color={c.moon} />
      {/* ay lekeleri */}
      <Path
        path={`M ${moonX - 18 * k} ${moonY - 12 * k} m -10 0 a 10 8 0 1 0 20 0 a 10 8 0 1 0 -20 0 M ${moonX + 16 * k} ${moonY + 14 * k} m -14 0 a 14 10 0 1 0 28 0 a 14 10 0 1 0 -28 0`}
        color={c.moonGlow}
        opacity={0.5}
      />
      <Beast p={p} clock={clock} L={L} c={c} />
      <Path path={land.far.path} color={c.hillFar} />
      <Path path={land.ruin} color={c.ruin} />
      <Path path={land.holes} color={c.hillFar} />
      <Group opacity={litOp}>
        <Group transform={[{ translateX: land.ruinAt[0] }, { translateY: land.ruinAt[1] }]}>
          <Glow r={14 * k} color={c.ruinLit} a={0.6} mid={0.3} />
        </Group>
        <Path path={land.lit} color={c.ruinLit} />
      </Group>
      <Fog clock={clock} L={L} y={farBase + 10 * k} h={26 * k} speed={0.11} c={c} a={night ? 0.32 : 0.55} />
      <Path path={land.ridge.path} color={c.hill} />
      <Path path={land.trees} color={c.tree} />
      <Crows p={p} clock={clock} L={L} at={land.crowAt} c={c} />
      <Rider p={p} clock={clock} L={L} land={land} c={c} />
      <FireSign p={p} clock={clock} L={L} land={land} c={c} />
      <Fog clock={clock} L={L} y={ridgeBase + 14 * k} h={20 * k} speed={0.07} c={c} a={night ? 0.25 : 0.45} />
      <Path path={land.grass} color={c.grass} />
    </Group>
  );
}
