// components/decor/aotScene.js
//
// Attack on Titan atmosfer sahnesi (OVERLAY.titanWall, ön katman) — tamamı VEKTÖR:
//   • Duvar: soluk taş yüz, düzenli aralıklı yüksek PAYANDALAR (ışıklı ön yüz + gölgeli yan yüz +
//     taban basamağı), tepe korniş + korkuluk + birkaç top, derzler ve yağmur izleri.
//   • Ortada ANA KAPI: çıkıntılı taş çerçeve, kemerli lento, armalı levha, demir kuşaklı ahşap kapı.
//   • Sağda SU KAPISI: kemer, demir parmaklık; içinden çıkan KANAL şehre akar.
//   • Şehir: üç sıra yarım ahşap (fachwerk) ev — uzak sıralar pusla sönük, öndekiler iri; kapıya
//     giden cadde ve kanal için sıralarda boşluk; çan kulesi; çatı pencereleri, bacalar.
//   • Dev (aotFrame zaman çizelgesi): şimşek → buhar sütunu → duvarın ardından yükselir → eli
//     duvarın tepesine iner → geriye yaslanır → KAPIYI TEKMELER: kapı parçalanır, ayağı delikten
//     görünür, enkaz ve toz şehre saçılır, sahne sarsılır → buhar içinde kaybolur → kapı onarılır.
//
// Ölçek: sceneScale (k). Duvar tepesi SCENERY.titanWallTop, zemin SCENERY.lift (sekme çubuğu).
// Dev, el ve ayak kendi renkleriyle (temadan bağımsız); taş/şehir tonları OVERLAY_TONES[26].

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Circle, Group, LinearGradient, Oval, Path, RadialGradient, Rect, Skia, vec } from "@shopify/react-native-skia";
import { AotEventB } from "./sceneEventsB";
import { aotFrame, sceneScale } from "../../utils/weatherParticles";
import { SCENERY } from "../../utils/weatherUniverses";
import { seededRandom } from "../../utils/decorLayout";

function rgba(hex, a) {
  const h = String(hex).replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// OVERLAY_TONES[26] renk sırası
const AOT_TONE = [
  "face", "low", "pierLit", "pierShade", "line", "plaster", "timber", "roofLit", "roofShade",
  "window", "haze", "road", "water", "waterHi", "door", "iron", "roofAlt",
];
const toneMap = (colors) => Object.fromEntries(AOT_TONE.map((name, i) => [name, colors[i] || colors[0]]));

const smooth = (a, b, x) => {
  "worklet";
  const v = (x - a) / (b - a);
  const c = v < 0 ? 0 : v > 1 ? 1 : v;
  return c * c * (3 - 2 * c);
};

// ── Sahne ölçüleri ──────────────────────────────────────────────────────────
export function aotLayout(width, height) {
  const k = sceneScale(width, height);
  const base = height - SCENERY.lift * k; // ön sıra evlerin tabanı (sekme çubuğu altta)
  const wallTop = base - SCENERY.titanWallTop * k;
  const wallBase = base - 82 * k; // duvar dibi: arada dört ev sırası, meydan ve kanal
  const cx = width / 2;
  const gw = 58 * k;
  const gh = 86 * k;
  const gate = { x: cx - gw / 2, y: wallBase - gh, w: gw, h: gh };
  const xw = cx + 98 * k; // su kapısı
  const T = 210 * k; // devin 100 birimlik kutusu (baş + boyun + omuz)
  return { k, base, wallTop, wallBase, cx, gate, xw, T };
}

/** Devin sanat kutusunun üst kenarı (y): rise 0 → tamamen duvarın ardında; 1 → çenesi duvarın
 *  28 dp üstünde (boyun ve omuz başları görünür). */
export function titanTopY(L, rise) {
  "worklet";
  const s = L.T / 100;
  return L.wallTop - 28 * L.k - 62 * s + (1 - rise) * 80 * s;
}

// ── Duvar geometrisi ────────────────────────────────────────────────────────
function buildWall(width, L) {
  const { k, wallTop, wallBase, cx, gate, xw } = L;
  const P = () => Skia.Path.Make();
  const rand = seededRandom(2601);
  const face = P();
  face.addRect(Skia.XYWHRect(-4, wallTop, width + 8, wallBase - wallTop + 2));
  const courses = P();
  for (let y = wallTop + 16 * k, row = 0; y < wallBase - 4 * k; y += 22 * k, row += 1) {
    courses.moveTo(-4, y);
    courses.lineTo(width + 4, y);
    for (let x = (row % 2) * 23 * k; x < width; x += 46 * k) {
      courses.moveTo(x, y);
      courses.lineTo(x, Math.min(wallBase, y + 22 * k));
    }
  }
  const streaks = P();
  for (let i = 0; i < 22; i += 1) {
    const x = rand() * width;
    const y = wallTop + (6 + rand() * 40) * k;
    streaks.moveTo(x, y);
    streaks.lineTo(x + (rand() - 0.5) * 3 * k, y + (30 + rand() * 90) * k);
  }
  // korniş + korkuluk + toplar
  const cornice = P();
  cornice.addRect(Skia.XYWHRect(-4, wallTop - 7 * k, width + 8, 9 * k));
  const rail = P();
  rail.addRect(Skia.XYWHRect(-4, wallTop - 13 * k, width + 8, 1.2 * k));
  for (let x = 4 * k; x < width; x += 13 * k) rail.addRect(Skia.XYWHRect(x, wallTop - 13 * k, 1.1 * k, 6 * k));
  const cannons = P();
  for (const fx of [0.12, 0.36, 0.7, 0.93]) {
    const x = width * fx;
    if (Math.abs(x - cx) < 70 * k) continue;
    cannons.addRRect(Skia.RRectXY(Skia.XYWHRect(x - 6 * k, wallTop - 14.6 * k, 12 * k, 3 * k), 1.4 * k, 1.4 * k));
    cannons.addCircle(x - 2 * k, wallTop - 9.6 * k, 2.6 * k);
  }
  // payandalar: kapının iki yanında, sonra 72 dp aralıkla dışa
  const pierLit = P();
  const pierSide = P();
  const pierCap = P();
  const pierShadow = P();
  const bw = 15 * k;
  const xs = [];
  for (let d = 62 * k; d < width; d += 72 * k) xs.push(cx - d, cx + d);
  for (const xb of xs) {
    if (xb < -30 * k || xb > width + 30 * k) continue;
    const x0 = xb - bw / 2;
    pierLit.addRect(Skia.XYWHRect(x0, wallTop - 10 * k, bw, wallBase - wallTop + 10 * k));
    pierSide.moveTo(x0 + bw, wallTop - 10 * k);
    pierSide.lineTo(x0 + bw + 5 * k, wallTop - 6 * k);
    pierSide.lineTo(x0 + bw + 5 * k, wallBase);
    pierSide.lineTo(x0 + bw, wallBase);
    pierSide.close();
    pierCap.addRect(Skia.XYWHRect(x0 - 2 * k, wallTop - 14 * k, bw + 4 * k, 4.4 * k));
    pierCap.addRect(Skia.XYWHRect(x0 - 3 * k, wallBase - 18 * k, bw + 6 * k, 18 * k));
    pierCap.addRect(Skia.XYWHRect(x0 - 1.5 * k, wallBase - 30 * k, bw + 3 * k, 12 * k));
    pierShadow.addRect(Skia.XYWHRect(x0 + bw + 5 * k, wallTop, 9 * k, wallBase - wallTop));
  }
  // ana kapı çerçevesi, lento taşları, levha
  const fw = 9 * k;
  const frame = P();
  frame.addRect(Skia.XYWHRect(gate.x - fw, gate.y - 16 * k, gate.w + fw * 2, gate.h + 16 * k));
  const recess = P();
  recess.addRect(Skia.XYWHRect(gate.x - 2.4 * k, gate.y - 2.4 * k, gate.w + 4.8 * k, gate.h + 2.4 * k));
  const lintel = P();
  for (let i = 0; i <= 6; i += 1) {
    const x = gate.x - fw + ((gate.w + fw * 2) * i) / 6;
    lintel.moveTo(x, gate.y - 16 * k);
    lintel.lineTo(x, gate.y - 2.4 * k);
  }
  lintel.moveTo(gate.x - fw, gate.y - 9 * k);
  lintel.lineTo(gate.x - fw + 0.01, gate.y - 9 * k);
  for (let y = gate.y + 14 * k; y < gate.y + gate.h; y += 16 * k) {
    lintel.moveTo(gate.x - fw, y);
    lintel.lineTo(gate.x - 2.4 * k, y);
    lintel.moveTo(gate.x + gate.w + 2.4 * k, y);
    lintel.lineTo(gate.x + gate.w + fw, y);
  }
  const plaque = P();
  plaque.addRect(Skia.XYWHRect(cx - 10 * k, gate.y - 34 * k, 20 * k, 14 * k));
  const emblem = P();
  emblem.addCircle(cx, gate.y - 27 * k, 4.2 * k);
  emblem.moveTo(cx - 3 * k, gate.y - 27 * k);
  emblem.lineTo(cx + 3 * k, gate.y - 27 * k);
  emblem.moveTo(cx, gate.y - 30 * k);
  emblem.lineTo(cx, gate.y - 24 * k);
  // kapı: dikey tahtalar, demir kuşaklar, perçinler
  const door = P();
  door.addRect(Skia.XYWHRect(gate.x, gate.y, gate.w, gate.h));
  const planks = P();
  for (let x = gate.x + 6 * k; x < gate.x + gate.w - 1; x += 6 * k) {
    planks.moveTo(x, gate.y);
    planks.lineTo(x, gate.y + gate.h);
  }
  const bands = P();
  const rivets = P();
  for (const fy of [0.16, 0.5, 0.84]) {
    const y = gate.y + gate.h * fy;
    bands.addRect(Skia.XYWHRect(gate.x, y - 2 * k, gate.w, 4 * k));
    for (let x = gate.x + 3 * k; x < gate.x + gate.w; x += 6 * k) rivets.addCircle(x, y, 0.9 * k);
  }
  bands.addRect(Skia.XYWHRect(cx - 0.8 * k, gate.y, 1.6 * k, gate.h));
  // su kapısı: kemer + parmaklık
  const aw = 17 * k;
  const ah = 16 * k;
  const arch = P();
  arch.moveTo(xw - aw, wallBase);
  arch.lineTo(xw - aw, wallBase - ah);
  arch.cubicTo(xw - aw, wallBase - ah - aw * 1.33, xw + aw, wallBase - ah - aw * 1.33, xw + aw, wallBase - ah);
  arch.lineTo(xw + aw, wallBase);
  arch.close();
  const archRing = P();
  archRing.moveTo(xw - aw - 2 * k, wallBase);
  archRing.lineTo(xw - aw - 2 * k, wallBase - ah);
  archRing.cubicTo(xw - aw - 2 * k, wallBase - ah - (aw + 2 * k) * 1.33, xw + aw + 2 * k, wallBase - ah - (aw + 2 * k) * 1.33, xw + aw + 2 * k, wallBase - ah);
  archRing.lineTo(xw + aw + 2 * k, wallBase);
  const grate = P();
  for (let x = xw - aw + 4 * k; x < xw + aw - 1; x += 4.6 * k) {
    grate.moveTo(x, wallBase - ah - aw * 0.95 + Math.abs(x - xw) * 0.5);
    grate.lineTo(x, wallBase - 3 * k);
  }
  grate.moveTo(xw - aw, wallBase - ah * 0.55);
  grate.lineTo(xw + aw, wallBase - ah * 0.55);
  // kırık kapı deliği (çerçeveyi de yer), çatlaklar, moloz
  const hr = seededRandom(2602);
  const hole = P();
  const hx0 = gate.x - 4 * k;
  const hx1 = gate.x + gate.w + 4 * k;
  const hy = gate.y - 8 * k;
  hole.moveTo(hx0, wallBase);
  for (let i = 1; i <= 5; i += 1) hole.lineTo(hx0 + (hr() - 0.5) * 7 * k, wallBase - (gate.h * i) / 5.4);
  for (let i = 0; i <= 7; i += 1) hole.lineTo(hx0 + ((hx1 - hx0) * i) / 7, hy + (hr() - 0.3) * 12 * k);
  for (let i = 5; i >= 1; i -= 1) hole.lineTo(hx1 + (hr() - 0.5) * 7 * k, wallBase - (gate.h * i) / 5.4);
  hole.lineTo(hx1, wallBase);
  hole.close();
  const cracks = P();
  const cr = seededRandom(2603);
  [[hx0, hy + 10 * k, -1, -0.6], [hx0 + 10 * k, hy, -0.4, -1], [cx, hy - 2 * k, 0.1, -1], [hx1 - 8 * k, hy, 0.5, -1], [hx1, hy + 14 * k, 1, -0.4], [hx1, wallBase - 30 * k, 1, 0.1]].forEach(([x0, y0, dx, dy]) => {
    let x = x0;
    let y = y0;
    cracks.moveTo(x, y);
    for (let j = 0; j < 4; j += 1) {
      x += (dx * 9 + (cr() - 0.5) * 8) * k;
      y += (dy * 9 + (cr() - 0.5) * 8) * k;
      cracks.lineTo(x, y);
    }
  });
  const rubble = P();
  for (let i = 0; i < 11; i += 1) {
    const x = cx + (cr() - 0.5) * 92 * k;
    const y = wallBase + (cr() * 10 - 2) * k;
    const r = (2.4 + cr() * 4) * k;
    rubble.moveTo(x - r, y);
    rubble.lineTo(x - r * 0.4, y - r * 0.9);
    rubble.lineTo(x + r * 0.6, y - r * 0.7);
    rubble.lineTo(x + r, y);
    rubble.close();
  }
  return {
    face, courses, streaks, cornice, rail, cannons, pierLit, pierSide, pierCap, pierShadow, frame, recess, lintel,
    plaque, emblem, door, planks, bands, rivets, arch, archRing, grate, hole, cracks, rubble,
  };
}

// ── Meydan, cadde, kanal ────────────────────────────────────────────────────
function buildGround(width, L) {
  const { k, base, wallBase, cx, gate, xw } = L;
  const P = () => Skia.Path.Make();
  const plaza = P();
  plaza.addRect(Skia.XYWHRect(-4, wallBase - 1, width + 8, base - wallBase + 12 * k));
  const road = P();
  for (let i = 0; i <= 6; i += 1) {
    road.moveTo(gate.x + (gate.w * i) / 6, wallBase);
    road.lineTo(cx + (i - 3) * 30 * k, base + 12 * k);
  }
  for (let j = 1; j <= 4; j += 1) {
    const f = j / 5;
    const y = wallBase + (base + 12 * k - wallBase) * f * f;
    const hw = gate.w / 2 + (90 * k - gate.w / 2) * f;
    road.moveTo(cx - hw, y);
    road.lineTo(cx + hw, y);
  }
  const xb = xw + 16 * k;
  const canal = P();
  canal.moveTo(xw - 17 * k, wallBase);
  canal.lineTo(xw + 17 * k, wallBase);
  canal.lineTo(xb + 27 * k, base + 12 * k);
  canal.lineTo(xb - 27 * k, base + 12 * k);
  canal.close();
  const banks = P();
  banks.moveTo(xw - 19 * k, wallBase);
  banks.lineTo(xb - 30 * k, base + 12 * k);
  banks.moveTo(xw + 19 * k, wallBase);
  banks.lineTo(xb + 30 * k, base + 12 * k);
  const ripples = P();
  const rr = seededRandom(2604);
  for (let i = 0; i < 9; i += 1) {
    const f = 0.1 + rr() * 0.85;
    const y = wallBase + (base - wallBase) * f;
    const xc = xw + (xb - xw) * f + (rr() - 0.5) * 20 * k * (0.6 + f);
    const hw = (3 + rr() * 5) * k * (0.6 + f);
    ripples.moveTo(xc - hw, y);
    ripples.lineTo(xc + hw, y);
  }
  return { plaza, road, canal, banks, ripples };
}

// ── Ev sıraları ─────────────────────────────────────────────────────────────
// Yarım ahşap evler: sıvalı cephe, ahşap dikme/kiriş/çapraz, iki yüzlü kiremit çatı (iki renk
// ailesi), kiremit sıraları, çatı penceresi (dormer), baca, pencereler (çoğu ışıklı).
function buildRow(width, L, { baseY, s, gaps, seed, tower }) {
  const { k } = L;
  const u = k * s;
  const rand = seededRandom(seed);
  const P = () => Skia.Path.Make();
  const o = {
    walls: P(), beams: P(), winOn: P(), winOff: P(), mull: P(), lit: P(), shade: P(), litAlt: P(), shadeAlt: P(),
    tiles: P(), eaves: P(), chimneys: P(), sil: P(),
  };
  const tri = (path, ax, ay, bx, by, qx, qy) => {
    path.moveTo(ax, ay);
    path.lineTo(bx, by);
    path.lineTo(qx, qy);
    path.close();
  };
  const roof = (x, w, eave, rh, ov, alt) => {
    const c = x + w / 2;
    const half = w / 2 + ov;
    tri(alt ? o.litAlt : o.lit, c - half, eave + 1.2 * u, c, eave - rh, c + 0.5, eave + 1.2 * u);
    tri(alt ? o.shadeAlt : o.shade, c - 0.5, eave + 1.2 * u, c, eave - rh, c + half, eave + 1.2 * u);
    tri(o.sil, c - half, eave + 1.2 * u, c, eave - rh, c + half, eave + 1.2 * u);
    const rows = Math.max(3, Math.round(rh / (4 * u)));
    for (let j = 1; j <= rows; j += 1) {
      const f = j / (rows + 1);
      const hw = half * (1 - f);
      o.tiles.moveTo(c - hw, eave - rh * f);
      o.tiles.lineTo(c + hw, eave - rh * f);
    }
    o.eaves.moveTo(c - half, eave + 1.2 * u);
    o.eaves.lineTo(c, eave - rh);
    o.eaves.lineTo(c + half, eave + 1.2 * u);
  };
  const addWindow = (px, wy, w, h) => {
    (rand() < 0.66 ? o.winOn : o.winOff).addRect(Skia.XYWHRect(px - w / 2, wy, w, h));
    o.mull.addRect(Skia.XYWHRect(px - w / 2 - 0.6 * u, wy - 0.7 * u, w + 1.2 * u, 1 * u));
    o.mull.addRect(Skia.XYWHRect(px - w / 2 - 0.6 * u, wy + h - 0.2 * u, w + 1.2 * u, 1.2 * u));
    o.mull.addRect(Skia.XYWHRect(px - 0.35 * u, wy, 0.7 * u, h));
    o.mull.addRect(Skia.XYWHRect(px - w / 2, wy + h / 2 - 0.35 * u, w, 0.7 * u));
  };
  const inGap = (x0, x1) => gaps.some(([g0, g1]) => x1 > g0 && x0 < g1);
  let towerDone = !tower;
  for (let x = -12 * u; x < width + 12 * u; ) {
    if (!towerDone && x + 30 * u > tower.x) {
      towerDone = true;
      const tw = 17 * u;
      const tx = x + 2 * u;
      const te = baseY - 84 * u;
      o.walls.addRect(Skia.XYWHRect(tx, te, tw, baseY - te + 4 * u));
      o.sil.addRect(Skia.XYWHRect(tx, te, tw, baseY - te + 4 * u));
      o.beams.addRect(Skia.XYWHRect(tx, te, 1.6 * u, baseY - te));
      o.beams.addRect(Skia.XYWHRect(tx + tw - 1.6 * u, te, 1.6 * u, baseY - te));
      for (const fy of [0.3, 0.62]) o.beams.addRect(Skia.XYWHRect(tx, te + (baseY - te) * fy, tw, 1.4 * u));
      o.winOff.addRRect(Skia.RRectXY(Skia.XYWHRect(tx + tw * 0.3, te + 5 * u, tw * 0.4, 12 * u), tw * 0.2, tw * 0.2));
      o.winOn.addRect(Skia.XYWHRect(tx + tw * 0.34, te + 32 * u, tw * 0.32, 6 * u));
      roof(tx, tw, te, 36 * u, 2.4 * u, false);
      x = tx + tw + 2 * u;
      continue;
    }
    const w = (26 + rand() * 18) * u;
    if (inGap(x, x + w)) {
      x += 6 * u;
      continue;
    }
    const wallH = (13 + rand() * 13) * u;
    const eave = baseY - wallH;
    const rh = w * (0.46 + rand() * 0.16);
    const ov = 2.2 * u;
    const c = x + w / 2;
    const alt = rand() < 0.35;
    o.walls.addRect(Skia.XYWHRect(x, eave, w, wallH + 4 * u));
    o.sil.addRect(Skia.XYWHRect(x, eave, w, wallH + 4 * u));
    if (rand() < 0.5) {
      const chx = x + w * (rand() < 0.5 ? 0.24 : 0.7);
      const ry = eave - rh * Math.max(0, 1 - Math.abs(chx + 2 * u - c) / (w / 2 + ov));
      o.chimneys.addRect(Skia.XYWHRect(chx, ry - 9 * u, 4.2 * u, 12 * u));
      o.chimneys.addRect(Skia.XYWHRect(chx - 0.8 * u, ry - 10.4 * u, 5.8 * u, 1.8 * u));
    }
    const bw = 1.3 * u;
    o.beams.addRect(Skia.XYWHRect(x, eave, bw, wallH + 4 * u));
    o.beams.addRect(Skia.XYWHRect(x + w - bw, eave, bw, wallH + 4 * u));
    o.beams.addRect(Skia.XYWHRect(c - bw / 2, eave, bw, wallH + 4 * u));
    o.beams.addRect(Skia.XYWHRect(x, eave, w, bw));
    const midY = eave + wallH * 0.48;
    if (wallH > 16 * u) {
      o.beams.addRect(Skia.XYWHRect(x, midY, w, bw));
      for (const [px, qx] of [[x + bw, c - bw / 2], [x + w - bw, c + bw / 2]]) {
        o.beams.moveTo(px, midY);
        o.beams.lineTo(px + (qx > px ? 1.2 : -1.2) * u, midY);
        o.beams.lineTo(qx, eave + bw + 1.2 * u);
        o.beams.lineTo(qx, eave + bw);
        o.beams.close();
      }
    }
    const wy = wallH > 16 * u ? midY + 2.4 * u : eave + 3 * u;
    for (const px of [x + w * 0.25, x + w * 0.75]) addWindow(px, wy, 5.2 * u, 6.4 * u);
    // çatı penceresi (dormer): çatının ön yüzünde küçük alınlıklı pencere
    if (w > 32 * u && rand() < 0.65) {
      const dx = c + (rand() < 0.5 ? -1 : 1) * w * 0.18;
      const dy = eave - rh * 0.34;
      const dw = 7 * u;
      o.walls.addRect(Skia.XYWHRect(dx - dw / 2, dy - 5 * u, dw, 7 * u));
      (rand() < 0.6 ? o.winOn : o.winOff).addRect(Skia.XYWHRect(dx - 1.8 * u, dy - 3.6 * u, 3.6 * u, 4.4 * u));
      tri(alt ? o.shadeAlt : o.shade, dx - dw / 2 - 1.2 * u, dy - 4.6 * u, dx, dy - 10 * u, dx + dw / 2 + 1.2 * u, dy - 4.6 * u);
      o.eaves.moveTo(dx - dw / 2 - 1.2 * u, dy - 4.6 * u);
      o.eaves.lineTo(dx, dy - 10 * u);
      o.eaves.lineTo(dx + dw / 2 + 1.2 * u, dy - 4.6 * u);
    } else if (rand() < 0.5) {
      (rand() < 0.6 ? o.winOn : o.winOff).addCircle(c, eave - rh * 0.3, 1.7 * u);
    }
    roof(x, w, eave, rh, ov, alt);
    x += w + (rand() < 0.3 ? (1 + rand() * 3) * u : 0);
  }
  return o;
}

function Row({ row, C, haze, k }) {
  return (
    <>
      <Path path={row.chimneys} color={rgba(C.timber, 1)} />
      <Path path={row.walls} color={rgba(C.plaster, 1)} />
      <Path path={row.winOn} color={rgba(C.window, 0.95)} />
      <Path path={row.winOff} color={rgba(C.timber, 0.85)} />
      <Path path={row.beams} color={rgba(C.timber, 1)} />
      <Path path={row.mull} color={rgba(C.timber, 1)} />
      <Path path={row.lit} color={rgba(C.roofLit, 1)} />
      <Path path={row.shade} color={rgba(C.roofShade, 1)} />
      <Path path={row.litAlt} color={rgba(C.roofAlt, 1)} />
      <Path path={row.shadeAlt} color={rgba(C.roofShade, 1)} />
      <Path path={row.tiles} style="stroke" strokeWidth={0.7 * k} color="rgba(30,10,6,0.3)" />
      <Path path={row.eaves} style="stroke" strokeWidth={1.2 * k} strokeJoin="round" strokeCap="round" color={rgba(C.timber, 1)} />
      {haze > 0 ? <Path path={row.sil} color={rgba(C.haze, haze)} /> : null}
    </>
  );
}

// ── Dev (100 birimlik kutu: baş, boyun, omuz başları) ───────────────────────
// Kendi çizimimiz: derisi yer yer soyulmuş dev — alın, burun, elmacık ve çenede soluk deri
// plakaları; şakak ve yanaklarda çizgili kırmızı kas; dudaksız, yanaklara uzanan dişler;
// ağır kaş kemiği altında derin göz çukurları ve küçük, parlak gözler. Kalın koyu kontur.
const SKIN = "#e9c7a4";
const SKIN_SHADE = "#c79673";
const MUSCLE = "#c63a2e";
const MUSCLE_DARK = "#8c2219";
const FIBER = "rgba(84,16,10,0.75)";
const INK = "#2a0b08";
const TEETH = (() => {
  const up = Skia.Path.Make();
  const low = Skia.Path.Make();
  for (let i = 0; i < 14; i += 1) {
    const d = Math.abs(i - 6.5);
    const x = 35.2 + i * 2.1;
    const h = 4.6 - d * 0.22;
    up.addRRect(Skia.RRectXY(Skia.XYWHRect(x, 45.6 + d * d * 0.05, 1.9, h), 0.6, 0.6));
    low.addRRect(Skia.RRectXY(Skia.XYWHRect(x + 0.05, 51.2 - d * d * 0.02, 1.85, h - 0.4), 0.6, 0.6));
  }
  return { up, low };
})();
const HEAD = "M30 30 C29 14 37 4 50 3.4 C63 4 71 14 70 30 C70.6 38 69.4 46 66 52 C62.6 58 57 62.4 50 62.6 C43 62.4 37.4 58 34 52 C30.6 46 29.4 38 30 30 Z";
const SHOULDERS = "M0 100 L0 78 C8 70 20 64 32 60 C38 58 41 56 42 52 L58 52 C59 56 62 58 68 60 C80 64 92 70 100 78 L100 100 Z";
const FOREHEAD = "M33.2 24.4 C32.6 13 40 5.6 50 5.2 C60 5.6 67.4 13 66.8 24.4 C62 21.6 56 21 50 22.8 C44 21 38 21.6 33.2 24.4 Z";
const NOSE = "M47.6 24.6 L52.4 24.6 L53.4 36 C54.8 38 54.2 40.8 52 41.2 L48 41.2 C45.8 40.8 45.2 38 46.6 36 Z";
const CHEEK_PLATES = "M32.8 33.4 C36.4 31.8 41.6 32 45.2 33.8 L43.8 36.4 C40.4 35.6 36.6 35.8 33.4 37.2 Z M67.2 33.4 C63.6 31.8 58.4 32 54.8 33.8 L56.2 36.4 C59.6 35.6 63.4 35.8 66.6 37.2 Z";
const CHIN = "M40.4 57.6 C44 60.6 56 60.6 59.6 57.6 L58.6 60.8 C55 62.8 45 62.8 41.4 60.8 Z";
const MOUTH = "M33.6 45 C40 43.6 60 43.6 66.4 45 L65.4 56.2 C58 58.6 42 58.6 34.6 56.2 Z";

function TitanArt() {
  return (
    <>
      <Path path={SHOULDERS}>
        <LinearGradient start={vec(20, 55)} end={vec(70, 100)} colors={[MUSCLE, "#a02c22", "#6a1a12"]} />
      </Path>
      <Path
        path="M4 82 C12 73 22 67 34 63 M10 89 C18 79 28 72 39 67 M17 96 C24 86 32 78 42 72 M96 82 C88 73 78 67 66 63 M90 89 C82 79 72 72 61 67 M83 96 C76 86 68 78 58 72"
        style="stroke"
        strokeWidth={0.6}
        strokeCap="round"
        color={FIBER}
      />
      <Path path="M43 53 C44 61 46.4 67 49 74 M57 53 C56 61 53.6 67 51 74" style="stroke" strokeWidth={1} strokeCap="round" color={FIBER} />
      <Path path={SHOULDERS} style="stroke" strokeWidth={0.8} color={INK} />
      {/* baş: kas zemini */}
      <Path path={HEAD}>
        <LinearGradient start={vec(32, 10)} end={vec(68, 60)} colors={["#d4483b", MUSCLE, MUSCLE_DARK]} />
      </Path>
      {/* şakak + yanak kas lifleri */}
      <Path
        path="M31.4 26 C31.6 34 33 42 36 49 M32.6 24 C33.4 33 35 41 38 47.6 M68.6 26 C68.4 34 67 42 64 49 M67.4 24 C66.6 33 65 41 62 47.6 M34 38 C37 40 40 42.6 42.6 45 M35 41.6 C37.6 43 39.6 44.4 41.2 45.6 M66 38 C63 40 60 42.6 57.4 45 M65 41.6 C62.4 43 60.4 44.4 58.8 45.6 M36 53 C39 55.6 42 57.4 45 58.2 M64 53 C61 55.6 58 57.4 55 58.2"
        style="stroke"
        strokeWidth={0.5}
        strokeCap="round"
        color={FIBER}
      />
      <Path path="M33 28 C33.4 35 34.6 41 37 46 M67 28 C66.6 35 65.4 41 63 46" style="stroke" strokeWidth={0.45} strokeCap="round" color="rgba(255,170,140,0.45)" />
      {/* ağız: dudaksız, yanaklara uzanan iki sıra diş */}
      <Path path={MOUTH} color="#3a0c08" />
      <Path path={TEETH.up}>
        <LinearGradient start={vec(0, 45.6)} end={vec(0, 50.6)} colors={["#f2e8d2", "#cbb892"]} />
      </Path>
      <Path path={TEETH.low}>
        <LinearGradient start={vec(0, 51)} end={vec(0, 56)} colors={["#c4b08a", "#ece0c6"]} />
      </Path>
      <Path path="M34.6 45 L41 44.6 L41 57.4 L35.2 56.2 Z">
        <LinearGradient start={vec(34.6, 0)} end={vec(41, 0)} colors={["rgba(40,8,6,0.85)", "rgba(40,8,6,0)"]} />
      </Path>
      <Path path="M65.4 45 L59 44.6 L59 57.4 L64.8 56.2 Z">
        <LinearGradient start={vec(65.4, 0)} end={vec(59, 0)} colors={["rgba(40,8,6,0.85)", "rgba(40,8,6,0)"]} />
      </Path>
      <Path path="M35 51 C42 51.6 58 51.6 65 51" style="stroke" strokeWidth={0.6} color="#1a0604" />
      <Path path={MOUTH} style="stroke" strokeWidth={0.8} color={INK} />
      {/* deri plakaları */}
      {[FOREHEAD, NOSE, CHEEK_PLATES, CHIN].map((d) => (
        <React.Fragment key={d}>
          <Path path={d}>
            <LinearGradient start={vec(34, 6)} end={vec(66, 60)} colors={[SKIN, SKIN_SHADE]} />
          </Path>
          <Path path={d} style="stroke" strokeWidth={0.7} strokeJoin="round" color={INK} />
        </React.Fragment>
      ))}
      <Path path="M41 9 C44 7.4 47 6.8 50 6.8 M36.6 14 C37.6 12 39 10.6 40.6 9.6" style="stroke" strokeWidth={0.6} strokeCap="round" color="rgba(255,240,220,0.7)" />
      <Path path="M40 18.6 C43 17.6 46.6 17.6 49 18.6 M51 18.6 C53.4 17.6 57 17.6 60 18.6" style="stroke" strokeWidth={0.45} strokeCap="round" color="rgba(120,70,50,0.6)" />
      {/* kaş kemiği + derin göz çukurları */}
      <Path path="M32.4 27.6 C35.6 22.2 43.6 21 49.4 26.6 C46 25.6 39 25.6 32.4 27.6 Z M67.6 27.6 C64.4 22.2 56.4 21 50.6 26.6 C54 25.6 61 25.6 67.6 27.6 Z" color="#5a160f" />
      <Oval x={35.6} y={26.6} width={12} height={7.4}>
        <RadialGradient c={vec(41.6, 30.2)} r={6.6} colors={["#0c0302", "#250807", "#5a1712"]} positions={[0, 0.65, 1]} />
      </Oval>
      <Oval x={52.4} y={26.6} width={12} height={7.4}>
        <RadialGradient c={vec(58.4, 30.2)} r={6.6} colors={["#0c0302", "#250807", "#5a1712"]} positions={[0, 0.65, 1]} />
      </Oval>
      <Circle cx={42.4} cy={30.6} r={3.6}>
        <RadialGradient c={vec(42.4, 30.6)} r={3.6} colors={["rgba(255,236,190,0.5)", "rgba(255,220,160,0)"]} />
      </Circle>
      <Circle cx={57.6} cy={30.6} r={3.6}>
        <RadialGradient c={vec(57.6, 30.6)} r={3.6} colors={["rgba(255,236,190,0.5)", "rgba(255,220,160,0)"]} />
      </Circle>
      <Circle cx={42.4} cy={30.6} r={1.5} color="#ece6cf" />
      <Circle cx={57.6} cy={30.6} r={1.5} color="#ece6cf" />
      <Circle cx={42.6} cy={30.7} r={0.7} color="#140403" />
      <Circle cx={57.4} cy={30.7} r={0.7} color="#140403" />
      <Path path="M46.8 40 C48 41.4 52 41.4 53.2 40" style="stroke" strokeWidth={0.6} color={INK} />
      <Path path="M48.6 38.8 L48.2 40.6 M51.4 38.8 L51.8 40.6" style="stroke" strokeWidth={0.8} strokeCap="round" color="#3a0c08" />
      <Path path={HEAD} style="stroke" strokeWidth={0.9} color={INK} />
    </>
  );
}

// Kızgın kor zerreleri (kasların üstünde, üç grup ayrı fazda göz kırpar)
const EMBERS = [
  [[35, 40], [64, 42], [38, 55], [22, 70], [70, 66], [46, 66]],
  [[33, 30], [66, 30], [61, 54], [12, 80], [86, 76], [55, 70]],
  [[37, 47], [63, 48], [30, 62], [80, 70], [28, 76], [52, 62]],
].map((pts) => {
  const q = Skia.Path.Make();
  pts.forEach(([x, y]) => q.addCircle(x, y, 0.55));
  return q;
});

function EmberGroup({ clock, i, path }) {
  const op = useDerivedValue(() => 0.25 + 0.75 * Math.max(0, Math.sin(clock.value * (2.1 + i * 0.7) + i * 2.1)));
  return (
    <Group opacity={op}>
      <Path path={path} color="#ffb347" />
    </Group>
  );
}

// El: duvarın tepesini kavrayan dört parmak (kendi birimleri; 0 = duvar tepesi çizgisi)
// Parmak: [sol x, üst genişlik, uç genişlik, uzunluk]. Boğumdan aşağı sarkar, uca doğru incelir.
const FINGERS = [[10, 9.4, 7.2, 24], [21.6, 10, 7.8, 29], [33.6, 9.8, 7.6, 27.5], [45.2, 8.6, 6.6, 21]];
const fingerPath = ([x, w0, w1, len]) => {
  const c = x + w0 / 2;
  const r = w1 / 2;
  return `M${x} -3 L${x + w0} -3 L${c + r + 0.2} ${len - r} C${c + r + 0.2} ${len + r * 0.9} ${c - r - 0.2} ${len + r * 0.9} ${c - r - 0.2} ${len - r} Z`;
};
function HandArt() {
  return (
    <>
      {/* el sırtı: duvarın üstünde kambur, boğum tümsekleri */}
      <Path path="M2 3 C2 -9 12 -18 30 -18.6 C46 -19 58 -13 60 -3 L58 3 Z">
        <LinearGradient start={vec(10, -18)} end={vec(50, 3)} colors={["#d84c3e", MUSCLE, MUSCLE_DARK]} />
      </Path>
      <Path path="M10 -9 C18 -14 30 -15.6 44 -13 M8 -3 C18 -7 32 -8.4 52 -6 M24 -17 C25 -12 26 -8 27 -3.4 M38 -17 C38.6 -12 38.6 -8 38.2 -3.4" style="stroke" strokeWidth={0.55} strokeCap="round" color={FIBER} />
      <Path path="M11 -4.6 C13 -7.4 17 -7.4 19 -4.6 M22.8 -5 C25 -8 29.6 -8 31.6 -5 M34.6 -4.8 C36.8 -7.8 41 -7.8 43 -4.8 M46 -4 C47.8 -6.6 51.6 -6.6 53.4 -4" style="stroke" strokeWidth={0.7} strokeCap="round" color="rgba(255,180,150,0.55)" />
      {/* başparmak: yandan kavrar */}
      <Path path="M2 -2 C-2 4 -3 10 -1.6 15 C-0.6 18.4 4 18.4 4.6 15 C5.4 10 6 5 8 0 Z">
        <LinearGradient start={vec(-2, 0)} end={vec(8, 16)} colors={["#d14538", MUSCLE_DARK]} />
      </Path>
      <Path path="M2 -2 C-2 4 -3 10 -1.6 15 C-0.6 18.4 4 18.4 4.6 15 C5.4 10 6 5 8 0" style="stroke" strokeWidth={0.75} color={INK} />
      {FINGERS.map((fg) => {
        const [x, w0, w1, len] = fg;
        const c = x + w0 / 2;
        const d = fingerPath(fg);
        const j1 = len * 0.36;
        const j2 = len * 0.7;
        return (
          <React.Fragment key={x}>
            <Path path={d}>
              <LinearGradient start={vec(x, 0)} end={vec(x + w0, 0)} colors={["#d84c3e", MUSCLE, MUSCLE_DARK]} positions={[0, 0.45, 1]} />
            </Path>
            {/* kas lifleri boyunca, eklem kıvrımları, soluk deri uç */}
            <Path path={`M${c - w0 * 0.18} 0 C${c - w0 * 0.16} ${len * 0.4} ${c - w1 * 0.16} ${len * 0.7} ${c - w1 * 0.12} ${len - 3}`} style="stroke" strokeWidth={0.45} strokeCap="round" color={FIBER} />
            <Path path={`M${c - w0 * 0.34 + 0.4} ${j1} C${c - 1} ${j1 + 1.3} ${c + 1} ${j1 + 1.3} ${c + w0 * 0.34 - 0.4} ${j1} M${c - w1 * 0.36} ${j2} C${c - 1} ${j2 + 1.1} ${c + 1} ${j2 + 1.1} ${c + w1 * 0.36} ${j2}`} style="stroke" strokeWidth={0.6} strokeCap="round" color="rgba(60,12,9,0.9)" />
            <Oval x={c - w1 * 0.32} y={len - w1 * 0.95} width={w1 * 0.64} height={w1 * 0.8} color={SKIN} />
            <Path path={d} style="stroke" strokeWidth={0.75} strokeJoin="round" color={INK} />
          </React.Fragment>
        );
      })}
      <Path path="M2 3 C2 -9 12 -18 30 -18.6 C46 -19 58 -13 60 -3" style="stroke" strokeWidth={0.8} color={INK} />
    </>
  );
}

// Ayak: kapı deliğinden bize doğru gelen sağ ayak — üstte ayak sırtı, altta beş parmak
const TOES = [[20, 44, 62], [45, 59, 68], [60, 72, 72], [73, 83, 76], [84, 92, 80]];
function FootArt() {
  return (
    <>
      <Path path="M6 100 L9 50 C12 24 30 9 50 8 C70 9 88 24 91 50 L94 100 Z">
        <LinearGradient start={vec(20, 10)} end={vec(80, 100)} colors={["#d4483b", MUSCLE, MUSCLE_DARK]} />
      </Path>
      <Path
        path="M30 16 C26 34 24 50 24 64 M42 10 C38 30 37 46 38 62 M56 10 C58 28 60 44 62 62 M70 16 C74 32 77 46 79 66 M16 40 C16 52 17 60 19 70 M86 40 C87 52 88 62 89 74"
        style="stroke"
        strokeWidth={0.8}
        strokeCap="round"
        color={FIBER}
      />
      <Path path="M34 24 C42 20 58 20 66 24 L64 30 C56 27 44 27 36 30 Z" color={SKIN} />
      <Path path="M34 24 C42 20 58 20 66 24 L64 30 C56 27 44 27 36 30 Z" style="stroke" strokeWidth={0.8} color={INK} />
      {TOES.map(([x0, x1, top]) => {
        const r = (x1 - x0) / 2;
        return (
          <React.Fragment key={x0}>
            <Path path={`M${x0} 104 L${x0} ${top + r} C${x0} ${top - r * 0.3} ${x1} ${top - r * 0.3} ${x1} ${top + r} L${x1} 104 Z`}>
              <LinearGradient start={vec(x0, top)} end={vec(x1, 104)} colors={["#d84c3e", MUSCLE_DARK]} />
            </Path>
            <Oval x={x0 + r * 0.35} y={top + r * 0.2} width={r * 1.3} height={r * 1.1} color={SKIN} />
            <Path path={`M${x0} 104 L${x0} ${top + r} C${x0} ${top - r * 0.3} ${x1} ${top - r * 0.3} ${x1} ${top + r} L${x1} 104`} style="stroke" strokeWidth={0.9} color={INK} />
          </React.Fragment>
        );
      })}
      <Path path="M6 100 L9 50 C12 24 30 9 50 8 C70 9 88 24 91 50 L94 100" style="stroke" strokeWidth={0.9} color={INK} />
    </>
  );
}

// ── Buhar / toz bulutu ──────────────────────────────────────────────────────
// Birim çemberde yumuşak radyal leke; konum, boyut ve opaklık türetilmiş değerden.
function Puff({ state, color, core = 0.6 }) {
  const opacity = useDerivedValue(() => state.value.a);
  const transform = useDerivedValue(() => [
    { translateX: state.value.a > 0.002 ? state.value.x : -10000 },
    { translateY: state.value.y },
    { scale: state.value.r },
  ]);
  return (
    <Group opacity={opacity} transform={transform}>
      <Circle cx={0} cy={0} r={1}>
        <RadialGradient c={vec(0, 0)} r={1} colors={[rgba(color, core), rgba(color, core * 0.55), rgba(color, 0)]} positions={[0, 0.55, 1]} />
      </Circle>
    </Group>
  );
}

// Baştaki buhar çıkış noktaları (sanat birimi) ve patlama yönleri
const STEAM_AT = [[38, 8], [50, 4], [62, 8], [31, 28], [69, 28], [33, 46], [67, 46], [44, 3], [56, 3], [50, 16], [26, 62], [74, 62]];

function HeadSteam({ f, clock, L, i }) {
  const { k, cx, wallTop, T } = L;
  const [ax, ay] = STEAM_AT[i];
  const s = T / 100;
  const state = useDerivedValue(() => {
    const v = f.value;
    const env = Math.max(v.column, v.rise * (1 - v.vanish) * 0.8);
    if (env <= 0.001) return { x: 0, y: 0, r: 1, a: 0 };
    const life = 3.2 + (i % 4) * 0.35;
    const c = (clock.value / life + i * 0.137) % 1;
    const headY = titanTopY(L, v.rise);
    const bx =cx + (ax - 50) * s * (0.5 + 0.5 * v.rise);
    const by = v.rise > 0.05 ? headY + ay * s : wallTop;
    const drift = (i % 2 ? 1 : -1) * (6 + (i % 3) * 5) * k;
    return {
      x: bx + drift * c,
      y: Math.min(by, wallTop + 4 * k) - c * 70 * k,
      r: (9 + 30 * c) * k,
      a: env * Math.sin(Math.PI * c) * 0.6,
    };
  });
  return <Puff state={state} color="#f4f6f8" />;
}

// Kayboluş: başın çevresini saran, büyüyüp yükselen buhar bulutları (yüzün ortası değil)
function BurstSteam({ f, L, i }) {
  const { k, cx, T } = L;
  const s = T / 100;
  const a = (i / 10) * Math.PI * 2 + 0.3;
  const state = useDerivedValue(() => {
    const v = f.value;
    if (v.burst <= 0.001) return { x: 0, y: 0, r: 1, a: 0 };
    const headY = titanTopY(L, v.rise);
    const g = v.vanish;
    return {
      x: cx + Math.cos(a) * (22 + 14 * g) * s,
      y: headY + 34 * s + Math.sin(a) * (30 + 10 * g) * s - g * 26 * k,
      r: (18 + 30 * g) * k,
      a: v.burst * 0.55,
    };
  });
  return <Puff state={state} color="#f4f6f8" core={0.65} />;
}

function DustPuff({ f, L, i, color }) {
  const { k, cx, wallBase } = L;
  const state = useDerivedValue(() => {
    const v = f.value;
    if (v.dust <= 0.001) return { x: 0, y: 0, r: 1, a: 0 };
    const sp = v.spread;
    return {
      x: cx + (i - 3.5) * 13 * k * (1 + sp * 3.2),
      y: wallBase - 8 * k - sp * (10 + (i % 3) * 12) * k + (i % 2) * 10 * k * sp,
      r: (14 + 44 * sp) * k,
      a: v.dust * (0.7 - (i % 3) * 0.12),
    };
  });
  return <Puff state={state} color={color} core={0.75} />;
}

function ThumpPuff({ f, L, i, color }) {
  const { k, cx, wallTop } = L;
  const state = useDerivedValue(() => {
    const v = f.value;
    if (v.thump <= 0.001) return { x: 0, y: 0, r: 1, a: 0 };
    const g = 1 - v.thump;
    return { x: cx - 120 * k + i * 26 * k + (i - 1) * g * 14 * k, y: wallTop - 4 * k - g * 10 * k, r: (6 + 18 * g) * k, a: v.thump * 0.55 };
  });
  return <Puff state={state} color={color} />;
}

// ── Enkaz: kapıdan bize doğru uçan tahta ve taş parçaları ───────────────────
function Debris({ f, piece, C }) {
  const state = useDerivedValue(() => {
    const tau = f.value.deb;
    if (tau < 0) return { x: -10000, y: 0, s: 1, r: 0, a: 0 };
    return {
      x: piece.x0 + piece.vx * tau,
      y: piece.y0 - piece.up * tau + piece.g * tau * tau,
      s: 1 + 2.4 * tau,
      r: piece.r0 + piece.spin * tau,
      a: 1 - smooth(0.72, 1, tau),
    };
  });
  const opacity = useDerivedValue(() => state.value.a);
  const transform = useDerivedValue(() => [
    { translateX: state.value.x },
    { translateY: state.value.y },
    { rotate: state.value.r },
    { scale: state.value.s },
  ]);
  return (
    <Group opacity={opacity} transform={transform}>
      {piece.plank ? (
        <>
          <Rect x={-piece.w / 2} y={-piece.h / 2} width={piece.w} height={piece.h} color={rgba(C.door, 1)} />
          <Rect x={-piece.w / 2} y={-piece.h * 0.1} width={piece.w} height={piece.h * 0.18} color={rgba(C.iron, 1)} />
        </>
      ) : (
        <Path path={piece.path} color={rgba(C.pierLit, 1)} />
      )}
      {piece.plank ? null : <Path path={piece.path} style="stroke" strokeWidth={0.6} color={rgba(C.line, 1)} />}
    </Group>
  );
}

function buildDebris(L) {
  const { k, gate, cx } = L;
  const rand = seededRandom(2605);
  return Array.from({ length: 16 }, (_, i) => {
    const plank = i % 3 !== 2;
    const x0 = gate.x + gate.w * (0.1 + rand() * 0.8);
    const y0 = gate.y + gate.h * (0.25 + rand() * 0.6);
    const side = (x0 - cx) / (gate.w / 2);
    const piece = {
      plank,
      x0,
      y0,
      vx: (side * 150 + (rand() - 0.5) * 120) * k,
      up: (60 + rand() * 90) * k,
      g: (330 + rand() * 160) * k,
      r0: rand() * 6.28,
      spin: (rand() - 0.5) * 9,
      w: (2.6 + rand() * 1.6) * k,
      h: (9 + rand() * 7) * k,
    };
    if (!plank) {
      const r = (3 + rand() * 3) * k;
      const q = Skia.Path.Make();
      q.moveTo(-r, -r * 0.3);
      q.lineTo(-r * 0.3, -r);
      q.lineTo(r * 0.8, -r * 0.6);
      q.lineTo(r, r * 0.4);
      q.lineTo(-r * 0.2, r);
      q.close();
      piece.path = q;
    }
    return piece;
  });
}

// ── Sahne ───────────────────────────────────────────────────────────────────
export default function AotScene({ p, clock, width, height, tone }) {
  const L = useMemo(() => aotLayout(width, height), [width, height]);
  const { k, base, wallTop, wallBase, cx, gate, xw, T } = L;
  const C = useMemo(() => toneMap(tone.colors), [tone.colors]);
  const wall = useMemo(() => buildWall(width, L), [width, L]);
  const ground = useMemo(() => buildGround(width, L), [width, L]);
  // Dört sıra: uzaktakiler küçük ve puslu, öndekiler iri. Cadde (kapıya) ve kanal (su
  // kapısından) için boşluklar perspektifle genişler.
  const rows = useMemo(() => {
    const depth = base - wallBase;
    const spec = [
      [wallBase + 8 * k, 0.55, 2611, null],
      [wallBase + 27 * k, 0.76, 2612, null],
      [wallBase + 51 * k, 1.0, 2613, { x: cx - 150 * k }],
      [base + 8 * k, 1.34, 2614, null],
    ];
    return spec.map(([baseY, s, seed, tower]) => {
      const f = (baseY - wallBase) / depth;
      const xc = xw + 16 * k * f;
      const gaps = [[cx - (36 + 32 * f) * k, cx + (36 + 32 * f) * k], [xc - (16 + 13 * f) * k, xc + (16 + 13 * f) * k]];
      return buildRow(width, L, { baseY, s, seed, gaps, tower });
    });
  }, [width, L, k, wallBase, cx, xw, base]);
  const debris = useMemo(() => buildDebris(L), [L]);
  const bolt = useMemo(() => {
    const q = Skia.Path.Make();
    let x = cx + 34 * k;
    let y = -10;
    q.moveTo(x, y);
    const rand = seededRandom(2606);
    const steps = 9;
    for (let i = 1; i <= steps; i += 1) {
      x += (rand() - 0.55) * 22 * k;
      y = -10 + ((wallTop - 6 * k + 10) * i) / steps;
      q.lineTo(i === steps ? cx + 6 * k : x, y);
    }
    return q;
  }, [cx, k, wallTop]);

  const f = useDerivedValue(() => aotFrame(p, clock.value));
  const s = T / 100;
  const shake = useDerivedValue(() => {
    const a = f.value.shake;
    const t = clock.value;
    return [{ translateX: Math.sin(t * 73) * 3.2 * k * a }, { translateY: Math.cos(t * 59) * 2.4 * k * a }];
  });
  const flashOp = useDerivedValue(() => f.value.flash);
  const titanOp = useDerivedValue(() => (f.value.rise > 0.001 ? 1 - f.value.vanish : 0));
  const titanT = useDerivedValue(() => {
    const v = f.value;
    const breathe = Math.sin(clock.value * 0.9) * 1.4 * k;
    const y = titanTopY(L, v.rise) - v.lean * 10 * k + breathe;
    return [
      { translateX: v.rise > 0.001 ? cx - 50 * s : -10000 },
      { translateY: y },
      { translateX: 50 * s },
      { translateY: 40 * s },
      { rotate: -v.lean * 0.03 },
      { translateX: -50 * s },
      { translateY: -40 * s },
      { scale: s },
    ];
  });
  const hs = 0.88 * k;
  const handOp = useDerivedValue(() => f.value.hand * (1 - f.value.vanish));
  const handT = useDerivedValue(() => [
    { translateX: f.value.hand > 0.001 ? cx - 128 * k : -10000 },
    { translateY: wallTop - 7 * k - (1 - f.value.hand) * 16 * k },
    { scale: hs },
  ]);
  const doorOp = useDerivedValue(() => 1 - f.value.broken);
  const holeOp = useDerivedValue(() => f.value.broken);
  const footOp = useDerivedValue(() => f.value.foot);
  const footT = useDerivedValue(() => {
    const sc = (gate.w * 1.2 * (0.62 + 0.5 * f.value.foot)) / 100;
    return [
      { translateX: f.value.foot > 0.001 ? cx : -10000 },
      { translateY: wallBase + 4 * k },
      { scale: sc },
      { translateX: -50 },
      { translateY: -100 },
    ];
  });
  const dustC = "#cfc3ac"; // açık kum rengi: koyu zeminde de seçilir

  return (
    <Group transform={shake}>
      {/* şimşek + ışıma (duvarın ardında) */}
      <Group opacity={flashOp}>
        <Circle cx={cx} cy={wallTop} r={190 * k}>
          <RadialGradient c={vec(cx, wallTop)} r={190 * k} colors={["rgba(255,236,170,0.85)", "rgba(255,190,90,0.35)", "rgba(255,170,60,0)"]} positions={[0, 0.45, 1]} />
        </Circle>
        <Path path={bolt} style="stroke" strokeWidth={9 * k} strokeJoin="round" strokeCap="round" color="rgba(255,214,120,0.35)" />
        <Path path={bolt} style="stroke" strokeWidth={2.6 * k} strokeJoin="round" strokeCap="round" color="#fff4cf" />
      </Group>
      {/* dev */}
      <Group opacity={titanOp} transform={titanT}>
        <TitanArt />
        {EMBERS.map((path, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <EmberGroup key={i} clock={clock} i={i} path={path} />
        ))}
      </Group>
      {STEAM_AT.map((_, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <HeadSteam key={i} f={f} clock={clock} L={L} i={i} />
      ))}
      {Array.from({ length: 10 }, (_, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <BurstSteam key={i} f={f} L={L} i={i} />
      ))}

      {/* duvar */}
      <Path path={wall.face}>
        <LinearGradient start={vec(0, wallTop)} end={vec(0, wallBase)} colors={[rgba(C.face, 1), rgba(C.low, 1)]} />
      </Path>
      <Path path={wall.pierShadow}>
        <LinearGradient start={vec(0, wallTop)} end={vec(0, wallBase)} colors={["rgba(0,0,0,0.16)", "rgba(0,0,0,0.26)"]} />
      </Path>
      <Path path={wall.courses} style="stroke" strokeWidth={0.8 * k} color={rgba(C.line, 0.32)} />
      <Path path={wall.streaks} style="stroke" strokeWidth={2.2 * k} strokeCap="round" color={rgba(C.line, 0.14)} />
      <Path path={wall.pierSide} color={rgba(C.pierShade, 1)} />
      <Path path={wall.pierLit}>
        <LinearGradient start={vec(0, wallTop)} end={vec(0, wallBase)} colors={[rgba(C.pierLit, 1), rgba(C.face, 1)]} />
      </Path>
      <Path path={wall.pierCap} color={rgba(C.pierLit, 1)} />
      <Path path={wall.pierCap} style="stroke" strokeWidth={0.7 * k} color={rgba(C.line, 0.45)} />
      <Path path={wall.cornice} color={rgba(C.pierLit, 1)} />
      <Rect x={-4} y={wallTop + 2 * k} width={width + 8} height={3 * k} color="rgba(0,0,0,0.22)" />
      <Path path={wall.rail} color={rgba(C.iron, 0.9)} />
      <Path path={wall.cannons} color={rgba(C.iron, 1)} />
      {/* su kapısı */}
      <Path path={wall.arch}>
        <LinearGradient start={vec(0, wallBase - 40 * k)} end={vec(0, wallBase)} colors={["#0d1215", rgba(C.water, 1)]} />
      </Path>
      <Path path={wall.grate} style="stroke" strokeWidth={1.1 * k} color={rgba(C.iron, 1)} />
      <Path path={wall.archRing} style="stroke" strokeWidth={4 * k} color={rgba(C.pierLit, 1)} />
      {/* ana kapı */}
      <Path path={wall.frame} color={rgba(C.pierLit, 1)} />
      <Path path={wall.lintel} style="stroke" strokeWidth={0.8 * k} color={rgba(C.line, 0.55)} />
      <Path path={wall.recess} color={rgba(C.pierShade, 1)} />
      <Path path={wall.plaque} color={rgba(C.pierLit, 1)} />
      <Path path={wall.plaque} style="stroke" strokeWidth={1 * k} color={rgba(C.line, 0.7)} />
      <Path path={wall.emblem} style="stroke" strokeWidth={1 * k} color={rgba(C.line, 0.8)} />
      <Group opacity={doorOp}>
        <Path path={wall.door}>
          <LinearGradient start={vec(0, gate.y)} end={vec(0, gate.y + gate.h)} colors={[rgba(C.door, 1), "rgba(20,14,10,1)"]} />
        </Path>
        <Path path={wall.planks} style="stroke" strokeWidth={0.8 * k} color="rgba(0,0,0,0.45)" />
        <Path path={wall.bands} color={rgba(C.iron, 1)} />
        <Path path={wall.rivets} color="rgba(200,190,170,0.55)" />
      </Group>
      <Group opacity={holeOp}>
        <Path path={wall.hole}>
          <LinearGradient start={vec(0, gate.y - 8 * k)} end={vec(0, wallBase)} colors={["#120d0a", "#2b231b"]} />
        </Path>
        <Circle cx={cx} cy={wallBase} r={50 * k}>
          <RadialGradient c={vec(cx, wallBase)} r={50 * k} colors={["rgba(255,214,160,0.22)", "rgba(255,214,160,0)"]} />
        </Circle>
        <Path path={wall.hole} style="stroke" strokeWidth={1.4 * k} strokeJoin="round" color={rgba(C.pierShade, 1)} />
        <Path path={wall.cracks} style="stroke" strokeWidth={1.2 * k} strokeJoin="round" color="rgba(20,16,12,0.7)" />
      </Group>
      {/* delikten giren ayak */}
      <Group clip={wall.hole}>
        <Group opacity={footOp} transform={footT}>
          <FootArt />
        </Group>
      </Group>
      {/* duvarı kavrayan el */}
      <Group opacity={handOp} transform={handT}>
        <HandArt />
      </Group>

      {/* meydan, cadde, kanal, moloz */}
      <Path path={ground.plaza}>
        <LinearGradient start={vec(0, wallBase)} end={vec(0, base)} colors={[rgba(C.road, 0.85), rgba(C.road, 1)]} />
      </Path>
      <Rect x={-4} y={wallBase - 1} width={width + 8} height={5 * k}>
        <LinearGradient start={vec(0, wallBase)} end={vec(0, wallBase + 5 * k)} colors={["rgba(0,0,0,0.3)", "rgba(0,0,0,0)"]} />
      </Rect>
      <Path path={ground.road} style="stroke" strokeWidth={0.7 * k} color={rgba(C.line, 0.35)} />
      <Path path={ground.canal}>
        <LinearGradient start={vec(0, wallBase)} end={vec(0, base)} colors={[rgba(C.water, 1), rgba(C.water, 0.9)]} />
      </Path>
      <Path path={ground.ripples} style="stroke" strokeWidth={0.9 * k} strokeCap="round" color={rgba(C.waterHi, 0.55)} />
      <Path path={ground.banks} style="stroke" strokeWidth={2.4 * k} color={rgba(C.pierLit, 1)} />
      <Group opacity={holeOp}>
        <Path path={wall.rubble} color={rgba(C.pierLit, 1)} />
        <Path path={wall.rubble} style="stroke" strokeWidth={0.6 * k} color={rgba(C.line, 0.7)} />
      </Group>

      {/* şehir: uzaktan yakına */}
      <Row row={rows[0]} C={C} haze={0.45} k={k * 0.55} />
      <Row row={rows[1]} C={C} haze={0.3} k={k * 0.76} />
      <Row row={rows[2]} C={C} haze={0.14} k={k} />
      <Row row={rows[3]} C={C} haze={0} k={k * 1.34} />
      <Rect x={-4} y={base} width={width + 8} height={height - base + 8} color={rgba(C.low, 1)} />
      <Rect x={-4} y={base} width={width + 8} height={height - base + 8}>
        <LinearGradient start={vec(0, base)} end={vec(0, height)} colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.35)"]} />
      </Rect>

      {/* toz, el darbesi, enkaz (en önde) */}
      {[0, 1, 2].map((i) => (
        <ThumpPuff key={i} f={f} L={L} i={i} color={C.pierLit} />
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <DustPuff key={i} f={f} L={L} i={i} color={dustC} />
      ))}
      {debris.map((piece, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <Debris key={i} f={f} piece={piece} C={C} />
      ))}
      {/* olay B (A ile sırayla) */}
      <AotEventB p={p} clock={clock} width={width} height={height} />
    </Group>
  );
}
