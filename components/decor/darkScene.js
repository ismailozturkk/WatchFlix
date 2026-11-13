// components/decor/darkScene.js
//
// Dark (Netflix) evren sahnesi (OVERLAY.dkVec = 67) — tamamı VEKTÖR:
//   • Kapalı, yağmurlu Winden göğü; katman katman sık çam ormanı.
//   • Solda nükleer santral: iki soğutma kulesi, tepelerinden ağır ağır kabaran buhar; kırmızı ikaz ışıkları.
//   • Ortada kayalık yamaçta mağara ağzı ve demir kapı; önünde sarı yağmurluklu siluet, fenerinin ışığı
//     mağaraya uzanır.
//   • Olay (74 sn'de bir ~29 sn): mağarada karanlık küre belirir (çevresinde bükülen halkalar), göğün
//     üstünde üç halkalı sembol parlar; siluet mağaraya yürür ve kaybolur, sonra her şey söner.
//   • Olay B (dönüşümlü): bir kuş sürüsü ormanın üstünden geçer; mağaradan soluk bir zaman dalgası
//     yayılır, santralin ikaz ışıkları söner — kuşlar kanatları kapanmış hâlde dönerek ormana düşer.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[67] (DK_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Group, LinearGradient, Path, Rect, Skia, vec } from "@shopify/react-native-skia";
import { eventU } from "../../utils/weatherParticles";
import { Glow, addPine, groundLayout, hash, rgba, sm, toneMap } from "./seasonKit";

export const DK_TONE = [
  "cloud",
  "pineFar",
  "pine",
  "pineNear",
  "tower",
  "towerShade",
  "steam",
  "warn",
  "rock",
  "rockDark",
  "cave",
  "door",
  "coat",
  "beam",
  "orb",
  "ring",
  "sym",
  "ground",
];

export function dkLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  return { ...L, base: ground - 8 * k, cave: [width * 0.6, ground - 30 * k] };
}

// ───────────────────────────── durağan yollar

function buildClouds(L) {
  const { k, width, base } = L;
  const q = Skia.Path.Make();
  for (let i = 0; i < 18; i += 1) {
    const x = (i / 17) * width;
    q.addCircle(x, base - 640 * k + hash(i, 1) * 30 * k, (50 + hash(i, 2) * 40) * k);
  }
  q.addRect(Skia.XYWHRect(-10, base - 900 * k, width + 20, 260 * k));
  return q;
}

function buildPlant(L) {
  const { k, width, base } = L;
  const tower = Skia.Path.Make();
  const shade = Skia.Path.Make();
  const tops = [];
  [
    [width * 0.12, 120, 270],
    [width * 0.33, 104, 236],
  ].forEach(([x, w, h]) => {
    const W = w * k;
    const H = h * k;
    tower.moveTo(x - W / 2, base);
    tower.quadTo(x - W * 0.08, base - H * 0.62, x - W * 0.3, base - H);
    tower.lineTo(x + W * 0.3, base - H);
    tower.quadTo(x + W * 0.08, base - H * 0.62, x + W / 2, base);
    tower.close();
    shade.moveTo(x + W * 0.05, base);
    shade.quadTo(x + W * 0.02, base - H * 0.62, x + W * 0.08, base - H);
    shade.lineTo(x + W * 0.3, base - H);
    shade.quadTo(x + W * 0.08, base - H * 0.62, x + W / 2, base);
    shade.close();
    shade.addRect(Skia.XYWHRect(x - W * 0.3, base - H, W * 0.6, 3 * k));
    tops.push([x, base - H, W * 0.3]);
  });
  // reaktör binası + baca
  tower.addRect(Skia.XYWHRect(width * 0.18, base - 70 * k, 70 * k, 70 * k));
  tower.addCircle(width * 0.18 + 35 * k, base - 70 * k, 30 * k);
  tower.addRect(Skia.XYWHRect(width * 0.42, base - 180 * k, 8 * k, 180 * k));
  return { tower, shade, tops, warn: [[width * 0.42 + 4 * k, base - 182 * k], [tops[0][0], tops[0][1] - 2 * k]] };
}

function buildForest(L) {
  const { k, width, base, height } = L;
  const far = Skia.Path.Make();
  const mid = Skia.Path.Make();
  const near = Skia.Path.Make();
  for (let i = 0; i < 26; i += 1) addPine(far, (i / 25) * width + hash(i, 1) * 10 * k, base - 30 * k, (60 + hash(i, 2) * 50) * k, (30 + hash(i, 3) * 10) * k, 5);
  for (let i = 0; i < 14; i += 1) {
    const x = (i / 13) * width + hash(i, 4) * 14 * k;
    if (x > width * 0.46 && x < width * 0.76) continue; // mağara açıklığı
    addPine(mid, x, base, (150 + hash(i, 5) * 90) * k, (46 + hash(i, 6) * 16) * k, 6);
  }
  [-0.02, 0.14, 0.9, 1.02].forEach((f, i) => addPine(near, width * f, height + 10 * k, (300 + i * 20) * k, 110 * k, 7));
  const ground = Skia.Path.Make();
  ground.addRect(Skia.XYWHRect(-10, base - 2 * k, width + 20, height - base + 12));
  return { far, mid, near, ground };
}

function buildCave(L) {
  const { k, cave } = L;
  const [cx, cy] = cave;
  const rock = Skia.Path.Make();
  const dark = Skia.Path.Make();
  const mouth = Skia.Path.Make();
  const door = Skia.Path.Make();
  rock.moveTo(cx - 140 * k, cy + 30 * k);
  rock.quadTo(cx - 110 * k, cy - 80 * k, cx - 30 * k, cy - 110 * k);
  rock.quadTo(cx + 40 * k, cy - 128 * k, cx + 90 * k, cy - 80 * k);
  rock.quadTo(cx + 130 * k, cy - 30 * k, cx + 150 * k, cy + 30 * k);
  rock.close();
  for (let i = 0; i < 9; i += 1) {
    const x = cx - 100 * k + hash(i, 3) * 200 * k;
    const y = cy - 90 * k + hash(i, 4) * 90 * k;
    dark.moveTo(x, y);
    dark.lineTo(x + (10 + hash(i, 5) * 20) * k, y + (4 + hash(i, 6) * 8) * k);
    dark.lineTo(x + 4 * k, y + 6 * k);
    dark.close();
  }
  mouth.moveTo(cx - 34 * k, cy + 6 * k);
  mouth.quadTo(cx - 36 * k, cy - 66 * k, cx, cy - 70 * k);
  mouth.quadTo(cx + 36 * k, cy - 66 * k, cx + 34 * k, cy + 6 * k);
  mouth.close();
  // içerideki demir kapı: parmaklıklar
  for (let i = 0; i < 6; i += 1) door.addRect(Skia.XYWHRect(cx - 18 * k + i * 7 * k, cy - 46 * k, 2 * k, 50 * k));
  door.addRect(Skia.XYWHRect(cx - 20 * k, cy - 46 * k, 40 * k, 2.4 * k));
  door.addRect(Skia.XYWHRect(cx - 20 * k, cy - 20 * k, 40 * k, 2 * k));
  return { rock, dark, mouth, door };
}

// ───────────────────────────── canlı parçalar

function Steam({ clock, L, c, tops }) {
  const { k } = L;
  const q = useDerivedValue(() => {
    const path = Skia.Path.Make();
    tops.forEach(([x, y, w], j) => {
      for (let i = 0; i < 12; i += 1) {
        const f = (((clock.value * 0.05 + i / 12 + j * 0.37) % 1) + 1) % 1;
        const r = w * (0.55 + f * 0.9);
        path.addCircle(x + f * 70 * k + Math.sin(f * 5 + i) * 8 * k, y - 6 * k - f * 190 * k, r);
      }
    });
    return path;
  });
  return (
    <Group opacity={0.4}>
      <Path path={q} color={c.steam} />
    </Group>
  );
}

/** Üç halkalı sembol: üç yapraklı gül eğrisi + çevre halkası. */
function buildSymbol(R) {
  const q = Skia.Path.Make();
  const n = 120;
  for (let i = 0; i <= n; i += 1) {
    const t = (i / n) * Math.PI;
    const r = R * Math.sin(3 * t);
    const x = r * Math.cos(t - Math.PI / 2);
    const y = r * Math.sin(t - Math.PI / 2);
    if (i === 0) q.moveTo(x, y);
    else q.lineTo(x, y);
  }
  q.close();
  q.addCircle(0, 0, R * 0.58);
  return q;
}

function Wanderer({ p, clock, L, c, night }) {
  const { k, cave } = L;
  const [cx, cy] = cave;
  const fig = useMemo(() => {
    const q = Skia.Path.Make();
    // kapüşonlu sarı yağmurluk, arkası dönük
    q.moveTo(-8 * k, 0);
    q.lineTo(-6 * k, -24 * k);
    q.quadTo(-7 * k, -34 * k, 0, -36 * k);
    q.quadTo(7 * k, -34 * k, 6 * k, -24 * k);
    q.lineTo(8 * k, 0);
    q.close();
    return q;
  }, [k]);
  const legs = useMemo(() => {
    const q = Skia.Path.Make();
    q.addRect(Skia.XYWHRect(-4.5 * k, 0, 3 * k, 9 * k));
    q.addRect(Skia.XYWHRect(1.5 * k, 0, 3 * k, 9 * k));
    return q;
  }, [k]);
  const state = useDerivedValue(() => {
    const u = eventU(p, clock.value, 0);
    const walk = u > 1 ? 0 : sm(0.45, 0.75, u);
    const back = u > 1 ? 0 : sm(0.9, 1, u);
    return { walk, a: u > 1 ? 1 : Math.max(back, 1 - sm(0.7, 0.78, u)) };
  });
  const at = useDerivedValue(() => {
    const s = state.value;
    const sx = cx - 70 * k;
    const sy = cy + 56 * k;
    const x = sx + (cx - sx) * s.walk * (1 - sm(0.9, 1, s.a));
    const y = sy + (cy + 4 * k - sy) * s.walk;
    const sc = 1.45 - s.walk * 0.55;
    return [{ translateX: x }, { translateY: y }, { scale: sc }];
  });
  const alpha = useDerivedValue(() => state.value.a);
  const beam = useMemo(() => {
    const q = Skia.Path.Make();
    q.moveTo(4 * k, -20 * k);
    q.lineTo(70 * k, -90 * k);
    q.lineTo(90 * k, -60 * k);
    q.close();
    return q;
  }, [k]);
  const beamA = useDerivedValue(() => (night ? 0.4 : 0.22) * (0.85 + 0.15 * Math.sin(clock.value * 9)));
  return (
    <Group transform={at} opacity={alpha}>
      <Group opacity={beamA}>
        <Path path={beam}>
          <LinearGradient start={vec(4 * k, -20 * k)} end={vec(80 * k, -75 * k)} colors={[c.beam, rgba(c.beam, 0)]} />
        </Path>
      </Group>
      <Path path={legs} color={c.rockDark} />
      <Path path={fig} color={c.coat} />
    </Group>
  );
}

// ───────────────────────────── olay B: zaman dalgası + düşen kuşlar

const BIRDS = 16;
const SHOCK = 0.44;

function FallingBirds({ p, clock, L, c }) {
  const { k, width, base } = L;
  const [cx, cy] = L.cave;
  const birds = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const u = eventU(p, clock.value, 1);
    if (u > 1) return q;
    for (let i = 0; i < BIRDS; i += 1) {
      const e = (u - 0.02 - hash(i, 91) * 0.06) / 0.9;
      if (e <= 0) continue;
      const s = (1.3 + hash(i, 92) * 0.6) * k;
      const row = (i % 4) * 14 + Math.floor(i / 4) * 6;
      let x = width * 1.08 - e * width * 1.1 + (i % 4) * 22 * k + hash(i, 93) * 20 * k;
      let y = base - (380 + row + hash(i, 94) * 40) * k + Math.sin(clock.value * 1.4 + i) * 4 * k;
      const tf = SHOCK + 0.01 + hash(i, 95) * 0.06;
      if (u > tf) {
        const d = Math.min(1, (u - tf) / 0.3);
        x = width * 1.08 - ((tf - 0.02 - hash(i, 91) * 0.06) / 0.9) * width * 1.1 + (i % 4) * 22 * k + hash(i, 93) * 20 * k - d * 40 * k;
        y += d * d * 420 * k;
        const r = d * 9 + i;
        const ca = Math.cos(r) * 5 * s;
        const sa = Math.sin(r) * 5 * s;
        q.moveTo(x + ca, y + sa);
        q.lineTo(x - sa * 0.4, y + ca * 0.4);
        q.lineTo(x - ca, y - sa);
        q.lineTo(x + sa * 0.4, y - ca * 0.4);
        q.close();
        continue;
      }
      const f = Math.sin(clock.value * 9 + i * 1.3);
      q.moveTo(x - 9 * s, y - f * 5 * s);
      q.quadTo(x - 4 * s, y - 2 * s, x, y);
      q.quadTo(x + 4 * s, y - 2 * s, x + 9 * s, y - f * 5 * s);
      q.quadTo(x + 4 * s, y + 1 * s, x, y + 1.6 * s);
      q.quadTo(x - 4 * s, y + 1 * s, x - 9 * s, y - f * 5 * s);
      q.close();
    }
    return q;
  });
  const wave = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const u = eventU(p, clock.value, 1);
    if (u > 1) return q;
    const e = (u - SHOCK) / 0.18;
    if (e <= 0 || e >= 1) return q;
    for (let i = 0; i < 2; i += 1) {
      const r = Math.max(1, (e - i * 0.15) * 520 * k);
      q.addOval(Skia.XYWHRect(cx - r, cy - 30 * k - r * 0.7, r * 2, r * 1.4));
    }
    return q;
  });
  const waveO = useDerivedValue(() => {
    const u = eventU(p, clock.value, 1);
    const e = (u - SHOCK) / 0.18;
    return u > 1 || e <= 0 || e >= 1 ? 0 : 0.6 * (1 - e);
  });
  return (
    <Group>
      <Path path={wave} style="stroke" strokeWidth={2.2 * k} color={c.ring} opacity={waveO} />
      <Path path={birds} color={c.steam} opacity={0.85} />
    </Group>
  );
}

export default function DarkScene({ p, clock, width, height, tone, lightSurface }) {
  const L = useMemo(() => dkLayout(width, height), [width, height]);
  const clouds = useMemo(() => buildClouds(L), [L]);
  const plant = useMemo(() => buildPlant(L), [L]);
  const forest = useMemo(() => buildForest(L), [L]);
  const cave = useMemo(() => buildCave(L), [L]);
  const c = useMemo(() => toneMap(DK_TONE, tone.colors), [tone]);
  const { k, base } = L;
  const [cx, cy] = L.cave;
  const night = !lightSurface;
  const symbol = useMemo(() => buildSymbol(70 * k), [k]);
  const ev = useDerivedValue(() => {
    const u = eventU(p, clock.value, 0);
    return u > 1 ? 0 : sm(0.12, 0.32, u) * (1 - sm(0.82, 0.97, u));
  });
  const symA = useDerivedValue(() => ev.value * (0.7 + 0.3 * Math.sin(clock.value * 3)));
  const symAt = useDerivedValue(() => [
    { translateX: width * 0.6 },
    { translateY: base - 470 * k },
    { rotate: clock.value * 0.05 },
  ]);
  const orbAt = useDerivedValue(() => [{ translateX: cx }, { translateY: cy - 30 * k }, { scale: 0.2 + ev.value * 0.8 }]);
  const rings = useDerivedValue(() => {
    const q = Skia.Path.Make();
    for (let i = 0; i < 3; i += 1) {
      const f = (((clock.value * 0.4 + i / 3) % 1) + 1) % 1;
      const r = (20 + f * 40) * k;
      q.addOval(Skia.XYWHRect(-r, -r * 0.8, r * 2, r * 1.6));
    }
    return q;
  });
  const warnA = useDerivedValue(() => {
    const u = eventU(p, clock.value, 1);
    const off = u > 1 ? 0 : sm(0.44, 0.47, u) * (1 - sm(0.8, 0.9, u));
    const on = Math.sin(clock.value * 3) > 0.3 ? 1 : 0.2;
    return on * (1 - off) + off * (Math.sin(clock.value * 41) > 0.85 ? 0.5 : 0);
  });
  return (
    <Group opacity={tone.alpha}>
      {/* kapalı gök */}
      <Path path={clouds} color={c.cloud} />
      <Group opacity={symA} transform={symAt}>
        <Glow r={130 * k} color={c.sym} a={0.35} mid={0.3} />
        <Path path={symbol} style="stroke" strokeWidth={3 * k} strokeJoin="round" color={c.sym} />
      </Group>
      {/* santral + buhar */}
      <Steam clock={clock} L={L} c={c} tops={plant.tops} />
      <Path path={plant.tower} color={c.tower} />
      <Path path={plant.shade} color={c.towerShade} />
      <Group opacity={warnA}>
        {plant.warn.map(([x, y], i) => (
          <Group key={i} transform={[{ translateX: x }, { translateY: y }]}>
            <Glow r={9 * k} color={c.warn} a={1} mid={0.5} />
          </Group>
        ))}
      </Group>
      <Path path={forest.far} color={c.pineFar} />
      {/* mağara */}
      <Path path={cave.rock} color={c.rock} />
      <Path path={cave.dark} color={c.rockDark} />
      <Path path={cave.mouth} color={c.cave} />
      <Path path={cave.door} color={c.door} />
      <Group opacity={ev} transform={orbAt}>
        <Glow r={70 * k} color={c.ring} a={0.45} mid={0.4} />
        <Glow r={34 * k} color={c.orb} a={1} mid={0.95} />
        <Path path={rings} style="stroke" strokeWidth={1.4 * k} color={c.ring} />
      </Group>
      <FallingBirds p={p} clock={clock} L={L} c={c} />
      <Path path={forest.mid} color={c.pine} />
      <Path path={forest.ground} color={c.ground} />
      <Wanderer p={p} clock={clock} L={L} c={c} night={night} />
      <Path path={forest.near} color={c.pineNear} />
    </Group>
  );
}
