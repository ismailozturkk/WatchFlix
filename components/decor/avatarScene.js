// components/decor/avatarScene.js
//
// Avatar evren sahnesi (OVERLAY.avVec = 62) — tamamı VEKTÖR:
//   • Gökte dev gaz devi (bantlı) + küçük ay; pus.
//   • Yüzen dağlar: tepesi yeşil örtülü, altı sivrilen kaya kütleleri; sarkan sarmaşıklar, kenarlarından
//     dökülen ince şelaleler; her biri kendi hızında hafifçe yükselip alçalır.
//   • Ortada Ruhlar Ağacı: kubbe gibi sarkan, nefes alır gibi parlayan ışık telleri; dibinde ışıltı.
//   • Önde biyolüminesan bitkiler (kıvrık eğrelti başları, mantarlar, ışık noktaları) — dalga dalga yanar.
//   • Olay (64 sn'de bir ~27 sn): ikran soldan dalış yapıp kanat çırparak sağa süzülür; o sırada ağacın
//     telleri ve bitkiler daha parlak yanar.
//   • Olay B (dönüşümlü): Ruhlar Ağacı'ndan denizanası gibi atımlı, ışıl ışıl tohumlar kopar; salınarak
//     süzülür, yere yaklaştıkça söner — ağaç ve bitkiler yine daha parlak yanar.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[62] (AV_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Group, LinearGradient, Path, Rect, Skia, vec } from "@shopify/react-native-skia";
import { eventU, restU } from "../../utils/weatherParticles";
import { Glow, groundLayout, hash, rgba, ridgePath, sm, toneMap } from "./seasonKit";
import { addBlade } from "./universeKit";

export const AV_TONE = [
  "haze",
  "planet",
  "band",
  "moon",
  "rock",
  "rockDark",
  "cap",
  "vine",
  "fall",
  "hillFar",
  "tree",
  "strand",
  "glow",
  "glow2",
  "plant",
  "plantDark",
  "ground",
  "ikran",
  "stripe",
];

export function avLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  return { ...L, base: ground - 6 * k };
}

// ───────────────────────────── durağan yollar

function buildPlanet(L) {
  const { k, width, base } = L;
  const cx = width * 0.82;
  const cy = base - 640 * k;
  const r = 130 * k;
  const disk = Skia.Path.Make();
  disk.addCircle(cx, cy, r);
  const bands = Skia.Path.Make();
  for (let i = 0; i < 6; i += 1) {
    const y = cy - r + (i + 0.6) * ((2 * r) / 6.2);
    const half = Math.sqrt(Math.max(0, r * r - (y - cy) * (y - cy)));
    const h = (5 + hash(i, 3) * 8) * k;
    bands.moveTo(cx - half, y);
    bands.quadTo(cx, y - h * 0.8, cx + half, y);
    bands.lineTo(cx + half * 0.98, y + h);
    bands.quadTo(cx, y + h * 0.2, cx - half * 0.98, y + h);
    bands.close();
  }
  const moon = Skia.Path.Make();
  moon.addCircle(width * 0.22, base - 600 * k, 18 * k);
  return { disk, bands, moon, cx, cy, r };
}

/** Yüzen kaya: dişli yeşil üst, sivrilen alt; yerel koordinat (tepe ortası 0,0). */
function buildRock(w, h, seed, k) {
  const rock = Skia.Path.Make();
  const dark = Skia.Path.Make();
  const cap = Skia.Path.Make();
  const vine = Skia.Path.Make();
  const n = 8;
  rock.moveTo(-w / 2, 0);
  for (let i = 1; i <= n; i += 1) {
    const x = -w / 2 + (w * i) / n;
    rock.lineTo(x, (hash(seed, i) - 0.5) * 10 * k);
  }
  rock.cubicTo(w * 0.5, h * 0.35, w * 0.22, h * 0.7, w * 0.04, h);
  rock.cubicTo(-w * 0.12, h * 0.72, -w * 0.52, h * 0.4, -w / 2, 0);
  rock.close();
  // gölgeli sağ yan
  dark.moveTo(w * 0.1, 4 * k);
  dark.lineTo(w / 2, 0);
  dark.cubicTo(w * 0.5, h * 0.35, w * 0.22, h * 0.7, w * 0.04, h);
  dark.cubicTo(w * 0.14, h * 0.6, w * 0.12, h * 0.3, w * 0.1, 4 * k);
  dark.close();
  // katman çizgileri
  for (let j = 1; j < 5; j += 1) {
    const y = (h * j) / 6;
    const half = (w / 2) * (1 - (y / h) * 0.9);
    dark.addRect(Skia.XYWHRect(-half * 0.9, y, half * 1.6, 1.6 * k));
  }
  // yeşil örtü: tepede yuvarlak öbekler, kenardan sarkar
  for (let i = 0; i < 11; i += 1) {
    const x = -w / 2 + (w * i) / 10;
    cap.addCircle(x, -4 * k + hash(seed + 2, i) * 6 * k, (7 + hash(seed + 3, i) * 9) * k);
  }
  cap.addRect(Skia.XYWHRect(-w / 2, -4 * k, w, 12 * k));
  // sarmaşıklar
  for (let i = 0; i < 9; i += 1) {
    const x = -w * 0.46 + w * 0.92 * hash(seed + 5, i);
    const y0 = 6 * k;
    const len = (30 + hash(seed + 6, i) * (h * 0.55)) * 1;
    vine.moveTo(x, y0);
    vine.cubicTo(x + 4 * k, y0 + len * 0.4, x - 4 * k, y0 + len * 0.7, x + 1 * k, y0 + len);
  }
  return { rock, dark, cap, vine };
}

function buildForest(L) {
  const { k, width, base, height } = L;
  const hill = ridgePath(width, base - 50 * k, 50 * k, 4, 3, base + 10 * k, 4 * k).path;
  const ground = Skia.Path.Make();
  ground.moveTo(-10, base);
  ground.quadTo(width * 0.5, base - 18 * k, width + 10, base);
  ground.lineTo(width + 10, height + 10);
  ground.lineTo(-10, height + 10);
  ground.close();
  // Ruhlar Ağacı: kalın kıvrık gövde + kökler
  const cx = width * 0.5;
  const tree = Skia.Path.Make();
  tree.moveTo(cx - 22 * k, base);
  tree.quadTo(cx - 6 * k, base - 80 * k, cx - 10 * k, base - 160 * k);
  tree.lineTo(cx + 10 * k, base - 160 * k);
  tree.quadTo(cx + 6 * k, base - 80 * k, cx + 24 * k, base);
  tree.close();
  // kavisli, sarkık dallar (kalın çizgi)
  const limbs = Skia.Path.Make();
  [
    [-0.95, 196, 230],
    [-0.55, 214, 236],
    [-0.2, 218, 226],
    [0.25, 220, 228],
    [0.6, 212, 238],
    [0.98, 194, 228],
  ].forEach(([f, y1, ym]) => {
    limbs.moveTo(cx + f * 8 * k, base - 150 * k);
    limbs.quadTo(cx + f * 60 * k, base - ym * k, cx + f * 150 * k, base - y1 * k);
  });
  [-1, 1].forEach((s) => {
    tree.moveTo(cx + s * 10 * k, base - 20 * k);
    tree.quadTo(cx + s * 40 * k, base - 6 * k, cx + s * 64 * k, base + 2 * k);
    tree.lineTo(cx + s * 30 * k, base + 2 * k);
    tree.close();
  });
  // ışık telleri: geniş kubbeden yere sarkan
  const strands = Skia.Path.Make();
  const R = 150 * k;
  const top = base - 214 * k;
  for (let i = 0; i < 42; i += 1) {
    const f = i / 41;
    const x = cx - R + 2 * R * f;
    const y0 = top + Math.pow(Math.abs(f - 0.5) * 2, 2) * 70 * k;
    const y1 = base - (6 + hash(i, 4) * 26) * k;
    strands.moveTo(x, y0);
    strands.quadTo(x + (hash(i, 5) - 0.5) * 12 * k, (y0 + y1) / 2, x + (f - 0.5) * 30 * k, y1);
  }
  // ön plan bitkileri
  const plant = Skia.Path.Make();
  const plantDark = Skia.Path.Make();
  const glowDots = Skia.Path.Make();
  const glowDots2 = Skia.Path.Make();
  const bottom = height + 4 * k;
  // kıvrık eğrelti başları (sarmal)
  [0.08, 0.3, 0.74, 0.93].forEach((f, i) => {
    const x = width * f;
    const h = (90 + hash(i, 7) * 70) * k;
    plantDark.addRect(Skia.XYWHRect(x - 2 * k, bottom - h, 4 * k, h));
    let px = x;
    let py = bottom - h;
    for (let j = 0; j < 22; j += 1) {
      const a = j * 0.45;
      const r = (14 - j * 0.55) * k;
      const nx = x + Math.cos(a) * r - 14 * k + 14 * k;
      const ny = bottom - h - 12 * k + Math.sin(a) * r;
      if (j === 0) {
        px = nx;
        py = ny;
      }
      glowDots.addCircle(nx, ny, (2.2 - j * 0.06) * k);
      px = nx;
      py = ny;
    }
    glowDots.addCircle(px, py, 1 * k);
    for (let j = 0; j < 7; j += 1) {
      const a = -Math.PI * (0.15 + (j / 6) * 0.7);
      const len = (40 + hash(i, j) * 30) * k;
      addBlade(plant, x, bottom, x + Math.cos(a) * len, bottom + Math.sin(a) * len, (j < 3 ? 8 : -8) * k, 5 * k);
    }
  });
  // mantarlar
  [0.18, 0.4, 0.62, 0.84].forEach((f, i) => {
    const x = width * f;
    const h = (20 + hash(i, 9) * 26) * k;
    const w = (18 + hash(i, 10) * 14) * k;
    plantDark.addRect(Skia.XYWHRect(x - 2.4 * k, bottom - h, 4.8 * k, h));
    plant.moveTo(x - w, bottom - h);
    plant.quadTo(x, bottom - h - w * 1.1, x + w, bottom - h);
    plant.close();
    for (let j = 0; j < 4; j += 1) glowDots2.addCircle(x - w * 0.6 + (j * w * 1.2) / 3, bottom - h - w * 0.28 - (j % 2) * 3 * k, 1.8 * k);
  });
  // yerdeki ışık noktaları
  for (let i = 0; i < 70; i += 1) {
    const x = hash(i, 11) * width;
    const y = base + 6 * k + hash(i, 12) * (bottom - base - 10 * k);
    (i % 3 ? glowDots : glowDots2).addCircle(x, y, (0.8 + hash(i, 13) * 1.4) * k);
  }
  return { hill, ground, tree, limbs, strands, plant, plantDark, glowDots, glowDots2, cx };
}

// ───────────────────────────── yüzen dağ

function FloatRock({ clock, x, y, s, seed, rock, c, k, h, night }) {
  const at = useDerivedValue(() => [
    { translateX: x },
    { translateY: y + Math.sin(clock.value * (0.22 + seed * 0.03) + seed) * 6 * k },
    { scale: s },
  ]);
  const fallA = useDerivedValue(() => 0.45 + 0.15 * Math.sin(clock.value * 2.3 + seed));
  return (
    <Group transform={at}>
      <Group opacity={fallA}>
        <Rect x={-rock.w * 0.42} y={0} width={4 * k} height={h * 1.6}>
          <LinearGradient start={vec(0, 0)} end={vec(0, h * 1.6)} colors={[c.fall, rgba(c.fall, 0)]} />
        </Rect>
        <Rect x={rock.w * 0.4} y={-2 * k} width={3 * k} height={h * 1.3}>
          <LinearGradient start={vec(0, 0)} end={vec(0, h * 1.3)} colors={[c.fall, rgba(c.fall, 0)]} />
        </Rect>
      </Group>
      <Path path={rock.rock} color={c.rock} />
      <Path path={rock.dark} color={c.rockDark} />
      <Path path={rock.vine} style="stroke" strokeWidth={1.2 * k} color={c.vine} />
      <Path path={rock.cap} color={c.cap} />
      {night ? <Path path={rock.cap} color={c.glow} opacity={0.06} /> : null}
    </Group>
  );
}

// ───────────────────────────── ikran

/** Yandan ikran (sağa bakar); flap −1…1 kanat açısı. */
function ikranPaths(flap, k) {
  "worklet";
  const u = k * 1.55;
  const body = Skia.Path.Make();
  const stripe = Skia.Path.Make();
  // gövde + baş + kuyruk
  body.moveTo(-60 * u, 2 * u);
  body.quadTo(-30 * u, -6 * u, 0, -6 * u);
  body.quadTo(22 * u, -8 * u, 34 * u, -12 * u);
  body.lineTo(50 * u, -10 * u);
  body.lineTo(62 * u, -4 * u);
  body.lineTo(48 * u, -2 * u);
  body.lineTo(56 * u, 2 * u);
  body.lineTo(36 * u, 0);
  body.quadTo(18 * u, 6 * u, 0, 6 * u);
  body.quadTo(-30 * u, 6 * u, -60 * u, 2 * u);
  body.close();
  // baş ibiği
  body.moveTo(36 * u, -12 * u);
  body.lineTo(30 * u, -24 * u);
  body.lineTo(44 * u, -11 * u);
  body.close();
  // kuyruk yüzgeci
  body.moveTo(-58 * u, 2 * u);
  body.lineTo(-74 * u, -8 * u);
  body.lineTo(-70 * u, 4 * u);
  body.lineTo(-76 * u, 12 * u);
  body.close();
  // kanatlar (uzak + yakın), dört parmaklı zar
  const wing = (dir, amp) => {
    const tipY = -flap * 60 * u * amp;
    const tipX = 10 * u;
    body.moveTo(-6 * u, -2 * u);
    body.quadTo(-4 * u, tipY * 0.5 - 6 * u, tipX, tipY - 4 * u * dir);
    body.lineTo(tipX - 14 * u, tipY * 0.8 + 6 * u);
    body.lineTo(-14 * u, tipY * 0.55 + 10 * u);
    body.lineTo(-30 * u, tipY * 0.3 + 12 * u);
    body.lineTo(-40 * u, 4 * u);
    body.close();
    stripe.moveTo(-4 * u, -2 * u);
    stripe.lineTo(tipX - 2 * u, tipY - 2 * u);
    stripe.lineTo(tipX - 4 * u, tipY);
    stripe.lineTo(-8 * u, 0);
    stripe.close();
  };
  wing(1, 1);
  wing(-1, -0.55);
  for (let i = 0; i < 5; i += 1) stripe.addRect(Skia.XYWHRect((-44 + i * 16) * u, -3 * u, 6 * u, 2.4 * u));
  return { body, stripe };
}

function Ikran({ p, clock, L, c }) {
  const { k, width, base } = L;
  const d = useDerivedValue(() => {
    const u = eventU(p, clock.value, 0);
    const glide = u > 0.45 && u < 0.62;
    const flap = glide ? 0.25 : Math.sin(clock.value * 5.2);
    return ikranPaths(flap, k);
  });
  const body = useDerivedValue(() => d.value.body);
  const stripe = useDerivedValue(() => d.value.stripe);
  const at = useDerivedValue(() => {
    const u = eventU(p, clock.value, 0);
    if (u > 1 || u < 0.06 || u > 0.94) return [{ translateX: -900 }, { translateY: -900 }];
    const e = (u - 0.06) / 0.88;
    const x = -100 * k + (width + 200 * k) * e;
    // dalış: yukarıdan aşağı iner, ağacın üstünde alçalır, sonra yükselir
    const y = base - 520 * k + Math.sin(e * Math.PI) * 280 * k - sm(0.7, 1, e) * 120 * k;
    const tilt = Math.cos(e * Math.PI) * 0.35 - sm(0.7, 1, e) * 0.2;
    return [{ translateX: x }, { translateY: y }, { rotate: tilt }];
  });
  return (
    <Group transform={at}>
      <Path path={body} color={c.ikran} />
      <Path path={stripe} color={c.stripe} />
    </Group>
  );
}

// ───────────────────────────── olay B: Ruhlar Ağacı'nın süzülen tohumları

const SEEDS = 20;

function SpiritSeeds({ p, clock, L, c, cx }) {
  const { k, base } = L;
  const d = useDerivedValue(() => {
    const core = Skia.Path.Make();
    const halo = Skia.Path.Make();
    const legs = Skia.Path.Make();
    const u = eventU(p, clock.value, 1);
    if (u > 1) return { core, halo, legs };
    const t = clock.value;
    for (let i = 0; i < SEEDS; i += 1) {
      const start = 0.04 + hash(i, 61) * 0.45;
      const e = (u - start) / 0.5;
      if (e <= 0 || e >= 1) continue;
      const fade = sm(0, 0.12, e) * (1 - sm(0.75, 1, e));
      const x0 = cx + (hash(i, 62) - 0.5) * 160 * k;
      const x = x0 + (hash(i, 63) - 0.5) * 220 * k * e + Math.sin(t * 0.9 + i * 1.7) * 14 * k;
      const y = base - 230 * k - hash(i, 64) * 60 * k + e * 200 * k + Math.sin(t * 1.3 + i) * 6 * k;
      const pulse = 0.8 + 0.2 * Math.sin(t * 3 + i * 2);
      const r = (3.4 + hash(i, 65) * 2) * k * pulse * fade;
      if (r < 0.2) continue;
      halo.addCircle(x, y, r * 3.2);
      core.addCircle(x, y, r);
      for (let j = 0; j < 7; j += 1) {
        const a = Math.PI * (0.15 + (j / 6) * 0.7);
        const len = r * (3.4 + Math.sin(t * 2.2 + j + i) * 0.6);
        legs.moveTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.4);
        legs.quadTo(
          x + Math.cos(a) * len * 0.6 + Math.sin(t * 2 + j) * r * 0.5,
          y + len * 0.5,
          x + Math.cos(a) * len * 0.9,
          y + Math.sin(a) * len,
        );
      }
    }
    return { core, halo, legs };
  });
  const core = useDerivedValue(() => d.value.core);
  const halo = useDerivedValue(() => d.value.halo);
  const legs = useDerivedValue(() => d.value.legs);
  return (
    <Group>
      <Path path={halo} color={c.strand} opacity={0.24} />
      <Path path={legs} style="stroke" strokeWidth={0.7 * k} strokeCap="round" color={c.strand} opacity={0.75} />
      <Path path={core} color={c.glow} />
    </Group>
  );
}

export default function AvatarScene({ p, clock, width, height, tone, lightSurface }) {
  const L = useMemo(() => avLayout(width, height), [width, height]);
  const planet = useMemo(() => buildPlanet(L), [L]);
  const forest = useMemo(() => buildForest(L), [L]);
  const { k, base } = L;
  const rocks = useMemo(
    () =>
      [
        [width * 0.16, base - 470 * k, 0.9, 1, 120, 200],
        [width * 0.62, base - 400 * k, 0.7, 2, 110, 170],
        [width * 0.94, base - 300 * k, 0.8, 3, 100, 190],
        [width * 0.4, base - 560 * k, 0.45, 4, 90, 140],
      ].map(([x, y, s, seed, w, h]) => ({ x, y, s, seed, h: h * k, rock: { ...buildRock(w * k, h * k, seed, k), w: w * k } })),
    [width, base, k],
  );
  const c = useMemo(() => toneMap(AV_TONE, tone.colors), [tone]);
  const night = !lightSurface;
  // olay sırasında biyolüminesans güçlenir
  const boost = useDerivedValue(() => {
    const u = restU(p, clock.value);
    return u > 1 ? 0 : sm(0.1, 0.35, u) * (1 - sm(0.8, 1, u));
  });
  const strandA = useDerivedValue(
    () => Math.min(1, (night ? 0.55 : 0.4) + 0.2 * Math.sin(clock.value * 0.9) + boost.value * 0.35),
  );
  const dotsA = useDerivedValue(() => Math.min(1, 0.55 + 0.35 * Math.sin(clock.value * 1.3) + boost.value * 0.3));
  const dots2A = useDerivedValue(() => Math.min(1, 0.55 + 0.35 * Math.sin(clock.value * 1.3 + 2.2) + boost.value * 0.3));
  const treeGlow = useDerivedValue(() => Math.min(1, (night ? 0.5 : 0.3) + boost.value * 0.4));
  const sway = useDerivedValue(() => [{ translateX: Math.sin(clock.value * 0.7) * 1.6 * k }]);
  return (
    <Group opacity={tone.alpha}>
      {/* gaz devi + ay */}
      <Path path={planet.disk} color={c.planet} />
      <Path path={planet.bands} color={c.band} opacity={0.7} />
      <Path path={planet.moon} color={c.moon} />
      <Rect x={0} y={base - 420 * k} width={width} height={420 * k}>
        <LinearGradient start={vec(0, base - 420 * k)} end={vec(0, base)} colors={[rgba(c.haze, 0), c.haze]} />
      </Rect>
      {rocks.map((r) => (
        <FloatRock key={r.seed} clock={clock} x={r.x} y={r.y} s={r.s} seed={r.seed} rock={r.rock} h={r.h} c={c} k={k} night={night} />
      ))}
      <Ikran p={p} clock={clock} L={L} c={c} />
      <Path path={forest.hill} color={c.hillFar} />
      {/* Ruhlar Ağacı */}
      <Group opacity={treeGlow} transform={[{ translateX: forest.cx }, { translateY: base - 60 * k }, { scaleX: 1.6 }]}>
        <Glow r={130 * k} color={c.glow2} a={0.6} mid={0.35} />
      </Group>
      <Path path={forest.ground} color={c.ground} />
      <Path path={forest.tree} color={c.tree} />
      <Path path={forest.limbs} style="stroke" strokeWidth={7 * k} strokeCap="round" color={c.tree} />
      <Group opacity={strandA} transform={sway}>
        <Path path={forest.strands} style="stroke" strokeWidth={1.3 * k} strokeCap="round" color={c.strand} />
      </Group>
      <SpiritSeeds p={p} clock={clock} L={L} c={c} cx={forest.cx} />
      {/* biyolüminesan ön plan */}
      <Path path={forest.plantDark} color={c.plantDark} />
      <Path path={forest.plant} color={c.plant} />
      <Group opacity={dotsA}>
        <Path path={forest.glowDots} color={c.glow} />
      </Group>
      <Group opacity={dots2A}>
        <Path path={forest.glowDots2} color={c.glow2} />
      </Group>
    </Group>
  );
}
