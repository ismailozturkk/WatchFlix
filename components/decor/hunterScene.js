// components/decor/hunterScene.js
//
// Hunter x Hunter evren sahnesi (OVERLAY.hxVec = 69) — tamamı VEKTÖR:
//   • Balina Adası: solda yeşil tepe ve tepesinde dev, yuvarlak taçlı ağaç; sağda deniz ufku.
//   • Uzakta bulutları delen, katmanlı ince Göklerin Arenası kulesi; kümülüs bulutlar yavaşça kayar.
//   • Önde göl kıyısı: kayaya saplanmış olta, sarkan misina ve suda sallanan şamandıra.
//   • Olay (66 sn'de bir ~27 sn): şamandıra birden batar, gölün dev bıyıklı balığı sudan yay çizerek
//     sıçrar ve geri dalar (su halkaları, sıçrantı); üstten Avcı Birliği zeplini geçer.
//   • Olay B (dönüşümlü): tepede diken saçlı bir çocuk belirir; çevresinde altın aura alev alev
//     kabarır, yumruğunu denize doğru savurur — şok dalgası suyu yararak ufka koşar ve orada dev bir
//     su sütunu patlatır; aura söner.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[69] (HX_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Group, LinearGradient, Path, Rect, Skia, vec } from "@shopify/react-native-skia";
import { eventU } from "../../utils/weatherParticles";
import { Glow, addCloud, groundLayout, hash, rgba, sm, toneMap } from "./seasonKit";
import { addBlade } from "./universeKit";

export const HX_TONE = [
  "haze",
  "cloud",
  "cloudShade",
  "sea",
  "seaHi",
  "tower",
  "towerShade",
  "hill",
  "hillHi",
  "trunk",
  "leaf",
  "leafHi",
  "rock",
  "rockDark",
  "rod",
  "line",
  "float",
  "fish",
  "fishHi",
  "ship",
  "shipDark",
  "splash",
  "water",
];

export function hxLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  return { ...L, horizon: ground - 150 * k, lake: ground - 24 * k };
}

// ───────────────────────────── durağan yollar

function buildTower(L) {
  const { k, width, horizon } = L;
  const x = width * 0.8;
  const top = horizon - 560 * k;
  const body = Skia.Path.Make();
  const shade = Skia.Path.Make();
  body.moveTo(x - 20 * k, horizon);
  body.lineTo(x - 9 * k, top + 40 * k);
  body.lineTo(x - 4 * k, top);
  body.lineTo(x + 4 * k, top);
  body.lineTo(x + 9 * k, top + 40 * k);
  body.lineTo(x + 20 * k, horizon);
  body.close();
  shade.moveTo(x + 2 * k, horizon);
  shade.lineTo(x + 2 * k, top);
  shade.lineTo(x + 4 * k, top);
  shade.lineTo(x + 9 * k, top + 40 * k);
  shade.lineTo(x + 20 * k, horizon);
  shade.close();
  // katman halkaları
  for (let i = 0; i < 9; i += 1) {
    const f = i / 8;
    const y = horizon - f * (horizon - top - 60 * k) - 20 * k;
    const w = (20 - f * 11) * k + 6 * k;
    body.addRRect(Skia.RRectXY(Skia.XYWHRect(x - w, y, w * 2, 4 * k), 2 * k, 2 * k));
  }
  body.addRect(Skia.XYWHRect(x - 0.8 * k, top - 30 * k, 1.6 * k, 30 * k));
  return { body, shade };
}

function buildIsland(L) {
  const { k, width, horizon, lake, height } = L;
  const hill = Skia.Path.Make();
  hill.moveTo(-10, lake + 10 * k);
  hill.lineTo(-10, horizon - 120 * k);
  hill.quadTo(width * 0.22, horizon - 190 * k, width * 0.42, horizon - 90 * k);
  hill.quadTo(width * 0.56, horizon - 30 * k, width * 0.66, horizon + 4 * k);
  hill.lineTo(width * 0.66, lake + 10 * k);
  hill.close();
  const hillHi = Skia.Path.Make();
  for (let i = 0; i < 40; i += 1) {
    const x = hash(i, 1) * width * 0.6;
    const y = horizon - 100 * k + hash(i, 2) * 200 * k;
    addBlade(hillHi, x, y, x + (hash(i, 3) - 0.5) * 6 * k, y - (6 + hash(i, 4) * 8) * k, 1 * k, 1.2 * k);
  }
  // dev ağaç
  const tx = width * 0.24;
  const tb = horizon - 138 * k;
  const trunk = Skia.Path.Make();
  trunk.moveTo(tx - 12 * k, tb + 8 * k);
  trunk.quadTo(tx - 4 * k, tb - 60 * k, tx - 10 * k, tb - 110 * k);
  trunk.lineTo(tx + 10 * k, tb - 110 * k);
  trunk.quadTo(tx + 4 * k, tb - 60 * k, tx + 14 * k, tb + 8 * k);
  trunk.close();
  [
    [-1, 46, 130],
    [1, 52, 126],
    [-0.4, 30, 160],
  ].forEach(([d, dx, dy]) => {
    trunk.moveTo(tx, tb - 90 * k);
    trunk.lineTo(tx + d * dx * k, tb - dy * k);
    trunk.lineTo(tx + d * dx * k + 5 * k, tb - dy * k + 4 * k);
    trunk.lineTo(tx + 5 * k, tb - 80 * k);
    trunk.close();
  });
  const leaf = Skia.Path.Make();
  const leafHi = Skia.Path.Make();
  for (let i = 0; i < 16; i += 1) {
    const a = (i / 16) * Math.PI * 2;
    const r = (44 + hash(i, 6) * 18) * k;
    const x = tx + Math.cos(a) * r * 1.25;
    const y = tb - 150 * k + Math.sin(a) * r * 0.7;
    leaf.addCircle(x, y, (28 + hash(i, 7) * 12) * k);
    if (Math.sin(a) < 0.2) leafHi.addCircle(x - 6 * k, y - 8 * k, (14 + hash(i, 8) * 8) * k);
  }
  leaf.addCircle(tx, tb - 150 * k, 60 * k);
  // ön kıyı kayası + olta
  const rock = Skia.Path.Make();
  const rockDark = Skia.Path.Make();
  const rx = width * 0.86;
  rock.moveTo(rx - 90 * k, height + 10 * k);
  rock.quadTo(rx - 80 * k, lake - 30 * k, rx - 20 * k, lake - 46 * k);
  rock.quadTo(rx + 50 * k, lake - 56 * k, width + 20 * k, lake - 30 * k);
  rock.lineTo(width + 20 * k, height + 10 * k);
  rock.close();
  rockDark.moveTo(rx - 20 * k, lake - 30 * k);
  rockDark.quadTo(rx + 30 * k, lake - 40 * k, width + 20 * k, lake - 10 * k);
  rockDark.lineTo(width + 20 * k, height + 10 * k);
  rockDark.lineTo(rx - 10 * k, height + 10 * k);
  rockDark.close();
  const rod = Skia.Path.Make();
  const rodBase = [rx - 10 * k, lake - 48 * k];
  const rodTip = [width * 0.6, lake - 210 * k];
  rod.moveTo(rodBase[0] - 2.4 * k, rodBase[1]);
  rod.lineTo(rodTip[0], rodTip[1]);
  rod.lineTo(rodTip[0] + 1.4 * k, rodTip[1] + 1 * k);
  rod.lineTo(rodBase[0] + 2.4 * k, rodBase[1]);
  rod.close();
  rod.addCircle(rodBase[0] - 8 * k, rodBase[1] - 14 * k, 5 * k); // makara
  return { hill, hillHi, trunk, leaf, leafHi, rock, rockDark, rod, rodTip };
}

// ───────────────────────────── canlı parçalar

function Clouds({ clock, L, c }) {
  const { k, width, horizon } = L;
  const set = useMemo(() => {
    const q = Skia.Path.Make();
    const shade = Skia.Path.Make();
    [
      [0.2, 470, 180, 60],
      [0.7, 360, 200, 64],
      [0.95, 560, 140, 44],
      [0.45, 620, 120, 40],
    ].forEach(([fx, dy, w, h], i) => {
      addCloud(q, width * fx, horizon - dy * k, w * k, h * k, i + 3);
      addCloud(shade, width * fx + 6 * k, horizon - dy * k + h * 0.3 * k, w * 0.9 * k, h * 0.5 * k, i + 7);
    });
    return { q, shade };
  }, [width, horizon, k]);
  const drift = useDerivedValue(() => [{ translateX: Math.sin(clock.value * 0.03) * 24 * k }]);
  return (
    <Group transform={drift}>
      <Path path={set.shade} color={c.cloudShade} />
      <Path path={set.q} color={c.cloud} />
    </Group>
  );
}

/** Dev balık (sağa bakar): bıyıklı, geniş kuyruklu. */
function buildFish(k) {
  const u = k * 1.3;
  const body = Skia.Path.Make();
  const hi = Skia.Path.Make();
  body.moveTo(60 * u, 0);
  body.quadTo(54 * u, -24 * u, 10 * u, -26 * u);
  body.quadTo(-30 * u, -24 * u, -54 * u, -6 * u);
  body.lineTo(-80 * u, -26 * u);
  body.quadTo(-72 * u, 0, -80 * u, 24 * u);
  body.lineTo(-54 * u, 6 * u);
  body.quadTo(-30 * u, 22 * u, 10 * u, 22 * u);
  body.quadTo(54 * u, 20 * u, 60 * u, 0);
  body.close();
  // sırt + karın yüzgeci
  body.moveTo(-6 * u, -24 * u);
  body.lineTo(-24 * u, -42 * u);
  body.lineTo(-30 * u, -20 * u);
  body.close();
  hi.moveTo(56 * u, -2 * u);
  hi.quadTo(20 * u, -16 * u, -40 * u, -6 * u);
  hi.quadTo(20 * u, -8 * u, 56 * u, 2 * u);
  hi.close();
  hi.addCircle(44 * u, -8 * u, 3 * u);
  const whisk = Skia.Path.Make();
  whisk.moveTo(58 * u, 4 * u);
  whisk.quadTo(76 * u, 10 * u, 84 * u, 28 * u);
  whisk.moveTo(56 * u, 6 * u);
  whisk.quadTo(70 * u, 18 * u, 70 * u, 36 * u);
  return { body, hi, whisk };
}

function Lake({ p, clock, L, c, island }) {
  const { k, width, lake, height } = L;
  const fish = useMemo(() => buildFish(k), [k]);
  const fx = width * 0.5;
  const leap = useDerivedValue(() => {
    const u = eventU(p, clock.value, 0);
    if (u > 1) return -1;
    return (u - 0.3) / 0.32; // 0–1 sıçrayış
  });
  const floatY = useDerivedValue(() => {
    const e = leap.value;
    const bob = Math.sin(clock.value * 2.2) * 2 * k;
    if (e < -0.25 || e > 1.2) return lake + bob;
    if (e < 0) return lake + bob + sm(-0.25, -0.05, e) * 10 * k; // çekilir
    return lake + 30 * k; // balıkla birlikte
  });
  const linePath = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const [tx, ty] = island.rodTip;
    const fy = floatY.value;
    q.moveTo(tx, ty);
    q.quadTo((tx + fx) / 2, ty + (fy - ty) * 0.9, fx, fy);
    return q;
  });
  const floatPath = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const fy = floatY.value;
    if (fy > lake + 20 * k) return q;
    q.addOval(Skia.XYWHRect(fx - 4 * k, fy - 9 * k, 8 * k, 12 * k));
    return q;
  });
  const fishAt = useDerivedValue(() => {
    const e = leap.value;
    if (e < 0 || e > 1) return [{ translateX: -900 }, { translateY: -900 }];
    const x = fx - 70 * k + e * 160 * k;
    const y = lake + 30 * k - Math.sin(e * Math.PI) * 220 * k;
    const ang = -Math.cos(e * Math.PI) * 0.9;
    return [{ translateX: x }, { translateY: y }, { rotate: ang }];
  });
  const rings = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const e = leap.value;
    const hit = (t0, x) => {
      const f = (e - t0) / 0.5;
      if (f < 0 || f > 1) return;
      for (let i = 0; i < 3; i += 1) {
        const r = (10 + f * 60 + i * 14) * k;
        q.addOval(Skia.XYWHRect(x - r, lake + 4 * k - r * 0.16, r * 2, r * 0.32));
      }
    };
    hit(-0.05, fx - 60 * k);
    hit(0.95, fx + 90 * k);
    // bobber halkası (dinlenme)
    const fr = ((clock.value * 0.5) % 1 + 1) % 1;
    if (e < -0.25 || e > 1.4) {
      const r = (4 + fr * 18) * k;
      q.addOval(Skia.XYWHRect(fx - r, lake + 2 * k - r * 0.18, r * 2, r * 0.36));
    }
    return q;
  });
  const drops = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const e = leap.value;
    const burst = (t0, x) => {
      const f = (e - t0) / 0.25;
      if (f < 0 || f > 1) return;
      for (let i = 0; i < 12; i += 1) {
        const a = -Math.PI * (0.15 + (i / 11) * 0.7);
        const v = (40 + hash(i, 3) * 50) * k;
        const dx = Math.cos(a) * v * f;
        const dy = Math.sin(a) * v * f + f * f * 60 * k;
        q.addCircle(x + dx, lake + dy, (2.6 - f * 1.6) * k);
      }
    };
    burst(0, fx - 60 * k);
    burst(0.97, fx + 90 * k);
    return q;
  });
  return (
    <Group>
      <Rect x={0} y={lake} width={width} height={height - lake + 10}>
        <LinearGradient start={vec(0, lake)} end={vec(0, height)} colors={[c.water, c.sea]} />
      </Rect>
      <Path path={rings} style="stroke" strokeWidth={1.2 * k} color={c.splash} opacity={0.75} />
      <Group transform={fishAt}>
        <Path path={fish.body} color={c.fish} />
        <Path path={fish.hi} color={c.fishHi} />
        <Path path={fish.whisk} style="stroke" strokeWidth={1.4 * k} strokeCap="round" color={c.fish} />
      </Group>
      <Path path={drops} color={c.splash} />
      <Path path={linePath} style="stroke" strokeWidth={0.9 * k} color={c.line} />
      <Path path={floatPath} color={c.float} />
    </Group>
  );
}

function Airship({ p, clock, L, c }) {
  const { k, width, horizon } = L;
  const shape = useMemo(() => {
    const body = Skia.Path.Make();
    const dark = Skia.Path.Make();
    body.addOval(Skia.XYWHRect(-60 * k, -18 * k, 120 * k, 36 * k));
    dark.moveTo(-52 * k, -4 * k);
    dark.lineTo(-74 * k, -22 * k);
    dark.lineTo(-66 * k, -2 * k);
    dark.close();
    dark.moveTo(-52 * k, 4 * k);
    dark.lineTo(-74 * k, 20 * k);
    dark.lineTo(-66 * k, 2 * k);
    dark.close();
    dark.addRRect(Skia.RRectXY(Skia.XYWHRect(-20 * k, 16 * k, 40 * k, 10 * k), 4 * k, 4 * k));
    dark.addRect(Skia.XYWHRect(-60 * k, -1 * k, 120 * k, 2 * k));
    for (let i = 0; i < 5; i += 1) body.addRect(Skia.XYWHRect(-16 * k + i * 7 * k, 19 * k, 4 * k, 3 * k));
    return { body, dark };
  }, [k]);
  const at = useDerivedValue(() => {
    const u = eventU(p, clock.value, 0);
    if (u > 1 || u < 0.04 || u > 0.96) return [{ translateX: -900 }, { translateY: -900 }];
    const e = (u - 0.04) / 0.92;
    return [{ translateX: width + 90 * k - e * (width + 180 * k) }, { translateY: horizon - 420 * k + Math.sin(e * 5) * 6 * k }];
  });
  return (
    <Group transform={at}>
      <Path path={shape.body} color={c.ship} />
      <Path path={shape.dark} color={c.shipDark} />
    </Group>
  );
}

// ───────────────────────────── olay B: aura + yumruk dalgası

const AURA = "#ffd36a";
const PUNCH = 0.5;

function AuraPunch({ p, clock, L, c }) {
  const { k, width, horizon } = L;
  const bx = width * 0.42;
  const by = horizon - 90 * k;
  const s = k * 1.1;
  const vis = useDerivedValue(() => {
    const u = eventU(p, clock.value, 1);
    return u > 1 ? 0 : sm(0.06, 0.14, u) * (1 - sm(0.86, 0.96, u));
  });
  const aura = useDerivedValue(() => {
    const u = eventU(p, clock.value, 1);
    return u > 1 ? 0 : sm(0.14, 0.42, u) * (1 - sm(0.56, 0.8, u));
  });
  const pose = useDerivedValue(() => {
    const u = eventU(p, clock.value, 1);
    return u > 1 ? 0 : sm(PUNCH - 0.04, PUNCH, u) * (1 - sm(0.66, 0.74, u));
  });
  const boy = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const pz = pose.value;
    q.addCircle(bx, by - 31 * s, 4.4 * s);
    for (let i = 0; i < 6; i += 1) {
      const a = -Math.PI * (0.18 + (i / 5) * 0.64);
      q.moveTo(bx + Math.cos(a - 0.35) * 3.6 * s, by - 31 * s + Math.sin(a - 0.35) * 3.6 * s);
      q.lineTo(bx + Math.cos(a) * (11 + (i % 2) * 3) * s, by - 31 * s + Math.sin(a) * (11 + (i % 2) * 3) * s);
      q.lineTo(bx + Math.cos(a + 0.35) * 3.6 * s, by - 31 * s + Math.sin(a + 0.35) * 3.6 * s);
      q.close();
    }
    q.addRRect(Skia.RRectXY(Skia.XYWHRect(bx - 4 * s, by - 26 * s, 8 * s, 13 * s), 2 * s, 2 * s));
    q.moveTo(bx - 3 * s, by - 14 * s);
    q.lineTo(bx - 9 * s, by);
    q.lineTo(bx - 6 * s, by);
    q.lineTo(bx, by - 11 * s);
    q.lineTo(bx + 6 * s, by);
    q.lineTo(bx + 9 * s, by);
    q.lineTo(bx + 3 * s, by - 14 * s);
    q.close();
    const ax = bx + 3 * s + pz * 10 * s;
    q.addRRect(Skia.RRectXY(Skia.XYWHRect(Math.min(bx + 2 * s, ax), by - 24 * s, Math.abs(ax - bx) + 3 * s, 3 * s), 1.4 * s, 1.4 * s));
    q.addCircle(ax + 2 * s, by - 22.5 * s, 2.6 * s);
    return q;
  });
  const flames = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const a = aura.value;
    if (a < 0.02) return q;
    const t = clock.value;
    for (let i = 0; i < 9; i += 1) {
      const x = bx + (i - 4) * 4.4 * s;
      const h = (20 + 22 * Math.abs(Math.sin(t * 6 + i * 1.9))) * s * a;
      const w = 5 * s * a;
      q.moveTo(x - w, by + 2 * s);
      q.quadTo(x - w * 0.6, by - 16 * s * a - h * 0.5, x + Math.sin(t * 4 + i) * 2 * s, by - 18 * s - h);
      q.quadTo(x + w * 0.6, by - 16 * s * a - h * 0.5, x + w, by + 2 * s);
      q.close();
    }
    return q;
  });
  const wave = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const u = eventU(p, clock.value, 1);
    if (u > 1) return q;
    const e = (u - PUNCH) / 0.18;
    if (e <= 0 || e >= 1) return q;
    const x = bx + 20 * s + e * (width * 0.88 - bx);
    const y = by - 22 * s + e * (horizon - by + 4 * k);
    const r = (10 + e * 14) * k;
    q.addOval(Skia.XYWHRect(x - r * 0.4, y - r, r * 0.8, r * 2));
    q.moveTo(x - 30 * k * e, y + r * 0.3);
    q.lineTo(x - 80 * k * e, y + r * 0.6);
    return q;
  });
  const column = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const u = eventU(p, clock.value, 1);
    if (u > 1) return q;
    const e = (u - PUNCH - 0.18) / 0.22;
    if (e <= 0 || e >= 1) return q;
    const x = width * 0.88;
    const h = Math.sin(e * Math.PI) * 120 * k;
    const w = (8 + e * 24) * k;
    q.moveTo(x - w, horizon + 2 * k);
    q.quadTo(x - w * 0.4, horizon - h * 0.6, x, horizon - h);
    q.quadTo(x + w * 0.4, horizon - h * 0.6, x + w, horizon + 2 * k);
    q.close();
    for (let i = 0; i < 10; i += 1) {
      const a = -Math.PI * (0.1 + (i / 9) * 0.8);
      q.addCircle(x + Math.cos(a) * (h * 0.5 + 10 * k), horizon - h * 0.8 + Math.sin(a) * h * 0.3 + e * e * 50 * k, 2.4 * k * (1 - e));
    }
    return q;
  });
  const glowA = useDerivedValue(() => aura.value * 0.8);
  return (
    <Group>
      <Group opacity={glowA}>
        <Glow cx={bx} cy={by - 20 * s} r={70 * k} color={AURA} a={0.5} mid={0.35} />
        <Path path={flames} color={AURA} opacity={0.7} />
      </Group>
      <Group opacity={vis}>
        <Path path={boy} color={c.rockDark} />
      </Group>
      <Path path={wave} style="stroke" strokeWidth={2 * k} strokeCap="round" color={AURA} opacity={0.85} />
      <Path path={column} color={c.splash} opacity={0.9} />
    </Group>
  );
}

export default function HunterScene({ p, clock, width, height, tone, lightSurface }) {
  const L = useMemo(() => hxLayout(width, height), [width, height]);
  const tower = useMemo(() => buildTower(L), [L]);
  const island = useMemo(() => buildIsland(L), [L]);
  const c = useMemo(() => toneMap(HX_TONE, tone.colors), [tone]);
  const { k, horizon, lake } = L;
  const sway = useDerivedValue(() => [{ translateX: Math.sin(clock.value * 0.6) * 1.4 * k }]);
  return (
    <Group opacity={tone.alpha}>
      <Rect x={0} y={horizon - 300 * k} width={width} height={300 * k}>
        <LinearGradient start={vec(0, horizon - 300 * k)} end={vec(0, horizon)} colors={[rgba(c.haze, 0), c.haze]} />
      </Rect>
      <Path path={tower.body} color={c.tower} />
      <Path path={tower.shade} color={c.towerShade} />
      <Clouds clock={clock} L={L} c={c} />
      <Airship p={p} clock={clock} L={L} c={c} />
      {/* deniz ufku */}
      <Rect x={0} y={horizon} width={width} height={lake - horizon + 2 * k}>
        <LinearGradient start={vec(0, horizon)} end={vec(0, lake)} colors={[c.seaHi, c.sea]} />
      </Rect>
      {/* ada + ağaç */}
      <Path path={island.hill} color={c.hill} />
      <Path path={island.hillHi} color={c.hillHi} />
      <Path path={island.trunk} color={c.trunk} />
      <Group transform={sway}>
        <Path path={island.leaf} color={c.leaf} />
        <Path path={island.leafHi} color={c.leafHi} />
      </Group>
      <AuraPunch p={p} clock={clock} L={L} c={c} />
      <Lake p={p} clock={clock} L={L} c={c} island={island} />
      <Path path={island.rock} color={c.rock} />
      <Path path={island.rockDark} color={c.rockDark} opacity={0.6} />
      <Path path={island.rod} color={c.rod} />
    </Group>
  );
}
