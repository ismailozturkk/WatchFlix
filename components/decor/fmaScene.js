// components/decor/fmaScene.js
//
// Fullmetal Alchemist evren sahnesi (OVERLAY.fmaVec = 54) — tamamı VEKTÖR; önünde toz zerreleri:
//   • Tuğla kasaba meydanı: iki yanda perspektifli tuğla binalar (ışıklı pencereler), uzak çatılar,
//     ortada saat kulesi (akrep/yelkovan gerçek saatle döner), arnavut kaldırımı meydan.
//   • Yerde tebeşirle çizilmiş dönüşüm çemberi (perspektif); solda kırmızı paltolu simyacı,
//     sağda iri zırh silüeti. Tepeden zincirli gümüş cep saati sarkaç gibi salınır.
//   • Olay (66 sn'de bir ~25 sn): simyacı ellerini çırpar, avuçlarını yere koyar; çember mavi
//     yanar, saniyede en çok 3 kısa şimşek çakar, kırmızı kıvılcımlar yükselir; çemberin ortasından
//     taş sütun yükselir, bir süre durur, sonra parçalanıp çöker.
//   • Olay B (dönüşümlü): çember kırmızı yanar; ortasından oymalı dev taş kapı yükselir, kanatları
//     ağır ağır açılır — içindeki karanlıkta tek bir iri göz ve uzanan gölge kollar — sonra kapanıp
//     yere geri gömülür.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[54] (FM_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Circle, Group, LinearGradient, Path, Rect, Skia, vec } from "@shopify/react-native-skia";
import { eventU } from "../../utils/weatherParticles";
import { Glow, TAU, groundLayout, hash, rgba, sm, toneMap } from "./seasonKit";

export const FM_TONE = [
  "skyTop",
  "skyLow",
  "sun",
  "cloud",
  "cityFar",
  "brick",
  "brickShade",
  "stone",
  "roof",
  "window",
  "clockFace",
  "street",
  "cobble",
  "chalk",
  "circle",
  "circleGlow",
  "arc",
  "pillar",
  "pillarShade",
  "coat",
  "armor",
  "armorShade",
  "watch",
  "chain",
  "redStone",
];

export function fmaLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  return {
    ...L,
    street: ground - 120 * k,
    ring: [width * 0.52, ground - 50 * k, 104 * k, 26 * k],
    alch: [width * 0.14, ground - 26 * k],
    armor: [width * 0.84, ground - 22 * k],
    clock: [width * 0.5, ground - 400 * k],
    watch: [width * 0.8, 0, 150 * k],
  };
}

// ───────────────────────────── statik geometri

function buildTown(L) {
  const { k, width, ground, street } = L;
  const far = Skia.Path.Make();
  let x = -10 * k;
  let i = 0;
  while (x < width + 10 * k) {
    const w = (26 + hash(i, 1) * 26) * k;
    const top = street - (90 + hash(i, 2) * 70) * k;
    far.moveTo(x, street);
    far.lineTo(x, top);
    far.lineTo(x + w / 2, top - 16 * k);
    far.lineTo(x + w, top);
    far.lineTo(x + w, street);
    far.close();
    if (hash(i, 3) > 0.6) far.addRect(Skia.XYWHRect(x + w * 0.7, top - 22 * k, 5 * k, 14 * k));
    x += w;
    i += 1;
  }
  // kilise kulesi (uzak)
  far.moveTo(width * 0.2 - 8 * k, street - 150 * k);
  far.lineTo(width * 0.2, street - 230 * k);
  far.lineTo(width * 0.2 + 8 * k, street - 150 * k);
  far.close();
  far.addRect(Skia.XYWHRect(width * 0.2 - 12 * k, street - 152 * k, 24 * k, 60 * k));
  // saat kulesi
  const [cx, cy] = L.clock;
  const tower = Skia.Path.Make();
  const tw = 64 * k;
  tower.addRect(Skia.XYWHRect(cx - tw / 2, cy - 10 * k, tw, street - cy + 10 * k));
  tower.addRect(Skia.XYWHRect(cx - tw / 2 - 5 * k, cy - 46 * k, tw + 10 * k, 8 * k));
  tower.moveTo(cx - tw / 2 - 4 * k, cy - 40 * k);
  tower.lineTo(cx, cy - 110 * k);
  tower.lineTo(cx + tw / 2 + 4 * k, cy - 40 * k);
  tower.close();
  tower.addRect(Skia.XYWHRect(cx - tw / 2 + 4 * k, cy - 40 * k, tw - 8 * k, 32 * k));
  tower.addRect(Skia.XYWHRect(cx - 1 * k, cy - 128 * k, 2 * k, 20 * k));
  const towerShade = Skia.Path.Make();
  towerShade.addRect(Skia.XYWHRect(cx + tw * 0.2, cy - 10 * k, tw * 0.3, street - cy + 10 * k));
  for (let r = 0; r < 4; r += 1) towerShade.addRect(Skia.XYWHRect(cx - tw / 2, cy + (60 + r * 46) * k, tw, 3 * k));
  const towerWin = Skia.Path.Make();
  for (let r = 0; r < 3; r += 1) {
    towerWin.addRRect(Skia.RRectXY(Skia.XYWHRect(cx - 7 * k, cy + (74 + r * 46) * k, 14 * k, 22 * k), 7 * k, 7 * k));
  }
  for (let j = 0; j < 3; j += 1) towerWin.addRRect(Skia.RRectXY(Skia.XYWHRect(cx - 22 * k + j * 16 * k, cy - 34 * k, 10 * k, 20 * k), 5 * k, 5 * k));
  // yan binalar (perspektif: cepheler meydana doğru daralır)
  const bricks = Skia.Path.Make();
  const shades = Skia.Path.Make();
  const roofs = Skia.Path.Make();
  const wins = Skia.Path.Make();
  const mortar = Skia.Path.Make();
  const side = (sg) => {
    // sg=-1 sol, +1 sağ; dış kenar ekran kenarı, iç kenar meydana
    const outer = sg < 0 ? -6 * k : width + 6 * k;
    const inner = width / 2 + sg * width * 0.24;
    const topOut = ground - 520 * k;
    const topIn = street - 150 * k;
    const botOut = ground + 4 * k;
    const botIn = street + 6 * k;
    const q = Skia.Path.Make();
    q.moveTo(outer, topOut);
    q.lineTo(inner, topIn);
    q.lineTo(inner, botIn);
    q.lineTo(outer, botOut);
    q.close();
    bricks.addPath(q);
    // iç kenar gölgesi (köşe)
    const e = Skia.Path.Make();
    const ix = inner - sg * 10 * k;
    e.moveTo(ix, topIn + 2 * k);
    e.lineTo(inner, topIn);
    e.lineTo(inner, botIn);
    e.lineTo(ix, botIn + 1 * k);
    e.close();
    shades.addPath(e);
    // çatı saçağı + bacalar
    roofs.moveTo(outer, topOut - 26 * k);
    roofs.lineTo(inner + sg * 6 * k, topIn - 12 * k);
    roofs.lineTo(inner - sg * 2 * k, topIn + 2 * k);
    roofs.lineTo(outer, topOut + 4 * k);
    roofs.close();
    for (let j = 0; j < 2; j += 1) {
      const f = 0.25 + j * 0.4;
      const bx = outer + (inner - outer) * f;
      const by = topOut + (topIn - topOut) * f - 18 * k;
      roofs.addRect(Skia.XYWHRect(bx - 5 * k, by - 22 * k * (1 - f * 0.5), 10 * k * (1 - f * 0.4), 24 * k * (1 - f * 0.5)));
    }
    // pencere sütunları (perspektifte)
    for (let c = 0; c < 3; c += 1) {
      const f0 = 0.14 + c * 0.27;
      const f1 = f0 + 0.12;
      for (let r = 0; r < 4; r += 1) {
        const rf = 0.12 + r * 0.2;
        const pt = (f, g) => {
          const xx = outer + (inner - outer) * f;
          const yt = topOut + (topIn - topOut) * f;
          const yb = botOut + (botIn - botOut) * f;
          return [xx, yt + (yb - yt) * g];
        };
        const a = pt(f0, rf);
        const b = pt(f1, rf);
        const cpt = pt(f1, rf + 0.11);
        const d = pt(f0, rf + 0.11);
        const w = Skia.Path.Make();
        w.moveTo(a[0], a[1]);
        w.lineTo(b[0], b[1]);
        w.lineTo(cpt[0], cpt[1]);
        w.lineTo(d[0], d[1]);
        w.close();
        if (hash(c * 5 + r + (sg > 0 ? 40 : 0), 9) > 0.35) wins.addPath(w);
        else shades.addPath(w);
        // pencere alt taşı
        mortar.moveTo(d[0] - sg * 2 * k, d[1] + 2 * k);
        mortar.lineTo(cpt[0] + sg * 2 * k, cpt[1] + 2 * k);
      }
    }
    // tuğla sıraları (perspektif yatay çizgiler)
    for (let r = 1; r < 22; r += 1) {
      const g = r / 22;
      mortar.moveTo(outer, topOut + (botOut - topOut) * g);
      mortar.lineTo(inner, topIn + (botIn - topIn) * g);
    }
  };
  side(-1);
  side(1);
  // arnavut kaldırımı: perspektif sıralar
  const cobble = Skia.Path.Make();
  for (let r = 0; r < 9; r += 1) {
    const g = (r + 1) / 9;
    const y = street + (ground - street) * g * g;
    cobble.moveTo(0, y);
    cobble.lineTo(width, y);
    const n = 6 + r * 2;
    for (let j = 0; j <= n; j += 1) {
      const f = (j + (r % 2) * 0.5) / n;
      const xx = width / 2 + (f - 0.5) * width * (0.6 + g * 1.2);
      const y0 = street + (ground - street) * ((r) / 9) * ((r) / 9);
      cobble.moveTo(xx, y0);
      cobble.lineTo(xx, y);
    }
  }
  return { far, tower, towerShade, towerWin, bricks, shades, roofs, wins, mortar, cobble };
}

function buildRing(L) {
  const [cx, cy, rx, ry] = L.ring;
  const P = (a, r) => [cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r];
  const q = Skia.Path.Make();
  q.addOval(Skia.XYWHRect(cx - rx, cy - ry, rx * 2, ry * 2));
  q.addOval(Skia.XYWHRect(cx - rx * 0.9, cy - ry * 0.9, rx * 1.8, ry * 1.8));
  q.addOval(Skia.XYWHRect(cx - rx * 0.42, cy - ry * 0.42, rx * 0.84, ry * 0.84));
  // iç içe iki üçgen + kare
  for (let s = 0; s < 2; s += 1) {
    for (let j = 0; j <= 3; j += 1) {
      const [x, y] = P(-Math.PI / 2 + s * Math.PI + (j * TAU) / 3, 0.9);
      if (j) q.lineTo(x, y);
      else q.moveTo(x, y);
    }
  }
  for (let j = 0; j <= 4; j += 1) {
    const [x, y] = P(Math.PI / 4 + (j * TAU) / 4, 0.64);
    if (j) q.lineTo(x, y);
    else q.moveTo(x, y);
  }
  // çevre işaretleri
  for (let j = 0; j < 24; j += 1) {
    const a = (j / 24) * TAU;
    const [x0, y0] = P(a, 0.9);
    const [x1, y1] = P(a, j % 2 ? 0.96 : 1.0);
    q.moveTo(x0, y0);
    q.lineTo(x1, y1);
  }
  // küçük iç simgeler: üç küçük daire
  for (let j = 0; j < 3; j += 1) {
    const [x, y] = P(Math.PI / 2 + (j * TAU) / 3, 0.66);
    q.addOval(Skia.XYWHRect(x - rx * 0.06, y - ry * 0.06, rx * 0.12, ry * 0.12));
  }
  return q;
}

function buildArmor(L) {
  const { k } = L;
  const s = (v) => v * k * 1.05;
  const body = Skia.Path.Make();
  const shade = Skia.Path.Make();
  // bacaklar + diz
  [-1, 1].forEach((sg) => {
    body.addRRect(Skia.RRectXY(Skia.XYWHRect(s(sg * 12 - 7), s(-48), s(14), s(48)), s(3), s(3)));
    body.addRRect(Skia.RRectXY(Skia.XYWHRect(s(sg * 12 - 10), s(-6), s(20), s(8)), s(3), s(3)));
    shade.addCircle(s(sg * 12), s(-26), s(6));
  });
  // etek (zincir) + bel
  body.moveTo(s(-26), s(-58));
  body.lineTo(s(26), s(-58));
  body.lineTo(s(30), s(-38));
  body.lineTo(s(-30), s(-38));
  body.close();
  // göğüs zırhı (iri, kubbeli)
  body.moveTo(s(-30), s(-60));
  body.cubicTo(s(-36), s(-96), s(-28), s(-112), s(0), s(-114));
  body.cubicTo(s(28), s(-112), s(36), s(-96), s(30), s(-60));
  body.close();
  shade.moveTo(s(4), s(-112));
  shade.cubicTo(s(26), s(-110), s(34), s(-96), s(30), s(-60));
  shade.lineTo(s(8), s(-60));
  shade.close();
  // omuzluklar (yarım küre + sivri)
  [-1, 1].forEach((sg) => {
    body.addCircle(s(sg * 36), s(-104), s(15));
    body.moveTo(s(sg * 36 - 4), s(-116));
    body.lineTo(s(sg * 40), s(-134));
    body.lineTo(s(sg * 36 + 5), s(-116));
    body.close();
    // kollar
    body.addRRect(Skia.RRectXY(Skia.XYWHRect(s(sg * 38 - 7), s(-96), s(14), s(46)), s(5), s(5)));
    body.addRRect(Skia.RRectXY(Skia.XYWHRect(s(sg * 38 - 8), s(-52), s(16), s(14)), s(5), s(5)));
  });
  // miğfer: yuvarlak, sivri tepe, kuyruk püskülü
  body.addRRect(Skia.RRectXY(Skia.XYWHRect(s(-15), s(-142), s(30), s(30)), s(12), s(12)));
  body.moveTo(s(-4), s(-140));
  body.lineTo(s(0), s(-160));
  body.lineTo(s(4), s(-140));
  body.close();
  const plume = Skia.Path.Make();
  plume.moveTo(s(0), s(-146));
  plume.cubicTo(s(20), s(-150), s(30), s(-132), s(36), s(-110));
  plume.cubicTo(s(26), s(-126), s(16), s(-138), s(0), s(-140));
  plume.close();
  const visor = Skia.Path.Make();
  visor.addRect(Skia.XYWHRect(s(-11), s(-130), s(22), s(5)));
  for (let j = 0; j < 4; j += 1) visor.addRect(Skia.XYWHRect(s(-8 + j * 5), s(-122), s(2), s(8)));
  // göğüs perçinleri / göbek bandı
  const trim = Skia.Path.Make();
  trim.addRect(Skia.XYWHRect(s(-30), s(-62), s(60), s(5)));
  for (let j = 0; j < 5; j += 1) trim.addCircle(s(-20 + j * 10), s(-59.5), s(1.4));
  // bel bezi
  const cloth = Skia.Path.Make();
  cloth.moveTo(s(-12), s(-57));
  cloth.lineTo(s(12), s(-57));
  cloth.lineTo(s(9), s(-24));
  cloth.lineTo(s(-9), s(-24));
  cloth.close();
  return { body, shade, plume, visor, trim, cloth };
}

const ALCH_S = 1.75;

/** Simyacı (sağa bakar): kırmızı palto, beyaz eldiven, sarı örgü. clap 0→1 eller göğüs önünde
 *  birleşir; down 0→1 diz çöker, avuçlar önde yere iner. Ayak tabanı (0,0). */
function alchPaths(clap, down, t, k) {
  "worklet";
  const s = (v) => v * k * ALCH_S;
  const legs = Skia.Path.Make();
  const coat = Skia.Path.Make();
  const arms = Skia.Path.Make();
  const hair = Skia.Path.Make();
  const hipX = down * 2;
  const hipY = -24 + down * 10;
  const shX = hipX + 1 + down * 7;
  const shY = hipY - 20 + down * 3;
  // bacaklar: arkadaki diz yere iner, öndeki öne basar
  legs.moveTo(s(hipX - 1), s(hipY));
  legs.lineTo(s(hipX - 3 - down * 6), s(-12 + down * 11));
  legs.lineTo(s(-5 - down * 8), s(0));
  legs.moveTo(s(hipX + 1), s(hipY));
  legs.lineTo(s(hipX + 4 + down * 6), s(-12 + down * 2));
  legs.lineTo(s(4 + down * 6), s(0));
  // palto: omuz → bel → arkada iki kuyruk (rüzgârda)
  const sway = Math.sin(t * 1.7) * 1.6;
  coat.moveTo(s(shX - 5), s(shY - 1));
  coat.lineTo(s(shX + 5), s(shY - 1));
  coat.lineTo(s(hipX + 5), s(hipY + 1));
  coat.lineTo(s(hipX + 7), s(hipY + 13 - down * 4));
  coat.lineTo(s(hipX + 1), s(hipY + 11 - down * 4));
  coat.lineTo(s(hipX - 4 - sway), s(hipY + 15 - down * 3));
  coat.lineTo(s(hipX - 10 - sway * 1.5 - down * 3), s(hipY + 13 - down * 2));
  coat.lineTo(s(hipX - 6), s(hipY));
  coat.close();
  // yaka
  coat.moveTo(s(shX - 5), s(shY - 1));
  coat.lineTo(s(shX - 3), s(shY - 5));
  coat.lineTo(s(shX + 1), s(shY - 1));
  coat.close();
  // kollar: dinlenme (yanda) → çırpma (göğüs önü) → yer (önde)
  const g = Math.max(clap, down);
  const handRest = [[shX - 3, shY + 17], [shX + 4, shY + 17]];
  const handClap = [[shX + 9, shY + 5], [shX + 9.6, shY + 5]];
  const handDown = [[shX + 13, -1], [shX + 18, -1]];
  const hands = [];
  for (let i = 0; i < 2; i += 1) {
    const tgt = down > clap ? handDown[i] : handClap[i];
    const hx = handRest[i][0] + (tgt[0] - handRest[i][0]) * g;
    const hy = handRest[i][1] + (tgt[1] - handRest[i][1]) * g;
    const sx = shX + (i ? 2 : -2);
    const sy = shY + 1;
    // dirsek: dışarı ve aşağı
    const ex = (sx + hx) / 2 - 2 + g * 1;
    const ey = (sy + hy) / 2 + 3 - g * 1;
    arms.moveTo(s(sx), s(sy));
    arms.lineTo(s(ex), s(ey));
    arms.lineTo(s(hx), s(hy));
    hands.push([s(hx), s(hy)]);
  }
  // baş + örgü (arkaya)
  const hx = shX + 1;
  const hy = shY - 7;
  hair.addCircle(s(hx), s(hy), s(5.4));
  hair.moveTo(s(hx - 4), s(hy + 1));
  hair.quadTo(s(hx - 8 - sway * 0.4), s(hy + 8), s(hx - 7 - sway), s(hy + 15));
  hair.lineTo(s(hx - 5 - sway), s(hy + 15));
  hair.quadTo(s(hx - 5.5), s(hy + 8), s(hx - 2), s(hy + 2));
  hair.close();
  hair.moveTo(s(hx + 1), s(hy - 5));
  hair.lineTo(s(hx + 3), s(hy - 11));
  hair.lineTo(s(hx + 3.6), s(hy - 4));
  hair.close();
  return { legs, coat, arms, hair, h0x: hands[0][0], h0y: hands[0][1], h1x: hands[1][0], h1y: hands[1][1], fx: s(hx + 3.2), fy: s(hy + 1.6) };
}

// ───────────────────────────── olay

function eventState(u) {
  "worklet";
  if (u > 1) return { clap: 0, down: 0, glow: 0, rise: 0, crumble: 0, draw: 1 };
  const clap = sm(0.08, 0.12, u) * (1 - sm(0.15, 0.18, u));
  const down = sm(0.16, 0.2, u) * (1 - sm(0.56, 0.62, u));
  const glow = sm(0.19, 0.24, u) * (1 - sm(0.5, 0.6, u));
  const rise = sm(0.24, 0.4, u);
  const crumble = sm(0.66, 0.82, u);
  return { clap, down, glow, rise, crumble, draw: 1 };
}

function pillarPaths(st, L) {
  "worklet";
  const { k } = L;
  const [cx, cy] = L.ring;
  const lit = Skia.Path.Make();
  const shade = Skia.Path.Make();
  if (st.rise <= 0 || st.crumble >= 1) return { lit, shade };
  const H = 170 * k * st.rise;
  const blocks = 7;
  for (let i = 0; i < blocks; i += 1) {
    const f = i / blocks;
    const bh = H / blocks;
    const w = (38 - f * 10) * k;
    let x = cx - w / 2;
    let y = cy - (i + 1) * bh;
    let a = 0;
    if (st.crumble > 0) {
      // üstten başlayarak parçalar düşer ve dağılır
      const g = Math.max(0, st.crumble * 1.6 - (blocks - 1 - i) * 0.08);
      x += (hash(i, 3) - 0.5) * 90 * k * g;
      y += (cy - y) * g * g;
      a = (hash(i, 4) - 0.5) * 2 * g;
    }
    const cs = Math.cos(a);
    const sn = Math.sin(a);
    const pt = (px, py) => [x + w / 2 + px * cs - py * sn, y + bh / 2 + px * sn + py * cs];
    const q = (path, x0, x1) => {
      const p0 = pt(x0, -bh / 2 + 1);
      const p1 = pt(x1, -bh / 2 + 1);
      const p2 = pt(x1, bh / 2);
      const p3 = pt(x0, bh / 2);
      path.moveTo(p0[0], p0[1]);
      path.lineTo(p1[0], p1[1]);
      path.lineTo(p2[0], p2[1]);
      path.lineTo(p3[0], p3[1]);
      path.close();
    };
    q(lit, -w / 2, w * 0.18);
    q(shade, w * 0.18, w / 2);
  }
  return { lit, shade };
}

/** Saniyede en çok 3 kısa şimşek (çemberin üstünde, yuva başına sabit konum). */
function arcPaths(t, glow, L) {
  "worklet";
  const q = Skia.Path.Make();
  if (glow < 0.2) return q;
  const [cx, cy, rx, ry] = L.ring;
  const slot = Math.floor(t * 3);
  const local = t * 3 - slot;
  if (local > 0.45) return q;
  const n = slot % 997;
  const a0 = hash(n, 11) * TAU;
  let x = cx + Math.cos(a0) * rx * 0.9;
  let y = cy + Math.sin(a0) * ry * 0.9;
  q.moveTo(x, y);
  for (let j = 0; j < 6; j += 1) {
    x += (hash(n * 7 + j, 12) - 0.5) * 22 * L.k;
    y -= (6 + hash(n * 7 + j, 13) * 9) * L.k;
    q.lineTo(x, y);
  }
  const a1 = hash(n, 14) * TAU;
  let x2 = cx + Math.cos(a1) * rx * 0.6;
  let y2 = cy + Math.sin(a1) * ry * 0.6;
  q.moveTo(x2, y2);
  for (let j = 0; j < 4; j += 1) {
    x2 += (hash(n * 5 + j, 15) - 0.5) * 26 * L.k;
    y2 -= (4 + hash(n * 5 + j, 16) * 7) * L.k;
    q.lineTo(x2, y2);
  }
  return q;
}

// ───────────────────────────── parçalar

function Ring({ p, clock, L, c }) {
  const { k } = L;
  const ring = useMemo(() => buildRing(L), [L]);
  const [cx, cy, rx] = L.ring;
  const st = useDerivedValue(() => eventState(eventU(p, clock.value, 0)));
  const glow = useDerivedValue(() => st.value.glow);
  const arcs = useDerivedValue(() => arcPaths(clock.value, st.value.glow, L));
  const sparks = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const g = st.value.glow;
    if (g <= 0) return q;
    const t = clock.value;
    for (let i = 0; i < 10; i += 1) {
      const f = (t * 0.6 + hash(i, 21)) % 1;
      const x = cx + (hash(i, 22) - 0.5) * rx * 1.6 + Math.sin(t * 2 + i) * 4 * k;
      const y = cy - f * 120 * k;
      const r = (1.4 + hash(i, 23) * 1.4) * k * (1 - f);
      q.moveTo(x, y - r * 2);
      q.lineTo(x + r, y);
      q.lineTo(x, y + r * 2);
      q.lineTo(x - r, y);
      q.close();
    }
    return q;
  });
  return (
    <Group>
      <Path path={ring} style="stroke" strokeWidth={1.3 * k} strokeCap="round" color={c.chalk} opacity={0.7} />
      <Group opacity={glow}>
        <Glow cx={cx} cy={cy} r={rx * 1.3} color={c.circleGlow} a={0.55} mid={0.4} />
        <Path path={ring} style="stroke" strokeWidth={4 * k} strokeCap="round" color={rgba(c.circleGlow, 0.5)} />
        <Path path={ring} style="stroke" strokeWidth={1.8 * k} strokeCap="round" color={c.circle} />
        <Path path={arcs} style="stroke" strokeWidth={3.4 * k} strokeJoin="round" color={rgba(c.circleGlow, 0.5)} />
        <Path path={arcs} style="stroke" strokeWidth={1.3 * k} strokeJoin="round" color={c.arc} />
        <Path path={sparks} color={c.redStone} />
      </Group>
    </Group>
  );
}

function Pillar({ p, clock, L, c }) {
  const { k } = L;
  const st = useDerivedValue(() => eventState(eventU(p, clock.value, 0)));
  const d = useDerivedValue(() => pillarPaths(st.value, L));
  const lit = useDerivedValue(() => d.value.lit);
  const shade = useDerivedValue(() => d.value.shade);
  const on = useDerivedValue(() => 1 - sm(0.7, 1, st.value.crumble));
  const dust = useDerivedValue(() => st.value.crumble * (1 - st.value.crumble) * 3);
  const [cx, cy] = L.ring;
  return (
    <Group>
      <Group opacity={on}>
        <Path path={lit} color={c.pillar} />
        <Path path={shade} color={c.pillarShade} />
        <Path path={lit} style="stroke" strokeWidth={0.7 * k} color={rgba(c.pillarShade, 0.8)} />
      </Group>
      <Group opacity={dust}>
        <Circle cx={cx - 30 * k} cy={cy - 10 * k} r={22 * k} color={rgba(c.pillar, 0.35)} />
        <Circle cx={cx + 26 * k} cy={cy - 16 * k} r={26 * k} color={rgba(c.pillar, 0.3)} />
        <Circle cx={cx} cy={cy - 30 * k} r={30 * k} color={rgba(c.pillar, 0.25)} />
      </Group>
    </Group>
  );
}

function Alchemist({ p, clock, L, c }) {
  const { k } = L;
  const [ax, ay] = L.alch;
  const st = useDerivedValue(() => eventState(eventU(p, clock.value, 0)));
  const d = useDerivedValue(() => alchPaths(st.value.clap, st.value.down, clock.value, k));
  const legs = useDerivedValue(() => d.value.legs);
  const coat = useDerivedValue(() => d.value.coat);
  const arms = useDerivedValue(() => d.value.arms);
  const hair = useDerivedValue(() => d.value.hair);
  const h0x = useDerivedValue(() => d.value.h0x);
  const h0y = useDerivedValue(() => d.value.h0y);
  const h1x = useDerivedValue(() => d.value.h1x);
  const h1y = useDerivedValue(() => d.value.h1y);
  const fx = useDerivedValue(() => d.value.fx);
  const fy = useDerivedValue(() => d.value.fy);
  // Glow, merkezini vec() ile DÜZ SAYI olarak ister (SharedValue verilirse iOS'ta "expected a number" çöker);
  // ışık orijinde çizilir, grup animasyonlu el konumuna kaydırılır.
  const h1At = useDerivedValue(() => [{ translateX: d.value.h1x }, { translateY: d.value.h1y }]);
  const clapFlash = useDerivedValue(() => {
    const u = eventU(p, clock.value, 0);
    return u > 1 ? 0 : sm(0.11, 0.12, u) * (1 - sm(0.12, 0.15, u));
  });
  const hr = 2.2 * k * ALCH_S;
  return (
    <Group transform={[{ translateX: ax }, { translateY: ay }]}>
      <Path path={legs} style="stroke" strokeWidth={4.4 * k * ALCH_S} strokeCap="round" strokeJoin="round" color={c.street} />
      <Path path={coat} color={c.coat} />
      <Path path={coat} style="stroke" strokeWidth={0.8 * k} strokeJoin="round" color={rgba(c.brickShade, 0.8)} />
      <Path path={hair} color={c.sun} />
      <Circle cx={fx} cy={fy} r={2.6 * k * ALCH_S} color={c.clockFace} />
      <Path path={arms} style="stroke" strokeWidth={4.6 * k * ALCH_S} strokeCap="round" strokeJoin="round" color={c.brickShade} />
      <Path path={arms} style="stroke" strokeWidth={3.4 * k * ALCH_S} strokeCap="round" strokeJoin="round" color={c.coat} />
      <Circle cx={h0x} cy={h0y} r={hr} color={c.chalk} />
      <Circle cx={h1x} cy={h1y} r={hr} color={c.chalk} />
      <Group opacity={clapFlash} transform={h1At}>
        <Glow r={22 * k} color={c.circleGlow} a={0.9} mid={0.3} />
      </Group>
    </Group>
  );
}

function Armor({ L, c, clock }) {
  const { k } = L;
  const [x, y] = L.armor;
  const geo = useMemo(() => buildArmor(L), [L]);
  const eyes = useDerivedValue(() => 0.6 + 0.4 * Math.sin(clock.value * 0.9));
  const s = k * 1.05;
  return (
    <Group transform={[{ translateX: x }, { translateY: y }]}>
      <Path path={geo.plume} color={c.chain} />
      <Path path={geo.body} color={c.armor} />
      <Path path={geo.shade} color={c.armorShade} />
      <Path path={geo.cloth} color={c.coat} opacity={0.8} />
      <Path path={geo.trim} color={c.armorShade} />
      <Path path={geo.visor} color={c.street} />
      <Group opacity={eyes}>
        <Circle cx={-4 * s} cy={-127.5 * s} r={1.4 * s} color={c.window} />
        <Circle cx={4 * s} cy={-127.5 * s} r={1.4 * s} color={c.window} />
      </Group>
    </Group>
  );
}

/** Tepeden sarkan zincirli cep saati (sarkaç). */
function PocketWatch({ clock, L, c }) {
  const { k } = L;
  const [wx, wy, len] = L.watch;
  const r = 22 * k;
  const chain = useMemo(() => {
    const q = Skia.Path.Make();
    const n = Math.floor(len / (5 * k));
    for (let i = 0; i < n; i += 1) {
      const y = i * 5 * k;
      if (i % 2) q.addOval(Skia.XYWHRect(-1 * k, y, 2 * k, 6 * k));
      else q.addOval(Skia.XYWHRect(-2.2 * k, y, 4.4 * k, 6 * k));
    }
    return q;
  }, [len, k]);
  const ticks = useMemo(() => {
    const q = Skia.Path.Make();
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * TAU;
      q.moveTo(Math.cos(a) * r * 0.72, len + r + Math.sin(a) * r * 0.72);
      q.lineTo(Math.cos(a) * r * (i % 3 ? 0.66 : 0.58), len + r + Math.sin(a) * r * (i % 3 ? 0.66 : 0.58));
    }
    return q;
  }, [r, len]);
  const swing = useDerivedValue(() => [{ translateX: wx }, { translateY: wy }, { rotate: Math.sin(clock.value * 1.3) * 0.22 }]);
  const hands = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const t = clock.value;
    const cy = len + r;
    const a1 = (t / 60) * TAU - Math.PI / 2;
    const a2 = (t / 3600) * TAU - Math.PI / 2;
    q.moveTo(0, cy);
    q.lineTo(Math.cos(a1) * r * 0.6, cy + Math.sin(a1) * r * 0.6);
    q.moveTo(0, cy);
    q.lineTo(Math.cos(a2) * r * 0.42, cy + Math.sin(a2) * r * 0.42);
    return q;
  });
  const glint = useDerivedValue(() => 0.3 + 0.7 * Math.max(0, Math.sin(clock.value * 1.3 + 1)));
  return (
    <Group transform={swing}>
      <Path path={chain} style="stroke" strokeWidth={1.1 * k} color={c.chain} />
      <Rect x={-3 * k} y={len - 6 * k} width={6 * k} height={7 * k} color={c.chain} />
      <Circle cx={0} cy={len - 6 * k} r={3.4 * k} style="stroke" strokeWidth={1.6 * k} color={c.chain} />
      <Circle cx={0} cy={len + r} r={r}>
        <LinearGradient start={vec(-r, len)} end={vec(r, len + 2 * r)} colors={[c.watch, c.chain, c.armorShade]} />
      </Circle>
      <Circle cx={0} cy={len + r} r={r * 0.82} color={c.clockFace} />
      <Path path={ticks} style="stroke" strokeWidth={1 * k} color={c.armorShade} />
      <Path path={hands} style="stroke" strokeWidth={1.3 * k} strokeCap="round" color={c.street} />
      <Circle cx={0} cy={len + r} r={1.6 * k} color={c.redStone} />
      <Group opacity={glint}>
        <Path
          path={`M ${-r * 0.55} ${len + r * 0.55} Q ${-r * 0.35} ${len + r * 0.2} ${r * 0.05} ${len + r * 0.22}`}
          style="stroke"
          strokeWidth={2 * k}
          strokeCap="round"
          color={rgba(c.clockFace, 0.9)}
        />
      </Group>
    </Group>
  );
}

function ClockHands({ clock, L, c }) {
  const { k } = L;
  const [cx, cy] = L.clock;
  const r = 22 * k;
  const hands = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const t = clock.value;
    const a1 = (t / 3600) * TAU - Math.PI / 2;
    const a2 = (t / 43200) * TAU - Math.PI / 2;
    q.moveTo(cx, cy + 22 * k);
    q.lineTo(cx + Math.cos(a1) * r * 0.8, cy + 22 * k + Math.sin(a1) * r * 0.8);
    q.moveTo(cx, cy + 22 * k);
    q.lineTo(cx + Math.cos(a2) * r * 0.5, cy + 22 * k + Math.sin(a2) * r * 0.5);
    return q;
  });
  return (
    <Group>
      <Circle cx={cx} cy={cy + 22 * k} r={r + 3 * k} color={c.stone} />
      <Circle cx={cx} cy={cy + 22 * k} r={r} color={c.clockFace} />
      <Path path={hands} style="stroke" strokeWidth={1.8 * k} strokeCap="round" color={c.street} />
    </Group>
  );
}

// ───────────────────────────── olay B: yerden yükselen dev taş kapı

function Gate({ p, clock, L, c }) {
  const { k, width } = L;
  const [gx, gy, rw] = L.ring;
  const W = 62 * k;
  const H = 190 * k;
  const st = useMemo(() => {
    const frame = Skia.Path.Make();
    frame.addRect(Skia.XYWHRect(-W - 10 * k, -H - 14 * k, W * 2 + 20 * k, 14 * k));
    frame.addRect(Skia.XYWHRect(-W - 10 * k, -H, 10 * k, H));
    frame.addRect(Skia.XYWHRect(W, -H, 10 * k, H));
    frame.moveTo(-W - 16 * k, -H - 14 * k);
    frame.lineTo(0, -H - 40 * k);
    frame.lineTo(W + 16 * k, -H - 14 * k);
    frame.close();
    const leaf = Skia.Path.Make();
    leaf.addRect(Skia.XYWHRect(0, -H, W, H));
    const carve = Skia.Path.Make();
    for (let i = 0; i < 6; i += 1) {
      const y = -H + (14 + i * 30) * k;
      carve.addRect(Skia.XYWHRect(8 * k, y, W - 16 * k, 1.4 * k));
      for (let j = 0; j < 3; j += 1) carve.addCircle(14 * k + j * ((W - 28 * k) / 2), y + 13 * k, (2.4 + hash(i, j + 160) * 3) * k);
    }
    const inside = Skia.Path.Make();
    inside.addRect(Skia.XYWHRect(-W, -H, W * 2, H));
    const eye = Skia.Path.Make();
    eye.moveTo(-22 * k, -H * 0.6);
    eye.quadTo(0, -H * 0.6 - 16 * k, 22 * k, -H * 0.6);
    eye.quadTo(0, -H * 0.6 + 16 * k, -22 * k, -H * 0.6);
    eye.close();
    return { frame, leaf, carve, inside, eye };
  }, [W, H, k]);
  const rise = useDerivedValue(() => {
    const u = eventU(p, clock.value, 1);
    return u > 1 ? 0 : sm(0.12, 0.32, u) * (1 - sm(0.82, 0.97, u));
  });
  const open = useDerivedValue(() => {
    const u = eventU(p, clock.value, 1);
    return u > 1 ? 0 : sm(0.36, 0.52, u) * (1 - sm(0.68, 0.8, u));
  });
  const glow = useDerivedValue(() => {
    const u = eventU(p, clock.value, 1);
    return u > 1 ? 0 : sm(0.02, 0.12, u) * (1 - sm(0.9, 0.99, u));
  });
  const clip = useMemo(() => Skia.XYWHRect(-10, -10, width + 20, gy + 10), [width, gy]);
  const at = useDerivedValue(() => [{ translateX: gx }, { translateY: gy + (1 - rise.value) * (H + 50 * k) }]);
  const leftT = useDerivedValue(() => [{ translateX: -W }, { scaleX: Math.max(0.06, 1 - open.value * 0.9) }]);
  const rightT = useDerivedValue(() => [{ translateX: W }, { scaleX: -Math.max(0.06, 1 - open.value * 0.9) }]);
  const arms = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const o = open.value;
    if (o < 0.05) return q;
    for (let i = 0; i < 7; i += 1) {
      const side = i % 2 ? 1 : -1;
      const y0 = -H * (0.15 + hash(i, 171) * 0.7);
      const len = (40 + hash(i, 172) * 70) * k * o;
      const w = Math.sin(clock.value * 2.4 + i * 1.7) * 10 * k;
      q.moveTo(side * W * 0.5, y0);
      q.quadTo(side * (W * 0.5 + len * 0.5), y0 + w, side * (W * 0.5 + len), y0 + w * 0.4 + 12 * k);
    }
    return q;
  });
  const eyeA = useDerivedValue(() => open.value);
  const ring = useMemo(() => {
    const q = Skia.Path.Make();
    q.addOval(Skia.XYWHRect(gx - rw, gy - L.ring[3], rw * 2, L.ring[3] * 2));
    return q;
  }, [gx, gy, rw, L.ring]);
  return (
    <Group>
      <Group opacity={glow}>
        <Group transform={[{ translateX: gx }, { translateY: gy }, { scaleY: 0.3 }]}>
          <Glow r={rw * 1.6} color={c.redStone} a={0.6} mid={0.35} />
        </Group>
        <Path path={ring} style="stroke" strokeWidth={2.4 * k} color={c.redStone} />
      </Group>
      <Group clip={clip}>
        <Group transform={at}>
          <Path path={st.inside} color={c.street} />
          <Group opacity={eyeA}>
            <Path path={st.eye} color={c.chalk} />
            <Circle cx={0} cy={-H * 0.6} r={7 * k} color={c.street} />
            <Path path={arms} style="stroke" strokeWidth={3.2 * k} strokeCap="round" color={c.street} />
          </Group>
          <Group transform={leftT}>
            <Path path={st.leaf} color={c.pillar} />
            <Path path={st.carve} color={c.pillarShade} />
          </Group>
          <Group transform={rightT}>
            <Path path={st.leaf} color={c.pillar} />
            <Path path={st.carve} color={c.pillarShade} />
          </Group>
          <Path path={st.frame} color={c.pillarShade} />
        </Group>
      </Group>
    </Group>
  );
}

export default function FmaScene({ p, clock, width, height, tone, lightSurface }) {
  const night = !lightSurface;
  const L = useMemo(() => fmaLayout(width, height), [width, height]);
  const town = useMemo(() => buildTown(L), [L]);
  const c = useMemo(() => toneMap(FM_TONE, tone.colors), [tone]);
  const { k, ground, street } = L;
  const winO = useDerivedValue(() => (night ? 0.82 + 0.18 * Math.sin(clock.value * 0.6) : 0.5));
  const sun = night ? [width * 0.3, height * 0.16, 30 * k] : [width * 0.24, height * 0.12, 30 * k];
  return (
    <Group opacity={tone.alpha}>
      <Rect x={0} y={0} width={width} height={ground}>
        <LinearGradient start={vec(0, 0)} end={vec(0, street)} colors={[c.skyTop, c.skyLow]} />
      </Rect>
      <Glow cx={sun[0]} cy={sun[1]} r={sun[2] * 5} color={c.sun} a={night ? 0.35 : 0.5} mid={0.3} />
      <Circle cx={sun[0]} cy={sun[1]} r={sun[2]} color={c.sun} opacity={night ? 0.85 : 1} />
      <Path path={town.far} color={c.cityFar} />
      <Path path={town.tower} color={c.stone} />
      <Path path={town.towerShade} color={rgba(c.brickShade, 0.45)} />
      <Group opacity={winO}>
        <Path path={town.towerWin} color={c.window} />
      </Group>
      <ClockHands clock={clock} L={L} c={c} />
      <Rect x={0} y={street} width={width} height={height - street + 10}>
        <LinearGradient start={vec(0, street)} end={vec(0, ground)} colors={[c.cobble, c.street]} />
      </Rect>
      <Path path={town.cobble} style="stroke" strokeWidth={0.8 * k} color={rgba(c.street, 0.55)} />
      <Path path={town.bricks} color={c.brick} />
      <Path path={town.mortar} style="stroke" strokeWidth={0.6 * k} color={rgba(c.brickShade, 0.7)} />
      <Path path={town.shades} color={c.brickShade} />
      <Group opacity={winO}>
        <Path path={town.wins} color={c.window} />
      </Group>
      <Path path={town.roofs} color={c.roof} />
      <Ring p={p} clock={clock} L={L} c={c} />
      <Pillar p={p} clock={clock} L={L} c={c} />
      <Gate p={p} clock={clock} L={L} c={c} />
      <Alchemist p={p} clock={clock} L={L} c={c} />
      <Armor L={L} c={c} clock={clock} />
      <PocketWatch clock={clock} L={L} c={c} />
    </Group>
  );
}
