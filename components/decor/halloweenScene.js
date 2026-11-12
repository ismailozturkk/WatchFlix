// components/decor/halloweenScene.js
//
// Cadılar Bayramı atmosfer sahnesi (OVERLAY.haunted = 48) — tamamı VEKTÖR; önünde yarasa
// parçacıkları uçar:
//   • Gökte iri dolunay (kraterli, turuncu haleli), önünden ağır ağır geçen ince bulutlar.
//   • Tepede perili köşk: sivri çatılı kule, eğri baca, kemerli pencerelerde titreyen ışık.
//   • Sağda budaklı kuru ağaç (özyinelemeli dallar) ve dalında gözlerini kırpan baykuş; sol üst
//     köşede örümcek ağı, ipinde inip çıkan örümcek.
//   • Önde mezarlık: eğri mezar taşları (yuvarlak, haç, dikili taş), paslı demir parmaklık;
//     yüzleri yanan oyma balkabakları; yerde süzülen sis; mezarlar arasında belirip kaybolan
//     hayaletler (eteği dalgalanır).
//   • Olay (62 sn'de bir ~25 sn): süpürgesindeki kediyle bir cadı ayın önünden geçer; köşkün
//     kulesinden bir yarasa sürüsü fırlar, pencereler ve balkabakları parlar.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[48] (HW_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import {
  Circle,
  Group,
  LinearGradient,
  Oval,
  Path,
  RadialGradient,
  Rect,
  Skia,
  vec,
} from "@shopify/react-native-skia";
import { restU } from "../../utils/weatherParticles";
import {
  Glow,
  TAU,
  addCloud,
  groundLayout,
  hash,
  rgba,
  ridgePath,
  sm,
  toneMap,
} from "./seasonKit";

export const HW_TONE = [
  "sky",
  "moon",
  "moonGlow",
  "crater",
  "cloud",
  "hillFar",
  "hill",
  "house",
  "window",
  "ground",
  "stone",
  "stoneDark",
  "tree",
  "pumpkin",
  "pumpkinDark",
  "stem",
  "carve",
  "fog",
  "ghost",
  "web",
  "witch",
  "eye",
];

export function hwLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  const hx = width * 0.3;
  return {
    ...L,
    moon: [width * 0.7, height * 0.19, 58 * k],
    house: [hx, ground - 65 * k],
    tower: [hx - 50 * k, ground - 65 * k - 128 * k],
    web: [46 * k, 70 * k],
  };
}

// ───────────────────────────── durağan yollar (JS'te bir kez)

function buildLand(L) {
  const { k, width, height, ground } = L;
  const bottom = height + 20;
  const far = ridgePath(width, ground - 92 * k, 26 * k, 2, 1.3, bottom).path;
  const [hx] = L.house;
  const mound = Skia.Path.Make();
  mound.moveTo(-10, bottom);
  mound.lineTo(-10, ground - 40 * k);
  mound.quadTo(hx - 70 * k, ground - 72 * k, hx, ground - 66 * k);
  mound.quadTo(hx + 110 * k, ground - 60 * k, width * 0.66, ground - 18 * k);
  mound.lineTo(width + 10, ground - 12 * k);
  mound.lineTo(width + 10, bottom);
  mound.close();
  const field = ridgePath(width, ground + 4 * k, 8 * k, 3, 0.4, bottom).path;
  return { far, mound, field };
}

function buildHouse(L) {
  const { k } = L;
  const [hx, hb] = L.house;
  const P = (x, y) => [hx + x * k, hb + y * k];
  const body = Skia.Path.Make();
  const poly = (path, pts) => {
    pts.forEach(([x, y], i) => {
      const [px, py] = P(x, y);
      if (i) path.lineTo(px, py);
      else path.moveTo(px, py);
    });
    path.close();
  };
  // gövde, kule, çatılar, baca, sundurma
  poly(body, [[-38, 0], [-38, -46], [34, -46], [34, 0]]);
  poly(body, [[-46, -45], [-4, -80], [-1, -78], [40, -45]]);
  poly(body, [[-62, 0], [-62, -86], [-38, -86], [-38, 0]]);
  poly(body, [[-67, -85], [-52, -122], [-46, -131], [-48, -121], [-33, -85]]);
  poly(body, [[13, -60], [14, -78], [23, -79], [21, -58]]);
  poly(body, [[11, -81], [26, -82], [25, -78], [12, -77]]);
  poly(body, [[-10, -22], [3, -32], [16, -22]]);
  poly(body, [[38, 0], [38, -24], [56, -24], [56, 0]]);
  poly(body, [[35, -23], [47, -36], [59, -23]]);
  // parmaklık direkleri (sundurma önü)
  for (let i = 0; i < 6; i += 1) {
    const [x, y] = P(-36 + i * 4, -6);
    body.addRect(Skia.XYWHRect(x, y, 1 * k, 6 * k));
  }
  const lit = Skia.Path.Make();
  const dark = Skia.Path.Make();
  const arch = (path, x, y, w, h) => {
    const [px, py] = P(x, y);
    path.addRect(Skia.XYWHRect(px, py + (w / 2) * k, w * k, (h - w / 2) * k));
    path.addCircle(px + (w / 2) * k, py + (w / 2) * k, (w / 2) * k);
  };
  arch(lit, -55, -74, 9, 15);
  arch(lit, -55, -44, 9, 15);
  arch(lit, -30, -38, 11, 15);
  arch(dark, 12, -38, 11, 15);
  arch(lit, 42, -18, 9, 12);
  const [ax, ay] = P(-3, -62);
  lit.addCircle(ax, ay, 5 * k);
  // kapı (karanlık) + kırık kepenk
  const [dx, dy] = P(-2, -20);
  dark.addRect(Skia.XYWHRect(dx, dy, 9 * k, 20 * k));
  const shutter = Skia.Path.Make();
  poly(shutter, [[23, -38], [28, -37], [27, -22], [22, -24]]);
  // pencere çıtaları (ışığın üstünde)
  const bars = Skia.Path.Make();
  [[-55, -74, 9, 15], [-55, -44, 9, 15], [-30, -38, 11, 15], [42, -18, 9, 12]].forEach(([x, y, w, h]) => {
    const [px, py] = P(x + w / 2, y + 2);
    bars.addRect(Skia.XYWHRect(px - 0.5 * k, py, 1 * k, (h - 2) * k));
    const [qx, qy] = P(x, y + h * 0.55);
    bars.addRect(Skia.XYWHRect(qx, qy, w * k, 1 * k));
  });
  return { body, lit, dark, shutter, bars };
}

/** Budaklı kuru ağaç: incelen dörtgen dallar (özyinelemeli); baykuş için bir dal ucu döner. */
function buildTree(L) {
  const { k, width, ground } = L;
  const path = Skia.Path.Make();
  const perch = [];
  const seg = (x, y, a, len, w, depth, seed) => {
    const bend = (hash(seed, 3) - 0.5) * 0.5;
    const a2 = a + bend;
    const x1 = x + Math.cos(a2) * len;
    const y1 = y + Math.sin(a2) * len;
    const w1 = w * 0.6;
    const nx = -Math.sin(a);
    const ny = Math.cos(a);
    const n1x = -Math.sin(a2);
    const n1y = Math.cos(a2);
    const mx = (x + x1) / 2 + nx * len * 0.08 * (hash(seed, 4) - 0.5);
    const my = (y + y1) / 2 + ny * len * 0.08 * (hash(seed, 4) - 0.5);
    path.moveTo(x + (nx * w) / 2, y + (ny * w) / 2);
    path.quadTo(mx + (nx * (w + w1)) / 4, my + (ny * (w + w1)) / 4, x1 + (n1x * w1) / 2, y1 + (n1y * w1) / 2);
    path.lineTo(x1 - (n1x * w1) / 2, y1 - (n1y * w1) / 2);
    path.quadTo(mx - (nx * (w + w1)) / 4, my - (ny * (w + w1)) / 4, x - (nx * w) / 2, y - (ny * w) / 2);
    path.close();
    path.addCircle(x1, y1, w1 / 2);
    if (depth === 4 && !perch.length && Math.cos(a2) < 0) perch.push([x1, y1, a2]);
    if (depth <= 0) return;
    const n = depth > 3 ? 2 : hash(seed, 5) > 0.5 ? 3 : 2;
    for (let j = 0; j < n; j += 1) {
      const spread = 0.62 * (j - (n - 1) / 2) + (hash(seed + j, 6) - 0.5) * 0.35;
      seg(x1, y1, a2 + spread, len * (0.68 + hash(seed + j, 7) * 0.14), w1, depth - 1, seed * 3 + j + 1);
    }
  };
  const bx = width * 0.9;
  const by = ground + 8 * k;
  seg(bx, by, -Math.PI / 2 - 0.22, 92 * k, 17 * k, 6, 1);
  // kökler
  [[-1, 0.5], [1, 0.4], [-1, 0.9]].forEach(([s, f]) => {
    path.moveTo(bx - 7 * k, by - 6 * k);
    path.quadTo(bx + s * 16 * k * f, by - 2 * k, bx + s * 26 * k * f + s * 6 * k, by + 4 * k);
    path.lineTo(bx + 7 * k * s, by + 2 * k);
    path.close();
  });
  return { path, perch: perch[0] || [bx - 60 * k, by - 160 * k, -Math.PI] };
}

function buildGraves(L) {
  const { k, width, ground } = L;
  const stones = [];
  const SPEC = [
    [0.07, 0, 20, 30, -0.1],
    [0.2, 1, 22, 40, 0.08],
    [0.34, 0, 24, 34, 0.04],
    [0.46, 2, 18, 44, -0.06],
    [0.6, 0, 20, 28, 0.12],
    [0.73, 1, 18, 32, -0.14],
  ];
  SPEC.forEach(([fx, type, w0, h0, rot], i) => {
    const w = w0 * k;
    const h = h0 * k;
    const face = Skia.Path.Make();
    const line = Skia.Path.Make();
    if (type === 0) {
      face.addRect(Skia.XYWHRect(-w / 2, -h + w / 2, w, h - w / 2 + 4 * k));
      face.addCircle(0, -h + w / 2, w / 2);
      line.addRect(Skia.XYWHRect(-w * 0.28, -h * 0.62, w * 0.56, 1.4 * k));
      line.addRect(Skia.XYWHRect(-w * 0.2, -h * 0.5, w * 0.4, 1.4 * k));
      line.addRect(Skia.XYWHRect(-w * 0.24, -h * 0.38, w * 0.48, 1.4 * k));
    } else if (type === 1) {
      face.addRect(Skia.XYWHRect(-w * 0.16, -h, w * 0.32, h + 4 * k));
      face.addRect(Skia.XYWHRect(-w / 2, -h * 0.74, w, w * 0.3));
    } else {
      face.moveTo(-w * 0.32, 4 * k);
      face.lineTo(-w * 0.22, -h);
      face.lineTo(0, -h - w * 0.36);
      face.lineTo(w * 0.22, -h);
      face.lineTo(w * 0.32, 4 * k);
      face.close();
      face.addRect(Skia.XYWHRect(-w / 2, -6 * k, w, 10 * k));
    }
    stones.push({ x: width * fx, y: ground + (6 + hash(i, 2) * 8) * k, rot, face, line });
  });
  // demir parmaklık (mezarların arkasında)
  const fence = Skia.Path.Make();
  const fy = ground - 4 * k;
  for (let x = -4 * k, i = 0; x < width * 0.56; x += 9 * k, i += 1) {
    if (hash(i, 9) > 0.86) continue;
    const lean = (hash(i, 10) - 0.5) * 4 * k;
    fence.moveTo(x - 0.8 * k, fy);
    fence.lineTo(x - 0.8 * k + lean, fy - 26 * k);
    fence.lineTo(x - 2.4 * k + lean, fy - 26 * k);
    fence.lineTo(x + lean, fy - 32 * k);
    fence.lineTo(x + 2.4 * k + lean, fy - 26 * k);
    fence.lineTo(x + 0.8 * k + lean, fy - 26 * k);
    fence.lineTo(x + 0.8 * k, fy);
    fence.close();
  }
  fence.addRect(Skia.XYWHRect(-4 * k, fy - 21 * k, width * 0.56, 1.6 * k));
  fence.addRect(Skia.XYWHRect(-4 * k, fy - 8 * k, width * 0.56, 1.6 * k));
  // çimen öbekleri
  const grass = Skia.Path.Make();
  for (let i = 0; i < 46; i += 1) {
    const x = (i / 45) * width + (hash(i, 11) - 0.5) * 10 * k;
    const y = ground + (8 + hash(i, 12) * 14) * k;
    const h = (5 + hash(i, 13) * 7) * k;
    grass.moveTo(x - 3 * k, y);
    grass.lineTo(x - 1.5 * k, y - h * 0.7);
    grass.lineTo(x, y - 1 * k);
    grass.lineTo(x + 1 * k, y - h);
    grass.lineTo(x + 3 * k, y);
    grass.close();
  }
  return { stones, fence, grass };
}

function buildWeb(L) {
  const { k } = L;
  const [cx, cy] = L.web;
  const angles = [110, 135, 160, 185, 210, 235, 260, 285].map((d) => (d * Math.PI) / 180);
  const ends = angles.map((a) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const tx = c < 0 ? -cx / c : 1e9;
    const ty = s < 0 ? -cy / s : 1e9;
    const t = Math.min(tx, ty, 220 * k);
    return [cx + c * t, cy + s * t, t];
  });
  const web = Skia.Path.Make();
  ends.forEach(([x, y]) => {
    web.moveTo(cx, cy);
    web.lineTo(x, y);
  });
  for (let r = 7 * k; r < 64 * k; r += 6.5 * k) {
    for (let i = 0; i < angles.length - 1; i += 1) {
      const r0 = Math.min(r, ends[i][2]);
      const r1 = Math.min(r, ends[i + 1][2]);
      const a0 = angles[i];
      const a1 = angles[i + 1];
      const am = (a0 + a1) / 2;
      web.moveTo(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0);
      web.quadTo(
        cx + Math.cos(am) * r * 0.86,
        cy + Math.sin(am) * r * 0.86,
        cx + Math.cos(a1) * r1,
        cy + Math.sin(a1) * r1,
      );
    }
  }
  return web;
}

function buildWitch(k) {
  // yerel koordinat: süpürgenin ortası (0,0), sağa bakar
  const s = (v) => v * k * 1.1;
  const body = Skia.Path.Make();
  const poly = (pts) => {
    pts.forEach(([x, y], i) => (i ? body.lineTo(s(x), s(y)) : body.moveTo(s(x), s(y))));
    body.close();
  };
  // süpürge çöpleri
  poly([[-36, 2], [-58, -6], [-63, 2], [-60, 9], [-55, 13], [-36, 6]]);
  // gövde + bacak + çizme
  poly([[-2, -24], [8, -25], [12, -4], [16, 4], [22, 6], [21, 9], [12, 8], [4, -2]]);
  // kol
  poly([[4, -20], [8, -21], [19, -6], [16, -4]]);
  // baş, şapka
  body.addCircle(s(6), s(-29), s(4.8));
  poly([[-4, -32], [17, -34], [17, -32], [-4, -30]]);
  poly([[0, -33], [13, -34], [3, -46], [-8, -54], [-3, -45]]);
  // kedi (süpürgenin arkasında)
  body.addOval(Skia.XYWHRect(s(-30), s(-9), s(11), s(8)));
  body.addCircle(s(-20), s(-11), s(3.6));
  poly([[-23, -13], [-22, -18], [-19.5, -14]]);
  poly([[-19.5, -14], [-17, -18], [-16.5, -12.5]]);
  const tail = Skia.Path.Make();
  tail.moveTo(s(-29), s(-4));
  tail.quadTo(s(-38), s(-6), s(-36), s(-16));
  const stick = Skia.Path.Make();
  stick.moveTo(s(-40), s(4));
  stick.lineTo(s(38), s(-2));
  return { body, tail, stick, s };
}

// ───────────────────────────── kare başına (worklet)

function eventU(p, t) {
  "worklet";
  return restU(p, t);
}

function capePath(t, k) {
  "worklet";
  const s = (v) => v * k * 1.1;
  const q = Skia.Path.Make();
  const f = Math.sin(t * 9) * 3;
  const g = Math.sin(t * 9 + 1.3) * 2;
  q.moveTo(s(-1), s(-24));
  q.quadTo(s(-14), s(-22 + f * 0.5), s(-30), s(-16 + f));
  q.lineTo(s(-26), s(-11 + g));
  q.quadTo(s(-16), s(-8 + g * 0.5), s(-28), s(-4 + f));
  q.quadTo(s(-12), s(-4), s(6), s(-6));
  q.close();
  return q;
}

function ghostPath(t, i, k) {
  "worklet";
  const q = Skia.Path.Make();
  const w = 16 * k;
  const h = 34 * k;
  q.moveTo(-w, 0);
  q.cubicTo(-w, -h * 1.15, w, -h * 1.15, w, 0);
  // dalgalı etek
  const n = 4;
  for (let j = 0; j <= n * 2; j += 1) {
    const x = w - (j / (n * 2)) * 2 * w;
    const y = (j % 2 ? 7 : 1) * k + Math.sin(t * 4 + j + i) * 2.5 * k + (j / (n * 2)) * 4 * k;
    q.lineTo(x, y + h * 0.18);
  }
  q.close();
  // kollar
  q.moveTo(-w * 0.95, -h * 0.35);
  q.quadTo(-w * 1.6, -h * 0.2 + Math.sin(t * 2 + i) * 4 * k, -w * 1.5, -h * 0.05);
  q.lineTo(-w * 0.9, -h * 0.15);
  q.close();
  q.moveTo(w * 0.95, -h * 0.35);
  q.quadTo(w * 1.6, -h * 0.25 + Math.sin(t * 2 + i + 1) * 4 * k, w * 1.5, -h * 0.08);
  q.lineTo(w * 0.9, -h * 0.15);
  q.close();
  return q;
}

function batSwarm(t, u, ox, oy, k) {
  "worklet";
  const q = Skia.Path.Make();
  if (u > 1) return q;
  for (let j = 0; j < 18; j += 1) {
    const f = (u - 0.08 - hash(j, 1) * 0.22) / (0.34 + hash(j, 2) * 0.12);
    if (f <= 0 || f >= 1) continue;
    const a = -Math.PI / 2 + (hash(j, 3) - 0.5) * 2.4;
    const dist = f * (260 + hash(j, 4) * 320) * k;
    const x = ox + Math.cos(a) * dist + Math.sin(t * 3 + j) * 10 * k * f;
    const y = oy + Math.sin(a) * dist * 0.75 + Math.cos(t * 2.4 + j) * 8 * k * f;
    const s = (4 + f * 9 + hash(j, 5) * 3) * k;
    const fl = Math.sin(t * 15 + j * 1.7);
    const tip = fl * s * 0.8;
    q.addCircle(x, y, s * 0.2);
    for (let side = -1; side <= 1; side += 2) {
      q.moveTo(x, y - s * 0.1);
      q.lineTo(x + side * s * 0.55, y - tip * 0.6 - s * 0.1);
      q.lineTo(x + side * s * 1.25, y - tip);
      q.lineTo(x + side * s * 1.0, y - tip * 0.4 + s * 0.15);
      q.lineTo(x + side * s * 0.75, y - tip * 0.2 + s * 0.05);
      q.lineTo(x + side * s * 0.5, y + s * 0.22);
      q.lineTo(x, y + s * 0.12);
      q.close();
    }
  }
  return q;
}

// ───────────────────────────── parçalar

function Pumpkin({ x, y, sc, k, c, glow, night }) {
  const w = 30 * k * sc;
  const h = 24 * k * sc;
  const face = useMemo(() => {
    const f = Skia.Path.Make();
    const P = (px, py) => [x + px * w, y + py * h];
    const tri = (pts) => {
      pts.forEach(([px, py], i) => {
        const [a, b] = P(px, py);
        if (i) f.lineTo(a, b);
        else f.moveTo(a, b);
      });
      f.close();
    };
    tri([[-0.3, -0.62], [-0.08, -0.6], [-0.2, -0.86]]);
    tri([[0.08, -0.6], [0.3, -0.62], [0.2, -0.86]]);
    tri([[-0.05, -0.52], [0.05, -0.52], [0, -0.62]]);
    tri([
      [-0.36, -0.42], [-0.22, -0.36], [-0.18, -0.44], [-0.08, -0.34], [0, -0.42], [0.08, -0.34],
      [0.18, -0.44], [0.22, -0.36], [0.36, -0.42], [0.28, -0.2], [0.14, -0.24], [0.1, -0.16],
      [0, -0.22], [-0.1, -0.16], [-0.14, -0.24], [-0.28, -0.2],
    ]);
    return f;
  }, [x, y, w, h]);
  return (
    <Group>
      <Group opacity={glow}>
        <Glow cx={x} cy={y - h * 0.5} r={w * 1.8} color={c.carve} a={night ? 0.35 : 0.25} mid={0.35} />
      </Group>
      <Oval x={x - w * 0.62} y={y - h * 0.98} width={w * 0.62} height={h * 0.96} color={c.pumpkinDark} />
      <Oval x={x} y={y - h * 0.98} width={w * 0.62} height={h * 0.96} color={c.pumpkinDark} />
      <Oval x={x - w * 0.42} y={y - h} width={w * 0.84} height={h} color={c.pumpkin} />
      <Oval x={x - w * 0.16} y={y - h} width={w * 0.32} height={h} color={c.pumpkinDark} opacity={0.35} />
      <Path
        path={`M ${x - 2 * k * sc} ${y - h * 0.94} L ${x - 1 * k * sc} ${y - h - 7 * k * sc} L ${x + 4 * k * sc} ${y - h - 9 * k * sc} L ${x + 2 * k * sc} ${y - h * 0.94} Z`}
        color={c.stem}
      />
      <Group opacity={glow}>
        <Path path={face} color={c.carve} />
      </Group>
    </Group>
  );
}

function FogPuff({ clock, i, L, c, night }) {
  const { k, width, ground } = L;
  const R = (90 + hash(i, 1) * 60) * k;
  const v = (5 + hash(i, 2) * 6) * k * (i % 2 ? 1 : -1);
  const x0 = hash(i, 3) * (width + 2 * R);
  const y = ground - (10 + hash(i, 4) * 40) * k;
  const transform = useDerivedValue(() => {
    const span = width + 2 * R;
    let x = (x0 + clock.value * v) % span;
    if (x < 0) x += span;
    return [{ translateX: x - R }, { translateY: y }, { scaleY: 0.28 }];
  });
  return (
    <Group transform={transform}>
      <Glow r={R} color={c.fog} a={night ? 0.22 : 0.4} mid={0.55} />
    </Group>
  );
}

function Ghost({ clock, i, L, c, night }) {
  const { k, width, ground } = L;
  const path = useDerivedValue(() => ghostPath(clock.value, i, k));
  const period = 17 + i * 6;
  const transform = useDerivedValue(() => {
    const t = clock.value;
    const f = ((t + i * 9) / period) % 1;
    const x = width * (0.12 + (i ? 0.38 : 0.06)) + Math.sin(f * TAU) * width * 0.12;
    const y = ground - 26 * k - Math.sin(t * 1.3 + i) * 6 * k - (i ? 30 : 0) * k;
    return [{ translateX: x }, { translateY: y }, { rotate: Math.sin(t * 1.1 + i) * 0.08 }];
  });
  const opacity = useDerivedValue(() => {
    const f = (((clock.value + i * 9) / period) % 1);
    // görünür → kaybolur → yeniden belirir
    return 0.25 + 0.65 * sm(0.05, 0.25, f) * (1 - sm(0.6, 0.85, f));
  });
  return (
    <Group transform={transform} opacity={opacity}>
      <Glow cx={0} cy={-14 * k} r={44 * k} color={c.ghost} a={night ? 0.25 : 0.5} mid={0.35} />
      <Path path={path}>
        <LinearGradient
          start={vec(0, -40 * k)}
          end={vec(0, 12 * k)}
          colors={[c.ghost, rgba(c.ghost, night ? 0.55 : 0.85)]}
        />
      </Path>
      {night ? null : <Path path={path} style="stroke" strokeWidth={1 * k} color={c.web} opacity={0.5} />}
      <Oval x={-7 * k} y={-27 * k} width={5 * k} height={8 * k} color={c.witch} />
      <Oval x={2 * k} y={-27 * k} width={5 * k} height={8 * k} color={c.witch} />
      <Oval x={-3 * k} y={-16 * k} width={6 * k} height={7 * k} color={c.witch} opacity={0.85} />
    </Group>
  );
}

function Owl({ clock, perch, k, c }) {
  const [x, y] = perch;
  const blink = useDerivedValue(() => {
    const f = (clock.value % 4.3) / 4.3;
    const s = f > 0.95 ? 0.12 : 1;
    return [{ translateY: y - 15 * k }, { scaleY: s }, { translateY: -(y - 15 * k) }];
  });
  const look = useDerivedValue(() => Math.sin(clock.value * 0.4) * 1.2 * k);
  const lx = useDerivedValue(() => x - 3.6 * k + look.value);
  const rx = useDerivedValue(() => x + 3.6 * k + look.value);
  return (
    <Group>
      <Oval x={x - 7 * k} y={y - 20 * k} width={14 * k} height={20 * k} color={c.tree} />
      <Path
        path={`M ${x - 7 * k} ${y - 17 * k} L ${x - 6 * k} ${y - 25 * k} L ${x - 2 * k} ${y - 19 * k} Z M ${x + 7 * k} ${y - 17 * k} L ${x + 6 * k} ${y - 25 * k} L ${x + 2 * k} ${y - 19 * k} Z`}
        color={c.tree}
      />
      <Group transform={blink}>
        <Circle cx={lx} cy={y - 15 * k} r={2.7 * k} color={c.eye} />
        <Circle cx={rx} cy={y - 15 * k} r={2.7 * k} color={c.eye} />
        <Circle cx={lx} cy={y - 15 * k} r={1.1 * k} color={c.witch} />
        <Circle cx={rx} cy={y - 15 * k} r={1.1 * k} color={c.witch} />
      </Group>
    </Group>
  );
}

function Witch({ p, clock, L, c }) {
  const { k, width } = L;
  const [, my] = L.moon;
  const W = useMemo(() => buildWitch(k), [k]);
  const cape = useDerivedValue(() => capePath(clock.value, k));
  const transform = useDerivedValue(() => {
    const u = eventU(p, clock.value);
    const e = u > 1 ? -1 : (u - 0.06) / 0.62;
    if (e < 0 || e > 1) return [{ translateX: -500 }, { translateY: -500 }];
    // ayın merkezinden e ≈ 0.68'de geçer
    const x = -80 * k + (width + 160 * k) * e;
    const y = my + 46 * k - Math.sin(e * Math.PI) * 70 * k + Math.sin(clock.value * 2.2) * 4 * k;
    const tilt = -0.12 + Math.cos(e * Math.PI) * 0.12 + Math.sin(clock.value * 2.2 + 1) * 0.03;
    return [{ translateX: x }, { translateY: y }, { rotate: tilt }];
  });
  const on = useDerivedValue(() => {
    const u = eventU(p, clock.value);
    return u > 1 ? 0 : sm(0.06, 0.09, u) * (1 - sm(0.64, 0.68, u));
  });
  // süpürge izi: geride kalan kıvılcımlar
  const trail = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const t = clock.value;
    const u = eventU(p, t);
    if (u > 1) return q;
    for (let j = 1; j < 14; j += 1) {
      const e = (u - 0.06) / 0.62 - j * 0.012;
      if (e < 0 || e > 1) continue;
      const x = -80 * k + (width + 160 * k) * e - 62 * k;
      const y = my + 46 * k - Math.sin(e * Math.PI) * 70 * k + 6 * k + Math.sin(j * 1.7 + t * 3) * 4 * k;
      if (hash(j, Math.floor(t * 10)) > 0.35) q.addCircle(x, y, (1.6 - j * 0.09) * k);
    }
    return q;
  });
  return (
    <Group opacity={on}>
      <Path path={trail} color={c.eye} />
      <Group transform={transform}>
        <Path path={W.stick} style="stroke" strokeWidth={2.4 * k} strokeCap="round" color={c.witch} />
        <Path path={cape} color={c.witch} />
        <Path path={W.body} color={c.witch} />
        <Path path={W.tail} style="stroke" strokeWidth={1.8 * k} strokeCap="round" color={c.witch} />
      </Group>
    </Group>
  );
}

function Spider({ clock, L, c }) {
  const { k } = L;
  const [cx, cy] = L.web;
  const sy = useDerivedValue(() => cy + (52 + 34 * Math.sin(clock.value * 0.45)) * k);
  const thread = useDerivedValue(() => {
    const q = Skia.Path.Make();
    q.moveTo(cx + 18 * k, cy + 16 * k);
    q.lineTo(cx + 18 * k, sy.value);
    return q;
  });
  const body = useDerivedValue(() => [{ translateX: cx + 18 * k }, { translateY: sy.value }]);
  const legs = useMemo(() => {
    const q = Skia.Path.Make();
    for (let side = -1; side <= 1; side += 2) {
      for (let j = 0; j < 4; j += 1) {
        const a = -0.6 + j * 0.42;
        q.moveTo(0, 2 * k);
        q.lineTo(side * 6 * k, (2 + a * 6) * k - 3 * k);
        q.lineTo(side * 9 * k, (2 + a * 9) * k + 2 * k);
      }
    }
    return q;
  }, [k]);
  return (
    <Group>
      <Path path={thread} style="stroke" strokeWidth={0.6 * k} color={c.web} opacity={0.8} />
      <Group transform={body}>
        <Path path={legs} style="stroke" strokeWidth={1 * k} strokeCap="round" color={c.witch} />
        <Circle cx={0} cy={0} r={2.6 * k} color={c.witch} />
        <Circle cx={0} cy={5 * k} r={4 * k} color={c.witch} />
      </Group>
    </Group>
  );
}

export default function HalloweenScene({ p, clock, width, height, tone, lightSurface }) {
  const L = useMemo(() => hwLayout(width, height), [width, height]);
  const land = useMemo(() => buildLand(L), [L]);
  const house = useMemo(() => buildHouse(L), [L]);
  const tree = useMemo(() => buildTree(L), [L]);
  const graves = useMemo(() => buildGraves(L), [L]);
  const web = useMemo(() => buildWeb(L), [L]);
  const clouds = useMemo(() => {
    const q = Skia.Path.Make();
    const { k } = L;
    addCloud(q, 0, 0, 150 * k, 16 * k, 2);
    addCloud(q, 120 * k, 26 * k, 110 * k, 12 * k, 5);
    return q;
  }, [L]);
  const c = useMemo(() => toneMap(HW_TONE, tone.colors), [tone]);
  const { k, ground } = L;
  const night = !lightSurface;
  const [mx, my, mr] = L.moon;
  const [tx, ty] = L.tower;
  const ev = useDerivedValue(() => {
    const u = eventU(p, clock.value);
    return u > 1 ? 0 : sm(0.06, 0.14, u) * (1 - sm(0.6, 0.8, u));
  });
  const flick = useDerivedValue(() => {
    const t = clock.value;
    return Math.min(1, 0.72 + 0.14 * Math.sin(t * 7.3) + 0.1 * Math.sin(t * 13.1 + 1) + ev.value * 0.3);
  });
  const cloudT = useDerivedValue(() => {
    const span = width + 420 * k;
    const x = ((clock.value * 6 * k) % span) - 280 * k;
    return [{ translateX: x }, { translateY: my + 8 * k }];
  });
  const bats = useDerivedValue(() => batSwarm(clock.value, eventU(p, clock.value), tx, ty, k));
  const towerGlow = useDerivedValue(() => ev.value);
  return (
    <Group opacity={tone.alpha}>
      {/* gök: ayın çevresinde mor-turuncu hale */}
      <Glow cx={mx} cy={my} r={260 * k} color={c.sky} a={night ? 0.7 : 0.6} mid={0.55} />
      <Glow cx={mx} cy={my} r={150 * k} color={c.moonGlow} a={night ? 0.28 : 0.3} mid={0.3} />
      <Circle cx={mx} cy={my} r={mr}>
        <RadialGradient
          c={vec(mx - mr * 0.3, my - mr * 0.3)}
          r={mr * 1.4}
          colors={[c.moon, c.crater]}
        />
      </Circle>
      <Group opacity={0.45}>
        <Circle cx={mx + mr * 0.3} cy={my - mr * 0.2} r={mr * 0.18} color={c.crater} />
        <Circle cx={mx - mr * 0.35} cy={my + mr * 0.25} r={mr * 0.24} color={c.crater} />
        <Circle cx={mx + mr * 0.1} cy={my + mr * 0.5} r={mr * 0.1} color={c.crater} />
        <Circle cx={mx - mr * 0.15} cy={my - mr * 0.45} r={mr * 0.08} color={c.crater} />
      </Group>
      <Witch p={p} clock={clock} L={L} c={c} />
      <Group transform={cloudT} opacity={night ? 0.7 : 0.85}>
        <Path path={clouds} color={c.cloud} />
      </Group>
      {/* örümcek ağı */}
      <Path path={web} style="stroke" strokeWidth={0.7 * k} color={c.web} opacity={night ? 0.55 : 0.7} />
      <Spider clock={clock} L={L} c={c} />
      {/* ufuk parıltısı: silüetler gökten ayrılsın */}
      <Group transform={[{ translateX: width / 2 }, { translateY: ground - 70 * k }, { scaleY: 0.38 }]}>
        <Glow r={width * 0.95} color={c.moonGlow} a={night ? 0.2 : 0.16} mid={0.45} />
      </Group>
      {/* uzak tepeler, köşkün tepesi */}
      <Path path={land.far} color={c.hillFar} />
      <Path path={land.mound} color={c.hill} />
      <Group opacity={towerGlow}>
        <Glow cx={tx} cy={ty + 40 * k} r={90 * k} color={c.window} a={0.3} mid={0.3} />
      </Group>
      <Path path={house.body} color={c.house} />
      <Group opacity={flick}>
        <Path path={house.lit} color={c.window} />
      </Group>
      <Path path={house.dark} color={c.witch} opacity={0.8} />
      <Path path={house.shutter} color={c.house} />
      <Path path={house.bars} color={c.house} />
      <Path path={bats} color={c.witch} />
      {/* kuru ağaç + baykuş */}
      <Path path={tree.path} color={c.tree} />
      <Owl clock={clock} perch={tree.perch} k={k} c={c} />
      {/* mezarlık */}
      <Path path={graves.fence} color={c.tree} opacity={0.9} />
      <Path path={land.field} color={c.ground} />
      <Rect x={0} y={ground + 10 * k} width={width} height={height - ground}>
        <LinearGradient start={vec(0, ground)} end={vec(0, height)} colors={[c.ground, c.witch]} />
      </Rect>
      {[0, 1, 2].map((i) => (
        <FogPuff key={`fb${i}`} clock={clock} i={i} L={L} c={c} night={night} />
      ))}
      {graves.stones.map((s, i) => (
        <Group key={`s${i}`} transform={[{ translateX: s.x }, { translateY: s.y }, { rotate: s.rot }]}>
          <Group transform={[{ translateX: 2.5 * k }]}>
            <Path path={s.face} color={c.stoneDark} />
          </Group>
          <Path path={s.face}>
            <LinearGradient
              start={vec(0, -40 * k)}
              end={vec(0, 4 * k)}
              colors={[c.stone, c.stoneDark]}
            />
          </Path>
          <Path path={s.line} color={c.stoneDark} />
        </Group>
      ))}
      {[0, 1].map((i) => (
        <Ghost key={`g${i}`} clock={clock} i={i} L={L} c={c} night={night} />
      ))}
      <Path path={graves.grass} color={c.ground} />
      <Pumpkin x={width * 0.56} y={ground + 14 * k} sc={1.1} k={k} c={c} glow={flick} night={night} />
      <Pumpkin x={width * 0.68} y={ground + 20 * k} sc={0.78} k={k} c={c} glow={flick} night={night} />
      <Pumpkin x={width * 0.13} y={ground + 22 * k} sc={0.9} k={k} c={c} glow={flick} night={night} />
      {[3, 4, 5].map((i) => (
        <FogPuff key={`ff${i}`} clock={clock} i={i} L={L} c={c} night={night} />
      ))}
    </Group>
  );
}
