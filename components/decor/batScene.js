// components/decor/batScene.js
//
// Batman atmosfer sahnesi (OVERLAY.gotham = 19) — tamamı VEKTÖR:
//   • Gotham gecesi: alçak bulut tabakası, üç kat gotik silüet (sivri kuleler, beşik çatılar, kademeli
//     taçlar), sıcak pencereler, ışıklı kadranlı saat kulesi, ufukta sis; solda polis çatısı ve dev
//     projektör; sağda heykelli taş kule (çıkıntıda kanatlı gargoyle); en altta ıslak sokak + fenerler.
//   • Sakin: Batman gargoyle'un üstünde çömelmiş, pelerini rüzgârda dalgalanır.
//   • Olay (batFrame, 30 sn): projektör yanar, bulutlara yarasa işareti düşer → şimşek çakar,
//     Batman doğrulup işarete bakar → kuleden atlar, yarasalar havalanır, pelerini kanat gibi açıp
//     şehrin üstünde uzaklaşarak süzülür → kancayla uzak kuleye çekilip kaybolur → işaret söner →
//     bulutların önünden süzülerek geri gelir ve gargoyle'a konar.
//   • Figür eklemli (gövde, kukuletalı baş, kollar, bacaklar) + pelerin: dökük hâl ile kanat hâli
//     arasında nokta nokta karışan, eteği dalgalanan tek yol.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift (sekme çubuğu). Renkler OVERLAY_TONES[19] (BAT_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Circle, Group, LinearGradient, Oval, Path, RadialGradient, Skia, vec } from "@shopify/react-native-skia";
import { BatmanEventB } from "./sceneEventsB";
import { batFrame, sceneScale } from "../../utils/weatherParticles";
import { SCENERY } from "../../utils/weatherUniverses";

const BAT_TONE = ["far", "mid", "near", "window", "stone", "stoneLit", "cloud", "signal", "beam", "suit", "cape", "belt", "rim", "night", "haze"];
const toneMap = (colors) => Object.fromEntries(BAT_TONE.map((name, i) => [name, colors[i] || colors[0]]));

function rgba(hex, a) {
  const h = String(hex).replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const hash = (i, s) => {
  "worklet";
  const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

// ── Figür (yerel birim; kalça 0,0, yüz +x; sahnede sola bakar: face −1) ─────
const SH = [0.3, -13.2];
const UA = 6.4;
const FA = 6.2;
const TH = 7.8;
const SN = 7.8;
// [boyun, arka omuz, arka dirsek, ön omuz, ön dirsek, arka kalça, arka diz, ön kalça, ön diz]
const P_CROUCH = [-0.55, -0.35, -0.9, -0.75, -0.6, -1.75, 1.95, -2.05, 2.15];
const CROUCH_R = 0.55;
const P_STAND = [-0.18, 0.12, 0.12, -0.08, 0.18, 0.1, 0.05, -0.1, 0.08];
const P_LEAP = [-0.3, 2.3, 0.2, 2.0, 0.25, 0.35, 0.5, -0.2, 0.3];
const P_GLIDE = [-0.75, 2.55, 0.1, 2.35, 0.15, 0.12, 0.1, -0.05, 0.12];
const P_ZIP = [-0.1, 0.4, 0.3, Math.PI, 0, 0.12, 0.2, -0.1, 0.25];

// Pelerin: dökük ve kanat hâli (aynı nokta sayısı). Omuzdan başlar, saat yönünün tersine.
const CAPE_DRAPE = [
  [1.6, -13.8], [-1.6, -14.2], [-4.4, -11], [-5.6, -4], [-6.4, 3], [-7, 9.5],
  [-5.4, 8.8], [-4, 10.2], [-2.6, 9], [-1.2, 10.4], [0.2, 9.2], [0.4, 0], [1.4, -9],
];
const CAPE_WING = [
  [1.6, -13.8], [-2, -16], [-14, -22], [-28, -21], [-34, -14], [-30, -8.5],
  [-24, -9], [-20, -3.5], [-14, -5.5], [-9, 0.5], [-4, -1.5], [-0.4, 1.2], [1.4, -9],
];
const HEM = [5, 6, 7, 8, 9, 10];

function mixPose(a, b, t) {
  "worklet";
  const o = [];
  for (let i = 0; i < a.length; i += 1) o.push(a[i] + (b[i] - a[i]) * t);
  return o;
}

function bez(p0, p1, p2, p3, t) {
  "worklet";
  const m = 1 - t;
  const a = m * m * m;
  const b = 3 * m * m * t;
  const c = 3 * m * t * t;
  const d = t * t * t;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
}

/** Sahne yerleşimi (dp). */
export function batLayout(width, height) {
  const k = sceneScale(width, height);
  const ground = height - SCENERY.lift * k;
  const s = 1.5 * k;
  const ledgeY = ground - SCENERY.gargoyle.top * k;
  const tower = { x0: width * 0.74, x1: width + 10, top: ground - 330 * k };
  const gx = width * 0.69; // gargoyle burnu
  const feet = [gx + 16 * k, ledgeY - 31 * k];
  // çömelme kalçası: ön ayak "feet" noktasında (figür sola bakar → yerel x aynalanır)
  const a1 = CROUCH_R + P_CROUCH[7];
  const a2 = a1 + P_CROUCH[8];
  const lf = [(-Math.sin(a1) * TH - Math.sin(a2) * SN + 0.6) * s, (Math.cos(a1) * TH + Math.cos(a2) * SN + 0.6) * s];
  const crouchHip = [feet[0] + lf[0], feet[1] - lf[1]];
  const standY = feet[1] - (TH + SN + 1.2) * s;
  const roof = { x0: -10, x1: width * 0.36, y: ground - 128 * k };
  const lamp = [width * 0.2, roof.y - 20 * k];
  const sig = { x: width * 0.44, y: height * 0.19, rx: 46 * k, ry: 26 * k };
  const G = [width * 0.08, ground - 360 * k]; // kancanın takıldığı uzak sivri kule
  return { k, s, ground, ledgeY, tower, gx, feet, crouchHip, standY, roof, lamp, sig, G };
}

/** Figür durumu (worklet). */
function batState(L, q, clock) {
  "worklet";
  const t = clock.value;
  const base = { x: L.crouchHip[0], y: L.crouchHip[1], r: CROUCH_R, face: -1, pose: P_CROUCH, cape: 0, sc: 1, o: 1, line: 0, lx: 0, ly: 0 };
  if (q.u > 1 || q.u < 0.12 || q.u >= 0.98) return { ...base, y: base.y + Math.sin(t * 1.3) * 0.3 * L.k };
  if (q.leap < 0 && q.glide < 0 && q.grap < 0 && q.back < 0 && q.u < 0.24) {
    const st = q.stand;
    const pose = mixPose(P_CROUCH, P_STAND, st);
    return { ...base, r: CROUCH_R * (1 - st), pose, x: base.x + (L.feet[0] + 1 * L.k - base.x) * st, y: base.y + (L.standY - base.y) * st };
  }
  const Q0 = [L.gx - 70 * L.k, L.ledgeY - 70 * L.k];
  const C1 = [L.gx - 150 * L.k, L.ledgeY - 10 * L.k];
  const C2 = [L.sig.x - 10 * L.k, L.ground - 330 * L.k];
  const Q3 = [L.G[0] + 70 * L.k, L.G[1] + 60 * L.k];
  if (q.leap >= 0) {
    const e = q.leap;
    const x0 = L.feet[0] + 1 * L.k;
    const y0 = L.standY;
    const x = x0 + (Q0[0] - x0) * e;
    const y = y0 + (Q0[1] - y0) * e - Math.sin(Math.PI * e) * 26 * L.k;
    return { ...base, x, y, r: 1.3 * e, pose: mixPose(P_STAND, P_LEAP, Math.min(1, e * 1.6)), cape: e };
  }
  if (q.glide >= 0) {
    const g = q.glide;
    const pt = bez(Q0, C1, C2, Q3, g);
    const p2 = bez(Q0, C1, C2, Q3, Math.min(1, g + 0.01));
    const vx = p2[0] - pt[0];
    const vy = p2[1] - pt[1];
    const r0 = Math.atan2(-vx, -vy);
    const r = r0 < 1.3 ? 1.3 : r0 > 1.75 ? 1.75 : r0;
    const pose = mixPose(P_LEAP, P_GLIDE, Math.min(1, g * 5));
    const rr = g < 0.15 ? 1.3 + (r - 1.3) * (g / 0.15) : r;
    return { ...base, x: pt[0], y: pt[1] + Math.sin(t * 2.2) * 2 * L.k, r: rr, pose, cape: 1, sc: 1 - 0.3 * g };
  }
  if (q.grap >= 0) {
    const g = q.grap;
    const shoot = Math.min(1, g / 0.3);
    const pull = g < 0.3 ? 0 : (g - 0.3) / 0.7;
    const e = pull * pull;
    const x = Q3[0] + (L.G[0] - Q3[0]) * e;
    const y = Q3[1] + (L.G[1] - Q3[1]) * e;
    const dx = L.G[0] - x;
    const dy = L.G[1] - y;
    const dl = Math.hypot(dx, dy) || 1;
    const r = Math.atan2(-dx, -dy);
    const sc = 0.7 - 0.2 * pull;
    const reach = 25.6 * L.s * sc;
    const hx = x + (dx / dl) * reach;
    const hy = y + (dy / dl) * reach;
    return {
      ...base, x, y, r, pose: mixPose(P_GLIDE, P_ZIP, Math.min(1, g * 3)), cape: 1 - Math.min(1, g * 2.5) * 0.7, sc, o: 1 - Math.max(0, (pull - 0.75) / 0.25),
      line: 1, lx: hx, ly: hy, gx: hx + (L.G[0] - hx) * shoot, gy: hy + (L.G[1] - hy) * shoot,
    };
  }
  if (q.back >= 0) {
    const g = q.back;
    const B0 = [-0.14 * L.sig.x * 2, L.sig.y + 70 * L.k];
    const B1 = [L.sig.x * 0.7, L.sig.y + 20 * L.k];
    const B2 = [L.gx - 60 * L.k, L.ledgeY - 120 * L.k];
    const B3 = [base.x, base.y];
    const e = g < 0.86 ? g / 0.86 : 1;
    const pt = bez(B0, B1, B2, B3, e);
    const p2 = bez(B0, B1, B2, B3, Math.min(1, e + 0.01));
    const land = g < 0.86 ? 0 : (g - 0.86) / 0.14;
    const r0 = Math.atan2(p2[0] - pt[0], -(p2[1] - pt[1]));
    const r = r0 < 1.3 ? 1.3 : r0 > 1.75 ? 1.75 : r0;
    const pose = land > 0 ? mixPose(P_GLIDE, P_CROUCH, land) : P_GLIDE;
    const face = land <= 0 ? 1 : land < 0.5 ? 1 - land * 2 : (land - 0.5) * -2;
    return {
      ...base, x: pt[0], y: pt[1], r: land > 0 ? r + (CROUCH_R - r) * land : r, face, pose,
      cape: 1 - land, sc: 0.55 + 0.45 * e, o: Math.min(1, g * 8),
    };
  }
  // aradaki boşluk (kaybolduktan sonra, dönüşten önce)
  return { ...base, o: 0 };
}

// ── Şehir geometrisi ─────────────────────────────────────────────────────────
function gothicRow(path, win, list, ground, k, seed, density) {
  for (const [x, w, h, kind] of list) {
    const top = ground - h;
    path.moveTo(x, ground);
    path.lineTo(x, top);
    if (kind === "spire") {
      path.lineTo(x + w * 0.1, top);
      path.lineTo(x + w * 0.5, top - w * 1.5);
      path.lineTo(x + w * 0.9, top);
      path.lineTo(x + w, top);
    } else if (kind === "gable") {
      path.lineTo(x + w * 0.5, top - w * 0.55);
      path.lineTo(x + w, top);
    } else if (kind === "twin") {
      path.lineTo(x + w * 0.02, top - w * 0.9);
      path.lineTo(x + w * 0.2, top);
      path.lineTo(x + w * 0.5, top - w * 0.3);
      path.lineTo(x + w * 0.8, top);
      path.lineTo(x + w * 0.98, top - w * 0.9);
      path.lineTo(x + w, top);
    } else if (kind === "crown") {
      for (let i = 0; i < 5; i += 1) {
        const xx = x + (w * (i + 0.5)) / 5;
        path.lineTo(xx - w * 0.06, top);
        path.lineTo(xx, top - w * 0.28);
        path.lineTo(xx + w * 0.06, top);
      }
      path.lineTo(x + w, top);
    } else {
      path.lineTo(x + w, top);
    }
    path.lineTo(x + w, ground);
    path.close();
    if (win) {
      for (let yy = top + 8 * k; yy < ground - 6 * k; yy += 9 * k) {
        for (let xx = x + 3 * k; xx < x + w - 4 * k; xx += 6 * k) {
          if (hash(xx * 0.37 + seed, yy * 0.19) < density) {
            win.moveTo(xx, yy + 4 * k);
            win.lineTo(xx, yy + 1.2 * k);
            win.quadTo(xx + 1.2 * k, yy, xx + 2.4 * k, yy + 1.2 * k);
            win.lineTo(xx + 2.4 * k, yy + 4 * k);
            win.close();
          }
        }
      }
    }
  }
}

function rowList(width, k, seed, minH, maxH, minW, maxW, kinds) {
  const out = [];
  let x = -14;
  let i = 0;
  while (x < width + 14) {
    const w = (minW + hash(i, seed) * (maxW - minW)) * k;
    const h = (minH + hash(i, seed + 1) * (maxH - minH)) * k;
    out.push([x, w, h, kinds[Math.floor(hash(i, seed + 2) * kinds.length)]]);
    x += w + (hash(i, seed + 3) < 0.3 ? 6 * k : 0);
    i += 1;
  }
  return out;
}

function buildCity(L, width) {
  const { k, ground } = L;
  const far = Skia.Path.Make();
  const farWin = Skia.Path.Make();
  gothicRow(far, farWin, rowList(width, k, 3, 190, 300, 20, 40, ["spire", "gable", "twin", "crown", "flat", "spire"]), ground, k, 3, 0.1);
  const mid = Skia.Path.Make();
  const midWin = Skia.Path.Make();
  gothicRow(mid, midWin, rowList(width, k, 9, 120, 210, 32, 60, ["gable", "crown", "spire", "flat", "twin"]), ground, k, 9, 0.2);
  // saat kulesi (orta kat)
  const clock = { x: width * 0.53, y: ground - 236 * k, r: 11 * k };
  mid.addRect(Skia.XYWHRect(clock.x - 16 * k, clock.y - 18 * k, 32 * k, ground - clock.y + 18 * k));
  mid.moveTo(clock.x - 18 * k, clock.y - 18 * k);
  mid.lineTo(clock.x, clock.y - 66 * k);
  mid.lineTo(clock.x + 18 * k, clock.y - 18 * k);
  mid.close();
  // yakın: polis çatısı (sol), taş kule (sağ)
  const near = Skia.Path.Make();
  const R = L.roof;
  near.addRect(Skia.XYWHRect(R.x0, R.y, R.x1 - R.x0, ground - R.y + 2));
  near.addRect(Skia.XYWHRect(R.x0, R.y - 5 * k, R.x1 - R.x0, 5 * k));
  near.addRect(Skia.XYWHRect(R.x1 - 40 * k, R.y - 26 * k, 24 * k, 21 * k)); // merdiven kulübesi
  const nearWin = Skia.Path.Make();
  for (let yy = R.y + 14 * k; yy < ground - 8 * k; yy += 18 * k) {
    for (let xx = R.x0 + 10 * k; xx < R.x1 - 10 * k; xx += 16 * k) {
      if (hash(xx * 0.11, yy * 0.07) < 0.4) nearWin.addRect(Skia.XYWHRect(xx, yy, 6 * k, 9 * k));
    }
  }
  const T = L.tower;
  const tower = Skia.Path.Make();
  tower.moveTo(T.x0, ground + 2);
  tower.lineTo(T.x0, T.top + 30 * k);
  tower.lineTo(T.x0 - 4 * k, T.top + 30 * k);
  tower.lineTo(T.x0 + 14 * k, T.top - 40 * k);
  tower.lineTo(T.x0 + 24 * k, T.top + 10 * k);
  tower.lineTo(T.x0 + 40 * k, T.top - 70 * k);
  tower.lineTo(T.x0 + 56 * k, T.top + 10 * k);
  tower.lineTo(T.x0 + 66 * k, T.top - 40 * k);
  tower.lineTo(T.x0 + 84 * k, T.top + 30 * k);
  tower.lineTo(T.x1, T.top + 30 * k);
  tower.lineTo(T.x1, ground + 2);
  tower.close();
  // çıkıntı (gargoyle burada)
  const ledge = Skia.Path.Make();
  ledge.addRect(Skia.XYWHRect(L.gx - 6 * k, L.ledgeY, T.x0 - L.gx + 10 * k, 8 * k));
  ledge.moveTo(L.gx - 6 * k, L.ledgeY + 8 * k);
  ledge.lineTo(T.x0, L.ledgeY + 26 * k);
  ledge.lineTo(T.x0, L.ledgeY + 8 * k);
  ledge.close();
  // kule süsleri: sivri kemerli pencereler, kornişler
  const towerWin = Skia.Path.Make();
  const towerTrim = Skia.Path.Make();
  for (let yy = T.top + 50 * k; yy < ground - 30 * k; yy += 46 * k) {
    for (const xx of [T.x0 + 18 * k, T.x0 + 44 * k, T.x0 + 70 * k]) {
      towerWin.moveTo(xx, yy + 22 * k);
      towerWin.lineTo(xx, yy + 6 * k);
      towerWin.quadTo(xx + 5 * k, yy - 2 * k, xx + 10 * k, yy + 6 * k);
      towerWin.lineTo(xx + 10 * k, yy + 22 * k);
      towerWin.close();
    }
    towerTrim.moveTo(T.x0, yy - 6 * k);
    towerTrim.lineTo(T.x1, yy - 6 * k);
  }
  return { far, farWin, mid, midWin, clock, near, nearWin, tower, ledge, towerWin, towerTrim };
}

// Gargoyle: çıkıntıda sola bakan kanatlı taş yaratık (yerel: ayaklar 0,0)
const GARGOYLE = "M0 0 L-3 -4 C-8 -5 -12 -8 -14 -12 L-19 -13 L-21 -16 L-16 -16 C-14 -19 -10 -21 -6 -20 L-4 -26 L-2 -20 C2 -20 6 -18 8 -14 L14 -26 L24 -30 L20 -22 L26 -22 L18 -14 L22 -12 L12 -8 C12 -4 10 0 8 0 Z";
const GARGOYLE_LIT = "M-14 -12 L-19 -13 M-16 -16 C-14 -19 -10 -21 -6 -20 M14 -26 L24 -30 M8 -14 L14 -26";

// Bulut tabakası (yerel elipsler)
function buildClouds(L, width) {
  const { k } = L;
  const out = [];
  for (let i = 0; i < 14; i += 1) {
    out.push([width * (-0.05 + i * 0.085) + hash(i, 4) * 20 * k, L.sig.y - 30 * k + hash(i, 5) * 60 * k, (50 + hash(i, 6) * 50) * k, (16 + hash(i, 7) * 12) * k]);
  }
  return out;
}

function batPath(r) {
  const HALF = [[0, -0.5], [0.1, -0.72], [0.2, -0.5], [0.34, -0.44], [0.62, -0.6], [0.92, -0.46], [1.02, -0.12], [0.86, -0.22], [0.74, -0.02],
    [0.58, -0.16], [0.44, 0.1], [0.3, -0.04], [0.16, 0.3], [0.06, 0.12], [0, 0.44]];
  const q = Skia.Path.Make();
  HALF.forEach(([x, y], i) => (i ? q.lineTo(x * r, y * r) : q.moveTo(x * r, y * r)));
  HALF.slice(1, -1).reverse().forEach(([x, y]) => q.lineTo(-x * r, y * r));
  q.close();
  return q;
}

// ── Figür çizimi ─────────────────────────────────────────────────────────────
const TORSO = "M-3.9 -13.4 C-5.2 -10 -4.6 -5.5 -3.4 -1.4 L3.4 -1.4 C4.6 -5.5 5.2 -10 4.1 -13.4 C1.8 -14.8 -1.8 -14.8 -3.9 -13.4 Z";
const PELVIS = "M-3.5 -1.8 L3.5 -1.8 L3.1 2 L-3.1 2 Z";
const EMBLEM = "M-1.4 -10.6 L-0.6 -10.1 L0 -10.9 L0.6 -10.1 L1.6 -10.6 L1.8 -9.6 L3.4 -10.2 L2.6 -8.6 L1.2 -9 L0.6 -8.2 L0 -8.8 L-0.6 -8.2 L-1.2 -9 L-2.6 -8.6 L-3.2 -10.2 L-1.8 -9.6 Z";
const COWL = "M-3.2 -0.6 C-3.8 -3.6 -3.2 -7 -1.8 -8.2 L-1.6 -11.4 L-0.3 -8.8 C0.6 -9.1 1.4 -9.1 2.2 -8.8 L3.2 -11.2 L3.3 -7.8 C4.2 -6.4 4.4 -3.8 3.9 -2.6 L2.6 -1.6 L2 0.2 C0.8 0.8 -1.6 0.8 -3.2 -0.6 Z";
const JAW = "M1.2 -3.6 C2.6 -3.4 3.6 -2.8 3.9 -2.6 L2.6 -1.6 L2 0.2 C1.4 0.4 0.8 0.4 0.4 0.2 C0.6 -1.4 0.8 -2.6 1.2 -3.6 Z";
const EYE = "M1.4 -5.2 L3.6 -5.6 L3.2 -4.6 L1.6 -4.5 Z";

function Limb({ tr, len, w, col, children }) {
  return (
    <Group transform={tr}>
      <Path path={`M0 0 L0 ${len}`} style="stroke" strokeWidth={w} strokeCap="round" color={col} />
      {children}
    </Group>
  );
}

function BatFigure({ st, c, s0, clock }) {
  const rootT = useDerivedValue(() => {
    const s = st.value;
    return [{ translateX: s.x }, { translateY: s.y }, { scaleX: s.face }, { rotate: s.r }, { scale: s0 * s.sc }];
  });
  const j = (i, ox, oy) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDerivedValue(() => [{ translateX: ox }, { translateY: oy }, { rotate: st.value.pose[i] }]);
  const neckT = j(0, 0.3, -13.8);
  const shLT = j(1, SH[0] - 0.6, SH[1]);
  const elLT = j(2, 0, UA);
  const shRT = j(3, SH[0] + 0.4, SH[1]);
  const elRT = j(4, 0, UA);
  const hipLT = j(5, -0.6, 0.6);
  const knLT = j(6, 0, TH);
  const hipRT = j(7, 0.6, 0.6);
  const knRT = j(8, 0, TH);
  const op = useDerivedValue(() => st.value.o);
  const capeP = useDerivedValue(() => {
    const s = st.value;
    const t = clock.value;
    const q = Skia.Path.Make();
    const m = s.cape;
    const pts = [];
    for (let i = 0; i < CAPE_DRAPE.length; i += 1) {
      let x = CAPE_DRAPE[i][0] + (CAPE_WING[i][0] - CAPE_DRAPE[i][0]) * m;
      let y = CAPE_DRAPE[i][1] + (CAPE_WING[i][1] - CAPE_DRAPE[i][1]) * m;
      if (HEM.indexOf(i) >= 0) {
        const w = (1 - m) * 1.8 + m * 1.1;
        x -= (Math.sin(t * 3.1 + i * 0.9) * 0.5 + 0.6) * w;
        y += Math.sin(t * 4.3 + i * 1.3) * 0.5 * w;
      } else if (i > 1 && i < 5) {
        y += Math.sin(t * 2.4 + i) * 0.4 * m;
      }
      pts.push([x, y]);
    }
    q.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1];
      const b = pts[i];
      if (HEM.indexOf(i) >= 0 && m > 0.5) {
        // kanat kenarı: içe kıvrık yaylar (yarasa kanadı)
        q.quadTo((a[0] + b[0]) / 2 + 1.2, (a[1] + b[1]) / 2 - 1.6, b[0], b[1]);
      } else q.lineTo(b[0], b[1]);
    }
    q.close();
    return q;
  });
  const ribs = useDerivedValue(() => {
    const s = st.value;
    const q = Skia.Path.Make();
    if (s.cape < 0.3) return q;
    const m = s.cape;
    const sp = [CAPE_DRAPE[1][0] + (CAPE_WING[1][0] - CAPE_DRAPE[1][0]) * m, CAPE_DRAPE[1][1] + (CAPE_WING[1][1] - CAPE_DRAPE[1][1]) * m];
    for (const i of [4, 6, 8]) {
      const p = [CAPE_DRAPE[i][0] + (CAPE_WING[i][0] - CAPE_DRAPE[i][0]) * m, CAPE_DRAPE[i][1] + (CAPE_WING[i][1] - CAPE_DRAPE[i][1]) * m];
      q.moveTo(sp[0], sp[1]);
      q.lineTo(p[0], p[1]);
    }
    return q;
  });
  const ribO = useDerivedValue(() => (st.value.cape > 0.3 ? (st.value.cape - 0.3) / 0.7 : 0));
  const suitB = "#2a2e37";
  return (
    <Group opacity={op}>
      <Group transform={rootT}>
        <Path path={capeP} color={c.cape} />
        <Group opacity={ribO}>
          <Path path={ribs} style="stroke" strokeWidth={0.35} color={rgba(c.rim, 0.25)} />
        </Group>
        <Path path={capeP} style="stroke" strokeWidth={0.35} color={rgba(c.rim, 0.35)} />
        <Limb tr={hipLT} len={TH} w={4.2} col={suitB}>
          <Group transform={knLT}>
            <Path path={`M0 0 L0 ${SN}`} style="stroke" strokeWidth={3.9} strokeCap="round" color={suitB} />
            <Path path={`M0 ${SN * 0.55} L0 ${SN} L2 ${SN + 0.6}`} style="stroke" strokeWidth={3.6} strokeCap="round" strokeJoin="round" color={c.cape} />
          </Group>
        </Limb>
        <Limb tr={shLT} len={UA} w={3.4} col={suitB}>
          <Group transform={elLT}>
            <Path path={`M0 0 L0 ${FA}`} style="stroke" strokeWidth={3.1} strokeCap="round" color={c.cape} />
            <Circle cx={0} cy={FA + 0.6} r={1.6} color={c.cape} />
          </Group>
        </Limb>
        <Path path={PELVIS} color={suitB} />
        <Path path={TORSO} color={c.suit} />
        <Path path={TORSO} style="stroke" strokeWidth={0.35} color={rgba(c.rim, 0.45)} />
        <Path path={EMBLEM} color="#0d0e12" />
        <Path path="M-3.5 -1.6 L3.5 -1.6" style="stroke" strokeWidth={1.3} color={c.belt} />
        <Group transform={neckT}>
          <Path path={COWL} color={c.cape} />
          <Path path={JAW} color="#c9a088" />
          <Path path={EYE} color="#f2f5fa" />
          <Path path={COWL} style="stroke" strokeWidth={0.3} color={rgba(c.rim, 0.55)} />
        </Group>
        <Limb tr={hipRT} len={TH} w={4.3} col={c.suit}>
          <Group transform={knRT}>
            <Path path={`M0 0 L0 ${SN}`} style="stroke" strokeWidth={4} strokeCap="round" color={c.suit} />
            <Path path={`M0 ${SN * 0.55} L0 ${SN} L2.2 ${SN + 0.6}`} style="stroke" strokeWidth={3.7} strokeCap="round" strokeJoin="round" color={c.cape} />
          </Group>
        </Limb>
        <Limb tr={shRT} len={UA} w={3.5} col={c.suit}>
          <Group transform={elRT}>
            <Path path={`M0 0 L0 ${FA}`} style="stroke" strokeWidth={3.2} strokeCap="round" color={c.cape} />
            <Path path={`M-1.2 ${FA * 0.3} L-2.4 ${FA * 0.15} M-1.2 ${FA * 0.55} L-2.4 ${FA * 0.4}`} style="stroke" strokeWidth={0.5} color={c.cape} />
            <Circle cx={0} cy={FA + 0.6} r={1.7} color={c.cape} />
          </Group>
        </Limb>
      </Group>
    </Group>
  );
}

// Havalanan yarasa sürüsü (vektör)
function Bat({ f, i, L, path, color, clock }) {
  const tr = useDerivedValue(() => {
    const q = f.value;
    const b = q.bats;
    if (b <= 0 || b >= 1) return [{ translateX: -9999 }];
    const a = -2.2 + hash(i, 1) * 1.6;
    const d = (40 + hash(i, 2) * 220) * L.k * b;
    const x = L.tower.x0 + 30 * L.k + Math.cos(a) * d + Math.sin(clock.value * 3 + i) * 6 * L.k;
    const y = L.tower.top - 10 * L.k + Math.sin(a) * d * 0.8 - b * 40 * L.k;
    const fl = 0.35 + 0.65 * Math.abs(Math.sin(clock.value * (13 + i) + i));
    return [{ translateX: x }, { translateY: y }, { scaleY: fl }, { scale: 0.6 + hash(i, 3) * 0.6 }];
  });
  const op = useDerivedValue(() => {
    const b = f.value.bats;
    return b <= 0 || b >= 1 ? 0 : Math.min(1, b * 8, (1 - b) * 4);
  });
  return (
    <Group opacity={op}>
      <Group transform={tr}>
        <Path path={path} color={color} />
      </Group>
    </Group>
  );
}

export default function BatScene({ p, clock, width, height, tone }) {
  const c = toneMap(tone.colors);
  const L = batLayout(width, height);
  const { k } = L;
  const light = c.night === "#c9d1e0";
  const geo = useMemo(
    () => ({
      city: buildCity(L, width),
      clouds: buildClouds(L, width),
      gargoyle: Skia.Path.MakeFromSVGString(GARGOYLE),
      gargoyleLit: Skia.Path.MakeFromSVGString(GARGOYLE_LIT),
      signalBat: batPath(L.sig.rx * 0.82),
      bat: batPath(8 * k),
      bolt: (() => {
        const q = Skia.Path.Make();
        let x = width * 0.72;
        let y = -10;
        q.moveTo(x, y);
        for (let i = 0; i < 9; i += 1) {
          x += (hash(i, 11) - 0.55) * 34 * k;
          y += (22 + hash(i, 12) * 16) * k;
          q.lineTo(x, y);
          if (i === 4) {
            q.lineTo(x + 30 * k, y + 26 * k);
            q.moveTo(x, y);
          }
        }
        return q;
      })(),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, height],
  );
  const f = useDerivedValue(() => batFrame(p, clock.value));
  const st = useDerivedValue(() => batState(L, f.value, clock));
  const sigO = useDerivedValue(() => {
    const s = f.value.sig;
    const fl = s > 0 && s < 1 ? 0.75 + 0.25 * Math.abs(Math.sin(clock.value * 23)) : 1;
    return s * fl;
  });
  const flashO = useDerivedValue(() => f.value.flash * (light ? 0.35 : 0.28));
  const boltO = useDerivedValue(() => f.value.flash);
  const lineP = useDerivedValue(() => {
    const s = st.value;
    const q = Skia.Path.Make();
    if (!s.line) return q;
    q.moveTo(s.lx, s.ly);
    q.lineTo(s.gx, s.gy);
    return q;
  });
  const lineO = useDerivedValue(() => st.value.line * st.value.o);
  const clockHands = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const C = geo.city.clock;
    const a = clock.value * 0.02;
    q.moveTo(C.x, C.y);
    q.lineTo(C.x + Math.sin(a) * C.r * 0.8, C.y - Math.cos(a) * C.r * 0.8);
    q.moveTo(C.x, C.y);
    q.lineTo(C.x + Math.sin(a / 12) * C.r * 0.55, C.y - Math.cos(a / 12) * C.r * 0.55);
    return q;
  });
  const lampO = useDerivedValue(() => 0.8 + 0.08 * Math.sin(clock.value * 1.7));
  const C = geo.city;
  const { sig, lamp } = L;
  const beamPath = `M${lamp[0] - 3 * k} ${lamp[1]} L${sig.x - sig.rx * 0.95} ${sig.y + sig.ry * 0.2} L${sig.x + sig.rx * 0.95} ${sig.y - sig.ry * 0.2} L${lamp[0] + 3 * k} ${lamp[1]} Z`;
  const lamps = [0.08, 0.3, 0.52, 0.74, 0.94].map((fx) => width * fx);
  return (
    <Group>
      {/* bulut tabakası */}
      <Group opacity={light ? 0.75 : 0.9}>
        {geo.clouds.map(([x, y, rx, ry], i) => (
          <Oval key={i} x={x - rx} y={y - ry} width={rx * 2} height={ry * 2}>
            <LinearGradient start={vec(0, y - ry)} end={vec(0, y + ry)} colors={[rgba(c.cloud, 0.55), rgba(c.cloud, 0.85)]} />
          </Oval>
        ))}
      </Group>
      {/* şimşek: gök aydınlanır + yıldırım */}
      <Group opacity={flashO}>
        <Path path={`M0 0 L${width} 0 L${width} ${L.ground} L0 ${L.ground} Z`} color={c.rim} />
      </Group>
      <Group opacity={boltO}>
        <Path path={geo.bolt} style="stroke" strokeWidth={4 * k} strokeJoin="round" color={rgba(c.rim, 0.35)} />
        <Path path={geo.bolt} style="stroke" strokeWidth={1.4 * k} strokeJoin="round" color="#ffffff" />
      </Group>
      {/* yarasa işareti: projektör hüzmesi + buluttaki ışık */}
      <Group opacity={sigO}>
        <Path path={beamPath}>
          <LinearGradient start={vec(lamp[0], lamp[1])} end={vec(sig.x, sig.y)} colors={[rgba(c.beam, light ? 0.5 : 0.42), rgba(c.beam, 0.12)]} />
        </Path>
        <Circle cx={sig.x} cy={sig.y} r={sig.rx * 1.9}>
          <RadialGradient c={vec(sig.x, sig.y)} r={sig.rx * 1.9} colors={[rgba(c.signal, 0.32), rgba(c.signal, 0)]} />
        </Circle>
        <Group transform={[{ translateX: sig.x }, { translateY: sig.y }, { rotate: -0.12 }, { scaleY: sig.ry / sig.rx }]}>
          <Circle cx={0} cy={0} r={sig.rx}>
            <RadialGradient c={vec(0, 0)} r={sig.rx} colors={[rgba(c.signal, 0.95), rgba(c.signal, 0.85), rgba(c.signal, 0.25)]} positions={[0, 0.82, 1]} />
          </Circle>
          <Path path={geo.signalBat} color="rgba(12,14,20,0.88)" />
        </Group>
      </Group>

      <Group opacity={tone.alpha}>
        {/* ufuk sisi */}
        <Path path={`M0 ${L.ground - 300 * k} L${width} ${L.ground - 300 * k} L${width} ${L.ground} L0 ${L.ground} Z`}>
          <LinearGradient start={vec(0, L.ground - 300 * k)} end={vec(0, L.ground)} colors={[rgba(c.haze, 0), rgba(c.haze, light ? 0.45 : 0.35)]} />
        </Path>
        <Path path={C.far} color={c.far} />
        <Path path={C.farWin} color={rgba(c.window, 0.38)} />
        <Path path={C.mid} color={c.mid} />
        <Path path={C.midWin} color={rgba(c.window, 0.62)} />
      </Group>
      {/* saat kadranı */}
      <Circle cx={C.clock.x} cy={C.clock.y} r={C.clock.r * 2.2}>
        <RadialGradient c={vec(C.clock.x, C.clock.y)} r={C.clock.r * 2.2} colors={[rgba(c.window, 0.35), rgba(c.window, 0)]} />
      </Circle>
      <Circle cx={C.clock.x} cy={C.clock.y} r={C.clock.r} color={rgba(c.window, 0.85)} />
      <Circle cx={C.clock.x} cy={C.clock.y} r={C.clock.r} style="stroke" strokeWidth={1.2 * k} color={c.mid} />
      <Path path={clockHands} style="stroke" strokeWidth={1.1 * k} strokeCap="round" color={c.mid} />

      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <Bat key={i} f={f} i={i} L={L} path={geo.bat} color={c.cape} clock={clock} />
      ))}

      <Group opacity={tone.alpha}>
        {/* polis çatısı + projektör */}
        <Path path={C.near} color={c.near} />
        <Path path={C.nearWin} color={rgba(c.window, 0.7)} />
        <Path path={`M${L.roof.x0} ${L.roof.y - 5 * k} L${L.roof.x1} ${L.roof.y - 5 * k}`} style="stroke" strokeWidth={1 * k} color={rgba(c.rim, 0.3)} />
        <Path path={`M${lamp[0] - 8 * k} ${L.roof.y - 5 * k} L${lamp[0] - 3 * k} ${lamp[1] + 6 * k} L${lamp[0] + 3 * k} ${lamp[1] + 6 * k} L${lamp[0] + 8 * k} ${L.roof.y - 5 * k} Z`} color={c.stone} />
        <Group transform={[{ translateX: lamp[0] }, { translateY: lamp[1] }, { rotate: Math.atan2(sig.x - lamp[0], -(sig.y - lamp[1])) }]}>
          <Path path={`M${-7 * k} ${-6 * k} L${7 * k} ${-6 * k} L${6 * k} ${8 * k} L${-6 * k} ${8 * k} Z`} color={c.stoneLit} />
          <Path path={`M${-7.5 * k} ${-6 * k} L${7.5 * k} ${-6 * k}`} style="stroke" strokeWidth={2 * k} color={c.stone} />
        </Group>
        <Group opacity={sigO}>
          <Circle cx={lamp[0]} cy={lamp[1]} r={14 * k}>
            <RadialGradient c={vec(lamp[0], lamp[1])} r={14 * k} colors={[rgba(c.beam, 0.9), rgba(c.beam, 0)]} />
          </Circle>
        </Group>
        {/* heykelli kule */}
        <Path path={C.tower}>
          <LinearGradient start={vec(L.tower.x0, 0)} end={vec(width, 0)} colors={[c.stoneLit, c.stone, c.near]} positions={[0, 0.25, 1]} />
        </Path>
        <Path path={C.towerTrim} style="stroke" strokeWidth={2 * k} color={rgba(c.near, 0.8)} />
        <Path path={C.towerWin} color={rgba(c.window, 0.55)} />
        <Path path={C.ledge} color={c.stone} />
        <Path path={`M${L.gx - 6 * k} ${L.ledgeY} L${L.tower.x0} ${L.ledgeY}`} style="stroke" strokeWidth={1 * k} color={rgba(c.rim, 0.4)} />
        <Group transform={[{ translateX: L.gx + 12 * k }, { translateY: L.ledgeY }, { scale: 1.6 * k }]}>
          <Path path={geo.gargoyle} color={c.stone} />
          <Path path={geo.gargoyleLit} style="stroke" strokeWidth={0.8} color={rgba(c.rim, 0.45)} />
          <Circle cx={-15} cy={-14.5} r={0.9} color={rgba(c.window, 0.6)} />
        </Group>
      </Group>

      {/* kanca ipi + Batman */}
      <Group opacity={lineO}>
        <Path path={lineP} style="stroke" strokeWidth={0.9 * k} color={rgba(c.rim, 0.85)} />
      </Group>
      <BatFigure st={st} c={c} s0={L.s} clock={clock} />

      {/* ıslak sokak + fenerler */}
      <Group opacity={tone.alpha}>
        <Path path={`M-4 ${L.ground} L${width + 4} ${L.ground} L${width + 4} ${height} L-4 ${height} Z`}>
          <LinearGradient start={vec(0, L.ground)} end={vec(0, height)} colors={[c.near, c.night]} />
        </Path>
        <Path path={`M-4 ${L.ground} L${width + 4} ${L.ground}`} style="stroke" strokeWidth={1.5 * k} color={rgba(c.rim, 0.25)} />
        {lamps.map((x, i) => (
          <Path key={i} path={`M${x - 0.8 * k} ${L.ground + 30 * k} L${x - 0.8 * k} ${L.ground - 26 * k} L${x + 0.8 * k} ${L.ground - 26 * k} L${x + 0.8 * k} ${L.ground + 30 * k} Z`} color="#07080b" />
        ))}
      </Group>
      <Group opacity={lampO}>
        {lamps.map((x, i) => (
          <React.Fragment key={i}>
            <Circle cx={x} cy={L.ground - 27 * k} r={22 * k}>
              <RadialGradient c={vec(x, L.ground - 27 * k)} r={22 * k} colors={[rgba(c.window, 0.55), rgba(c.window, 0)]} />
            </Circle>
            <Oval x={x - 14 * k} y={L.ground + 8 * k} width={28 * k} height={40 * k}>
              <LinearGradient start={vec(0, L.ground + 8 * k)} end={vec(0, L.ground + 48 * k)} colors={[rgba(c.window, 0.22), rgba(c.window, 0)]} />
            </Oval>
          </React.Fragment>
        ))}
      </Group>
      {/* olay B (A ile sırayla) */}
      <BatmanEventB p={p} clock={clock} width={width} height={height} />
    </Group>
  );
}
