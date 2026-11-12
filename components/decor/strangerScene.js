// components/decor/strangerScene.js
//
// Stranger Things evren sahnesi (OVERLAY.stVec = 56) — tamamı VEKTÖR:
//   • 80'ler banliyösü, gece: bulutlu gökte ay, arkada sık çam ormanı ve su kulesi; önde üç ahşap ev
//     (üçgen çatı, veranda, ışıklı pencereler). Ortadaki evin saçağında renkli yılbaşı ışıkları sırayla
//     yanıp söner. Sokak lambası, asfalt yol.
//   • Olay (68 sn'de bir ~26 sn):
//       1) üç çocuk bisikletle, farları yolu tarayarak soldan sağa geçer (pedallar döner);
//       2) "öbür taraf": gök kızıla döner, bulutların içinde kızıl şimşek yumuşakça parlar, ev ışıkları
//          hızlanıp titrer, evlerin duvarına koyu sarmaşıklar yerden tırmanır; sonra her şey söner.
//   Işığa duyarlılık: parlamalar yumuşak zarflı, saniyede 3'ten az.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[56] (ST_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Circle, Group, LinearGradient, Path, Rect, Skia, vec } from "@shopify/react-native-skia";
import { restU } from "../../utils/weatherParticles";
import { Glow, TAU, addCloud, addPine, groundLayout, hash, rgba, sm, toneMap } from "./seasonKit";

export const ST_TONE = [
  "moon",
  "cloud",
  "forest",
  "forestNear",
  "house",
  "houseSide",
  "roof",
  "window",
  "porch",
  "road",
  "lamp",
  "lampGlow",
  "l1",
  "l2",
  "l3",
  "l4",
  "wire",
  "bike",
  "beam",
  "upside",
  "upsideGlow",
  "vine",
  "lightning",
  "line",
];

export function stLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  return {
    ...L,
    base: ground - 6 * k,
    road: ground + 14 * k,
    moon: [width * 0.78, height * 0.12, 22 * k],
    lamp: width * 0.62,
    houses: [
      [width * 0.02, 108 * k, 78 * k],
      [width * 0.33, 128 * k, 94 * k],
      [width * 0.72, 112 * k, 80 * k],
    ],
  };
}

// ───────────────────────────── durağan yollar

function buildForest(L) {
  const { k, width, base } = L;
  const far = Skia.Path.Make();
  const near = Skia.Path.Make();
  for (let i = 0; i < 26; i += 1) {
    const x = (i / 25) * (width + 40 * k) - 20 * k;
    const h = (110 + hash(i, 1) * 70) * k;
    addPine(far, x, base - 40 * k, h, (34 + hash(i, 2) * 16) * k, 5);
  }
  for (let i = 0; i < 16; i += 1) {
    const x = (i / 15) * (width + 30 * k) - 15 * k + hash(i, 5) * 10 * k;
    const h = (80 + hash(i, 6) * 60) * k;
    addPine(near, x, base - 16 * k, h, (30 + hash(i, 7) * 14) * k, 4);
  }
  // su kulesi
  const tx = width * 0.14;
  const tb = base - 70 * k;
  near.addRect(Skia.XYWHRect(tx - 22 * k, tb - 132 * k, 44 * k, 26 * k));
  near.moveTo(tx - 24 * k, tb - 132 * k);
  near.lineTo(tx, tb - 146 * k);
  near.lineTo(tx + 24 * k, tb - 132 * k);
  near.close();
  [-16, -5, 5, 16].forEach((o) => near.addRect(Skia.XYWHRect(tx + o * k - 1.2 * k, tb - 106 * k, 2.4 * k, 110 * k)));
  near.addRect(Skia.XYWHRect(tx - 18 * k, tb - 60 * k, 36 * k, 1.6 * k));
  return { far, near };
}

function buildHouses(L) {
  const { k, base } = L;
  const front = Skia.Path.Make();
  const side = Skia.Path.Make();
  const roof = Skia.Path.Make();
  const lit = Skia.Path.Make();
  const porch = Skia.Path.Make();
  const lines = Skia.Path.Make();
  const eaves = [];
  L.houses.forEach(([x, w, h], i) => {
    const wallTop = base - h;
    front.addRect(Skia.XYWHRect(x, wallTop, w, h));
    side.addRect(Skia.XYWHRect(x + w * 0.62, wallTop, w * 0.38, h));
    // üçgen çatı (sağ kanatta ikinci, alçak çatı)
    roof.moveTo(x - 8 * k, wallTop + 2 * k);
    roof.lineTo(x + w * 0.31, wallTop - h * 0.5);
    roof.lineTo(x + w * 0.62 + 8 * k, wallTop + 2 * k);
    roof.close();
    roof.moveTo(x + w * 0.58, wallTop + 2 * k);
    roof.lineTo(x + w * 0.62, wallTop - h * 0.18);
    roof.lineTo(x + w + 6 * k, wallTop - h * 0.18);
    roof.lineTo(x + w + 8 * k, wallTop + 2 * k);
    roof.close();
    roof.addRect(Skia.XYWHRect(x + w * 0.8, wallTop - h * 0.36, 9 * k, h * 0.2)); // baca
    eaves.push([x - 8 * k, wallTop + 2 * k, x + w * 0.31, wallTop - h * 0.5, x + w * 0.62 + 8 * k]);
    // yatay tahta çizgileri
    for (let y = wallTop + 8 * k; y < base - 2 * k; y += 7 * k) lines.addRect(Skia.XYWHRect(x, y, w, 0.7 * k));
    // pencereler: üst kat çatı üçgeninde 1, alt katta 2 + yan kanatta 1
    const win = (wx, wy, ww, wh, on) => {
      (on ? lit : porch).addRect(Skia.XYWHRect(wx, wy, ww, wh));
      lines.addRect(Skia.XYWHRect(wx + ww / 2 - 0.6 * k, wy, 1.2 * k, wh));
      lines.addRect(Skia.XYWHRect(wx, wy + wh / 2 - 0.6 * k, ww, 1.2 * k));
    };
    win(x + w * 0.31 - 7 * k, wallTop - h * 0.26, 14 * k, 14 * k, i !== 2);
    win(x + w * 0.08, wallTop + h * 0.28, 16 * k, 20 * k, true);
    win(x + w * 0.38, wallTop + h * 0.28, 16 * k, 20 * k, hash(i, 3) > 0.4);
    win(x + w * 0.74, wallTop + h * 0.3, 14 * k, 18 * k, i === 1);
    // veranda: çatı şeridi + direkler + basamak
    porch.addRect(Skia.XYWHRect(x - 4 * k, base - h * 0.42, w * 0.66, 4 * k));
    [0, 0.3, 0.6].forEach((f) => porch.addRect(Skia.XYWHRect(x + f * w, base - h * 0.42, 2.4 * k, h * 0.42)));
    porch.addRect(Skia.XYWHRect(x + w * 0.22, base - 4 * k, 20 * k, 4 * k));
    // kapı
    porch.addRect(Skia.XYWHRect(x + w * 0.24, base - h * 0.34, 14 * k, h * 0.34 - 4 * k));
  });
  return { front, side, roof, lit, porch, lines, eaves };
}

/** Ortadaki evin saçağında 4 renk ampul dizisi + tel. */
function buildLights(L, eave) {
  const { k } = L;
  const [x0, y0, xm, ym, x1] = eave;
  const wire = Skia.Path.Make();
  const bulbs = [Skia.Path.Make(), Skia.Path.Make(), Skia.Path.Make(), Skia.Path.Make()];
  const halos = [Skia.Path.Make(), Skia.Path.Make(), Skia.Path.Make(), Skia.Path.Make()];
  const pts = [];
  const n = 22;
  for (let i = 0; i <= n; i += 1) {
    const f = i / n;
    const x = f < 0.5 ? x0 + (xm - x0) * (f * 2) : xm + (x1 - xm) * ((f - 0.5) * 2);
    const yLine = f < 0.5 ? y0 + (ym - y0) * (f * 2) : ym + (y0 - ym) * ((f - 0.5) * 2);
    const sag = Math.sin((f * n) % 1 * Math.PI) * 2 * k;
    pts.push([x, yLine + 3 * k + sag]);
  }
  pts.forEach(([x, y], i) => {
    if (i === 0) wire.moveTo(x, y);
    else wire.lineTo(x, y);
    bulbs[i % 4].addOval(Skia.XYWHRect(x - 2.3 * k, y + 0.5 * k, 4.6 * k, 5.8 * k));
    halos[i % 4].addCircle(x, y + 3.4 * k, 6.5 * k);
  });
  return { wire, bulbs, halos, pts };
}

function buildVines(L) {
  const { k, base } = L;
  const vines = Skia.Path.Make();
  const tips = Skia.Path.Make();
  L.houses.forEach(([x, w, h], i) => {
    for (let j = 0; j < 3; j += 1) {
      const seed = i * 7 + j;
      let vx = x + (0.12 + 0.36 * j + hash(seed, 2) * 0.12) * w;
      let vy = base;
      const top = base - h * (0.55 + hash(seed, 3) * 0.55);
      const lean = (hash(seed, 4) - 0.5) * 0.5;
      vines.moveTo(vx, vy);
      let step = 0;
      while (vy > top) {
        const ny = vy - (16 + hash(seed, step) * 10) * k;
        const nx = vx + (lean * 10 + (hash(seed, step + 9) - 0.5) * 9) * k;
        vines.cubicTo(vx + (hash(seed, step + 3) - 0.5) * 14 * k, vy - 6 * k, nx - (hash(seed, step + 5) - 0.5) * 14 * k, ny + 6 * k, nx, ny);
        // yan dal: kısa, kıvrık uçlu
        if (step % 2 === 1) {
          const sd = hash(seed, step + 11) > 0.5 ? 1 : -1;
          vines.moveTo(nx, ny);
          vines.quadTo(nx + sd * 9 * k, ny - 4 * k, nx + sd * 15 * k, ny + 2 * k);
          tips.addCircle(nx + sd * 15 * k, ny + 2 * k, 1.6 * k);
          vines.moveTo(nx, ny);
        }
        vx = nx;
        vy = ny;
        step += 1;
      }
      tips.addCircle(vx, vy, 2 * k);
    }
  });
  return { vines, tips };
}

// ───────────────────────────── hareketli parçalar

function bikePath(t, k) {
  "worklet";
  const q = Skia.Path.Make();
  const r = 6.5 * k;
  q.addCircle(-11 * k, -r, r);
  q.addCircle(11 * k, -r, r);
  // kadro
  q.moveTo(-11 * k, -r);
  q.lineTo(-2 * k, -r);
  q.lineTo(5 * k, -16 * k);
  q.lineTo(-5 * k, -16 * k);
  q.lineTo(-2 * k, -r);
  q.moveTo(11 * k, -r);
  q.lineTo(6 * k, -19 * k);
  q.lineTo(9 * k, -20 * k); // gidon
  q.moveTo(-5 * k, -16 * k);
  q.lineTo(-6 * k, -18 * k); // sele
  // bacaklar (pedal dönüşü)
  const a = t * 9;
  const px = -2 * k + Math.cos(a) * 3.4 * k;
  const py = -r + Math.sin(a) * 3.4 * k;
  const px2 = -2 * k - Math.cos(a) * 3.4 * k;
  const py2 = -r - Math.sin(a) * 3.4 * k;
  q.moveTo(-4 * k, -22 * k);
  q.lineTo((-4 * k + px) / 2 + 3 * k, (-22 * k + py) / 2 - 2 * k);
  q.lineTo(px, py);
  q.moveTo(-4 * k, -22 * k);
  q.lineTo((-4 * k + px2) / 2 + 3 * k, (-22 * k + py2) / 2 - 2 * k);
  q.lineTo(px2, py2);
  // gövde + kollar
  q.moveTo(-4 * k, -22 * k);
  q.lineTo(1 * k, -33 * k);
  q.lineTo(8 * k, -20 * k);
  return q;
}

function Bikes({ p, clock, L, c }) {
  const { k, width } = L;
  const frame = useDerivedValue(() => bikePath(clock.value, k));
  const riders = [0, 1, 2].map((i) => i);
  return (
    <Group>
      {riders.map((i) => (
        <Bike key={i} i={i} p={p} clock={clock} L={L} c={c} frame={frame} width={width} k={k} />
      ))}
    </Group>
  );
}

function Bike({ i, p, clock, L, c, frame, width, k }) {
  const at = useDerivedValue(() => {
    const u = restU(p, clock.value);
    const e = u > 1 ? -1 : (u - 0.04 - i * 0.035) / 0.34;
    if (e < 0 || e > 1) return [{ translateX: -900 }, { translateY: -900 }];
    const x = -60 * k + (width + 140 * k) * e;
    return [{ translateX: x }, { translateY: L.road + i * 2 * k + Math.sin(clock.value * 7 + i) * 0.5 * k }];
  });
  return (
    <Group transform={at}>
      <Path
        path={`M ${10 * k} ${-17 * k} L ${120 * k} ${-26 * k} L ${120 * k} ${6 * k} Z`}
      >
        <LinearGradient start={vec(10 * k, 0)} end={vec(120 * k, 0)} colors={[c.beam, "rgba(255,255,255,0)"]} />
      </Path>
      <Glow cx={10 * k} cy={-17 * k} r={7 * k} color={c.beam} a={0.95} mid={0.35} />
      <Path path={frame} style="stroke" strokeWidth={1.8 * k} strokeCap="round" strokeJoin="round" color={c.bike} />
      <Circle cx={1.5 * k} cy={-36 * k} r={4 * k} color={c.bike} />
    </Group>
  );
}

/** Upside Down zarfı (0–1): olayın ikinci yarısı. */
const upAmt = (u) => {
  "worklet";
  return u > 1 ? 0 : sm(0.42, 0.52, u) * (1 - sm(0.84, 0.96, u));
};

function Lightning({ p, clock, L, c }) {
  const { k, width } = L;
  const spots = [
    [width * 0.22, L.height * 0.14],
    [width * 0.7, L.height * 0.08],
    [width * 0.48, L.height * 0.2],
  ];
  return (
    <Group>
      {spots.map(([x, y], i) => (
        <Flash key={i} i={i} x={x} y={y} p={p} clock={clock} c={c} k={k} />
      ))}
    </Group>
  );
}

function Flash({ i, x, y, p, clock, c, k }) {
  const a = useDerivedValue(() => {
    const up = upAmt(restU(p, clock.value));
    // yumuşak tepe: her nokta ~3,7 sn'de bir, kısa ama sert olmayan zarf
    const s = Math.sin(clock.value * 1.7 + i * 2.1);
    return up * Math.pow(Math.max(0, s), 10);
  });
  return (
    <Group opacity={a}>
      <Glow cx={x} cy={y} r={90 * k} color={c.lightning} a={0.75} mid={0.3} />
    </Group>
  );
}

/** Tek renk ampul grubu: 4 renk sırayla yanar; öbür tarafta hızlanır (en çok ~2,5 Hz, yumuşak). */
function Bulbs({ j, path, halo, color, clock, up }) {
  // İki SABİT hızlı salınımın karışımı: saat cihaz zaman damgası (çok büyük) olduğundan
  // t × (değişken hız) fazı sıçratır (aurora hatası); hız yerine karışım oranı değişir.
  const a = useDerivedValue(() => {
    const ph = j * (TAU / 4);
    const slow = Math.max(0, Math.sin(clock.value * 1.6 - ph));
    const fast = Math.max(0, Math.sin(clock.value * 9.1 - ph));
    const m = up.value;
    return 0.3 + 0.7 * (slow * (1 - m) + fast * m);
  });
  return (
    <Group opacity={a}>
      <Path path={halo} color={color} opacity={0.28} />
      <Path path={path} color={color} />
    </Group>
  );
}

export default function StrangerScene({ p, clock, width, height, tone, lightSurface }) {
  const L = useMemo(() => stLayout(width, height), [width, height]);
  const forest = useMemo(() => buildForest(L), [L]);
  const houses = useMemo(() => buildHouses(L), [L]);
  const lights = useMemo(() => buildLights(L, houses.eaves[1]), [L, houses]);
  const vines = useMemo(() => buildVines(L), [L]);
  const clouds = useMemo(() => {
    const q = Skia.Path.Make();
    addCloud(q, width * 0.25, height * 0.12, 190 * L.k, 20 * L.k, 4);
    addCloud(q, width * 0.72, height * 0.07, 150 * L.k, 16 * L.k, 9);
    addCloud(q, width * 0.5, height * 0.2, 130 * L.k, 13 * L.k, 2);
    return q;
  }, [L, width, height]);
  const c = useMemo(() => toneMap(ST_TONE, tone.colors), [tone]);
  const { k, ground, base } = L;
  const night = !lightSurface;
  const [mx, my, mr] = L.moon;
  const up = useDerivedValue(() => upAmt(restU(p, clock.value)));
  const notUp = useDerivedValue(() => 1 - up.value * 0.85);
  const winA = useDerivedValue(() => {
    const w = 0.85 + 0.08 * Math.sin(clock.value * 2.1);
    return w * (1 - up.value * 0.5 * (0.5 + 0.5 * Math.sin(clock.value * 13)));
  });
  const vineGrow = useDerivedValue(() => {
    const u = restU(p, clock.value);
    const g = u > 1 ? 0 : sm(0.5, 0.72, u) * (1 - sm(0.86, 0.97, u));
    return [{ translateY: base }, { scaleY: Math.max(0.001, g) }, { translateY: -base }];
  });
  const vineA = useDerivedValue(() => (up.value > 0.01 ? 1 : 0));
  const lampA = useDerivedValue(() => (0.85 + 0.1 * Math.sin(clock.value * 3.1)) * (1 - up.value * 0.6 * (0.5 + 0.5 * Math.sin(clock.value * 11))));
  return (
    <Group opacity={tone.alpha}>
      {/* gök: ay, bulutlar; öbür tarafta kızıl örtü */}
      <Group opacity={notUp}>
        <Glow cx={mx} cy={my} r={110 * k} color={c.moon} a={night ? 0.22 : 0.3} mid={0.3} />
        <Circle cx={mx} cy={my} r={mr} color={c.moon} />
      </Group>
      <Group opacity={up}>
        <Rect x={0} y={0} width={width} height={ground}>
          <LinearGradient start={vec(0, 0)} end={vec(0, ground)} colors={[c.upside, rgba(c.upside, 0)]} />
        </Rect>
        <Glow cx={mx} cy={my} r={110 * k} color={c.upsideGlow} a={0.4} mid={0.3} />
      </Group>
      <Lightning p={p} clock={clock} L={L} c={c} />
      <Path path={clouds} color={c.cloud} opacity={night ? 0.7 : 0.85} />
      <Group opacity={up}>
        <Path path={clouds} color={c.upside} opacity={0.6} />
      </Group>
      {/* orman ve su kulesi */}
      <Path path={forest.far} color={c.forest} />
      <Path path={forest.near} color={c.forestNear} />
      {/* evler */}
      <Path path={houses.roof} color={c.roof} />
      <Path path={houses.front} color={c.house} />
      <Path path={houses.side} color={c.houseSide} opacity={0.6} />
      <Path path={houses.lines} color={c.line} opacity={0.35} />
      <Group opacity={winA}>
        <Path path={houses.lit} color={c.window} />
      </Group>
      <Path path={houses.porch} color={c.porch} />
      {/* yılbaşı ışıkları */}
      <Path path={lights.wire} style="stroke" strokeWidth={0.9 * k} color={c.wire} />
      {[c.l1, c.l2, c.l3, c.l4].map((col, j) => (
        <Bulbs key={j} j={j} path={lights.bulbs[j]} halo={lights.halos[j]} color={col} clock={clock} up={up} />
      ))}
      {/* sarmaşıklar */}
      <Group opacity={vineA} transform={vineGrow}>
        <Path path={vines.vines} style="stroke" strokeWidth={1.6 * k} strokeCap="round" color={c.vine} />
        <Path path={vines.tips} color={c.vine} />
      </Group>
      {/* yol + lamba */}
      <Rect x={0} y={base} width={width} height={height - base}>
        <LinearGradient start={vec(0, base)} end={vec(0, height)} colors={[c.road, c.forestNear]} />
      </Rect>
      <Rect x={0} y={L.road + 3 * k} width={width} height={1.2 * k} color={c.line} opacity={0.4} />
      <Rect x={L.lamp - 1.4 * k} y={base - 92 * k} width={2.8 * k} height={92 * k} color={c.porch} />
      <Rect x={L.lamp - 1.4 * k} y={base - 92 * k} width={14 * k} height={2.4 * k} color={c.porch} />
      <Group opacity={lampA}>
        <Path
          path={`M ${L.lamp + 9 * k} ${base - 88 * k} L ${L.lamp + 15 * k} ${base - 88 * k} L ${L.lamp + 50 * k} ${base + 4 * k} L ${L.lamp - 26 * k} ${base + 4 * k} Z`}
        >
          <LinearGradient start={vec(0, base - 88 * k)} end={vec(0, base)} colors={[c.lampGlow, rgba(c.lampGlow, 0)]} />
        </Path>
        <Glow cx={L.lamp + 12 * k} cy={base - 88 * k} r={26 * k} color={c.lampGlow} a={0.85} mid={0.3} />
        <Circle cx={L.lamp + 12 * k} cy={base - 88 * k} r={2.6 * k} color={c.lamp} />
      </Group>
      <Bikes p={p} clock={clock} L={L} c={c} />
      {/* öbür taraf: zemin pusu */}
      <Group opacity={up}>
        <Rect x={0} y={base - 30 * k} width={width} height={height - base + 30 * k}>
          <LinearGradient start={vec(0, base - 30 * k)} end={vec(0, height)} colors={[rgba(c.upside, 0), c.upside]} />
        </Rect>
      </Group>
    </Group>
  );
}
