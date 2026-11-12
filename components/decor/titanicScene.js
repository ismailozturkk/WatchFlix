// components/decor/titanicScene.js
//
// Titanic evren sahnesi (OVERLAY.tiVec = 66) — tamamı VEKTÖR:
//   • Ay ve sakin, ayna gibi Kuzey Atlantik; ufukta pus.
//   • Ortada dört bacalı transatlantik: siyah gövde + kırmızı su hattı, beyaz üst yapı, filikalar,
//     direkler ve teller, satır satır yanan lomboz ve pencereler; ışıkları suya titrek çizgiler bırakır.
//   • Sağda buzdağı: suyun üstünde keskin, altında soluk büyük gövde.
//   • Olay (72 sn'de bir ~29 sn): ilk üç bacadan buhar yükselir, ışıklar daha parlak yanar, pruvada
//     kollarını iki yana açmış iki siluet belirir; gökten bir kayan yıldız geçer.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[66] (TI_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Group, LinearGradient, Path, Rect, Skia, vec } from "@shopify/react-native-skia";
import { restU } from "../../utils/weatherParticles";
import { Glow, groundLayout, hash, rgba, sm, toneMap } from "./seasonKit";

export const TI_TONE = [
  "haze",
  "moon",
  "sea",
  "seaHi",
  "hull",
  "band",
  "sup",
  "supShade",
  "funnel",
  "funnelTop",
  "mast",
  "light",
  "smoke",
  "ice",
  "iceShade",
  "iceUnder",
  "couple",
  "star",
];

export function tiLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  return { ...L, horizon: ground - 150 * k, line: ground - 44 * k };
}

// ───────────────────────────── gemi (su hattı y = 0, pruva solda)

function buildShip(k, width) {
  const u = Math.min(k, (width * 0.92) / 340);
  const hull = Skia.Path.Make();
  const band = Skia.Path.Make();
  const sup = Skia.Path.Make();
  const shade = Skia.Path.Make();
  const funnel = Skia.Path.Make();
  const funnelTop = Skia.Path.Make();
  const mast = Skia.Path.Make();
  const lights = Skia.Path.Make();
  hull.moveTo(-170 * u, -36 * u);
  hull.lineTo(-152 * u, 8 * u);
  hull.lineTo(150 * u, 8 * u);
  hull.quadTo(170 * u, 6 * u, 168 * u, -26 * u);
  hull.quadTo(0, -30 * u, -170 * u, -36 * u);
  hull.close();
  band.moveTo(-154 * u, 2 * u);
  band.lineTo(158 * u, 2 * u);
  band.lineTo(156 * u, 8 * u);
  band.lineTo(-152 * u, 8 * u);
  band.close();
  // üst yapı: iki kat + köprü
  sup.addRect(Skia.XYWHRect(-112 * u, -50 * u, 232 * u, 20 * u));
  sup.addRect(Skia.XYWHRect(-96 * u, -60 * u, 196 * u, 10 * u));
  sup.addRect(Skia.XYWHRect(-110 * u, -66 * u, 18 * u, 8 * u));
  shade.addRect(Skia.XYWHRect(-112 * u, -32 * u, 232 * u, 2 * u));
  shade.addRect(Skia.XYWHRect(-96 * u, -51 * u, 196 * u, 1.6 * u));
  // filikalar
  for (let i = 0; i < 10; i += 1) {
    const x = -90 * u + i * 19 * u;
    if (i === 4 || i === 5) continue;
    shade.addRRect(Skia.RRectXY(Skia.XYWHRect(x, -66 * u, 12 * u, 4 * u), 2 * u, 2 * u));
  }
  // bacalar: geriye eğik
  [-66, -22, 22, 66].forEach((fx) => {
    const x = fx * u;
    const w = 15 * u;
    const top = -118 * u;
    funnel.moveTo(x - w / 2, -60 * u);
    funnel.lineTo(x - w / 2 + 8 * u, top);
    funnel.lineTo(x + w / 2 + 8 * u, top);
    funnel.lineTo(x + w / 2, -60 * u);
    funnel.close();
    funnelTop.moveTo(x - w / 2 + 6.4 * u, top + 10 * u);
    funnelTop.lineTo(x - w / 2 + 8 * u, top);
    funnelTop.lineTo(x + w / 2 + 8 * u, top);
    funnelTop.lineTo(x + w / 2 + 6.4 * u, top + 10 * u);
    funnelTop.close();
  });
  // direkler + teller
  mast.addRect(Skia.XYWHRect(-132 * u, -150 * u, 2.4 * u, 116 * u));
  mast.addRect(Skia.XYWHRect(128 * u, -140 * u, 2.4 * u, 112 * u));
  const wires = Skia.Path.Make();
  wires.moveTo(-131 * u, -150 * u);
  wires.lineTo(129 * u, -140 * u);
  wires.moveTo(-131 * u, -150 * u);
  wires.lineTo(-170 * u, -36 * u);
  wires.moveTo(129 * u, -140 * u);
  wires.lineTo(166 * u, -28 * u);
  // ışıklar: lomboz sıraları + pencereler
  for (let r = 0; r < 2; r += 1)
    for (let i = 0; i < 44; i += 1) {
      if (hash(i, r + 3) < 0.25) continue;
      lights.addCircle(-146 * u + i * 6.8 * u, (-22 + r * 9) * u - (1 - i / 44) * 2 * u, 1.3 * u);
    }
  for (let r = 0; r < 2; r += 1)
    for (let i = 0; i < 30; i += 1) {
      if (hash(i, r + 9) < 0.3) continue;
      lights.addRect(Skia.XYWHRect(-106 * u + i * 7.6 * u, (-46 + r * 8) * u, 3.4 * u, 3 * u));
    }
  lights.addCircle(-131 * u, -150 * u, 1.8 * u);
  lights.addCircle(129 * u, -140 * u, 1.8 * u);
  return { u, hull, band, sup, shade, funnel, funnelTop, mast, wires, lights, funnels: [-66, -22, 22].map((f) => (f + 8) * u) };
}

function buildIce(L) {
  const { k, width } = L;
  const line = L.horizon + 26 * k; // uzakta, ufka yakın
  const ice = Skia.Path.Make();
  const shade = Skia.Path.Make();
  const under = Skia.Path.Make();
  const x = width * 0.9;
  const pts = [
    [-60, 0],
    [-44, -40],
    [-30, -52],
    [-18, -110],
    [-4, -86],
    [10, -132],
    [24, -96],
    [40, -70],
    [56, -34],
    [76, 0],
  ];
  ice.moveTo(x + pts[0][0] * k, line + pts[0][1] * k);
  pts.slice(1).forEach(([px, py]) => ice.lineTo(x + px * k, line + py * k));
  ice.close();
  shade.moveTo(x + 10 * k, line - 132 * k);
  shade.lineTo(x + 24 * k, line - 96 * k);
  shade.lineTo(x + 40 * k, line - 70 * k);
  shade.lineTo(x + 56 * k, line - 34 * k);
  shade.lineTo(x + 76 * k, line);
  shade.lineTo(x + 6 * k, line);
  shade.lineTo(x + 2 * k, line - 60 * k);
  shade.close();
  under.moveTo(x - 80 * k, line + 4 * k);
  under.quadTo(x - 120 * k, line + 90 * k, x - 20 * k, line + 160 * k);
  under.quadTo(x + 80 * k, line + 180 * k, x + 130 * k, line + 80 * k);
  under.lineTo(x + 96 * k, line + 4 * k);
  under.close();
  return { ice, shade, under, line };
}

function Ship({ p, clock, L, c, night }) {
  const { k, width, line } = L;
  const ship = useMemo(() => buildShip(k, width), [k, width]);
  const { u } = ship;
  const at = useDerivedValue(() => [
    { translateX: width * 0.46 },
    { translateY: line + Math.sin(clock.value * 0.7) * 1.2 * k },
    { rotate: Math.sin(clock.value * 0.5) * 0.006 },
  ]);
  const boost = useDerivedValue(() => {
    const e = restU(p, clock.value);
    return e > 1 ? 0 : sm(0.06, 0.2, e) * (1 - sm(0.82, 0.98, e));
  });
  const lightA = useDerivedValue(() => Math.min(1, (night ? 0.8 : 0.55) + boost.value * 0.2 + Math.sin(clock.value * 2.3) * 0.05));
  // baca buharı
  const smoke = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const b = boost.value;
    if (b < 0.02) return q;
    ship.funnels.forEach((fx, j) => {
      for (let i = 0; i < 7; i += 1) {
        const f = (((clock.value * 0.35 + i / 7 + j * 0.13) % 1) + 1) % 1;
        q.addCircle(fx + f * 60 * u, -122 * u - f * 70 * u, (5 + f * 16) * u * b);
      }
    });
    return q;
  });
  // pruvada kollarını açmış iki siluet
  const couple = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const b = boost.value;
    if (b < 0.3) return q;
    const s = sm(0.3, 0.8, b);
    const x = -160 * u;
    const y = -36 * u;
    // öndeki: kollar iki yana
    q.addCircle(x, y - 13 * u, 1.8 * u);
    q.addRect(Skia.XYWHRect(x - 1.4 * u, y - 11 * u, 2.8 * u, 11 * u));
    q.addRect(Skia.XYWHRect(x - 9 * u * s, y - 10 * u, 18 * u * s, 1.2 * u));
    // arkadaki: belinden tutar
    q.addCircle(x + 5 * u, y - 14 * u, 1.9 * u);
    q.addRect(Skia.XYWHRect(x + 3.6 * u, y - 12 * u, 3 * u, 12 * u));
    return q;
  });
  return (
    <Group transform={at}>
      <Path path={ship.wires} style="stroke" strokeWidth={0.7 * k} color={c.mast} />
      <Path path={ship.mast} color={c.mast} />
      <Group opacity={0.6}>
        <Path path={smoke} color={c.smoke} />
      </Group>
      <Path path={ship.funnel} color={c.funnel} />
      <Path path={ship.funnelTop} color={c.funnelTop} />
      <Path path={ship.sup} color={c.sup} />
      <Path path={ship.shade} color={c.supShade} />
      <Path path={ship.hull} color={c.hull} />
      <Path path={ship.band} color={c.band} />
      <Group opacity={lightA}>
        <Path path={ship.lights} color={c.light} />
      </Group>
      <Path path={couple} color={c.couple} />
    </Group>
  );
}

function Reflections({ clock, L, c, night }) {
  const { k, width, line } = L;
  const q = useDerivedValue(() => {
    const path = Skia.Path.Make();
    for (let i = 0; i < 40; i += 1) {
      const x = width * 0.46 + (hash(i, 1) - 0.5) * width * 0.8;
      const y = line + (10 + hash(i, 2) * 50) * k;
      const w = (4 + hash(i, 3) * 12) * k * (0.7 + 0.3 * Math.sin(clock.value * 2 + i));
      path.addRect(Skia.XYWHRect(x - w / 2 + Math.sin(clock.value * 1.4 + i) * 2 * k, y, w, 1.2 * k));
    }
    return path;
  });
  return <Path path={q} color={c.light} opacity={night ? 0.45 : 0.25} />;
}

function ShootingStar({ p, clock, L, c }) {
  const { k, width, horizon } = L;
  const q = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const u = restU(p, clock.value);
    if (u > 1 || u < 0.55 || u > 0.66) return path;
    const e = (u - 0.55) / 0.11;
    const x = width * (0.15 + e * 0.6);
    const y = horizon - 520 * k + e * 120 * k;
    path.moveTo(x, y);
    path.lineTo(x - 70 * k * (1 - e * 0.5), y - 14 * k * (1 - e * 0.5));
    return path;
  });
  return <Path path={q} style="stroke" strokeWidth={1.6 * k} strokeCap="round" color={c.star} />;
}

export default function TitanicScene({ p, clock, width, height, tone, lightSurface }) {
  const L = useMemo(() => tiLayout(width, height), [width, height]);
  const ice = useMemo(() => buildIce(L), [L]);
  const c = useMemo(() => toneMap(TI_TONE, tone.colors), [tone]);
  const { k, horizon } = L;
  const night = !lightSurface;
  const moon = useMemo(() => {
    const q = Skia.Path.Make();
    q.addCircle(width * 0.2, horizon - 420 * k, 26 * k);
    return q;
  }, [width, horizon, k]);
  return (
    <Group opacity={tone.alpha}>
      <Group transform={[{ translateX: width * 0.2 }, { translateY: horizon - 420 * k }]}>
        <Glow r={110 * k} color={c.moon} a={night ? 0.3 : 0.25} mid={0.3} />
      </Group>
      <Path path={moon} color={c.moon} />
      <ShootingStar p={p} clock={clock} L={L} c={c} />
      <Rect x={0} y={horizon - 180 * k} width={width} height={180 * k}>
        <LinearGradient start={vec(0, horizon - 180 * k)} end={vec(0, horizon)} colors={[rgba(c.haze, 0), c.haze]} />
      </Rect>
      {/* deniz */}
      <Rect x={0} y={horizon} width={width} height={L.height - horizon}>
        <LinearGradient start={vec(0, horizon)} end={vec(0, L.height)} colors={[c.seaHi, c.sea]} />
      </Rect>
      {/* su altı kütlesi derinlikte söner (düz renk leke gibi duruyordu) */}
      <Path path={ice.under}>
        <LinearGradient start={vec(0, ice.line)} end={vec(0, ice.line + 170 * k)} colors={[rgba(c.iceUnder, 0.42), rgba(c.iceUnder, 0)]} />
      </Path>
      <Path path={ice.ice} color={c.ice} />
      <Path path={ice.shade} color={c.iceShade} />
      <Reflections clock={clock} L={L} c={c} night={night} />
      <Ship p={p} clock={clock} L={L} c={c} night={night} />
    </Group>
  );
}
