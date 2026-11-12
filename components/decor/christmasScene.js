// components/decor/christmasScene.js
//
// Noel atmosfer sahnesi (OVERLAY.xmasVillage = 49) — tamamı VEKTÖR; önünde kar yağar:
//   • Gökte hilal ve kırpışan yıldızlar; uzakta karlı tepeler, çam sırası ve ışıklı küçük kilise.
//   • Köy: karlı çatılı evler (sıcak ışıklı pencereler, kapıda çelenk), bacalardan tüten duman;
//     evler arasında renkli ampullü ışık zinciri (sırayla yanıp söner); karla örtülü sokak feneri.
//   • Sağda süslü çam: karlı katlar, renkli toplar, sarmal ışık dizisi, tepede dönen ışınlı yıldız;
//     altında kurdeleli hediyeler. Solda kardan adam: şapka, havuç burun, rüzgârda uçuşan atkı,
//     el sallayan dal kolu. Karda pırıltılar.
//   • Olay (64 sn'de bir ~26 sn): dört ren geyikli (öndeki kırmızı burunlu) Noel Baba kızağı
//     aydan geçerek göğü yay çizip aşar, ardında pırıltı izi bırakır; ağacın yıldızı parlar,
//     ışıklar hızlanır, kardan adam coşkuyla el sallar.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[49] (XM_TONE).

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
  RoundedRect,
  Skia,
  vec,
} from "@shopify/react-native-skia";
import { restU } from "../../utils/weatherParticles";
import {
  Glow,
  TAU,
  addPine,
  groundLayout,
  hash,
  rgba,
  ridgePath,
  ridgeY,
  sm,
  toneMap,
} from "./seasonKit";

export const XM_TONE = [
  "sky",
  "moon",
  "hillFar",
  "hill",
  "snow",
  "snowShade",
  "pineFar",
  "pine",
  "house",
  "houseSide",
  "roof",
  "window",
  "church",
  "tree",
  "treeDark",
  "star",
  "bulb1",
  "bulb2",
  "bulb3",
  "bulb4",
  "wire",
  "snowman",
  "scarf",
  "carrot",
  "gift1",
  "gift2",
  "ribbon",
  "lamp",
  "sleigh",
  "deer",
  "trail",
  "smoke",
];

export function xmLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  return {
    ...L,
    moon: [width * 0.22, height * 0.14, 26 * k],
    tree: [width * 0.7, ground + 8 * k, 196 * k, 124 * k],
    snowman: [width * 0.2, ground + 16 * k],
    lamp: [width * 0.47, ground + 10 * k],
    houseBase: ground - 24 * k,
  };
}

// ───────────────────────────── durağan yollar

function buildLand(L) {
  const { k, width, height, ground } = L;
  const bottom = height + 20;
  const far = ridgePath(width, ground - 104 * k, 34 * k, 2, 0.7, bottom);
  const pines = Skia.Path.Make();
  const pineSnow = Skia.Path.Make();
  for (let i = 0; i < 22; i += 1) {
    const x = (i / 21) * width + (hash(i, 1) - 0.5) * 12 * k;
    const h = (26 + hash(i, 2) * 22) * k;
    addPine(pines, x, ridgeY(far.pts, x) + 6 * k, h, h * 0.5, 4, pineSnow);
  }
  // kilise (uzak tepede)
  const cx = width * 0.4;
  const cb = ridgeY(far.pts, cx) + 4 * k;
  const church = Skia.Path.Make();
  church.addRect(Skia.XYWHRect(cx - 16 * k, cb - 22 * k, 30 * k, 22 * k));
  church.moveTo(cx - 19 * k, cb - 21 * k);
  church.lineTo(cx - 1 * k, cb - 34 * k);
  church.lineTo(cx + 17 * k, cb - 21 * k);
  church.close();
  church.addRect(Skia.XYWHRect(cx - 24 * k, cb - 44 * k, 12 * k, 44 * k));
  church.moveTo(cx - 26 * k, cb - 43 * k);
  church.lineTo(cx - 18 * k, cb - 66 * k);
  church.lineTo(cx - 10 * k, cb - 43 * k);
  church.close();
  church.addRect(Skia.XYWHRect(cx - 18.6 * k, cb - 76 * k, 1.2 * k, 11 * k));
  church.addRect(Skia.XYWHRect(cx - 21.5 * k, cb - 72.5 * k, 7 * k, 1.2 * k));
  const churchLit = Skia.Path.Make();
  churchLit.addCircle(cx - 18 * k, cb - 34 * k, 2.6 * k);
  churchLit.addRect(Skia.XYWHRect(cx - 9 * k, cb - 15 * k, 4 * k, 8 * k));
  churchLit.addRect(Skia.XYWHRect(cx + 3 * k, cb - 15 * k, 4 * k, 8 * k));
  const mid = ridgePath(width, ground - 20 * k, 10 * k, 2, 2.1, bottom);
  const front = ridgePath(width, ground + 10 * k, 7 * k, 3, 0.9, bottom);
  // karda pırıltılar (iki grup sırayla)
  const sparkA = Skia.Path.Make();
  const sparkB = Skia.Path.Make();
  for (let i = 0; i < 26; i += 1) {
    const x = hash(i, 21) * width;
    const y = ground + (12 + hash(i, 22) * 50) * k;
    const r = (1.6 + hash(i, 23) * 1.6) * k;
    const q = i % 2 ? sparkA : sparkB;
    q.moveTo(x, y - r * 2);
    q.lineTo(x + r * 0.4, y - r * 0.4);
    q.lineTo(x + r * 2, y);
    q.lineTo(x + r * 0.4, y + r * 0.4);
    q.lineTo(x, y + r * 2);
    q.lineTo(x - r * 0.4, y + r * 0.4);
    q.lineTo(x - r * 2, y);
    q.lineTo(x - r * 0.4, y - r * 0.4);
    q.close();
  }
  // gökte yıldızlar
  const starA = Skia.Path.Make();
  const starB = Skia.Path.Make();
  for (let i = 0; i < 34; i += 1) {
    const x = hash(i, 31) * width;
    const y = hash(i, 32) * L.height * 0.42;
    (i % 2 ? starA : starB).addCircle(x, y, (0.7 + hash(i, 33) * 1.1) * k);
  }
  return { far: far.path, pines, pineSnow, church, churchLit, mid: mid.path, front: front.path, sparkA, sparkB, starA, starB };
}

function buildHouses(L) {
  const { k, width } = L;
  const hb = L.houseBase;
  const SPEC = [
    [0.02, 66, 44, 30],
    [0.29, 54, 38, 26],
    [0.86, 60, 46, 30],
  ];
  const walls = Skia.Path.Make();
  const roofs = Skia.Path.Make();
  const snow = Skia.Path.Make();
  const lit = Skia.Path.Make();
  const bars = Skia.Path.Make();
  const doors = Skia.Path.Make();
  const wreaths = [];
  const chimneys = [];
  SPEC.forEach(([fx, w0, h0, r0], i) => {
    const x = width * fx;
    const w = w0 * k;
    const h = h0 * k;
    const rh = r0 * k;
    const top = hb - h;
    walls.addRect(Skia.XYWHRect(x, top, w, h + 8 * k));
    // baca (çatının arkasında)
    const chx = x + w * 0.68;
    roofs.addRect(Skia.XYWHRect(chx, top - rh * 0.95, 8 * k, rh * 0.8));
    snow.addOval(Skia.XYWHRect(chx - 1.5 * k, top - rh * 0.95 - 3 * k, 11 * k, 5 * k));
    chimneys.push([chx + 4 * k, top - rh * 0.95 - 4 * k]);
    roofs.moveTo(x - 7 * k, top + 2 * k);
    roofs.lineTo(x + w / 2, top - rh);
    roofs.lineTo(x + w + 7 * k, top + 2 * k);
    roofs.close();
    // çatı karı: kalın örtü + saçaktan sarkan damlalar
    snow.moveTo(x - 9 * k, top + 1 * k);
    snow.lineTo(x + w / 2, top - rh - 4 * k);
    snow.lineTo(x + w + 9 * k, top + 1 * k);
    snow.lineTo(x + w + 6 * k, top + 4 * k);
    snow.lineTo(x + w / 2, top - rh + 4 * k);
    snow.lineTo(x - 6 * k, top + 4 * k);
    snow.close();
    for (let j = 0; j < 7; j += 1) {
      const dx = x - 4 * k + ((w + 8 * k) * (j + 0.5)) / 7;
      snow.addCircle(dx, top + 3.5 * k, (2 + hash(i * 7 + j, 4) * 1.6) * k);
    }
    // pencereler (4 bölmeli) + kapı + çelenk
    const wy = top + h * 0.28;
    const ww = 11 * k;
    const wins = i === 1 ? [x + w * 0.62] : [x + w * 0.12, x + w * 0.66];
    wins.forEach((px) => {
      lit.addRect(Skia.XYWHRect(px, wy, ww, ww));
      bars.addRect(Skia.XYWHRect(px + ww / 2 - 0.6 * k, wy, 1.2 * k, ww));
      bars.addRect(Skia.XYWHRect(px, wy + ww / 2 - 0.6 * k, ww, 1.2 * k));
      snow.addRect(Skia.XYWHRect(px - 1.5 * k, wy + ww, ww + 3 * k, 2.4 * k));
    });
    const dx = i === 1 ? x + w * 0.2 : x + w * 0.42;
    doors.addRect(Skia.XYWHRect(dx, hb - 20 * k, 11 * k, 20 * k + 8 * k));
    wreaths.push([dx + 5.5 * k, hb - 14 * k]);
  });
  return { walls, roofs, snow, lit, bars, doors, wreaths, chimneys };
}

/** Sarkık zincir boyunca ampul noktaları (iki uç arasında parabol). */
function chainPts(a, b, sag, n) {
  const out = [];
  for (let i = 0; i <= n; i += 1) {
    const f = i / n;
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f + sag * 4 * f * (1 - f)]);
  }
  return out;
}

function buildLights(L) {
  const { k, width, ground } = L;
  const spans = [
    [[-4 * k, ground - 70 * k], [width * 0.29 + 4 * k, ground - 56 * k], 14 * k],
    [[width * 0.29 + 50 * k, ground - 56 * k], [width * 0.47, ground - 66 * k], 12 * k],
  ];
  const wire = Skia.Path.Make();
  const bulbs = [0, 1, 2, 3].map(() => Skia.Path.Make());
  const halos = [0, 1, 2, 3].map(() => Skia.Path.Make());
  let idx = 0;
  spans.forEach(([a, b, sag]) => {
    const n = Math.max(6, Math.round(Math.abs(b[0] - a[0]) / (11 * k)));
    const pts = chainPts(a, b, sag, n);
    wire.moveTo(pts[0][0], pts[0][1]);
    pts.slice(1).forEach(([x, y]) => wire.lineTo(x, y));
    pts.slice(1, -1).forEach(([x, y]) => {
      const g = idx % 4;
      bulbs[g].addOval(Skia.XYWHRect(x - 2.2 * k, y + 0.5 * k, 4.4 * k, 6 * k));
      halos[g].addCircle(x, y + 3.5 * k, 7.5 * k);
      idx += 1;
    });
  });
  return { wire, bulbs, halos };
}

function buildTree(L) {
  const { k } = L;
  const [cx, base, H, W] = L.tree;
  const trunkH = 16 * k;
  const top = base - H;
  const Hc = H - trunkH;
  const body = Skia.Path.Make();
  const snow = Skia.Path.Make();
  const balls = [0, 1, 2, 3].map(() => Skia.Path.Make());
  const shine = Skia.Path.Make();
  const garland = Skia.Path.Make();
  const lightA = Skia.Path.Make();
  const lightB = Skia.Path.Make();
  const tiers = 5;
  for (let j = 0; j < tiers; j += 1) {
    const yTop = top + j * 0.16 * Hc;
    const yBot = top + (j + 1) * 0.19 * Hc;
    const hw = (W / 2) * (0.28 + (0.72 * (j + 1)) / tiers);
    body.moveTo(cx, yTop);
    body.quadTo(cx + hw * 0.42, (yTop + yBot) / 2, cx + hw, yBot);
    const sc = 4 + j;
    for (let s = 0; s < sc; s += 1) {
      const x0 = cx + hw - (2 * hw * s) / sc;
      const x1 = cx + hw - (2 * hw * (s + 1)) / sc;
      body.quadTo((x0 + x1) / 2, yBot + 6 * k, x1, yBot);
      snow.addOval(Skia.XYWHRect(x0 - 5 * k, yBot - 2.5 * k, 7 * k, 4 * k));
    }
    body.quadTo(cx - hw * 0.42, (yTop + yBot) / 2, cx, yTop);
    body.close();
    // katın üstündeki kar
    snow.moveTo(cx, yTop - 1 * k);
    snow.quadTo(cx + hw * 0.25, yTop + 8 * k, cx + hw * 0.32, yTop + 12 * k);
    snow.quadTo(cx, yTop + 8 * k, cx - hw * 0.3, yTop + 12 * k);
    snow.quadTo(cx - hw * 0.22, yTop + 7 * k, cx, yTop - 1 * k);
    snow.close();
    // toplar
    const nb = 2 + j;
    for (let b = 0; b < nb; b += 1) {
      const f = nb === 1 ? 0.5 : b / (nb - 1);
      const x = cx - hw * 0.72 + hw * 1.44 * f + (hash(j * 9 + b, 1) - 0.5) * 6 * k;
      const y = yBot - (5 + hash(j * 9 + b, 2) * 9) * k;
      const r = (3.6 + hash(j, b) * 1.4) * k;
      balls[(j + b) % 4].addCircle(x, y, r);
      shine.addCircle(x - r * 0.35, y - r * 0.35, r * 0.3);
    }
    // sarmal ışık dizisi
    const a = [cx - hw * 0.78, yBot - 16 * k];
    const c = [cx + hw * 0.1, yBot - 2 * k];
    const b2 = [cx + hw * 0.74, yBot - 24 * k];
    if (j > 0) {
      garland.moveTo(a[0], a[1]);
      garland.quadTo(c[0], c[1], b2[0], b2[1]);
      for (let s = 1; s < 8; s += 1) {
        const f = s / 8;
        const x = (1 - f) * (1 - f) * a[0] + 2 * f * (1 - f) * c[0] + f * f * b2[0];
        const y = (1 - f) * (1 - f) * a[1] + 2 * f * (1 - f) * c[1] + f * f * b2[1];
        (s % 2 ? lightA : lightB).addCircle(x, y, 1.6 * k);
      }
    }
  }
  const trunk = Skia.Path.Make();
  trunk.addRect(Skia.XYWHRect(cx - 8 * k, base - trunkH - 4 * k, 16 * k, trunkH + 4 * k));
  // yıldız
  const star = Skia.Path.Make();
  const sy = top - 3 * k;
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i / 10) * TAU;
    const r = (i % 2 ? 5.2 : 13) * k;
    const x = cx + Math.cos(a) * r;
    const y = sy + Math.sin(a) * r;
    if (i) star.lineTo(x, y);
    else star.moveTo(x, y);
  }
  star.close();
  const rays = Skia.Path.Make();
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * TAU;
    const r0 = 15 * k;
    const r1 = (i % 2 ? 30 : 42) * k;
    rays.moveTo(Math.cos(a - 0.05) * r0, Math.sin(a - 0.05) * r0);
    rays.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    rays.lineTo(Math.cos(a + 0.05) * r0, Math.sin(a + 0.05) * r0);
    rays.close();
  }
  // hediyeler
  const gifts = [
    [-50, 24, 18, 0],
    [-24, 16, 12, 1],
    [30, 22, 22, 1],
    [56, 15, 14, 0],
  ].map(([dx, w, h, g]) => ({ x: cx + dx * k, w: w * k, h: h * k, g }));
  return { body, snow, balls, shine, garland, lightA, lightB, trunk, star, starAt: [cx, sy], rays, gifts, base };
}

/** Hilal: dış daireden kayık iç dairenin çıkarıldığı yol (kesişim açılarıyla iki yay). */
function crescentPath(cx, cy, R) {
  const dx = R * 0.42;
  const dy = -R * 0.22;
  const r = R * 0.86;
  const d = Math.hypot(dx, dy);
  const phi = Math.atan2(dy, dx);
  const al = Math.acos((R * R + d * d - r * r) / (2 * R * d));
  const q = Skia.Path.Make();
  const n = 28;
  // dış yay: iç dairenin UZAĞINDAKİ taraf
  for (let i = 0; i <= n; i += 1) {
    const a = phi + al + ((TAU - 2 * al) * i) / n;
    const x = cx + Math.cos(a) * R;
    const y = cy + Math.sin(a) * R;
    if (i) q.lineTo(x, y);
    else q.moveTo(x, y);
  }
  // iç yay: kesişimden kesişime, dış dairenin merkezine bakan taraf
  const p1 = [Math.cos(phi - al) * R - dx, Math.sin(phi - al) * R - dy];
  const p0 = [Math.cos(phi + al) * R - dx, Math.sin(phi + al) * R - dy];
  const b1 = Math.atan2(p1[1], p1[0]);
  let b0 = Math.atan2(p0[1], p0[0]);
  // merkeze bakan yön (phi + π) arada kalsın
  const toward = phi + Math.PI;
  const norm = (v) => ((v % TAU) + TAU) % TAU;
  const inArc = (from, to, x) => norm(x - from) <= norm(to - from);
  if (!inArc(b1, b0, toward)) b0 -= TAU;
  const span = inArc(b1, b0, toward) ? norm(b0 - b1) : -norm(b1 - b0);
  for (let i = 1; i <= n; i += 1) {
    const a = b1 + (span * i) / n;
    q.lineTo(cx + dx + Math.cos(a) * r, cy + dy + Math.sin(a) * r);
  }
  q.close();
  return q;
}

// ───────────────────────────── kare başına (worklet)

function evU(p, t) {
  "worklet";
  return restU(p, t);
}

function scarfTail(t, k, E) {
  "worklet";
  const q = Skia.Path.Make();
  const f = Math.sin(t * 3.2) * (3 + E * 3) * k;
  const g = Math.sin(t * 3.2 + 1.2) * (2 + E * 2) * k;
  q.moveTo(4 * k, 0);
  q.quadTo(12 * k + f * 0.4, 6 * k, 18 * k + f, 4 * k + g);
  q.lineTo(20 * k + f, 9 * k + g);
  q.quadTo(12 * k + f * 0.3, 11 * k, 2 * k, 5 * k);
  q.close();
  return q;
}

/** Ren geyikleri (dört, tek sıra) — bacaklar dörtnala; yerel koordinat, sağa bakar. */
function deerPaths(t, k) {
  "worklet";
  const body = Skia.Path.Make();
  const legs = Skia.Path.Make();
  const antl = Skia.Path.Make();
  for (let j = 0; j < 4; j += 1) {
    const ox = (46 + j * 25) * k;
    const oy = (-10 - j * 3) * k + Math.sin(t * 9 + j) * 1.2 * k;
    body.addOval(Skia.XYWHRect(ox - 9 * k, oy - 4 * k, 18 * k, 8 * k));
    body.moveTo(ox + 5 * k, oy - 3 * k);
    body.lineTo(ox + 9 * k, oy - 12 * k);
    body.lineTo(ox + 13 * k, oy - 11 * k);
    body.lineTo(ox + 10 * k, oy - 1 * k);
    body.close();
    body.addOval(Skia.XYWHRect(ox + 9 * k, oy - 15 * k, 9 * k, 5 * k));
    body.moveTo(ox - 9 * k, oy - 2 * k);
    body.lineTo(ox - 13 * k, oy - 5 * k);
    body.lineTo(ox - 9 * k, oy - 4 * k);
    body.close();
    const ph = t * 9 + j * 0.7;
    const legsAt = [
      [ox + 6 * k, 0.65 * Math.sin(ph)],
      [ox + 3 * k, 0.65 * Math.sin(ph + 0.5)],
      [ox - 5 * k, 0.65 * Math.sin(ph + Math.PI)],
      [ox - 8 * k, 0.65 * Math.sin(ph + Math.PI + 0.5)],
    ];
    legsAt.forEach(([lx, a], m) => {
      const kx = lx + Math.sin(a + (m < 2 ? 0.6 : -0.6)) * 5 * k;
      const ky = oy + 3 * k + Math.cos(a) * 5 * k;
      legs.moveTo(lx, oy + 2 * k);
      legs.lineTo(kx, ky);
      legs.lineTo(kx + Math.sin(a * 1.4) * 4 * k, ky + 4 * k);
    });
    // boynuz
    const hx = ox + 12 * k;
    const hy = oy - 15 * k;
    antl.moveTo(hx, hy);
    antl.lineTo(hx - 3 * k, hy - 7 * k);
    antl.lineTo(hx - 7 * k, hy - 9 * k);
    antl.moveTo(hx - 2 * k, hy - 5 * k);
    antl.lineTo(hx + 1 * k, hy - 9 * k);
    antl.moveTo(hx + 2 * k, hy);
    antl.lineTo(hx + 3 * k, hy - 6 * k);
    antl.lineTo(hx + 6 * k, hy - 8 * k);
  }
  return { body, legs, antl };
}

function sleighXY(e, width, height, k) {
  "worklet";
  return [
    -210 * k + (width + 360 * k) * e,
    height * 0.21 - Math.sin(e * Math.PI) * height * 0.09,
  ];
}

// ───────────────────────────── parçalar

function Smoke({ clock, i, at, k, c }) {
  const [x0, y0] = at;
  const transform = useDerivedValue(() => {
    const f = (clock.value / 7 + i / 3) % 1;
    return [
      { translateX: x0 + f * 26 * k + Math.sin(clock.value * 0.7 + i) * 4 * k * f },
      { translateY: y0 - f * 90 * k },
      { scale: 0.4 + f * 1.6 },
    ];
  });
  const opacity = useDerivedValue(() => {
    const f = (clock.value / 7 + i / 3) % 1;
    return (1 - f) * (f < 0.12 ? f / 0.12 : 1) * 0.35;
  });
  return (
    <Group transform={transform} opacity={opacity}>
      <Circle cx={0} cy={0} r={7 * k} color={c.smoke} />
      <Circle cx={5 * k} cy={-3 * k} r={5 * k} color={c.smoke} />
    </Group>
  );
}

/** Ampul grubu: dört grup sırayla söner (kovalamaca); olayda hızlanır. */
function BulbGroup({ g, clock, E, bulbs, halos, color, night }) {
  const opacity = useDerivedValue(() => {
    const step = Math.floor(clock.value * (2.2 + E.value * 3.5));
    return (step + g) % 4 === 0 ? 0.25 : 1;
  });
  return (
    <Group opacity={opacity}>
      <Path path={halos} color={rgba(color, night ? 0.25 : 0.18)} />
      <Path path={bulbs} color={color} />
    </Group>
  );
}

function Snowman({ p, clock, L, c }) {
  const { k } = L;
  const [x, base] = L.snowman;
  const balls = [
    [base - 24 * k, 26 * k],
    [base - 60 * k, 19 * k],
    [base - 87 * k, 14 * k],
  ];
  const [hy, hr] = [balls[2][0], balls[2][1]];
  const E = useDerivedValue(() => {
    const u = evU(p, clock.value);
    return u > 1 ? 0 : sm(0.1, 0.2, u) * (1 - sm(0.62, 0.75, u));
  });
  const wave = useDerivedValue(() => [
    { translateX: x + 15 * k },
    { translateY: balls[1][0] - 4 * k },
    { rotate: -0.5 + Math.sin(clock.value * (2 + E.value * 4)) * (0.18 + E.value * 0.25) },
  ]);
  const tail = useDerivedValue(() => scarfTail(clock.value, k, E.value));
  return (
    <Group>
      <Oval x={x - 30 * k} y={base - 6 * k} width={60 * k} height={10 * k} color={c.snowShade} opacity={0.6} />
      {/* sol kol (sabit) */}
      <Path
        path={`M ${x - 15 * k} ${balls[1][0] - 2 * k} L ${x - 38 * k} ${balls[1][0] - 20 * k} M ${x - 31 * k} ${balls[1][0] - 14 * k} L ${x - 34 * k} ${balls[1][0] - 24 * k} M ${x - 33 * k} ${balls[1][0] - 17 * k} L ${x - 42 * k} ${balls[1][0] - 18 * k}`}
        style="stroke"
        strokeWidth={2 * k}
        strokeCap="round"
        color={c.deer}
      />
      {/* el sallayan sağ kol */}
      <Group transform={wave}>
        <Path
          path={`M 0 0 L ${24 * k} 0 M ${17 * k} 0 L ${22 * k} ${-7 * k} M ${20 * k} 0 L ${27 * k} ${4 * k}`}
          style="stroke"
          strokeWidth={2 * k}
          strokeCap="round"
          color={c.deer}
        />
      </Group>
      {balls.map(([cy, r], i) => (
        <Circle key={`b${i}`} cx={x} cy={cy} r={r}>
          <RadialGradient c={vec(x - r * 0.35, cy - r * 0.4)} r={r * 1.5} colors={[c.snowman, c.snowShade]} />
        </Circle>
      ))}
      {/* düğmeler, yüz */}
      {[0, 1, 2].map((i) => (
        <Circle key={`d${i}`} cx={x} cy={balls[1][0] - 8 * k + i * 8 * k} r={1.9 * k} color={c.wire} />
      ))}
      <Circle cx={x - 5 * k} cy={hy - 3 * k} r={1.7 * k} color={c.wire} />
      <Circle cx={x + 5 * k} cy={hy - 3 * k} r={1.7 * k} color={c.wire} />
      {[-2, -1, 0, 1, 2].map((i) => (
        <Circle key={`m${i}`} cx={x + i * 2.6 * k} cy={hy + 5 * k + Math.abs(i) * -0.9 * k} r={0.9 * k} color={c.wire} />
      ))}
      <Path path={`M ${x} ${hy - 1 * k} L ${x + 15 * k} ${hy + 2 * k} L ${x} ${hy + 2.6 * k} Z`} color={c.carrot} />
      {/* atkı */}
      <RoundedRect x={x - 15 * k} y={hy + hr - 5 * k} width={30 * k} height={7 * k} r={3 * k} color={c.scarf} />
      <Group transform={[{ translateX: x + 6 * k }, { translateY: hy + hr - 1 * k }]}>
        <Path path={tail} color={c.scarf} />
      </Group>
      {/* şapka */}
      <Rect x={x - 15 * k} y={hy - hr + 2 * k} width={30 * k} height={3.4 * k} color={c.wire} />
      <Rect x={x - 10 * k} y={hy - hr - 17 * k} width={20 * k} height={20 * k} color={c.wire} />
      <Rect x={x - 10 * k} y={hy - hr - 2 * k} width={20 * k} height={3 * k} color={c.scarf} />
      <Oval x={x - 11 * k} y={hy - hr - 19 * k} width={22 * k} height={4 * k} color={c.snow} />
    </Group>
  );
}

function Sleigh({ p, clock, L, c }) {
  const { k, width, height } = L;
  const deer = useDerivedValue(() => deerPaths(clock.value, k));
  const dBody = useDerivedValue(() => deer.value.body);
  const dLegs = useDerivedValue(() => deer.value.legs);
  const dAnt = useDerivedValue(() => deer.value.antl);
  const transform = useDerivedValue(() => {
    const u = evU(p, clock.value);
    const e = u > 1 ? -1 : (u - 0.06) / 0.64;
    if (e < 0 || e > 1) return [{ translateX: -900 }, { translateY: -900 }];
    const [x, y] = sleighXY(e, width, height, k);
    const tilt = -Math.cos(e * Math.PI) * 0.16 + Math.sin(clock.value * 2) * 0.02;
    return [{ translateX: x }, { translateY: y + Math.sin(clock.value * 2.4) * 3 * k }, { rotate: tilt }];
  });
  const on = useDerivedValue(() => {
    const u = evU(p, clock.value);
    return u > 1 ? 0 : sm(0.06, 0.08, u) * (1 - sm(0.68, 0.7, u));
  });
  const trail = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const t = clock.value;
    const u = evU(p, t);
    if (u > 1) return q;
    for (let j = 1; j < 26; j += 1) {
      const e = (u - 0.06) / 0.64 - j * 0.011;
      if (e < 0 || e > 1) continue;
      const [x, y] = sleighXY(e, width, height, k);
      if (hash(j, Math.floor(t * 9)) < 0.3) continue;
      const r = (2.2 - j * 0.07) * k;
      const yy = y + 8 * k + Math.sin(j * 1.3 + t * 2) * 5 * k;
      q.moveTo(x, yy - r * 1.8);
      q.lineTo(x + r * 0.4, yy - r * 0.4);
      q.lineTo(x + r * 1.8, yy);
      q.lineTo(x + r * 0.4, yy + r * 0.4);
      q.lineTo(x, yy + r * 1.8);
      q.lineTo(x - r * 0.4, yy + r * 0.4);
      q.lineTo(x - r * 1.8, yy);
      q.lineTo(x - r * 0.4, yy - r * 0.4);
      q.close();
    }
    return q;
  });
  const s = (v) => v * k;
  const reins = `M ${s(2)} ${s(-17)} Q ${s(30)} ${s(-6)} ${s(52)} ${s(-12)} M ${s(52)} ${s(-12)} L ${s(124)} ${s(-21)}`;
  const sleighBody = `M ${s(-24)} ${s(-20)} L ${s(-17)} ${s(-20)} L ${s(-13)} ${s(-8)} L ${s(12)} ${s(-8)} Q ${s(20)} ${s(-8)} ${s(22)} ${s(-16)} Q ${s(25)} ${s(-23)} ${s(31)} ${s(-19)} Q ${s(29)} ${s(-1)} ${s(14)} 0 L ${s(-18)} 0 Q ${s(-25)} 0 ${s(-24)} ${s(-20)} Z`;
  const runner = `M ${s(-26)} ${s(6)} L ${s(24)} ${s(6)} Q ${s(33)} ${s(6)} ${s(33)} ${s(-2)} M ${s(-14)} 0 L ${s(-14)} ${s(6)} M ${s(8)} 0 L ${s(8)} ${s(6)}`;
  return (
    <Group opacity={on}>
      <Path path={trail} color={c.trail} />
      <Group transform={transform}>
        <Path path={reins} style="stroke" strokeWidth={0.8 * k} color={c.ribbon} />
        <Path path={dLegs} style="stroke" strokeWidth={1.6 * k} strokeCap="round" color={c.deer} />
        <Path path={dBody} color={c.deer} />
        <Path path={dAnt} style="stroke" strokeWidth={1.1 * k} strokeCap="round" color={c.deer} />
        {/* Rudolph'un burnu */}
        <Glow cx={s(46 + 3 * 25 + 18)} cy={s(-10 - 9 - 12.5)} r={s(7)} color={c.bulb1} a={0.9} mid={0.4} />
        <Circle cx={s(46 + 3 * 25 + 18)} cy={s(-10 - 9 - 12.5)} r={s(1.8)} color={c.bulb1} />
        {/* çuval + Noel Baba */}
        <Circle cx={s(-17)} cy={s(-22)} r={s(8)} color={c.deer} />
        <Circle cx={s(-4)} cy={s(-16)} r={s(7)} color={c.sleigh} />
        <Circle cx={s(-2)} cy={s(-26)} r={s(4.2)} color={c.moon} />
        <Path path={`M ${s(-6)} ${s(-25)} Q ${s(-2)} ${s(-14)} ${s(3)} ${s(-24)} Z`} color={c.snow} />
        <Path path={`M ${s(-7)} ${s(-28)} L ${s(3)} ${s(-29)} L ${s(-9)} ${s(-37)} Z`} color={c.sleigh} />
        <Circle cx={s(-10)} cy={s(-37)} r={s(1.8)} color={c.snow} />
        <Rect x={s(-7.5)} y={s(-30)} width={s(11)} height={s(2.2)} color={c.snow} />
        <Path path={sleighBody} color={c.sleigh} />
        <Path path={`M ${s(-13)} ${s(-6)} L ${s(12)} ${s(-6)}`} style="stroke" strokeWidth={1.4 * k} color={c.ribbon} />
        <Path path={runner} style="stroke" strokeWidth={1.6 * k} strokeCap="round" color={c.ribbon} />
      </Group>
    </Group>
  );
}

export default function ChristmasScene({ p, clock, width, height, tone, lightSurface }) {
  const L = useMemo(() => xmLayout(width, height), [width, height]);
  const land = useMemo(() => buildLand(L), [L]);
  const houses = useMemo(() => buildHouses(L), [L]);
  const lights = useMemo(() => buildLights(L), [L]);
  const tree = useMemo(() => buildTree(L), [L]);
  const crescent = useMemo(() => crescentPath(L.moon[0], L.moon[1], L.moon[2]), [L]);
  const c = useMemo(() => toneMap(XM_TONE, tone.colors), [tone]);
  const { k, ground } = L;
  const night = !lightSurface;
  const [mx, my, mr] = L.moon;
  const [lx, lb] = L.lamp;
  const [sx, sy] = tree.starAt;
  const bulbCols = [c.bulb1, c.bulb2, c.bulb3, c.bulb4];
  const E = useDerivedValue(() => {
    const u = evU(p, clock.value);
    return u > 1 ? 0 : sm(0.08, 0.18, u) * (1 - sm(0.66, 0.82, u));
  });
  const twA = useDerivedValue(() => 0.55 + 0.45 * Math.sin(clock.value * 1.7));
  const twB = useDerivedValue(() => 0.55 + 0.45 * Math.sin(clock.value * 1.7 + Math.PI));
  const treeA = useDerivedValue(() => (Math.sin(clock.value * (3 + E.value * 4)) > 0 ? 1 : 0.3));
  const treeB = useDerivedValue(() => (Math.sin(clock.value * (3 + E.value * 4)) > 0 ? 0.3 : 1));
  const starSpin = useDerivedValue(() => [
    { translateX: sx },
    { translateY: sy },
    { rotate: clock.value * 0.25 },
    { scale: 1 + E.value * 0.35 + Math.sin(clock.value * 2) * 0.05 },
  ]);
  const starGlow = useDerivedValue(() => 0.65 + 0.2 * Math.sin(clock.value * 2) + E.value * 0.35);
  const winFlick = useDerivedValue(() => 0.86 + 0.08 * Math.sin(clock.value * 3.1) + 0.06 * Math.sin(clock.value * 7.3));
  return (
    <Group opacity={tone.alpha}>
      {/* gök */}
      {night ? (
        <Group>
          <Group opacity={twA}>
            <Path path={land.starA} color={c.moon} />
          </Group>
          <Group opacity={twB}>
            <Path path={land.starB} color={c.moon} />
          </Group>
        </Group>
      ) : null}
      <Glow cx={mx} cy={my} r={120 * k} color={c.moon} a={night ? 0.3 : 0.45} mid={0.3} />
      <Path path={crescent} color={c.moon} />
      <Sleigh p={p} clock={clock} L={L} c={c} />
      {/* uzak tepe: çamlar + kilise */}
      <Path path={land.far}>
        <LinearGradient start={vec(0, ground - 140 * k)} end={vec(0, ground)} colors={[c.hill, c.hillFar]} />
      </Path>
      <Path path={land.pines} color={c.pineFar} />
      <Path path={land.pineSnow} color={c.snowShade} />
      <Path path={land.church} color={c.church} />
      <Group opacity={winFlick}>
        <Path path={land.churchLit} color={c.window} />
      </Group>
      {/* köy */}
      <Path path={land.mid} color={c.snowShade} />
      {houses.chimneys.map((at, i) =>
        [0, 1, 2].map((j) => <Smoke key={`sm${i}${j}`} clock={clock} i={j + i * 0.37} at={at} k={k} c={c} />),
      )}
      <Path path={houses.roofs} color={c.roof} />
      <Path path={houses.walls}>
        <LinearGradient start={vec(0, L.houseBase - 50 * k)} end={vec(0, L.houseBase)} colors={[c.house, c.houseSide]} />
      </Path>
      <Group opacity={winFlick}>
        <Glow cx={width * 0.1} cy={L.houseBase - 26 * k} r={60 * k} color={c.window} a={night ? 0.22 : 0.12} mid={0.3} />
        <Path path={houses.lit} color={c.window} />
      </Group>
      <Path path={houses.bars} color={c.houseSide} />
      <Path path={houses.doors} color={c.houseSide} />
      {houses.wreaths.map(([x, y], i) => (
        <Group key={`w${i}`}>
          <Circle cx={x} cy={y} r={4.2 * k} style="stroke" strokeWidth={2.2 * k} color={c.tree} />
          <Circle cx={x} cy={y + 4 * k} r={1.4 * k} color={c.scarf} />
        </Group>
      ))}
      <Path path={houses.snow} color={c.snow} />
      {/* ışık zinciri */}
      <Path path={lights.wire} style="stroke" strokeWidth={0.8 * k} color={c.wire} />
      {lights.bulbs.map((b, g) => (
        <BulbGroup
          key={`lb${g}`}
          g={g}
          clock={clock}
          E={E}
          bulbs={b}
          halos={lights.halos[g]}
          color={bulbCols[g]}
          night={night}
        />
      ))}
      {/* sokak feneri */}
      <Glow cx={lx} cy={lb - 72 * k} r={60 * k} color={c.lamp} a={night ? 0.45 : 0.3} mid={0.3} />
      <Rect x={lx - 1.6 * k} y={lb - 66 * k} width={3.2 * k} height={66 * k} color={c.wire} />
      <Rect x={lx - 5 * k} y={lb - 4 * k} width={10 * k} height={4 * k} color={c.wire} />
      <Path
        path={`M ${lx - 6 * k} ${lb - 66 * k} L ${lx + 6 * k} ${lb - 66 * k} L ${lx + 7 * k} ${lb - 80 * k} L ${lx - 7 * k} ${lb - 80 * k} Z`}
        color={c.lamp}
      />
      <Path
        path={`M ${lx - 9 * k} ${lb - 79 * k} L ${lx} ${lb - 88 * k} L ${lx + 9 * k} ${lb - 79 * k} Z`}
        color={c.wire}
      />
      <Oval x={lx - 9 * k} y={lb - 91 * k} width={18 * k} height={6 * k} color={c.snow} />
      {/* ön kar */}
      <Path path={land.front}>
        <LinearGradient start={vec(0, ground)} end={vec(0, height)} colors={[c.snow, c.snowShade]} />
      </Path>
      <Group opacity={twA}>
        <Path path={land.sparkA} color={c.snowman} />
      </Group>
      <Group opacity={twB}>
        <Path path={land.sparkB} color={c.snowman} />
      </Group>
      {/* süslü ağaç */}
      <Oval x={tree.starAt[0] - 70 * k} y={tree.base - 6 * k} width={140 * k} height={12 * k} color={c.snowShade} opacity={0.7} />
      <Path path={tree.trunk} color={c.deer} />
      <Path path={tree.body}>
        <LinearGradient start={vec(sx - 60 * k, 0)} end={vec(sx + 60 * k, 0)} colors={[c.tree, c.treeDark]} />
      </Path>
      <Path path={tree.snow} color={c.snow} opacity={0.92} />
      <Path path={tree.garland} style="stroke" strokeWidth={1 * k} color={c.ribbon} opacity={0.8} />
      {tree.balls.map((b, g) => (
        <Path key={`tb${g}`} path={b} color={[c.bulb1, c.gift2, c.bulb2, c.scarf][g]} />
      ))}
      <Path path={tree.shine} color={c.snowman} opacity={0.7} />
      <Group opacity={treeA}>
        <Path path={tree.lightA} color={c.trail} />
      </Group>
      <Group opacity={treeB}>
        <Path path={tree.lightB} color={c.bulb2} />
      </Group>
      <Group opacity={starGlow}>
        <Glow cx={sx} cy={sy} r={70 * k} color={c.star} a={night ? 0.5 : 0.4} mid={0.3} />
      </Group>
      <Group transform={starSpin}>
        <Path path={tree.rays} color={c.star} opacity={0.35} />
      </Group>
      <Path path={tree.star} color={c.star} />
      {/* hediyeler */}
      {tree.gifts.map((g, i) => (
        <Group key={`g${i}`}>
          <Rect x={g.x - g.w / 2} y={tree.base - g.h} width={g.w} height={g.h} color={g.g ? c.gift2 : c.gift1} />
          <Rect x={g.x - g.w / 2} y={tree.base - g.h} width={g.w} height={g.h * 0.28} color={rgba(c.snowman, 0.18)} />
          <Rect x={g.x - 1.4 * k} y={tree.base - g.h} width={2.8 * k} height={g.h} color={c.ribbon} />
          <Rect x={g.x - g.w / 2} y={tree.base - g.h * 0.6} width={g.w} height={2.4 * k} color={c.ribbon} />
          <Oval x={g.x - 6 * k} y={tree.base - g.h - 4 * k} width={6 * k} height={4.4 * k} color={c.ribbon} />
          <Oval x={g.x} y={tree.base - g.h - 4 * k} width={6 * k} height={4.4 * k} color={c.ribbon} />
        </Group>
      ))}
      <Snowman p={p} clock={clock} L={L} c={c} />
    </Group>
  );
}
