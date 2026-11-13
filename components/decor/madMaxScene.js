// components/decor/madMaxScene.js
//
// Mad Max: Fury Road evren sahnesi (OVERLAY.mmVec = 63) — tamamı VEKTÖR:
//   • Kızgın turuncu gök, soluk güneş diski; ufukta dev kum fırtınası duvarı (kabarır, içinde şimşek çakar).
//   • Sağda Citadel: tepeleri yeşil bahçeli üç kaya kule, aralarından dökülen su perdesi.
//   • Önde kum tepeleri, uzak masalar ve tozlu yol.
//   • Olay (62 sn'de bir ~26 sn): War Rig (çekici + tanker) soldan sağa toz bulutu kaldırarak geçer;
//     peşinde alev püskürten gitarlı takip aracı.
//   • Olay B (dönüşümlü): Citadel suyu salar — kule yüzlerindeki oluklardan üç büyük şelale
//     açılır, dipte su sisi kabarır; kulelerin dibine toplanan kalabalık kollarını kaldırır;
//     su kesilir, kalabalık dağılır.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[63] (MM_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Group, LinearGradient, Path, Rect, Skia, vec } from "@shopify/react-native-skia";
import { eventU } from "../../utils/weatherParticles";
import { Glow, groundLayout, hash, rgba, ridgePath, sm, toneMap } from "./seasonKit";
import { addFlame } from "./universeKit";

export const MM_TONE = [
  "sky",
  "skyLow",
  "sun",
  "storm",
  "stormDark",
  "bolt",
  "mesa",
  "mesaDark",
  "citadel",
  "garden",
  "water",
  "dune",
  "duneHi",
  "road",
  "rig",
  "rigDark",
  "tank",
  "wheel",
  "dust",
  "fire",
  "fireCore",
];

export function mmLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  return { ...L, base: ground - 30 * k, road: ground + 4 * k };
}

// ───────────────────────────── durağan yollar

function buildStorm(L) {
  const { k, width, base } = L;
  const body = Skia.Path.Make();
  const dark = Skia.Path.Make();
  // ufuktan yükselen kabarık duvar: sol yarıda yüksek, sağa doğru alçalır
  for (let i = 0; i < 34; i += 1) {
    const f = i / 33;
    const x = -20 * k + f * (width * 0.62);
    const top = base - (440 - f * 250) * k - hash(i, 2) * 40 * k;
    const r = (30 + hash(i, 3) * 26) * k * (1 - f * 0.45);
    for (let y = top; y < base; y += r * 0.9) body.addCircle(x + (hash(i, y) - 0.5) * 16 * k, y, r);
    dark.addCircle(x + 6 * k, base - (60 + hash(i, 5) * 50) * k, r * 0.9);
  }
  // girdap çizgileri
  const swirl = Skia.Path.Make();
  for (let i = 0; i < 7; i += 1) {
    const cx = width * (0.05 + hash(i, 11) * 0.45);
    const cy = base - (120 + hash(i, 12) * 240) * k;
    const r = (24 + hash(i, 13) * 30) * k;
    swirl.moveTo(cx - r, cy);
    swirl.quadTo(cx - r * 0.2, cy - r * 0.9, cx + r, cy - r * 0.2);
    swirl.quadTo(cx + r * 0.3, cy + r * 0.2, cx - r * 0.3, cy - r * 0.1);
  }
  return { body, dark, swirl, top: base - 480 * k };
}

function buildCitadel(L) {
  const { k, width, base } = L;
  const rock = Skia.Path.Make();
  const dark = Skia.Path.Make();
  const garden = Skia.Path.Make();
  const towers = [
    [width * 0.72, 46, 250],
    [width * 0.84, 54, 300],
    [width * 0.96, 44, 230],
  ];
  towers.forEach(([x, w, h], i) => {
    const W = w * k;
    const H = h * k;
    rock.moveTo(x - W * 0.8, base);
    rock.quadTo(x - W * 0.5, base - H * 0.5, x - W * 0.55, base - H);
    rock.lineTo(x + W * 0.55, base - H);
    rock.quadTo(x + W * 0.5, base - H * 0.5, x + W * 0.8, base);
    rock.close();
    dark.moveTo(x + W * 0.1, base - H);
    dark.lineTo(x + W * 0.55, base - H);
    dark.quadTo(x + W * 0.5, base - H * 0.5, x + W * 0.8, base);
    dark.lineTo(x + W * 0.25, base);
    dark.close();
    // pencere oyukları
    for (let j = 0; j < 8; j += 1) dark.addRect(Skia.XYWHRect(x - W * 0.4 + hash(i, j) * W * 0.6, base - H * (0.2 + j * 0.09), 4 * k, 3 * k));
    // tepe bahçesi
    for (let j = 0; j < 6; j += 1) garden.addCircle(x - W * 0.5 + (j * W) / 5, base - H - 4 * k - Math.sin((j / 5) * Math.PI) * 6 * k, (6 + hash(i, j + 9) * 4) * k);
  });
  // kuleler arası köprüler
  rock.addRect(Skia.XYWHRect(towers[0][0], base - 214 * k, towers[1][0] - towers[0][0], 4 * k));
  rock.addRect(Skia.XYWHRect(towers[1][0], base - 196 * k, towers[2][0] - towers[1][0], 4 * k));
  const mesas = Skia.Path.Make();
  [
    [width * 0.08, 70, 60],
    [width * 0.36, 110, 44],
    [width * 0.55, 60, 34],
  ].forEach(([x, w, h]) => {
    mesas.moveTo(x - w * k * 0.6, base);
    mesas.lineTo(x - w * k * 0.4, base - h * k);
    mesas.lineTo(x + w * k * 0.4, base - h * k);
    mesas.lineTo(x + w * k * 0.6, base);
    mesas.close();
  });
  return { rock, dark, garden, mesas, waterX: towers[1][0] - 12 * k, waterTop: base - 260 * k };
}

function buildDesert(L) {
  const { k, width, height, base, road } = L;
  const dune = ridgePath(width, base + 14 * k, 18 * k, 3, 4, height + 10, 0).path;
  const duneHi = Skia.Path.Make();
  for (let i = 0; i < 9; i += 1) {
    const x = hash(i, 4) * width;
    const y = base + (20 + hash(i, 5) * 60) * k;
    duneHi.moveTo(x - 40 * k, y);
    duneHi.quadTo(x, y - 8 * k, x + 50 * k, y + 2 * k);
    duneHi.quadTo(x, y - 4 * k, x - 40 * k, y);
    duneHi.close();
  }
  const roadP = Skia.Path.Make();
  roadP.moveTo(-10, road - 6 * k);
  roadP.lineTo(width + 10, road - 10 * k);
  roadP.lineTo(width + 10, road + 14 * k);
  roadP.lineTo(-10, road + 18 * k);
  roadP.close();
  return { dune, duneHi, road: roadP };
}

// ───────────────────────────── araçlar

function wheelsPath(xs, y, r, rot, k) {
  "worklet";
  const tire = Skia.Path.Make();
  const hub = Skia.Path.Make();
  for (let i = 0; i < xs.length; i += 1) {
    const x = xs[i];
    tire.addCircle(x, y, r);
    hub.addCircle(x, y, r * 0.38);
    for (let j = 0; j < 3; j += 1) {
      const a = rot + (j / 3) * Math.PI * 2;
      hub.addCircle(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.12 + 0.4 * k);
    }
  }
  return { tire, hub };
}

function buildRig(k) {
  const u = k * 1.05;
  const cab = Skia.Path.Make();
  const dark = Skia.Path.Make();
  const tank = Skia.Path.Make();
  // çekici: burun sağda
  cab.moveTo(40 * u, -12 * u);
  cab.lineTo(40 * u, -44 * u);
  cab.lineTo(58 * u, -48 * u);
  cab.lineTo(70 * u, -36 * u);
  cab.lineTo(96 * u, -32 * u);
  cab.lineTo(100 * u, -12 * u);
  cab.close();
  // koç boynuzu tampon + dikenler
  dark.moveTo(100 * u, -24 * u);
  dark.lineTo(112 * u, -14 * u);
  dark.lineTo(100 * u, -8 * u);
  dark.close();
  for (let i = 0; i < 5; i += 1) {
    const x = 44 * u + i * 6 * u;
    dark.moveTo(x, -46 * u);
    dark.lineTo(x + 2 * u, -54 * u);
    dark.lineTo(x + 4 * u, -46 * u);
    dark.close();
  }
  // egzoz bacaları
  dark.addRect(Skia.XYWHRect(36 * u, -66 * u, 3 * u, 54 * u));
  dark.addRect(Skia.XYWHRect(31 * u, -62 * u, 3 * u, 50 * u));
  // camlar
  dark.addRect(Skia.XYWHRect(58 * u, -44 * u, 9 * u, 8 * u));
  // şasi
  dark.addRect(Skia.XYWHRect(-110 * u, -14 * u, 214 * u, 6 * u));
  // tanker
  tank.addRRect(Skia.RRectXY(Skia.XYWHRect(-110 * u, -50 * u, 140 * u, 36 * u), 16 * u, 16 * u));
  for (let i = 0; i < 4; i += 1) dark.addRect(Skia.XYWHRect(-90 * u + i * 32 * u, -50 * u, 2.4 * u, 36 * u));
  // tanker üstünde savaş oğlanı (direk + figür)
  dark.addRect(Skia.XYWHRect(-60 * u, -70 * u, 2 * u, 20 * u));
  dark.addCircle(-40 * u, -63 * u, 3 * u);
  dark.addRect(Skia.XYWHRect(-42 * u, -60 * u, 4 * u, 10 * u));
  return { cab, dark, tank, wheels: [-96 * u, -78 * u, -10 * u, 8 * u, 50 * u, 84 * u], r: 9 * u, len: 220 * u };
}

function buildCar(k) {
  const u = k;
  const body = Skia.Path.Make();
  const dark = Skia.Path.Make();
  body.moveTo(-40 * u, -10 * u);
  body.lineTo(-38 * u, -26 * u);
  body.lineTo(10 * u, -28 * u);
  body.lineTo(20 * u, -20 * u);
  body.lineTo(44 * u, -18 * u);
  body.lineTo(46 * u, -8 * u);
  body.close();
  // hoparlör duvarı + gitarcı
  dark.addRect(Skia.XYWHRect(-36 * u, -52 * u, 30 * u, 24 * u));
  for (let i = 0; i < 6; i += 1) body.addCircle(-31 * u + (i % 3) * 10 * u, -46 * u + Math.floor(i / 3) * 11 * u, 3.6 * u);
  dark.addCircle(4 * u, -44 * u, 3.4 * u);
  dark.addRect(Skia.XYWHRect(2 * u, -40 * u, 5 * u, 12 * u));
  // gitar sapı (yukarı doğru)
  dark.moveTo(2 * u, -34 * u);
  dark.lineTo(18 * u, -50 * u);
  dark.lineTo(20 * u, -48 * u);
  dark.lineTo(6 * u, -32 * u);
  dark.close();
  return { body, dark, wheels: [-26 * u, 30 * u], r: 8 * u, flame: [20 * u, -50 * u] };
}

function Convoy({ p, clock, L, c }) {
  const { k, width, road } = L;
  const rig = useMemo(() => buildRig(k), [k]);
  const car = useMemo(() => buildCar(k), [k]);
  const gap = 150 * k;
  const pos = useDerivedValue(() => {
    const u = eventU(p, clock.value, 0);
    if (u > 1 || u < 0.04 || u > 0.96) return null;
    const e = (u - 0.04) / 0.92;
    return -rig.len - gap + (width + rig.len * 2 + gap * 2) * e;
  });
  const rot = useDerivedValue(() => clock.value * 9);
  const rigW = useDerivedValue(() => wheelsPath(rig.wheels, -6 * k, rig.r, rot.value, k));
  const rigTire = useDerivedValue(() => rigW.value.tire);
  const rigHub = useDerivedValue(() => rigW.value.hub);
  const carW = useDerivedValue(() => wheelsPath(car.wheels, -6 * k, car.r, rot.value * 1.2, k));
  const carTire = useDerivedValue(() => carW.value.tire);
  const carHub = useDerivedValue(() => carW.value.hub);
  const rigAt = useDerivedValue(() => {
    const x = pos.value;
    if (x == null) return [{ translateX: -900 }, { translateY: -900 }];
    return [{ translateX: x }, { translateY: road + Math.sin(clock.value * 13) * 0.8 * k }];
  });
  const carAt = useDerivedValue(() => {
    const x = pos.value;
    if (x == null) return [{ translateX: -900 }, { translateY: -900 }];
    return [{ translateX: x - rig.len * 0.55 - gap }, { translateY: road + 8 * k + Math.sin(clock.value * 15 + 1) * 1.4 * k }];
  });
  const flame = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const pulse = Math.sin(clock.value * 2.2);
    if (pos.value == null || pulse < 0.2) return q;
    // gitarın ucundan yukarı alev
    addFlame(q, car.flame[0], car.flame[1], 12 * k, (30 + pulse * 26) * k, clock.value, 3);
    return q;
  });
  const flameCore = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const pulse = Math.sin(clock.value * 2.2);
    if (pos.value == null || pulse < 0.2) return q;
    addFlame(q, car.flame[0], car.flame[1], 6 * k, (16 + pulse * 14) * k, clock.value + 0.2, 5);
    return q;
  });
  // toz bulutu: araçların arkasında büyüyerek solan öbekler
  const dust = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const x = pos.value;
    if (x == null) return q;
    const tail = x - rig.len * 0.55 - gap - 50 * k;
    for (let i = 0; i < 26; i += 1) {
      const f = i / 25;
      const dx = tail - f * 260 * k + Math.sin(clock.value * 2 + i) * 6 * k;
      const r = (10 + f * 34 + hash(i, 2) * 10) * k;
      q.addCircle(dx, road - r * 0.4 - f * 20 * k, r);
    }
    for (let i = 0; i < 10; i += 1) {
      const dx = x - rig.len * 0.5 - i * 18 * k;
      q.addCircle(dx, road - (8 + i * 2) * k, (8 + i * 2.4) * k);
    }
    return q;
  });
  // egzoz dumanı
  const smoke = useDerivedValue(() => {
    const q = Skia.Path.Make();
    if (pos.value == null) return q;
    for (let i = 0; i < 6; i += 1) {
      const f = ((clock.value * 1.4 + i / 6) % 1 + 1) % 1;
      q.addCircle(34 * k - f * 50 * k, -70 * k - f * 30 * k, (3 + f * 9) * k);
    }
    return q;
  });
  return (
    <Group>
      <Group opacity={0.75}>
        <Path path={dust} color={c.dust} />
      </Group>
      <Group transform={carAt}>
        <Path path={car.dark} color={c.rigDark} />
        <Path path={car.body} color={c.rig} />
        <Path path={carTire} color={c.wheel} />
        <Path path={carHub} color={c.rig} />
        <Path path={flame} color={c.fire} />
        <Path path={flameCore} color={c.fireCore} />
      </Group>
      <Group transform={rigAt}>
        <Group opacity={0.5}>
          <Path path={smoke} color={c.stormDark} />
        </Group>
        <Path path={rig.tank} color={c.tank} />
        <Path path={rig.cab} color={c.rig} />
        <Path path={rig.dark} color={c.rigDark} />
        <Path path={rigTire} color={c.wheel} />
        <Path path={rigHub} color={c.rig} />
      </Group>
    </Group>
  );
}

function Lightning({ clock, L, c }) {
  const { k, width, base } = L;
  const bolt = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const slot = Math.floor(clock.value / 1.7);
    const ph = clock.value / 1.7 - slot;
    if (hash(slot, 7) > 0.55 || ph > 0.12) return q;
    let x = width * (0.05 + hash(slot, 8) * 0.45);
    let y = base - (360 - hash(slot, 9) * 80) * k;
    q.moveTo(x, y);
    for (let i = 0; i < 7; i += 1) {
      x += (hash(slot, i + 20) - 0.5) * 34 * k;
      y += (20 + hash(slot, i + 30) * 18) * k;
      q.lineTo(x, y);
    }
    return q;
  });
  const flash = useDerivedValue(() => {
    const slot = Math.floor(clock.value / 1.7);
    const ph = clock.value / 1.7 - slot;
    return hash(slot, 7) > 0.55 || ph > 0.12 ? 0 : (1 - ph / 0.12) * 0.5;
  });
  return (
    <Group>
      <Group opacity={flash} transform={[{ translateX: width * 0.28 }, { translateY: base - 260 * k }]}>
        <Glow r={200 * k} color={c.bolt} a={0.6} mid={0.3} />
      </Group>
      <Path path={bolt} style="stroke" strokeWidth={1.6 * k} strokeJoin="round" color={c.bolt} />
    </Group>
  );
}

// ───────────────────────────── olay B: Citadel su salar, kalabalık kollarını kaldırır

const OUTLETS = [
  [0.72, 250],
  [0.84, 300],
  [0.96, 230],
];

function WaterRelease({ p, clock, L, c }) {
  const { k, width, base } = L;
  const flow = useDerivedValue(() => {
    const u = eventU(p, clock.value, 1);
    return u > 1 ? 0 : sm(0.16, 0.3, u) * (1 - sm(0.7, 0.84, u));
  });
  const crowdO = useDerivedValue(() => {
    const u = eventU(p, clock.value, 1);
    return u > 1 ? 0 : sm(0.04, 0.16, u) * (1 - sm(0.86, 0.97, u));
  });
  const falls = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const f = flow.value;
    if (f < 0.01) return q;
    OUTLETS.forEach(([fx, h], i) => {
      const x = width * fx - 6 * k;
      const top = base - h * k * 0.58;
      const w0 = (3 + 3 * f) * k;
      const w1 = (6 + 12 * f) * k;
      const bot = top + (base - top) * Math.min(1, f * 1.4);
      const sway = Math.sin(clock.value * 2 + i) * 2 * k;
      q.moveTo(x - w0, top);
      q.lineTo(x + w0, top);
      q.quadTo(x + w0 + 3 * k * f, (top + bot) / 2, x + w1 + sway, bot);
      q.lineTo(x - w1 + sway, bot);
      q.quadTo(x - w0 - 2 * k * f, (top + bot) / 2, x - w0, top);
      q.close();
    });
    return q;
  });
  const streaks = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const f = flow.value;
    if (f < 0.05) return q;
    OUTLETS.forEach(([fx, h], i) => {
      const x = width * fx - 6 * k;
      const top = base - h * k * 0.58;
      for (let j = 0; j < 5; j += 1) {
        const ph = (((clock.value * 1.4 + j / 5 + i * 0.3) % 1) + 1) % 1;
        const y = top + ph * (base - top);
        const dx = (j - 2) * 3 * k * (0.4 + ph) * f;
        q.moveTo(x + dx, y);
        q.lineTo(x + dx * 1.2, y + 18 * k);
      }
    });
    return q;
  });
  const mist = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const f = flow.value;
    if (f < 0.01) return q;
    OUTLETS.forEach(([fx], i) => {
      for (let j = 0; j < 4; j += 1) {
        const ph = (((clock.value * 0.5 + j / 4 + i * 0.2) % 1) + 1) % 1;
        q.addCircle(width * fx - 6 * k + (j - 1.5) * 12 * k, base - ph * 26 * k, (10 + ph * 16) * k * f);
      }
    });
    return q;
  });
  const crowd = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const f = flow.value;
    for (let i = 0; i < 30; i += 1) {
      const x = width * (0.64 + 0.34 * hash(i, 51));
      const y = base + (4 + hash(i, 52) * 16) * k;
      const s = (0.8 + hash(i, 53) * 0.35) * k;
      const jump = f * Math.max(0, Math.sin(clock.value * 5 + i)) * 2 * s;
      q.addCircle(x, y - 13 * s - jump, 1.8 * s);
      q.addRect(Skia.XYWHRect(x - 1.6 * s, y - 11 * s - jump, 3.2 * s, 11 * s + jump));
      const arm = 3 + f * 7;
      q.addRect(Skia.XYWHRect(x - 3 * s, y - 10 * s - arm * s - jump, 1.1 * s, arm * s));
      q.addRect(Skia.XYWHRect(x + 1.9 * s, y - 10 * s - arm * s * (0.7 + 0.3 * hash(i, 54)) - jump, 1.1 * s, arm * s));
    }
    return q;
  });
  const fallO = useDerivedValue(() => 0.55 * Math.min(1, flow.value * 2));
  const mistO = useDerivedValue(() => 0.4 * flow.value);
  return (
    <Group>
      <Path path={falls} color={c.water} opacity={fallO} />
      <Path path={streaks} style="stroke" strokeWidth={1.1 * k} strokeCap="round" color={c.duneHi} opacity={fallO} />
      <Path path={mist} color={c.water} opacity={mistO} />
      <Group opacity={crowdO}>
        <Path path={crowd} color={c.rigDark} />
      </Group>
    </Group>
  );
}

export default function MadMaxScene({ p, clock, width, height, tone, lightSurface }) {
  const L = useMemo(() => mmLayout(width, height), [width, height]);
  const storm = useMemo(() => buildStorm(L), [L]);
  const cit = useMemo(() => buildCitadel(L), [L]);
  const desert = useMemo(() => buildDesert(L), [L]);
  const c = useMemo(() => toneMap(MM_TONE, tone.colors), [tone]);
  const { k, base } = L;
  const night = !lightSurface;
  const billow = useDerivedValue(() => [
    { translateX: Math.sin(clock.value * 0.25) * 8 * k },
    { translateY: Math.sin(clock.value * 0.31) * 4 * k },
  ]);
  const waterA = useDerivedValue(() => 0.45 + 0.2 * Math.sin(clock.value * 3));
  return (
    <Group opacity={tone.alpha}>
      {/* gök sıcaklığı */}
      <Rect x={0} y={base - 700 * k} width={width} height={700 * k}>
        <LinearGradient start={vec(0, base - 700 * k)} end={vec(0, base)} colors={[rgba(c.skyLow, 0), c.skyLow]} />
      </Rect>
      <Group transform={[{ translateX: width * 0.66 }, { translateY: base - 470 * k }]}>
        <Glow r={90 * k} color={c.sun} a={night ? 0.55 : 0.7} mid={0.45} />
      </Group>
      {/* kum fırtınası */}
      <Group transform={billow}>
        <Group opacity={0.88}>
          <Path path={storm.body}>
            <LinearGradient start={vec(0, storm.top)} end={vec(0, base)} colors={[c.storm, c.stormDark]} />
          </Path>
        </Group>
        <Path path={storm.dark} color={c.stormDark} opacity={0.7} />
        <Path path={storm.swirl} style="stroke" strokeWidth={2 * k} strokeCap="round" color={c.stormDark} opacity={0.45} />
      </Group>
      <Lightning clock={clock} L={L} c={c} />
      {/* masalar + Citadel */}
      <Path path={cit.mesas} color={c.mesa} />
      <Group opacity={waterA}>
        <Rect x={cit.waterX} y={cit.waterTop} width={14 * k} height={base - cit.waterTop}>
          <LinearGradient start={vec(0, cit.waterTop)} end={vec(0, base)} colors={[c.water, rgba(c.water, 0)]} />
        </Rect>
      </Group>
      <Path path={cit.rock} color={c.citadel} />
      <Path path={cit.dark} color={c.mesaDark} />
      <Path path={cit.garden} color={c.garden} />
      {/* çöl + yol */}
      <Rect x={0} y={base - 4 * k} width={width} height={L.height - base + 4 * k} color={c.mesa} />
      <Path path={desert.dune} color={c.dune} />
      <Path path={desert.duneHi} color={c.duneHi} opacity={0.6} />
      <Path path={desert.road} color={c.road} opacity={0.7} />
      <WaterRelease p={p} clock={clock} L={L} c={c} />
      <Convoy p={p} clock={clock} L={L} c={c} />
    </Group>
  );
}
