// components/decor/bttfScene.js
//
// Geleceğe Dönüş evren sahnesi (OVERLAY.btVec = 71) — tamamı VEKTÖR:
//   • Fırtınalı gece, kasaba meydanı: sütunlu adliye binası, ortasında saat kulesi (akrep-yelkovan
//     10:04'te donmuş), tepede paratoner; kuleden sağdaki fenere sarkan kablo; yol, kaldırım, ağaçlar.
//   • Bulutlar yavaşça akar; pencereler ve fenerler sıcak yanar.
//   • İKİ olay (döngüde sırayla, eventPick):
//       A) Yıldırım saat kulesine düşer → kadran parlar, elektrik kablodan fenere iner; tam o anda
//          soldan hızlanan paslanmaz çelik spor araba fenerin altında mavi bir parıltıyla kaybolur,
//          yolda iki ATEŞ İZİ kalır ve yavaşça söner.
//       B) Araba tekerlekleri yere paralel katlanmış, altında mavi itici ışıklarla gökten süzülür,
//          kulenin üstünde mavi kıvılcımlarla sarılıp kaybolur; arkasında iki kısa ateş izi kalır.
//
// Işığa duyarlılık: tek yıldırım (avuç içi kadar alanda yumuşak parlama), kıvılcımlar küçük.
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[71] (BT_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Group, Path, Rect, Skia } from "@shopify/react-native-skia";
import { eventPick, restU } from "../../utils/weatherParticles";
import { Glow, addCloud, addRoundTree, groundLayout, hash, rgba, sm, toneMap } from "./seasonKit";
import { addFlame, addStars } from "./universeKit";

export const BT_TONE = [
  "cloud",
  "cloudLit",
  "star",
  "build",
  "buildShade",
  "column",
  "roof",
  "window",
  "tower",
  "clock",
  "hand",
  "tree",
  "street",
  "curb",
  "lamp",
  "wire",
  "bolt",
  "car",
  "carHi",
  "carDark",
  "fire",
  "fireCore",
  "blue",
  "line",
];

export function btLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  const u = Math.min(k, (width * 0.8) / 264);
  const curbY = ground - 34 * k; // kaldırım kenarı = binaların tabanı
  const roadY = ground - 26 * k; // asfalt başlangıcı
  const carY = ground - 6 * k; // tekerlek tabanı
  const cx = width * 0.5;
  const roofY = curbY - 96 * u;
  const towerTop = roofY - 74 * u;
  const rodTop = towerTop - 46 * u;
  const hookX = width * 0.94;
  const hookY = curbY - 104 * k;
  return { ...L, u, curbY, roadY, carY, cx, roofY, towerTop, rodTop, clockY: roofY - 36 * u, hookX, hookY };
}

// ───────────────────────────── statik: adliye + kule

function buildTown(L) {
  const { u, k, cx, curbY, roofY, towerTop, rodTop, width, hookX, hookY } = L;
  const build = Skia.Path.Make();
  const shade = Skia.Path.Make();
  const column = Skia.Path.Make();
  const roof = Skia.Path.Make();
  const windows = Skia.Path.Make();
  const tower = Skia.Path.Make();
  const clock = Skia.Path.Make();
  const hands = Skia.Path.Make();
  const trees = Skia.Path.Make();
  const lamps = Skia.Path.Make();
  const lampLights = [];
  const wire = Skia.Path.Make();
  const W = 132 * u; // yarı genişlik
  // gövde: iki kat + saçak
  build.addRect(Skia.XYWHRect(cx - W, roofY, W * 2, curbY - roofY));
  shade.addRect(Skia.XYWHRect(cx - W, roofY + 44 * u, W * 2, 3 * u)); // kat silmesi
  shade.addRect(Skia.XYWHRect(cx - W - 3 * u, curbY - 6 * u, W * 2 + 6 * u, 6 * u)); // kaide
  roof.addRect(Skia.XYWHRect(cx - W - 6 * u, roofY - 6 * u, W * 2 + 12 * u, 6 * u)); // korniş
  // balüstrad çizgisi (çatı korkuluğu)
  for (let i = 0; i <= 30; i += 1) roof.addRect(Skia.XYWHRect(cx - W + (i * W * 2) / 30 - 1 * u, roofY - 13 * u, 2 * u, 7 * u));
  roof.addRect(Skia.XYWHRect(cx - W - 2 * u, roofY - 15 * u, W * 2 + 4 * u, 2.4 * u));
  // pencereler: iki kat × kanatlarda 4'er (ortada revak)
  for (let r = 0; r < 2; r += 1)
    for (let i = 0; i < 10; i += 1) {
      const side = i < 5 ? -1 : 1;
      const j = i % 5;
      const x = cx + side * (52 * u + j * 19 * u) - (side < 0 ? 10 * u : 0);
      if (Math.abs(x - cx) > W - 12 * u) continue;
      const y = roofY + 12 * u + r * 44 * u;
      if (hash(i, r + 5) < 0.2) shade.addRect(Skia.XYWHRect(x, y, 10 * u, 22 * u));
      else windows.addRRect(Skia.RRectXY(Skia.XYWHRect(x, y, 10 * u, 22 * u), 5 * u, 5 * u));
    }
  // revak: alınlık + 4 sütun + kapı
  const pw = 42 * u;
  roof.moveTo(cx - pw - 6 * u, roofY + 4 * u);
  roof.lineTo(cx, roofY - 20 * u);
  roof.lineTo(cx + pw + 6 * u, roofY + 4 * u);
  roof.close();
  for (let i = 0; i < 4; i += 1) {
    const x = cx - pw + (i * pw * 2) / 3;
    column.addRect(Skia.XYWHRect(x - 3.4 * u, roofY + 6 * u, 6.8 * u, curbY - roofY - 12 * u));
    column.addRect(Skia.XYWHRect(x - 5 * u, roofY + 4 * u, 10 * u, 3 * u));
    column.addRect(Skia.XYWHRect(x - 5 * u, curbY - 9 * u, 10 * u, 3 * u));
  }
  shade.addRRect(Skia.RRectXY(Skia.XYWHRect(cx - 9 * u, curbY - 34 * u, 18 * u, 28 * u), 8 * u, 8 * u));
  windows.addRect(Skia.XYWHRect(cx - 6 * u, curbY - 30 * u, 12 * u, 2 * u)); // kapı üstü ışık
  // basamaklar
  for (let i = 0; i < 3; i += 1) shade.addRect(Skia.XYWHRect(cx - pw - 4 * u - i * 4 * u, curbY - 3 * u + i * 2 * u, (pw + 4 * u + i * 4 * u) * 2, 1.4 * u));
  // saat kulesi
  const tw = 24 * u;
  tower.addRect(Skia.XYWHRect(cx - tw, towerTop, tw * 2, roofY - towerTop - 14 * u));
  tower.addRect(Skia.XYWHRect(cx - tw - 3 * u, towerTop - 4 * u, tw * 2 + 6 * u, 4 * u));
  // kubbe + fener + paratoner
  tower.moveTo(cx - tw + 2 * u, towerTop - 4 * u);
  tower.quadTo(cx - tw + 4 * u, towerTop - 30 * u, cx, towerTop - 32 * u);
  tower.quadTo(cx + tw - 4 * u, towerTop - 30 * u, cx + tw - 2 * u, towerTop - 4 * u);
  tower.close();
  tower.addRect(Skia.XYWHRect(cx - 4 * u, towerTop - 40 * u, 8 * u, 9 * u));
  tower.addRect(Skia.XYWHRect(cx - 0.8 * u, rodTop, 1.6 * u, towerTop - 40 * u - rodTop));
  // kulenin köşe pilastrları
  shade.addRect(Skia.XYWHRect(cx - tw, towerTop, 4 * u, roofY - towerTop - 14 * u));
  shade.addRect(Skia.XYWHRect(cx + tw - 4 * u, towerTop, 4 * u, roofY - towerTop - 14 * u));
  // kadran + 10:04 (donmuş saat)
  const cy = L.clockY;
  const R = 15 * u;
  clock.addCircle(cx, cy, R);
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    hands.addCircle(cx + Math.sin(a) * R * 0.82, cy - Math.cos(a) * R * 0.82, 0.9 * u);
  }
  const hand = (ang, len, w) => {
    const sx = Math.sin(ang);
    const sy = -Math.cos(ang);
    hands.moveTo(cx - sy * w, cy + sx * w);
    hands.lineTo(cx + sx * len, cy + sy * len);
    hands.lineTo(cx + sy * w, cy - sx * w);
    hands.close();
  };
  hand(((10 + 4 / 60) / 12) * Math.PI * 2, R * 0.52, 1.4 * u);
  hand((4 / 60) * Math.PI * 2, R * 0.8, 1 * u);
  hands.addCircle(cx, cy, 1.6 * u);
  // ağaçlar (binanın iki yanı, kaldırımda)
  [
    [cx - W - 30 * k, 78],
    [cx - W + 14 * k, 64],
    [cx + W - 10 * k, 66],
    [cx + W + 34 * k, 82],
    [width * 0.04, 70],
  ].forEach(([x, h], i) => addRoundTree(trees, x, curbY, h * k, i + 2));
  // fenerler: kaldırım boyunca; en sağdaki kablonun bağlandığı yüksek direk
  [width * 0.14, width * 0.36, width * 0.64, hookX].forEach((x, i) => {
    const big = i === 3;
    const h = big ? curbY - hookY : 52 * k;
    lamps.addRect(Skia.XYWHRect(x - 1.4 * k, curbY - h, 2.8 * k, h));
    lamps.addRect(Skia.XYWHRect(x - 3 * k, curbY - 4 * k, 6 * k, 4 * k));
    if (big) {
      lamps.addRect(Skia.XYWHRect(x - 9 * k, curbY - h, 18 * k, 2 * k)); // kanca kolu
      lampLights.push([x - 8 * k, curbY - h + 8 * k]);
    } else {
      lamps.addRRect(Skia.RRectXY(Skia.XYWHRect(x - 4 * k, curbY - h - 9 * k, 8 * k, 10 * k), 2 * k, 2 * k));
      lampLights.push([x, curbY - h - 4 * k]);
    }
  });
  // kablo: kule kadranının altından fenere sarkar
  const wx0 = cx + tw;
  const wy0 = cy + 18 * u;
  wire.moveTo(wx0, wy0);
  wire.quadTo((wx0 + hookX) / 2, Math.max(wy0, hookY) + 40 * k, hookX - 9 * k, hookY);
  const lampGlow = Skia.Path.Make();
  lampLights.slice(0, 3).forEach(([x, y]) => lampGlow.addCircle(x, y, 2.6 * k));
  return { build, shade, column, roof, windows, tower, clock, hands, trees, lamps, wire, lampGlow, lampLights, wire0: [wx0, wy0] };
}

function buildSky(L) {
  const { width, k, roofY } = L;
  const stars = Skia.Path.Make();
  addStars(stars, width, 30 * k, roofY - 120 * k, 50, 13, k);
  const clouds = [];
  for (let i = 0; i < 6; i += 1) {
    const q = Skia.Path.Make();
    addCloud(q, 0, 0, (130 + hash(i, 3) * 120) * k, (34 + hash(i, 4) * 20) * k, i + 7);
    clouds.push({ q, x: hash(i, 5) * (width + 260 * k), y: roofY - (150 + hash(i, 6) * 260) * k, v: (5 + hash(i, 8) * 5) * k });
  }
  return { stars, clouds };
}

// ───────────────────────────── araba (yan görünüş, burun sağda; taban y = 0)

function buildCar(s) {
  const body = Skia.Path.Make();
  const hi = Skia.Path.Make();
  const dark = Skia.Path.Make();
  body.moveTo(-32 * s, -5 * s);
  body.lineTo(-31 * s, -12 * s);
  body.lineTo(-8 * s, -15 * s);
  body.lineTo(5 * s, -15 * s);
  body.lineTo(17 * s, -9.5 * s);
  body.lineTo(32 * s, -7 * s);
  body.lineTo(33 * s, -3 * s);
  body.lineTo(-33 * s, -3 * s);
  body.close();
  hi.moveTo(-30 * s, -11.6 * s);
  hi.lineTo(31 * s, -6.8 * s);
  hi.lineTo(31 * s, -6 * s);
  hi.lineTo(-30 * s, -10.6 * s);
  hi.close();
  // camlar, ızgara kanalları, tampon
  dark.moveTo(-6 * s, -14 * s);
  dark.lineTo(4.5 * s, -14 * s);
  dark.lineTo(14.5 * s, -9.6 * s);
  dark.lineTo(-6 * s, -9.6 * s);
  dark.close();
  dark.moveTo(-8.5 * s, -14 * s);
  dark.lineTo(-20 * s, -12.6 * s);
  dark.lineTo(-20 * s, -9.8 * s);
  dark.lineTo(-8.5 * s, -9.8 * s);
  dark.close();
  for (let i = 0; i < 4; i += 1) dark.addRect(Skia.XYWHRect(-30 * s, (-10.4 + i * 1.6) * s, 6 * s, 0.7 * s));
  dark.addRect(Skia.XYWHRect(-33 * s, -4 * s, 66 * s, 1.6 * s));
  // tekerlek yuvaları
  const wheels = Skia.Path.Make();
  [-20, 20].forEach((x) => {
    wheels.addCircle(x * s, -3.6 * s, 5.2 * s);
  });
  const hubs = Skia.Path.Make();
  [-20, 20].forEach((x) => hubs.addCircle(x * s, -3.6 * s, 2.2 * s));
  return { body, hi, dark, wheels, hubs };
}

// ───────────────────────────── olaylar (worklet'ler kullanılmadan önce)

/** A olayında arabanın x'i (yolda, soldan hızlanır; kancanın altında kaybolur). */
function carRoadX(u, L) {
  "worklet";
  const e = Math.min(1, Math.max(0, (u - 0.12) / 0.21));
  return -70 * L.k + (L.hookX + 70 * L.k) * e * e;
}

/** Ateş izleri: x0 → x1 arası küçük alevler; fade 0 (taze) … 1 (sönmüş). */
function addTrail(q, x0, x1, y, t, fade, k, seed) {
  "worklet";
  if (x1 - x0 < 4 || fade >= 1) return;
  const step = 9 * k;
  const n = Math.min(70, Math.floor((x1 - x0) / step));
  for (let i = 0; i <= n; i += 1) {
    const x = x0 + i * step;
    const ageF = 0.55 + 0.45 * (i / Math.max(1, n));
    const h = (9 + hash(i, seed) * 7) * k * (1 - fade) * ageF;
    if (h < 0.6) continue;
    addFlame(q, x, y, 5.4 * k, h, t, i + seed);
  }
}

/** Gökteki zikzak yıldırım: (x0,y0) → (x1,y1). */
function addBolt(q, x0, y0, x1, y1, k, seed) {
  "worklet";
  q.moveTo(x0, y0);
  const n = 8;
  for (let i = 1; i < n; i += 1) {
    const f = i / n;
    q.lineTo(x0 + (x1 - x0) * f + (hash(i, seed) - 0.5) * 34 * k, y0 + (y1 - y0) * f);
  }
  q.lineTo(x1, y1);
  // kısa bir dal
  const bx = x0 + (x1 - x0) * 0.4 + (hash(3, seed) - 0.5) * 34 * k;
  const by = y0 + (y1 - y0) * 0.4;
  q.moveTo(bx, by);
  q.lineTo(bx + 22 * k, by + 26 * k);
  q.lineTo(bx + 16 * k, by + 48 * k);
}

function Clouds({ p, clock, L, sky, c }) {
  const { width, k } = L;
  const span = width + 260 * k;
  // A olayında fırtına koyulaşır (bulutlar öne, daha opak)
  const storm = useDerivedValue(() => {
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 0) return 0;
    return sm(0.02, 0.2, u) * (1 - sm(0.5, 0.75, u));
  });
  const op = useDerivedValue(() => 0.55 + storm.value * 0.4);
  return (
    <Group opacity={op}>
      {sky.clouds.map((cl, i) => (
        <CloudOne key={i} cl={cl} clock={clock} span={span} k={k} c={c} lit={i % 2 === 0} />
      ))}
    </Group>
  );
}

function CloudOne({ cl, clock, span, k, c, lit }) {
  const at = useDerivedValue(() => [
    { translateX: ((((cl.x + clock.value * cl.v) % span) + span) % span) - 130 * k },
    { translateY: cl.y },
  ]);
  return (
    <Group transform={at}>
      <Path path={cl.q} color={lit ? c.cloudLit : c.cloud} />
    </Group>
  );
}

function Lightning({ p, clock, L, town, c }) {
  const { cx, rodTop, k, hookX, hookY, clockY, u: s } = L;
  const strike = useDerivedValue(() => {
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 0) return 0;
    return sm(0.245, 0.255, u) * (1 - sm(0.27, 0.31, u));
  });
  const bolt = useDerivedValue(() => {
    const q = Skia.Path.Make();
    if (strike.value < 0.02) return q;
    addBolt(q, cx - 60 * k, rodTop - 330 * k, cx, rodTop, k, 4);
    return q;
  });
  // elektrik kablodan iner: parlak düğüm (kuadratik eğri boyunca)
  const spark = useDerivedValue(() => {
    const u = restU(p, clock.value);
    const q = Skia.Path.Make();
    if (u > 1 || eventPick(p, clock.value, 2) !== 0 || u < 0.26 || u > 0.335) return q;
    const e = (u - 0.26) / 0.075;
    const [x0, y0] = town.wire0;
    const mx = (x0 + hookX) / 2;
    const my = Math.max(y0, hookY) + 40 * k;
    const x1 = hookX - 9 * k;
    const it = 1 - e;
    const x = it * it * x0 + 2 * it * e * mx + e * e * x1;
    const y = it * it * y0 + 2 * it * e * my + e * e * hookY;
    for (let i = 0; i < 6; i += 1) {
      const a = hash(i, Math.floor(clock.value * 12)) * Math.PI * 2;
      const r = (4 + hash(i, 9) * 7) * k;
      q.moveTo(x, y);
      q.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    return q;
  });
  const clockGlow = useDerivedValue(() => {
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 0) return 0;
    return sm(0.25, 0.27, u) * (1 - sm(0.32, 0.5, u));
  });
  const flashAt = useDerivedValue(() => [{ translateX: cx }, { translateY: rodTop }, { scale: 0.4 + strike.value * 0.6 }]);
  return (
    <>
      <Group opacity={strike}>
        <Group transform={flashAt}>
          <Glow r={150 * k} color={c.bolt} a={0.5} mid={0.25} />
        </Group>
        <Path path={bolt} style="stroke" strokeWidth={6 * k} strokeJoin="round" color={rgba(c.blue, 0.35)} />
        <Path path={bolt} style="stroke" strokeWidth={2.6 * k} strokeJoin="round" color={c.bolt} />
      </Group>
      <Group opacity={clockGlow}>
        <Group transform={[{ translateX: cx }, { translateY: clockY }]}>
          <Glow r={40 * s} color={c.lamp} a={0.9} mid={0.4} />
        </Group>
      </Group>
      <Path path={spark} style="stroke" strokeWidth={1.4 * k} strokeCap="round" color={c.bolt} />
    </>
  );
}

function RoadCar({ p, clock, L, car, c }) {
  const { k, carY, hookX, u: s } = L;
  const cs = s * 1.15;
  // A: yolda hızlanan araba
  const roadA = useDerivedValue(() => {
    const u = restU(p, clock.value);
    return u <= 1 && eventPick(p, clock.value, 2) === 0 && u > 0.12 && u < 0.333 ? 1 : 0;
  });
  const at = useDerivedValue(() => {
    const u = restU(p, clock.value);
    return [{ translateX: carRoadX(Math.min(u, 1), L) }, { translateY: carY + Math.sin(clock.value * 40) * 0.3 * k }];
  });
  const vanish = useDerivedValue(() => {
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 0) return 0;
    return sm(0.31, 0.333, u) * (1 - sm(0.34, 0.42, u));
  });
  const trails = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 0 || u < 0.26) return q;
    const x0 = carRoadX(0.26, L) - 20 * cs;
    const x1 = Math.min(carRoadX(Math.min(u, 0.333), L), hookX) - 20 * cs;
    const fade = sm(0.42, 0.85, u);
    addTrail(q, x0, x1, carY - 0.5 * k, clock.value, fade, k, 1);
    addTrail(q, x0 + 6 * k, x1 + 6 * k, carY + 5 * k, clock.value, fade, k, 9);
    return q;
  });
  const trailLine = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 0 || u < 0.26) return q;
    const x0 = carRoadX(0.26, L) - 20 * cs;
    const x1 = Math.min(carRoadX(Math.min(u, 0.333), L), hookX) - 20 * cs;
    q.addRect(Skia.XYWHRect(x0, carY - 1.2 * k, x1 - x0, 2.4 * k));
    q.addRect(Skia.XYWHRect(x0 + 6 * k, carY + 4.2 * k, x1 - x0, 2.4 * k));
    return q;
  });
  const lineOp = useDerivedValue(() => {
    const u = restU(p, clock.value);
    return u > 1 ? 0 : 0.85 * (1 - sm(0.45, 0.9, u));
  });
  // araba çevresinde mavi elektrik (hız sınırına yaklaşınca)
  const arcs = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 0 || u < 0.27 || u > 0.333) return q;
    const seed = Math.floor(clock.value * 10);
    for (let i = 0; i < 4; i += 1) {
      const a0 = hash(i, seed) * Math.PI * 2;
      const r = (24 + hash(i, seed + 1) * 10) * cs;
      let x = Math.cos(a0) * r;
      let y = -9 * cs + Math.sin(a0) * r * 0.45;
      q.moveTo(x, y);
      for (let j = 0; j < 3; j += 1) {
        x += (hash(j + i * 3, seed + 2) - 0.5) * 16 * cs;
        y += (hash(j + i * 3, seed + 3) - 0.5) * 10 * cs;
        q.lineTo(x, y);
      }
    }
    return q;
  });
  return (
    <>
      <Group opacity={lineOp}>
        <Path path={trailLine} color={c.fire} />
      </Group>
      <Path path={trails} color={c.fire} />
      <Group opacity={roadA}>
        <Group transform={at}>
          <CarBody car={car} c={c} />
          <Path path={arcs} style="stroke" strokeWidth={1.3 * k} strokeJoin="round" color={c.blue} />
        </Group>
      </Group>
      <Group opacity={vanish}>
        <Group transform={[{ translateX: hookX - 20 * cs }, { translateY: carY - 10 * k }]}>
          <Glow r={70 * k} color={c.blue} a={0.85} mid={0.35} />
        </Group>
      </Group>
    </>
  );
}

function CarBody({ car, c, hover }) {
  return (
    <>
      <Path path={car.wheels} color={c.carDark} />
      {hover ? null : <Path path={car.hubs} color={c.car} />}
      <Path path={car.body} color={c.car} />
      <Path path={car.hi} color={c.carHi} />
      <Path path={car.dark} color={c.carDark} />
    </>
  );
}

// B: uçan araba. Tekerlekler yere paralel (yassı elips), altlarında mavi itici ışık.
function FlyingCar({ p, clock, L, car, flatWheels, c }) {
  const { k, width, cx, towerTop, u: s } = L;
  const show = useDerivedValue(() => {
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 1) return 0;
    return sm(0.05, 0.12, u) * (1 - sm(0.6, 0.64, u));
  });
  const pos = (u) => {
    "worklet";
    const e = Math.min(1, Math.max(0, (u - 0.05) / 0.57));
    const x = width + 80 * k - (width + 80 * k - cx) * (1 - (1 - e) * (1 - e));
    const y = towerTop - 260 * k + e * 150 * k + Math.sin(e * Math.PI * 2) * 14 * k;
    return [x, y];
  };
  const at = useDerivedValue(() => {
    const u = restU(p, clock.value);
    const [x, y] = pos(Math.min(u, 1));
    return [{ translateX: x }, { translateY: y }, { scaleX: -1 }, { rotate: -0.05 + Math.sin(clock.value * 1.7) * 0.02 }];
  });
  const thrust = useDerivedValue(() => 0.6 + 0.4 * Math.sin(clock.value * 13));
  const arcs = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 1 || u < 0.5 || u > 0.63) return q;
    const [x0, y0] = pos(u);
    const seed = Math.floor(clock.value * 10);
    for (let i = 0; i < 5; i += 1) {
      const a = hash(i, seed) * Math.PI * 2;
      let x = x0 + Math.cos(a) * 30 * s;
      let y = y0 - 8 * s + Math.sin(a) * 14 * s;
      q.moveTo(x, y);
      for (let j = 0; j < 3; j += 1) {
        x += (hash(j + i * 3, seed + 4) - 0.5) * 18 * s;
        y += (hash(j + i * 3, seed + 5) - 0.5) * 12 * s;
        q.lineTo(x, y);
      }
    }
    return q;
  });
  const vanish = useDerivedValue(() => {
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 1) return 0;
    return sm(0.6, 0.63, u) * (1 - sm(0.64, 0.74, u));
  });
  const vanishAt = useDerivedValue(() => {
    const [x, y] = pos(0.62);
    return [{ translateX: x }, { translateY: y - 8 * s }];
  });
  // gökteki iki kısa ateş izi (kaybolduğu yerden geriye)
  const trails = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 1 || u < 0.62) return q;
    const fade = sm(0.64, 0.9, u);
    const [x, y] = pos(0.62);
    addTrail(q, x + 4 * k, x + 120 * k, y, clock.value, fade, k * 0.75, 3);
    addTrail(q, x + 10 * k, x + 120 * k, y + 6 * k, clock.value, fade, k * 0.75, 5);
    return q;
  });
  return (
    <>
      <Path path={trails} color={c.fire} />
      <Group opacity={show}>
        <Group transform={at}>
          <Group opacity={thrust}>
            <Group transform={[{ translateX: -20 * s }, { translateY: 2 * s }]}>
              <Glow r={14 * s} color={c.blue} a={0.9} mid={0.4} />
            </Group>
            <Group transform={[{ translateX: 20 * s }, { translateY: 2 * s }]}>
              <Glow r={14 * s} color={c.blue} a={0.9} mid={0.4} />
            </Group>
          </Group>
          <Path path={flatWheels} color={c.carDark} />
          <CarBody car={car} c={c} hover />
        </Group>
      </Group>
      <Path path={arcs} style="stroke" strokeWidth={1.3 * k} strokeJoin="round" color={c.blue} />
      <Group opacity={vanish}>
        <Group transform={vanishAt}>
          <Glow r={60 * k} color={c.blue} a={0.85} mid={0.35} />
        </Group>
      </Group>
    </>
  );
}

export default function BttfScene({ p, clock, width, height, tone, lightSurface }) {
  const L = useMemo(() => btLayout(width, height), [width, height]);
  const town = useMemo(() => buildTown(L), [L]);
  const sky = useMemo(() => buildSky(L), [L]);
  const cs = L.u * 1.15;
  const car = useMemo(() => buildCar(cs), [cs]);
  const flatWheels = useMemo(() => {
    const q = Skia.Path.Make();
    [-20, 20].forEach((x) => q.addOval(Skia.XYWHRect((x - 6) * cs, -4 * cs, 12 * cs, 4 * cs)));
    return q;
  }, [cs]);
  const c = useMemo(() => toneMap(BT_TONE, tone.colors), [tone]);
  const { k, curbY, roadY, ground } = L;
  const night = !lightSurface;
  const roadMarks = useMemo(() => {
    const q = Skia.Path.Make();
    for (let x = 6 * k; x < width; x += 34 * k) q.addRect(Skia.XYWHRect(x, ground + 8 * k, 18 * k, 2 * k));
    return q;
  }, [k, width, ground]);
  const winA = useDerivedValue(() => (night ? 0.85 : 0.6) + Math.sin(clock.value * 0.9) * 0.04);
  return (
    <Group opacity={tone.alpha}>
      <Path path={sky.stars} color={c.star} opacity={night ? 0.55 : 0} />
      <Clouds p={p} clock={clock} L={L} sky={sky} c={c} />
      <Lightning p={p} clock={clock} L={L} town={town} c={c} />
      <Path path={town.trees} color={c.tree} />
      <Path path={town.tower} color={c.tower} />
      <Path path={town.clock} color={c.clock} />
      <Path path={town.hands} color={c.hand} />
      <Path path={town.build} color={c.build} />
      <Path path={town.roof} color={c.roof} />
      <Path path={town.shade} color={c.buildShade} />
      <Path path={town.column} color={c.column} />
      <Group opacity={winA}>
        <Path path={town.windows} color={c.window} />
      </Group>
      <Path path={town.wire} style="stroke" strokeWidth={1.2 * k} color={c.wire} />
      <Path path={town.lamps} color={c.wire} />
      {town.lampLights.slice(0, 3).map(([x, y], i) => (
        <Group key={i} transform={[{ translateX: x }, { translateY: y }]}>
          <Glow r={26 * k} color={c.lamp} a={night ? 0.55 : 0.3} mid={0.3} />
        </Group>
      ))}
      <Path path={town.lampGlow} color={c.lamp} />
      {/* kaldırım + yol */}
      <Rect x={0} y={curbY} width={width} height={roadY - curbY} color={c.curb} />
      <Rect x={0} y={roadY} width={width} height={L.height - roadY} color={c.street}>
        </Rect>
      <Path path={roadMarks} color={c.line} opacity={0.5} />
      <RoadCar p={p} clock={clock} L={L} car={car} c={c} />
      <FlyingCar p={p} clock={clock} L={L} car={car} flatWheels={flatWheels} c={c} />
    </Group>
  );
}
