// components/decor/lastOfUsScene.js
//
// The Last of Us evren sahnesi (OVERLAY.tlVec = 60) — tamamı VEKTÖR:
//   • Doğanın geri aldığı şehir: arkada pus içinde gökdelen silüetleri; ortada tepesi kırık, camları
//     boş iskelet kuleler (biri yana yaslanmış), cephelerden sarkan sarmaşıklar, çatılarda biten ağaçlar,
//     yosun kaplı kenarlar. Binaların arasından süzülen eğik ışık hüzmeleri (yavaş nefes alır).
//   • Önde su basmış cadde: durgun su, yansıyan ışık, kenarlarda uzun çimen ve çalı.
//   • Olay (70 sn'de bir ~27 sn): iki zürafa (biri genç) soldan sağa ağır adımlarla yürür — boyunları
//     yürüyüşle sallanır, ayakları suda halka bırakır; aynı anda bir kuş sürüsü çatıdan havalanır.
//   • Olay B (dönüşümlü): çimenlerden ateş böcekleri yükselir ve salınarak süzülür; sırt çantalı
//     iki yolcu (biri ufak tefek) feneriyle önündeki suyu aydınlatarak caddeyi soldan sağa geçer.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[60] (TL_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Group, LinearGradient, Path, Rect, Skia, vec } from "@shopify/react-native-skia";
import { eventU } from "../../utils/weatherParticles";
import { Glow, groundLayout, hash, rgba, sm, toneMap } from "./seasonKit";

export const TL_TONE = [
  "ray",
  "bldFar",
  "bldMid",
  "bldNear",
  "window",
  "moss",
  "vine",
  "leaf",
  "leafLight",
  "water",
  "waterHi",
  "grass",
  "giraffe",
  "spot",
  "bird",
  "fog",
];

export function tlLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  return {
    ...L,
    base: ground - 10 * k,
    water: ground - 4 * k,
    walk: ground + 8 * k,
  };
}

// ───────────────────────────── durağan yollar

/** Kırık tepeli kule: gövde + boş pencere ızgarası + kırık üst kenar. */
function addTower(body, holes, x, b, w, h, seed, k) {
  const top = b - h;
  body.moveTo(x, b);
  body.lineTo(x, top + 10 * k);
  // kırık, dişli üst kenar
  const n = 6;
  for (let i = 0; i <= n; i += 1) {
    const fx = x + (w * i) / n;
    const dy = (hash(seed, i) * 26 - (i % 2) * 6) * k;
    body.lineTo(fx, top + dy);
  }
  body.lineTo(x + w, b);
  body.close();
  const cols = Math.max(2, Math.floor(w / (9 * k)));
  for (let r = 0; top + 30 * k + r * 12 * k < b - 10 * k; r += 1)
    for (let cI = 0; cI < cols; cI += 1) {
      if (hash(seed * 13 + r, cI) < 0.22) continue; // bazı pencereler örtülü
      holes.addRect(Skia.XYWHRect(x + 4 * k + cI * ((w - 8 * k) / cols), top + 30 * k + r * 12 * k, ((w - 8 * k) / cols) * 0.6, 7 * k));
    }
}

function buildCity(L) {
  const { k, width, base } = L;
  const far = Skia.Path.Make();
  for (let x = -10 * k, i = 0; x < width + 10 * k; i += 1) {
    const w = (26 + hash(i, 1) * 30) * k;
    const h = (180 + hash(i, 2) * 160) * k;
    far.addRect(Skia.XYWHRect(x, base - h, w, h));
    if (hash(i, 3) > 0.6) far.addRect(Skia.XYWHRect(x + w * 0.4, base - h - 24 * k, 3 * k, 24 * k));
    x += w + (6 + hash(i, 4) * 18) * k;
  }
  const mid = Skia.Path.Make();
  const midHoles = Skia.Path.Make();
  const towers = [
    [-6 * k, 64 * k, 300 * k],
    [width * 0.26, 58 * k, 230 * k],
    [width * 0.7, 74 * k, 330 * k],
  ];
  towers.forEach(([x, w, h], i) => addTower(mid, midHoles, x, base, w, h, i + 3, k));
  // yana yaslanmış kule (ayrı çizilir, dönük)
  const lean = Skia.Path.Make();
  const leanHoles = Skia.Path.Make();
  addTower(lean, leanHoles, -30 * k, 0, 60 * k, 250 * k, 11, k);
  // sarmaşıklar: kule cephelerinden sarkan, uçları kıvrık
  const vines = Skia.Path.Make();
  const leaves = Skia.Path.Make();
  towers.forEach(([x, w, h], i) => {
    for (let j = 0; j < 5; j += 1) {
      const vx = x + w * (0.1 + 0.2 * j) + hash(i, j) * 6 * k;
      const top = base - h + (20 + hash(j, i) * 40) * k;
      const len = (60 + hash(i * 3, j) * 140) * k;
      vines.moveTo(vx, top);
      vines.cubicTo(vx + 6 * k, top + len * 0.3, vx - 6 * k, top + len * 0.6, vx + 2 * k, top + len);
      for (let y = top + 8 * k; y < top + len; y += 9 * k) {
        const lx = vx + Math.sin((y - top) / (14 * k) + j) * 4 * k;
        leaves.addOval(Skia.XYWHRect(lx - 3.4 * k, y - 1.8 * k, 6.8 * k, 3.6 * k));
      }
    }
  });
  // yosun: kule kenarlarında ve çatıda yeşil öbekler + çatı ağaçları
  const moss = Skia.Path.Make();
  const canopy = Skia.Path.Make();
  towers.forEach(([x, w, h], i) => {
    for (let j = 0; j < 9; j += 1) moss.addCircle(x + hash(i, j + 20) * w, base - h + (10 + hash(j, i + 20) * 14) * k, (4 + hash(i, j + 30) * 6) * k);
    for (let j = 0; j < 3; j += 1) {
      const cx = x + w * (0.2 + 0.3 * j);
      const cy = base - h - (4 + hash(i, j + 40) * 10) * k;
      for (let m = 0; m < 5; m += 1) canopy.addCircle(cx + (m - 2) * 6 * k, cy - Math.sin((m / 4) * Math.PI) * 8 * k, (7 + hash(m, j) * 4) * k);
    }
  });
  return { far, mid, midHoles, lean, leanHoles, vines, leaves, moss, canopy };
}

function buildStreet(L) {
  const { k, width, water } = L;
  const grass = Skia.Path.Make();
  for (let i = 0; i < 90; i += 1) {
    const x = hash(i, 1) * width;
    const side = x < width * 0.3 || x > width * 0.72 ? 1 : 0.4;
    const h = (6 + hash(i, 2) * 22) * k * side;
    grass.moveTo(x - 1.2 * k, water + 2 * k);
    grass.quadTo(x + (hash(i, 3) - 0.5) * 6 * k, water - h * 0.6, x + (hash(i, 4) - 0.5) * 10 * k, water - h);
    grass.lineTo(x + 1.2 * k, water + 2 * k);
    grass.close();
  }
  // çalılar
  [0.04, 0.18, 0.84, 0.95].forEach((f, i) => {
    for (let m = 0; m < 5; m += 1) grass.addCircle(width * f + (m - 2) * 7 * k, water - (8 + Math.sin((m / 4) * Math.PI) * 10) * k, (8 + hash(i, m) * 5) * k);
  });
  const ripples = Skia.Path.Make();
  for (let i = 0; i < 18; i += 1) {
    const y = water + 10 * k + hash(i, 6) * (L.height - water - 20 * k);
    const len = (14 + hash(i, 7) * 50) * k;
    ripples.addRect(Skia.XYWHRect(hash(i, 8) * width, y, len, 1 * k));
  }
  return { grass, ripples };
}

// ───────────────────────────── zürafa

/** Yandan zürafa (sağa bakar); s ölçek, t yürüyüş saati. Ayaklar aynı yanda birlikte (yürüyüş). */
function giraffePaths(t, s, k) {
  "worklet";
  const u = k * s;
  const body = Skia.Path.Make();
  const spots = Skia.Path.Make();
  const ph = t * 2.6;
  // gövde: geriye eğimli
  body.moveTo(-34 * u, -70 * u);
  body.quadTo(-38 * u, -88 * u, -20 * u, -92 * u);
  body.lineTo(18 * u, -100 * u);
  body.quadTo(34 * u, -100 * u, 34 * u, -84 * u);
  body.quadTo(30 * u, -68 * u, 14 * u, -66 * u);
  body.lineTo(-24 * u, -64 * u);
  body.close();
  // boyun + baş: yürüyüşle öne-arkaya sallanır
  const nod = Math.sin(ph) * 3 * u;
  const hx = 50 * u + nod;
  const hy = -176 * u + Math.abs(Math.sin(ph)) * 2 * u;
  body.moveTo(20 * u, -98 * u);
  body.quadTo(34 * u, -130 * u, hx - 6 * u, hy + 8 * u);
  body.lineTo(hx + 2 * u, hy + 4 * u);
  body.quadTo(40 * u, -128 * u, 34 * u, -88 * u);
  body.close();
  // baş
  body.moveTo(hx - 8 * u, hy + 4 * u);
  body.quadTo(hx - 6 * u, hy - 6 * u, hx + 4 * u, hy - 4 * u);
  body.lineTo(hx + 16 * u, hy + 4 * u);
  body.quadTo(hx + 17 * u, hy + 8 * u, hx + 12 * u, hy + 9 * u);
  body.lineTo(hx, hy + 9 * u);
  body.close();
  // boynuzcuklar + kulak
  body.addRect(Skia.XYWHRect(hx - 2 * u, hy - 12 * u, 1.6 * u, 8 * u));
  body.addRect(Skia.XYWHRect(hx + 1.5 * u, hy - 11 * u, 1.6 * u, 7 * u));
  body.moveTo(hx - 4 * u, hy - 2 * u);
  body.lineTo(hx - 12 * u, hy - 5 * u);
  body.lineTo(hx - 5 * u, hy + 1 * u);
  body.close();
  // kuyruk
  body.moveTo(-34 * u, -80 * u);
  body.quadTo(-42 * u, -64 * u, -40 * u, -52 * u + Math.sin(ph * 0.7) * 2 * u);
  body.lineTo(-38 * u, -52 * u);
  body.quadTo(-38 * u, -66 * u, -32 * u, -76 * u);
  body.close();
  // bacaklar: [omuz x, yan fazı]
  const legs = [
    [24 * u, 0],
    [16 * u, Math.PI],
    [-26 * u, 0],
    [-18 * u, Math.PI],
  ];
  legs.forEach(([lx, off]) => {
    const sw = Math.sin(ph + off);
    const lift = Math.max(0, Math.cos(ph + off)) * 5 * u;
    const kx = lx + sw * 6 * u;
    const fx = lx + sw * 12 * u;
    body.moveTo(lx - 3 * u, -68 * u);
    body.lineTo(kx - 2.4 * u, -34 * u - lift * 0.5);
    body.lineTo(fx - 2 * u, -lift);
    body.lineTo(fx + 2.4 * u, -lift);
    body.lineTo(kx + 2.4 * u, -34 * u - lift * 0.5);
    body.lineTo(lx + 4 * u, -68 * u);
    body.close();
  });
  // lekeler: gövde ve boyunda düzensiz çokgenler
  const spot = (cx, cy, r, seed) => {
    spots.moveTo(cx + r, cy);
    for (let i = 1; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      const rr = r * (0.7 + hash(seed, i) * 0.4);
      spots.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8);
    }
    spots.close();
  };
  for (let i = 0; i < 12; i += 1) spot((-26 + (i % 6) * 10) * u, (-90 + Math.floor(i / 6) * 13) * u + ((i % 2) * 4 - 2) * u, 4 * u, i);
  for (let i = 0; i < 6; i += 1) {
    const f = (i + 0.5) / 6;
    spot(20 * u + (hx - 20 * u) * f + 3 * u, -100 * u + (hy + 10 * u + 100 * u) * f, 3 * u, i + 20);
  }
  return { body, spots };
}

function Giraffe({ p, clock, L, c, s, delay, lane }) {
  const { k, width } = L;
  const d = useDerivedValue(() => giraffePaths(clock.value + delay * 3, s, k));
  const body = useDerivedValue(() => d.value.body);
  const spots = useDerivedValue(() => d.value.spots);
  const at = useDerivedValue(() => {
    const u = eventU(p, clock.value, 0);
    const e = u > 1 ? -1 : (u - 0.04 - delay) / 0.86;
    if (e < 0 || e > 1) return [{ translateX: -900 }, { translateY: -900 }];
    const x = -90 * k + (width + 200 * k) * e;
    return [{ translateX: x }, { translateY: L.walk + lane }];
  });
  // suda yansıma (ters, soluk)
  const refl = useDerivedValue(() => {
    const t = at.value;
    return [...t, { scaleY: -0.45 }];
  });
  return (
    <Group>
      <Group transform={refl} opacity={0.18}>
        <Path path={body} color={c.giraffe} />
      </Group>
      <Group transform={at}>
        <Path path={body} color={c.giraffe} />
        <Path path={spots} color={c.spot} />
      </Group>
    </Group>
  );
}

function Birds({ p, clock, L, c }) {
  const { k, width, base } = L;
  const flock = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const u = eventU(p, clock.value, 0);
    if (u > 1 || u < 0.3 || u > 0.8) return q;
    const e = (u - 0.3) / 0.5;
    for (let i = 0; i < 14; i += 1) {
      const x = width * 0.74 + (hash(i, 1) - 0.3) * 60 * k - e * (width * 0.9) * (0.7 + hash(i, 2) * 0.5);
      const y = base - 330 * k - e * (200 + hash(i, 3) * 160) * k + Math.sin(e * 9 + i) * 8 * k;
      const fl = Math.sin(clock.value * 12 + i * 1.3) * 3 * k;
      q.moveTo(x - 6 * k, y - fl);
      q.quadTo(x - 3 * k, y - 2 * k, x, y);
      q.quadTo(x + 3 * k, y - 2 * k, x + 6 * k, y - fl);
    }
    return q;
  });
  return <Path path={flock} style="stroke" strokeWidth={1.4 * k} strokeCap="round" color={c.bird} />;
}

function Rays({ clock, L, c, night }) {
  const { k, width, base } = L;
  const rays = useMemo(
    () =>
      [0.34, 0.55, 0.62].map((f, i) => {
        const q = Skia.Path.Make();
        const x = width * f;
        const w = (20 + i * 12) * k;
        q.moveTo(x - w, -20 * k);
        q.lineTo(x + w, -20 * k);
        q.lineTo(x + w + 160 * k, base);
        q.lineTo(x - w + 160 * k, base);
        q.close();
        return q;
      }),
    [k, width, base],
  );
  return (
    <Group>
      {rays.map((q, i) => (
        <Ray key={i} q={q} i={i} clock={clock} c={c} base={base} night={night} />
      ))}
    </Group>
  );
}

function Ray({ q, i, clock, c, base, night }) {
  const a = useDerivedValue(() => (night ? 0.18 : 0.32) * (0.65 + 0.35 * Math.sin(clock.value * (0.21 + i * 0.07) + i * 2)));
  return (
    <Group opacity={a}>
      <Path path={q}>
        <LinearGradient start={vec(0, 0)} end={vec(0, base)} colors={[c.ray, rgba(c.ray, 0)]} />
      </Path>
    </Group>
  );
}

// ───────────────────────────── olay B: ateş böcekleri + iki yolcu

function Fireflies({ p, clock, L, c }) {
  const { k, width, water } = L;
  const d = useDerivedValue(() => {
    const core = Skia.Path.Make();
    const halo = Skia.Path.Make();
    const u = eventU(p, clock.value, 1);
    if (u > 1) return { core, halo };
    const on = sm(0.02, 0.2, u) * (1 - sm(0.82, 0.98, u));
    const t = clock.value;
    for (let i = 0; i < 34; i += 1) {
      const blink = Math.max(0, Math.sin(t * (1.3 + hash(i, 111)) + i * 2.3));
      const a = on * blink;
      if (a < 0.08) continue;
      const rise = sm(0, 0.6, u - hash(i, 112) * 0.2) * (60 + hash(i, 113) * 180) * k;
      const x = width * hash(i, 114) + Math.sin(t * 0.5 + i) * 18 * k;
      const y = water + 10 * k - rise + Math.sin(t * 0.8 + i * 3) * 8 * k;
      core.addCircle(x, y, 1.4 * k * a);
      halo.addCircle(x, y, 6 * k * a);
    }
    return { core, halo };
  });
  const core = useDerivedValue(() => d.value.core);
  const halo = useDerivedValue(() => d.value.halo);
  return (
    <Group>
      <Path path={halo} color={c.ray} opacity={0.3} />
      <Path path={core} color={c.ray} />
    </Group>
  );
}

/** Sırt çantalı yürüyen siluet (sağa bakar). */
function addWalker(q, x, y, s, ph) {
  "worklet";
  const bob = Math.abs(Math.sin(ph)) * 0.8 * s;
  const by = y - bob;
  q.addCircle(x + 1 * s, by - 33 * s, 3.4 * s);
  q.addRRect(Skia.RRectXY(Skia.XYWHRect(x - 4 * s, by - 29 * s, 9 * s, 15 * s), 2.5 * s, 2.5 * s));
  q.addRRect(Skia.RRectXY(Skia.XYWHRect(x - 9 * s, by - 28 * s, 6 * s, 11 * s), 2 * s, 2 * s));
  for (let j = 0; j < 2; j += 1) {
    const a = Math.sin(ph + j * Math.PI) * 0.45;
    const lx = x + Math.sin(a) * 7 * s;
    q.moveTo(x - 2.4 * s, by - 15 * s);
    q.lineTo(x + 1.4 * s, by - 15 * s);
    q.lineTo(lx + 1.6 * s, y);
    q.lineTo(lx - 1.6 * s, y);
    q.close();
  }
}

function Travelers({ p, clock, L, c }) {
  const { k, width, walk } = L;
  const d = useDerivedValue(() => {
    const body = Skia.Path.Make();
    const beam = Skia.Path.Make();
    const rings = Skia.Path.Make();
    const u = eventU(p, clock.value, 1);
    if (u > 1) return { body, beam, rings };
    const e = sm(0.12, 0.96, u);
    const x = -40 * k + e * (width + 80 * k);
    const s = k * 1.15;
    const ph = clock.value * 4.2;
    addWalker(body, x, walk, s, ph);
    addWalker(body, x - 22 * k, walk + 3 * k, s * 0.8, ph + 1.1);
    const fx = x + 6 * s;
    const fy = walk - 22 * s;
    beam.moveTo(fx, fy);
    beam.lineTo(fx + 120 * k, fy + 26 * k);
    beam.lineTo(fx + 110 * k, fy + 44 * k);
    beam.close();
    for (let i = 0; i < 3; i += 1) {
      const f = (((clock.value * 0.7 + i / 3) % 1) + 1) % 1;
      const r = (4 + f * 16) * k;
      rings.addOval(Skia.XYWHRect(x - 10 * k * i - r, walk - r * 0.15, r * 2, r * 0.3));
    }
    return { body, beam, rings };
  });
  const body = useDerivedValue(() => d.value.body);
  const beam = useDerivedValue(() => d.value.beam);
  const rings = useDerivedValue(() => d.value.rings);
  return (
    <Group>
      <Path path={beam} color={c.ray} opacity={0.22} />
      <Path path={rings} style="stroke" strokeWidth={0.8 * k} color={c.waterHi} opacity={0.5} />
      <Path path={body} color={c.bldNear} />
    </Group>
  );
}

export default function LastOfUsScene({ p, clock, width, height, tone, lightSurface }) {
  const L = useMemo(() => tlLayout(width, height), [width, height]);
  const city = useMemo(() => buildCity(L), [L]);
  const street = useMemo(() => buildStreet(L), [L]);
  const c = useMemo(() => toneMap(TL_TONE, tone.colors), [tone]);
  const { k, base, water } = L;
  const night = !lightSurface;
  const sway = useDerivedValue(() => [{ translateX: Math.sin(clock.value * 0.8) * 1.5 * k }]);
  const shimmer = useDerivedValue(() => 0.45 + 0.25 * Math.sin(clock.value * 1.1));
  return (
    <Group opacity={tone.alpha}>
      {/* uzak şehir + pus */}
      <Path path={city.far} color={c.bldFar} />
      <Rect x={0} y={base - 260 * k} width={width} height={260 * k}>
        <LinearGradient start={vec(0, base - 260 * k)} end={vec(0, base)} colors={[rgba(c.fog, 0), c.fog]} />
      </Rect>
      <Rays clock={clock} L={L} c={c} night={night} />
      {/* yaslanmış kule */}
      <Group transform={[{ translateX: width * 0.5 }, { translateY: base }, { rotate: 0.32 }]}>
        <Path path={city.lean} color={c.bldMid} />
        <Path path={city.leanHoles} color={c.fog} opacity={0.6} />
      </Group>
      {/* iskelet kuleler, yosun, çatı ağaçları, sarmaşık */}
      <Path path={city.mid} color={c.bldNear} />
      <Path path={city.midHoles} color={c.fog} opacity={night ? 0.45 : 0.55} />
      <Path path={city.moss} color={c.moss} />
      <Path path={city.canopy} color={c.leaf} />
      <Group transform={sway}>
        <Path path={city.vines} style="stroke" strokeWidth={1.4 * k} color={c.vine} />
        <Path path={city.leaves} color={c.leafLight} />
      </Group>
      <Birds p={p} clock={clock} L={L} c={c} />
      {/* su basmış cadde */}
      <Rect x={0} y={water} width={width} height={L.height - water}>
        <LinearGradient start={vec(0, water)} end={vec(0, L.height)} colors={[c.water, c.bldNear]} />
      </Rect>
      <Group opacity={shimmer}>
        <Path path={street.ripples} color={c.waterHi} />
      </Group>
      <Group transform={[{ translateX: width * 0.5 }, { translateY: water + 30 * k }, { scaleX: 1.6 }, { scaleY: 0.25 }]}>
        <Glow r={120 * k} color={c.ray} a={night ? 0.25 : 0.35} mid={0.4} />
      </Group>
      <Giraffe p={p} clock={clock} L={L} c={c} s={1} delay={0} lane={0} />
      <Giraffe p={p} clock={clock} L={L} c={c} s={0.7} delay={0.05} lane={6 * k} />
      <Travelers p={p} clock={clock} L={L} c={c} />
      <Path path={street.grass} color={c.grass} />
      <Fireflies p={p} clock={clock} L={L} c={c} />
    </Group>
  );
}
