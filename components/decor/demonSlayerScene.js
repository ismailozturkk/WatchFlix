// components/decor/demonSlayerScene.js
//
// Demon Slayer evren sahnesi (OVERLAY.dsVec = 57) — tamamı VEKTÖR:
//   • Gece, iri dolunay; katmanlı dağlar ve orman sırtı. İki üst köşeden eğik dallardan sarkan mor
//     wisteria salkımları (rüzgârda hafifçe salınır). Ortada geleneksel ahşap ev: kıvrık saçaklı kiremit
//     çatı, ışıklı kâğıt sürgü pencereler, saçakta sallanan kırmızı kâğıt fenerler; yanında taş fener.
//   • Olay (64 sn'de bir ~25 sn): kareli pelerinli kılıç ustası soldan koşarak gelir, durur, kılıcını
//     çeker; kılıcın ucundan ekranın ortasında kıvrılan bir SU dalgası şeridi büyür (köpüklü baş,
//     damlalar), ardından dalga çözülüp söner; kılıç kınına girer, usta koşup gider.
//   • Olay B (dönüşümlü): ormanın karanlığında kızıl iblis gözleri yanıp söner; bir haberci karga
//     gökten süzülerek geçer; ardından iki köşedeki salkımlardan kopan mor yaprak fırtınası sahneyi
//     süpürür ve gözler geri çekilip kaybolur.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[57] (DS_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Circle, Group, LinearGradient, Path, Rect, Skia, vec } from "@shopify/react-native-skia";
import { eventU } from "../../utils/weatherParticles";
import { Glow, TAU, addPine, groundLayout, hash, ridgePath, sm, toneMap } from "./seasonKit";

export const DS_TONE = [
  "moon",
  "moonGlow",
  "mountFar",
  "mountNear",
  "forest",
  "roof",
  "wall",
  "shoji",
  "lantern",
  "lanternGlow",
  "ground",
  "branch",
  "wis1",
  "wis2",
  "wis3",
  "coat",
  "coatCheck",
  "blade",
  "water",
  "waterHi",
  "foam",
  "stone",
  "leaf",
];

export function dsLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  return {
    ...L,
    base: ground - 4 * k,
    moon: [width * 0.62, height * 0.17, 46 * k],
    house: [width * 0.5, ground - 4 * k, 150 * k, 62 * k],
    stand: width * 0.26,
    arc: [width * 0.56, ground - 150 * k, 112 * k],
  };
}

// ───────────────────────────── durağan yollar

function buildLand(L) {
  const { k, width, height, base } = L;
  const far = ridgePath(width, base - 170 * k, 90 * k, 3, 1.3, height).path;
  const near = ridgePath(width, base - 90 * k, 60 * k, 4, 4.1, height).path;
  const forest = Skia.Path.Make();
  for (let i = 0; i < 30; i += 1) {
    const x = (i / 29) * (width + 30 * k) - 15 * k;
    addPine(forest, x, base - 24 * k + hash(i, 2) * 8 * k, (50 + hash(i, 1) * 40) * k, (22 + hash(i, 3) * 10) * k, 4);
  }
  return { far, near, forest };
}

function buildHouse(L) {
  const { k } = L;
  const [cx, b, w, h] = L.house;
  const x0 = cx - w / 2;
  const wall = Skia.Path.Make();
  wall.addRect(Skia.XYWHRect(x0 + 6 * k, b - h, w - 12 * k, h));
  // kıvrık saçaklı çatı (iki kat)
  const roof = Skia.Path.Make();
  const eave = (y, half, rise, lift) => {
    roof.moveTo(cx - half - 14 * k, y - lift);
    roof.quadTo(cx - half + 6 * k, y + 2 * k, cx - half + 20 * k, y);
    roof.lineTo(cx + half - 20 * k, y);
    roof.quadTo(cx + half - 6 * k, y + 2 * k, cx + half + 14 * k, y - lift);
    roof.lineTo(cx + half * 0.55, y - rise);
    roof.lineTo(cx - half * 0.55, y - rise);
    roof.close();
  };
  eave(b - h + 2 * k, w / 2 + 8 * k, 26 * k, 8 * k);
  eave(b - h - 30 * k, w * 0.32, 22 * k, 7 * k);
  roof.addRect(Skia.XYWHRect(cx - w * 0.22, b - h - 34 * k, w * 0.44, 8 * k));
  roof.addRect(Skia.XYWHRect(cx - w * 0.2, b - h - 56 * k, w * 0.4, 3 * k)); // mahya
  // sürgü pencereler (ızgara)
  const shoji = Skia.Path.Make();
  const grid = Skia.Path.Make();
  const panes = [
    [x0 + 16 * k, b - h + 12 * k, 40 * k, 34 * k],
    [cx - 22 * k, b - h + 12 * k, 44 * k, h - 12 * k],
    [x0 + w - 56 * k, b - h + 12 * k, 40 * k, 34 * k],
  ];
  panes.forEach(([x, y, pw, ph]) => {
    shoji.addRect(Skia.XYWHRect(x, y, pw, ph));
    for (let gx = x + pw / 4; gx < x + pw - 1; gx += pw / 4) grid.addRect(Skia.XYWHRect(gx - 0.5 * k, y, 1 * k, ph));
    for (let gy = y + ph / 4; gy < y + ph - 1; gy += ph / 4) grid.addRect(Skia.XYWHRect(x, gy - 0.5 * k, pw, 1 * k));
  });
  // veranda tahtası + direkler
  const deck = Skia.Path.Make();
  deck.addRect(Skia.XYWHRect(x0 - 4 * k, b - 6 * k, w + 8 * k, 6 * k));
  [0.02, 0.32, 0.68, 0.98].forEach((f) => deck.addRect(Skia.XYWHRect(x0 + f * w - 2 * k, b - h, 4 * k, h)));
  // taş fener (sağda)
  const stone = Skia.Path.Make();
  const sx = cx + w / 2 + 34 * k;
  stone.addRect(Skia.XYWHRect(sx - 3 * k, b - 26 * k, 6 * k, 26 * k));
  stone.addRect(Skia.XYWHRect(sx - 8 * k, b - 4 * k, 16 * k, 4 * k));
  stone.addRect(Skia.XYWHRect(sx - 7 * k, b - 38 * k, 14 * k, 12 * k));
  stone.moveTo(sx - 12 * k, b - 38 * k);
  stone.lineTo(sx, b - 48 * k);
  stone.lineTo(sx + 12 * k, b - 38 * k);
  stone.close();
  const lanterns = [x0 + 12 * k, x0 + w - 12 * k].map((x) => [x, b - h + 8 * k]);
  return { wall, roof, shoji, grid, deck, stone, stoneLamp: [sx, b - 32 * k], lanterns };
}

/** Bir köşeden sarkan wisteria: dal + yaprak örtüsü + sık salkımlar (3 ton katmanı). side: -1 sol, 1 sağ. */
function buildWisteria(L, side) {
  const { k, width } = L;
  const ox = side < 0 ? -10 * k : width + 10 * k;
  const branch = Skia.Path.Make();
  const leaves = Skia.Path.Make();
  const tiers = [Skia.Path.Make(), Skia.Path.Make(), Skia.Path.Make()];
  const reach = width * 0.5;
  // dal eğrisi: köşeden içeri, hafif sarkık
  const bAt = (f) => [ox - side * reach * f, 8 * k + Math.sin(f * Math.PI * 0.9) * 46 * k + f * 14 * k];
  branch.moveTo(ox, 0);
  for (let i = 1; i <= 20; i += 1) {
    const [x, y] = bAt(i / 20);
    branch.lineTo(x, y);
  }
  // yaprak örtüsü: dal boyunca sık oval yapraklar
  for (let i = 0; i < 40; i += 1) {
    const f = hash(i, side + 11);
    const [x, y] = bAt(f);
    leaves.addOval(Skia.XYWHRect(x - 9 * k + (hash(i, 2) - 0.5) * 14 * k, y - 10 * k + (hash(i, 3) - 0.5) * 16 * k, 18 * k, 9 * k));
  }
  // salkımlar: dal boyunca sık, uzunluk dalga gibi değişen
  const n = 26;
  for (let i = 0; i < n; i += 1) {
    const f = (i + hash(i, 5) * 0.6) / n;
    const [bx, by0] = bAt(f);
    const by = by0 + 4 * k;
    const len = (50 + hash(i, side + 3) * 60 + Math.sin(f * 9) * 18) * k * (1 - f * 0.35);
    const wTop = (14 + hash(i, 6) * 6) * k;
    const m = 14;
    for (let j = 0; j < m; j += 1) {
      const t = j / (m - 1);
      const y = by + t * len;
      const r = wTop * 0.5 * (1 - t * 0.8) + 1.2 * k;
      const xj = bx + Math.sin(t * 3.2 + i) * 2.4 * k;
      // iki yana küçük çiçekler: salkım dokusu
      tiers[Math.min(2, Math.floor(t * 3))].addCircle(xj, y, r);
      if (j % 2 === 0 && t < 0.85) {
        tiers[Math.min(2, Math.floor(t * 3))].addCircle(xj - r * 0.9, y + r * 0.4, r * 0.55);
        tiers[Math.min(2, Math.floor(t * 3))].addCircle(xj + r * 0.9, y + r * 0.4, r * 0.55);
      }
    }
  }
  return { branch, leaves, tiers, pivot: [ox, 0] };
}

// ───────────────────────────── olay

/** Su şeridinin noktası (τ 0–1): ortada kıvrılan, tepeleri dalgalı geniş bir sarmal. */
function arcPoint(tau, L) {
  "worklet";
  const [cx, cy, R] = L.arc;
  const th = Math.PI * 0.92 + tau * Math.PI * 1.75;
  const r = R * (0.62 + 0.45 * tau);
  const wob = Math.sin(tau * 22) * 4 * L.k;
  return [cx + Math.cos(th) * r * 1.35 + wob, cy + Math.sin(th) * r * 0.62 - Math.sin(tau * Math.PI) * 26 * L.k + wob * 0.6];
}

function waterParts(u, t, L) {
  "worklet";
  const { k } = L;
  const body = Skia.Path.Make();
  const core = Skia.Path.Make();
  const crests = Skia.Path.Make();
  const foam = Skia.Path.Make();
  if (u > 1) return { body, core, crests, foam };
  const head = sm(0.3, 0.6, u);
  const tail = sm(0.62, 0.84, u);
  if (head <= tail + 0.01) return { body, core, crests, foam };
  const n = 56;
  const left = [];
  const right = [];
  for (let i = 0; i <= n; i += 1) {
    const rel = i / n;
    const tau = tail + (head - tail) * rel;
    const [x, y] = arcPoint(tau, L);
    const [x2, y2] = arcPoint(Math.min(1, tau + 0.004), L);
    let dx = x2 - x;
    let dy = y2 - y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= len;
    dy /= len;
    // kuyrukta ince, başta dolgun; kabaran nabız
    const w = (2 + 15 * Math.pow(rel, 0.7)) * k * (1 + 0.12 * Math.sin(t * 6 + rel * 14));
    left.push([x - dy * w, y + dx * w]);
    right.push([x + dy * w * 0.8, y - dx * w * 0.8]);
    if (i === 0) core.moveTo(x - dy * w * 0.3, y + dx * w * 0.3);
    else core.lineTo(x - dy * w * 0.3, y + dx * w * 0.3);
    // dış kenarda kıvrılan küçük dalga tepeleri
    if (i % 6 === 3 && rel > 0.15) {
      const [ex, ey] = left[i];
      const s2 = w * 0.9;
      crests.moveTo(ex, ey);
      crests.cubicTo(ex - dy * s2, ey + dx * s2, ex - dy * s2 + dx * s2 * 1.2, ey + dx * s2 + dy * s2 * 1.2, ex + dx * s2 * 0.9 - dy * s2 * 0.35, ey + dy * s2 * 0.9 + dx * s2 * 0.35);
    }
    if (i % 5 === 0 && rel > 0.3) {
      const fx = x - dy * (w + 8 * k) + Math.sin(t * 5 + i) * 4 * k;
      const fy = y + dx * (w + 8 * k) + Math.cos(t * 4 + i) * 4 * k;
      foam.addCircle(fx, fy, (1.4 + (i % 3) * 0.8) * k);
    }
  }
  body.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < left.length; i += 1) body.lineTo(left[i][0], left[i][1]);
  for (let i = right.length - 1; i >= 0; i -= 1) body.lineTo(right[i][0], right[i][1]);
  body.close();
  // köpüklü baş
  const [hx, hy] = arcPoint(head, L);
  for (let j = 0; j < 8; j += 1) {
    const a = (j / 8) * TAU + t * 4;
    foam.addCircle(hx + Math.cos(a) * 12 * k, hy + Math.sin(a) * 9 * k, (2.6 + (j % 3)) * k);
  }
  return { body, core, crests, foam };
}

function WaterArc({ p, clock, L, c }) {
  const { k } = L;
  const parts = useDerivedValue(() => waterParts(eventU(p, clock.value, 0), clock.value, L));
  const body = useDerivedValue(() => parts.value.body);
  const core = useDerivedValue(() => parts.value.core);
  const crests = useDerivedValue(() => parts.value.crests);
  const foam = useDerivedValue(() => parts.value.foam);
  const a = useDerivedValue(() => {
    const u = eventU(p, clock.value, 0);
    return u > 1 ? 0 : sm(0.3, 0.34, u) * (1 - sm(0.78, 0.86, u));
  });
  return (
    <Group opacity={a}>
      <Path path={body} style="stroke" strokeWidth={10 * k} strokeJoin="round" color={c.water} opacity={0.25} />
      <Path path={body} color={c.water} opacity={0.9} />
      <Path path={core} style="stroke" strokeWidth={3.2 * k} strokeCap="round" strokeJoin="round" color={c.waterHi} />
      <Path path={crests} style="stroke" strokeWidth={2.2 * k} strokeCap="round" color={c.foam} />
      <Path path={foam} color={c.foam} opacity={0.9} />
    </Group>
  );
}

/** Kılıç ustası: koşarken bacak salınımı, duruşta kılıç yukarı. */
function slayerPaths(u, t, k) {
  "worklet";
  const body = Skia.Path.Make();
  const check = Skia.Path.Make();
  const blade = Skia.Path.Make();
  const running = u < 0.2 || u > 0.8;
  const sw = running ? Math.sin(t * 14) : 0;
  // bacaklar
  body.moveTo(-3 * k, -22 * k);
  body.lineTo(-3 * k + sw * 7 * k, -11 * k);
  body.lineTo(-4 * k + sw * 9 * k, 0);
  body.lineTo(-1 * k + sw * 9 * k, 0);
  body.lineTo(0, -22 * k);
  body.moveTo(1 * k, -22 * k);
  body.lineTo(3 * k - sw * 7 * k, -11 * k);
  body.lineTo(2 * k - sw * 9 * k, 0);
  body.lineTo(5 * k - sw * 9 * k, 0);
  body.lineTo(4 * k, -22 * k);
  // gövde + baş
  body.addRect(Skia.XYWHRect(-4 * k, -36 * k, 9 * k, 15 * k));
  body.addCircle(0.5 * k, -41 * k, 4.6 * k);
  // pelerin (kareli): koşarken arkaya uçar
  const fly = running ? 8 * k : 2 * k;
  const cape = Skia.Path.Make();
  cape.moveTo(-5 * k, -36 * k);
  cape.lineTo(6 * k, -36 * k);
  cape.lineTo(8 * k, -16 * k);
  cape.lineTo(-9 * k - fly, -14 * k + Math.sin(t * 9) * 1.5 * k);
  cape.close();
  for (let i = 0; i < 4; i += 1)
    for (let j = 0; j < 3; j += 1)
      if ((i + j) % 2 === 0) check.addRect(Skia.XYWHRect(-6 * k - fly * 0.6 + j * 4.2 * k, -34 * k + i * 4.6 * k, 4.2 * k, 4.6 * k));
  // kılıç: duruşta (0.2–0.8) yukarı ileri
  const drawn = u >= 0.22 && u <= 0.78;
  if (drawn) {
    blade.moveTo(5 * k, -30 * k);
    blade.lineTo(24 * k, -54 * k);
  } else {
    blade.moveTo(-4 * k, -24 * k);
    blade.lineTo(-18 * k, -32 * k);
  }
  return { body, cape, check, blade };
}

function Slayer({ p, clock, L, c }) {
  const { k, width } = L;
  const d = useDerivedValue(() => slayerPaths(eventU(p, clock.value, 0), clock.value, k));
  const body = useDerivedValue(() => d.value.body);
  const cape = useDerivedValue(() => d.value.cape);
  const check = useDerivedValue(() => d.value.check);
  const blade = useDerivedValue(() => d.value.blade);
  const at = useDerivedValue(() => {
    const u = eventU(p, clock.value, 0);
    if (u > 1) return [{ translateX: -900 }, { translateY: -900 }];
    const xin = -30 * k + (L.stand + 30 * k) * sm(0, 0.2, u);
    const x = u < 0.8 ? xin : L.stand + (width + 60 * k - L.stand) * sm(0.8, 0.95, u);
    return [{ translateX: x }, { translateY: L.base + 22 * k }, { scale: 1.5 }];
  });
  const gleam = useDerivedValue(() => {
    const u = eventU(p, clock.value, 0);
    return u > 1 ? 0 : sm(0.24, 0.3, u) * (1 - sm(0.3, 0.4, u));
  });
  return (
    <Group transform={at}>
      <Path path={cape} color={c.coat} />
      <Path path={check} color={c.coatCheck} />
      <Path path={body} color={c.stone} />
      <Path path={blade} style="stroke" strokeWidth={1.8 * k} strokeCap="round" color={c.blade} />
      <Group opacity={gleam}>
        <Glow cx={24 * k} cy={-54 * k} r={14 * k} color={c.waterHi} a={0.9} mid={0.3} />
      </Group>
    </Group>
  );
}

function Wisteria({ data, clock, side, c, k }) {
  const [px, py] = data.pivot;
  const sway = useDerivedValue(() => [
    { translateX: px },
    { translateY: py },
    { rotate: side * (0.012 * Math.sin(clock.value * 0.8) + 0.006 * Math.sin(clock.value * 1.9 + 1)) },
    { translateX: -px },
    { translateY: -py },
  ]);
  return (
    <Group transform={sway}>
      <Path path={data.branch} style="stroke" strokeWidth={6 * k} strokeCap="round" strokeJoin="round" color={c.branch} />
      <Path path={data.leaves} color={c.leaf} />
      <Path path={data.tiers[0]} color={c.wis1} />
      <Path path={data.tiers[1]} color={c.wis2} />
      <Path path={data.tiers[2]} color={c.wis3} />
    </Group>
  );
}

function Lantern({ x, y, clock, i, c, k }) {
  const at = useDerivedValue(() => [{ translateX: x }, { translateY: y }, { rotate: 0.08 * Math.sin(clock.value * 1.3 + i * 2) }]);
  const glow = useDerivedValue(() => 0.8 + 0.12 * Math.sin(clock.value * 3.3 + i) + 0.08 * Math.sin(clock.value * 7.1));
  return (
    <Group transform={at}>
      <Rect x={-0.5 * k} y={0} width={1 * k} height={6 * k} color={c.branch} />
      <Group opacity={glow}>
        <Glow cx={0} cy={14 * k} r={24 * k} color={c.lanternGlow} a={0.7} mid={0.3} />
      </Group>
      <Rect x={-6 * k} y={6 * k} width={12 * k} height={2 * k} color={c.branch} />
      <Path path={`M ${-6 * k} ${8 * k} Q ${-9 * k} ${14 * k} ${-6 * k} ${20 * k} L ${6 * k} ${20 * k} Q ${9 * k} ${14 * k} ${6 * k} ${8 * k} Z`} color={c.lantern} />
      <Rect x={-6 * k} y={20 * k} width={12 * k} height={2 * k} color={c.branch} />
    </Group>
  );
}

// ───────────────────────────── olay B: iblis gözleri + karga + salkım yaprağı fırtınası

function DemonEyes({ p, clock, L, c }) {
  const { k, width, base } = L;
  const d = useDerivedValue(() => {
    const eyes = Skia.Path.Make();
    const u = eventU(p, clock.value, 1);
    if (u > 1) return eyes;
    for (let i = 0; i < 6; i += 1) {
      const on = sm(0.08 + i * 0.04, 0.14 + i * 0.04, u) * (1 - sm(0.5 + i * 0.02, 0.58 + i * 0.02, u));
      const blink = Math.sin(clock.value * 0.9 + i * 2.1) > -0.85 ? 1 : 0.1;
      const a = on * blink;
      if (a < 0.05) continue;
      const x = width * (0.06 + (i / 5) * 0.88) + (hash(i, 201) - 0.5) * 30 * k;
      if (x > width * 0.36 && x < width * 0.64) continue;
      const y = base - (30 + hash(i, 202) * 50) * k;
      const s = (1.5 + hash(i, 203) * 0.6) * k * a;
      [-1, 1].forEach((side) => {
        const ex = x + side * 5 * s;
        eyes.moveTo(ex - 3.4 * s, y);
        eyes.quadTo(ex, y - 2.2 * s * (side > 0 ? 1 : 0.8), ex + 3.4 * s, y - side * 0.8 * s);
        eyes.quadTo(ex, y + 1.6 * s, ex - 3.4 * s, y);
        eyes.close();
      });
    }
    return eyes;
  });
  return (
    <Group>
      <Path path={d} color={c.lantern} />
      <Path path={d} style="stroke" strokeWidth={4 * k} color={c.lanternGlow} opacity={0.45} />
    </Group>
  );
}

function Crow({ p, clock, L, c }) {
  const { k, width, height } = L;
  const q = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const u = eventU(p, clock.value, 1);
    if (u > 1) return path;
    const e = (u - 0.12) / 0.36;
    if (e <= 0 || e >= 1) return path;
    const s = k * 1.3;
    const x = width + 40 * s - e * (width + 80 * s);
    const y = height * 0.28 + Math.sin(e * 6) * 30 * k;
    const f = Math.sin(clock.value * 8);
    path.moveTo(x - 10 * s, y);
    path.quadTo(x, y - 4 * s, x + 12 * s, y + 1 * s);
    path.lineTo(x + 18 * s, y - 2 * s);
    path.lineTo(x + 17 * s, y + 3 * s);
    path.quadTo(x, y + 5 * s, x - 10 * s, y);
    path.close();
    path.addCircle(x - 9 * s, y - 1 * s, 3 * s);
    path.moveTo(x - 12 * s, y - 1.4 * s);
    path.lineTo(x - 17 * s, y);
    path.lineTo(x - 12 * s, y + 0.6 * s);
    path.close();
    path.moveTo(x - 2 * s, y - 1 * s);
    path.quadTo(x + 4 * s, y - 14 * s * f - 4 * s, x + 14 * s, y - 20 * s * f);
    path.quadTo(x + 8 * s, y - 6 * s * f, x + 6 * s, y);
    path.close();
    return path;
  });
  return <Path path={q} color={c.forest} />;
}

const PETALS = 66;

function PetalStorm({ p, clock, L, c }) {
  const { k, width, height } = L;
  const d = useDerivedValue(() => {
    const out = [Skia.Path.Make(), Skia.Path.Make(), Skia.Path.Make()];
    const u = eventU(p, clock.value, 1);
    if (u > 1) return out;
    const t = clock.value;
    for (let i = 0; i < PETALS; i += 1) {
      const e = (u - 0.36 - hash(i, 211) * 0.18) / 0.4;
      if (e <= 0 || e >= 1) continue;
      const left = i % 2 === 0;
      const sx = left ? width * 0.05 * hash(i, 212) : width * (1 - 0.05 * hash(i, 212));
      const sy = height * (0.02 + hash(i, 213) * 0.2);
      const dx = (left ? 1 : -1) * e * width * (0.5 + hash(i, 214) * 0.6);
      const x = sx + dx + Math.sin(e * 8 + i) * 30 * k;
      const y = sy + e * height * (0.4 + hash(i, 215) * 0.4) + Math.cos(e * 6 + i) * 20 * k;
      const r = t * (2 + hash(i, 216) * 3) + i;
      const ca = Math.cos(r) * 3.4 * k;
      const sa = Math.sin(r) * 1.6 * k;
      const path = out[i % 3];
      path.moveTo(x - ca, y - sa);
      path.quadTo(x - sa, y + ca * 0.5, x + ca, y + sa);
      path.quadTo(x + sa, y - ca * 0.5, x - ca, y - sa);
      path.close();
    }
    return out;
  });
  const a = useDerivedValue(() => d.value[0]);
  const b = useDerivedValue(() => d.value[1]);
  const cc = useDerivedValue(() => d.value[2]);
  return (
    <Group>
      <Path path={a} color={c.wis1} />
      <Path path={b} color={c.wis2} />
      <Path path={cc} color={c.wis3} />
    </Group>
  );
}

export default function DemonSlayerScene({ p, clock, width, height, tone, lightSurface }) {
  const L = useMemo(() => dsLayout(width, height), [width, height]);
  const land = useMemo(() => buildLand(L), [L]);
  const house = useMemo(() => buildHouse(L), [L]);
  const wisL = useMemo(() => buildWisteria(L, -1), [L]);
  const wisR = useMemo(() => buildWisteria(L, 1), [L]);
  const c = useMemo(() => toneMap(DS_TONE, tone.colors), [tone]);
  const { k, base } = L;
  const night = !lightSurface;
  const [mx, my, mr] = L.moon;
  const shojiA = useDerivedValue(() => 0.85 + 0.07 * Math.sin(clock.value * 2.2) + 0.05 * Math.sin(clock.value * 5.3));
  // dalga sırasında ay ışığı serinler
  const cool = useDerivedValue(() => {
    const u = eventU(p, clock.value, 0);
    return u > 1 ? 0 : 0.35 * sm(0.3, 0.45, u) * (1 - sm(0.75, 0.9, u));
  });
  const [slx, sly] = house.stoneLamp;
  return (
    <Group opacity={tone.alpha}>
      {/* dolunay */}
      <Glow cx={mx} cy={my} r={mr * 4} color={c.moonGlow} a={night ? 0.3 : 0.35} mid={0.3} />
      <Circle cx={mx} cy={my} r={mr} color={c.moon} />
      <Circle cx={mx - mr * 0.3} cy={my - mr * 0.2} r={mr * 0.22} color={c.moonGlow} opacity={0.25} />
      <Circle cx={mx + mr * 0.35} cy={my + mr * 0.3} r={mr * 0.14} color={c.moonGlow} opacity={0.22} />
      <Group opacity={cool}>
        <Glow cx={mx} cy={my} r={mr * 5} color={c.water} a={0.5} mid={0.35} />
      </Group>
      {/* dağlar, orman */}
      <Path path={land.far} color={c.mountFar} />
      <Path path={land.near} color={c.mountNear} />
      <Path path={land.forest} color={c.forest} />
      <DemonEyes p={p} clock={clock} L={L} c={c} />
      <Crow p={p} clock={clock} L={L} c={c} />
      {/* ev */}
      <Path path={house.wall} color={c.wall} />
      <Group opacity={shojiA}>
        <Path path={house.shoji} color={c.shoji} />
      </Group>
      <Path path={house.grid} color={c.wall} />
      <Path path={house.deck} color={c.roof} />
      <Path path={house.roof} color={c.roof} />
      {house.lanterns.map(([x, y], i) => (
        <Lantern key={i} x={x} y={y} i={i} clock={clock} c={c} k={k} />
      ))}
      <Glow cx={slx} cy={sly} r={16 * k} color={c.lanternGlow} a={0.6} mid={0.3} />
      <Path path={house.stone} color={c.stone} />
      {/* zemin */}
      <Rect x={0} y={base} width={width} height={height - base}>
        <LinearGradient start={vec(0, base)} end={vec(0, height)} colors={[c.ground, c.forest]} />
      </Rect>
      <Slayer p={p} clock={clock} L={L} c={c} />
      <WaterArc p={p} clock={clock} L={L} c={c} />
      {/* wisteria en önde, üst köşelerde */}
      <Wisteria data={wisL} clock={clock} side={-1} c={c} k={k} />
      <Wisteria data={wisR} clock={clock} side={1} c={c} k={k} />
      <PetalStorm p={p} clock={clock} L={L} c={c} />
    </Group>
  );
}
