// components/decor/narutoScene.js
//
// Naruto evren sahnesi (OVERLAY.narVec = 53) — tamamı VEKTÖR; önünde yapraklar süzülür:
//   • Gün batımı (koyu) / öğle (açık) göğü, yatay bulut şeritleri, uzak dağlar.
//   • Köyün ardında dört yüz oyulmuş kayalık (esinlenme silüeti, genel yüzler); dibinde orman.
//   • Köy: düz çatılı kutu evler, yuvarlak çatılar, su depoları, ortada kırmızı silindir kule,
//     elektrik direkleri ve sarkan teller; pencerelerde akşam ışığı.
//   • Önde iki yanda ağaçlar ve üç antrenman kütüğü.
//   • Olay (64 sn'de bir ~26 sn): iki ninja iki yandan çatı çatı sekerek gelir, havada çarpışır
//     (kıvılcım), çatılara geri seker; biri shuriken atar — öbürü duman bulutuyla kütükle yer
//     değiştirir (shuriken kütüğe saplanır, kütük düşer), antrenman kütüğünün üstünde belirir;
//     karşılıklı bekleyiş, ikisi de duman bulutunda kaybolur.
//   • Olay B (dönüşümlü): gölge klon tekniği — çatılarda soldan sağa birer duman patlamasıyla el
//     mühürlü ninja klonları belirir; hepsi aynı anda yukarı sıçrar ve havada duman olup dağılır.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[53] (NR_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Circle, Group, LinearGradient, Path, Rect, Skia, vec } from "@shopify/react-native-skia";
import { eventU } from "../../utils/weatherParticles";
import { Glow, TAU, groundLayout, hash, rgba, sm, toneMap } from "./seasonKit";

export const NR_TONE = [
  "skyTop",
  "skyLow",
  "sun",
  "cloud",
  "mountain",
  "cliff",
  "cliffShade",
  "carve",
  "forest",
  "wall",
  "wallShade",
  "roofRed",
  "roofTeal",
  "window",
  "tank",
  "pole",
  "wire",
  "tree",
  "treeLeaf",
  "post",
  "ninja",
  "band",
  "smoke",
  "spark",
  "log",
];

export function narLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  return {
    ...L,
    roof: ground - 118 * k, // ninjaların sektiği çatı çizgisi
    cliffTop: ground - 400 * k,
    cliffBase: ground - 190 * k,
    posts: [
      [width * 0.16, ground - 2 * k, 54 * k],
      [width * 0.27, ground - 2 * k, 42 * k],
      [width * 0.84, ground - 2 * k, 48 * k],
    ],
  };
}

// ───────────────────────────── statik geometri

function buildBack(L) {
  const { k, width, cliffTop, cliffBase } = L;
  const mount = Skia.Path.Make();
  mount.moveTo(-10, cliffTop + 60 * k);
  const pk = [[0, 40], [0.12, -20], [0.26, 30], [0.4, -10], [0.55, 26], [0.7, -26], [0.84, 20], [1, -8], [1.05, 30]];
  pk.forEach(([f, dy]) => mount.lineTo(width * f, cliffTop - 30 * k + dy * k));
  mount.lineTo(width + 10, cliffBase);
  mount.lineTo(-10, cliffBase);
  mount.close();
  // kayalık: düzensiz tepe, dik yüz
  const cliff = Skia.Path.Make();
  const x0 = width * 0.06;
  const x1 = width * 0.94;
  cliff.moveTo(x0 - 20 * k, cliffBase + 10 * k);
  cliff.lineTo(x0, cliffTop + 40 * k);
  const n = 14;
  for (let i = 0; i <= n; i += 1) {
    const f = i / n;
    cliff.lineTo(x0 + (x1 - x0) * f, cliffTop + (Math.sin(f * 9) * 6 + hash(i, 3) * 10) * k);
  }
  cliff.lineTo(x1, cliffTop + 50 * k);
  cliff.lineTo(x1 + 20 * k, cliffBase + 10 * k);
  cliff.close();
  // kaya katmanları / çatlaklar
  const cracks = Skia.Path.Make();
  for (let i = 0; i < 9; i += 1) {
    const x = x0 + (x1 - x0) * hash(i, 7);
    const y = cliffTop + (20 + hash(i, 8) * 160) * k;
    cracks.moveTo(x, y);
    cracks.lineTo(x + (hash(i, 9) - 0.5) * 14 * k, y + 18 * k);
    cracks.lineTo(x + (hash(i, 10) - 0.5) * 10 * k, y + 34 * k);
  }
  for (let j = 0; j < 3; j += 1) {
    const y = cliffTop + (60 + j * 52) * k;
    cracks.moveTo(x0 + 6 * k, y);
    cracks.quadTo(width / 2, y + 8 * k, x1 - 6 * k, y - 4 * k);
  }
  // dört oyma yüz
  const faceLit = Skia.Path.Make();
  const faceShade = Skia.Path.Make();
  const faceLine = Skia.Path.Make();
  const fw = 50 * k;
  const fy = cliffTop + 46 * k;
  for (let i = 0; i < 4; i += 1) {
    const cx = width * (0.2 + i * 0.2);
    const top = fy + (i % 2) * 8 * k;
    // yüz kabartması
    const face = Skia.RRectXY(Skia.XYWHRect(cx - fw / 2, top + 10 * k, fw, 62 * k), 20 * k, 24 * k);
    faceShade.addRRect(Skia.RRectXY(Skia.XYWHRect(cx - fw / 2 + 4 * k, top + 13 * k, fw, 62 * k), 20 * k, 24 * k));
    faceLit.addRRect(face);
    // saç: her yüze farklı
    const hp = Skia.Path.Make();
    if (i === 0) {
      // dik kabarık
      hp.moveTo(cx - fw * 0.6, top + 30 * k);
      for (let j = 0; j <= 6; j += 1) {
        const f = j / 6;
        hp.lineTo(cx - fw * 0.6 + f * fw * 1.2, top - (j % 2 ? 4 : 14) * k);
      }
      hp.lineTo(cx + fw * 0.6, top + 30 * k);
      hp.close();
    } else if (i === 1) {
      // yanlara uzun
      hp.moveTo(cx - fw * 0.62, top + 60 * k);
      hp.quadTo(cx - fw * 0.7, top - 4 * k, cx, top - 6 * k);
      hp.quadTo(cx + fw * 0.7, top - 4 * k, cx + fw * 0.62, top + 60 * k);
      hp.lineTo(cx + fw * 0.4, top + 24 * k);
      hp.lineTo(cx - fw * 0.4, top + 24 * k);
      hp.close();
    } else if (i === 2) {
      // geriye taranmış, yanlarda kâküller
      hp.moveTo(cx - fw * 0.56, top + 26 * k);
      hp.quadTo(cx - fw * 0.5, top - 2 * k, cx, top);
      hp.quadTo(cx + fw * 0.5, top - 2 * k, cx + fw * 0.56, top + 26 * k);
      hp.lineTo(cx + fw * 0.62, top + 46 * k);
      hp.lineTo(cx + fw * 0.44, top + 24 * k);
      hp.lineTo(cx - fw * 0.44, top + 24 * k);
      hp.lineTo(cx - fw * 0.62, top + 46 * k);
      hp.close();
    } else {
      // sivri, rüzgârda
      hp.moveTo(cx - fw * 0.58, top + 28 * k);
      for (let j = 0; j <= 7; j += 1) {
        const f = j / 7;
        hp.lineTo(cx - fw * 0.58 + f * fw * 1.16 + (j % 2 ? 6 : 0) * k, top + (j % 2 ? 4 : -10 - f * 6) * k);
      }
      hp.lineTo(cx + fw * 0.66, top + 34 * k);
      hp.close();
    }
    faceLit.addPath(hp);
    // kaş, göz, burun, ağız çizgileri
    const ey = top + 36 * k;
    faceLine.moveTo(cx - 16 * k, ey - 4 * k);
    faceLine.lineTo(cx - 5 * k, ey - 2 * k);
    faceLine.moveTo(cx + 16 * k, ey - 4 * k);
    faceLine.lineTo(cx + 5 * k, ey - 2 * k);
    faceLine.moveTo(cx - 14 * k, ey + 3 * k);
    faceLine.quadTo(cx - 10 * k, ey + 1 * k, cx - 6 * k, ey + 3 * k);
    faceLine.moveTo(cx + 14 * k, ey + 3 * k);
    faceLine.quadTo(cx + 10 * k, ey + 1 * k, cx + 6 * k, ey + 3 * k);
    faceLine.moveTo(cx, ey + 4 * k);
    faceLine.lineTo(cx - 2 * k, ey + 13 * k);
    faceLine.lineTo(cx + 2 * k, ey + 14 * k);
    faceLine.moveTo(cx - 7 * k, ey + 22 * k);
    faceLine.quadTo(cx, ey + (i === 3 ? 26 : 23) * k, cx + 7 * k, ey + 22 * k);
    // alın bandı plakası
    faceLine.moveTo(cx - 18 * k, top + 24 * k);
    faceLine.lineTo(cx + 18 * k, top + 24 * k);
  }
  return { mount, cliff, cracks, faceLit, faceShade, faceLine };
}

function buildVillage(L) {
  const { k, width, ground, roof, cliffBase } = L;
  const forest = Skia.Path.Make();
  for (let i = 0; i < 40; i += 1) {
    const x = (i / 39) * (width + 30 * k) - 15 * k;
    const r = (12 + hash(i, 21) * 10) * k;
    forest.addCircle(x, cliffBase - 2 * k + hash(i, 22) * 8 * k, r);
  }
  forest.addRect(Skia.XYWHRect(-10, cliffBase, width + 20, ground - cliffBase));
  // arka sıra evler (tepeleri roof-30..-60)
  const back = Skia.Path.Make();
  const backShade = Skia.Path.Make();
  const front = Skia.Path.Make();
  const frontShade = Skia.Path.Make();
  const roofsRed = Skia.Path.Make();
  const roofsTeal = Skia.Path.Make();
  const wins = Skia.Path.Make();
  const tanks = Skia.Path.Make();
  let x = -6 * k;
  let i = 0;
  while (x < width) {
    const w = (34 + hash(i, 31) * 26) * k;
    const top = roof - (34 + hash(i, 32) * 34) * k;
    back.addRect(Skia.XYWHRect(x, top, w, ground - top));
    backShade.addRect(Skia.XYWHRect(x + w * 0.78, top, w * 0.22, ground - top));
    if (hash(i, 33) > 0.5) {
      // yuvarlak çatı
      (hash(i, 34) > 0.5 ? roofsRed : roofsTeal).addArc(Skia.XYWHRect(x - 2 * k, top - w * 0.28, w + 4 * k, w * 0.56), 180, 180);
    } else {
      (hash(i, 34) > 0.5 ? roofsRed : roofsTeal).addRect(Skia.XYWHRect(x - 3 * k, top - 3 * k, w + 6 * k, 4 * k));
    }
    x += w + 6 * k;
    i += 1;
  }
  // ön sıra: düz çatılar ninjaların çizgisinde (roof), su depoları
  x = -4 * k;
  i = 0;
  while (x < width) {
    const w = (40 + hash(i, 41) * 30) * k;
    const top = roof + (hash(i, 42) - 0.5) * 6 * k;
    front.addRect(Skia.XYWHRect(x, top, w, ground - top));
    frontShade.addRect(Skia.XYWHRect(x + w * 0.8, top, w * 0.2, ground - top));
    (i % 2 ? roofsTeal : roofsRed).addRect(Skia.XYWHRect(x - 3 * k, top - 3.5 * k, w + 6 * k, 5 * k));
    // kat bandı + kapı + saçak
    frontShade.addRect(Skia.XYWHRect(x, top + 44 * k, w, 3 * k));
    (i % 2 ? roofsRed : roofsTeal).addRect(Skia.XYWHRect(x - 2 * k, top + 70 * k, w * 0.6, 4 * k));
    frontShade.addRRect(Skia.RRectXY(Skia.XYWHRect(x + w * 0.18, ground - 26 * k, 12 * k, 26 * k), 2 * k, 2 * k));
    // pencereler
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        if (hash(i * 13 + r * 3 + c, 43) > 0.6) continue;
        if (r === 2 && c === 0) continue;
        wins.addRRect(Skia.RRectXY(Skia.XYWHRect(x + 6 * k + c * (w - 14 * k) / 3, top + 14 * k + r * 34 * k, 7 * k, 9 * k), 1.5 * k, 1.5 * k));
      }
    }
    if (hash(i, 44) > 0.45) {
      const tx = x + w * (0.25 + hash(i, 45) * 0.4);
      tanks.addRRect(Skia.RRectXY(Skia.XYWHRect(tx - 7 * k, top - 22 * k, 14 * k, 14 * k), 4 * k, 4 * k));
      tanks.addRect(Skia.XYWHRect(tx - 6 * k, top - 9 * k, 1.5 * k, 7 * k));
      tanks.addRect(Skia.XYWHRect(tx + 4.5 * k, top - 9 * k, 1.5 * k, 7 * k));
    }
    x += w + 10 * k;
    i += 1;
  }
  // ortada kırmızı silindir kule
  const cx = width * 0.5;
  const tw = 70 * k;
  const ttop = roof - 120 * k;
  const tower = Skia.Path.Make();
  tower.addRect(Skia.XYWHRect(cx - tw / 2, ttop, tw, ground - ttop));
  const towerShade = Skia.Path.Make();
  towerShade.addRect(Skia.XYWHRect(cx + tw * 0.18, ttop, tw * 0.32, ground - ttop));
  const towerRoof = Skia.Path.Make();
  towerRoof.addOval(Skia.XYWHRect(cx - tw * 0.62, ttop - 6 * k, tw * 1.24, 14 * k));
  towerRoof.moveTo(cx - tw * 0.5, ttop);
  towerRoof.quadTo(cx, ttop - 34 * k, cx + tw * 0.5, ttop);
  towerRoof.close();
  towerRoof.addRect(Skia.XYWHRect(cx - tw * 0.56, ttop + 52 * k, tw * 1.12, 6 * k));
  const towerWin = Skia.Path.Make();
  for (let r = 0; r < 4; r += 1) towerWin.addRect(Skia.XYWHRect(cx - tw * 0.42, ttop + 14 * k + r * 34 * k, tw * 0.84, 5 * k));
  towerWin.addCircle(cx, ttop + 34 * k, 9 * k);
  // direkler + teller
  const poles = Skia.Path.Make();
  const wires = Skia.Path.Make();
  const px = [0.07, 0.37, 0.66, 0.95].map((f) => width * f);
  const ptop = roof - 54 * k;
  px.forEach((p) => {
    poles.addRect(Skia.XYWHRect(p - 1.6 * k, ptop, 3.2 * k, ground - ptop));
    poles.addRect(Skia.XYWHRect(p - 12 * k, ptop + 6 * k, 24 * k, 2.4 * k));
    poles.addRect(Skia.XYWHRect(p - 9 * k, ptop + 14 * k, 18 * k, 2 * k));
  });
  for (let j = 0; j < px.length - 1; j += 1) {
    [[-11, 6], [11, 6], [-8, 14], [8, 14]].forEach(([dx, dy]) => {
      const a = px[j] + dx * k;
      const b = px[j + 1] + dx * k;
      const y = ptop + dy * k;
      wires.moveTo(a, y);
      wires.quadTo((a + b) / 2, y + 16 * k, b, y);
    });
  }
  return { forest, back, backShade, front, frontShade, roofsRed, roofsTeal, wins, tanks, tower, towerShade, towerRoof, towerWin, poles, wires };
}

function buildFore(L) {
  const { k, width, height, ground } = L;
  const trunks = Skia.Path.Make();
  const leaves = Skia.Path.Make();
  [[-0.02, 1.1, 1], [1.02, 0.95, -1]].forEach(([f, s, dir]) => {
    const x = width * f;
    const h = 250 * k * s;
    trunks.moveTo(x - 9 * k, ground + 4 * k);
    trunks.quadTo(x + dir * 6 * k, ground - h * 0.5, x + dir * 14 * k, ground - h);
    trunks.lineTo(x + dir * 20 * k, ground - h);
    trunks.quadTo(x + dir * 14 * k, ground - h * 0.5, x + 9 * k, ground + 4 * k);
    trunks.close();
    for (let j = 0; j < 16; j += 1) {
      const a = hash(j, 51 + dir) * TAU;
      const r = (20 + hash(j, 53) * 50) * k * s;
      leaves.addCircle(x + dir * 16 * k + Math.cos(a) * r, ground - h + Math.sin(a) * r * 0.6, (18 + hash(j, 55) * 16) * k * s);
    }
  });
  const posts = Skia.Path.Make();
  const ropes = Skia.Path.Make();
  L.posts.forEach(([x, base, h]) => {
    posts.addRRect(Skia.RRectXY(Skia.XYWHRect(x - 7 * k, base - h, 14 * k, h + 4 * k), 4 * k, 4 * k));
    ropes.addRect(Skia.XYWHRect(x - 7.5 * k, base - h * 0.62, 15 * k, 3.4 * k));
    ropes.addRect(Skia.XYWHRect(x - 7.5 * k, base - h * 0.5, 15 * k, 2.2 * k));
  });
  const grass = Skia.Path.Make();
  grass.addRect(Skia.XYWHRect(0, ground, width, height - ground + 10));
  return { trunks, leaves, posts, ropes, grass };
}

// ───────────────────────────── ninja (kare başına)

/** Poz: tuck 0 ayakta → 1 havada büzük; arm 0 yanda → 1 öne uzanmış. Ayak ucu (0,0). */
function ninjaPaths(tuck, arm, dir, t, k) {
  "worklet";
  const s = 1.15 * k;
  const limbs = Skia.Path.Make();
  const lean = 0.18 * tuck * dir;
  const hipX = 0;
  const hipY = -20 * s;
  const shX = hipX + Math.sin(lean) * 14 * s;
  const shY = hipY - Math.cos(lean) * 14 * s;
  // bacaklar
  for (let i = 0; i < 2; i += 1) {
    const sg = i === 0 ? 1 : -1;
    const kx = (2 * sg) * (1 - tuck) + dir * (9 - i * 4) * tuck;
    const ky = 10 * (1 - tuck) + 4 * tuck;
    const fx = (4 * sg) * (1 - tuck) + dir * (1 - i * 6) * tuck;
    const fy = 20 * (1 - tuck) + 12 * tuck;
    limbs.moveTo(hipX, hipY);
    limbs.lineTo(hipX + kx * s, hipY + ky * s);
    limbs.lineTo(hipX + fx * s, hipY + fy * s);
  }
  // gövde
  limbs.moveTo(hipX, hipY);
  limbs.lineTo(shX, shY);
  // kollar: biri öne (arm), biri arkaya
  const ex = dir * (3 + 7 * arm);
  const ey = 8 - 9 * arm;
  const hx = dir * (4 + 12 * arm);
  const hy = 15 - 17 * arm;
  limbs.moveTo(shX, shY);
  limbs.lineTo(shX + ex * s, shY + ey * s);
  limbs.lineTo(shX + hx * s, shY + hy * s);
  limbs.moveTo(shX, shY);
  limbs.lineTo(shX - dir * (4 + 4 * tuck) * s, shY + (7 - 3 * tuck) * s);
  limbs.lineTo(shX - dir * (8 + 6 * tuck) * s, shY + (13 - 8 * tuck) * s);
  const headX = shX + Math.sin(lean) * 7 * s;
  const headY = shY - Math.cos(lean) * 7 * s;
  // alın bandı kuyrukları
  const band = Skia.Path.Make();
  const bx = headX - dir * 4 * s;
  const by = headY - 1 * s;
  for (let j = 0; j < 2; j += 1) {
    band.moveTo(bx, by);
    band.quadTo(
      bx - dir * 8 * s,
      by + (Math.sin(t * 9 + j) * 3 - 1 + j * 2) * s,
      bx - dir * (15 + j * 2) * s,
      by + (Math.sin(t * 9 + j + 1.2) * 4 + 1 + j * 3) * s,
    );
  }
  return { limbs, band, headX, headY };
}

const HOP_A = [-0.12, 0.06, 0.2, 0.34];
const HOP_B = [1.12, 0.94, 0.8, 0.66];

/** Olay → iki ninjanın konumu/pozu, kıvılcım, shuriken, kütük, duman bulutları. */
function duel(u, L) {
  "worklet";
  const { k, width, roof } = L;
  const out = {
    a: { on: 0, x: 0, y: 0, tuck: 0, arm: 0, dir: 1 },
    b: { on: 0, x: 0, y: 0, tuck: 0, arm: 0, dir: -1 },
    spark: 0,
    sx: width / 2,
    sy: roof - 120 * k,
    star: { on: 0, x: 0, y: 0, r: 0 },
    log: { on: 0, x: 0, y: 0, r: 0 },
    puffs: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
  };
  if (u > 1 || u < 0.04) return out;
  const hop = (hops, f, dir) => {
    // f 0–1 boyunca sırayla sekme
    const n = hops.length - 1;
    const g = f * n;
    const i = Math.min(n - 1, Math.floor(g));
    const q = g - i;
    const x = (hops[i] + (hops[i + 1] - hops[i]) * q) * width;
    const y = roof - Math.sin(q * Math.PI) * 46 * k;
    return { on: 1, x, y, tuck: Math.sin(q * Math.PI) > 0.25 ? 1 : 0, arm: 0.2, dir };
  };
  const post = L.posts[0];
  if (u < 0.34) {
    const f = sm(0.04, 0.34, u);
    out.a = hop(HOP_A, f, 1);
    out.b = hop(HOP_B, f, -1);
  } else if (u < 0.5) {
    // havada çarpışma ve geri sekme
    const up = u < 0.42 ? sm(0.34, 0.42, u) : 1 - sm(0.42, 0.5, u);
    const back = sm(0.42, 0.5, u);
    const ax = (0.34 + (0.48 - 0.34) * sm(0.34, 0.42, u) - (0.48 - 0.3) * back) * width;
    const bx = (0.66 - (0.66 - 0.52) * sm(0.34, 0.42, u) + (0.7 - 0.52) * back) * width;
    const y = roof - Math.sin(up * Math.PI * 0.5) * 120 * k;
    out.a = { on: 1, x: ax, y, tuck: up > 0.05 ? 1 : 0, arm: 1, dir: 1 };
    out.b = { on: 1, x: bx, y, tuck: up > 0.05 ? 1 : 0, arm: 1, dir: -1 };
    out.spark = sm(0.41, 0.425, u) * (1 - sm(0.43, 0.48, u));
  } else {
    out.a = { on: 1, x: 0.3 * width, y: roof, tuck: 0, arm: 0.3, dir: 1 };
    out.b = { on: 1, x: 0.7 * width, y: roof, tuck: 0, arm: u > 0.52 && u < 0.56 ? 1 : 0.3, dir: -1 };
    // shuriken: B → A
    if (u > 0.54 && u < 0.6) {
      const g = sm(0.54, 0.6, u);
      out.star = { on: 1, x: 0.7 * width + (0.3 - 0.7) * width * g, y: roof - 26 * k - Math.sin(g * Math.PI) * 10 * k, r: u * 300 };
    }
    // yer değiştirme: A duman → kütük; A antrenman kütüğünde belirir
    if (u >= 0.6) {
      out.a = u < 0.64 ? { ...out.a, on: 0 } : { on: 1, x: post[0], y: post[1] - post[2], tuck: 0, arm: 0.5, dir: 1 };
      const g = sm(0.6, 0.74, u);
      out.log = { on: 1 - sm(0.84, 0.9, u), x: 0.3 * width + g * 10 * k, y: roof - 20 * k + (L.ground - roof + 8 * k) * g * g, r: g * 2.4 };
      out.star = { on: out.log.on, x: out.log.x + 6 * k, y: out.log.y - 4 * k, r: 0.4, stuck: 1 };
    }
    if (u > 0.82) {
      out.a.on = 0;
      out.b.on = 0;
    }
  }
  const puff = (u0, x, y) => {
    const g = (u - u0) / 0.07;
    return g > 0 && g < 1 ? [x, y, g] : [0, 0, 0];
  };
  out.puffs = [
    puff(0.6, 0.3 * width, roof - 20 * k),
    puff(0.63, post[0], post[1] - post[2] - 20 * k),
    puff(0.82, 0.7 * width, roof - 20 * k),
    puff(0.82, post[0], post[1] - post[2] - 20 * k),
  ];
  return out;
}

function Ninja({ p, clock, L, c, which }) {
  const { k } = L;
  const st = useDerivedValue(() => {
    const d = duel(eventU(p, clock.value, 0), L);
    return which === 0 ? d.a : d.b;
  });
  const g = useDerivedValue(() => ninjaPaths(st.value.tuck, st.value.arm, st.value.dir, clock.value, k));
  const limbs = useDerivedValue(() => g.value.limbs);
  const band = useDerivedValue(() => g.value.band);
  const hx = useDerivedValue(() => g.value.headX);
  const hy = useDerivedValue(() => g.value.headY);
  const bandX = useDerivedValue(() => g.value.headX - 4.6 * k);
  const bandY = useDerivedValue(() => g.value.headY - 2.4 * k);
  const at = useDerivedValue(() => [{ translateX: st.value.x }, { translateY: st.value.y }]);
  const on = useDerivedValue(() => st.value.on);
  return (
    <Group opacity={on}>
      <Group transform={at}>
        <Path path={band} style="stroke" strokeWidth={1.6 * k} strokeCap="round" color={c.band} />
        <Path path={limbs} style="stroke" strokeWidth={4.4 * k} strokeCap="round" strokeJoin="round" color={c.ninja} />
        <Circle cx={hx} cy={hy} r={4.6 * k} color={c.ninja} />
        <Rect x={bandX} y={bandY} width={9.2 * k} height={2 * k} color={c.band} />
      </Group>
    </Group>
  );
}

function Duel({ p, clock, L, c }) {
  const { k } = L;
  const d = useDerivedValue(() => duel(eventU(p, clock.value, 0), L));
  const sparkO = useDerivedValue(() => d.value.spark);
  const sparkP = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const { sx, sy, spark } = d.value;
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * TAU + 0.3;
      const r = (14 + (i % 2) * 14) * k * (0.6 + spark * 0.6);
      q.moveTo(sx + Math.cos(a - 0.12) * 4 * k, sy + Math.sin(a - 0.12) * 4 * k);
      q.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
      q.lineTo(sx + Math.cos(a + 0.12) * 4 * k, sy + Math.sin(a + 0.12) * 4 * k);
      q.close();
    }
    return q;
  });
  const star = useMemo(() => {
    const q = Skia.Path.Make();
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * TAU;
      q.moveTo(Math.cos(a + 0.5) * 2 * k, Math.sin(a + 0.5) * 2 * k);
      q.lineTo(Math.cos(a) * 7 * k, Math.sin(a) * 7 * k);
      q.lineTo(Math.cos(a - 0.5) * 2 * k, Math.sin(a - 0.5) * 2 * k);
    }
    q.close();
    q.addCircle(0, 0, 2.6 * k);
    return q;
  }, [k]);
  const starT = useDerivedValue(() => [{ translateX: d.value.star.x }, { translateY: d.value.star.y }, { rotate: d.value.star.r }]);
  const starO = useDerivedValue(() => d.value.star.on);
  const logT = useDerivedValue(() => [{ translateX: d.value.log.x }, { translateY: d.value.log.y }, { rotate: d.value.log.r }]);
  const logO = useDerivedValue(() => d.value.log.on);
  const puffP = useDerivedValue(() => {
    const q = Skia.Path.Make();
    d.value.puffs.forEach(([x, y, g]) => {
      if (g <= 0) return;
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * TAU;
        const r = (8 + g * 16) * k;
        q.addCircle(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, (9 + g * 6) * k * (1 - g * 0.5));
      }
      q.addCircle(x, y, (12 + g * 10) * k * (1 - g * 0.4));
    });
    return q;
  });
  const puffO = useDerivedValue(() => {
    let m = 0;
    d.value.puffs.forEach(([, , g]) => {
      if (g > 0) m = Math.max(m, 1 - g * g);
    });
    return m;
  });
  return (
    <Group>
      <Ninja p={p} clock={clock} L={L} c={c} which={0} />
      <Ninja p={p} clock={clock} L={L} c={c} which={1} />
      <Group opacity={logO}>
        <Group transform={logT}>
          <Rect x={-6 * k} y={-16 * k} width={12 * k} height={32 * k} color={c.log} />
          <Circle cx={0} cy={-16 * k} r={6 * k} color={c.post} />
          <Circle cx={0} cy={-16 * k} r={3 * k} color={c.log} />
          <Rect x={-6 * k} y={-2 * k} width={4 * k} height={1.4 * k} color={c.post} />
        </Group>
      </Group>
      <Group opacity={starO}>
        <Group transform={starT}>
          <Path path={star} color={c.pole} />
        </Group>
      </Group>
      <Group opacity={sparkO}>
        <Glow cx={L.width / 2} cy={L.roof - 120 * k} r={46 * k} color={c.spark} a={0.9} mid={0.3} />
        <Path path={sparkP} color={c.spark} />
      </Group>
      <Group opacity={puffO}>
        <Path path={puffP} color={c.smoke} />
      </Group>
    </Group>
  );
}

function Clouds({ clock, L, c }) {
  const { k, width, cliffTop } = L;
  const paths = useMemo(() => {
    const out = [];
    for (let i = 0; i < 4; i += 1) {
      const q = Skia.Path.Make();
      const y = cliffTop * (0.2 + i * 0.2);
      const w = (110 + hash(i, 61) * 120) * k;
      q.addRRect(Skia.RRectXY(Skia.XYWHRect(0, y, w, 12 * k), 6 * k, 6 * k));
      q.addCircle(w * 0.3, y - 2 * k, 13 * k);
      q.addCircle(w * 0.48, y - 6 * k, 17 * k);
      q.addCircle(w * 0.66, y, 11 * k);
      q.addRRect(Skia.RRectXY(Skia.XYWHRect(w * 0.5, y + 8 * k, w * 0.7, 8 * k), 4 * k, 4 * k));
      out.push(q);
    }
    return out;
  }, [k, cliffTop]);
  return paths.map((q, i) => (
    // eslint-disable-next-line react/no-array-index-key
    <CloudStrip key={i} clock={clock} q={q} i={i} width={width} k={k} c={c} />
  ));
}

function CloudStrip({ clock, q, i, width, k, c }) {
  const at = useDerivedValue(() => {
    const span = width + 360 * k;
    return [{ translateX: ((clock.value * (5 + i * 2) * k + hash(i, 62) * span) % span) - 260 * k }];
  });
  return (
    <Group transform={at}>
      <Path path={q} color={c.cloud} opacity={0.75} />
    </Group>
  );
}

// ───────────────────────────── olay B: gölge klonları

const CLONES = 9;
const CLONE_JUMP = 0.66;

function cloneAt(i) {
  "worklet";
  return 0.1 + i * 0.035;
}

function Clones({ p, clock, L, c }) {
  const { k, width, roof } = L;
  const s = 1.15 * k;
  const d = useDerivedValue(() => {
    const limbs = Skia.Path.Make();
    const heads = Skia.Path.Make();
    const bands = Skia.Path.Make();
    const puffs = Skia.Path.Make();
    const u = eventU(p, clock.value, 1);
    if (u > 1) return { limbs, heads, bands, puffs };
    const puff = (x, y, e) => {
      if (e <= 0 || e >= 1) return;
      for (let j = 0; j < 5; j += 1) {
        const a = (j / 5) * TAU + e;
        const r = (5 + 12 * e) * k * (1 - e * e);
        puffs.addCircle(x + Math.cos(a) * 9 * k * e, y + Math.sin(a) * 6 * k * e, r);
      }
    };
    for (let i = 0; i < CLONES; i += 1) {
      const x = width * (0.06 + (i + 0.5) * (0.88 / CLONES));
      const y0 = roof - 2 * k - hash(i, 151) * 8 * k;
      const a0 = cloneAt(i);
      puff(x, y0 - 16 * s, (u - a0) / 0.08);
      const j = sm(CLONE_JUMP, CLONE_JUMP + 0.08, u);
      puff(x, y0 - 16 * s - j * 120 * k, (u - CLONE_JUMP - 0.08) / 0.09);
      if (u < a0 + 0.02 || u > CLONE_JUMP + 0.09) continue;
      const y = y0 - j * 120 * k;
      const tuck = j > 0 && j < 1 ? 1 : 0;
      const dir = i % 2 ? 1 : -1;
      heads.addCircle(x, y - 30 * s, 4.6 * k);
      bands.addRect(Skia.XYWHRect(x - 4.6 * k, y - 30 * s - 2.4 * k, 9.2 * k, 2 * k));
      limbs.moveTo(x, y - 25 * s);
      limbs.lineTo(x, y - 12 * s);
      if (tuck) {
        limbs.lineTo(x + 6 * s * dir, y - 8 * s);
        limbs.lineTo(x + 1 * s * dir, y - 3 * s);
        limbs.moveTo(x, y - 12 * s);
        limbs.lineTo(x - 5 * s * dir, y - 6 * s);
        limbs.lineTo(x - 1 * s * dir, y - 2 * s);
        limbs.moveTo(x, y - 22 * s);
        limbs.lineTo(x - 8 * s, y - 28 * s);
        limbs.moveTo(x, y - 22 * s);
        limbs.lineTo(x + 8 * s, y - 28 * s);
      } else {
        limbs.lineTo(x - 5 * s, y);
        limbs.moveTo(x, y - 12 * s);
        limbs.lineTo(x + 5 * s, y);
        limbs.moveTo(x, y - 22 * s);
        limbs.lineTo(x + 4 * s, y - 17 * s);
        limbs.lineTo(x + 1 * s, y - 15 * s);
        limbs.moveTo(x, y - 22 * s);
        limbs.lineTo(x - 3 * s, y - 17 * s);
        limbs.lineTo(x, y - 15 * s);
      }
      const sc = Math.sin(clock.value * 3 + i);
      bands.moveTo(x - 4.6 * k, y - 30 * s - 1.4 * k);
      bands.lineTo(x - 11 * s, y - 29 * s + sc * 2 * s);
      bands.lineTo(x - 4.6 * k, y - 30 * s - 0.2 * k);
      bands.close();
    }
    return { limbs, heads, bands, puffs };
  });
  const limbs = useDerivedValue(() => d.value.limbs);
  const heads = useDerivedValue(() => d.value.heads);
  const bands = useDerivedValue(() => d.value.bands);
  const puffs = useDerivedValue(() => d.value.puffs);
  return (
    <Group>
      <Path path={limbs} style="stroke" strokeWidth={4.4 * k} strokeCap="round" strokeJoin="round" color={c.ninja} />
      <Path path={heads} color={c.ninja} />
      <Path path={bands} color={c.band} />
      <Path path={puffs} color={c.smoke} opacity={0.88} />
    </Group>
  );
}

export default function NarutoScene({ p, clock, width, height, tone, lightSurface }) {
  const night = !lightSurface;
  const L = useMemo(() => narLayout(width, height), [width, height]);
  const back = useMemo(() => buildBack(L), [L]);
  const vil = useMemo(() => buildVillage(L), [L]);
  const fore = useMemo(() => buildFore(L), [L]);
  const c = useMemo(() => toneMap(NR_TONE, tone.colors), [tone]);
  const { k, ground, cliffTop } = L;
  const sun = night ? [width * 0.3, cliffTop - 6 * k, 46 * k] : [width * 0.78, height * 0.1, 26 * k];
  const winO = useDerivedValue(() => (night ? 0.85 + 0.15 * Math.sin(clock.value * 0.7) : 0.55));
  const leaf = useDerivedValue(() => [{ translateX: Math.sin(clock.value * 0.8) * 2 * k }]);
  return (
    <Group opacity={tone.alpha}>
      <Rect x={0} y={0} width={width} height={ground}>
        <LinearGradient start={vec(0, 0)} end={vec(0, cliffTop + 40 * k)} colors={[c.skyTop, c.skyLow]} />
      </Rect>
      <Glow cx={sun[0]} cy={sun[1]} r={sun[2] * 5} color={c.sun} a={night ? 0.55 : 0.4} mid={0.35} />
      <Circle cx={sun[0]} cy={sun[1]} r={sun[2]} color={c.sun} />
      <Clouds clock={clock} L={L} c={c} />
      <Path path={back.mount} color={c.mountain} />
      <Path path={back.cliff} color={c.cliff} />
      <Path path={back.cracks} style="stroke" strokeWidth={1.2 * k} color={c.cliffShade} />
      <Path path={back.faceShade} color={c.cliffShade} />
      <Path path={back.faceLit} color={c.carve} />
      <Path path={back.faceLine} style="stroke" strokeWidth={1.6 * k} strokeCap="round" color={c.cliffShade} />
      <Path path={vil.forest} color={c.forest} />
      <Path path={vil.back} color={c.wallShade} />
      <Path path={vil.backShade} color={rgba(c.forest, 0.25)} />
      <Path path={vil.tower} color={c.roofRed} />
      <Path path={vil.towerShade} color={rgba(c.forest, 0.28)} />
      <Path path={vil.towerRoof} color={c.roofRed} />
      <Path path={vil.towerRoof} style="stroke" strokeWidth={0.8 * k} color={rgba(c.forest, 0.5)} />
      <Group opacity={winO}>
        <Path path={vil.towerWin} color={c.window} />
      </Group>
      <Path path={vil.poles} color={c.pole} />
      <Path path={vil.wires} style="stroke" strokeWidth={0.8 * k} color={c.wire} />
      <Path path={vil.front} color={c.wall} />
      <Path path={vil.frontShade} color={c.wallShade} />
      <Path path={vil.roofsRed} color={c.roofRed} />
      <Path path={vil.roofsTeal} color={c.roofTeal} />
      <Path path={vil.tanks} color={c.tank} />
      <Group opacity={winO}>
        <Path path={vil.wins} color={c.window} />
      </Group>
      <Duel p={p} clock={clock} L={L} c={c} />
      <Clones p={p} clock={clock} L={L} c={c} />
      <Path path={fore.grass} color={c.tree} />
      <Path path={fore.posts} color={c.post} />
      <Path path={fore.ropes} color={c.band} />
      <Path path={fore.trunks} color={c.post} />
      <Group transform={leaf}>
        <Path path={fore.leaves} color={c.treeLeaf} />
      </Group>
    </Group>
  );
}
