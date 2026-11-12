// components/decor/bbScene.js
//
// Breaking Bad atmosfer sahnesi (OVERLAY.mesa = 22) — tamamı VEKTÖR:
//   • New Mexico: ufukta mor dağlar, katmanlı kızıl mesalar (yassı tepe, tabakalar, aydınlık yüz),
//     çöl zemini, ufka kıvrılan toprak yol, elektrik direkleri, yukka, çolla kaktüsü, kreozot
//     çalıları ve taşlar; gökte süzülen akbaba, karanlıkta alacakaranlık pusu + yıldızlar.
//   • Olay (bbFrame, 30 sn): gökten bir haki pantolon savrularak yola düşer → karavan (Fleetwood
//     Bounder) tozu kaldırarak gelir, park eder → çatı bacasından mavimsi pişirme dumanı yükselir →
//     kapı açılır, sarı koruyucu giysili Jesse ve şapkalı/gözlüklü Walter çıkar → Walter'ın elindeki
//     mavi kristal parlar → içeri dönerler, karavan tozu kaldırarak sağdan çıkar.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift (sekme çubuğu). Çevre renkleri OVERLAY_TONES[22] (BB_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Circle, Group, LinearGradient, Oval, Path, RadialGradient, Rect, Skia, vec } from "@shopify/react-native-skia";
import { bbFrame, sceneScale } from "../../utils/weatherParticles";
import { SCENERY } from "../../utils/weatherUniverses";

const BB_TONE = ["mesa", "mesaLit", "mesaShade", "far", "sand", "sandShade", "road", "scrub", "glow", "star", "sandLit"];
const toneMap = (colors) => Object.fromEntries(BB_TONE.map((name, i) => [name, colors[i] || colors[0]]));

function rgba(hex, a) {
  const h = String(hex).replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Sahne yerleşimi (dp). */
export function bbLayout(width, height) {
  const k = sceneScale(width, height);
  const ground = height - SCENERY.lift * k;
  const horizon = ground - 96 * k;
  return {
    k, ground, horizon,
    roadY: ground - 16 * k, // karavanın yürüdüğü yol (tekerlek tabanı)
    rvX: width * 0.5, // park yeri (gövde merkezi)
    doorX: width * 0.5 + 16 * k,
    standJ: width * 0.5 - 98 * k,
    standW: width * 0.5 - 128 * k,
  };
}

// ── Manzara ────────────────────────────────────────────────────────────────────
function mesaShape(cx, base, w, h, k, cap = 0.55) {
  // yassı tepe, iki yanda sarp + talus eteği
  const top = base - h;
  const pts = [
    [cx - w * 0.5, base], [cx - w * 0.38, base - h * 0.28], [cx - w * 0.33, base - h * 0.55], [cx - w * cap * 0.5, top + 3 * k],
    [cx - w * cap * 0.5 + 4 * k, top], [cx + w * cap * 0.5 - 3 * k, top], [cx + w * cap * 0.5, top + 4 * k],
    [cx + w * 0.34, base - h * 0.55], [cx + w * 0.4, base - h * 0.26], [cx + w * 0.52, base],
  ];
  return { pts, top };
}

function buildLand(L, width, height) {
  const { k, horizon, ground } = L;
  // uzak dağlar (Sandia)
  const far = Skia.Path.Make();
  far.moveTo(-5, horizon + 4 * k);
  const ridge = [[0, 30], [0.08, 46], [0.16, 38], [0.24, 58], [0.31, 50], [0.4, 66], [0.47, 54], [0.55, 40], [0.63, 48], [0.72, 36], [0.8, 52], [0.88, 44], [0.95, 60], [1.02, 40]];
  for (const [x, h] of ridge) far.lineTo(width * x, horizon - h * k);
  far.lineTo(width + 5, horizon + 4 * k);
  far.close();
  // mesalar: [merkez x oranı, taban (horizon'dan dp), genişlik, yükseklik, tepe oranı]
  const defs = [
    [0.12, 6, 150, 74, 0.6], [0.47, 2, 110, 52, 0.45], [0.84, 8, 170, 92, 0.62], [0.32, 18, 90, 40, 0.5], [0.66, 20, 80, 34, 0.42],
  ];
  const body = Skia.Path.Make();
  const lit = Skia.Path.Make();
  const strata = Skia.Path.Make();
  const caps = Skia.Path.Make();
  const talus = Skia.Path.Make();
  for (const [x, b, w, h, cap] of defs) {
    const base = horizon + b * k;
    const { pts, top } = mesaShape(width * x, base, w * k, h * k, k, cap);
    body.moveTo(pts[0][0], pts[0][1]);
    for (const [px, py] of pts.slice(1)) body.lineTo(px, py);
    body.close();
    // aydınlık sağ yüz (güneş batıda değil: sağdan vuran ışık)
    lit.moveTo(pts[6][0], pts[6][1]);
    lit.lineTo(pts[7][0], pts[7][1]);
    lit.lineTo(pts[8][0], pts[8][1]);
    lit.lineTo(pts[9][0], pts[9][1]);
    lit.lineTo(pts[9][0] - w * k * 0.1, base);
    lit.lineTo(pts[7][0] - w * k * 0.08, pts[7][1] + 4 * k);
    lit.lineTo(pts[6][0] - w * k * 0.06, pts[6][1] + 2 * k);
    lit.close();
    // tabakalar
    const n = Math.max(3, Math.round(h / 11));
    for (let i = 1; i < n; i += 1) {
      const y = top + (i / n) * (h * 0.62) * k / k;
      const sp = (y - top) / (h * k);
      const half = w * k * (cap * 0.5 + (0.33 - cap * 0.5) * Math.min(1, sp / 0.55));
      strata.moveTo(width * x - half + 1 * k, y);
      strata.lineTo(width * x + half - 1 * k, y + ((i % 2) - 0.5) * 1.2 * k);
    }
    // tepe kapak kayası
    caps.moveTo(pts[3][0], pts[3][1] + 1 * k);
    caps.lineTo(pts[4][0], pts[4][1]);
    caps.lineTo(pts[5][0], pts[5][1]);
    caps.lineTo(pts[6][0], pts[6][1] + 1 * k);
    caps.lineTo(pts[6][0] - 1 * k, top + 7 * k);
    caps.lineTo(pts[3][0] + 1 * k, top + 7 * k);
    caps.close();
    // etekteki dökük taş oluklar
    for (let i = 0; i < 6; i += 1) {
      const t = i / 5;
      const sx = pts[1][0] + (pts[8][0] - pts[1][0]) * t;
      talus.moveTo(sx, base - h * k * 0.3);
      talus.lineTo(sx + (t - 0.5) * 6 * k, base - 1 * k);
    }
  }
  // çöl zemini
  const floor = Skia.Path.Make();
  floor.moveTo(-5, horizon + 10 * k);
  floor.cubicTo(width * 0.3, horizon + 4 * k, width * 0.7, horizon + 14 * k, width + 5, horizon + 8 * k);
  floor.lineTo(width + 5, height + 2);
  floor.lineTo(-5, height + 2);
  floor.close();
  // ufka kıvrılan toprak yol: alt yoldan sola-ufka
  const road = Skia.Path.Make();
  road.moveTo(-5, L.roadY - 6 * k);
  road.lineTo(width + 5, L.roadY - 6 * k);
  road.lineTo(width + 5, L.roadY + 7 * k);
  road.lineTo(-5, L.roadY + 7 * k);
  road.close();
  const branch = Skia.Path.Make();
  branch.moveTo(width * 0.66, L.roadY - 6 * k);
  branch.cubicTo(width * 0.72, horizon + 50 * k, width * 0.5, horizon + 30 * k, width * 0.58, horizon + 9 * k);
  branch.lineTo(width * 0.585, horizon + 9 * k);
  branch.cubicTo(width * 0.53, horizon + 30 * k, width * 0.79, horizon + 50 * k, width * 0.76, L.roadY - 6 * k);
  branch.close();
  const ruts = Skia.Path.Make();
  ruts.moveTo(-5, L.roadY - 2 * k);
  ruts.lineTo(width + 5, L.roadY - 2.6 * k);
  ruts.moveTo(-5, L.roadY + 3 * k);
  ruts.lineTo(width + 5, L.roadY + 3.4 * k);
  // zemin çatlakları ve çakıl
  const pebbles = Skia.Path.Make();
  let s = 7;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < 70; i += 1) {
    const y = horizon + 16 * k + rnd() * (height - horizon);
    pebbles.addOval(Skia.XYWHRect(rnd() * width, y, (1 + rnd() * 2.6) * k * (0.5 + (y - horizon) / (height - horizon)), 1 * k));
  }
  // elektrik direkleri (yol dalı boyunca ufka küçülür) + teller
  const poles = Skia.Path.Make();
  const wires = Skia.Path.Make();
  const P = [[0.95, 0], [0.86, 0.35], [0.8, 0.58], [0.76, 0.74], [0.735, 0.85]];
  let prev = null;
  for (const [x, t] of P) {
    const y = L.roadY - 14 * k - t * (L.roadY - 14 * k - horizon - 12 * k);
    const h = (58 - t * 46) * k;
    const px = width * x;
    poles.moveTo(px, y);
    poles.lineTo(px, y - h);
    poles.moveTo(px - h * 0.18, y - h * 0.9);
    poles.lineTo(px + h * 0.18, y - h * 0.9);
    if (prev) {
      for (const o of [-0.16, 0.16]) {
        wires.moveTo(prev[0] + prev[2] * o, prev[1] - prev[2] * 0.9);
        wires.quadTo((prev[0] + px) / 2, (prev[1] - prev[2] * 0.9 + y - h * 0.9) / 2 + 5 * k * (1 - t), px + h * o, y - h * 0.9);
      }
    }
    prev = [px, y, h];
  }
  return { far, body, lit, strata, caps, talus, floor, road, branch, ruts, pebbles, poles, wires };
}

function buildPlants(L, width) {
  const { k, horizon } = L;
  const yucca = Skia.Path.Make();
  const stalk = Skia.Path.Make();
  const bloom = Skia.Path.Make();
  const cholla = Skia.Path.Make();
  const bush = Skia.Path.Make();
  const rocks = Skia.Path.Make();
  const rocksLit = Skia.Path.Make();
  const addYucca = (x, y, s) => {
    for (let i = 0; i < 13; i += 1) {
      const a = -Math.PI / 2 + (i - 6) * 0.2;
      const len = (15 - Math.abs(i - 6) * 0.9) * s * k;
      yucca.moveTo(x - 0.6 * s * k, y);
      yucca.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      yucca.lineTo(x + 0.6 * s * k, y);
      yucca.close();
    }
    stalk.moveTo(x, y - 8 * s * k);
    stalk.quadTo(x + 2 * s * k, y - 26 * s * k, x + 1 * s * k, y - 38 * s * k);
    for (let j = 0; j < 6; j += 1) bloom.addOval(Skia.XYWHRect(x + (j % 2 ? 0.5 : -2.6) * s * k, y - (28 + j * 2) * s * k, 2.4 * s * k, 2 * s * k));
  };
  const addCholla = (x, y, s) => {
    const seg = (x0, y0, x1, y1) => {
      cholla.moveTo(x0, y0);
      cholla.lineTo(x1, y1);
    };
    seg(x, y, x, y - 20 * s * k);
    seg(x, y - 10 * s * k, x - 7 * s * k, y - 16 * s * k);
    seg(x - 7 * s * k, y - 16 * s * k, x - 8 * s * k, y - 24 * s * k);
    seg(x, y - 14 * s * k, x + 7 * s * k, y - 20 * s * k);
    seg(x + 7 * s * k, y - 20 * s * k, x + 9 * s * k, y - 27 * s * k);
    seg(x, y - 20 * s * k, x + 2 * s * k, y - 27 * s * k);
  };
  const addBush = (x, y, s) => {
    for (let i = 0; i < 5; i += 1) bush.addOval(Skia.XYWHRect(x + (i - 2.5) * 4 * s * k, y - (5 + (i % 2) * 3) * s * k, 9 * s * k, 7 * s * k));
  };
  const addRock = (x, y, s) => {
    rocks.moveTo(x - 9 * s * k, y);
    rocks.lineTo(x - 7 * s * k, y - 5 * s * k);
    rocks.lineTo(x - 1 * s * k, y - 8 * s * k);
    rocks.lineTo(x + 6 * s * k, y - 6 * s * k);
    rocks.lineTo(x + 10 * s * k, y);
    rocks.close();
    rocksLit.moveTo(x - 1 * s * k, y - 8 * s * k);
    rocksLit.lineTo(x + 6 * s * k, y - 6 * s * k);
    rocksLit.lineTo(x + 10 * s * k, y);
    rocksLit.lineTo(x + 3 * s * k, y);
    rocksLit.close();
  };
  addYucca(width * 0.07, L.ground - 4 * k, 1.15);
  addYucca(width * 0.9, L.roadY - 22 * k, 0.75);
  addYucca(width * 0.28, horizon + 36 * k, 0.45);
  addCholla(width * 0.2, L.roadY - 20 * k, 0.9);
  addCholla(width * 0.95, L.ground + 2 * k, 1.2);
  addCholla(width * 0.56, horizon + 30 * k, 0.5);
  for (const [x, y, s] of [[0.36, -22, 0.9], [0.83, 4, 1.1], [0.12, -30, 0.7], [0.62, -28, 0.6], [0.44, 6, 1.2], [0.7, 0, 0.9]]) addBush(width * x, L.roadY + y * k, s);
  for (const [x, y, s] of [[0.27, 8, 1.1], [0.78, -26, 0.7], [0.5, 10, 0.8], [0.04, -24, 0.8]]) addRock(width * x, L.roadY + y * k, s);
  return { yucca, stalk, bloom, cholla, bush, rocks, rocksLit };
}

function buildStars(width, height) {
  const p = Skia.Path.Make();
  let s = 5;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < 40; i += 1) p.addCircle(rnd() * width, rnd() * height * 0.5, 0.5 + rnd() * 0.9);
  return p;
}

// ── Karavan (Fleetwood Bounder) — yerel: zemin 0, gövde merkezi x=0, burun +x; birim × k ──
const RV = {
  body: "M-76 -14 L-76 -60 C-76 -64 -73 -66 -69 -66 L52 -66 C58 -66 60 -63 61 -60 L66 -46 C70 -44 76 -40 77 -34 L78 -16 C78 -14 77 -13 75 -13 Z",
  skirt: "M-76 -24 L77 -24 L78 -16 C78 -14 77 -13 75 -13 L-76 -13 Z",
  stripeA: "M-76 -38 L44 -38 C54 -38 62 -44 66 -48 L67 -45 C62 -40 54 -35 44 -35 L-76 -35 Z",
  stripeB: "M-76 -33 L46 -33 C56 -33 64 -38 70 -42 L72 -39 C66 -34 57 -30 46 -30 L-76 -30 Z",
  stripeC: "M-76 -28 L76 -28 L76.6 -26 L-76 -26 Z",
  windshield: "M61 -59 L66 -46 C70 -44 73 -42 74 -40 L62 -40 C60 -40 59 -41 59 -43 L59 -57 Z",
  winA: "M-62 -58 L-38 -58 L-38 -44 L-62 -44 Z",
  winB: "M-30 -58 L-6 -58 L-6 -44 L-30 -44 Z",
  winC: "M34 -58 L52 -58 L52 -44 L34 -44 Z",
  door: "M12 -60 L28 -60 L28 -15 L12 -15 Z",
  doorWin: "M15 -57 L25 -57 L25 -46 L15 -46 Z",
  ac: "M-34 -73 L-12 -73 L-10 -66 L-36 -66 Z",
  vent: "M-56 -71 L-50 -71 L-50 -66 L-56 -66 Z",
  pipe: "M22 -66 L22 -74 L26 -74 L26 -66 Z",
  awning: "M-66 -64 L6 -64 L6 -61 L-66 -61 Z",
  ladder: "M-79 -62 L-79 -16 M-82 -62 L-82 -16 M-82 -56 L-79 -56 M-82 -48 L-79 -48 M-82 -40 L-79 -40 M-82 -32 L-79 -32 M-82 -24 L-79 -24",
  bumperF: "M70 -16 L80 -16 L80 -12 L70 -12 Z",
  bumperR: "M-80 -16 L-70 -16 L-70 -12 L-80 -12 Z",
  wheelArch: "M-58 -13 C-58 -26 -32 -26 -32 -13 Z M30 -13 C30 -26 56 -26 56 -13 Z",
};

function Wheel({ x, spin, k }) {
  return (
    <Group transform={[{ translateX: x }, { translateY: -9 }]}>
      <Circle cx={0} cy={0} r={10} color="#1e1f22" />
      <Circle cx={0} cy={0} r={5.6} color="#9ea2a6" />
      <Group transform={spin}>
        <Path path="M0 -5 L0 5 M-5 0 L5 0 M-3.5 -3.5 L3.5 3.5 M-3.5 3.5 L3.5 -3.5" style="stroke" strokeWidth={0.9} color="#5c6064" />
      </Group>
      <Circle cx={0} cy={0} r={1.8} color="#d5d8db" />
    </Group>
  );
}

function RvArt({ spin, doorT, k, glass, lampO }) {
  return (
    <Group>
      <Path path={RV.ladder} style="stroke" strokeWidth={0.8} color="#8c8f93" />
      <Path path={RV.body}>
        <LinearGradient start={vec(0, -66)} end={vec(0, -13)} colors={["#f2ecdd", "#ddd5c0", "#c9bfa6"]} />
      </Path>
      <Path path={RV.skirt} color="#a89b80" />
      <Path path={RV.stripeA} color="#7a4b28" />
      <Path path={RV.stripeB} color="#c48a4c" />
      <Path path={RV.stripeC} color="#5b3820" />
      <Path path={RV.awning} color="#c9c2ad" />
      <Path path="M-66 -61 L6 -61" style="stroke" strokeWidth={0.6} color="rgba(0,0,0,0.25)" />
      <Path path={RV.winA} color={glass} />
      <Path path={RV.winB} color={glass} />
      <Path path={RV.winC} color={glass} />
      <Path path={RV.windshield} color={glass} />
      <Path path="M-58 -56 L-50 -46 M-26 -56 L-18 -46 M37 -56 L44 -46 M63 -55 L66 -44" style="stroke" strokeWidth={1.4} color="rgba(255,255,255,0.28)" />
      {/* kapı: açılınca içerisi görünür */}
      <Path path={RV.door} color="#1a1612" />
      <Group transform={[{ translateX: 12 }]}>
        <Group transform={doorT}>
          <Group transform={[{ translateX: -12 }]}>
            <Path path={RV.door} color="#e4dccb" />
            <Path path={RV.doorWin} color={glass} />
            <Path path="M12 -60 L28 -60 L28 -15 L12 -15 Z" style="stroke" strokeWidth={0.7} color="rgba(0,0,0,0.35)" />
            <Circle cx={25} cy={-36} r={0.9} color="#6b6f73" />
          </Group>
        </Group>
      </Group>
      <Path path={RV.ac} color="#d9d3c2" />
      <Path path="M-33 -70 L-13 -70" style="stroke" strokeWidth={0.6} color="rgba(0,0,0,0.25)" />
      <Path path={RV.vent} color="#bdb5a0" />
      <Path path={RV.pipe} color="#8c8f93" />
      <Path path={RV.wheelArch} color="#2a2622" />
      <Path path={RV.bumperF} color="#b9bcbf" />
      <Path path={RV.bumperR} color="#b9bcbf" />
      <Path path="M75 -24 L78 -24 L78 -19 L75 -19 Z" color="#ffe9b0" />
      <Path path="M-76 -24 L-73 -24 L-73 -18 L-76 -18 Z" color="#c0392b" />
      <Path path="M-76 -66 L52 -66" style="stroke" strokeWidth={0.8} color="rgba(255,255,255,0.5)" />
      <Wheel x={-45} spin={spin} k={k} />
      <Wheel x={43} spin={spin} k={k} />
      {/* farlar (karanlıkta) */}
      <Group opacity={lampO}>
        <Path path="M78 -22 L170 -40 L170 6 L78 -17 Z">
          <LinearGradient start={vec(78, 0)} end={vec(170, 0)} colors={["rgba(255,236,190,0.45)", "rgba(255,236,190,0)"]} />
        </Path>
      </Group>
    </Group>
  );
}

// ── Figürler — yerel: ayak 0,0, boy ~34 birim ──
function Legs({ clock, walk, color, w = 3.2 }) {
  const a = useDerivedValue(() => [{ rotate: Math.sin(clock.value * 8) * 0.45 * walk.value }]);
  const b = useDerivedValue(() => [{ rotate: -Math.sin(clock.value * 8) * 0.45 * walk.value }]);
  return (
    <Group transform={[{ translateY: -15 }]}>
      <Group transform={a}>
        <Path path="M0 0 L0 14.5" style="stroke" strokeWidth={w} strokeCap="round" color={color} />
      </Group>
      <Group transform={b}>
        <Path path="M0 0 L0 14.5" style="stroke" strokeWidth={w} strokeCap="round" color={color} />
      </Group>
    </Group>
  );
}

function Walter({ clock, walk, hold }) {
  const armT = useDerivedValue(() => [{ rotate: -0.2 - 1.15 * hold.value }]);
  return (
    <Group>
      <Legs clock={clock} walk={walk} color="#a89670" />
      <Path path="M-1.4 -1 L2.2 -1 M-1.6 -0.4 L2.4 -0.4" style="stroke" strokeWidth={1.4} strokeCap="round" color="#3a2a20" />
      {/* gövde: yeşil gömlek */}
      <Path path="M-4.6 -28 C-6 -22 -5.6 -17 -4.8 -14 L4.8 -14 C5.6 -17 6 -22 4.6 -28 C2 -29.5 -2 -29.5 -4.6 -28 Z" color="#5d7348" />
      <Path path="M-0.2 -28 L-0.2 -15" style="stroke" strokeWidth={0.5} color="rgba(0,0,0,0.25)" />
      <Path path="M-4.9 -15.5 L4.9 -15.5" style="stroke" strokeWidth={1.2} color="#3a2e24" />
      <Path path="M-4 -27.5 L-6.2 -19 L-5.4 -15.5" style="stroke" strokeWidth={2.2} strokeCap="round" color="#5d7348" />
      {/* öne uzanan kol: kristal */}
      <Group transform={[{ translateX: 3.6 }, { translateY: -27 }]}>
        <Group transform={armT}>
          <Path path="M0 0 L1.4 7.6 L1.2 12" style="stroke" strokeWidth={2.2} strokeCap="round" color="#5d7348" />
          <Circle cx={1.2} cy={12.6} r={1.3} color="#e3c2a2" />
        </Group>
      </Group>
      {/* baş */}
      <Path path="M-1.6 -29.6 L1.6 -29.6 L1.4 -28 L-1.4 -28 Z" color="#e3c2a2" />
      <Circle cx={0.2} cy={-33} r={3.6} color="#e3c2a2" />
      <Path path="M-0.6 -30.6 C0.4 -29.4 2.4 -29.6 3 -31 C2.4 -30.2 1 -30.2 0 -30.8 Z" color="#4a3a30" />
      <Path path="M-0.4 -33.8 L3.9 -33.8" style="stroke" strokeWidth={1.3} color="#111" />
      {/* domuz turtası şapka */}
      <Oval x={-6.2} y={-37.2} width={12.6} height={2.6} color="#141414" />
      <Path path="M-3.8 -36.2 L-3.4 -40.6 C-1.6 -41.4 2 -41.4 3.8 -40.6 L4.2 -36.2 Z" color="#141414" />
      <Path path="M-3.6 -37.4 L4 -37.4" style="stroke" strokeWidth={0.8} color="#2e2e2e" />
    </Group>
  );
}

function Jesse({ clock, walk }) {
  return (
    <Group>
      <Legs clock={clock} walk={walk} color="#e2bf2a" w={3.6} />
      <Path path="M-1.8 -1 L2.4 -1 M-1.8 -0.4 L2.6 -0.4" style="stroke" strokeWidth={1.5} strokeCap="round" color="#1c1c1c" />
      <Path path="M-5 -27 C-6.4 -21 -6 -16 -5.2 -13.5 L5.2 -13.5 C6 -16 6.4 -21 5 -27 C2.4 -28.6 -2.4 -28.6 -5 -27 Z" color="#e8c62e" />
      <Path path="M-4.6 -26 L-6.6 -18 L-6 -14" style="stroke" strokeWidth={2.6} strokeCap="round" color="#e8c62e" />
      <Path path="M4.6 -26 L6.4 -18 L6 -14" style="stroke" strokeWidth={2.6} strokeCap="round" color="#e8c62e" />
      <Circle cx={-6} cy={-13.6} r={1.3} color="#1c1c1c" />
      <Circle cx={6} cy={-13.6} r={1.3} color="#1c1c1c" />
      <Path path="M0 -27 L0 -15" style="stroke" strokeWidth={0.5} color="rgba(0,0,0,0.25)" />
      {/* başlık + gaz maskesi */}
      <Path path="M-4.4 -27.4 C-5.6 -33 -3.6 -37.4 0.4 -37.4 C4.4 -37.4 5.8 -33 4.6 -27.4 Z" color="#e8c62e" />
      <Oval x={-2.4} y={-35} width={6.6} height={6} color="#d9b38f" />
      <Path path="M-1.6 -33.4 L4 -33.4 L3.6 -31.6 L-1.2 -31.6 Z" color="#1c1c1c" />
      <Path path="M0 -31 C0.8 -28.4 3.4 -28.4 4.4 -30.6 L3.6 -31.4 L-0.2 -31.4 Z" color="#1c1c1c" />
      <Circle cx={4.6} cy={-29.8} r={1.7} color="#2e2e2e" />
      <Circle cx={-0.4} cy={-29.4} r={1.5} color="#2e2e2e" />
    </Group>
  );
}

// Akbaba (gökte daire çizer)
function Vulture({ clock, width, height, k, color }) {
  const tr = useDerivedValue(() => {
    const t = clock.value * 0.16;
    return [
      { translateX: width * 0.66 + Math.cos(t) * 54 * k },
      { translateY: height * 0.3 + Math.sin(t) * 14 * k },
      { scale: k * (0.85 + 0.15 * Math.sin(t)) },
      { rotate: Math.cos(t) * 0.18 },
    ];
  });
  const wing = useDerivedValue(() => [{ scaleY: 1 + 0.12 * Math.sin(clock.value * 1.7) }]);
  return (
    <Group transform={tr}>
      <Group transform={wing}>
        <Path
          path="M0 0 C-6 -3 -14 -4 -22 -2 L-25 0 L-23 0.6 L-26 1.6 L-23 2 L-25 3.2 L-21 2.6 C-14 2 -6 2 0 2.4 C6 2 14 2 21 2.6 L25 3.2 L23 2 L26 1.6 L23 0.6 L25 0 L22 -2 C14 -4 6 -3 0 0 Z"
          color={color}
        />
      </Group>
      <Path path="M-1.6 -0.6 L1.6 -0.6 L1 5 L-1 5 Z" color={color} />
    </Group>
  );
}

// Pişirme dumanı (çatı bacasından)
function Smoke({ f, clock, i, k, rvT, tint }) {
  const tr = useDerivedValue(() => {
    const c0 = (clock.value * 0.16 + i / 6) % 1;
    const x = rvT.value.x + (24 + c0 * 34 + Math.sin(c0 * 6 + i) * 6) * k;
    const y = rvT.value.y + (-76 - c0 * 120) * k;
    return [{ translateX: x }, { translateY: y }, { scale: (0.5 + c0 * 2.4) * k }];
  });
  const op = useDerivedValue(() => {
    const c0 = (clock.value * 0.16 + i / 6) % 1;
    return f.value.smoke * Math.sin(c0 * Math.PI) * 0.7;
  });
  return (
    <Group transform={tr} opacity={op}>
      <Oval x={-9} y={-6} width={18} height={12} color={tint} />
      <Oval x={-4} y={-9} width={12} height={9} color="rgba(255,255,255,0.35)" />
    </Group>
  );
}

// Tekerlek tozu
function Dust({ f, clock, i, k, rvT, color }) {
  const tr = useDerivedValue(() => {
    const c0 = (clock.value * 0.9 + i / 7) % 1;
    const back = rvT.value.dir;
    return [
      { translateX: rvT.value.x - back * (60 + c0 * 70 + i * 4) * k },
      { translateY: rvT.value.y - (6 + c0 * 26) * k },
      { scale: (0.6 + c0 * 2.2) * k },
    ];
  });
  const op = useDerivedValue(() => {
    const c0 = (clock.value * 0.9 + i / 7) % 1;
    return f.value.dust * (1 - c0) * 0.5;
  });
  return (
    <Group transform={tr} opacity={op}>
      <Oval x={-12} y={-7} width={24} height={14} color={color} />
    </Group>
  );
}

export default function BbScene({ p, clock, width, height, tone }) {
  const c = toneMap(tone.colors);
  const L = bbLayout(width, height);
  const { k } = L;
  const light = c.star === "#ffffff";
  const land = useMemo(() => buildLand(L, width, height), [width, height]);
  const plants = useMemo(() => buildPlants(L, width), [width, height]);
  const stars = useMemo(() => buildStars(width, height), [width, height]);
  const f = useDerivedValue(() => bbFrame(p, clock.value));

  // karavan konumu
  const rv = useDerivedValue(() => {
    const q = f.value;
    const start = -100 * k;
    const end = width + 110 * k;
    let x = start;
    if (q.u <= 1) x = q.depart > 0 ? L.rvX + (end - L.rvX) * q.depart : start + (L.rvX - start) * q.drive;
    const moving = q.u <= 1 && ((q.drive > 0 && q.drive < 1) || (q.depart > 0 && q.depart < 1));
    const bounce = moving ? Math.sin(clock.value * 13) * 0.6 * k : 0;
    return { x, y: L.roadY + bounce, dir: 1, moving };
  });
  const rvT = useDerivedValue(() => [{ translateX: rv.value.x }, { translateY: rv.value.y }, { scale: k }]);
  const spin = useDerivedValue(() => {
    const x = rv.value.x / k;
    return [{ rotate: x / 10 }];
  });
  const doorT = useDerivedValue(() => [{ scaleX: 1 - 0.85 * f.value.door }]);
  const lampO = useDerivedValue(() => (light ? 0 : rv.value.moving ? 1 : 0.15));

  // pantolon: savrularak düşer, yolda yatar, karavan geçerken kaybolur
  const pantsT = useDerivedValue(() => {
    const s = f.value.pants;
    const x0 = width * 0.34;
    const y1 = L.roadY - 4 * k;
    if (s < 0) return [{ translateX: -900 }];
    const fall = Math.min(1, s / 0.55);
    const x = x0 + Math.sin(fall * 7) * 26 * k * (1 - fall) + fall * 20 * k;
    const y = height * 0.12 + (y1 - height * 0.12) * (fall * fall * (3 - 2 * fall));
    return [{ translateX: x }, { translateY: y }, { rotate: (1 - fall) * Math.sin(fall * 9) * 1.4 + fall * 1.45 }, { scale: k }];
  });
  const pantsO = useDerivedValue(() => {
    const s = f.value.pants;
    return s < 0 ? 0 : s > 0.9 ? (1 - s) / 0.1 : 1;
  });

  // figürler
  const jesse = useDerivedValue(() => {
    const q = f.value;
    const x = L.doorX + (L.standJ - L.doorX) * q.outJ;
    return [{ translateX: x }, { translateY: L.roadY - 2 * k }, { scale: k }, { scaleX: q.facingJ }];
  });
  const walter = useDerivedValue(() => {
    const q = f.value;
    const x = L.doorX + (L.standW - L.doorX) * q.outW;
    return [{ translateX: x }, { translateY: L.roadY - 2 * k }, { scale: k }, { scaleX: q.facingW }];
  });
  const jO = useDerivedValue(() => f.value.visJ);
  const wO = useDerivedValue(() => f.value.visW);
  const walkJ = useDerivedValue(() => f.value.walkJ);
  const walkW = useDerivedValue(() => f.value.walkW);
  const hold = useDerivedValue(() => f.value.hold);
  const glintT = useDerivedValue(() => {
    const q = f.value;
    const x = L.doorX + (L.standW - L.doorX) * q.outW;
    // el: kol aşağıda (−7,2; −15,5), yukarıda (−15,6; −25,5) — yüz sola (scaleX −1)
    return [{ translateX: x - (7.2 + 8.4 * q.hold) * k }, { translateY: L.roadY - 2 * k - (15.5 + 10 * q.hold) * k }, { rotate: clock.value * 0.8 }];
  });
  const glintO = useDerivedValue(() => f.value.glint);

  const glass = light ? "#4f7d8a" : "#2f4a52";
  return (
    <Group>
      {/* gök */}
      <Group opacity={light ? 0 : 0.6}>
        <Path path={stars} color={c.star} />
      </Group>
      <Path path={`M0 ${L.horizon - 190 * k} L${width} ${L.horizon - 190 * k} L${width} ${L.horizon + 12 * k} L0 ${L.horizon + 12 * k} Z`}>
        <LinearGradient start={vec(0, L.horizon - 190 * k)} end={vec(0, L.horizon + 8 * k)} colors={[rgba(c.glow, 0), rgba(c.glow, light ? 0.3 : 0.24), rgba(c.glow, light ? 0.5 : 0.42)]} positions={[0, 0.7, 1]} />
      </Path>
      <Vulture clock={clock} width={width} height={height} k={k} color={light ? "#3a3030" : "#5a4a44"} />

      <Group opacity={tone.alpha}>
        <Path path={land.far}>
          <LinearGradient start={vec(0, L.horizon - 66 * k)} end={vec(0, L.horizon)} colors={[c.far, rgba(c.far, 0.75)]} />
        </Path>
        <Path path={land.body}>
          <LinearGradient start={vec(0, L.horizon - 92 * k)} end={vec(0, L.horizon + 20 * k)} colors={[c.mesa, c.mesaShade]} />
        </Path>
        <Path path={land.lit} color={rgba(c.mesaLit, 0.85)} />
        <Path path={land.caps} color={rgba(c.mesaLit, 0.55)} />
        <Path path={land.strata} style="stroke" strokeWidth={0.8 * k} color="rgba(40,14,8,0.32)" />
        <Path path={land.talus} style="stroke" strokeWidth={0.8 * k} color="rgba(40,14,8,0.25)" />
        <Path path={land.floor}>
          <LinearGradient start={vec(0, L.horizon)} end={vec(0, height)} colors={[c.sandLit, c.sand, c.sandShade]} positions={[0, 0.35, 1]} />
        </Path>
        <Path path={land.branch} color={rgba(c.road, 0.75)} />
        <Path path={land.road} color={rgba(c.road, 0.85)} />
        <Path path={land.ruts} style="stroke" strokeWidth={1.4 * k} color="rgba(60,30,14,0.22)" />
        <Path path={land.pebbles} color="rgba(60,30,14,0.28)" />
        <Path path={land.wires} style="stroke" strokeWidth={0.5 * k} color="rgba(20,14,10,0.55)" />
        <Path path={land.poles} style="stroke" strokeWidth={1.3 * k} color="#4a3324" />
        <Path path={plants.bush} color={rgba(c.scrub, 0.95)} />
        <Path path={plants.rocks} color={c.mesaShade} />
        <Path path={plants.rocksLit} color={rgba(c.mesaLit, 0.6)} />
        <Path path={plants.cholla} style="stroke" strokeWidth={2.6 * k} strokeCap="round" color={c.scrub} />
        <Path path={plants.cholla} style="stroke" strokeWidth={0.6 * k} strokeCap="round" color="rgba(255,240,200,0.35)" />
        <Path path={plants.stalk} style="stroke" strokeWidth={1 * k} color="#7a6a3e" />
        <Path path={plants.bloom} color="#f3ead0" />
        <Path path={plants.yucca} color={c.scrub} />
      </Group>

      {/* pantolon */}
      <Group transform={pantsT} opacity={pantsO}>
        <Path path="M-7 -9 L7 -9 L8 9 L2.6 9 L0 -1 L-2.6 9 L-8 9 Z" color="#b8a679" />
        <Path path="M-7 -9 L7 -9 L7 -7 L-7 -7 Z" color="#7d6a46" />
        <Path path="M0 -7 L0 -1" style="stroke" strokeWidth={0.5} color="rgba(0,0,0,0.3)" />
      </Group>

      {/* toz + duman */}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <Dust key={i} f={f} clock={clock} i={i} k={k} rvT={rv} color={rgba(c.sandLit, 0.95)} />
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Smoke key={i} f={f} clock={clock} i={i} k={k} rvT={rv} tint={light ? "rgba(170,200,225,0.9)" : "rgba(190,215,240,0.75)"} />
      ))}

      <Group transform={rvT}>
        <Oval x={-80} y={-4} width={164} height={8} color="rgba(0,0,0,0.25)" />
        <RvArt spin={spin} doorT={doorT} k={k} glass={glass} lampO={lampO} />
      </Group>

      {/* Jesse ve Walter */}
      <Group opacity={jO} transform={jesse}>
        <Jesse clock={clock} walk={walkJ} />
      </Group>
      <Group opacity={wO} transform={walter}>
        <Walter clock={clock} walk={walkW} hold={hold} />
      </Group>
      <Group opacity={glintO} transform={glintT}>
        <Circle cx={0} cy={0} r={10 * k}>
          <RadialGradient c={vec(0, 0)} r={10 * k} colors={["rgba(120,210,255,0.85)", "rgba(80,170,255,0)"]} />
        </Circle>
        <Path path={`M0 ${-3 * k} L${1.6 * k} 0 L0 ${3 * k} L${-1.6 * k} 0 Z`} color="#8fe0ff" />
        <Path path={`M${-7 * k} 0 L${7 * k} 0 M0 ${-7 * k} L0 ${7 * k}`} style="stroke" strokeWidth={0.6 * k} color="rgba(220,245,255,0.9)" />
      </Group>
      <Rect x={0} y={height - 1} width={width} height={1} color="rgba(0,0,0,0)" />
    </Group>
  );
}
