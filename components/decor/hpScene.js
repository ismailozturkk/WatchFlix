// components/decor/hpScene.js
//
// Harry Potter atmosfer sahnesi (OVERLAY.hogwarts = 33) — tamamı VEKTÖR:
//   • Kara Göl kıyısında gece: arkada sıradağlar, sağda kayalık yarın üstünde Hogwarts (konik arduvaz
//     çatılı kuleler, en yüksekte Astronomi Kulesi, uzun sivri pencereli Büyük Salon, mazgallı ana
//     yapı, üstü örtülü ahşap köprü), titreşen sıcak pencereler; ayın ve pencerelerin göldeki
//     yansıması, dalga çizgileri, fenerli kayıklar; solda Yasak Orman çamları, önde taşlı kıyı.
//   • Olay (hpFrame, 30 sn): Ruh Emiciler gökten süzülür, gök kararır, göl kıyıdan içe doğru donar,
//     pencereler söner → kıyıdaki Harry asasını kaldırır, ucu parlar → gümüş ışık patlaması →
//     PATRONUS (ışıldayan geyik) gölün üstünden dörtnala koşar, ardında ışık izi → Ruh Emiciler
//     kaçıp dağılır → geyik şatoya doğru sıçrayıp ışık zerrelerine dönüşür, buz çözülür, ışıklar yanar.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift (sekme çubuğu). Renkler OVERLAY_TONES[33] (HP_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Circle, Group, LinearGradient, Oval, Path, RadialGradient, Skia, vec } from "@shopify/react-native-skia";
import { HpEventB } from "./sceneEventsB";
import { hpFrame, sceneScale } from "../../utils/weatherParticles";
import { SCENERY } from "../../utils/weatherUniverses";

const HP_TONE = ["castle", "castleLit", "roof", "window", "lake", "lakeLit", "hill", "forest", "moon", "silver", "dementor", "frost", "shore", "night", "glow"];
const toneMap = (colors) => Object.fromEntries(HP_TONE.map((name, i) => [name, colors[i] || colors[0]]));

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

// Kuleler: [merkez x (W), genişlik, yükseklik (yar tepesinden), çatı yüksekliği]
const TOWERS = [
  [0.47, 14, 92, 30],
  [0.56, 12, 132, 36],
  [0.635, 17, 236, 54], // Astronomi Kulesi
  [0.745, 21, 168, 46],
  [0.82, 14, 196, 42],
  [0.9, 22, 146, 48],
  [0.975, 14, 112, 34],
];

/** Sahne yerleşimi (dp). */
export function hpLayout(width, height) {
  const k = sceneScale(width, height);
  const ground = height - SCENERY.lift * k;
  const horizon = ground - 150 * k;
  const cliffTop = ground - 214 * k;
  const harry = [width * 0.17, ground - 40 * k];
  return {
    k, ground, horizon, cliffTop, harry,
    hall: { x0: width * 0.52, x1: width * 0.7, h: 64 * k },
    keep: { x0: width * 0.7, x1: width * 0.87, h: 112 * k },
    moon: { x: width * 0.24, y: height * 0.14, r: 30 * k },
    stagY: ground - 70 * k,
  };
}

function buildLand(L, width) {
  const { k, ground, horizon, cliffTop } = L;
  const hills = Skia.Path.Make();
  hills.moveTo(-10, horizon + 2);
  for (let i = 0; i <= 12; i += 1) {
    const x = (width * i) / 12;
    const h = (60 + hash(i, 1) * 110 + (i > 5 ? 50 : 0)) * k;
    hills.quadTo(x - width / 24, horizon - h * 1.1, x, horizon - h * 0.8);
  }
  hills.lineTo(width + 10, horizon + 2);
  hills.close();
  // yar (şatonun oturduğu kaya)
  const cliff = Skia.Path.Make();
  cliff.moveTo(width * 0.4, horizon + 4 * k);
  cliff.lineTo(width * 0.43, cliffTop + 46 * k);
  cliff.lineTo(width * 0.46, cliffTop + 40 * k);
  cliff.lineTo(width * 0.5, cliffTop + 6 * k);
  cliff.lineTo(width * 0.6, cliffTop);
  cliff.lineTo(width + 10, cliffTop - 6 * k);
  cliff.lineTo(width + 10, ground - 40 * k);
  cliff.lineTo(width * 0.78, ground - 54 * k);
  cliff.lineTo(width * 0.62, horizon + 30 * k);
  cliff.close();
  const cliffLit = Skia.Path.Make();
  for (let i = 0; i < 9; i += 1) {
    const x = width * (0.46 + i * 0.06);
    cliffLit.moveTo(x, cliffTop + (10 + hash(i, 2) * 20) * k);
    cliffLit.lineTo(x + 6 * k, cliffTop + (40 + hash(i, 3) * 50) * k);
  }
  // orman (sol kıyı), kıyı
  const forest = Skia.Path.Make();
  for (let i = 0; i < 16; i += 1) {
    const x = width * (-0.02 + i * 0.03) + hash(i, 4) * 6 * k;
    const base = horizon + (2 + hash(i, 5) * 8) * k;
    const h = (30 + hash(i, 6) * 34) * k;
    const w = h * 0.32;
    forest.moveTo(x - w, base);
    for (let j = 0; j < 4; j += 1) {
      const yy = base - (h * (j + 1)) / 4;
      forest.lineTo(x - w * (1 - j * 0.22) * 0.6, yy + h * 0.06);
      forest.lineTo(x - w * (1 - (j + 1) * 0.22), yy + h * 0.06);
    }
    forest.lineTo(x, base - h);
    for (let j = 3; j >= 0; j -= 1) {
      const yy = base - (h * (j + 1)) / 4;
      forest.lineTo(x + w * (1 - (j + 1) * 0.22), yy + h * 0.06);
      forest.lineTo(x + w * (1 - j * 0.22) * 0.6, yy + h * 0.06);
    }
    forest.lineTo(x + w, base);
    forest.close();
  }
  const shore = Skia.Path.Make();
  shore.moveTo(-10, ground - 46 * k);
  shore.quadTo(width * 0.12, ground - 52 * k, width * 0.26, ground - 24 * k);
  shore.quadTo(width * 0.36, ground - 6 * k, width * 0.5, ground + 4 * k);
  shore.lineTo(width * 0.5, ground + 400);
  shore.lineTo(-10, ground + 400);
  shore.close();
  const stones = Skia.Path.Make();
  for (let i = 0; i < 8; i += 1) {
    const x = width * (0.02 + i * 0.055);
    const y = ground - (40 - i * 4.4) * k + hash(i, 7) * 6 * k;
    stones.addOval(Skia.XYWHRect(x, y, (8 + hash(i, 8) * 10) * k, (4 + hash(i, 9) * 4) * k));
  }
  // göl dalgaları
  const ripples = Skia.Path.Make();
  for (let i = 0; i < 22; i += 1) {
    const x = width * hash(i, 10);
    const y = horizon + (8 + hash(i, 11) * 120) * k;
    const w = (10 + hash(i, 12) * 30) * k;
    ripples.moveTo(x, y);
    ripples.quadTo(x + w / 2, y - 1.4 * k, x + w, y);
  }
  return { hills, cliff, cliffLit, forest, shore, stones, ripples };
}

function buildCastle(L, width) {
  const { k, cliffTop } = L;
  const body = Skia.Path.Make();
  const roofs = Skia.Path.Make();
  const wins = [Skia.Path.Make(), Skia.Path.Make(), Skia.Path.Make()];
  const lit = Skia.Path.Make();
  const arch = (path, x, y, w, h) => {
    path.moveTo(x, y + h);
    path.lineTo(x, y + w * 0.6);
    path.quadTo(x + w / 2, y - w * 0.4, x + w, y + w * 0.6);
    path.lineTo(x + w, y + h);
    path.close();
  };
  // ana yapı (mazgallı)
  const K = L.keep;
  body.addRect(Skia.XYWHRect(K.x0, cliffTop - K.h, K.x1 - K.x0, K.h + 4 * k));
  for (let x = K.x0; x < K.x1 - 3 * k; x += 7 * k) body.addRect(Skia.XYWHRect(x, cliffTop - K.h - 5 * k, 4 * k, 5 * k));
  // Büyük Salon (beşik çatı, uzun pencereler)
  const H = L.hall;
  body.addRect(Skia.XYWHRect(H.x0, cliffTop - H.h, H.x1 - H.x0, H.h + 4 * k));
  roofs.moveTo(H.x0 - 3 * k, cliffTop - H.h);
  roofs.lineTo(H.x0 + 8 * k, cliffTop - H.h - 30 * k);
  roofs.lineTo(H.x1 - 8 * k, cliffTop - H.h - 30 * k);
  roofs.lineTo(H.x1 + 3 * k, cliffTop - H.h);
  roofs.close();
  for (let x = H.x0 + 6 * k; x < H.x1 - 10 * k; x += 11 * k) arch(wins[0], x, cliffTop - H.h + 12 * k, 5 * k, 30 * k);
  // kuleler
  TOWERS.forEach(([fx, w0, h0, r0], i) => {
    const cx = width * fx;
    const w = w0 * k;
    const top = cliffTop - h0 * k;
    body.addRect(Skia.XYWHRect(cx - w / 2, top, w, h0 * k + 4 * k));
    // çıkma (korniş)
    body.addRect(Skia.XYWHRect(cx - w / 2 - 2 * k, top - 3 * k, w + 4 * k, 4 * k));
    roofs.moveTo(cx - w / 2 - 3 * k, top - 3 * k);
    roofs.quadTo(cx - w * 0.2, top - r0 * k * 0.5, cx, top - r0 * k);
    roofs.quadTo(cx + w * 0.2, top - r0 * k * 0.5, cx + w / 2 + 3 * k, top - 3 * k);
    roofs.close();
    lit.moveTo(cx + w / 2 - 1.2 * k, top);
    lit.lineTo(cx + w / 2 - 1.2 * k, cliffTop);
    for (let yy = top + 10 * k; yy < cliffTop - 10 * k; yy += 18 * k) {
      const behind = (cx > H.x0 - w && cx < H.x1 + w && yy > cliffTop - H.h - 34 * k) || (cx > K.x0 && cx < K.x1 && yy > cliffTop - K.h - 6 * k);
      if (!behind && hash(i * 7 + yy * 0.1, 3) < 0.7) arch(wins[(i + Math.round(yy)) % 3], cx - 2 * k, yy, 4 * k, 7 * k);
    }
  });
  for (let yy = cliffTop - K.h + 12 * k; yy < cliffTop - 8 * k; yy += 16 * k) {
    for (let x = K.x0 + 6 * k; x < K.x1 - 6 * k; x += 10 * k) if (hash(x * 0.3, yy * 0.2) < 0.5) arch(wins[Math.round(x) % 3], x, yy, 4 * k, 7 * k);
  }
  // örtülü ahşap köprü (sol alt kuleye)
  const bridge = Skia.Path.Make();
  const bx0 = width * 0.38;
  const bx1 = width * 0.465;
  const by = cliffTop + 34 * k;
  bridge.addRect(Skia.XYWHRect(bx0, by - 8 * k, bx1 - bx0, 8 * k));
  bridge.moveTo(bx0 - 2 * k, by - 8 * k);
  bridge.lineTo((bx0 + bx1) / 2, by - 15 * k);
  bridge.lineTo(bx1 + 2 * k, by - 8 * k);
  bridge.close();
  const piers = Skia.Path.Make();
  for (let x = bx0 + 6 * k; x < bx1; x += 12 * k) {
    piers.moveTo(x, by);
    piers.lineTo(x, by + 60 * k);
  }
  return { body, roofs, wins, lit, bridge, piers };
}

// Patronus geyiği (yerel, sağa koşar; omuz 0,0). Bacaklar ayrı (dörtnala).
const STAG_BODY = "M-16 -2 C-18 -6 -14 -10 -8 -10 C-2 -11 6 -11 10 -12 L14 -18 C15 -21 18 -22 20 -20 L24 -18 L22 -16 L18 -15 L15 -9 C14 -4 10 -1 6 0 C0 1 -10 2 -16 -2 Z M-16 -4 L-20 -6 L-17 -2 Z";
const STAG_ANTLERS = "M16 -21 C14 -28 10 -32 6 -34 M14 -27 L10 -26 M12 -30 L14 -35 M18 -21 C19 -28 22 -32 26 -34 M20 -27 L24 -26 M22 -30 L20 -35";
// Ruh Emici (yerel: başlık 0,0; etek +y)
function dementorHem(t, i) {
  "worklet";
  const q = Skia.Path.Make();
  q.moveTo(-5, -2);
  q.cubicTo(-7, -9, 7, -9, 5, -2);
  q.cubicTo(8, 6, 10 + Math.sin(t * 2 + i) * 2, 16, 8 + Math.sin(t * 3 + i) * 3, 26);
  for (let j = 0; j < 6; j += 1) {
    const x = 8 - (j + 1) * 2.8;
    const y = 26 + Math.sin(t * 4 + j * 1.3 + i) * 3 + (j % 2 ? 4 : 0);
    q.lineTo(x + Math.sin(t * 2.5 + j) * 1.2, y);
  }
  q.cubicTo(-10 + Math.sin(t * 2.2 + i) * 2, 14, -9, 6, -5, -2);
  q.close();
  return q;
}

function Stag({ f, L, clock, c }) {
  const tr = useDerivedValue(() => {
    const q = f.value;
    if (q.stag < 0) return [{ translateX: -9999 }];
    const g = q.stag;
    let x;
    let y;
    let rot = 0;
    let sc = 1.9 * L.k;
    if (g < 0.78) {
      const e = g / 0.78;
      x = L.harry[0] + 20 * L.k + e * (L.hall.x0 - L.harry[0] - 10 * L.k);
      y = L.stagY - e * 50 * L.k - Math.abs(Math.sin(clock.value * 6)) * 5 * L.k;
    } else {
      const e = (g - 0.78) / 0.22;
      x = L.hall.x0 + 10 * L.k + e * 80 * L.k;
      y = L.stagY - 50 * L.k - e * 160 * L.k;
      rot = -0.5 * e;
      sc *= 1 + 0.2 * e;
    }
    return [{ translateX: x }, { translateY: y }, { rotate: rot }, { scale: sc }];
  });
  const op = useDerivedValue(() => {
    const g = f.value.stag;
    return g < 0 ? 0 : Math.min(1, g * 10) * (g > 0.85 ? 1 - (g - 0.85) / 0.15 : 1);
  });
  const leg = (ox, ph) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDerivedValue(() => {
      const a = Math.sin(clock.value * 12 + ph) * 0.75;
      return [{ translateX: ox }, { translateY: -2 }, { rotate: a }];
    });
  const lower = (ph) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDerivedValue(() => [{ translateY: 7 }, { rotate: Math.max(0, Math.sin(clock.value * 12 + ph + 1)) * 1.2 }]);
  const legs = [[-13, 0], [-10, 0.6], [6, 2.4], [9, 3]].map(([ox, ph]) => ({ up: leg(ox, ph), low: lower(ph), ox }));
  const halo = (
    <Circle cx={2} cy={-8} r={34}>
      <RadialGradient c={vec(2, -8)} r={34} colors={[rgba(c.silver, 0.55), rgba(c.silver, 0)]} />
    </Circle>
  );
  return (
    <Group opacity={op}>
      <Group transform={tr}>
        {halo}
        {legs.map(({ up, low }, i) => (
          <Group key={i} transform={up}>
            <Path path="M0 0 L0 7" style="stroke" strokeWidth={2.4} strokeCap="round" color="rgba(230,245,255,0.95)" />
            <Group transform={low}>
              <Path path="M0 0 L0 7" style="stroke" strokeWidth={1.6} strokeCap="round" color="rgba(230,245,255,0.95)" />
            </Group>
          </Group>
        ))}
        <Path path={STAG_BODY} style="stroke" strokeWidth={3} strokeJoin="round" color={rgba(c.silver, 0.35)} />
        <Path path={STAG_BODY}>
          <LinearGradient start={vec(-16, -12)} end={vec(16, 2)} colors={["rgba(255,255,255,0.95)", rgba(c.silver, 0.85)]} />
        </Path>
        <Path path={STAG_ANTLERS} style="stroke" strokeWidth={1.3} strokeCap="round" color="rgba(240,250,255,0.95)" />
        <Circle cx={19} cy={-19} r={0.8} color="#7fb8ff" />
      </Group>
    </Group>
  );
}

function Dementor({ f, i, L, clock, c }) {
  const st = useDerivedValue(() => {
    const q = f.value;
    const t = clock.value;
    if (q.dem <= 0) return { x: -9999, y: 0, o: 0 };
    const tx = L.harry[0] + (60 + i * 52) * L.k;
    const ty = L.ground - (150 + (i % 2) * 70 + i * 12) * L.k;
    const sx = tx + (i % 2 ? 1 : -1) * 120 * L.k;
    const sy = -60 * L.k;
    const e = q.dem;
    let x = sx + (tx - sx) * e + Math.sin(t * 0.7 + i) * 12 * L.k;
    let y = sy + (ty - sy) * e + Math.sin(t * 0.9 + i * 2) * 8 * L.k;
    const fl = q.flee;
    x += fl * (i % 2 ? 1 : -1) * 140 * L.k;
    y -= fl * fl * 420 * L.k;
    return { x, y, o: Math.min(1, e * 1.4) * (1 - fl) };
  });
  const tr = useDerivedValue(() => [{ translateX: st.value.x }, { translateY: st.value.y }, { scale: (2 + (i % 3) * 0.3) * L.k }]);
  const op = useDerivedValue(() => st.value.o);
  const hem = useDerivedValue(() => dementorHem(clock.value, i));
  const hand = useDerivedValue(() => [{ translateX: -6 }, { translateY: 6 }, { rotate: -0.6 + Math.sin(clock.value * 1.5 + i) * 0.3 }]);
  return (
    <Group opacity={op} transform={tr}>
      <Path path={hem} color={c.dementor} />
      <Path path={hem} style="stroke" strokeWidth={0.4} color={rgba(c.frost, 0.18)} />
      <Oval x={-2.6} y={-6} width={5.2} height={5} color="#000" />
      <Group transform={hand}>
        <Path path="M0 0 L-6 2 M-6 2 L-8 1 M-6 2 L-8 3 M-6 2 L-7.6 4.2" style="stroke" strokeWidth={0.7} strokeCap="round" color="#3a3d44" />
      </Group>
    </Group>
  );
}

export default function HpScene({ p, clock, width, height, tone }) {
  const c = toneMap(tone.colors);
  const L = hpLayout(width, height);
  const { k } = L;
  const light = c.night === "#c8d4e8";
  const geo = useMemo(
    () => ({ land: buildLand(L, width), castle: buildCastle(L, width) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, height],
  );
  const f = useDerivedValue(() => hpFrame(p, clock.value));
  const darkO = useDerivedValue(() => f.value.dark * (light ? 0.3 : 0.38));
  const winOs = [0, 1, 2].map((i) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDerivedValue(() => (0.72 + 0.22 * Math.sin(clock.value * (0.8 + i * 0.37) + i * 2)) * (1 - 0.8 * f.value.dark)),
  );
  const frostO = useDerivedValue(() => f.value.frost);
  const frostT = useDerivedValue(() => [{ translateX: -width * (1 - f.value.frost) * 0.4 }]);
  const tipO = useDerivedValue(() => f.value.wand);
  const burstT = useDerivedValue(() => {
    const b = f.value.burst;
    return [{ translateX: L.harry[0] + 6 * k }, { translateY: L.harry[1] - 30 * k }, { scale: b < 0 ? 0 : 0.2 + b * 3 }];
  });
  const burstO = useDerivedValue(() => {
    const b = f.value.burst;
    return b < 0 ? 0 : 1 - b;
  });
  const trailP = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const g = f.value.stag;
    if (g < 0) return q;
    const e = Math.min(1, g / 0.78);
    const x1 = L.harry[0] + 20 * k + e * (L.hall.x0 - L.harry[0] - 10 * k);
    const y1 = L.stagY - e * 50 * k + 6 * k;
    q.moveTo(L.harry[0] + 6 * k, L.harry[1] - 30 * k);
    q.quadTo((L.harry[0] + x1) / 2, L.stagY + 8 * k, x1 - 20 * k, y1);
    return q;
  });
  const trailO = useDerivedValue(() => {
    const g = f.value.stag;
    return g < 0 ? 0 : 0.7 * (g > 0.8 ? 1 - (g - 0.8) / 0.2 : 1);
  });
  const sparkT = useDerivedValue(() => {
    const g = f.value.sparks;
    return [{ translateX: L.hall.x0 + 90 * k }, { translateY: L.stagY - 220 * k }, { scale: g < 0 ? 0 : 0.3 + g * 2 }];
  });
  const sparkO = useDerivedValue(() => {
    const g = f.value.sparks;
    return g < 0 ? 0 : 1 - g;
  });
  const boatT = (i) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDerivedValue(() => {
      const ph = (clock.value * 0.006 + i * 0.31) % 1;
      return [{ translateX: width * (0.15 + ph * 0.5) }, { translateY: L.horizon + (36 + i * 22) * k + Math.sin(clock.value * 1.2 + i) * 1.2 * k }];
    });
  const boats = [boatT(0), boatT(1), boatT(2)];
  const armT = useDerivedValue(() => [{ translateX: 1.5 }, { translateY: -15 }, { rotate: -0.3 - 2.32 * f.value.raise }]);
  const G = geo.land;
  const C = geo.castle;
  const glowCol = c.window;
  return (
    <Group>
      {/* ay */}
      <Circle cx={L.moon.x} cy={L.moon.y} r={L.moon.r * 3}>
        <RadialGradient c={vec(L.moon.x, L.moon.y)} r={L.moon.r * 3} colors={[rgba(c.moon, light ? 0.3 : 0.22), rgba(c.moon, 0)]} />
      </Circle>
      <Circle cx={L.moon.x} cy={L.moon.y} r={L.moon.r} color={c.moon} />
      <Circle cx={L.moon.x - 8 * k} cy={L.moon.y - 6 * k} r={6 * k} color={rgba(c.hill, 0.12)} />
      <Circle cx={L.moon.x + 9 * k} cy={L.moon.y + 8 * k} r={4 * k} color={rgba(c.hill, 0.1)} />

      <Group opacity={tone.alpha}>
        <Path path={G.hills} color={c.hill} />
        {/* göl */}
        <Path path={`M-4 ${L.horizon} L${width + 4} ${L.horizon} L${width + 4} ${L.ground + 10 * k} L-4 ${L.ground + 10 * k} Z`}>
          <LinearGradient start={vec(0, L.horizon)} end={vec(0, L.ground)} colors={[c.lakeLit, c.lake]} positions={[0, 0.35]} />
        </Path>
        {/* ay yansıması */}
        <Path path={`M${L.moon.x - 14 * k} ${L.horizon + 4 * k} L${L.moon.x + 14 * k} ${L.horizon + 4 * k} L${L.moon.x + 4 * k} ${L.ground} L${L.moon.x - 4 * k} ${L.ground} Z`}>
          <LinearGradient start={vec(0, L.horizon)} end={vec(0, L.ground)} colors={[rgba(c.moon, 0.35), rgba(c.moon, 0)]} />
        </Path>
        <Path path={G.ripples} style="stroke" strokeWidth={0.8 * k} color={rgba(c.lakeLit, 0.5)} />
        <Path path={G.forest} color={c.forest} />
        {/* şato */}
        <Path path={G.cliff}>
          <LinearGradient start={vec(0, L.cliffTop)} end={vec(0, L.ground)} colors={[c.castleLit, c.hill]} />
        </Path>
        <Path path={G.cliffLit} style="stroke" strokeWidth={0.8 * k} color={rgba(c.lakeLit, 0.3)} />
        <Path path={C.piers} style="stroke" strokeWidth={1.4 * k} color={c.castle} />
        <Path path={C.bridge} color={c.castle} />
        <Path path={C.body} color={c.castle} />
        <Path path={C.lit} style="stroke" strokeWidth={1.2 * k} color={rgba(c.castleLit, 0.9)} />
        <Path path={C.roofs} color={c.roof} />
      </Group>
      {C.wins.map((wp, i) => (
        <Group key={i} opacity={winOs[i]}>
          <Path path={wp} color={glowCol} />
        </Group>
      ))}
      {/* pencere yansımaları */}
      <Group opacity={winOs[0]}>
        <Path path={`M${L.hall.x0} ${L.horizon + 6 * k} L${L.hall.x1} ${L.horizon + 6 * k} L${L.hall.x1 - 10 * k} ${L.horizon + 70 * k} L${L.hall.x0 + 10 * k} ${L.horizon + 70 * k} Z`}>
          <LinearGradient start={vec(0, L.horizon)} end={vec(0, L.horizon + 70 * k)} colors={[rgba(glowCol, 0.3), rgba(glowCol, 0)]} />
        </Path>
      </Group>
      {/* kayıklar */}
      {boats.map((tr, i) => (
        <Group key={i} transform={tr}>
          <Path path={`M${-7 * k} 0 L${7 * k} 0 L${5 * k} ${2.6 * k} L${-5 * k} ${2.6 * k} Z`} color={c.forest} />
          <Path path={`M${4 * k} 0 L${4 * k} ${-7 * k}`} style="stroke" strokeWidth={0.6 * k} color={c.forest} />
          <Circle cx={4 * k} cy={-7.5 * k} r={6 * k}>
            <RadialGradient c={vec(4 * k, -7.5 * k)} r={6 * k} colors={[rgba(glowCol, 0.75), rgba(glowCol, 0)]} />
          </Circle>
        </Group>
      ))}

      {/* buz: kıyıdan içe */}
      <Group opacity={frostO}>
        <Group transform={frostT}>
          <Path path={`M-4 ${L.horizon} L${width * 1.2} ${L.horizon} L${width * 1.2} ${L.ground + 10 * k} L-4 ${L.ground + 10 * k} Z`}>
            <LinearGradient start={vec(0, 0)} end={vec(width * 1.2, 0)} colors={[rgba(c.frost, 0.6), rgba(c.frost, 0.35), rgba(c.frost, 0)]} positions={[0, 0.6, 1]} />
          </Path>
          <Path path={G.ripples} style="stroke" strokeWidth={1 * k} color={rgba(c.frost, 0.8)} />
        </Group>
      </Group>
      {/* gök kararır */}
      <Group opacity={darkO}>
        <Path path={`M0 0 L${width} 0 L${width} ${height} L0 ${height} Z`} color="#04060c" />
      </Group>

      {[0, 1, 2, 3].map((i) => (
        <Dementor key={i} f={f} i={i} L={L} clock={clock} c={c} />
      ))}

      {/* kıyı + Harry */}
      <Group opacity={tone.alpha}>
        <Path path={`M-4 ${L.ground + 8 * k} L${width + 4} ${L.ground + 8 * k} L${width + 4} ${height} L-4 ${height} Z`}>
          <LinearGradient start={vec(0, L.ground)} end={vec(0, height)} colors={[c.shore, c.night]} />
        </Path>
        <Path path={G.shore} color={c.shore} />
        <Path path={G.stones} color={rgba(c.hill, 0.9)} />
      </Group>
      <Group transform={[{ translateX: L.harry[0] }, { translateY: L.harry[1] }, { scale: 1.6 * k }]}>
        <Path path="M-3.4 0 L-2.6 -9 C-3.6 -12 -2.6 -15 0 -15.4 C2.6 -15 3.4 -12 2.6 -9 L3.4 0 L1 0 L0.4 -5 L-0.4 -5 L-1 0 Z" color={c.dementor} />
        <Circle cx={0} cy={-17.4} r={2.4} color={c.dementor} />
        <Path path="M-2.4 -18.6 C-1.6 -20.4 1.6 -20.4 2.4 -18.6 L1.6 -19.2 L0.6 -18.8 L-0.6 -19.4 Z" color={c.dementor} />
        <Group transform={armT}>
          <Path path="M0 0 L0 6.4 L0.4 11" style="stroke" strokeWidth={1.3} strokeCap="round" strokeJoin="round" color={c.dementor} />
          <Group opacity={tipO}>
            <Circle cx={0.4} cy={11.4} r={5}>
              <RadialGradient c={vec(0.4, 11.4)} r={5} colors={["rgba(255,255,255,1)", rgba(c.silver, 0)]} />
            </Circle>
          </Group>
        </Group>
      </Group>
      <Group opacity={burstO} transform={burstT}>
        <Circle cx={0} cy={0} r={30 * k}>
          <RadialGradient c={vec(0, 0)} r={30 * k} colors={["rgba(255,255,255,0.95)", rgba(c.silver, 0.5), rgba(c.silver, 0)]} />
        </Circle>
      </Group>
      <Group opacity={trailO}>
        <Path path={trailP} style="stroke" strokeWidth={6 * k} strokeCap="round" color={rgba(c.silver, 0.25)} />
        <Path path={trailP} style="stroke" strokeWidth={1.6 * k} strokeCap="round" color={rgba(c.silver, 0.85)} />
      </Group>
      <Stag f={f} L={L} clock={clock} c={c} />
      <Group opacity={sparkO} transform={sparkT}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => {
          const a = (i / 12) * Math.PI * 2;
          const r = (14 + hash(i, 1) * 16) * k;
          return <Circle key={i} cx={Math.cos(a) * r} cy={Math.sin(a) * r} r={1.6 * k} color="#ffffff" />;
        })}
        <Circle cx={0} cy={0} r={24 * k}>
          <RadialGradient c={vec(0, 0)} r={24 * k} colors={[rgba(c.silver, 0.6), rgba(c.silver, 0)]} />
        </Circle>
      </Group>
      {/* olay B (A ile sırayla) */}
      <HpEventB p={p} clock={clock} width={width} height={height} />
    </Group>
  );
}
