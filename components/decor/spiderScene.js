// components/decor/spiderScene.js
//
// Spider-Man atmosfer sahnesi (OVERLAY.skyline = 20) — tamamı VEKTÖR:
//   • Gece şehri: dev dolunay, üç kat gökdelen (uzak kademeli kuleler + sivri tepeli art-deco kule,
//     orta kat korniş + küçük su kuleleri, yakın çatılar), rastgele yanan pencere ızgaraları,
//     anten tepesinde yanıp sönen kırmızı ışıklar, ufukta şehir ışıması; sağ çatıda ahşap su kulesi
//     (çıtalar, demir kuşaklar, bacaklar + çaprazlar, merdiven); en altta sokak ve fenerler.
//   • Olay (spiderFrame, 30 sn): örümcek adam soldan ağ atıp sarkaç gibi salınır → bırakır, havada
//     takla → ikinci ağ, ikinci salınım → taklayla su kulesinin tepesine konar, klasik çömelme →
//     etrafı kollar (aşağıda polis ışıkları) → yukarıya ağ atar ve hızla çekilip ekrandan çıkar.
//   • Figür eklemli: gövde + baş + iki kol (üst kol/ön kol) + iki bacak (uyluk/baldır); pozlar
//     arasında açı karışımı. Kırmızı/mavi kostüm, ağ çizgileri, göğüste örümcek, beyaz göz camları.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift (sekme çubuğu). Renkler OVERLAY_TONES[20] (SPIDER_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Circle, Group, LinearGradient, Path, RadialGradient, Skia, vec } from "@shopify/react-native-skia";
import { sceneScale, spiderFrame } from "../../utils/weatherParticles";
import { SCENERY } from "../../utils/weatherUniverses";
import { WEB_RINGS, WEB_SPOKES } from "./universeSprites";

const SPIDER_TONE = ["far", "mid", "near", "window", "red", "blue", "web", "moon", "glow", "roof", "wood", "metal", "night"];
const toneMap = (colors) => Object.fromEntries(SPIDER_TONE.map((name, i) => [name, colors[i] || colors[0]]));

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

// ── Figür ölçüleri (yerel birim; kalça 0,0, yüz +x) ──────────────────────────
const SH = [0.4, -12.6]; // omuz
const UA = 6.4; // üst kol
const FA = 6.1; // ön kol
const TH = 7.6; // uyluk
const SN = 7.6; // baldır
const HAND_UP = SH[1] - UA - FA; // kol dik yukarıdayken el yüksekliği

// Pozlar: [boyun, arka omuz, arka dirsek, ön omuz, ön dirsek, arka kalça, arka diz, ön kalça, ön diz]
// Açı: aşağı (0) → pozitif saat yönü (yüzü sağa bakan figür için GERİ), negatif İLERİ.
const P_SWING = [-0.2, 0.95, 0.35, Math.PI, 0, 0.2, 1.15, -0.6, 1.55];
const P_FLIP = [0.35, -1.0, -1.7, -0.7, -1.9, -2.05, 2.45, -2.25, 2.55];
const CROUCH_R = 1.0;
const P_CROUCH = [-0.85, -0.7, -0.35, -1.15, 0.3, -1.9, 1.3, -2.35, 1.6];
const P_AIM = [-1.1, -0.7, -0.35, 2.75, 0.05, -1.9, 1.3, -2.35, 1.6];
const P_ZIP = [-0.1, 2.9, 0.1, Math.PI, 0, 0.12, 0.25, -0.18, 0.35];

function mixPose(a, b, t) {
  "worklet";
  const o = [];
  for (let i = 0; i < a.length; i += 1) o.push(a[i] + (b[i] - a[i]) * t);
  return o;
}

function rot(x, y, r) {
  "worklet";
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [x * c - y * s, x * s + y * c];
}

/** Sahne yerleşimi (dp). */
export function spiderLayout(width, height) {
  const k = sceneScale(width, height);
  const ground = height - SCENERY.lift * k;
  const s = 1.5 * k;
  // yakın çatılar
  const leftRoof = { x0: -10, x1: width * 0.34, y: ground - 100 * k };
  const rightRoof = { x0: width * 0.6, x1: width + 10, y: ground - 118 * k };
  // su kulesi (sağ çatı)
  const tank = { cx: width * 0.8, legs: 22 * k, h: 36 * k, w: 38 * k };
  tank.base = rightRoof.y - tank.legs;
  tank.top = tank.base - tank.h;
  const T = [tank.cx - 3 * k, tank.top - 6 * k]; // konma noktası (ayak)
  // sarkaç salınımları
  const l = 100 * k;
  const ay = ground - 330 * k;
  const s1x = -20 * k;
  const g1 = 36 * k;
  const g2 = 46 * k;
  const sinM = Math.min(0.85, Math.max(0.35, (T[0] - s1x - g1 - g2) / (4 * l)));
  const thM = Math.asin(sinM);
  const A1 = [s1x + l * sinM, ay];
  const A2 = [A1[0] + 2 * l * sinM + g1, ay];
  // çömelme kalçası: ön ayak T'de
  const leg = (a, len) => [-Math.sin(a) * len * s, Math.cos(a) * len * s];
  const t1 = leg(-1.35, TH);
  const t2 = leg(0.25, SN);
  const crouchHip = [T[0] - t1[0] - t2[0], T[1] - t1[1] - t2[1]];
  const Z = [width * 0.36, -60 * k];
  return {
    k, s, ground, leftRoof, rightRoof, tank, T, l, thM, A1, A2, crouchHip, Z,
    moon: { x: width * 0.66, y: height * 0.2, r: 50 * k },
  };
}

// Sarkaç: el konumu ve kök dönüşü (worklet)
function swingAt(L, A, tau) {
  "worklet";
  const ph = -L.thM * Math.cos(Math.PI * tau);
  const hx = A[0] + L.l * Math.sin(ph);
  const hy = A[1] + L.l * Math.cos(ph);
  const r = -ph;
  const o = rot(SH[0] * L.s, HAND_UP * L.s, r);
  return { hx, hy, x: hx - o[0], y: hy - o[1], r };
}

/** Figür durumu (worklet): kalça x,y, kök dönüşü r, yön, poz, ağ ipi. */
function spideyState(L, q, clock) {
  "worklet";
  const hide = { x: -9999, y: 0, r: 0, face: 1, pose: P_SWING, o: 0, line: 0, lx: 0, ly: 0, ax: 0, ay: 0 };
  if (q.u > 1) return hide;
  const lineTo = (st, A, tau) => {
    const g = tau * 9 > 1 ? 1 : tau * 9;
    return { line: 1, lx: st.hx, ly: st.hy, ax: st.hx + (A[0] - st.hx) * g, ay: st.hy + (A[1] - st.hy) * g };
  };
  if (q.s1 >= 0) {
    const st = swingAt(L, L.A1, q.s1);
    return { x: st.x, y: st.y, r: st.r, face: 1, pose: P_SWING, o: 1, ...lineTo(st, L.A1, q.s1) };
  }
  if (q.s2 >= 0) {
    const st = swingAt(L, L.A2, q.s2);
    return { x: st.x, y: st.y, r: st.r, face: 1, pose: P_SWING, o: 1, ...lineTo(st, L.A2, q.s2) };
  }
  if (q.f1 >= 0 || q.f2 >= 0) {
    const first = q.f1 >= 0;
    const t = first ? q.f1 : q.f2;
    const a = swingAt(L, first ? L.A1 : L.A2, 1);
    const b = first ? swingAt(L, L.A2, 0) : { x: L.crouchHip[0], y: L.crouchHip[1], r: CROUCH_R };
    const e = t * t * (3 - 2 * t);
    const hump = (first ? 46 : 64) * L.k * Math.sin(Math.PI * t);
    const tuck = Math.sin(Math.PI * Math.min(1, t * 1.15));
    const end = first ? P_SWING : P_CROUCH;
    const pose = t < 0.5 ? mixPose(P_SWING, P_FLIP, tuck) : mixPose(end, P_FLIP, tuck);
    return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e - hump, r: a.r + (b.r + 2 * Math.PI - a.r) * e, face: 1, pose, o: 1, line: 0, lx: 0, ly: 0, ax: 0, ay: 0 };
  }
  if (q.perch > 0 && q.zip < 0) {
    // konma çöküşü + bakınma; ağ atma hazırlığı
    const sq = q.land * 3.2 * L.k;
    let pose = P_CROUCH;
    if (q.zipLine > 0) pose = mixPose(P_CROUCH, P_AIM, Math.min(1, q.zipLine * 2));
    const face = q.look;
    const breathe = Math.sin(clock.value * 1.7) * 0.4 * L.k;
    const st = { x: L.crouchHip[0], y: L.crouchHip[1] + sq + breathe, r: CROUCH_R, face, pose, o: 1, line: 0, lx: 0, ly: 0, ax: 0, ay: 0 };
    if (q.zipLine > 0) {
      const sh = rot(SH[0] * L.s, SH[1] * L.s, CROUCH_R);
      const sx = st.x + sh[0];
      const sy = st.y + sh[1];
      const d = rot(0, (UA + FA) * L.s, CROUCH_R + P_AIM[3]);
      const hx = sx + d[0];
      const hy = sy + d[1];
      const g = Math.min(1, Math.max(0, (q.zipLine - 0.3) / 0.7));
      return { ...st, line: g > 0 ? 1 : 0, lx: hx, ly: hy, ax: hx + (L.Z[0] - hx) * g, ay: hy + (L.Z[1] - hy) * g };
    }
    return st;
  }
  if (q.zip >= 0) {
    const t = q.zip;
    const e = t * t * t;
    const x0 = L.crouchHip[0];
    const y0 = L.crouchHip[1];
    const dx = L.Z[0] - x0;
    const dy = L.Z[1] - y0;
    const r1 = Math.atan2(dx, -dy);
    const r = CROUCH_R + (r1 - CROUCH_R) * Math.min(1, t * 4);
    const pose = mixPose(P_AIM, P_ZIP, Math.min(1, t * 3));
    const x = x0 + dx * 1.15 * e;
    const y = y0 + dy * 1.15 * e;
    const o = rot(SH[0] * L.s, HAND_UP * L.s, r);
    return { x, y, r, face: 1, pose, o: 1, line: 1, lx: x + o[0], ly: y + o[1], ax: L.Z[0], ay: L.Z[1] };
  }
  return hide;
}

// ── Şehir geometrisi ─────────────────────────────────────────────────────────
function buildCity(L, width) {
  const { k, ground } = L;
  const far = Skia.Path.Make();
  const farLit = Skia.Path.Make();
  const farWin = Skia.Path.Make();
  const ants = [];
  // uzak kuleler: çapalar (A1, A2) üstünden geçen kuleler en az 350k
  let x = -12;
  let i = 0;
  while (x < width + 12) {
    const w = (24 + hash(i, 1) * 30) * k;
    const cx = x + w / 2;
    let h = (170 + hash(i, 2) * 150) * k;
    const anchor = (L.A1[0] > x && L.A1[0] < x + w) || (L.A2[0] > x && L.A2[0] < x + w);
    if (anchor) h = Math.max(h, 352 * k);
    const top = ground - h;
    const kind = anchor ? (L.A2[0] > x && L.A2[0] < x + w ? "deco" : "step") : hash(i, 3) < 0.4 ? "step" : hash(i, 3) < 0.6 ? "needle" : "flat";
    far.moveTo(x, ground);
    if (kind === "step" || kind === "deco") {
      const s1 = top + 40 * k;
      far.lineTo(x, s1);
      far.lineTo(x + w * 0.12, s1);
      far.lineTo(x + w * 0.12, top + 18 * k);
      far.lineTo(x + w * 0.24, top + 18 * k);
      far.lineTo(x + w * 0.24, top);
      far.lineTo(x + w * 0.76, top);
      far.lineTo(x + w * 0.76, top + 18 * k);
      far.lineTo(x + w * 0.88, top + 18 * k);
      far.lineTo(x + w * 0.88, s1);
      far.lineTo(x + w, s1);
      if (kind === "deco") {
        // art-deco taç + sivri tepe (uzak kule; çapa için yan cephe yüksek kalır)
        far.moveTo(x + w * 0.3, top);
        far.lineTo(x + w * 0.36, top - 16 * k);
        far.lineTo(x + w * 0.42, top - 16 * k);
        far.lineTo(x + w * 0.46, top - 34 * k);
        far.lineTo(cx, top - 70 * k);
        far.lineTo(x + w * 0.54, top - 34 * k);
        far.lineTo(x + w * 0.58, top - 16 * k);
        far.lineTo(x + w * 0.64, top - 16 * k);
        far.lineTo(x + w * 0.7, top);
        far.close();
        far.moveTo(x + w, s1);
        for (const yy of [top - 16 * k, top - 30 * k, top - 44 * k]) {
          farLit.moveTo(cx - 3 * k, yy);
          farLit.lineTo(cx + 3 * k, yy - 6 * k);
        }
        ants.push([cx, top - 70 * k]);
      }
    } else if (kind === "needle") {
      far.lineTo(x, top);
      far.lineTo(x + w, top);
      ants.push([cx, top - 34 * k]);
      far.moveTo(cx - 1 * k, top);
      far.lineTo(cx, top - 34 * k);
      far.lineTo(cx + 1 * k, top);
      far.close();
      far.moveTo(x + w, top);
    } else {
      far.lineTo(x, top);
      far.lineTo(x + w, top);
    }
    far.lineTo(x + w, ground);
    far.close();
    // pencere ızgarası
    for (let yy = top + 10 * k; yy < ground - 8 * k; yy += 7 * k) {
      for (let xx = x + 3 * k; xx < x + w - 4 * k; xx += 5 * k) {
        if (hash(xx * 0.31 + i, yy * 0.17) < 0.16) farWin.addRect(Skia.XYWHRect(xx, yy, 2.2 * k, 3 * k));
      }
    }
    // gölge yarısı yerine ışıklı kenar şeridi
    farLit.addRect(Skia.XYWHRect(x + w - 2.2 * k, top + 2 * k, 2.2 * k, ground - top - 2 * k));
    x += w + (hash(i, 4) < 0.3 ? 4 * k : 0);
    i += 1;
  }
  // orta kat: korniş ve küçük su kuleleri
  const mid = Skia.Path.Make();
  const midWin = Skia.Path.Make();
  const midEdge = Skia.Path.Make();
  x = -8;
  i = 0;
  while (x < width + 8) {
    const w = (40 + hash(i, 6) * 46) * k;
    const h = (128 + hash(i, 7) * 80) * k;
    const top = ground - h;
    mid.addRect(Skia.XYWHRect(x, top, w, h + 2));
    mid.addRect(Skia.XYWHRect(x - 2 * k, top - 3 * k, w + 4 * k, 4 * k)); // korniş
    midEdge.moveTo(x - 2 * k, top - 3 * k);
    midEdge.lineTo(x + w + 2 * k, top - 3 * k);
    if (hash(i, 8) < 0.55) {
      const tx = x + w * (0.25 + hash(i, 9) * 0.5);
      mid.addRect(Skia.XYWHRect(tx - 6 * k, top - 22 * k, 12 * k, 11 * k));
      mid.moveTo(tx - 7 * k, top - 22 * k);
      mid.lineTo(tx, top - 28 * k);
      mid.lineTo(tx + 7 * k, top - 22 * k);
      mid.close();
      mid.addRect(Skia.XYWHRect(tx - 5 * k, top - 11 * k, 1.4 * k, 8 * k));
      mid.addRect(Skia.XYWHRect(tx + 3.6 * k, top - 11 * k, 1.4 * k, 8 * k));
    }
    for (let yy = top + 8 * k; yy < ground - 6 * k; yy += 9 * k) {
      for (let xx = x + 4 * k; xx < x + w - 6 * k; xx += 7 * k) {
        if (hash(xx * 0.7 + i * 3, yy * 0.11) < 0.24) midWin.addRect(Skia.XYWHRect(xx, yy, 3.4 * k, 4.4 * k));
      }
    }
    x += w + (hash(i, 10) < 0.5 ? 10 * k : 0);
    i += 1;
  }
  // yakın çatılar
  const near = Skia.Path.Make();
  const nearEdge = Skia.Path.Make();
  const nearWin = Skia.Path.Make();
  const props = Skia.Path.Make();
  for (const R of [L.leftRoof, L.rightRoof]) {
    near.addRect(Skia.XYWHRect(R.x0, R.y, R.x1 - R.x0, ground - R.y + 2));
    near.addRect(Skia.XYWHRect(R.x0, R.y - 6 * k, R.x1 - R.x0, 6 * k)); // korkuluk duvarı
    nearEdge.moveTo(R.x0, R.y - 6 * k);
    nearEdge.lineTo(R.x1, R.y - 6 * k);
    for (let yy = R.y + 12 * k; yy < ground - 8 * k; yy += 16 * k) {
      for (let xx = R.x0 + 8 * k; xx < R.x1 - 10 * k; xx += 15 * k) {
        if (hash(xx * 0.13, yy * 0.29) < 0.35) nearWin.addRect(Skia.XYWHRect(xx, yy, 6 * k, 8 * k));
      }
    }
  }
  // sol çatı: merdiven kulübesi, klima kutuları, baca
  const lr = L.leftRoof;
  props.addRect(Skia.XYWHRect(lr.x1 - 54 * k, lr.y - 30 * k, 26 * k, 24 * k));
  props.addRect(Skia.XYWHRect(lr.x0 + 30 * k, lr.y - 16 * k, 18 * k, 10 * k));
  props.addRect(Skia.XYWHRect(lr.x0 + 52 * k, lr.y - 14 * k, 14 * k, 8 * k));
  props.addRect(Skia.XYWHRect(lr.x0 + 14 * k, lr.y - 28 * k, 6 * k, 22 * k));
  const door = Skia.Path.Make();
  door.addRect(Skia.XYWHRect(lr.x1 - 46 * k, lr.y - 22 * k, 8 * k, 16 * k));
  // yangın merdiveni (sağ binanın sol cephesi)
  const esc = Skia.Path.Make();
  const rr = L.rightRoof;
  for (let yy = rr.y + 18 * k; yy < ground - 10 * k; yy += 24 * k) {
    esc.moveTo(rr.x0 - 10 * k, yy);
    esc.lineTo(rr.x0 + 26 * k, yy);
    esc.moveTo(rr.x0 - 10 * k, yy - 7 * k);
    esc.lineTo(rr.x0 + 26 * k, yy - 7 * k);
    esc.moveTo(rr.x0 - 10 * k, yy);
    esc.lineTo(rr.x0 - 10 * k, yy - 7 * k);
    esc.moveTo(rr.x0 + 22 * k, yy);
    esc.lineTo(rr.x0 + 2 * k, yy + 24 * k);
  }
  return { far, farLit, farWin, mid, midWin, midEdge, near, nearEdge, nearWin, props, door, esc, ants };
}

function buildTank(L) {
  const { k, tank } = L;
  const { cx, w, h, base, top, legs } = tank;
  const barrel = Skia.Path.Make();
  barrel.moveTo(cx - w / 2, top + 2 * k);
  barrel.lineTo(cx - w / 2 + 1.5 * k, base);
  barrel.quadTo(cx, base + 4 * k, cx + w / 2 - 1.5 * k, base);
  barrel.lineTo(cx + w / 2, top + 2 * k);
  barrel.close();
  const staves = Skia.Path.Make();
  for (let i = 1; i < 9; i += 1) {
    const xx = cx - w / 2 + (w * i) / 9;
    staves.moveTo(xx, top + 3 * k);
    staves.lineTo(xx + (xx - cx) * 0.03, base + 1 * k);
  }
  const bands = Skia.Path.Make();
  for (const t of [0.18, 0.5, 0.82]) {
    const yy = top + 2 * k + (base - top) * t;
    bands.moveTo(cx - w / 2 + 0.4 * k, yy);
    bands.quadTo(cx, yy + 3.4 * k, cx + w / 2 - 0.4 * k, yy);
  }
  const roof = Skia.Path.Make();
  roof.moveTo(cx - w / 2 - 3 * k, top + 3 * k);
  roof.lineTo(cx - 3 * k, top - 9 * k);
  roof.lineTo(cx + 3 * k, top - 9 * k);
  roof.lineTo(cx + w / 2 + 3 * k, top + 3 * k);
  roof.close();
  const finial = Skia.Path.Make();
  finial.addRect(Skia.XYWHRect(cx - 0.8 * k, top - 15 * k, 1.6 * k, 6 * k));
  finial.addCircle(cx, top - 15.5 * k, 1.6 * k);
  const frame = Skia.Path.Make();
  const lx = [cx - w * 0.4, cx - w * 0.13, cx + w * 0.13, cx + w * 0.4];
  for (const xx of lx) {
    frame.moveTo(xx, base + 1 * k);
    frame.lineTo(xx + (xx - cx) * 0.12, base + legs);
  }
  frame.moveTo(lx[0], base + 2 * k);
  frame.lineTo(lx[1] + (lx[1] - cx) * 0.12, base + legs);
  frame.moveTo(lx[1], base + 2 * k);
  frame.lineTo(lx[0] + (lx[0] - cx) * 0.12, base + legs);
  frame.moveTo(lx[2], base + 2 * k);
  frame.lineTo(lx[3] + (lx[3] - cx) * 0.12, base + legs);
  frame.moveTo(lx[3], base + 2 * k);
  frame.lineTo(lx[2] + (lx[2] - cx) * 0.12, base + legs);
  frame.moveTo(lx[0] - 2 * k, base + 2 * k);
  frame.lineTo(lx[3] + 2 * k, base + 2 * k);
  const ladder = Skia.Path.Make();
  const lx0 = cx + w / 2 + 2 * k;
  ladder.moveTo(lx0, top + 2 * k);
  ladder.lineTo(lx0, base + legs);
  ladder.moveTo(lx0 + 4 * k, top + 2 * k);
  ladder.lineTo(lx0 + 4 * k, base + legs);
  for (let yy = top + 6 * k; yy < base + legs; yy += 4.5 * k) {
    ladder.moveTo(lx0, yy);
    ladder.lineTo(lx0 + 4 * k, yy);
  }
  return { barrel, staves, bands, roof, finial, frame, ladder };
}

function buildStreet(L, width, height) {
  const { k, ground } = L;
  const lamps = [];
  for (let i = 0; i < 5; i += 1) lamps.push([width * (0.08 + i * 0.22), ground + 16 * k]);
  const curb = Skia.Path.Make();
  curb.addRect(Skia.XYWHRect(-4, ground, width + 8, 6 * k));
  const dash = Skia.Path.Make();
  for (let x = 6 * k; x < width; x += 28 * k) dash.addRect(Skia.XYWHRect(x, ground + 38 * k, 14 * k, 2 * k));
  return { lamps, curb, dash, bottom: height };
}

// Ağ çizimi: köşe ağı (universeSprites yolları), göz kırpan çiy damlaları parçacıkta
const WEB_SIZE = 120;

// ── Figür parçaları (statik yollar) ─────────────────────────────────────────
const TORSO = "M-3.6 -13.2 C-4.6 -10 -4.2 -5.5 -3.3 -1.4 L3.3 -1.4 C4.4 -5.5 4.8 -10 3.8 -13.2 C1.6 -14.5 -1.6 -14.5 -3.6 -13.2 Z";
const CHEST = "M-1.6 -13.4 C-2.4 -10 -2.2 -6 -1.6 -2 L2.6 -2 C3.4 -6 3.6 -10 2.8 -13.4 C1.4 -14 -0.4 -14 -1.6 -13.4 Z";
const PELVIS = "M-3.4 -1.8 L3.4 -1.8 L3 1.8 L-3 1.8 Z";
const BELT = "M-3.4 -1.6 L3.4 -1.6";
const TORSO_WEB = "M0.6 -13.6 L0.6 -2 M-1.5 -11 C-0.3 -10.4 1.5 -10.4 2.7 -11 M-1.8 -8 C-0.5 -7.4 1.7 -7.4 3.1 -8 M-1.7 -5 C-0.5 -4.4 1.7 -4.4 2.9 -5 M0.6 -13 L-1.5 -10 M0.6 -13 L2.9 -10";
const SPIDER_LEGS = "M-1.6 -10.4 L-0.2 -9.4 L-1.6 -8.2 M2.8 -10.4 L1.4 -9.4 L2.8 -8.2 M-1.2 -11.2 L0.2 -9.8 M2.4 -11.2 L1 -9.8 M-1.2 -7.4 L0.2 -8.8 M2.4 -7.4 L1 -8.8";
const HEAD = "M-3 -1 C-3.6 -4 -2.6 -8.4 0.4 -8.6 C3.4 -8.6 4.4 -5 3.8 -2.4 C3.4 -0.4 2 0.6 0.4 0.6 C-1.2 0.6 -2.6 0.2 -3 -1 Z";
const HEAD_WEB = "M2.6 -4.2 L-2.8 -2.4 M2.6 -4.2 L-2 -6.8 M2.6 -4.2 L0.4 -8.4 M2.6 -4.2 L3.8 -7.6 M2.6 -4.2 L1.2 0.4 M-1.6 -1.2 C-1.4 -3 -0.8 -5.2 0.2 -6.6 M0.2 0.2 C-0.4 -2 -0.2 -4.8 1.4 -7.4";
const EYE = "M1.4 -4.6 C1.6 -6.4 3 -7.4 4.1 -6.6 C4.6 -5.4 4.2 -3.6 3 -3 C2.2 -2.8 1.5 -3.4 1.4 -4.6 Z";
const EYE2 = "M-0.6 -4.8 C-0.6 -6 0 -6.8 0.6 -6.6 C0.9 -5.8 0.8 -4.4 0.2 -3.9 C-0.2 -3.8 -0.6 -4.2 -0.6 -4.8 Z";

function Limb({ tr, len, w, col, lower, children }) {
  return (
    <Group transform={tr}>
      <Path path={`M0 0 L0 ${len}`} style="stroke" strokeWidth={w} strokeCap="round" color={col} />
      {lower}
      {children}
    </Group>
  );
}

function Spidey({ st, c, s0 }) {
  const rootT = useDerivedValue(() => {
    const s = st.value;
    return [{ translateX: s.x }, { translateY: s.y }, { scaleX: s.face }, { rotate: s.r }, { scale: s0 }];
  });
  const j = (i, ox, oy) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDerivedValue(() => [{ translateX: ox }, { translateY: oy }, { rotate: st.value.pose[i] }]);
  const neckT = j(0, 0.2, -13.4);
  const shLT = j(1, SH[0] - 0.6, SH[1]);
  const elLT = j(2, 0, UA);
  const shRT = j(3, SH[0] + 0.4, SH[1]);
  const elRT = j(4, 0, UA);
  const hipLT = j(5, -0.6, 0.6);
  const knLT = j(6, 0, TH);
  const hipRT = j(7, 0.6, 0.6);
  const knRT = j(8, 0, TH);
  const op = useDerivedValue(() => st.value.o);
  const redD = rgba(c.red, 1);
  const blueD = "#1a3c86";
  const dark = "rgba(40,6,10,0.55)";
  const shin = (back) => (
    <>
      <Path path={`M0 0 L0 ${SN * 0.45}`} style="stroke" strokeWidth={3.5} strokeCap="round" color={back ? blueD : c.blue} />
      <Path path={`M0 ${SN * 0.45} L0 ${SN}`} style="stroke" strokeWidth={3.5} strokeCap="round" color={back ? "#9c1820" : redD} />
      <Path path={`M0 ${SN} L1.8 ${SN + 0.6}`} style="stroke" strokeWidth={2.6} strokeCap="round" color={back ? "#9c1820" : redD} />
      <Path path={`M-1.2 ${SN * 0.6} L1.2 ${SN * 0.6} M-1.2 ${SN * 0.8} L1.2 ${SN * 0.8}`} style="stroke" strokeWidth={0.3} color={dark} />
    </>
  );
  const fore = (back) => (
    <>
      <Path path={`M0 0 L0 ${FA}`} style="stroke" strokeWidth={2.7} strokeCap="round" color={back ? "#9c1820" : redD} />
      <Circle cx={0} cy={FA + 0.6} r={1.5} color={back ? "#9c1820" : redD} />
      <Path path={`M-1 ${FA * 0.4} L1 ${FA * 0.4} M-1 ${FA * 0.7} L1 ${FA * 0.7}`} style="stroke" strokeWidth={0.3} color={dark} />
    </>
  );
  return (
    <Group opacity={op}>
      <Group transform={rootT}>
        {/* arka bacak + arka kol */}
        <Limb tr={hipLT} len={TH} w={3.9} col={blueD}>
          <Group transform={knLT}>{shin(true)}</Group>
        </Limb>
        <Limb tr={shLT} len={UA} w={3} col={blueD}>
          <Group transform={elLT}>{fore(true)}</Group>
        </Limb>
        {/* gövde */}
        <Path path={PELVIS} color={c.blue} />
        <Path path={TORSO} color={c.blue} />
        <Path path={CHEST} color={redD} />
        <Path path={TORSO_WEB} style="stroke" strokeWidth={0.28} color={dark} />
        <Path path={BELT} style="stroke" strokeWidth={0.9} color={redD} />
        <Circle cx={0.6} cy={-9.4} r={0.75} color="#111" />
        <Circle cx={0.6} cy={-10.6} r={0.5} color="#111" />
        <Path path={SPIDER_LEGS} style="stroke" strokeWidth={0.32} color="#111" />
        {/* baş */}
        <Group transform={neckT}>
          <Path path={HEAD} color={redD} />
          <Path path={HEAD_WEB} style="stroke" strokeWidth={0.26} color={dark} />
          <Path path={EYE2} color="#111" />
          <Path path={EYE} color="#111" />
          <Group transform={[{ translateX: 2.75 }, { translateY: -4.85 }, { scale: 0.66 }, { translateX: -2.75 }, { translateY: 4.85 }]}>
            <Path path={EYE} color="#f4f7fb" />
          </Group>
        </Group>
        {/* ön bacak + ön kol */}
        <Limb tr={hipRT} len={TH} w={4} col={c.blue}>
          <Group transform={knRT}>{shin(false)}</Group>
        </Limb>
        <Limb tr={shRT} len={UA} w={3.1} col={c.blue}>
          <Path path={`M0 0 L0 ${UA * 0.4}`} style="stroke" strokeWidth={3.1} strokeCap="round" color={redD} />
          <Group transform={elRT}>{fore(false)}</Group>
        </Limb>
      </Group>
    </Group>
  );
}

function Splat({ x, y, k, o, color }) {
  const tr = useMemo(() => [{ translateX: x }, { translateY: y }], [x, y]);
  return (
    <Group transform={tr} opacity={o}>
      <Path
        path={`M${-6 * k} 0 L${6 * k} 0 M0 ${-6 * k} L0 ${6 * k} M${-4.2 * k} ${-4.2 * k} L${4.2 * k} ${4.2 * k} M${-4.2 * k} ${4.2 * k} L${4.2 * k} ${-4.2 * k}`}
        style="stroke"
        strokeWidth={0.7 * k}
        color={color}
      />
      <Circle cx={0} cy={0} r={3 * k} style="stroke" strokeWidth={0.6 * k} color={color} />
    </Group>
  );
}

function Blinker({ x, y, k, clock, i, color }) {
  const op = useDerivedValue(() => {
    const ph = (clock.value * 0.55 + i * 0.37) % 1;
    return ph < 0.12 ? 1 : ph < 0.24 ? 1 - (ph - 0.12) / 0.12 : 0.15;
  });
  return (
    <Group opacity={op}>
      <Circle cx={x} cy={y} r={7 * k}>
        <RadialGradient c={vec(x, y)} r={7 * k} colors={[rgba(color, 0.7), rgba(color, 0)]} />
      </Circle>
      <Circle cx={x} cy={y} r={1.6 * k} color={color} />
    </Group>
  );
}

export default function SpiderScene({ p, clock, width, height, tone }) {
  const c = toneMap(tone.colors);
  const L = spiderLayout(width, height);
  const { k } = L;
  const light = c.night === "#cfd8ea";
  const geo = useMemo(
    () => ({
      city: buildCity(L, width),
      tank: buildTank(L),
      street: buildStreet(L, width, height),
      spokes: Skia.Path.MakeFromSVGString(WEB_SPOKES),
      rings: Skia.Path.MakeFromSVGString(WEB_RINGS),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, height],
  );
  const f = useDerivedValue(() => spiderFrame(p, clock.value));
  const st = useDerivedValue(() => spideyState(L, f.value, clock));
  const lineP = useDerivedValue(() => {
    const s = st.value;
    const q = Skia.Path.Make();
    if (!s.line) return q;
    q.moveTo(s.lx, s.ly);
    q.lineTo(s.ax, s.ay);
    return q;
  });
  const lineO = useDerivedValue(() => st.value.line);
  const splat1 = useDerivedValue(() => (f.value.u <= 1 && f.value.u > 0.045 ? 0.8 * (1 - Math.max(0, (f.value.u - 0.85) / 0.1)) : 0));
  const splat2 = useDerivedValue(() => (f.value.u <= 1 && f.value.u > 0.235 ? 0.8 * (1 - Math.max(0, (f.value.u - 0.85) / 0.1)) : 0));
  const sirenR = useDerivedValue(() => f.value.siren * (0.5 + 0.5 * Math.sin(clock.value * 9)));
  const sirenB = useDerivedValue(() => f.value.siren * (0.5 - 0.5 * Math.sin(clock.value * 9)));
  const lampO = useDerivedValue(() => 0.75 + 0.1 * Math.sin(clock.value * 1.3));
  const winO = useDerivedValue(() => 0.8 + 0.12 * Math.sin(clock.value * 0.37));
  const webS = (WEB_SIZE * k) / 100;
  const C = geo.city;
  const T = geo.tank;
  const S = geo.street;
  const webCol = c.web;
  const { tank } = L;
  const sirenX = width * 0.47;
  const sirenY = L.ground + 4 * k;
  return (
    <Group>
      {/* ay */}
      <Circle cx={L.moon.x} cy={L.moon.y} r={L.moon.r * 2.4}>
        <RadialGradient c={vec(L.moon.x, L.moon.y)} r={L.moon.r * 2.4} colors={[rgba(c.moon, light ? 0.3 : 0.2), rgba(c.moon, 0)]} />
      </Circle>
      <Circle cx={L.moon.x} cy={L.moon.y} r={L.moon.r}>
        <LinearGradient start={vec(L.moon.x + L.moon.r, L.moon.y - L.moon.r)} end={vec(L.moon.x - L.moon.r, L.moon.y + L.moon.r)} colors={[c.moon, rgba(c.moon, light ? 0.7 : 0.82)]} />
      </Circle>
      {[[-0.3, -0.2, 0.2], [0.28, 0.12, 0.15], [-0.05, 0.38, 0.11], [0.32, -0.36, 0.09]].map(([dx, dy, r], i) => (
        <Circle key={i} cx={L.moon.x + dx * L.moon.r} cy={L.moon.y + dy * L.moon.r} r={r * L.moon.r} color={rgba(c.far, light ? 0.12 : 0.18)} />
      ))}

      <Group opacity={tone.alpha}>
        {/* ufuk ışıması */}
        <Path path={`M0 ${L.ground - 260 * k} L${width} ${L.ground - 260 * k} L${width} ${L.ground} L0 ${L.ground} Z`}>
          <LinearGradient start={vec(0, L.ground - 260 * k)} end={vec(0, L.ground)} colors={[rgba(c.glow, 0), rgba(c.glow, light ? 0.25 : 0.2)]} />
        </Path>
        {/* uzak kuleler */}
        <Path path={C.far} color={c.far} />
        <Path path={C.farLit} style="stroke" strokeWidth={0.8 * k} color={rgba(c.glow, 0.25)} />
        <Group opacity={winO}>
          <Path path={C.farWin} color={rgba(c.window, light ? 0.5 : 0.55)} />
        </Group>
        {/* orta kat */}
        <Path path={C.mid} color={c.mid} />
        <Path path={C.midEdge} style="stroke" strokeWidth={0.8 * k} color={rgba(c.glow, 0.3)} />
        <Path path={C.midWin} color={rgba(c.window, light ? 0.6 : 0.7)} />
      </Group>
      {C.ants.map(([x, y], i) => (
        <Blinker key={i} x={x} y={y} k={k} clock={clock} i={i} color="#ff4040" />
      ))}

      {/* ağ çapaları */}
      <Splat x={L.A1[0]} y={L.A1[1]} k={k} o={splat1} color={webCol} />
      <Splat x={L.A2[0]} y={L.A2[1]} k={k} o={splat2} color={webCol} />

      {/* sokak ışıkları + polis (çatılar arasındaki boşlukta) */}
      <Group opacity={sirenR}>
        <Circle cx={sirenX - 8 * k} cy={sirenY} r={40 * k}>
          <RadialGradient c={vec(sirenX - 8 * k, sirenY)} r={40 * k} colors={["rgba(255,40,40,0.55)", "rgba(255,40,40,0)"]} />
        </Circle>
      </Group>
      <Group opacity={sirenB}>
        <Circle cx={sirenX + 8 * k} cy={sirenY} r={40 * k}>
          <RadialGradient c={vec(sirenX + 8 * k, sirenY)} r={40 * k} colors={["rgba(60,120,255,0.55)", "rgba(60,120,255,0)"]} />
        </Circle>
      </Group>

      {/* yakın çatılar */}
      <Group opacity={tone.alpha}>
        <Path path={C.esc} style="stroke" strokeWidth={1 * k} color={rgba(c.metal, 0.75)} />
        <Path path={C.near}>
          <LinearGradient start={vec(0, L.rightRoof.y)} end={vec(0, L.ground)} colors={[c.roof, c.near]} />
        </Path>
        <Path path={C.nearEdge} style="stroke" strokeWidth={1.2 * k} color={rgba(c.glow, 0.35)} />
        <Path path={C.nearWin} color={rgba(c.window, 0.75)} />
        <Path path={C.props} color={c.near} />
        <Path path={C.props} style="stroke" strokeWidth={0.7 * k} color={rgba(c.glow, 0.22)} />
        <Path path={C.door} color={rgba(c.window, 0.6)} />
        {/* su kulesi */}
        <Path path={T.frame} style="stroke" strokeWidth={1.6 * k} color={c.metal} />
        <Path path={T.ladder} style="stroke" strokeWidth={0.8 * k} color={c.metal} />
        <Path path={T.barrel}>
          <LinearGradient start={vec(tank.cx - tank.w / 2, 0)} end={vec(tank.cx + tank.w / 2, 0)} colors={[rgba(c.wood, 1), "#8a6040", rgba(c.wood, 1), "#3a281c"]} positions={[0, 0.35, 0.7, 1]} />
        </Path>
        <Path path={T.staves} style="stroke" strokeWidth={0.6 * k} color="rgba(30,18,10,0.5)" />
        <Path path={T.bands} style="stroke" strokeWidth={1.5 * k} color={c.metal} />
        <Path path={T.roof}>
          <LinearGradient start={vec(tank.cx - tank.w / 2, 0)} end={vec(tank.cx + tank.w / 2, 0)} colors={["#4a5262", "#6d7586", "#3a404c"]} />
        </Path>
        <Path path={T.finial} color={c.metal} />
        {/* sokak */}
        <Path path={`M-4 ${L.ground} L${width + 4} ${L.ground} L${width + 4} ${height} L-4 ${height} Z`} color={c.night} />
        <Path path={S.curb} color={c.near} />
        <Path path={S.dash} color={rgba(c.window, 0.5)} />
      </Group>
      <Group opacity={lampO}>
        {S.lamps.map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={16 * k}>
            <RadialGradient c={vec(x, y)} r={16 * k} colors={[rgba(c.window, 0.55), rgba(c.window, 0)]} />
          </Circle>
        ))}
      </Group>

      {/* ağ ipi + örümcek adam */}
      <Group opacity={lineO}>
        <Path path={lineP} style="stroke" strokeWidth={1.1 * k} strokeCap="round" color={webCol} />
      </Group>
      <Spidey st={st} c={c} s0={L.s} />

      {/* köşe ağları */}
      {geo.spokes && geo.rings ? (
        <>
          {[[{ scale: webS }], [{ translateX: width }, { rotate: Math.PI / 2 }, { scale: webS }]].map((tr, i) => (
            <Group key={i} transform={tr}>
              <Path path={geo.spokes} style="stroke" strokeWidth={1.15 / webS} strokeCap="round" color={rgba(webCol, 0.7)} />
              <Path path={geo.rings} style="stroke" strokeWidth={0.8 / webS} strokeCap="round" strokeJoin="round" color={rgba(webCol, 0.55)} />
            </Group>
          ))}
        </>
      ) : null}
    </Group>
  );
}
