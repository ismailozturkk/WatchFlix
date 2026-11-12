// components/decor/duneScene.js
//
// Dune atmosfer sahnesi (OVERLAY.dunes = 18) — tamamı VEKTÖR:
//   • Arrakis: keskin sırtlı, bir yüzü ay ışığında bir yüzü gölgede kum tepeleri (üç kat),
//     rüzgâr dalgacıkları, ufukta Kalkan Duvarı kayalıkları ve sıcak pus, iki ay + yıldızlar.
//   • Solda Fremen gözcü kayası (siyeç ağzında loş ışık); sağ ufukta baharat hasatçısı (toz bulutu)
//     ve üstünde süzülen taşıyıcı; arada ekranı geçen iki ornitopter (yusufçuk kanatlı).
//   • Olay (duneFrame, 30 sn): Fremen kayadan inip vurucuyu (thumper) kuma diker, geri çekilir →
//     vurucu döver, halkalar yayılır → uzaktan kumda kabaran iz yaklaşır, zemin titrer →
//     KUM SOLUCANI vurucunun yerinden yükselir; tek parça gövdesi yürüyen dalgayla kıvrılır, büzülmüş
//     burnu dairesel ağza açılır (kapak yok; diş halkaları, kızıl gırtlak), kum dökülür → gövde kemer
//     çizerek yol boyunca akar, baş aşağı kuma dalar ve kuyruğa kadar kumda kaybolur, Fremen üstüne atlar → solucan uzak sırtta
//     sağdan sola akar, sırtında halatlarıyla Fremen (solucan sürme) → dalar, sakin çöl.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift (sekme çubuğu). Renkler OVERLAY_TONES[18] (DUNE_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Circle, Group, LinearGradient, Oval, Path, RadialGradient, Skia, vec } from "@shopify/react-native-skia";
import { duneFrame, sceneScale } from "../../utils/weatherParticles";
import { SCENERY } from "../../utils/weatherUniverses";

const DUNE_TONE = ["sandLit", "sand", "sandShade", "sandDeep", "rock", "rockLit", "haze", "moon", "spice", "cloth", "metal", "worm", "star"];
const toneMap = (colors) => Object.fromEntries(DUNE_TONE.map((name, i) => [name, colors[i] || colors[0]]));

function rgba(hex, a) {
  const h = String(hex).replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Kum tepesi profili: asimetrik, sivri sırtlı.
function duneY(x, width, d) {
  const th = (x / width) * d.n * Math.PI * 2 + d.ph;
  const s = 0.5 + 0.5 * Math.sin(th + 0.55 * Math.cos(th));
  return d.base - d.amp * (Math.pow(s, 1.7) + 0.12 * Math.sin(th * 2.3 + 1.1));
}

/** Sahne yerleşimi (dp). */
export function duneLayout(width, height) {
  const k = sceneScale(width, height);
  const ground = height - SCENERY.lift * k;
  const layers = [
    { base: ground - 92 * k, amp: 30 * k, n: 1.6, ph: 0.6 }, // uzak
    { base: ground - 36 * k, amp: 36 * k, n: 1.15, ph: 2.2 }, // orta (vurucu burada)
    { base: ground + 6 * k, amp: 26 * k, n: 1.4, ph: 4.1 }, // ön
  ];
  // vurucu: orta tepenin 0,6W çevresindeki sırtı
  let tx = width * 0.6;
  let best = Infinity;
  for (let x = width * 0.5; x <= width * 0.7; x += 2) {
    const y = duneY(x, width, layers[1]);
    if (y < best) {
      best = y;
      tx = x;
    }
  }
  const ty = duneY(tx, width, layers[1]);
  return {
    k, ground, layers, tx, ty,
    horizon: ground - 128 * k,
    rock: { x0: width * 0.02, x1: width * 0.3, top: ground - 168 * k },
    rideY: ground - 70 * k,
    R: 44 * k,
    rise: 205 * k,
    moon: { x: width * 0.76, y: height * 0.15, r: 34 * k },
    moon2: { x: width * 0.6, y: height * 0.095, r: 11 * k },
    harv: { x: width * 0.88, y: duneY(width * 0.88, width, layers[0]) + 2 * k },
  };
}

// ── Kum tepeleri ───────────────────────────────────────────────────────────────
function buildDunes(L, width, height) {
  const { k } = L;
  const step = 3;
  return L.layers.map((d, li) => {
    const ys = [];
    for (let x = -6; x <= width + 6; x += step) ys.push([x, duneY(x, width, d)]);
    const body = Skia.Path.Make();
    body.moveTo(-6, height + 2);
    for (const [x, y] of ys) body.lineTo(x, y);
    body.lineTo(width + 6, height + 2);
    body.close();
    // ay ışığı (sağdan): sağa bakan yüzler aydınlık; sırttan vadiye inen yüzün üst kısmı
    const lit = Skia.Path.Make();
    const crestLine = Skia.Path.Make();
    for (let i = 1; i < ys.length - 1; i += 1) {
      const [x, y] = ys[i];
      if (!(y <= ys[i - 1][1] && y < ys[i + 1][1]) || d.base - y < d.amp * 0.5) continue; // belirgin sırt
      let j = i;
      while (j < ys.length - 1 && ys[j + 1][1] >= ys[j][1] - 0.15) j += 1; // vadiye kadar
      const vx = ys[j][0];
      const vy = ys[j][1];
      lit.moveTo(x, y);
      for (let q = i + 1; q <= j; q += 1) lit.lineTo(ys[q][0], ys[q][1]);
      const drop = (12 + li * 7) * k;
      for (let q = j; q > i; q -= 1) {
        const tt = (q - i) / (j - i);
        lit.lineTo(ys[q][0], ys[q][1] + drop * Math.pow(Math.sin(Math.PI * tt), 0.7) * (1 - 0.4 * tt));
      }
      lit.close();
      // sivri sırt çizgisi
      crestLine.moveTo(ys[Math.max(0, i - 7)][0], ys[Math.max(0, i - 7)][1] + 0.6 * k);
      for (let q = i - 6; q <= Math.min(ys.length - 1, i + 3); q += 1) if (q >= 0) crestLine.lineTo(ys[q][0], ys[q][1]);
    }
    // rüzgâr dalgacıkları (yüzeye paralel ince kıvrımlar)
    const ripples = Skia.Path.Make();
    const rows = 4 + li * 3;
    for (let r = 0; r < rows; r += 1) {
      const depth = (6 + r * (8 + li * 4)) * k;
      let x = -10 + ((r * 37) % 23);
      while (x < width + 10) {
        const len = (18 + ((x * 7 + r * 13) % 26)) * k;
        const y0 = duneY(x, width, d) + depth;
        const y1 = duneY(x + len, width, d) + depth;
        ripples.moveTo(x, y0);
        ripples.quadTo(x + len * 0.5, (y0 + y1) / 2 - 2.2 * k, x + len, y1);
        x += len + (10 + ((x * 3 + r * 11) % 30)) * k;
      }
    }
    return { body, lit, crestLine, ripples, top: d.base - d.amp * 1.15 };
  });
}

function buildAboveMid(L, width) {
  const p = Skia.Path.Make();
  p.moveTo(-10, -10);
  p.lineTo(width + 10, -10);
  for (let x = width + 10; x >= -10; x -= 3) p.lineTo(x, duneY(x, width, L.layers[1]) + 1);
  p.close();
  return p;
}

// Kalkan Duvarı (ufuk kayalıkları) + gözcü kayası
function buildRocks(L, width) {
  const { k, horizon, rock } = L;
  const shield = Skia.Path.Make();
  shield.moveTo(-5, horizon + 30 * k);
  const peaks = [[0, 18], [0.06, 30], [0.11, 22], [0.17, 40], [0.23, 34], [0.3, 46], [0.36, 28], [0.44, 20], [0.52, 26], [0.6, 14], [0.68, 24], [0.75, 38], [0.8, 30], [0.87, 44], [0.93, 26], [1, 34]];
  for (const [x, h] of peaks) {
    shield.lineTo(width * x - 6 * k, horizon - h * 0.7 * k);
    shield.lineTo(width * x, horizon - h * k);
    shield.lineTo(width * x + 9 * k, horizon - h * 0.86 * k);
  }
  shield.lineTo(width + 5, L.ground);
  shield.lineTo(-5, L.ground);
  shield.close();
  // gözcü kayası: basamaklı mesa
  const { x0, x1, top } = rock;
  const w = x1 - x0;
  const pts = [
    [x0 - 8 * k, L.ground], [x0, top + 70 * k], [x0 + w * 0.05, top + 40 * k], [x0 + w * 0.1, top + 12 * k], [x0 + w * 0.2, top + 4 * k],
    [x0 + w * 0.34, top], [x0 + w * 0.56, top + 2 * k], [x0 + w * 0.66, top + 10 * k], [x0 + w * 0.7, top + 22 * k], [x0 + w * 0.82, top + 30 * k],
    [x0 + w * 0.9, top + 52 * k], [x1, top + 80 * k], [x1 + 10 * k, L.ground],
  ];
  const body = Skia.Path.Make();
  body.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) body.lineTo(x, y);
  body.close();
  // aydınlık sağ kenar (ay sağda)
  const lit = Skia.Path.Make();
  lit.moveTo(x0 + w * 0.56, top + 2 * k);
  lit.lineTo(x0 + w * 0.66, top + 10 * k);
  lit.lineTo(x0 + w * 0.7, top + 22 * k);
  lit.lineTo(x0 + w * 0.82, top + 30 * k);
  lit.lineTo(x0 + w * 0.9, top + 52 * k);
  lit.lineTo(x1, top + 80 * k);
  lit.lineTo(x1 + 10 * k, L.ground);
  lit.lineTo(x1 - 14 * k, L.ground);
  lit.lineTo(x1 - 22 * k, top + 84 * k);
  lit.lineTo(x0 + w * 0.78, top + 40 * k);
  lit.lineTo(x0 + w * 0.62, top + 16 * k);
  lit.close();
  // katmanlar (yatay tabakalar) ve çatlaklar
  const strata = Skia.Path.Make();
  for (let i = 1; i < 7; i += 1) {
    const y = top + i * 15 * k;
    strata.moveTo(x0 + w * 0.06 + i * 2 * k, y);
    strata.cubicTo(x0 + w * 0.3, y + 3 * k, x0 + w * 0.55, y - 2 * k, x1 - (8 - i) * 3 * k, y + 2 * k);
  }
  for (const [fx, fy, l] of [[0.2, 6, 28], [0.45, 2, 40], [0.74, 24, 36], [0.12, 30, 30]]) {
    strata.moveTo(x0 + w * fx, top + fy * k);
    strata.lineTo(x0 + w * fx + 3 * k, top + (fy + l * 0.5) * k);
    strata.lineTo(x0 + w * fx - 1 * k, top + (fy + l) * k);
  }
  // siyeç ağzı
  const cave = Skia.Path.Make();
  const cx = x0 + w * 0.42;
  const cy = top + 62 * k;
  cave.moveTo(cx - 9 * k, cy + 14 * k);
  cave.lineTo(cx - 8 * k, cy + 2 * k);
  cave.quadTo(cx, cy - 8 * k, cx + 8 * k, cy + 2 * k);
  cave.lineTo(cx + 9 * k, cy + 14 * k);
  cave.close();
  return { shield, body, lit, strata, cave, cave0: [cx, cy + 6 * k] };
}

function buildStars(width, height) {
  const p = Skia.Path.Make();
  let s = 11;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < 46; i += 1) {
    const x = rnd() * width;
    const y = rnd() * height * 0.52;
    p.addCircle(x, y, 0.5 + rnd() * 0.9);
  }
  return p;
}

// ── Solucan ────────────────────────────────────────────────────────────────────
// Ağız (baş) parçaları, yerel koordinat: ağız merkezi 0,0; ileri yön −y, gövde +y yönünde.
// Yaprak/kapak YOK: kapalıyken büzülmüş yuvarlak burun, açılınca dairesel ağız (diş halkaları).
function buildWormHead(R) {
  // dudak (ağız kenarı) — perspektifte elips
  const rim = Skia.Path.Make();
  rim.addOval(Skia.XYWHRect(-R, -R * 0.6, R * 2, R * 1.2));
  // diş halkaları (içe bakan dikenler)
  const teeth = Skia.Path.Make();
  for (const [rr, n, len] of [[0.86, 34, 0.13], [0.68, 28, 0.12], [0.5, 22, 0.1], [0.34, 16, 0.09], [0.2, 10, 0.06]]) {
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2 + rr * 3;
      const ca = Math.cos(a);
      const sa = Math.sin(a) * 0.6;
      const pa = a + Math.PI / 2;
      const w = ((Math.PI * rr * R) / n) * 0.55;
      const bx = ca * rr * R;
      const by = sa * rr * R;
      teeth.moveTo(bx + Math.cos(pa) * w, by + Math.sin(pa) * w * 0.6);
      teeth.lineTo(ca * (rr - len) * R, sa * (rr - len) * R);
      teeth.lineTo(bx - Math.cos(pa) * w, by - Math.sin(pa) * w * 0.6);
      teeth.close();
    }
  }
  // iç kıvrım halkaları (gırtlak derinliği)
  const gullet = Skia.Path.Make();
  for (const rr of [0.76, 0.58, 0.41, 0.26]) gullet.addOval(Skia.XYWHRect(-rr * R, -rr * R * 0.6, rr * R * 2, rr * R * 1.2));
  // kapalı burun: ileri bombeli kubbe + merkeze büzülen ince kırışıklar
  const dome = Skia.Path.Make();
  dome.moveTo(-R, 0);
  dome.cubicTo(-R * 0.98, -R * 0.62, -R * 0.45, -R * 0.82, 0, -R * 0.84);
  dome.cubicTo(R * 0.45, -R * 0.82, R * 0.98, -R * 0.62, R, 0);
  dome.quadTo(0, R * 0.32, -R, 0);
  dome.close();
  const pucker = Skia.Path.Make();
  const tip = [0, -R * 0.5];
  for (let i = 0; i < 14; i += 1) {
    const a = (i / 14) * Math.PI * 2;
    const ex = Math.cos(a) * R * 0.9;
    const ey = Math.sin(a) * R * 0.5 - R * 0.06;
    pucker.moveTo(tip[0] + Math.cos(a) * R * 0.06, tip[1] + Math.sin(a) * R * 0.04);
    pucker.quadTo((tip[0] + ex) * 0.5 + Math.cos(a + 0.6) * R * 0.12, (tip[1] + ey) * 0.5 + Math.sin(a + 0.6) * R * 0.08, ex, ey);
  }
  const knot = Skia.Path.Make();
  knot.addOval(Skia.XYWHRect(-R * 0.1, tip[1] - R * 0.05, R * 0.2, R * 0.1));
  // başın üstünden dökülen kum dereleri
  const sandFall = Skia.Path.Make();
  for (let i = 0; i < 9; i += 1) {
    const x = (-0.9 + i * 0.225) * R;
    for (let j = 0; j < 5; j += 1) {
      const y = R * 0.2 + j * R * 0.9 + ((i * 17) % 7) * R * 0.08;
      sandFall.moveTo(x, y);
      sandFall.lineTo(x + R * 0.03, y + R * 0.5);
    }
  }
  return { rim, teeth, gullet, dome, pucker, knot, sandFall };
}

// Solucanın kumda izlediği yol (gövde bu yol boyunca AKAR, bir bütün halinde kıvrılır):
// kum altından dik çıkış → hafif geriye (sağa) şahlanma → sola kemer çizip baş aşağı → kuma dalış.
// Düz dizi [x0,y0,…], adım ds; sg1/sg2: zemin geçiş uzaklıkları.
export function buildWormTrack(L, width) {
  const { k, R, tx, ty } = L;
  const H = L.rise;
  const r = 92 * k;
  const ds = 3 * k;
  const Lw = 1.8 * H + Math.PI * r + 2 * R;
  const pre = Lw + 4 * R;
  const segs = [
    [pre, 0],
    [0.42 * H, 0.04],
    [0.48 * H, 0.3],
    [Math.PI * r, -(Math.PI + 0.44)],
    [3 * H + Lw + 8 * R, 0],
  ];
  const pts = [];
  let x = tx;
  let y = ty + 8 * k + pre;
  let th = -Math.PI / 2;
  pts.push(x, y);
  const marks = [];
  let s = 0;
  for (const [len, turn] of segs) {
    const n = Math.max(1, Math.round(len / ds));
    for (let i = 0; i < n; i += 1) {
      th += turn / n;
      x += Math.cos(th) * ds;
      y += Math.sin(th) * ds;
      pts.push(x, y);
      s += ds;
    }
    marks.push(s);
  }
  const sg1 = marks[0];
  const sApex = marks[2];
  const sArcEnd = marks[3];
  let sg2 = sArcEnd;
  let diveX = tx - 2 * r;
  let diveY = ty;
  for (let i = Math.round(sArcEnd / ds); i < pts.length / 2; i += 1) {
    const px = pts[2 * i];
    const py = pts[2 * i + 1];
    if (py >= duneY(px, width, L.layers[1]) + 4 * k) {
      sg2 = i * ds;
      diveX = px;
      diveY = py;
      break;
    }
  }
  const travel = sg2 - sApex + Lw + 2 * R;
  return { pts, ds, Lw, sg1, sg2, sApex, travel, diveX, diveY };
}

// Uzak sırtta akan solucan sırtı (yerel: baş 0,0, gövde +x yönünde, kum çizgisi y=0)
function buildRideWorm(k) {
  const humps = Skia.Path.Make();
  const ridges = Skia.Path.Make();
  const n = 13;
  const sp = 15 * k;
  humps.moveTo(-14 * k, 4 * k);
  humps.cubicTo(-14 * k, -10 * k, -2 * k, -17 * k, 10 * k, -15 * k); // baş
  for (let i = 1; i <= n; i += 1) {
    const x = 10 * k + i * sp;
    const h = (19 - i * 0.8) * k;
    humps.quadTo(x - sp * 0.5, -h - 3 * k, x, -h + 2 * k);
    ridges.moveTo(x - sp * 0.15, -h + 1 * k);
    ridges.quadTo(x - sp * 0.05, -h * 0.4, x + sp * 0.05, 2 * k);
  }
  humps.lineTo(10 * k + n * sp + 10 * k, 4 * k);
  humps.close();
  const spray = Skia.Path.Make();
  spray.moveTo(-26 * k, 5 * k);
  spray.cubicTo(-30 * k, -12 * k, -18 * k, -24 * k, -6 * k, -18 * k);
  spray.cubicTo(-2 * k, -8 * k, -10 * k, 0, -26 * k, 5 * k);
  spray.close();
  const trail = Skia.Path.Make();
  trail.moveTo(10 * k, 4 * k);
  trail.lineTo(10 * k + n * sp + 80 * k, 6 * k);
  trail.lineTo(10 * k + n * sp + 80 * k, 9 * k);
  trail.lineTo(10 * k, 7 * k);
  trail.close();
  return { humps, ridges, spray, trail, len: 10 * k + n * sp };
}

// ── Figürler ──────────────────────────────────────────────────────────────────
// Fremen: yerel, ayak 0,0; boy ~28 birim (k ile ölçeklenir)
const FREMEN_ROBE = "M-4.5 -19 C-6 -12 -7.5 -5 -8.5 -1 L-3 -2 L-1 -6 L1 -6 L3 -2 L8 -1 C7 -6 6 -12 4.5 -19 Z";
const FREMEN_HOOD = "M-4.6 -19 C-6 -25 -3 -29.5 0 -29.5 C3.5 -29.5 6 -25.5 4.6 -19 Z";
const FREMEN_FACE = "M-1.2 -21 C-2.6 -22 -2.6 -26 0 -26.8 C2.8 -26.6 3.3 -23 2.4 -21.2 Z";
const FREMEN_CAPE = "M-3.5 -19 C-8 -15 -12 -9 -15 -4 C-11 -6 -9 -5 -6 -6 Z";

function Fremen({ x, y, k, face, walk, clock, c, eyes = true }) {
  const legA = useDerivedValue(() => [{ rotate: Math.sin(clock.value * 9) * 0.55 * walk.value }]);
  const legB = useDerivedValue(() => [{ rotate: -Math.sin(clock.value * 9) * 0.55 * walk.value }]);
  const cape = useDerivedValue(() => [{ scaleX: 1 + 0.18 * Math.sin(clock.value * 5.3) + 0.08 * Math.sin(clock.value * 11) }]);
  const tr = useDerivedValue(() => [{ translateX: x.value }, { translateY: y.value }, { scale: k }, { scaleX: face.value }]);
  return (
    <Group transform={tr}>
      <Group transform={[{ translateX: -3.5 }, { translateY: -19 }]}>
        <Group transform={cape}>
          <Group transform={[{ translateX: 3.5 }, { translateY: 19 }]}>
            <Path path={FREMEN_CAPE} color={rgba(c.cloth, 0.9)} />
          </Group>
        </Group>
      </Group>
      <Group transform={[{ translateX: 0 }, { translateY: -7 }]}>
        <Group transform={legA}>
          <Path path="M0 0 L0 7" style="stroke" strokeWidth={2.4} strokeCap="round" color={c.cloth} />
        </Group>
        <Group transform={legB}>
          <Path path="M0 0 L0 7" style="stroke" strokeWidth={2.4} strokeCap="round" color={c.cloth} />
        </Group>
      </Group>
      <Path path={FREMEN_ROBE} color={c.cloth} />
      <Path path="M-1 -18 L-2.5 -6 M2 -17 L3 -7" style="stroke" strokeWidth={0.5} color={rgba(c.sandLit, 0.25)} />
      <Path path={FREMEN_HOOD} color={c.cloth} />
      <Path path={FREMEN_FACE} color={rgba(c.sandShade, 0.95)} />
      {/* damıtıcı giysi hortumu */}
      <Path path="M1.6 -21.5 C3.5 -20 3.6 -18 2.2 -16.5" style="stroke" strokeWidth={0.7} color={rgba(c.metal, 0.9)} />
      {eyes && <Circle cx={1.4} cy={-24.2} r={0.7} color="#7fd8ff" />}
    </Group>
  );
}

// Ornitopter (yerel, gövde x ekseninde, burun +x; ~48 birim)
const THOP_BODY = "M-20 -1 C-14 -6 6 -7 14 -4 C20 -2 22 1 18 3 C8 6 -12 5 -20 2 Z";
const THOP_CANOPY = "M8 -4 C12 -6 18 -4 20 -0.5 C16 0 11 0 8 -1 Z";
const THOP_TAIL = "M-20 -1 L-34 -2 L-36 -6 L-38 -6 L-37 1 L-20 2 Z";
function Ornithopter({ clock, i, width, height, k, c }) {
  const P = 41;
  const tr = useDerivedValue(() => {
    const t = clock.value + i * 1.3;
    const c0 = (t / P) % 1;
    const tau = c0 / 0.34; // geçiş döngünün ilk %34'ü
    const x = tau < 1 ? -70 * k + (width + 140 * k) * tau : -400;
    const y = height * (0.27 + i * 0.045) + Math.sin(t * 1.3 + i) * 5 * k - tau * 22 * k;
    return [{ translateX: x }, { translateY: y }, { scale: k * (i ? 0.75 : 0.95) }, { rotate: -0.06 + Math.sin(t * 1.3 + i) * 0.03 }];
  });
  const flapA = useDerivedValue(() => [{ rotate: -0.25 + Math.sin(clock.value * 38 + i) * 0.55 }]);
  const flapB = useDerivedValue(() => [{ rotate: 0.25 - Math.sin(clock.value * 38 + i) * 0.55 }]);
  const wing = "M0 0 C8 -3 30 -4 46 -1 C30 2 8 2 0 0 Z";
  return (
    <Group transform={tr}>
      <Group transform={[{ translateX: -2 }, { translateY: -5 }]}>
        <Group transform={flapA}>
          <Group transform={[{ rotate: -2.7 }]}><Path path={wing} color={rgba(c.moon, 0.32)} /></Group>
          <Group transform={[{ translateX: 6 }, { rotate: -0.35 }]}><Path path={wing} color={rgba(c.moon, 0.32)} /></Group>
        </Group>
      </Group>
      <Path path={THOP_TAIL} color={c.metal} />
      <Path path={THOP_BODY} color={c.metal} />
      <Path path="M-16 2 C-6 4 8 4 16 2" style="stroke" strokeWidth={1} color="rgba(0,0,0,0.3)" />
      <Path path={THOP_CANOPY} color="#2c3a46" />
      <Path path="M10 -4 C13 -5 16 -4 18 -2" style="stroke" strokeWidth={0.8} color="rgba(220,240,255,0.55)" />
      <Path path="M-6 4 L-8 9 L-2 9 M6 4 L8 9 L2 9" style="stroke" strokeWidth={0.9} color={c.metal} />
      <Group transform={[{ translateX: -2 }, { translateY: -5 }]}>
        <Group transform={flapB}>
          <Group transform={[{ rotate: -2.85 }]}><Path path={wing} color={rgba(c.moon, 0.45)} /></Group>
          <Group transform={[{ translateX: 6 }, { rotate: -0.2 }]}><Path path={wing} color={rgba(c.moon, 0.45)} /></Group>
        </Group>
      </Group>
      <Circle cx={-21} cy={0.5} r={1.6} color="#ffb060" />
    </Group>
  );
}

// Baharat hasatçısı + taşıyıcı (uzak sağ)
function Harvester({ L, clock, c }) {
  const { k, harv } = L;
  const body = useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(-18 * k, 0);
    p.lineTo(-16 * k, -9 * k);
    p.lineTo(-9 * k, -13 * k);
    p.lineTo(10 * k, -13 * k);
    p.lineTo(16 * k, -8 * k);
    p.lineTo(18 * k, 0);
    p.close();
    return p;
  }, [k]);
  const carry = useDerivedValue(() => [{ translateX: harv.x + Math.sin(clock.value * 0.4) * 3 * k }, { translateY: harv.y - 46 * k + Math.sin(clock.value * 0.9) * 2 * k }]);
  const blink = useDerivedValue(() => (Math.sin(clock.value * 3) > 0.6 ? 1 : 0.2));
  return (
    <Group>
      {[0, 1, 2, 3, 4].map((i) => (
        <Plume key={i} i={i} x={harv.x - 6 * k} y={harv.y - 12 * k} k={k} clock={clock} color={c.sandLit} />
      ))}
      <Group transform={[{ translateX: harv.x }, { translateY: harv.y }]}>
        <Path path={body} color={rgba(c.metal, 0.75)} />
        <Path path={`M${-12 * k} ${-13 * k} L${-4 * k} ${-24 * k} L${2 * k} ${-24 * k}`} style="stroke" strokeWidth={1.4 * k} color={rgba(c.metal, 0.75)} />
        <Path path={`M${-17 * k} ${-2 * k} L${17 * k} ${-2 * k}`} style="stroke" strokeWidth={2 * k} color="rgba(0,0,0,0.35)" />
        <Circle cx={8 * k} cy={-9 * k} r={1.2 * k} color={c.spice} />
      </Group>
      <Group transform={carry}>
        <Path path={`M${-26 * k} 0 L${26 * k} 0 M${-20 * k} ${-4 * k} L${20 * k} ${-4 * k} M${-18 * k} 0 L${-18 * k} ${-8 * k} M${18 * k} 0 L${18 * k} ${-8 * k} M${-8 * k} 0 L${-8 * k} ${16 * k} M${8 * k} 0 L${8 * k} ${16 * k}`} style="stroke" strokeWidth={1.6 * k} color={rgba(c.metal, 0.7)} />
        <Group opacity={blink}>
          <Circle cx={-26 * k} cy={0} r={1.4 * k} color="#ff5a3a" />
          <Circle cx={26 * k} cy={0} r={1.4 * k} color="#ff5a3a" />
        </Group>
      </Group>
    </Group>
  );
}

function Plume({ i, x, y, k, clock, color }) {
  const tr = useDerivedValue(() => {
    const c0 = (clock.value * 0.11 + i / 5) % 1;
    return [{ translateX: x - c0 * 60 * k }, { translateY: y - c0 * 26 * k }, { scale: 0.5 + c0 * 1.6 }];
  });
  const op = useDerivedValue(() => {
    const c0 = (clock.value * 0.11 + i / 5) % 1;
    return Math.sin(c0 * Math.PI) * 0.32;
  });
  return (
    <Group transform={tr} opacity={op}>
      <Oval x={-12 * k} y={-6 * k} width={24 * k} height={12 * k} color={color} />
    </Group>
  );
}

// Kum patlaması (yükseliş ve dalış): genişleyen, sönen bulut
function Burst({ f, key0, x, y, k, i, color, spread = 1 }) {
  const tr = useDerivedValue(() => {
    const w = f.value[key0];
    const s = w < 0 ? 0 : w;
    const ang = -Math.PI / 2 + (i - 3.5) * 0.36;
    const d = (10 + s * 70 * spread) * k;
    return [{ translateX: x + Math.cos(ang) * d * 1.3 }, { translateY: y + Math.sin(ang) * d * (0.5 + 0.12 * (i % 3)) + s * s * 30 * k }, { scale: 0.6 + s * 2.2 }];
  });
  const op = useDerivedValue(() => {
    const w = f.value[key0];
    return w < 0 ? 0 : Math.sin(Math.min(1, w * 1.1) * Math.PI) * 0.6;
  });
  return (
    <Group transform={tr} opacity={op}>
      <Oval x={-16 * k} y={-9 * k} width={32 * k} height={18 * k} color={color} />
    </Group>
  );
}

// Vurucu halkaları
function Ring({ f, L, i, c }) {
  const tr = useDerivedValue(() => {
    const ph = (f.value.pulse + i / 3) % 1;
    return [{ translateX: L.tx }, { translateY: L.ty + 1 * L.k }, { scaleX: 1 + ph * 9 }, { scaleY: 1 + ph * 2.6 }];
  });
  const op = useDerivedValue(() => {
    const ph = (f.value.pulse + i / 3) % 1;
    return f.value.thump * (1 - ph) * 0.75;
  });
  return (
    <Group transform={tr} opacity={op}>
      <Oval x={-6 * L.k} y={-2 * L.k} width={12 * L.k} height={4 * L.k} style="stroke" strokeWidth={0.5 * L.k} color={c.sandLit} />
    </Group>
  );
}

// Solucan omurgası (worklet): yol üzerindeki baş uzaklığı → gövde kenarları, halkalar, ışık/gölge şeritleri.
// Gövde tek parça; yol boyunca akar ve üstüne yürüyen bir yanal dalga biner (zemin geçişlerinde sönümlü).
function trackAt(T, s) {
  "worklet";
  const n = T.pts.length / 2 - 1;
  let f = s / T.ds;
  if (f < 0) f = 0;
  if (f > n - 0.0001) f = n - 0.0001;
  const i = Math.floor(f);
  const r = f - i;
  const P = T.pts;
  return [P[2 * i] + (P[2 * i + 2] - P[2 * i]) * r, P[2 * i + 1] + (P[2 * i + 3] - P[2 * i + 1]) * r];
}

function wormSpine(T, R, k, q, clock) {
  "worklet";
  const body = Skia.Path.Make();
  const lit = Skia.Path.Make();
  const shade = Skia.Path.Make();
  const rings = Skia.Path.Make();
  const ringsLit = Skia.Path.Make();
  const sand = Skia.Path.Make();
  const out = { body, lit, shade, rings, ringsLit, sand, on: 0, hx: -9999, hy: 0, ang: -Math.PI / 2, head: 0, c1: 0, c2: 0 };
  if (q.u > 1 || q.rise <= 0.001) return out;
  let g = (q.u - 0.56) / 0.13;
  g = g < 0 ? 0 : g > 1 ? 1 : g;
  g = g < 0.5 ? 2 * g * g : 1 - 2 * (1 - g) * (1 - g);
  const sHead = T.sg1 - R + q.rise * (T.sApex - T.sg1 + R) + g * T.travel;
  const sTail = sHead - T.Lw;
  const sMax = Math.min(sHead, T.sg2 + 1.6 * R);
  const sMin = Math.max(sTail, T.sg1 - 1.6 * R);
  if (sMax <= sMin + R * 0.3) return out;
  const n = Math.max(2, Math.ceil((sMax - sMin) / (R * 0.22)));
  const step = (sMax - sMin) / n;
  // 1) yol noktaları
  const bx = [];
  const by = [];
  for (let i = 0; i <= n; i += 1) {
    const pt = trackAt(T, sMax - i * step);
    bx.push(pt[0]);
    by.push(pt[1]);
  }
  // 2) yanal dalga (yürüyen kıvrım) — zemin geçişlerinde ve başta sönümlü
  const amp = R * (0.24 - 0.1 * g);
  const t = clock.value;
  const xs = [];
  const ys = [];
  for (let i = 0; i <= n; i += 1) {
    const s = sMax - i * step;
    const m = sHead - s;
    const a = i === 0 ? 0 : i - 1;
    const b = i === n ? n : i + 1;
    let tx = bx[a] - bx[b];
    let ty = by[a] - by[b];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    const e1 = Math.min(1, Math.max(0, (s - T.sg1) / (2.6 * R)));
    const e2 = Math.min(1, Math.max(0, (T.sg2 - s) / (2.6 * R)));
    const eh = Math.min(1, m / (1.4 * R));
    const off = amp * e1 * e2 * (0.35 + 0.65 * eh) * Math.sin(t * 1.9 - m / (2.1 * R));
    xs.push(bx[i] - ty * off);
    ys.push(by[i] + tx * off);
  }
  // 3) kenarlar
  const nx = [];
  const ny = [];
  const tX = [];
  const tY = [];
  const ws = [];
  for (let i = 0; i <= n; i += 1) {
    const a = i === 0 ? 0 : i - 1;
    const b = i === n ? n : i + 1;
    let tx = xs[a] - xs[b];
    let ty = ys[a] - ys[b];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    tX.push(tx);
    tY.push(ty);
    nx.push(-ty);
    ny.push(tx);
    const m = sHead - (sMax - i * step);
    const tl = (T.Lw - m) / (3.2 * R);
    const taper = tl >= 1 ? 1 : 0.28 + 0.72 * Math.sqrt(tl < 0 ? 0 : tl);
    ws.push(R * (1 + 0.3 * Math.min(1, m / (4.5 * R))) * taper);
  }
  const band = (path, f0, f1) => {
    for (let i = 0; i <= n; i += 1) {
      const x = xs[i] + nx[i] * ws[i] * f0;
      const y = ys[i] + ny[i] * ws[i] * f0;
      if (i === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    }
    for (let i = n; i >= 0; i -= 1) path.lineTo(xs[i] + nx[i] * ws[i] * f1, ys[i] + ny[i] * ws[i] * f1);
    path.close();
  };
  band(body, 1, -1);
  band(lit, 0.82, 0.18);
  band(shade, -0.5, -1);
  // 4) gövdeye sabit halkalar (gövdeyle birlikte akar) + alt kenardan dökülen kum
  let j = 0;
  for (let m = R * 0.42; m < T.Lw; m += R * 0.34) {
    j += 1;
    const s = sHead - m;
    if (s > sMax || s < sMin) continue;
    const fi = (sMax - s) / step;
    const i0 = Math.min(n - 1, Math.floor(fi));
    const r = fi - i0;
    const cx = xs[i0] + (xs[i0 + 1] - xs[i0]) * r;
    const cy = ys[i0] + (ys[i0 + 1] - ys[i0]) * r;
    const w = ws[i0] + (ws[i0 + 1] - ws[i0]) * r;
    const ex = nx[i0];
    const ey = ny[i0];
    const fx = tX[i0];
    const fy = tY[i0];
    const bulge = R * 0.26;
    rings.moveTo(cx + ex * w, cy + ey * w);
    rings.quadTo(cx - fx * bulge, cy - fy * bulge, cx - ex * w, cy - ey * w);
    const o = R * 0.1;
    ringsLit.moveTo(cx + ex * w * 0.92 + fx * o, cy + ey * w * 0.92 + fy * o);
    ringsLit.quadTo(
      cx + ex * w * 0.5 - fx * bulge * 0.7 + fx * o,
      cy + ey * w * 0.5 - fy * bulge * 0.7 + fy * o,
      cx + ex * w * 0.08 - fx * bulge * 0.95 + fx * o,
      cy + ey * w * 0.08 - fy * bulge * 0.95 + fy * o,
    );
    if (j % 2 === 0) {
      const lo = ey > 0 ? 1 : -1;
      const sx = cx + ex * w * lo;
      const sy = cy + ey * w * lo;
      const ph = (t * 0.9 + j * 0.37) % 1;
      const y0 = sy + ph * 46 * k;
      sand.moveTo(sx, y0);
      sand.lineTo(sx + 0.6 * k, y0 + (4 + 10 * (1 - ph)) * k);
    }
  }
  out.on = 1;
  out.hx = xs[0];
  out.hy = ys[0];
  out.ang = Math.atan2(tY[0], tX[0]);
  out.head = sHead <= sMax + 0.5 ? 1 : 0;
  out.c1 = sHead > T.sg1 - R && sTail < T.sg1 ? 1 : 0;
  out.c2 = sHead > T.sg2 - 0.6 * R && sTail < T.sg2 ? 1 : 0;
  return out;
}

// Yol üzerinde nokta (worklet): düz [x0,y0,x1,y1…]
function along(pts, s) {
  "worklet";
  const n = pts.length / 2 - 1;
  let f = s * n;
  if (f < 0) f = 0;
  if (f > n - 0.0001) f = n - 0.0001;
  const i = Math.floor(f);
  const r = f - i;
  return [pts[2 * i] + (pts[2 * i + 2] - pts[2 * i]) * r, pts[2 * i + 1] + (pts[2 * i + 3] - pts[2 * i + 1]) * r];
}

export default function DuneScene({ p, clock, width, height, tone }) {
  const c = toneMap(tone.colors);
  const L = duneLayout(width, height);
  const { k } = L;
  const light = c.moon === "#fff8e8";
  const geo = useMemo(() => ({
    dunes: buildDunes(L, width, height),
    above: buildAboveMid(L, width),
    rocks: buildRocks(L, width),
    stars: buildStars(width, height),
    head: buildWormHead(L.R),
    track: buildWormTrack(L, width),
    ride: buildRideWorm(k),
    craters: [[-0.3, -0.25, 0.22], [0.25, 0.1, 0.16], [-0.1, 0.35, 0.12], [0.35, -0.35, 0.1], [-0.45, 0.2, 0.09]],
    // Fremen yolları: kaya tepesi → vurucu; vurucu → seyir yeri
    walkIn: (() => {
      const pts = [L.rock.x0 + (L.rock.x1 - L.rock.x0) * 0.45, L.rock.top, L.rock.x0 + (L.rock.x1 - L.rock.x0) * 0.62, L.rock.top + 14 * k, L.rock.x1 - 14 * k, L.rock.top + 56 * k];
      const xs = L.rock.x1 + 4 * k;
      for (let x = xs; x <= L.tx - 12 * k; x += 6 * k) pts.push(x, duneY(x, width, L.layers[1]));
      return pts;
    })(),
    walkOut: (() => {
      const pts = [];
      for (let x = L.tx - 12 * k; x >= L.tx - 78 * k; x -= 6 * k) pts.push(x, duneY(x, width, L.layers[1]));
      return pts;
    })(),
  }), [width, height]);
  const W = geo.head;
  const T = geo.track;
  const R = L.R;
  const f = useDerivedValue(() => duneFrame(p, clock.value));
  const spine = useDerivedValue(() => wormSpine(T, R, k, f.value, clock));

  // sarsıntı
  const shakeT = useDerivedValue(() => {
    const s = f.value.shake;
    return [{ translateX: Math.sin(clock.value * 47) * 1.6 * k * s }, { translateY: Math.sin(clock.value * 61) * 1.1 * k * s }];
  });
  const starO = useDerivedValue(() => (light ? 0 : 0.55 + 0.15 * Math.sin(clock.value * 0.7)));

  // Fremen
  const man = useDerivedValue(() => {
    const q = f.value;
    const u = q.u;
    if (u > 1 || u < 0.02) {
      const pt = geo.walkIn;
      return { x: pt[0], y: pt[1], face: 1, walk: 0, o: 1 };
    }
    if (u < 0.12) {
      const [x, y] = along(geo.walkIn, q.walk);
      return { x, y, face: 1, walk: 1, o: 1 };
    }
    if (u < 0.16) {
      const n = geo.walkIn.length;
      return { x: geo.walkIn[n - 2], y: geo.walkIn[n - 1], face: 1, walk: 0, o: 1 };
    }
    if (u < 0.565) {
      const [x, y] = along(geo.walkOut, q.back);
      return { x, y, face: q.back < 1 ? -1 : 1, walk: q.back > 0 && q.back < 1 ? 1.2 : 0, o: 1 };
    }
    if (q.leap >= 0) {
      const n = geo.walkOut.length;
      const x0 = geo.walkOut[n - 2];
      const y0 = geo.walkOut[n - 1];
      const ps = spine.value;
      const s = q.leap;
      const x = x0 + (ps.hx - 10 * k - x0) * s;
      const y = y0 + (ps.hy - 26 * k - y0) * s - Math.sin(s * Math.PI) * 50 * k;
      return { x, y, face: 1, walk: 0.4, o: 1 - Math.max(0, (s - 0.85) / 0.15) };
    }
    return { x: -500, y: 0, face: 1, walk: 0, o: 0 };
  });
  const manX = useDerivedValue(() => man.value.x);
  const manY = useDerivedValue(() => man.value.y);
  const manFace = useDerivedValue(() => man.value.face);
  const manWalk = useDerivedValue(() => man.value.walk);
  const manO = useDerivedValue(() => man.value.o);

  // vurucu
  const thumpO = useDerivedValue(() => {
    const q = f.value;
    return q.u > 1 ? 0 : q.plant * (q.u < 0.42 ? 1 : Math.max(0, 1 - (q.u - 0.42) / 0.02));
  });
  const thumpT = useDerivedValue(() => {
    const q = f.value;
    const hit = q.thump > 0 ? Math.pow(1 - ((q.pulse * 3) % 1), 6) : 0;
    return [{ translateX: L.tx }, { translateY: L.ty - (1 - q.plant) * 20 * k - hit * 2.4 * k }];
  });

  // kabaran iz (uzaktan yaklaşır)
  const wakeT = useDerivedValue(() => {
    const w = f.value.wake;
    const x = width + 60 * k + (L.tx - width - 60 * k) * w;
    return [{ translateX: x }, { translateY: L.ty + 4 * k }];
  });
  const wakeO = useDerivedValue(() => (f.value.wake > 0 && f.value.wake < 1 ? Math.min(1, f.value.wake * 5) * 0.85 : 0));

  // yükselen solucan: tek parça, kıvrılan gövde (wormSpine)
  const bodyP = useDerivedValue(() => spine.value.body);
  const litP = useDerivedValue(() => spine.value.lit);
  const shadeP = useDerivedValue(() => spine.value.shade);
  const ringsP = useDerivedValue(() => spine.value.rings);
  const ringsLitP = useDerivedValue(() => spine.value.ringsLit);
  const sandP = useDerivedValue(() => spine.value.sand);
  const wormO = useDerivedValue(() => spine.value.on);
  const headT = useDerivedValue(() => {
    const sp = spine.value;
    return [{ translateX: sp.hx }, { translateY: sp.hy }, { rotate: sp.ang + Math.PI / 2 }];
  });
  const headO = useDerivedValue(() => spine.value.head);
  const openO = useDerivedValue(() => Math.min(1, f.value.open * 1.6));
  const closedO = useDerivedValue(() => 1 - Math.min(1, f.value.open * 2.2));
  const domeT = useDerivedValue(() => [{ scaleY: 1 - 0.85 * Math.min(1, f.value.open * 1.6) }, { scaleX: 1 - 0.1 * f.value.open }]);
  const throatT = useDerivedValue(() => {
    const o = f.value.open;
    return [{ scale: (0.12 + 0.88 * o) * (1 + 0.025 * Math.sin(clock.value * 5) * o) }];
  });
  const teethT = useDerivedValue(() => [{ scale: 1 + 0.06 * Math.sin(clock.value * 3.2) * f.value.open }]);
  const fallT = useDerivedValue(() => [{ translateY: ((clock.value * 1.6) % 1) * R * 0.9 }]);
  const fallO = useDerivedValue(() => {
    const q = f.value;
    return q.rise > 0.2 && q.u < 0.6 ? 0.55 * (1 - Math.max(0, (q.u - 0.55) / 0.05)) : 0;
  });
  const sandO = useDerivedValue(() => (f.value.rise > 0.15 ? 0.7 : 0));
  const collar1 = useDerivedValue(() => spine.value.c1 * 0.95);
  const collar2 = useDerivedValue(() => spine.value.c2 * 0.95);
  const collarT1 = useDerivedValue(() => [{ translateX: L.tx }, { translateY: L.ty + 6 * k }, { scaleX: 1 + 0.04 * Math.sin(clock.value * 7 + 1) }]);
  const collarT2 = useDerivedValue(() => [{ translateX: T.diveX }, { translateY: T.diveY - 4 * k }, { scaleX: 1 + 0.04 * Math.sin(clock.value * 7) }]);

  // sırtta akan solucan
  const rideT = useDerivedValue(() => {
    const r = f.value.ride;
    if (r < 0) return [{ translateX: -2000 }];
    const x = width + 40 * k - r * (width + geo.ride.len + 120 * k);
    const sink = r < 0.07 ? 1 - r / 0.07 : r > 0.9 ? (r - 0.9) / 0.1 : 0;
    return [{ translateX: x }, { translateY: L.rideY + sink * sink * 20 * k + Math.sin(clock.value * 3) * 1 * k }];
  });
  const riderT = useDerivedValue(() => [{ translateX: 40 * k }, { translateY: -16 * k + Math.sin(clock.value * 3 + 1) * 1.2 * k }, { scale: k * 0.8 }]);
  const sprayO = useDerivedValue(() => 0.5 + 0.2 * Math.sin(clock.value * 9));

  const lit = rgba(c.sandLit, 0.9);
  return (
    <Group transform={shakeT}>
      {/* gök: yıldızlar, aylar, ufuk pusu */}
      <Group opacity={starO}>
        <Path path={geo.stars} color={c.star} />
      </Group>
      <Circle cx={L.moon.x} cy={L.moon.y} r={L.moon.r * 2.6}>
        <RadialGradient c={vec(L.moon.x, L.moon.y)} r={L.moon.r * 2.6} colors={[rgba(c.moon, light ? 0.25 : 0.16), rgba(c.moon, 0)]} />
      </Circle>
      <Circle cx={L.moon.x} cy={L.moon.y} r={L.moon.r}>
        <LinearGradient start={vec(L.moon.x + L.moon.r, L.moon.y - L.moon.r)} end={vec(L.moon.x - L.moon.r, L.moon.y + L.moon.r)} colors={[c.moon, rgba(c.moon, light ? 0.55 : 0.75)]} />
      </Circle>
      {geo.craters.map(([cx, cy, r], i) => (
        <Circle key={i} cx={L.moon.x + cx * L.moon.r} cy={L.moon.y + cy * L.moon.r} r={r * L.moon.r} color={rgba(c.rockLit, light ? 0.18 : 0.22)} />
      ))}
      <Circle cx={L.moon2.x} cy={L.moon2.y} r={L.moon2.r} color={rgba(c.moon, light ? 0.6 : 0.85)} />
      <Circle cx={L.moon2.x - L.moon2.r * 0.35} cy={L.moon2.y - L.moon2.r * 0.1} r={L.moon2.r * 0.75} color={rgba(c.rock, light ? 0.12 : 0.5)} />
      {[0, 1].map((i) => (
        <Ornithopter key={i} clock={clock} i={i} width={width} height={height} k={k} c={c} />
      ))}

      <Group opacity={tone.alpha}>
        <Path path={`M0 ${L.horizon - 110 * k} L${width} ${L.horizon - 110 * k} L${width} ${L.horizon + 30 * k} L0 ${L.horizon + 30 * k} Z`}>
          <LinearGradient start={vec(0, L.horizon - 110 * k)} end={vec(0, L.horizon + 10 * k)} colors={[rgba(c.haze, 0), rgba(c.haze, light ? 0.35 : 0.22)]} />
        </Path>
        <Path path={geo.rocks.shield} color={rgba(c.rock, light ? 0.55 : 0.85)} />
        <Path path={geo.rocks.shield} style="stroke" strokeWidth={0.8 * k} color={rgba(c.rockLit, 0.35)} />

        {/* uzak tepe */}
        <DuneLayer d={geo.dunes[0]} c={c} k={k} top={L.layers[0].base - L.layers[0].amp} bottom={L.layers[0].base + 30 * k} lit={lit} />
        <Harvester L={L} clock={clock} c={c} />
        {/* uzak sırtta solucan sürme */}
        <Group transform={rideT}>
          <Path path={geo.ride.trail} color={rgba(c.sandLit, 0.35)} />
          <Path path={geo.ride.humps}>
            <LinearGradient start={vec(0, -16 * k)} end={vec(0, 4 * k)} colors={[c.worm, rgba(c.sandDeep, 1)]} />
          </Path>
          <Path path={geo.ride.ridges} style="stroke" strokeWidth={1.1 * k} color={rgba(c.sandDeep, 0.85)} />
          <Path path={geo.ride.humps} style="stroke" strokeWidth={0.9 * k} color={rgba(c.sandLit, 0.55)} />
          <Group opacity={sprayO}>
            <Path path={geo.ride.spray} color={rgba(c.sandLit, 0.75)} />
          </Group>
          <Path path={`M${40 * k} ${-14 * k} L${30 * k} ${-12 * k} M${40 * k} ${-14 * k} L${56 * k} ${-11 * k}`} style="stroke" strokeWidth={0.7 * k} color={c.cloth} />
          <Group transform={riderT}>
            <FremenStatic c={c} />
          </Group>
        </Group>

        {/* gözcü kayası */}
        <Path path={geo.rocks.body}>
          <LinearGradient start={vec(0, L.rock.top)} end={vec(0, L.ground)} colors={[c.rock, rgba(c.sandDeep, 1)]} />
        </Path>
        <Path path={geo.rocks.lit} color={rgba(c.rockLit, 0.7)} />
        <Path path={geo.rocks.strata} style="stroke" strokeWidth={0.8 * k} color="rgba(0,0,0,0.22)" />
        <Path path={geo.rocks.cave} color="#120a06" />
        <Circle cx={geo.rocks.cave0[0]} cy={geo.rocks.cave0[1]} r={9 * k}>
          <RadialGradient c={vec(geo.rocks.cave0[0], geo.rocks.cave0[1])} r={9 * k} colors={["rgba(255,170,80,0.55)", "rgba(255,120,40,0)"]} />
        </Circle>

        {/* orta tepe (vurucu burada) */}
        <DuneLayer d={geo.dunes[1]} c={c} k={k} top={L.layers[1].base - L.layers[1].amp} bottom={L.layers[1].base + 40 * k} lit={lit} />
      </Group>

      {/* kabaran iz */}
      <Group opacity={wakeO} transform={wakeT}>
        <Path path={`M${-46 * k} 0 C${-30 * k} ${-3 * k} ${-14 * k} ${-9 * k} 0 ${-8 * k} C${14 * k} ${-7 * k} ${36 * k} ${-2 * k} ${60 * k} 0 Z`} color={rgba(c.sandLit, 0.8)} />
        <Oval x={-18 * k} y={-16 * k} width={36 * k} height={12 * k} color={rgba(c.sandLit, 0.35)} />
        <Oval x={10 * k} y={-12 * k} width={50 * k} height={10 * k} color={rgba(c.sandLit, 0.22)} />
      </Group>

      {/* vurucu + halkalar */}
      {[0, 1, 2].map((i) => (
        <Ring key={i} f={f} L={L} i={i} c={c} />
      ))}
      <Group opacity={thumpO} transform={thumpT}>
        <Path path={`M${-1.4 * k} 0 L${-1.4 * k} ${-15 * k} L${1.4 * k} ${-15 * k} L${1.4 * k} 0 Z`} color={c.metal} />
        <Path path={`M${-3 * k} ${-15 * k} L${3 * k} ${-15 * k} L${2.2 * k} ${-19 * k} L${-2.2 * k} ${-19 * k} Z`} color={c.metal} />
        <Path path={`M${-2.6 * k} ${-11 * k} L${2.6 * k} ${-11 * k}`} style="stroke" strokeWidth={1 * k} color={rgba(c.spice, 0.8)} />
      </Group>

      {/* yükselen solucan (orta tepenin üstünde kesilir): tek parça, kıvrılan gövde */}
      <Group clip={geo.above} opacity={wormO}>
        <Path path={bodyP} color={c.worm} />
        <Path path={shadeP} color={rgba(c.sandDeep, 0.75)} />
        <Path path={litP} color={rgba(c.sandLit, 0.32)} />
        <Path path={ringsP} style="stroke" strokeWidth={1.5 * k} color="rgba(30,16,8,0.55)" />
        <Path path={ringsLitP} style="stroke" strokeWidth={0.9 * k} strokeCap="round" color={rgba(c.sandLit, 0.55)} />
        <Path path={bodyP} style="stroke" strokeWidth={1 * k} color="rgba(30,16,8,0.35)" />
        <Group opacity={sandO}>
          <Path path={sandP} style="stroke" strokeWidth={1.2 * k} strokeCap="round" color={c.sandLit} />
        </Group>
        {/* baş: kapaksız dairesel ağız */}
        <Group transform={headT} opacity={headO}>
          <Path path={W.rim} color={c.worm} />
          <Group opacity={openO}>
            <Group transform={throatT}>
              <Oval x={-R * 0.94} y={-R * 0.56} width={R * 1.88} height={R * 1.12}>
                <RadialGradient c={vec(0, R * 0.05)} r={R * 0.94} colors={["#ffbf66", "#d2541f", "#5a1408", "#1a0503"]} positions={[0, 0.14, 0.48, 1]} />
              </Oval>
              <Path path={W.gullet} style="stroke" strokeWidth={1.1 * k} color="rgba(255,140,70,0.28)" />
              <Group transform={teethT}>
                <Path path={W.teeth} color="#efe2c4" />
                <Path path={W.teeth} style="stroke" strokeWidth={0.4 * k} color="rgba(90,50,30,0.45)" />
              </Group>
            </Group>
          </Group>
          <Path path={W.rim} style="stroke" strokeWidth={3.2 * k} color={c.worm} />
          <Path path={W.rim} style="stroke" strokeWidth={1.4 * k} color={rgba(c.sandLit, 0.75)} />
          {/* kapalı burun: büzülmüş kubbe */}
          <Group opacity={closedO} transform={domeT}>
            <Path path={W.dome}>
              <LinearGradient start={vec(-R, 0)} end={vec(R, 0)} colors={[rgba(c.sandDeep, 1), c.worm, rgba(c.sandLit, 0.95)]} positions={[0, 0.5, 1]} />
            </Path>
            <Path path={W.pucker} style="stroke" strokeWidth={0.9 * k} color="rgba(40,20,10,0.45)" />
            <Path path={W.knot} color="rgba(30,12,6,0.7)" />
          </Group>
          <Group opacity={fallO}>
            <Group transform={fallT}>
              <Path path={W.sandFall} style="stroke" strokeWidth={1.3 * k} strokeCap="round" color={c.sandLit} />
            </Group>
          </Group>
        </Group>
      </Group>
      {/* gövdenin kumdan geçtiği yerlerde kabaran kum yakası */}
      {[[collar1, collarT1], [collar2, collarT2]].map(([o, tr], i) => (
        <Group key={`c${i}`} opacity={o} transform={tr}>
          <Path path={`M${-1.9 * R} 0 C${-1.4 * R} ${-0.34 * R} ${-0.6 * R} ${-0.22 * R} 0 ${-0.2 * R} C${0.6 * R} ${-0.22 * R} ${1.4 * R} ${-0.34 * R} ${1.9 * R} 0 Z`} color={rgba(c.sandLit, 0.92)} />
          <Path path={`M${-1.5 * R} ${-0.08 * R} C${-0.8 * R} ${-0.2 * R} ${0.8 * R} ${-0.2 * R} ${1.5 * R} ${-0.08 * R}`} style="stroke" strokeWidth={0.8 * k} color={rgba(c.sandShade, 0.6)} />
        </Group>
      ))}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <Burst key={`r${i}`} f={f} key0="burst" x={L.tx} y={L.ty + 4 * k} k={k} i={i} color={rgba(c.sandLit, 0.9)} />
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Burst key={`d${i}`} f={f} key0="dive" x={T.diveX} y={T.diveY - 6 * k} k={k} i={i + 1} color={rgba(c.sandLit, 0.9)} spread={0.8} />
      ))}

      {/* Fremen */}
      <Group opacity={manO}>
        <Fremen x={manX} y={manY} k={k} face={manFace} walk={manWalk} clock={clock} c={c} />
      </Group>

      {/* ön tepe */}
      <Group opacity={tone.alpha}>
        <DuneLayer d={geo.dunes[2]} c={c} k={k} top={L.layers[2].base - L.layers[2].amp} bottom={height} lit={lit} front />
      </Group>
    </Group>
  );
}

function FremenStatic({ c }) {
  return (
    <Group>
      <Path path={FREMEN_CAPE} color={rgba(c.cloth, 0.9)} />
      <Path path="M-2 -7 L-3 0 M2 -7 L3 0" style="stroke" strokeWidth={2.4} strokeCap="round" color={c.cloth} />
      <Path path={FREMEN_ROBE} color={c.cloth} />
      <Path path={FREMEN_HOOD} color={c.cloth} />
      <Path path={FREMEN_FACE} color={rgba(c.sandShade, 0.95)} />
      <Path path="M3 -17 L12 -8 M-3 -17 L-12 -9" style="stroke" strokeWidth={1.6} strokeCap="round" color={c.cloth} />
    </Group>
  );
}

function DuneLayer({ d, c, k, top, bottom, lit, front }) {
  return (
    <Group>
      <Path path={d.body}>
        <LinearGradient start={vec(0, top)} end={vec(0, bottom)} colors={front ? [c.sandShade, rgba(c.sandDeep, 1)] : [c.sand, c.sandShade, rgba(c.sandDeep, 1)]} />
      </Path>
      <Group clip={d.body}>
        <Path path={d.lit}>
          <LinearGradient start={vec(0, top)} end={vec(0, top + 50 * k)} colors={[lit, rgba(c.sandLit, front ? 0.25 : 0.12)]} />
        </Path>
      </Group>
      <Path path={d.ripples} style="stroke" strokeWidth={0.7 * k} color={rgba(c.sandLit, front ? 0.28 : 0.18)} />
      <Group transform={[{ translateY: 1.2 * k }]}>
        <Path path={d.ripples} style="stroke" strokeWidth={0.7 * k} color="rgba(0,0,0,0.12)" />
      </Group>
      <Path path={d.crestLine} style="stroke" strokeWidth={1.1 * k} color={rgba(c.sandLit, 0.75)} />
    </Group>
  );
}
