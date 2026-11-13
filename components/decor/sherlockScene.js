// components/decor/sherlockScene.js
//
// Sherlock evren sahnesi (OVERLAY.sherVec = 50) — tamamı VEKTÖR:
//   • Gece Londra'sı: bulutların arasında ay, uzakta gotik saat kulesi (kadranı ışıklı, akrep ve
//     yelkovan döner) ve büyük kubbe; önde Viktorya dönemi sıra evler — dik çatılar, baca
//     kümeleri ve tüten duman, ışıklı cumbalı pencereler, kemerli kapılar, demir parmaklıklar.
//   • Sokak: kaldırım, ıslak arnavut kaldırımı; gaz lambalarının ışık konileri ve sudaki yansımaları;
//     yerde süzülen sis.
//   • İKİ olay (70 sn'de bir ~27 sn; döngüde sırayla, eventPick):
//   A) pelerinli, kulaklı şapkalı dedektif soldan yürür, lambanın altında
//     durur, büyüteci kaldırır (cam parlar), pipodan duman çıkar; sonra yürüyüp gider. Arkasından
//     ıslak taşta ayak izleri kalır. Sağdan atlı bir fayton geçer (tekerlekler döner, at tırıs).
//   B) ÇATI KOVALAMACASI: paltolu bir kaçak çatı sırtlarında koşar, evlerin arasındaki boşluklardan
//     atlar; kulaklı şapkalı, pelerinli dedektif hemen arkasından kovalar (bacaların arkasından geçerler).
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[50] (SH_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Circle, Group, LinearGradient, Path, Rect, Skia, vec } from "@shopify/react-native-skia";
import { eventPick, restU } from "../../utils/weatherParticles";
import { Glow, TAU, addCloud, groundLayout, hash, rgba, sm, toneMap } from "./seasonKit";

export const SH_TONE = [
  "sky",
  "moon",
  "cloud",
  "towerFar",
  "roofFar",
  "roof",
  "house",
  "houseSide",
  "window",
  "trim",
  "chimney",
  "smoke",
  "street",
  "cobble",
  "kerb",
  "lamp",
  "lampGlow",
  "fog",
  "coat",
  "cab",
  "horse",
  "glint",
  "clockFace",
];

/** A olayının (dedektif + fayton) saati: B döngülerinde dinlenmede (2). */
function evA(p, t) {
  "worklet";
  return eventPick(p, t, 2) === 0 ? restU(p, t) : 2;
}

export function shLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  return {
    ...L,
    walk: ground - 4 * k, // kaldırım (yürüyüş çizgisi)
    road: ground + 10 * k, // fayton tekerlek tabanı
    houseBase: ground - 8 * k,
    tower: [width * 0.17, ground - 8 * k],
    lamps: [width * 0.12, width * 0.52, width * 0.9],
    moon: [width * 0.8, height * 0.13, 30 * k],
  };
}

// ───────────────────────────── durağan yollar

function buildFar(L) {
  const { k, width } = L;
  const [tx, tb] = L.tower;
  const far = Skia.Path.Make();
  // uzak çatı sırası
  for (let x = -10 * k, i = 0; x < width + 10 * k; i += 1) {
    const w = (18 + hash(i, 1) * 26) * k;
    const h = (150 + hash(i, 2) * 40) * k;
    far.addRect(Skia.XYWHRect(x, tb - h, w + 1, h));
    if (hash(i, 3) > 0.55) far.addRect(Skia.XYWHRect(x + w * 0.3, tb - h - 12 * k, 5 * k, 12 * k));
    x += w;
  }
  // kubbe
  const dx = width * 0.62;
  const dy = tb - 196 * k;
  far.addRect(Skia.XYWHRect(dx - 46 * k, dy, 92 * k, 40 * k));
  far.addRect(Skia.XYWHRect(dx - 34 * k, dy - 18 * k, 68 * k, 20 * k));
  far.moveTo(dx - 32 * k, dy - 17 * k);
  far.cubicTo(dx - 32 * k, dy - 64 * k, dx + 32 * k, dy - 64 * k, dx + 32 * k, dy - 17 * k);
  far.close();
  far.addRect(Skia.XYWHRect(dx - 6 * k, dy - 70 * k, 12 * k, 22 * k));
  far.moveTo(dx - 5 * k, dy - 70 * k);
  far.lineTo(dx, dy - 84 * k);
  far.lineTo(dx + 5 * k, dy - 70 * k);
  far.close();
  [-1, 1].forEach((s) => {
    far.addRect(Skia.XYWHRect(dx + s * 58 * k - 6 * k, dy - 6 * k, 12 * k, 46 * k));
    far.moveTo(dx + s * 58 * k - 7 * k, dy - 6 * k);
    far.lineTo(dx + s * 58 * k, dy - 22 * k);
    far.lineTo(dx + s * 58 * k + 7 * k, dy - 6 * k);
    far.close();
  });
  // saat kulesi
  const tower = Skia.Path.Make();
  const tw = 34 * k;
  const top = tb - 300 * k;
  tower.addRect(Skia.XYWHRect(tx - tw / 2, top, tw, 300 * k));
  tower.addRect(Skia.XYWHRect(tx - tw / 2 - 3 * k, top + 34 * k, tw + 6 * k, 4 * k));
  tower.addRect(Skia.XYWHRect(tx - tw / 2 - 2 * k, top - 8 * k, tw + 4 * k, 10 * k));
  tower.moveTo(tx - tw / 2, top - 8 * k);
  tower.lineTo(tx, top - 70 * k);
  tower.lineTo(tx + tw / 2, top - 8 * k);
  tower.close();
  tower.addRect(Skia.XYWHRect(tx - 1 * k, top - 84 * k, 2 * k, 16 * k));
  [-1, 1].forEach((s) => {
    const px = tx + s * (tw / 2 - 1 * k);
    tower.moveTo(px - 3 * k, top - 8 * k);
    tower.lineTo(px, top - 30 * k);
    tower.lineTo(px + 3 * k, top - 8 * k);
    tower.close();
  });
  // gotik pencere şeritleri (koyu)
  const slits = Skia.Path.Make();
  for (let r = 0; r < 8; r += 1) {
    const y = top + 60 * k + r * 28 * k;
    [-8, 4].forEach((ox) => slits.addRect(Skia.XYWHRect(tx + ox * k, y, 4 * k, 16 * k)));
  }
  const face = [tx, top + 18 * k, 12.5 * k];
  return { far, tower, slits, face };
}

function buildHouses(L) {
  const { k, width } = L;
  const hb = L.houseBase;
  const fronts = [Skia.Path.Make(), Skia.Path.Make()];
  const roofs = Skia.Path.Make();
  const chim = Skia.Path.Make();
  const lit = Skia.Path.Make();
  const litDim = Skia.Path.Make();
  const dark = Skia.Path.Make();
  const trim = Skia.Path.Make();
  const rails = Skia.Path.Make();
  const pots = [];
  const ridges = [];
  let x = -6 * k;
  let i = 0;
  while (x < width + 6 * k) {
    const w = (74 + hash(i, 1) * 22) * k;
    const h = (118 + hash(i, 2) * 36) * k;
    const top = hb - h;
    fronts[i % 2].addRect(Skia.XYWHRect(x, top, w + 1, h + 12 * k));
    // korniş + kat çizgisi
    trim.addRect(Skia.XYWHRect(x - 2 * k, top - 3 * k, w + 4 * k, 4 * k));
    trim.addRect(Skia.XYWHRect(x, top + h * 0.48, w, 2.4 * k));
    // dik çatı (mansard) + çatı penceresi
    roofs.moveTo(x - 2 * k, top - 3 * k);
    roofs.lineTo(x + w * 0.12, top - 34 * k);
    roofs.lineTo(x + w * 0.88, top - 34 * k);
    ridges.push([x + w * 0.12, x + w * 0.88, top - 34 * k]);
    roofs.lineTo(x + w + 2 * k, top - 3 * k);
    roofs.close();
    const dw = x + w * 0.42;
    roofs.addRect(Skia.XYWHRect(dw - 2 * k, top - 26 * k, 16 * k, 20 * k));
    (hash(i, 9) > 0.5 ? lit : dark).addRect(Skia.XYWHRect(dw + 2 * k, top - 22 * k, 8 * k, 13 * k));
    // baca kümeleri
    [0.2, 0.8].forEach((f, j) => {
      const cx = x + w * f;
      const ch = (26 + hash(i * 3 + j, 4) * 10) * k;
      chim.addRect(Skia.XYWHRect(cx - 7 * k, top - 34 * k - ch, 14 * k, ch + 2));
      chim.addRect(Skia.XYWHRect(cx - 9 * k, top - 34 * k - ch, 18 * k, 3 * k));
      for (let q = 0; q < 3; q += 1) {
        chim.addRect(Skia.XYWHRect(cx - 6 * k + q * 4.4 * k, top - 34 * k - ch - 6 * k, 3 * k, 6 * k));
      }
      if (j === (i % 2)) pots.push([cx, top - 34 * k - ch - 6 * k]);
    });
    // üst kat pencereleri (sürgülü) + alt kat cumba + kapı
    const cols = 3;
    for (let c = 0; c < cols; c += 1) {
      const wx = x + w * (0.12 + c * 0.29);
      const wy = top + h * 0.12;
      const v = hash(i * 5 + c, 6);
      (v < 0.38 ? lit : v < 0.6 ? litDim : dark).addRect(Skia.XYWHRect(wx, wy, 13 * k, 24 * k));
      trim.addRect(Skia.XYWHRect(wx - 1.5 * k, wy + 24 * k, 16 * k, 2 * k));
      trim.addRect(Skia.XYWHRect(wx, wy + 11 * k, 13 * k, 1.2 * k));
      trim.addRect(Skia.XYWHRect(wx + 6 * k, wy, 1.2 * k, 24 * k));
    }
    const bx = x + w * 0.1;
    const by = top + h * 0.58;
    const bw = w * 0.42;
    trim.addRect(Skia.XYWHRect(bx - 3 * k, by - 4 * k, bw + 6 * k, 4 * k));
    (hash(i, 7) > 0.35 ? lit : litDim).addRect(Skia.XYWHRect(bx, by, bw, h * 0.3));
    for (let m = 1; m < 3; m += 1) trim.addRect(Skia.XYWHRect(bx + (bw * m) / 3, by, 1.6 * k, h * 0.3));
    // kemerli kapı + fanlight + basamak
    const dx = x + w * 0.66;
    const dh = 34 * k;
    dark.addRect(Skia.XYWHRect(dx, hb - dh, 15 * k, dh));
    lit.addCircle(dx + 7.5 * k, hb - dh, 7.5 * k);
    dark.addRect(Skia.XYWHRect(dx, hb - dh - 0.5 * k, 15 * k, 2 * k));
    trim.addRect(Skia.XYWHRect(dx - 3 * k, hb, 21 * k, 3 * k));
    trim.addRect(Skia.XYWHRect(dx - 6 * k, hb + 3 * k, 27 * k, 3 * k));
    // demir parmaklık
    for (let r = x + 2 * k; r < dx - 8 * k; r += 4 * k) {
      rails.moveTo(r, hb + 6 * k);
      rails.lineTo(r, hb - 10 * k);
    }
    rails.moveTo(x + 2 * k, hb - 8 * k);
    rails.lineTo(dx - 8 * k, hb - 8 * k);
    x += w + 2 * k;
    i += 1;
  }
  return { fronts, roofs, chim, lit, litDim, dark, trim, rails, pots, ridges };
}

function buildStreet(L) {
  const { k, width, height, ground } = L;
  const cobbles = Skia.Path.Make();
  for (let r = 0; r < 9; r += 1) {
    const y = ground + (14 + r * 10 * (1 + r * 0.08)) * k;
    if (y > height) break;
    const cw = (10 + r * 1.6) * k;
    for (let x = (r % 2) * cw * 0.5 - cw; x < width + cw; x += cw + 2 * k) {
      cobbles.addRRect(Skia.RRectXY(Skia.XYWHRect(x, y, cw, 5.5 * k + r * 0.4 * k), 2 * k, 2 * k));
    }
  }
  const posts = Skia.Path.Make();
  const heads = Skia.Path.Make();
  L.lamps.forEach((x) => {
    const b = ground + 2 * k;
    posts.addRect(Skia.XYWHRect(x - 1.6 * k, b - 74 * k, 3.2 * k, 74 * k));
    posts.addRect(Skia.XYWHRect(x - 4.5 * k, b - 8 * k, 9 * k, 8 * k));
    posts.addRect(Skia.XYWHRect(x - 8 * k, b - 66 * k, 16 * k, 1.6 * k));
    // fener kafesi
    heads.moveTo(x - 7 * k, b - 76 * k);
    heads.lineTo(x + 7 * k, b - 76 * k);
    heads.lineTo(x + 5 * k, b - 92 * k);
    heads.lineTo(x - 5 * k, b - 92 * k);
    heads.close();
    posts.moveTo(x - 8 * k, b - 92 * k);
    posts.lineTo(x, b - 99 * k);
    posts.lineTo(x + 8 * k, b - 92 * k);
    posts.close();
    posts.addRect(Skia.XYWHRect(x - 8 * k, b - 77 * k, 16 * k, 2 * k));
  });
  return { cobbles, posts, heads };
}

// ───────────────────────────── kare başına

/** Dedektifin yol üstündeki konumu ve hali (u: olay saati). */
function detectiveAt(u, width, k) {
  "worklet";
  // 0.06–0.32 yürür (sol dışından lambaya), 0.32–0.58 durur ve inceler, 0.58–0.84 yürüyüp çıkar
  const x0 = -30 * k;
  const xs = width * 0.48;
  const x1 = width + 40 * k;
  if (u < 0.06 || u > 0.84) return { on: 0, x: -999, walk: 0, look: 0 };
  if (u < 0.32) return { on: 1, x: x0 + (xs - x0) * ((u - 0.06) / 0.26), walk: 1, look: 0 };
  if (u < 0.58) {
    const f = (u - 0.32) / 0.26;
    return { on: 1, x: xs, walk: 0, look: sm(0.05, 0.2, f) * (1 - sm(0.8, 0.95, f)) };
  }
  return { on: 1, x: xs + (x1 - xs) * ((u - 0.58) / 0.26), walk: 1, look: 0 };
}

function detectivePaths(t, walk, look, k) {
  "worklet";
  const s = (v) => v * k;
  const body = Skia.Path.Make();
  const ph = t * 7.5;
  const sw = walk ? Math.sin(ph) * 0.42 : 0;
  // bacaklar (kalçadan döner)
  for (let j = 0; j < 2; j += 1) {
    const a = j ? sw : -sw;
    const hx = s(1);
    const hy = s(-25);
    const fx = hx + Math.sin(a) * s(25);
    const fy = hy + Math.cos(a) * s(25);
    body.moveTo(hx - s(3), hy);
    body.lineTo(hx + s(3), hy);
    body.lineTo(fx + s(2), fy);
    body.lineTo(fx + s(6), fy);
    body.lineTo(fx + s(6), fy + s(2));
    body.lineTo(fx - s(3), fy + s(2));
    body.close();
  }
  // palto + pelerin
  const flap = walk ? Math.sin(ph * 2) * s(1.5) : 0;
  body.moveTo(s(-6), s(-47));
  body.lineTo(s(7), s(-47));
  body.lineTo(s(12), s(-20) + flap);
  body.lineTo(s(-11), s(-19) - flap);
  body.close();
  body.moveTo(s(-8), s(-47));
  body.lineTo(s(9), s(-47));
  body.lineTo(s(13), s(-33));
  body.quadTo(s(0), s(-30), s(-14), s(-32) - flap);
  body.close();
  // baş + kulaklı şapka + boyun
  body.addRect(Skia.XYWHRect(s(-1.5), s(-50), s(4), s(4)));
  body.addCircle(s(1), s(-53), s(4.6));
  body.moveTo(s(-5), s(-55));
  body.quadTo(s(1), s(-63), s(7), s(-56));
  body.lineTo(s(12), s(-54));
  body.lineTo(s(6), s(-53.5));
  body.lineTo(s(-5), s(-53.5));
  body.lineTo(s(-9), s(-51));
  body.close();
  // pipo
  body.moveTo(s(5), s(-51));
  body.lineTo(s(9), s(-50));
  body.lineTo(s(9), s(-53));
  body.lineTo(s(11), s(-53));
  body.lineTo(s(11), s(-49));
  body.lineTo(s(5), s(-49.6));
  body.close();
  // kol: yürürken sallanır, incelerken büyüteci kaldırır
  // kol: θ aşağıdan öne doğru açı — yürürken sallanır, incelerken büyüteci göz hizasına kaldırır
  const th = walk ? Math.sin(ph) * 0.4 : 0.15 + look * 1.75;
  const sx0 = s(3);
  const sy0 = s(-44);
  const len = s(17);
  const hxx = sx0 + Math.sin(th) * len;
  const hyy = sy0 + Math.cos(th) * len;
  body.moveTo(sx0 - s(2), sy0);
  body.lineTo(sx0 + s(2), sy0);
  body.lineTo(hxx + s(1.6), hyy);
  body.lineTo(hxx - s(1.6), hyy);
  body.close();
  const lens = Skia.Path.Make();
  if (look > 0.05) {
    const lx = hxx + s(5);
    const ly = hyy - s(4);
    lens.addCircle(lx, ly, s(4.5));
    body.moveTo(hxx, hyy);
    body.lineTo(lx - s(3), ly + s(3));
    body.lineTo(lx - s(2), ly + s(4));
    body.lineTo(hxx + s(1), hyy + s(1));
    body.close();
    return { body, lens, lx, ly };
  }
  return { body, lens, lx: 0, ly: 0 };
}

function cabPaths(t, k) {
  "worklet";
  const s = (v) => v * k;
  const body = Skia.Path.Make();
  const wheel = Skia.Path.Make();
  // kabin (sağa bakan; Group'ta aynalanır)
  body.moveTo(s(-4), s(-24));
  body.lineTo(s(-4), s(-50));
  body.quadTo(s(-4), s(-60), s(8), s(-60));
  body.lineTo(s(26), s(-60));
  body.lineTo(s(30), s(-46));
  body.lineTo(s(34), s(-34));
  body.lineTo(s(34), s(-24));
  body.close();
  // sürücü koltuğu + arabacı (silindir şapka)
  body.addRect(Skia.XYWHRect(s(-14), s(-64), s(12), s(4)));
  body.addRect(Skia.XYWHRect(s(-10), s(-78), s(7), s(14)));
  body.addCircle(s(-6.5), s(-82), s(3.4));
  body.addRect(Skia.XYWHRect(s(-10), s(-92), s(7), s(8)));
  body.addRect(Skia.XYWHRect(s(-12), s(-85), s(11), s(1.6)));
  // kamçı
  body.moveTo(s(-4), s(-76));
  body.quadTo(s(14), s(-98), s(40), s(-84));
  body.lineTo(s(40), s(-83));
  body.quadTo(s(14), s(-96), s(-3), s(-75));
  body.close();
  // oklar (atın koşum kolları)
  body.addRect(Skia.XYWHRect(s(30), s(-30), s(30), s(2)));
  // büyük tekerlek
  const wx = s(14);
  const wy = s(-13);
  const R = s(13);
  wheel.addCircle(wx, wy, R);
  wheel.addCircle(wx, wy, R - s(2));
  const rot = t * 4.2;
  for (let i = 0; i < 10; i += 1) {
    const a = rot + (i / 10) * TAU;
    wheel.moveTo(wx, wy);
    wheel.lineTo(wx + Math.cos(a) * R, wy + Math.sin(a) * R);
  }
  // at (tırıs)
  const ph = t * 8;
  const hx = s(70);
  const hy = s(-40);
  body.addOval(Skia.XYWHRect(hx - s(16), hy - s(8), s(32), s(16)));
  body.moveTo(hx + s(10), hy - s(4));
  body.lineTo(hx + s(20), hy - s(22));
  body.lineTo(hx + s(26), hy - s(20));
  body.lineTo(hx + s(18), hy);
  body.close();
  body.moveTo(hx + s(19), hy - s(24));
  body.lineTo(hx + s(32), hy - s(16));
  body.lineTo(hx + s(30), hy - s(12));
  body.lineTo(hx + s(20), hy - s(15));
  body.close();
  body.moveTo(hx + s(20), hy - s(23));
  body.lineTo(hx + s(21), hy - s(28));
  body.lineTo(hx + s(23), hy - s(23));
  body.close();
  // kuyruk
  body.moveTo(hx - s(15), hy - s(4));
  body.quadTo(hx - s(24), hy + s(2), hx - s(21), hy + s(14));
  body.lineTo(hx - s(18), hy + s(12));
  body.quadTo(hx - s(19), hy + s(2), hx - s(14), hy - s(1));
  body.close();
  const legs = Skia.Path.Make();
  [[s(10), 0], [s(6), Math.PI], [s(-10), Math.PI], [s(-14), 0]].forEach(([lx, o]) => {
    const a = Math.sin(ph + o) * 0.45;
    const kx = hx + lx + Math.sin(a) * s(10);
    const ky = hy + s(6) + Math.cos(a) * s(10);
    const lift = Math.max(0, Math.sin(ph + o + 0.6)) * s(4);
    legs.moveTo(hx + lx, hy + s(4));
    legs.lineTo(kx, ky);
    legs.lineTo(kx + Math.sin(a * 0.5) * s(2), ky + s(12) - lift);
  });
  return { body, wheel, legs };
}

// ───────────────────────────── parçalar

function Smoke({ clock, i, at, k, c }) {
  const [x0, y0] = at;
  const transform = useDerivedValue(() => {
    const f = (clock.value / 8 + i / 3) % 1;
    return [
      { translateX: x0 - f * 30 * k + Math.sin(clock.value * 0.6 + i) * 4 * k * f },
      { translateY: y0 - f * 70 * k },
      { scale: 0.4 + f * 1.7 },
    ];
  });
  const opacity = useDerivedValue(() => {
    const f = (clock.value / 8 + i / 3) % 1;
    return (1 - f) * (f < 0.12 ? f / 0.12 : 1) * 0.3;
  });
  return (
    <Group transform={transform} opacity={opacity}>
      <Circle cx={0} cy={0} r={8 * k} color={c.smoke} />
      <Circle cx={6 * k} cy={-3 * k} r={6 * k} color={c.smoke} />
    </Group>
  );
}

function FogPuff({ clock, i, L, c, night }) {
  const { k, width, ground } = L;
  const R = (100 + hash(i, 1) * 60) * k;
  const v = (4 + hash(i, 2) * 5) * k * (i % 2 ? 1 : -1);
  const x0 = hash(i, 3) * (width + 2 * R);
  const y = ground - (20 + hash(i, 4) * 50) * k;
  const transform = useDerivedValue(() => {
    const span = width + 2 * R;
    let x = (x0 + clock.value * v) % span;
    if (x < 0) x += span;
    return [{ translateX: x - R }, { translateY: y }, { scaleY: 0.3 }];
  });
  return (
    <Group transform={transform}>
      <Glow r={R} color={c.fog} a={night ? 0.2 : 0.38} mid={0.55} />
    </Group>
  );
}

function Detective({ p, clock, L, c }) {
  const { k, width } = L;
  const st = useDerivedValue(() => detectiveAt(evA(p, clock.value), width, k));
  const d = useDerivedValue(() => detectivePaths(clock.value, st.value.walk, st.value.look, k));
  const body = useDerivedValue(() => d.value.body);
  const lens = useDerivedValue(() => d.value.lens);
  const at = useDerivedValue(() => [{ translateX: st.value.x }, { translateY: L.walk + Math.abs(Math.sin(clock.value * 7.5)) * st.value.walk * 1.2 * k }]);
  const on = useDerivedValue(() => st.value.on);
  const look = useDerivedValue(() => st.value.look);
  const glintAt = useDerivedValue(() => [{ translateX: d.value.lx - 1.5 * k }, { translateY: d.value.ly - 1.5 * k }]);
  // pipo dumanı (dururken)
  const puff = useDerivedValue(() => {
    const q = Skia.Path.Make();
    if (st.value.walk || !st.value.on) return q;
    for (let j = 0; j < 4; j += 1) {
      const f = (clock.value / 3 + j / 4) % 1;
      q.addCircle(11 * k + f * 6 * k + Math.sin(f * 6 + j) * 2 * k, -55 * k - f * 26 * k, (1.5 + f * 4) * k);
    }
    return q;
  });
  // ayak izleri: yürüdüğü yol boyunca, eskiyen silinir
  const prints = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const u = evA(p, clock.value);
    if (u > 1) return q;
    const step = 9 * k;
    const cur = st.value.on ? st.value.x : u > 0.84 ? width + 40 * k : -999;
    for (let x = cur - step, j = 0; x > -20 * k && j < 18; x -= step, j += 1) {
      q.addOval(Skia.XYWHRect(x - 3 * k, L.walk + (j % 2 ? 1 : 3) * k, 6 * k, 2.2 * k));
    }
    return q;
  });
  const printA = useDerivedValue(() => {
    const u = evA(p, clock.value);
    return u > 1 ? 0 : 0.45 * (1 - sm(0.84, 0.98, u));
  });
  return (
    <Group>
      <Group opacity={printA}>
        <Path path={prints} color={c.kerb} />
      </Group>
      <Group opacity={on}>
        <Group transform={at}>
          <Path path={puff} color={c.smoke} opacity={0.45} />
          <Path path={body} color={c.coat} />
          <Path path={lens} style="stroke" strokeWidth={1.2 * k} color={c.coat} />
          <Group opacity={look}>
            <Path path={lens} color={c.glint} opacity={0.35} />
            <Group transform={glintAt}>
              <Glow r={7 * k} color={c.glint} a={0.9} mid={0.3} />
            </Group>
          </Group>
        </Group>
      </Group>
    </Group>
  );
}

function Cab({ p, clock, L, c }) {
  const { k, width } = L;
  const d = useDerivedValue(() => cabPaths(clock.value, k));
  const body = useDerivedValue(() => d.value.body);
  const wheel = useDerivedValue(() => d.value.wheel);
  const legs = useDerivedValue(() => d.value.legs);
  const transform = useDerivedValue(() => {
    const u = evA(p, clock.value);
    const e = u > 1 ? -1 : (u - 0.6) / 0.28;
    if (e < 0 || e > 1) return [{ translateX: -900 }, { translateY: -900 }];
    // sağdan sola: aynalanmış (at önde)
    const x = width + 110 * k - (width + 260 * k) * e;
    return [{ translateX: x }, { translateY: L.road + Math.abs(Math.sin(clock.value * 8)) * 1.2 * k }, { scaleX: -1 }];
  });
  return (
    <Group transform={transform}>
      <Glow cx={36 * k} cy={-40 * k} r={14 * k} color={c.lampGlow} a={0.8} mid={0.35} />
      <Path path={legs} style="stroke" strokeWidth={2.6 * k} strokeCap="round" color={c.horse} />
      <Path path={body} color={c.cab} />
      <Rect x={4 * k} y={-52 * k} width={14 * k} height={14 * k} color={c.window} opacity={0.75} />
      <Path path={wheel} style="stroke" strokeWidth={1.4 * k} color={c.cab} />
      <Circle cx={36 * k} cy={-40 * k} r={2 * k} color={c.lamp} />
    </Group>
  );
}

function ClockHands({ clock, face, k, c }) {
  const [x, y, r] = face;
  const minute = useDerivedValue(() => [{ translateX: x }, { translateY: y }, { rotate: (clock.value / 60) * TAU * 0.25 }]);
  const hour = useDerivedValue(() => [{ translateX: x }, { translateY: y }, { rotate: (clock.value / 720) * TAU * 0.25 + 1.2 }]);
  return (
    <Group>
      <Glow cx={x} cy={y} r={r * 2.6} color={c.clockFace} a={0.35} mid={0.35} />
      <Circle cx={x} cy={y} r={r} color={c.clockFace} />
      <Circle cx={x} cy={y} r={r} style="stroke" strokeWidth={1.4 * k} color={c.towerFar} />
      {Array.from({ length: 12 }, (_, i) => (
        <Rect
          key={i}
          x={x + Math.cos((i / 12) * TAU) * r * 0.8 - 0.6 * k}
          y={y + Math.sin((i / 12) * TAU) * r * 0.8 - 0.6 * k}
          width={1.2 * k}
          height={1.2 * k}
          color={c.towerFar}
        />
      ))}
      <Group transform={minute}>
        <Rect x={-0.6 * k} y={-r * 0.82} width={1.2 * k} height={r * 0.82} color={c.towerFar} />
      </Group>
      <Group transform={hour}>
        <Rect x={-0.9 * k} y={-r * 0.5} width={1.8 * k} height={r * 0.5} color={c.towerFar} />
      </Group>
    </Group>
  );
}

// ───────────────────────────── B: çatı kovalamacası

/** Çatı sırtında x'teki ayak yüksekliği: sırtta düz, ev aralarında atlayış yayı. */
function roofRunY(ridges, x) {
  "worklet";
  for (let i = 0; i < ridges.length; i += 1) {
    const [a, b, y] = ridges[i];
    if (x >= a && x <= b) return y;
    const nx = ridges[i + 1];
    if (nx && x > b && x < nx[0]) {
      const f = (x - b) / (nx[0] - b);
      return y + (nx[2] - y) * f - Math.sin(f * Math.PI) * (16 + (nx[0] - b) * 0.25);
    }
  }
  return ridges.length ? ridges[0][2] : 0;
}

/** Koşan siluet (taban 0,0; birim dp/k). hat 1 = kulaklı şapka + pelerin. */
function runnerPath(ph, hat) {
  "worklet";
  const q = Skia.Path.Make();
  const a = Math.sin(ph) * 0.8;
  // bacaklar
  q.moveTo(-1, -11);
  q.lineTo(-1 + Math.sin(a) * 6, -11 + Math.cos(a) * 6);
  q.lineTo(-1 + Math.sin(a) * 6 - Math.max(0, -a) * 4, -11 + Math.cos(a) * 11);
  q.moveTo(-1, -11);
  q.lineTo(-1 - Math.sin(a) * 6, -11 + Math.cos(a) * 6);
  q.lineTo(-1 - Math.sin(a) * 6 - Math.max(0, a) * 4, -11 + Math.cos(a) * 11);
  // kollar
  q.moveTo(1, -21);
  q.lineTo(1 - Math.sin(a) * 6, -16);
  q.moveTo(1, -21);
  q.lineTo(1 + Math.sin(a) * 6, -16);
  return q;
}

const RUN_COAT = "M -3.6 -10 L -2.4 -22.6 Q 0.4 -24.6 3.4 -22.4 L 3.8 -10 Z";
const RUN_HEAD = "M 1 -26.4 m -2.6 0 a 2.6 2.6 0 1 0 5.2 0 a 2.6 2.6 0 1 0 -5.2 0";
const RUN_CAPE = "M -2.6 -22.6 Q -9 -18 -10 -12 L -3 -14 Z";
const RUN_DEER = "M -2.4 -27.4 Q 1 -31.4 4.4 -27.4 L 6.4 -26.6 L -4.2 -26.4 Z";

function RoofChase({ p, clock, L, ridges, c }) {
  const { k, width } = L;
  const span = width + 120 * k;
  const xAt = (u, lead) => {
    "worklet";
    return -60 * k + span * sm(0.08, 0.84, u) + lead;
  };
  const show = useDerivedValue(() => {
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 1) return 0;
    return sm(0.06, 0.1, u) * (1 - sm(0.82, 0.86, u));
  });
  const pose = (lead) => {
    "worklet";
    const u = Math.min(1, restU(p, clock.value));
    const x = xAt(u, lead);
    const y = roofRunY(ridges, x) - Math.abs(Math.sin(clock.value * 7 + lead)) * 1.5 * k;
    return [{ translateX: x }, { translateY: y }, { scale: k * 1.6 }, { rotate: 0.08 }];
  };
  const atA = useDerivedValue(() => pose(46 * k));
  const atB = useDerivedValue(() => pose(0));
  const limbsA = useDerivedValue(() => runnerPath(clock.value * 7 + 1, 0));
  const limbsB = useDerivedValue(() => runnerPath(clock.value * 7, 1));
  return (
    <Group opacity={show}>
      <Group transform={atA}>
        <Path path={limbsA} style="stroke" strokeWidth={2} strokeCap="round" strokeJoin="round" color={c.coat} />
        <Path path={RUN_COAT} color={c.coat} />
        <Path path={RUN_HEAD} color={c.coat} />
      </Group>
      <Group transform={atB}>
        <Path path={limbsB} style="stroke" strokeWidth={2} strokeCap="round" strokeJoin="round" color={c.coat} />
        <Path path={RUN_CAPE} color={c.coat} />
        <Path path={RUN_COAT} color={c.coat} />
        <Path path={RUN_HEAD} color={c.coat} />
        <Path path={RUN_DEER} color={c.coat} />
      </Group>
    </Group>
  );
}

export default function SherlockScene({ p, clock, width, height, tone, lightSurface }) {
  const L = useMemo(() => shLayout(width, height), [width, height]);
  const far = useMemo(() => buildFar(L), [L]);
  const houses = useMemo(() => buildHouses(L), [L]);
  const street = useMemo(() => buildStreet(L), [L]);
  const clouds = useMemo(() => {
    const q = Skia.Path.Make();
    addCloud(q, 0, 0, 170 * L.k, 18 * L.k, 3);
    addCloud(q, 150 * L.k, 30 * L.k, 120 * L.k, 13 * L.k, 7);
    return q;
  }, [L]);
  const c = useMemo(() => toneMap(SH_TONE, tone.colors), [tone]);
  const { k, ground } = L;
  const night = !lightSurface;
  const [mx, my, mr] = L.moon;
  const flick = useDerivedValue(() => 0.86 + 0.08 * Math.sin(clock.value * 2.3) + 0.06 * Math.sin(clock.value * 5.1 + 1));
  const lampFl = useDerivedValue(() => 0.85 + 0.1 * Math.sin(clock.value * 6.3) + 0.05 * Math.sin(clock.value * 11.7));
  const cloudT = useDerivedValue(() => {
    const span = width + 460 * k;
    return [{ translateX: ((clock.value * 5 * k) % span) - 300 * k }, { translateY: my + 6 * k }];
  });
  return (
    <Group opacity={tone.alpha}>
      {/* gök: ay + bulutlar */}
      <Glow cx={mx} cy={my} r={140 * k} color={c.moon} a={night ? 0.22 : 0.3} mid={0.3} />
      <Circle cx={mx} cy={my} r={mr} color={c.moon} />
      <Group transform={cloudT} opacity={night ? 0.75 : 0.85}>
        <Path path={clouds} color={c.cloud} />
      </Group>
      {/* uzak şehir: kubbe, çatılar, saat kulesi */}
      <Path path={far.far} color={c.roofFar} />
      <Path path={far.tower} color={c.towerFar} />
      <Path path={far.slits} color={c.window} opacity={night ? 0.35 : 0.5} />
      <ClockHands clock={clock} face={far.face} k={k} c={c} />
      <Group transform={[{ translateX: width / 2 }, { translateY: L.houseBase - 120 * k }, { scaleY: 0.4 }]}>
        <Glow r={width * 0.9} color={c.fog} a={night ? 0.16 : 0.3} mid={0.5} />
      </Group>
      {/* bacalardan duman */}
      {houses.pots.map((at, i) =>
        i % 2 ? null : [0, 1, 2].map((j) => <Smoke key={`s${i}${j}`} clock={clock} i={j + i * 0.31} at={at} k={k} c={c} />),
      )}
      {/* sıra evler */}
      <Path path={houses.roofs} color={c.roof} />
      <RoofChase p={p} clock={clock} L={L} ridges={houses.ridges} c={c} />
      <Path path={houses.chim} color={c.chimney} />
      <Path path={houses.fronts[0]} color={c.house} />
      <Path path={houses.fronts[1]} color={c.houseSide} />
      <Group opacity={flick}>
        <Path path={houses.lit} color={c.window} />
        <Path path={houses.litDim} color={c.window} opacity={0.55} />
      </Group>
      <Path path={houses.dark} color={c.roof} />
      <Path path={houses.trim} color={c.trim} />
      <Path path={houses.rails} style="stroke" strokeWidth={0.9 * k} color={c.coat} />
      {[0, 1].map((i) => (
        <FogPuff key={`fa${i}`} clock={clock} i={i} L={L} c={c} night={night} />
      ))}
      {/* sokak */}
      <Rect x={0} y={ground - 6 * k} width={width} height={10 * k} color={c.kerb} />
      <Rect x={0} y={ground + 4 * k} width={width} height={height - ground}>
        <LinearGradient start={vec(0, ground)} end={vec(0, height)} colors={[c.street, c.coat]} />
      </Rect>
      <Path path={street.cobbles} color={c.cobble} opacity={0.55} />
      {/* lamba ışıkları: koni + ıslak taşta yansıma */}
      <Group opacity={lampFl}>
        {L.lamps.map((x, i) => (
          <Group key={`lg${i}`}>
            <Path
              path={`M ${x - 6 * k} ${ground - 82 * k} L ${x + 6 * k} ${ground - 82 * k} L ${x + 46 * k} ${ground + 2 * k} L ${x - 46 * k} ${ground + 2 * k} Z`}
            >
              <LinearGradient
                start={vec(0, ground - 82 * k)}
                end={vec(0, ground)}
                colors={[rgba(c.lampGlow, night ? 0.28 : 0.18), rgba(c.lampGlow, 0)]}
              />
            </Path>
            <Glow cx={x} cy={ground - 82 * k} r={34 * k} color={c.lampGlow} a={0.75} mid={0.3} />
            <Group transform={[{ translateX: x }, { translateY: ground + 34 * k }, { scaleX: 0.28 }, { scaleY: 1.2 }]}>
              <Glow r={40 * k} color={c.lampGlow} a={night ? 0.35 : 0.25} mid={0.4} />
            </Group>
          </Group>
        ))}
      </Group>
      <Path path={street.posts} color={c.coat} />
      <Path path={street.heads} color={c.lamp} />
      <Detective p={p} clock={clock} L={L} c={c} />
      <Cab p={p} clock={clock} L={L} c={c} />
      {[2, 3, 4].map((i) => (
        <FogPuff key={`fb${i}`} clock={clock} i={i} L={L} c={c} night={night} />
      ))}
    </Group>
  );
}
