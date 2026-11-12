// components/decor/deathNoteScene.js
//
// Death Note evren sahnesi (OVERLAY.dnVec = 51) — tamamı VEKTÖR; önünde siyah tüyler süzülür:
//   • Gece çatısı: iri soluk dolunay, önünden geçen ince bulutlar; uzakta ışıklı pencereli şehir
//     ve kırmızı ikaz lambalı anten; solda su deposu.
//   • Önde beton korkuluk; üstünde açık siyah defter — sağ sayfaya mürekkep satırları kendiliğinden
//     yazılır, sayfa dolunca rüzgârla çevrilir — ve yanında kırmızı bir elma.
//   • Olay (72 sn'de bir ~28 sn): yırtık kanatlı, sivri saçlı uzun bir ölüm meleği aydan süzülüp
//     korkuluğun üstünde asılı kalır; elma eline yükselir, bir ısırık alınır, gözleri parlar,
//     sırıtır; sonra elmayla birlikte göğe çekilip gider.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[51] (DN_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Circle, Group, LinearGradient, Path, RadialGradient, Rect, Skia, vec } from "@shopify/react-native-skia";
import { restU } from "../../utils/weatherParticles";
import { Glow, addCloud, groundLayout, hash, rgba, sm, toneMap } from "./seasonKit";

export const DN_TONE = [
  "sky",
  "moon",
  "moonGlow",
  "cloud",
  "cityFar",
  "city",
  "window",
  "beacon",
  "roof",
  "roofEdge",
  "rail",
  "tank",
  "note",
  "noteEdge",
  "page",
  "line",
  "ink",
  "apple",
  "appleHi",
  "leaf",
  "shini",
  "wing",
  "eye",
  "grin",
];

export function dnLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  const ledge = ground - 34 * k; // korkuluk üstü
  return {
    ...L,
    ledge,
    moon: [width * 0.6, height * 0.25, 74 * k],
    note: [width * 0.54, ledge],
    apple: [width * 0.8, ledge - 9 * k],
    hover: [width * 0.36, ledge - 170 * k],
  };
}

function buildCity(L) {
  const { k, width, ledge } = L;
  const far = Skia.Path.Make();
  const near = Skia.Path.Make();
  const winA = Skia.Path.Make();
  const winB = Skia.Path.Make();
  let x = -10 * k;
  let i = 0;
  while (x < width + 10 * k) {
    const w = (16 + hash(i, 1) * 22) * k;
    const h = (60 + hash(i, 2) * 120) * k;
    far.addRect(Skia.XYWHRect(x, ledge - h, w + 1, h + 4));
    x += w;
    i += 1;
  }
  x = -10 * k;
  i = 0;
  const beacons = [];
  while (x < width + 10 * k) {
    const w = (24 + hash(i, 11) * 30) * k;
    const t = hash(i, 12);
    const h = (40 + t * t * 160) * k;
    const top = ledge - h;
    near.addRect(Skia.XYWHRect(x, top, w + 1, h + 4));
    if (h > 150 * k) beacons.push([x + w / 2, top - 2 * k]);
    const cols = Math.max(1, Math.floor((w - 6 * k) / (6.5 * k)));
    const rows = Math.max(1, Math.floor((h - 10 * k) / (8 * k)));
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const v = hash(i * 37 + r * 5 + c, 13);
        if (v > 0.3) continue;
        (v < 0.15 ? winA : winB).addRect(Skia.XYWHRect(x + 4 * k + c * 6.5 * k, top + 6 * k + r * 8 * k, 3 * k, 4 * k));
      }
    }
    x += w + 3 * k;
    i += 1;
  }
  // anten direği
  const mast = Skia.Path.Make();
  const ax = width * 0.86;
  const ab = ledge - 120 * k;
  mast.moveTo(ax - 7 * k, ab);
  mast.lineTo(ax, ab - 110 * k);
  mast.lineTo(ax + 7 * k, ab);
  mast.close();
  beacons.push([ax, ab - 112 * k]);
  // su deposu (sol)
  const tank = Skia.Path.Make();
  const tx = width * 0.12;
  tank.addRect(Skia.XYWHRect(tx - 26 * k, ledge - 80 * k, 52 * k, 50 * k));
  tank.addOval(Skia.XYWHRect(tx - 26 * k, ledge - 86 * k, 52 * k, 12 * k));
  for (const lx of [-22, -4, 18]) tank.addRect(Skia.XYWHRect(tx + lx * k, ledge - 32 * k, 3 * k, 32 * k));
  tank.addRect(Skia.XYWHRect(tx - 28 * k, ledge - 34 * k, 56 * k, 3 * k));
  return { far, near, winA, winB, beacons, mast, tank };
}

const NOTE_K = 1.5; // defter büyütmesi

function buildNotebook(L) {
  const k = L.k * NOTE_K;
  const [nx, ny] = L.note;
  // perspektifli açık defter: omurga nx, sayfalar korkuluğa yatık
  const P = (x, y) => [nx + x * k, ny + y * k];
  const quad = (pts) => {
    const q = Skia.Path.Make();
    pts.forEach(([x, y], i) => {
      const [a, b] = P(x, y);
      if (i) q.lineTo(a, b);
      else q.moveTo(a, b);
    });
    q.close();
    return q;
  };
  const cover = quad([[-46, -2], [-40, -14], [40, -14], [46, -2]]);
  const left = quad([[-43, -3.5], [-38, -13], [-1, -13.5], [-1, -3]]);
  const right = quad([[1, -3], [1, -13.5], [38, -13], [43, -3.5]]);
  const lines = Skia.Path.Make();
  for (let r = 0; r < 6; r += 1) {
    const f = (r + 0.8) / 6.6;
    const y = -13 + f * 9.5;
    const xl = -38 - f * 5;
    const xr = 38 + f * 5;
    let [a, b] = P(xl + 3, y);
    let [c, d] = P(-3, y);
    lines.moveTo(a, b);
    lines.lineTo(c, d);
    [a, b] = P(3, y);
    [c, d] = P(xr - 3, y);
    lines.moveTo(a, b);
    lines.lineTo(c, d);
  }
  return { cover, left, right, lines };
}

// ───────────────────────────── kare başına

/** Sağ sayfaya yazılan satırlar (10 sn'lik döngü) + çevrilen sayfa. */
function notePaths(t, nx, ny, k) {
  "worklet";
  const per = 11;
  const f = (t % per) / per;
  const ink = Skia.Path.Make();
  const flip = Skia.Path.Make();
  const P = (x, y) => [nx + x * k, ny + y * k];
  const write = f < 0.82 ? f / 0.82 : 1;
  for (let r = 0; r < 6; r += 1) {
    const lf = write * 6 - r;
    if (lf <= 0) break;
    const q = lf > 1 ? 1 : lf;
    const fr = (r + 0.8) / 6.6;
    const y = -13 + fr * 9.5 - 0.9;
    const x0 = 4;
    const x1 = x0 + (30 + fr * 4 - (r % 3) * 5) * q;
    let [a, b] = P(x0, y);
    ink.moveTo(a, b);
    for (let x = x0 + 1.4; x <= x1; x += 1.4) {
      [a, b] = P(x, y + Math.sin(x * 2.3 + r) * 0.45 - (Math.floor(x / 4) % 2) * 0.3);
      ink.lineTo(a, b);
    }
  }
  if (f > 0.86) {
    // sayfa omurga etrafında döner (sağdan sola), havada kavis çizer
    const g = (f - 0.86) / 0.14;
    const c = Math.cos(g * Math.PI);
    const lift = Math.sin(g * Math.PI) * 12;
    const [s0x, s0y] = P(0, -3);
    const [s1x, s1y] = P(0, -13.5);
    const [e0x, e0y] = P(43 * c, -3.5 - lift);
    const [e1x, e1y] = P(38 * c, -13 - lift);
    flip.moveTo(s0x, s0y);
    flip.lineTo(e0x, e0y);
    flip.lineTo(e1x, e1y);
    flip.lineTo(s1x, s1y);
    flip.close();
  }
  return { ink, flip, write: f < 0.86 ? 1 : 0 };
}

/** Ölüm meleğinin konumu: aydan iner, asılı kalır, göğe çekilir. */
function shiniAt(u, L) {
  "worklet";
  const [hx, hy] = L.hover;
  const [mx, my] = L.moon;
  if (u < 0.06 || u > 0.86) return { on: 0, x: -999, y: -999, s: 1 };
  if (u < 0.24) {
    const e = sm(0.06, 0.24, u);
    return { on: sm(0.06, 0.1, u), x: mx + (hx - mx) * e, y: my - 140 * L.k + (hy - my + 140 * L.k) * e, s: 0.55 + 0.45 * e };
  }
  if (u < 0.7) return { on: 1, x: hx, y: hy, s: 1 };
  const e = sm(0.7, 0.86, u);
  return { on: 1 - sm(0.8, 0.86, u), x: hx + 60 * L.k * e, y: hy - (hy + 200 * L.k) * e, s: 1 - 0.4 * e };
}

function shiniPaths(t, k) {
  "worklet";
  const s = (v) => v * k;
  const body = Skia.Path.Make();
  const wingL = Skia.Path.Make();
  const wingR = Skia.Path.Make();
  // yırtık kanat (sağ; sol aynası)
  const wing = (q, sg) => {
    q.moveTo(s(4 * sg), s(-30));
    q.lineTo(s(30 * sg), s(-62));
    q.lineTo(s(70 * sg), s(-74));
    q.lineTo(s(96 * sg), s(-58));
    q.lineTo(s(84 * sg), s(-48));
    q.lineTo(s(92 * sg), s(-34));
    q.lineTo(s(74 * sg), s(-30));
    q.lineTo(s(80 * sg), s(-14));
    q.lineTo(s(60 * sg), s(-16));
    q.lineTo(s(62 * sg), s(2));
    q.lineTo(s(42 * sg), s(-8));
    q.lineTo(s(36 * sg), s(10));
    q.lineTo(s(22 * sg), s(-10));
    q.lineTo(s(8 * sg), s(-14));
    q.close();
    // kemik
    q.moveTo(s(6 * sg), s(-31));
    q.lineTo(s(70 * sg), s(-75));
    q.lineTo(s(71 * sg), s(-72));
    q.lineTo(s(8 * sg), s(-28));
    q.close();
  };
  wing(wingL, -1);
  wing(wingR, 1);
  // gövde: dar göğüs, kemerli bel, ince uzun bacaklar
  body.moveTo(s(-11), s(-36));
  body.quadTo(s(0), s(-42), s(11), s(-36));
  body.lineTo(s(8), s(-4));
  body.lineTo(s(10), s(6));
  body.lineTo(s(-10), s(6));
  body.lineTo(s(-8), s(-4));
  body.close();
  const sway = Math.sin(t * 1.3) * 0.08;
  [[-5, 1], [5, -1]].forEach(([x, sg]) => {
    const a = sway * sg + 0.06 * sg;
    const kx = s(x) + Math.sin(a) * s(30);
    const ky = s(6) + Math.cos(a) * s(30);
    body.moveTo(s(x - 3), s(5));
    body.lineTo(s(x + 3), s(5));
    body.lineTo(kx + s(2), ky);
    body.lineTo(kx + s(1) + Math.sin(a * 2) * s(26), ky + s(28));
    body.lineTo(kx - s(3) + Math.sin(a * 2) * s(26), ky + s(28));
    body.lineTo(kx - s(2), ky);
    body.close();
  });
  // kollar: sol sarkık, sağ öne uzanır (elma)
  body.moveTo(s(-10), s(-34));
  body.lineTo(s(-22), s(-6));
  body.lineTo(s(-24), s(18));
  body.lineTo(s(-20), s(18));
  body.lineTo(s(-18), s(-6));
  body.lineTo(s(-7), s(-30));
  body.close();
  body.moveTo(s(10), s(-34));
  body.lineTo(s(30), s(-18));
  body.lineTo(s(46), s(-14));
  body.lineTo(s(46), s(-10));
  body.lineTo(s(28), s(-13));
  body.lineTo(s(7), s(-28));
  body.close();
  // parmaklar
  for (let j = 0; j < 3; j += 1) {
    body.moveTo(s(45), s(-14 + j * 1.6));
    body.lineTo(s(53), s(-17 + j * 3));
    body.lineTo(s(53), s(-15.6 + j * 3));
    body.lineTo(s(45), s(-12.6 + j * 1.6));
    body.close();
  }
  // baş + sivri saç
  body.addOval(Skia.XYWHRect(s(-9), s(-60), s(18), s(22)));
  for (let j = 0; j < 11; j += 1) {
    const a = -Math.PI + (j / 10) * Math.PI;
    const r0 = s(9);
    const r1 = s(16 + (j % 2) * 6 + Math.sin(j * 1.7) * 2);
    const cx = 0;
    const cy = s(-50);
    body.moveTo(cx + Math.cos(a - 0.16) * r0, cy + Math.sin(a - 0.16) * r0);
    body.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 - s(2));
    body.lineTo(cx + Math.cos(a + 0.16) * r0, cy + Math.sin(a + 0.16) * r0);
    body.close();
  }
  // sırıtma (geniş hilal) + dişler
  const grin = Skia.Path.Make();
  grin.moveTo(s(-7), s(-45));
  grin.quadTo(s(0), s(-38), s(7), s(-45));
  grin.quadTo(s(0), s(-41.5), s(-7), s(-45));
  grin.close();
  const teeth = Skia.Path.Make();
  for (let j = -3; j <= 3; j += 1) {
    teeth.moveTo(s(j * 2), s(-44.5 + Math.abs(j) * -0.2));
    teeth.lineTo(s(j * 2), s(-41.5 - Math.abs(j) * 0.4));
  }
  return { body, wingL, wingR, grin, teeth };
}

function applePath(cx, cy, r, bitten) {
  "worklet";
  const q = Skia.Path.Make();
  // iki loblu gövde
  q.moveTo(cx, cy - r * 0.72);
  q.cubicTo(cx + r * 0.5, cy - r * 1.12, cx + r * 1.12, cy - r * 0.8, cx + r * 1.02, cy - r * 0.05);
  if (bitten) {
    // sağ yanda ısırık çentiği (üç diş izi)
    q.lineTo(cx + r * 0.98, cy + r * 0.05);
    q.quadTo(cx + r * 0.55, cy + r * 0.1, cx + r * 0.62, cy + r * 0.32);
    q.quadTo(cx + r * 0.5, cy + r * 0.45, cx + r * 0.66, cy + r * 0.56);
    q.quadTo(cx + r * 0.6, cy + r * 0.66, cx + r * 0.78, cy + r * 0.62);
  }
  q.cubicTo(cx + r * 0.9, cy + r * 0.8, cx + r * 0.4, cy + r * 1.05, cx, cy + r * 0.88);
  q.cubicTo(cx - r * 0.4, cy + r * 1.05, cx - r * 1.12, cy + r * 0.7, cx - r * 1.02, cy - r * 0.05);
  q.cubicTo(cx - r * 1.12, cy - r * 0.8, cx - r * 0.5, cy - r * 1.12, cx, cy - r * 0.72);
  q.close();
  return q;
}

// ───────────────────────────── parçalar

function Apple({ p, clock, L, c }) {
  const { k } = L;
  const [ax, ay] = L.apple;
  const r = 8 * k;
  const st = useDerivedValue(() => {
    const u = restU(p, clock.value);
    const sh = shiniAt(u > 1 ? 2 : u, L);
    const hand = [sh.x + 52 * k * sh.s, sh.y - 13 * k * sh.s];
    let x = ax;
    let y = ay;
    let bitten = 0;
    let alpha = 1;
    if (u <= 1 && u >= 0.3) {
      const e = sm(0.3, 0.42, u);
      x = ax + (hand[0] - ax) * e;
      y = ay + (hand[1] - ay) * e - Math.sin(e * Math.PI) * 30 * k;
      if (u > 0.5) bitten = 1;
      // melekle gider; dinlenmede yerine yeni elma belirir
      if (u > 0.8) alpha = 1 - sm(0.8, 0.86, u);
    }
    if (u > 1) alpha = sm(1, 1.2, u);
    return { x, y, bitten, alpha };
  });
  const path = useDerivedValue(() => applePath(0, 0, r, st.value.bitten));
  const at = useDerivedValue(() => [{ translateX: st.value.x }, { translateY: st.value.y }, { rotate: Math.sin(clock.value * 1.6) * 0.05 }]);
  const alpha = useDerivedValue(() => st.value.alpha);
  return (
    <Group opacity={alpha}>
      <Group transform={at}>
        <Path path={path}>
          <RadialGradient c={vec(-r * 0.35, -r * 0.35)} r={r * 1.6} colors={[c.appleHi, c.apple, rgba(c.apple, 1)]} positions={[0, 0.45, 1]} />
        </Path>
        <Path path={`M 0 ${-r * 0.7} Q ${r * 0.1} ${-r * 1.2} ${r * 0.3} ${-r * 1.35}`} style="stroke" strokeWidth={1.4 * k} strokeCap="round" color={c.ink} />
        <Path path={`M ${r * 0.2} ${-r * 1.05} Q ${r * 0.8} ${-r * 1.5} ${r * 1.0} ${-r * 0.95} Q ${r * 0.6} ${-r * 0.8} ${r * 0.2} ${-r * 1.05} Z`} color={c.leaf} />
      </Group>
    </Group>
  );
}

function Shinigami({ p, clock, L, c, night }) {
  const { k } = L;
  const d = useDerivedValue(() => shiniPaths(clock.value, k));
  const body = useDerivedValue(() => d.value.body);
  const wingL = useDerivedValue(() => d.value.wingL);
  const wingR = useDerivedValue(() => d.value.wingR);
  const grin = useDerivedValue(() => d.value.grin);
  const teeth = useDerivedValue(() => d.value.teeth);
  const st = useDerivedValue(() => shiniAt(restU(p, clock.value), L));
  const at = useDerivedValue(() => [
    { translateX: st.value.x },
    { translateY: st.value.y + Math.sin(clock.value * 1.1) * 5 * k },
    { scale: st.value.s },
  ]);
  const on = useDerivedValue(() => st.value.on);
  const flapL = useDerivedValue(() => [{ translateX: -4 * k }, { translateY: -30 * k }, { rotate: Math.sin(clock.value * 2.2) * 0.16 }, { translateX: 4 * k }, { translateY: 30 * k }]);
  const flapR = useDerivedValue(() => [{ translateX: 4 * k }, { translateY: -30 * k }, { rotate: -Math.sin(clock.value * 2.2) * 0.16 }, { translateX: -4 * k }, { translateY: 30 * k }]);
  const eyes = useDerivedValue(() => {
    const u = restU(p, clock.value);
    return u > 1 ? 0 : 0.75 + 0.25 * sm(0.44, 0.52, u) * (1 - sm(0.62, 0.7, u));
  });
  return (
    <Group opacity={on}>
      <Group transform={at}>
        <Group transform={flapL}>
          <Path path={wingL} color={c.wing} />
        </Group>
        <Group transform={flapR}>
          <Path path={wingR} color={c.wing} />
        </Group>
        <Path path={body} color={c.shini} />
        {night ? <Path path={body} style="stroke" strokeWidth={0.8 * k} color={c.roofEdge} opacity={0.5} /> : null}
        <Path path={grin} color={c.grin} />
        <Path path={teeth} style="stroke" strokeWidth={0.5 * k} color={c.shini} />
        <Group opacity={eyes}>
          <Glow cx={-3.6 * k} cy={-52 * k} r={7 * k} color={c.eye} a={0.8} mid={0.35} />
          <Glow cx={3.6 * k} cy={-52 * k} r={7 * k} color={c.eye} a={0.8} mid={0.35} />
          <Circle cx={-3.6 * k} cy={-52 * k} r={2.6 * k} color={c.eye} />
          <Circle cx={3.6 * k} cy={-52 * k} r={2.6 * k} color={c.eye} />
          <Circle cx={-3.6 * k} cy={-52 * k} r={0.9 * k} color={c.shini} />
          <Circle cx={3.6 * k} cy={-52 * k} r={0.9 * k} color={c.shini} />
        </Group>
      </Group>
    </Group>
  );
}

function Notebook({ clock, L, c }) {
  const { k } = L;
  const [nx, ny] = L.note;
  const geo = useMemo(() => buildNotebook(L), [L]);
  const d = useDerivedValue(() => notePaths(clock.value, nx, ny, k * NOTE_K));
  const ink = useDerivedValue(() => d.value.ink);
  const flip = useDerivedValue(() => d.value.flip);
  return (
    <Group>
      <Path path={geo.cover} color={c.note} />
      <Path path={geo.cover} style="stroke" strokeWidth={0.8 * k} color={c.noteEdge} />
      <Path path={geo.left} color={c.page} />
      <Path path={geo.right} color={c.page} />
      <Path path={geo.lines} style="stroke" strokeWidth={0.4 * k} color={c.line} />
      <Path path={ink} style="stroke" strokeWidth={0.75 * k} strokeJoin="round" color={c.ink} />
      <Path path={flip} color={c.page} />
      <Path path={flip} style="stroke" strokeWidth={0.5 * k} color={c.line} />
      <Rect x={nx - 0.9 * k} y={ny - 20 * k} width={1.8 * k} height={15.5 * k} color={c.line} />
    </Group>
  );
}

function Beacon({ clock, x, y, i, k, c }) {
  const op = useDerivedValue(() => (Math.sin(clock.value * 1.8 + i * 2.1) > 0.4 ? 1 : 0.15));
  return (
    <Group opacity={op}>
      <Glow cx={x} cy={y} r={8 * k} color={c.beacon} a={0.9} mid={0.4} />
      <Circle cx={x} cy={y} r={1.5 * k} color={c.beacon} />
    </Group>
  );
}

export default function DeathNoteScene({ p, clock, width, height, tone, lightSurface }) {
  const L = useMemo(() => dnLayout(width, height), [width, height]);
  const city = useMemo(() => buildCity(L), [L]);
  const clouds = useMemo(() => {
    const q = Skia.Path.Make();
    addCloud(q, 0, 0, 210 * L.k, 24 * L.k, 4);
    addCloud(q, 50 * L.k, -12 * L.k, 110 * L.k, 20 * L.k, 7);
    addCloud(q, 190 * L.k, 46 * L.k, 170 * L.k, 16 * L.k, 9);
    return q;
  }, [L]);
  const c = useMemo(() => toneMap(DN_TONE, tone.colors), [tone]);
  const { k, ground, ledge } = L;
  const night = !lightSurface;
  const [mx, my, mr] = L.moon;
  const stars = useMemo(() => {
    const q = Skia.Path.Make();
    for (let i = 0; i < 26; i += 1) {
      const x = hash(i, 41) * width;
      const y = hash(i, 42) * L.ledge * 0.55;
      if (Math.hypot(x - mx, y - my) < mr * 1.6) continue;
      q.addCircle(x, y, (0.5 + hash(i, 43) * 0.7) * L.k);
    }
    return q;
  }, [L, width, mx, my, mr]);
  const cloudT = useDerivedValue(() => {
    const span = width + 520 * k;
    return [{ translateX: ((clock.value * 4.5 * k) % span) - 340 * k }, { translateY: my + 20 * k }];
  });
  const winA = useDerivedValue(() => 0.7 + 0.3 * Math.sin(clock.value * 0.8));
  const winB = useDerivedValue(() => 0.7 + 0.3 * Math.sin(clock.value * 0.6 + 2));
  return (
    <Group opacity={tone.alpha}>
      {/* gök ve ay */}
      <Glow cx={mx} cy={my} r={260 * k} color={c.sky} a={night ? 0.9 : 0.7} mid={0.55} />
      {night ? <Path path={stars} color={c.moon} opacity={0.45} /> : null}
      <Glow cx={mx} cy={my} r={170 * k} color={c.moonGlow} a={night ? 0.22 : 0.4} mid={0.3} />
      <Circle cx={mx} cy={my} r={mr}>
        <RadialGradient c={vec(mx - mr * 0.3, my - mr * 0.35)} r={mr * 1.4} colors={[c.moon, c.moonGlow]} />
      </Circle>
      <Group opacity={0.35}>
        <Circle cx={mx + mr * 0.32} cy={my - mr * 0.12} r={mr * 0.2} color={c.moonGlow} />
        <Circle cx={mx - mr * 0.3} cy={my + mr * 0.3} r={mr * 0.26} color={c.moonGlow} />
        <Circle cx={mx - mr * 0.1} cy={my - mr * 0.5} r={mr * 0.1} color={c.moonGlow} />
      </Group>
      <Shinigami p={p} clock={clock} L={L} c={c} night={night} />
      <Group transform={cloudT} opacity={night ? 0.8 : 0.7}>
        <Path path={clouds} color={c.cloud} />
      </Group>
      {/* şehir */}
      <Path path={city.far} color={c.cityFar} />
      <Path path={city.mast} color={c.city} />
      <Path path={city.mast} style="stroke" strokeWidth={0.8 * k} color={c.roofEdge} opacity={0.6} />
      <Path path={city.near} color={c.city} />
      <Group opacity={winA}>
        <Path path={city.winA} color={c.window} />
      </Group>
      <Group opacity={winB}>
        <Path path={city.winB} color={c.window} opacity={0.7} />
      </Group>
      {city.beacons.map(([x, y], i) => (
        <Beacon key={`b${i}`} clock={clock} x={x} y={y} i={i} k={k} c={c} />
      ))}
      {/* çatı: depo, korkuluk, zemin */}
      <Path path={city.tank} color={c.tank} />
      <Rect x={0} y={ledge} width={width} height={height - ledge + 10}>
        <LinearGradient start={vec(0, ledge)} end={vec(0, height)} colors={[c.roof, c.note]} />
      </Rect>
      <Rect x={0} y={ledge} width={width} height={3 * k} color={c.roofEdge} />
      {[0.04, 0.3, 0.7, 0.96].map((f) => (
        <Rect key={f} x={width * f - 1.5 * k} y={ledge - 28 * k} width={3 * k} height={28 * k} color={c.rail} />
      ))}
      <Rect x={0} y={ledge - 29 * k} width={width * 0.42} height={2.4 * k} color={c.rail} />
      <Rect x={width * 0.66} y={ledge - 29 * k} width={width * 0.34} height={2.4 * k} color={c.rail} />
      <Rect x={0} y={ledge - 15 * k} width={width * 0.42} height={1.6 * k} color={c.rail} />
      <Rect x={width * 0.66} y={ledge - 15 * k} width={width * 0.34} height={1.6 * k} color={c.rail} />
      <Rect x={0} y={ground} width={width} height={1.4 * k} color={c.roofEdge} opacity={0.4} />
      <Notebook clock={clock} L={L} c={c} />
      <Apple p={p} clock={clock} L={L} c={c} />
    </Group>
  );
}
