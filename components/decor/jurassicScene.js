// components/decor/jurassicScene.js
//
// Jurassic Park evren sahnesi (OVERLAY.jpVec = 61) — tamamı VEKTÖR:
//   • Arkada pus içinde sivri volkanik adalar, önünde yoğun orman sırtı; ormanın üstünden boyunlarını
//     ağır ağır sallayan iki Brachiosaurus.
//   • Ortada dev kütük kapı: iki kalın direk, çatılı kiriş, tepede meşaleler (titrer, ışık saçar),
//     yarı açık kanatlar. Sağda elektrikli çit: direkler, gergin teller, arada çakan kıvılcım.
//   • Önde eğrelti otları ve palmiyeler (rüzgârla hafif salınır).
//   • Olay (66 sn'de bir ~27 sn): T-Rex sağdan girer, ortada durup başını kaldırarak kükrer (çene açılır,
//     sahne sarsılır), sonra sola çıkar; üstte bir helikopter adayı geçer.
//   • Olay B (dönüşümlü): ormandan bir uçan sürüngen sürüsü havalanıp gökyüzünü geçer; ardından
//     ince bacaklı, uzun boyunlu bir sürü dinozor sağdan sola, iki sıra halinde ovayı koşarak geçer.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[61] (JP_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Circle, Group, LinearGradient, Path, Rect, Skia, vec } from "@shopify/react-native-skia";
import { eventU } from "../../utils/weatherParticles";
import { Glow, groundLayout, hash, peaksPath, rgba, ridgePath, sm, toneMap } from "./seasonKit";
import { addBlade, addFlame, addPalm } from "./universeKit";

export const JP_TONE = [
  "mist",
  "mtnFar",
  "mtnNear",
  "jungleFar",
  "jungle",
  "jungleHi",
  "log",
  "logDark",
  "fire",
  "fireCore",
  "fence",
  "wire",
  "spark",
  "rex",
  "rexDark",
  "eye",
  "heli",
  "brachio",
  "fern",
  "fernDark",
  "ground",
  "roof",
];

export function jpLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  return { ...L, base: ground - 6 * k, walk: ground + 10 * k };
}

// ───────────────────────────── durağan yollar

function buildLand(L) {
  const { k, width, base, height } = L;
  const peaks = peaksPath(
    width,
    [
      [width * 0.12, base - 300 * k],
      [width * 0.3, base - 360 * k],
      [width * 0.62, base - 280 * k],
      [width * 0.86, base - 340 * k],
    ],
    base - 150 * k,
    base,
    5,
  );
  const jungleFar = ridgePath(width, base - 120 * k, 40 * k, 5, 2, base, 6 * k).path;
  // orman: üst kenarı yuvarlak taçlardan
  const jungle = Skia.Path.Make();
  const jungleHi = Skia.Path.Make();
  jungle.addRect(Skia.XYWHRect(-10, base - 60 * k, width + 20, 70 * k));
  for (let i = 0; i < 26; i += 1) {
    const x = (i / 25) * width + (hash(i, 4) - 0.5) * 10 * k;
    const r = (16 + hash(i, 5) * 16) * k;
    const y = base - 60 * k - hash(i, 6) * 26 * k;
    jungle.addCircle(x, y, r);
    jungleHi.addCircle(x - r * 0.3, y - r * 0.35, r * 0.45);
  }
  const groundP = Skia.Path.Make();
  groundP.addRect(Skia.XYWHRect(-10, base, width + 20, height - base + 10));
  return { peaks: peaks.path, jungleFar, jungle, jungleHi, ground: groundP };
}

function buildGate(L) {
  const { k, width, base } = L;
  const gx = width * 0.3;
  const gw = 150 * k;
  const ph = 230 * k;
  const log = Skia.Path.Make();
  const dark = Skia.Path.Make();
  const roof = Skia.Path.Make();
  // iki direk: hafif konik kütükler, halka çizgileri
  [gx - gw / 2, gx + gw / 2].forEach((x, i) => {
    log.moveTo(x - 13 * k, base);
    log.lineTo(x - 10 * k, base - ph);
    log.lineTo(x + 10 * k, base - ph);
    log.lineTo(x + 13 * k, base);
    log.close();
    for (let j = 0; j < 7; j += 1) dark.addRect(Skia.XYWHRect(x - 11 * k, base - (24 + j * 30 + hash(i, j) * 6) * k, 22 * k, 2 * k));
    // destek payandası
    log.moveTo(x + (i ? 14 : -14) * k, base);
    log.lineTo(x + (i ? 40 : -40) * k, base);
    log.lineTo(x + (i ? 12 : -12) * k, base - 70 * k);
    log.close();
  });
  // kiriş + çatı
  const by = base - ph + 22 * k;
  log.addRect(Skia.XYWHRect(gx - gw / 2 - 26 * k, by, gw + 52 * k, 16 * k));
  dark.addRect(Skia.XYWHRect(gx - gw / 2 - 26 * k, by + 13 * k, gw + 52 * k, 3 * k));
  roof.moveTo(gx - gw / 2 - 40 * k, by + 2 * k);
  roof.lineTo(gx - gw * 0.18, by - 26 * k);
  roof.lineTo(gx + gw * 0.18, by - 26 * k);
  roof.lineTo(gx + gw / 2 + 40 * k, by + 2 * k);
  roof.close();
  // ortadaki amblem levhası (yazısız daire + dişli kenar)
  const badge = Skia.Path.Make();
  badge.addCircle(gx, by + 8 * k, 15 * k);
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    badge.addCircle(gx + Math.cos(a) * 15 * k, by + 8 * k + Math.sin(a) * 15 * k, 2.4 * k);
  }
  // yarı açık kanatlar: dikey tahtalar, içe dönük
  const doors = Skia.Path.Make();
  [-1, 1].forEach((side) => {
    const hx = gx + (side * gw) / 2 - side * 10 * k;
    const ox = hx - side * 46 * k;
    doors.moveTo(hx, base);
    doors.lineTo(hx, base - ph * 0.6);
    doors.lineTo(ox, base - ph * 0.56 + 6 * k);
    doors.lineTo(ox, base + 4 * k);
    doors.close();
    for (let j = 1; j < 5; j += 1) {
      const x = hx + (ox - hx) * (j / 5);
      dark.moveTo(x, base);
      dark.lineTo(x, base - ph * 0.58);
      dark.lineTo(x + 1.6 * k, base - ph * 0.58);
      dark.lineTo(x + 1.6 * k, base);
      dark.close();
    }
  });
  const torches = [
    [gx - gw / 2, base - ph - 2 * k],
    [gx + gw / 2, base - ph - 2 * k],
  ];
  return { log, dark, roof, badge, doors, torches, badgeAt: [gx, by + 8 * k] };
}

function buildFence(L) {
  const { k, width, base } = L;
  const posts = Skia.Path.Make();
  const wires = Skia.Path.Make();
  const x0 = width * 0.58;
  const h = 150 * k;
  const xs = [];
  for (let x = x0; x < width + 40 * k; x += 46 * k) xs.push(x);
  xs.forEach((x) => {
    posts.addRect(Skia.XYWHRect(x - 3.5 * k, base - h, 7 * k, h));
    posts.addRect(Skia.XYWHRect(x - 6 * k, base - h - 4 * k, 12 * k, 5 * k));
    for (let j = 0; j < 6; j += 1) posts.addCircle(x + 4 * k, base - h + (12 + j * 22) * k, 2 * k);
  });
  for (let j = 0; j < 6; j += 1) {
    const y = base - h + (12 + j * 22) * k;
    wires.moveTo(x0, y);
    for (let i = 1; i < xs.length; i += 1) wires.quadTo((xs[i - 1] + xs[i]) / 2, y + 2.4 * k, xs[i], y);
  }
  return { posts, wires, xs, h };
}

function buildFlora(L) {
  const { k, width, height } = L;
  const trunk = Skia.Path.Make();
  const fronds = Skia.Path.Make();
  addPalm(trunk, fronds, width * 0.06, height + 4 * k, 250 * k, 0.35, 3, k);
  addPalm(trunk, fronds, width * 0.97, height + 4 * k, 220 * k, -0.4, 7, k);
  const fern = Skia.Path.Make();
  const fernDark = Skia.Path.Make();
  const bottom = height + 4 * k;
  [0.02, 0.2, 0.46, 0.7, 0.9].forEach((f, i) => {
    const cx = width * f;
    for (let j = 0; j < 9; j += 1) {
      const a = -Math.PI * (0.12 + (j / 8) * 0.76);
      const len = (46 + hash(i, j) * 40) * k;
      const target = j % 2 ? fern : fernDark;
      addBlade(target, cx, bottom, cx + Math.cos(a) * len, bottom + Math.sin(a) * len, (j < 4 ? 10 : -10) * k, 5 * k);
    }
  });
  return { trunk, fronds, fern, fernDark };
}

function buildBrachio(k) {
  const body = Skia.Path.Make();
  body.addOval(Skia.XYWHRect(-36 * k, -58 * k, 76 * k, 40 * k));
  // bacaklar
  [
    [-26, 0],
    [-12, 1],
    [18, 0],
    [30, 1],
  ].forEach(([x]) => body.addRect(Skia.XYWHRect(x * k - 4 * k, -30 * k, 9 * k, 30 * k)));
  // kuyruk
  body.moveTo(-32 * k, -46 * k);
  body.quadTo(-66 * k, -36 * k, -88 * k, -18 * k);
  body.lineTo(-84 * k, -16 * k);
  body.quadTo(-62 * k, -30 * k, -30 * k, -32 * k);
  body.close();
  // boyun (köke göre; döndürülerek sallanır)
  const neck = Skia.Path.Make();
  neck.moveTo(-8 * k, 6 * k);
  neck.quadTo(6 * k, -60 * k, 16 * k, -120 * k);
  neck.quadTo(18 * k, -132 * k, 30 * k, -132 * k);
  neck.lineTo(40 * k, -128 * k);
  neck.quadTo(36 * k, -122 * k, 26 * k, -120 * k);
  neck.quadTo(18 * k, -60 * k, 10 * k, 4 * k);
  neck.close();
  return { body, neck };
}

// ───────────────────────────── T-Rex

function addArm(q, x, y, u, a) {
  "worklet";
  const c = Math.cos(a);
  const s = Math.sin(a);
  const pt = (dx, dy) => [x + dx * c - dy * s, y + dx * s + dy * c];
  const p0 = pt(-3 * u, 0);
  const p1 = pt(8 * u, 8 * u);
  const p2 = pt(12 * u, 6 * u);
  const p3 = pt(3 * u, -3 * u);
  q.moveTo(p0[0], p0[1]);
  q.lineTo(p1[0], p1[1]);
  q.lineTo(p2[0], p2[1]);
  q.lineTo(p3[0], p3[1]);
  q.close();
}

/** Yandan T-Rex (sağa bakar); walk yürüyüş fazı, open çene açıklığı 0–1, lift baş kalkışı 0–1. */
function rexPaths(walk, open, lift, k) {
  "worklet";
  const u = k * 1.25;
  const body = Skia.Path.Make();
  const dark = Skia.Path.Make();
  const hy = -lift * 14 * u;
  const jaw = open * 16 * u;
  body.moveTo(-100 * u, -82 * u);
  body.quadTo(-52 * u, -94 * u, -8 * u, -98 * u);
  body.quadTo(26 * u, -100 * u, 46 * u, -92 * u + hy * 0.3);
  body.quadTo(56 * u, -92 * u + hy * 0.6, 60 * u, -100 * u + hy);
  // kafa
  body.lineTo(64 * u, -110 * u + hy);
  body.quadTo(82 * u, -116 * u + hy, 100 * u, -106 * u + hy);
  body.lineTo(102 * u, -97 * u + hy);
  body.lineTo(80 * u, -94 * u + hy);
  // alt çene (açılır)
  body.lineTo(98 * u, -90 * u + hy + jaw);
  body.lineTo(94 * u, -84 * u + hy + jaw);
  body.quadTo(76 * u, -82 * u + hy + jaw * 0.5, 62 * u, -84 * u + hy);
  body.quadTo(56 * u, -76 * u, 44 * u, -70 * u);
  body.quadTo(20 * u, -58 * u, 0, -60 * u);
  body.quadTo(-32 * u, -66 * u, -62 * u, -76 * u);
  body.close();
  // kısa kollar
  addArm(body, 46 * u, -74 * u, u, Math.sin(walk * 0.5) * 0.3);
  // bacaklar: kalın uyluk, ters diz, pençe
  [0, Math.PI].forEach((off, i) => {
    const sw = Math.sin(walk + off);
    const up = Math.max(0, Math.cos(walk + off)) * 6 * u;
    const hx = (i ? -6 : 4) * u;
    const kx = hx + 12 * u + sw * 8 * u;
    const ax = hx - 4 * u + sw * 14 * u;
    const target = i ? dark : body;
    target.moveTo(hx - 16 * u, -86 * u);
    target.quadTo(hx + 24 * u, -84 * u, kx + 6 * u, -46 * u - up);
    target.lineTo(ax + 4 * u, -14 * u - up);
    target.lineTo(ax + 18 * u, -2 * u - up);
    target.lineTo(ax - 4 * u, -up);
    target.lineTo(ax - 4 * u, -14 * u - up);
    target.lineTo(kx - 8 * u, -46 * u - up);
    target.quadTo(hx - 18 * u, -60 * u, hx - 16 * u, -86 * u);
    target.close();
  });
  // sırt pulları
  for (let i = 0; i < 9; i += 1) {
    const x = -70 * u + i * 13 * u;
    const y = -90 * u - Math.sin((i / 8) * Math.PI) * 8 * u;
    dark.addCircle(x, y, 2.2 * u);
  }
  return { body, dark, eye: [84 * u, -106 * u + hy] };
}

/** Olay zaman çizelgesi: 0–0.4 içeri yürür, 0.4–0.6 kükrer, 0.6–1 çıkar. */
function rexState(u, width, k) {
  "worklet";
  if (u > 1 || u < 0.04 || u > 0.98) return null;
  const e = (u - 0.04) / 0.94;
  const mid = width * 0.5;
  const startX = width + 170 * k;
  const endX = -170 * k;
  let x;
  let roar = 0;
  if (e < 0.4) x = startX + (mid - startX) * sm(0, 0.4, e);
  else if (e < 0.6) {
    x = mid;
    roar = Math.sin(((e - 0.4) / 0.2) * Math.PI);
  } else x = mid + (endX - mid) * sm(0.6, 1, e);
  return { x, roar, moving: e < 0.4 || e > 0.6 };
}

function TRex({ p, clock, L, c }) {
  const { k, width } = L;
  const st = useDerivedValue(() => rexState(eventU(p, clock.value, 0), width, k));
  const d = useDerivedValue(() => {
    const s = st.value;
    const walk = s && s.moving ? clock.value * 3.2 : 0;
    return rexPaths(walk, s ? s.roar : 0, s ? s.roar : 0, k);
  });
  const body = useDerivedValue(() => d.value.body);
  const dark = useDerivedValue(() => d.value.dark);
  const eye = useDerivedValue(() => d.value.eye[0]);
  const eyeY = useDerivedValue(() => d.value.eye[1]);
  const at = useDerivedValue(() => {
    const s = st.value;
    if (!s) return [{ translateX: -900 }, { translateY: -900 }];
    // yürürken hafif inip kalkar; sola gider → yatay ayna
    const bob = s.moving ? Math.abs(Math.sin(clock.value * 3.2)) * 3 * k : 0;
    return [{ translateX: s.x }, { translateY: L.walk - bob }, { scaleX: -1 }];
  });
  return (
    <Group transform={at}>
      <Path path={dark} color={c.rexDark} />
      <Path path={body} color={c.rex} />
      <Circle cx={eye} cy={eyeY} r={2.2 * k} color={c.eye} />
    </Group>
  );
}

function Heli({ p, clock, L, c }) {
  const { k, width, base } = L;
  const shape = useMemo(() => {
    const q = Skia.Path.Make();
    q.addOval(Skia.XYWHRect(-16 * k, -7 * k, 30 * k, 14 * k));
    q.addRect(Skia.XYWHRect(-44 * k, -3 * k, 30 * k, 3.4 * k));
    q.addRect(Skia.XYWHRect(-46 * k, -9 * k, 4 * k, 8 * k));
    q.addRect(Skia.XYWHRect(-12 * k, 9 * k, 26 * k, 1.6 * k));
    q.addRect(Skia.XYWHRect(-6 * k, 6 * k, 1.6 * k, 4 * k));
    q.addRect(Skia.XYWHRect(6 * k, 6 * k, 1.6 * k, 4 * k));
    q.addRect(Skia.XYWHRect(-1 * k, -11 * k, 2 * k, 4 * k));
    return q;
  }, [k]);
  const rotor = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const w = Math.abs(Math.cos(clock.value * 40)) * 26 * k + 4 * k;
    q.addRect(Skia.XYWHRect(-w, -12 * k, w * 2, 1.6 * k));
    return q;
  });
  const at = useDerivedValue(() => {
    const u = eventU(p, clock.value, 0);
    if (u > 1 || u < 0.08 || u > 0.6) return [{ translateX: -900 }, { translateY: -900 }];
    const e = (u - 0.08) / 0.52;
    return [
      { translateX: -80 * k + (width + 160 * k) * e },
      { translateY: base - 400 * k + Math.sin(e * 6) * 10 * k },
      { rotate: 0.06 },
    ];
  });
  return (
    <Group transform={at}>
      <Path path={shape} color={c.heli} />
      <Path path={rotor} color={c.heli} />
    </Group>
  );
}

function Torch({ x, y, clock, k, c, seed, night }) {
  const flame = useDerivedValue(() => {
    const q = Skia.Path.Make();
    addFlame(q, x, y, 14 * k, 30 * k, clock.value, seed);
    return q;
  });
  const core = useDerivedValue(() => {
    const q = Skia.Path.Make();
    addFlame(q, x, y, 7 * k, 16 * k, clock.value + 0.3, seed + 4);
    return q;
  });
  const glowA = useDerivedValue(() => (night ? 0.55 : 0.3) * (0.8 + 0.2 * Math.sin(clock.value * 8 + seed)));
  return (
    <Group>
      <Group opacity={glowA} transform={[{ translateX: x }, { translateY: y - 14 * k }]}>
        <Glow r={70 * k} color={c.fire} a={0.7} mid={0.3} />
      </Group>
      <Path path={flame} color={c.fire} />
      <Path path={core} color={c.fireCore} />
    </Group>
  );
}

function Sparks({ clock, L, c, fence }) {
  const { k, base } = L;
  const q = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const slot = Math.floor(clock.value * 1.3);
    const ph = clock.value * 1.3 - slot;
    if (ph > 0.18 || hash(slot, 3) > 0.45) return path;
    const i = 1 + Math.floor(hash(slot, 1) * (fence.xs.length - 1));
    const x = fence.xs[Math.min(fence.xs.length - 1, i)] + 4 * k;
    const y = base - fence.h + (12 + Math.floor(hash(slot, 2) * 6) * 22) * k;
    for (let j = 0; j < 6; j += 1) {
      const a = (j / 6) * Math.PI * 2 + slot;
      const r = (4 + ph * 40) * k;
      path.moveTo(x, y);
      path.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    path.addCircle(x, y, 2.4 * k);
    return path;
  });
  return <Path path={q} style="stroke" strokeWidth={1.2 * k} strokeCap="round" color={c.spark} />;
}

// ───────────────────────────── olay B: koşan sürü + uçan sürüngenler

/** Koşan iki ayaklı (sola bakar); gövde dolgu yolu q'ya, bacaklar çizgi yolu legs'e. */
function addRunner(q, legs, x, y, s, ph) {
  "worklet";
  const bob = Math.abs(Math.sin(ph)) * 1.4 * s;
  const by = y - bob;
  q.addOval(Skia.XYWHRect(x - 7 * s, by - 21 * s, 16 * s, 8 * s));
  q.moveTo(x + 8 * s, by - 18 * s);
  q.lineTo(x + 26 * s, by - 21 * s);
  q.lineTo(x + 8 * s, by - 14 * s);
  q.close();
  q.moveTo(x - 6 * s, by - 19 * s);
  q.lineTo(x - 13 * s, by - 32 * s);
  q.lineTo(x - 10 * s, by - 33 * s);
  q.lineTo(x - 2 * s, by - 17 * s);
  q.close();
  q.addOval(Skia.XYWHRect(x - 19 * s, by - 35 * s, 9 * s, 3.6 * s));
  for (let j = 0; j < 2; j += 1) {
    const a = ph + j * Math.PI;
    const kx = x + Math.sin(a) * 4 * s - 1 * s;
    const fx = x + Math.sin(a) * 9 * s - Math.max(0, Math.cos(a)) * 3 * s;
    legs.moveTo(x + 1 * s, by - 14 * s);
    legs.lineTo(kx - 3 * s, by - 7 * s);
    legs.lineTo(fx, y - Math.max(0, Math.cos(a)) * 4 * s);
  }
}

const HERD = 10;

function Herd({ p, clock, L, c }) {
  const { k, width, base } = L;
  const d = useDerivedValue(() => {
    const body = Skia.Path.Make();
    const legs = Skia.Path.Make();
    const u = eventU(p, clock.value, 1);
    if (u > 1) return { body, legs };
    for (let i = 0; i < HERD; i += 1) {
      const row = i % 2;
      const delay = 0.3 + hash(i, 71) * 0.18 + row * 0.04;
      const e = (u - delay) / (0.3 + hash(i, 72) * 0.08);
      if (e <= 0 || e >= 1) continue;
      const s = k * (row ? 1.6 : 1.25);
      const x = width + 40 * k - e * (width + 120 * k);
      const y = base + (row ? 14 : 2) * k;
      addRunner(body, legs, x, y, s, clock.value * 15 + i * 1.3);
    }
    return { body, legs };
  });
  const body = useDerivedValue(() => d.value.body);
  const legs = useDerivedValue(() => d.value.legs);
  const dust = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const u = eventU(p, clock.value, 1);
    if (u > 1 || u < 0.3) return q;
    const e = sm(0.3, 0.55, u) * (1 - sm(0.75, 0.95, u));
    for (let i = 0; i < 16; i += 1) {
      const x = width * (1 - ((u - 0.3) / 0.45) * 1.1) + hash(i, 73) * 160 * k;
      q.addCircle(x, base + (6 + hash(i, 74) * 12) * k, (6 + hash(i, 75) * 10) * k * e);
    }
    return q;
  });
  return (
    <Group>
      <Path path={dust} color={c.mist} opacity={0.35} />
      <Path path={legs} style="stroke" strokeWidth={1.8 * k} strokeCap="round" strokeJoin="round" color={c.brachio} />
      <Path path={body} color={c.brachio} />
    </Group>
  );
}

function Pterosaurs({ p, clock, L, c }) {
  const { k, width, base } = L;
  const q = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const u = eventU(p, clock.value, 1);
    if (u > 1) return path;
    for (let i = 0; i < 5; i += 1) {
      const e = (u - 0.04 - i * 0.035) / 0.42;
      if (e <= 0 || e >= 1) continue;
      const s = k * (1.2 - i * 0.12);
      const x = -60 * k + e * (width + 120 * k);
      const y = base - (300 + i * 26 + hash(i, 76) * 40) * k - Math.sin(e * 3 + i) * 30 * k;
      const f = Math.sin(clock.value * 6 + i * 1.7);
      path.moveTo(x - 22 * s, y - f * 9 * s);
      path.quadTo(x - 10 * s, y - 4 * s - f * 4 * s, x, y);
      path.quadTo(x + 10 * s, y - 4 * s - f * 4 * s, x + 22 * s, y - f * 9 * s);
      path.quadTo(x + 10 * s, y + 1 * s, x, y + 2 * s);
      path.quadTo(x - 10 * s, y + 1 * s, x - 22 * s, y - f * 9 * s);
      path.close();
      path.moveTo(x + 2 * s, y);
      path.lineTo(x + 11 * s, y - 2 * s);
      path.lineTo(x + 2 * s, y + 2 * s);
      path.close();
    }
    return path;
  });
  return <Path path={q} color={c.heli} />;
}

export default function JurassicScene({ p, clock, width, height, tone, lightSurface }) {
  const L = useMemo(() => jpLayout(width, height), [width, height]);
  const land = useMemo(() => buildLand(L), [L]);
  const gate = useMemo(() => buildGate(L), [L]);
  const fence = useMemo(() => buildFence(L), [L]);
  const flora = useMemo(() => buildFlora(L), [L]);
  const brachio = useMemo(() => buildBrachio(L.k * 1.45), [L]);
  const c = useMemo(() => toneMap(JP_TONE, tone.colors), [tone]);
  const { k, base } = L;
  const night = !lightSurface;
  // kükreme anında sahne titrer
  const shake = useDerivedValue(() => {
    const s = rexState(eventU(p, clock.value, 0), width, k);
    const a = s ? s.roar * 2.2 * k : 0;
    return [{ translateX: Math.sin(clock.value * 47) * a }, { translateY: Math.cos(clock.value * 39) * a * 0.6 }];
  });
  const sway = useDerivedValue(() => [{ translateX: Math.sin(clock.value * 0.9) * 2 * k }]);
  const neckA = useDerivedValue(() => [
    { translateX: width * 0.66 + 37 * k },
    { translateY: base - 192 * k },
    { rotate: Math.sin(clock.value * 0.35) * 0.08 },
  ]);
  const neckB = useDerivedValue(() => [
    { translateX: width * 0.86 + 30 * k },
    { translateY: base - 176 * k },
    { scale: 0.8 },
    { rotate: Math.sin(clock.value * 0.28 + 2) * 0.1 - 0.05 },
  ]);
  return (
    <Group opacity={tone.alpha}>
      <Group transform={shake}>
        {/* volkanik adalar + pus */}
        <Path path={land.peaks} color={c.mtnFar} />
        <Rect x={0} y={base - 260 * k} width={width} height={260 * k}>
          <LinearGradient start={vec(0, base - 260 * k)} end={vec(0, base - 60 * k)} colors={[rgba(c.mist, 0), c.mist]} />
        </Rect>
        <Path path={land.jungleFar} color={c.mtnNear} />
        <Pterosaurs p={p} clock={clock} L={L} c={c} />
        {/* Brachiosaurus'lar orman üstünde */}
        <Group transform={[{ translateX: width * 0.66 }, { translateY: base - 120 * k }]}>
          <Path path={brachio.body} color={c.brachio} />
        </Group>
        <Group transform={neckA}>
          <Path path={brachio.neck} color={c.brachio} />
        </Group>
        <Group transform={[{ translateX: width * 0.86 }, { translateY: base - 120 * k }, { scale: 0.8 }]}>
          <Path path={brachio.body} color={c.brachio} />
        </Group>
        <Group transform={neckB}>
          <Path path={brachio.neck} color={c.brachio} />
        </Group>
        <Path path={land.jungle} color={c.jungleFar} />
        <Path path={land.jungleHi} color={c.jungle} opacity={0.7} />
        <Path path={land.ground} color={c.ground} />
        {/* elektrikli çit */}
        <Path path={fence.wires} style="stroke" strokeWidth={1.1 * k} color={c.wire} />
        <Path path={fence.posts} color={c.fence} />
        <Sparks clock={clock} L={L} c={c} fence={fence} />
        {/* kapı */}
        <Path path={gate.doors} color={c.logDark} />
        <Path path={gate.log} color={c.log} />
        <Path path={gate.roof} color={c.roof} />
        <Path path={gate.dark} color={c.logDark} />
        <Path path={gate.badge} color={c.logDark} />
        <Circle cx={gate.badgeAt[0]} cy={gate.badgeAt[1]} r={10 * k} color={c.roof} />
        <Circle cx={gate.badgeAt[0]} cy={gate.badgeAt[1]} r={6.5 * k} color={c.fire} opacity={0.75} />
        {gate.torches.map(([x, y], i) => (
          <Torch key={i} x={x} y={y} clock={clock} k={k} c={c} seed={i * 3 + 1} night={night} />
        ))}
        <Heli p={p} clock={clock} L={L} c={c} />
        <Herd p={p} clock={clock} L={L} c={c} />
        <TRex p={p} clock={clock} L={L} c={c} />
        {/* ön plan bitkileri */}
        <Group transform={sway}>
          <Path path={flora.trunk} color={c.logDark} />
          <Path path={flora.fronds} color={c.fernDark} />
          <Path path={flora.fernDark} color={c.fernDark} />
          <Path path={flora.fern} color={c.fern} />
        </Group>
      </Group>
    </Group>
  );
}
