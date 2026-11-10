// components/decor/particleSprites.js
//
// Atmosfer efektlerinin şekil dokusu: her şekil 100 birimlik bir kutuda,
// BEYAZ (ana yüzey) ve GRİ (gölge/damar/desen) çizilir. ParticleField bunu
// bir kez dokuya çevirir; renk parçacık başına "modulate" ile verilir — gri
// bölgeler aynı tonun koyusu olur.
//
// Düzen: SPRITE_COLS sütunlu ızgara (8 × 16 hücre, 1024 × 2048 px). Hücre
// numarası utils/weatherParticles.js SPRITE tablosuyla BİREBİR aynı olmalı.
// Şimşek, dalga ve kum burada DEĞİL: vektör (VectorLayers.js). Evren sahnelerinin
// şekilleri (60–120) ayrı dosyada: universeSprites.js.
// Kanat çırpanlarda (kelebek, yarasa, martı) "kapalı" kare "açık"tan hemen
// sonra gelir.
//
// Dar şekiller (yağmur, iz, çim, sap, balon, cam damlası, konfeti) yalnız
// SPRITE_RECT'teki dikdörtgenden örneklenir: o dikdörtgenin DIŞINA taşan
// çizim görünmez — yeni şekil eklerken sınırın içinde kal.

import React from "react";
import {
  BlurMask,
  Circle,
  Group,
  LinearGradient,
  Oval,
  Path,
  RadialGradient,
  Rect,
  Skia,
  vec,
} from "@shopify/react-native-skia";
import { SPRITE, SPRITE_CELL, spriteOrigin } from "../../utils/weatherParticles";
import UniverseCells from "./universeSprites";

const CELL = SPRITE_CELL;
const WHITE = "#ffffff";
// Damar/gölge GRİ: "modulate" rengi çarptığından gri bölge aynı tonun koyusu olur.
const VEIN = "#9c9c9c";
const SHADE = "#c8c8c8";
const DARK = "#6e6e6e";
const fade = (a) => `rgba(255,255,255,${a})`;

// ── Yol üreticiler ─────────────────────────────────────────────────────────

const pt = (x, y) => `${x.toFixed(2)} ${y.toFixed(2)}`;

function flakePath() {
  let d = "";
  for (let k = 0; k < 6; k += 1) {
    const a = (k * Math.PI) / 3;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    d += `M50 50 L${pt(50 + ux * 44, 50 + uy * 44)} `;
    // her kolda iki dal (±45°)
    for (const s of [-1, 1]) {
      const b = a + (s * Math.PI) / 4;
      const bx = 50 + ux * 26;
      const by = 50 + uy * 26;
      d += `M${pt(bx, by)} L${pt(bx + Math.cos(b) * 13, by + Math.sin(b) * 13)} `;
    }
  }
  return d.trim();
}

// Karahindiba: sapın tepesinden yukarı yelpaze gibi açılan tüyler.
const DANDELION_RAYS = Array.from({ length: 13 }, (_, i) => {
  const a = Math.PI + (i / 12) * Math.PI; // 180°–360° (yukarı yarım daire)
  const len = 34 + (i % 2) * 6;
  return [50 + Math.cos(a) * len, 54 + Math.sin(a) * len];
});
const DANDELION = DANDELION_RAYS.map(([x, y]) => `M50 54 L${pt(x, y)}`).join(" ");

const mirror = (d) =>
  d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${(100 - Number(x)).toFixed(2)} ${y}`);

const FLAKE = flakePath();
const LEAF_A =
  "M50 4 C74 22 82 52 62 80 C57 87 53 91 50 96 C47 91 43 87 38 80 C18 52 26 22 50 4 Z";
const LEAF_A_VEINS =
  "M50 12 L50 94 M50 40 L63 30 M50 55 L65 46 M50 70 L61 63 M50 40 L37 30 M50 55 L35 46 M50 70 L39 63";
const LEAF_B =
  "M50 4 L58 24 L72 16 L68 38 L90 34 L78 52 L94 60 L70 66 L74 80 L54 72 L52 96 L48 96 L46 72 L26 80 L30 66 L6 60 L22 52 L10 34 L32 38 L28 16 L42 24 Z";
const LEAF_B_VEINS = "M50 92 L50 20 M50 62 L78 42 M50 62 L22 42 M50 68 L80 62 M50 68 L20 62";
const PETAL =
  "M50 18 L43 7 C24 16 14 50 34 78 C41 88 47 93 50 94 C53 93 59 88 66 78 C86 50 76 16 57 7 Z";
const STAR =
  "M50 4 C54 38 62 46 96 50 C62 54 54 62 50 96 C46 62 38 54 4 50 C38 46 46 38 50 4 Z";
const HEART =
  "M50 88 C20 66 6 48 10 30 C14 14 34 8 50 26 C66 8 86 14 90 30 C94 48 80 66 50 88 Z";
const SPECK = "M42 30 C58 24 74 36 70 52 C68 66 52 74 40 66 C26 58 28 36 42 30 Z";
const TICKET = "M14 32 Q14 28 18 28 L82 28 Q86 28 86 32 L86 68 Q86 72 82 72 L18 72 Q14 72 14 68 Z";
const WING_UP_R = "M52 48 C62 20 90 12 94 30 C97 46 78 54 53 53 Z";
const WING_LOW_R = "M53 56 C74 57 88 70 80 84 C72 94 58 80 53 60 Z";
const BAT_WING_R =
  "M54 44 C64 32 82 30 96 40 C88 42 84 48 84 55 C78 49 72 49 68 55 C64 49 58 49 54 55 Z";
const BAT_HEAD = "M50 46 C45 46 43 41 44 35 L47 39 L50 37 L53 39 L56 35 C57 41 55 46 50 46 Z";

// Çim (taban y = 100, uç yukarıda). A: tek yaprak (x 38–62), B: iki yaprak (x 30–70).
const GRASS_A = "M44 100 C45 70 47 36 53 3 C52 36 55 70 57 100 Z";
const GRASS_B1 = "M40 100 C40 72 37 44 32 14 C42 42 46 70 48 100 Z";
const GRASS_B2 = "M52 100 C54 70 60 40 68 8 C63 40 60 72 60 100 Z";
// Çiçek: sap (x 44–56) + baş (5 taç yaprak).
const STEM = "M48.6 100 L51.4 100 L50.8 0 L49.2 0 Z";
const STEM_LEAF = "M50.5 62 C53 58 55 54 55.5 48 C52.5 51 51 55 50.5 62 Z";
const FLOWER_PETAL = "M50 50 C40 40 41 16 50 8 C59 16 60 40 50 50 Z";
// Martı: açık (M biçimi) ve aşağı inmiş kanat.
const GULL_OPEN = "M16 54 C26 40 40 40 50 53 C60 40 74 40 84 54";
const GULL_CLOSED = "M22 48 C32 56 42 58 50 53 C58 58 68 56 78 48";
// Nota: sekizlik (♪) ve bağlı (♫).
const NOTE_FLAG = "M54 16 C66 24 74 32 70 50 C68 40 62 33 54 31 Z";
const NOTE_BEAM = "M38 22 L83 13 L83 24 L38 33 Z";
// Cam damlası (dikdörtgen x 40–60): yuvarlak baş altta, üstte süzülme izi.
const DROP_HEAD = "M50 62 C55 70 58 76 58 82 A8 8 0 0 1 42 82 C42 76 45 70 50 62 Z";
// Uçurtma: dört köşeli gövde + çapraz çıta; kuyruk fiyonkları.
const KITE = "M50 4 L78 34 L50 74 L22 34 Z";
const KITE_HALF = "M50 4 L78 34 L50 74 Z";
const KITE_TAIL = "M50 74 C44 82 58 86 50 94";
// Kâğıt uçak (burun sağda): üst kanat + alt kanat + gövde kıvrımı.
const PLANE_TOP = "M6 46 L94 40 L36 58 Z";
const PLANE_LOW = "M36 58 L94 40 L44 70 Z";
const PLANE_FOLD = "M36 58 L94 40 L30 62 Z";
// Parşömen: hafif kıvrık kenarlı yırtık kâğıt parçası.
const PARCHMENT =
  "M16 22 C30 18 44 24 58 20 C68 17 78 20 86 18 L84 34 L88 46 L82 60 L86 76 C72 80 60 76 46 80 C34 83 24 78 14 82 L18 66 L12 52 L18 38 Z";
// Bulut: üç tepe + düz taban.
const CLOUD =
  "M18 66 C6 66 4 50 16 46 C14 34 28 28 36 34 C40 20 60 16 66 30 C76 24 90 32 86 46 C98 48 96 66 84 66 Z";
// Yuvarlanan çalı: iç içe dolaşık halkalar.
const TUMBLE_LOOPS = [
  [50, 50, 40, 0], [50, 50, 30, 0.6], [46, 54, 22, 1.2], [56, 46, 18, 2],
];

function Tumbleweed() {
  return (
    <>
      <Circle cx={50} cy={50} r={42} color={fade(0.14)} />
      {TUMBLE_LOOPS.map(([cx, cy, r, a]) => (
        <Group key={a} transform={[{ translateX: cx }, { translateY: cy }, { rotate: a }, { scaleX: 1.15 }, { translateX: -cx }, { translateY: -cy }]}>
          <Circle cx={cx} cy={cy} r={r} style="stroke" strokeWidth={3.2} color={a ? SHADE : WHITE} />
        </Group>
      ))}
      <Path
        path="M14 44 C30 30 46 70 62 40 C70 26 84 40 88 56 M22 72 C36 60 52 82 70 62 M40 12 C44 30 30 52 52 60 C66 66 62 86 58 90"
        style="stroke"
        strokeWidth={2.4}
        strokeCap="round"
        color={VEIN}
      />
    </>
  );
}

// Noel Baba kızağı (sağa gider; dikdörtgen y 22–72): iki ren geyiği + koşum + kızak.
const REINDEER_LEGS = "M11 55 L6 64 M16 55 L19 63 M25 55 L31 62 M29 55 L34 60";
const REINDEER_ANTLERS = "M33 41 L31 32 M32 37 L28 35 M32 36 L35 31";
function Reindeer({ x, y }) {
  // 0,75 ölçekli; x = geyiğin sol ucu (bacak), y = dikey kayma
  return (
    <Group transform={[{ translateX: x - 4.5 }, { translateY: y }, { scale: 0.75 }]}>
      <Path path={REINDEER_LEGS} style="stroke" strokeWidth={2.4} strokeCap="round" color="#6b4220" />
      <Oval x={8} y={46} width={24} height={11} color="#9a6a3a" />
      <Path path="M28 49 L33 42 L36 44 L32 52 Z" color="#9a6a3a" />
      <Circle cx={35} cy={42} r={3.6} color="#9a6a3a" />
      <Circle cx={38} cy={43} r={1.3} color="#d62828" />
      <Path path={REINDEER_ANTLERS} style="stroke" strokeWidth={1.5} strokeCap="round" color="#e8d9b0" />
    </Group>
  );
}
// Düzen (sağa gider): kızak SOLDA (arkada), geyikler SAĞDA (önde, çeker);
// ikinci geyik biraz yukarıda, aralarında boşluk.
function Sleigh() {
  return (
    <>
      <Path path="M42 51 L46 51 M70 49 L74 47" style="stroke" strokeWidth={1.2} color="#d4af37" />
      <Reindeer x={46} y={14} />
      <Reindeer x={74} y={11} />
      <Group transform={[{ translateX: -56 }]}>
        <Path path="M58 68 L90 68 C97 68 99 60 94 57" style="stroke" strokeWidth={2.4} strokeCap="round" color="#d4af37" />
        <Path path="M66 63 L66 68 M84 63 L84 68" style="stroke" strokeWidth={1.6} color="#d4af37" />
        <Path path="M60 50 L94 45 C98 45 98 51 94 56 L87 63 L63 63 C59 63 57 56 60 50 Z" color="#c62828" />
        <Rect x={62} y={58} width={9} height={7} color="#e8b04a" />
        <Circle cx={76} cy={42} r={8} color="#d32f2f" />
        <Circle cx={76} cy={43} r={4.2} color="#f5d0b0" />
        <Path path="M68 40 C74 44 80 44 85 40 C85 47 68 47 68 40 Z" color={WHITE} />
        <Path path="M70 38 L77 26 L84 36 Z" color="#d32f2f" />
        <Rect x={69} y={35.5} width={16} height={3.4} color={WHITE} />
        <Circle cx={77.5} cy={26} r={2.6} color={WHITE} />
      </Group>
    </>
  );
}

// ── Güneş sistemi (RENKLİ şekiller: COLORED_SPRITES; parçacık beyaza boyanır) ──
const clipCircle = (r) => {
  const path = Skia.Path.Make();
  path.addCircle(50, 50, r);
  return path;
};
const CLIP_46 = clipCircle(46);
const CLIP_40 = clipCircle(40);
const CLIP_34 = clipCircle(34);
const CLIP_24 = clipCircle(24);
const BOTTOM_HALF = Skia.XYWHRect(0, 50, 100, 50);

// Küre: ışık sol üstten, kenarda koyulaşan degrade.
function Ball({ r = 46, colors, hl = [36, 34] }) {
  return (
    <Circle cx={50} cy={50} r={r}>
      <RadialGradient c={vec(hl[0], hl[1])} r={r * 1.75} colors={colors} />
    </Circle>
  );
}

const SUN_RAYS = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2;
  const len = i % 2 ? 41 : 47;
  return `M${pt(50 + Math.cos(a) * 31, 50 + Math.sin(a) * 31)} L${pt(50 + Math.cos(a) * len, 50 + Math.sin(a) * len)}`;
}).join(" ");

function Sun() {
  return (
    <>
      <Circle cx={50} cy={50} r={50}>
        <RadialGradient c={vec(50, 50)} r={50} colors={["rgba(255,196,64,0.6)", "rgba(255,140,30,0.28)", "rgba(255,120,20,0)"]} positions={[0.45, 0.7, 1]} />
      </Circle>
      <Path path={SUN_RAYS} style="stroke" strokeWidth={3.4} strokeCap="round" color="rgba(255,208,96,0.7)" />
      <Ball r={29} hl={[42, 40]} colors={["#fffbd5", "#ffd54a", "#ff9800", "#e65100"]} />
      <Oval x={38} y={40} width={8} height={5} color="rgba(130,50,0,0.5)" />
      <Oval x={56} y={55} width={6} height={4} color="rgba(130,50,0,0.5)" />
      <Oval x={50} y={34} width={5} height={3.4} color="rgba(130,50,0,0.45)" />
    </>
  );
}

function Mercury() {
  return (
    <>
      <Ball colors={["#d4cfc8", "#97918a", "#4a4742"]} />
      <Group clip={CLIP_46}>
        {[[36, 38, 6], [62, 32, 4], [58, 62, 7], [34, 64, 4.5], [72, 50, 3]].map(([x, y, r]) => (
          <Circle key={`${x}${y}`} cx={x} cy={y} r={r} color="rgba(60,55,50,0.4)" />
        ))}
      </Group>
    </>
  );
}

function Venus() {
  return (
    <>
      <Ball colors={["#fff2c8", "#e9b96e", "#8a5a22"]} />
      <Group clip={CLIP_46}>
        <Path path="M6 38 C28 28 48 50 94 36" style="stroke" strokeWidth={7} strokeCap="round" color="rgba(255,255,255,0.35)" />
        <Path path="M4 62 C30 52 62 74 96 58" style="stroke" strokeWidth={7} strokeCap="round" color="rgba(150,90,30,0.3)" />
      </Group>
    </>
  );
}

function Earth() {
  return (
    <>
      <Ball colors={["#7cc0ff", "#1f70d2", "#08295f"]} />
      <Group clip={CLIP_46}>
        <Path path="M24 30 C34 20 48 24 46 36 C44 44 34 44 32 54 C24 52 18 40 24 30 Z" color="#4caf50" />
        <Path path="M58 42 C70 36 82 46 78 58 C76 68 64 78 58 68 C54 60 52 50 58 42 Z" color="#388e3c" />
        <Path path="M40 74 C48 70 56 80 48 86 Z" color="#66bb6a" />
        <Path path="M16 58 C32 50 42 62 58 54" style="stroke" strokeWidth={4.5} strokeCap="round" color="rgba(255,255,255,0.55)" />
        <Path path="M46 22 C60 18 72 26 84 20" style="stroke" strokeWidth={4} strokeCap="round" color="rgba(255,255,255,0.5)" />
        <Circle cx={50} cy={3} r={15} color="rgba(255,255,255,0.85)" />
      </Group>
      <Circle cx={50} cy={50} r={45} style="stroke" strokeWidth={2} color="rgba(150,205,255,0.55)" />
    </>
  );
}

function Mars() {
  return (
    <>
      <Ball colors={["#ffb58e", "#d1582b", "#5d230f"]} />
      <Group clip={CLIP_46}>
        <Oval x={20} y={36} width={26} height={16} color="rgba(90,30,15,0.4)" />
        <Oval x={48} y={56} width={30} height={13} color="rgba(90,30,15,0.38)" />
        <Circle cx={50} cy={4} r={16} color="rgba(255,255,255,0.88)" />
      </Group>
    </>
  );
}

function Jupiter() {
  return (
    <>
      <Ball colors={["#f8e6c6", "#d9a066", "#6e4326"]} />
      <Group clip={CLIP_46}>
        <Rect x={0} y={22} width={100} height={8} color="rgba(184,107,58,0.55)" />
        <Rect x={0} y={36} width={100} height={6} color="rgba(255,241,214,0.5)" />
        <Rect x={0} y={46} width={100} height={10} color="rgba(196,124,69,0.6)" />
        <Rect x={0} y={62} width={100} height={7} color="rgba(242,220,184,0.6)" />
        <Rect x={0} y={74} width={100} height={8} color="rgba(168,95,52,0.5)" />
        <Oval x={52} y={55} width={20} height={11} color="rgba(190,57,43,0.92)" />
      </Group>
    </>
  );
}

function Saturn() {
  const rings = (
    <>
      <Oval x={4} y={38} width={92} height={24} style="stroke" strokeWidth={5} color="rgba(222,204,158,0.95)" />
      <Oval x={13} y={41} width={74} height={18} style="stroke" strokeWidth={2.4} color="rgba(172,152,108,0.95)" />
    </>
  );
  return (
    <>
      {rings}
      <Ball r={24} colors={["#fbebc3", "#d8b676", "#7d5d2c"]} />
      <Group clip={CLIP_24}>
        <Rect x={0} y={36} width={100} height={5} color="rgba(168,128,70,0.5)" />
        <Rect x={0} y={52} width={100} height={6} color="rgba(255,240,200,0.45)" />
        <Rect x={0} y={64} width={100} height={4} color="rgba(150,110,60,0.45)" />
      </Group>
      <Group clip={BOTTOM_HALF}>{rings}</Group>
    </>
  );
}

function Uranus() {
  const ring = <Oval x={4} y={36} width={92} height={28} style="stroke" strokeWidth={2} color="rgba(205,242,247,0.75)" />;
  return (
    <>
      {ring}
      <Ball r={34} colors={["#e6fcff", "#8fe0e8", "#35858f"]} />
      <Group clip={CLIP_34}>
        <Rect x={0} y={44} width={100} height={5} color="rgba(255,255,255,0.18)" />
      </Group>
      <Group clip={BOTTOM_HALF}>{ring}</Group>
    </>
  );
}

function Neptune() {
  return (
    <>
      <Ball r={40} colors={["#97b9ff", "#2f58d8", "#0c1a63"]} />
      <Group clip={CLIP_40}>
        <Rect x={0} y={38} width={100} height={5} color="rgba(255,255,255,0.18)" />
        <Oval x={34} y={48} width={20} height={11} color="rgba(8,20,80,0.55)" />
        <Path path="M58 36 C66 34 74 38 80 36" style="stroke" strokeWidth={2.4} strokeCap="round" color="rgba(255,255,255,0.65)" />
      </Group>
    </>
  );
}

function Moon() {
  return (
    <>
      <Ball r={44} colors={["#f3f1ea", "#b9b6ae", "#65645f"]} />
      {[[38, 40, 7], [60, 34, 5], [58, 62, 8], [34, 62, 5]].map(([x, y, r]) => (
        <Circle key={`${x}${y}`} cx={x} cy={y} r={r} color="rgba(88,86,82,0.38)" />
      ))}
    </>
  );
}

function Iss() {
  const panel = (x, y) => (
    <>
      <Rect x={x} y={y} width={22} height={13} color="#2f4fa8" />
      <Path path={`M${x + 5.5} ${y} L${x + 5.5} ${y + 13} M${x + 11} ${y} L${x + 11} ${y + 13} M${x + 16.5} ${y} L${x + 16.5} ${y + 13}`} style="stroke" strokeWidth={0.9} color="#9db5ee" />
    </>
  );
  return (
    <>
      <Path path="M14 50 L86 50" style="stroke" strokeWidth={3} strokeCap="round" color="#c9ced6" />
      {panel(4, 33)}
      {panel(4, 54)}
      {panel(74, 33)}
      {panel(74, 54)}
      <Rect x={36} y={46.5} width={7} height={7} color="#bfc4cc" />
      <Rect x={57} y={46.5} width={7} height={7} color="#bfc4cc" />
      <Rect x={43} y={43} width={14} height={14} color="#eceef2" />
      <Rect x={47.5} y={31} width={5} height={12} color="#f5f6f8" />
    </>
  );
}

function Pulsar() {
  return (
    <>
      <Circle cx={50} cy={50} r={26}>
        <RadialGradient c={vec(50, 50)} r={26} colors={["rgba(130,190,255,0.55)", "rgba(80,130,255,0)"]} />
      </Circle>
      <Path path="M50 50 L45 0 L55 0 Z">
        <LinearGradient start={vec(50, 50)} end={vec(50, 0)} colors={["rgba(210,235,255,0.95)", "rgba(120,170,255,0)"]} />
      </Path>
      <Path path="M50 50 L45 100 L55 100 Z">
        <LinearGradient start={vec(50, 50)} end={vec(50, 100)} colors={["rgba(210,235,255,0.95)", "rgba(120,170,255,0)"]} />
      </Path>
      <Circle cx={50} cy={50} r={8}>
        <RadialGradient c={vec(50, 50)} r={8} colors={["#ffffff", "#b6dcff", "rgba(150,200,255,0)"]} positions={[0, 0.5, 1]} />
      </Circle>
    </>
  );
}

const BH_ARM = "M50 50 C68 38 90 56 82 80";
function BlackHole() {
  return (
    <>
      <Circle cx={50} cy={50} r={48}>
        <RadialGradient
          c={vec(50, 50)}
          r={48}
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0)", "#ffd89a", "#ff8a1f", "rgba(170,50,0,0.55)", "rgba(0,0,0,0)"]}
          positions={[0, 0.36, 0.44, 0.58, 0.8, 1]}
        />
      </Circle>
      {[0, 120, 240].map((deg) => (
        <Group key={deg} transform={[{ translateX: 50 }, { translateY: 50 }, { rotate: (deg * Math.PI) / 180 }, { translateX: -50 }, { translateY: -50 }]}>
          <Path path={BH_ARM} style="stroke" strokeWidth={3.4} strokeCap="round" color="rgba(255,228,176,0.7)" />
        </Group>
      ))}
      <Circle cx={50} cy={50} r={17.5} color="#04020a" />
      <Circle cx={50} cy={50} r={18} style="stroke" strokeWidth={1.8} color="rgba(255,233,194,0.95)" />
    </>
  );
}

function Cell({ index, children }) {
  const o = spriteOrigin(index);
  return (
    <Group transform={[{ translateX: o.x }, { translateY: o.y }, { scale: CELL / 100 }]}>{children}</Group>
  );
}

// Kanatları gövde ekseninde (x = 50) yatayda daraltır: "kapalı" kare.
function Fold({ k, children }) {
  return (
    <Group transform={[{ translateX: 50 }, { scaleX: k }, { translateX: -50 }]}>{children}</Group>
  );
}

function ButterflyWings() {
  return (
    <>
      <Path path={WING_UP_R} color={WHITE} />
      <Path path={mirror(WING_UP_R)} color={WHITE} />
      <Path path={WING_LOW_R} color={SHADE} />
      <Path path={mirror(WING_LOW_R)} color={SHADE} />
      {/* kanat beneği */}
      <Circle cx={76} cy={30} r={6} color={VEIN} />
      <Circle cx={24} cy={30} r={6} color={VEIN} />
    </>
  );
}

function ButterflyBody() {
  return (
    <>
      <Path path="M48.5 36 L51.5 36 L51.5 74 L48.5 74 Z" color={DARK} />
      <Path path="M50 37 C47 28 44 24 40 22 M50 37 C53 28 56 24 60 22" style="stroke" strokeWidth={1.6} strokeCap="round" color={DARK} />
    </>
  );
}

function BatWings() {
  return (
    <>
      <Path path={BAT_WING_R} color={WHITE} />
      <Path path={mirror(BAT_WING_R)} color={WHITE} />
    </>
  );
}

function BatBody() {
  return (
    <>
      <Path path={BAT_HEAD} color={WHITE} />
      <Path path="M50 44 C55 44 56 52 54 58 C52 62 48 62 46 58 C44 52 45 44 50 44 Z" color={WHITE} />
    </>
  );
}

function Gull({ path }) {
  return (
    <>
      <Path path={path} style="stroke" strokeWidth={5.5} strokeCap="round" strokeJoin="round" color={WHITE} />
      <Circle cx={50} cy={54} r={3.4} color={SHADE} />
    </>
  );
}

export default function SpriteSheet() {
  return (
    <Group>
      <Cell index={SPRITE.dot}>
        <Circle cx={50} cy={50} r={46}>
          <RadialGradient c={vec(50, 50)} r={46} colors={[WHITE, fade(0.85), fade(0)]} positions={[0, 0.45, 1]} />
        </Circle>
      </Cell>
      <Cell index={SPRITE.flake}>
        {/* Kalın çizgi: en küçük (7 dp) kristalde kollar yine seçilsin. */}
        <Path path={FLAKE} style="stroke" strokeWidth={8} strokeCap="round" color={WHITE} />
        <Circle cx={50} cy={50} r={8} color={WHITE} />
      </Cell>
      <Cell index={SPRITE.leafA}>
        <Path path={LEAF_A}>
          <LinearGradient start={vec(30, 10)} end={vec(70, 95)} colors={[WHITE, "#d9d9d9"]} />
        </Path>
        <Path path={LEAF_A_VEINS} style="stroke" strokeWidth={3} strokeCap="round" color={VEIN} />
      </Cell>
      <Cell index={SPRITE.leafB}>
        <Path path={LEAF_B} strokeJoin="round">
          <LinearGradient start={vec(20, 10)} end={vec(80, 95)} colors={[WHITE, "#d4d4d4"]} />
        </Path>
        <Path path={LEAF_B_VEINS} style="stroke" strokeWidth={3} strokeCap="round" color={VEIN} />
      </Cell>
      <Cell index={SPRITE.streak}>
        {/* 7 birim genişlik: 30 dp'lik damla ~2 dp kalınlıkta çizilir. Kuyruk
            saydamdan başlar, uç tam opak ve yuvarlak. Dikdörtgen x 42–58. */}
        <Path path="M50 4 L53.5 92 A3.5 3.5 0 0 1 46.5 92 Z">
          <LinearGradient start={vec(50, 4)} end={vec(50, 96)} colors={[fade(0), fade(0.75), WHITE]} positions={[0, 0.55, 1]} />
        </Path>
      </Cell>
      <Cell index={SPRITE.petal}>
        <Path path={PETAL}>
          <LinearGradient start={vec(50, 8)} end={vec(50, 94)} colors={[WHITE, "#d6d6d6"]} />
        </Path>
      </Cell>
      <Cell index={SPRITE.glow}>
        <Circle cx={50} cy={50} r={48}>
          <RadialGradient c={vec(50, 50)} r={48} colors={[WHITE, fade(0.9), fade(0.32), fade(0)]} positions={[0, 0.12, 0.38, 1]} />
        </Circle>
      </Cell>
      <Cell index={SPRITE.popcorn}>
        <Circle cx={50} cy={72} r={10} color={VEIN} />
        <Circle cx={36} cy={60} r={17} color={SHADE} />
        <Circle cx={64} cy={60} r={17} color={SHADE} />
        <Circle cx={40} cy={42} r={20} color={WHITE} />
        <Circle cx={62} cy={40} r={19} color={WHITE} />
        <Circle cx={51} cy={57} r={20} color={WHITE} />
      </Cell>
      <Cell index={SPRITE.ticket}>
        <Path path={TICKET}>
          <LinearGradient start={vec(14, 28)} end={vec(86, 72)} colors={[WHITE, "#dedede"]} />
        </Path>
        {/* yan çentikler: bileti oyar */}
        <Circle cx={14} cy={50} r={7} color="black" blendMode="dstOut" />
        <Circle cx={86} cy={50} r={7} color="black" blendMode="dstOut" />
        {[35, 42, 49, 56, 63].map((y) => (
          <Circle key={y} cx={66} cy={y} r={1.8} color={VEIN} />
        ))}
        <Path path="M24 42 L54 42 M24 50 L48 50 M24 58 L52 58" style="stroke" strokeWidth={3} strokeCap="round" color={SHADE} />
      </Cell>
      <Cell index={SPRITE.star}>
        <Path path={STAR} color={WHITE} />
        <Circle cx={50} cy={50} r={14}>
          <RadialGradient c={vec(50, 50)} r={14} colors={[WHITE, fade(0)]} />
        </Circle>
      </Cell>
      <Cell index={SPRITE.butterflyOpen}>
        <ButterflyWings />
        <ButterflyBody />
      </Cell>
      <Cell index={SPRITE.butterflyClosed}>
        <Fold k={0.32}>
          <ButterflyWings />
        </Fold>
        <ButterflyBody />
      </Cell>
      <Cell index={SPRITE.dandelion}>
        <Path path="M50 54 C51 70 49 84 51 98" style="stroke" strokeWidth={2.2} strokeCap="round" color={VEIN} />
        <Path path={DANDELION} style="stroke" strokeWidth={1.6} strokeCap="round" color={WHITE} />
        {DANDELION_RAYS.map(([x, y]) => (
          <Circle key={`${x.toFixed(1)}-${y.toFixed(1)}`} cx={x} cy={y} r={3.2} color={WHITE} />
        ))}
        <Circle cx={50} cy={54} r={3.5} color={SHADE} />
      </Cell>
      <Cell index={SPRITE.heart}>
        <Path path={HEART}>
          <LinearGradient start={vec(30, 10)} end={vec(70, 90)} colors={[WHITE, "#d2d2d2"]} />
        </Path>
        <Path path="M28 28 C24 34 24 40 26 44" style="stroke" strokeWidth={4} strokeCap="round" color={fade(0.9)} />
      </Cell>
      <Cell index={SPRITE.batOpen}>
        <BatWings />
        <BatBody />
      </Cell>
      <Cell index={SPRITE.batClosed}>
        <Group transform={[{ translateY: -6 }]}>
          <Fold k={0.5}>
            <BatWings />
          </Fold>
        </Group>
        <BatBody />
      </Cell>
      <Cell index={SPRITE.pumpkin}>
        <Path path="M48 26 C48 20 51 14 56 12 L58 15 C54 17 53 21 53 26 Z" color={DARK} />
        <Circle cx={34} cy={58} r={24} color={SHADE} />
        <Circle cx={66} cy={58} r={24} color={SHADE} />
        <Circle cx={50} cy={58} r={28} color={WHITE} />
        <Path path="M50 32 C44 44 44 72 50 84 M38 34 C30 46 30 70 38 82 M62 34 C70 46 70 70 62 82" style="stroke" strokeWidth={2.4} strokeCap="round" color={VEIN} />
      </Cell>
      <Cell index={SPRITE.speck}>
        <Path path={SPECK} color={WHITE} />
      </Cell>
      <Cell index={SPRITE.trail}>
        <Path path="M49 4 L51 4 L51.3 94 A1.3 1.3 0 0 1 48.7 94 Z">
          <LinearGradient start={vec(50, 4)} end={vec(50, 96)} colors={[fade(0), fade(0.6), WHITE]} positions={[0, 0.6, 1]} />
        </Path>
      </Cell>
      <Cell index={SPRITE.grassA}>
        <Path path={GRASS_A}>
          <LinearGradient start={vec(50, 0)} end={vec(50, 100)} colors={[WHITE, "#b4b4b4"]} />
        </Path>
      </Cell>
      <Cell index={SPRITE.grassB}>
        <Path path={GRASS_B1}>
          <LinearGradient start={vec(40, 10)} end={vec(44, 100)} colors={["#e6e6e6", "#a8a8a8"]} />
        </Path>
        <Path path={GRASS_B2}>
          <LinearGradient start={vec(64, 8)} end={vec(56, 100)} colors={[WHITE, "#b4b4b4"]} />
        </Path>
      </Cell>
      <Cell index={SPRITE.flowerStem}>
        <Path path={STEM} color={WHITE} />
        <Path path={STEM_LEAF} color={SHADE} />
      </Cell>
      <Cell index={SPRITE.flowerHead}>
        {[0, 72, 144, 216, 288].map((deg) => (
          <Group key={deg} transform={[{ translateX: 50 }, { translateY: 50 }, { rotate: (deg * Math.PI) / 180 }, { translateX: -50 }, { translateY: -50 }]}>
            <Path path={FLOWER_PETAL}>
              <LinearGradient start={vec(50, 10)} end={vec(50, 50)} colors={[WHITE, "#e2e2e2"]} />
            </Path>
          </Group>
        ))}
        <Circle cx={50} cy={50} r={10} color={DARK} />
        <Circle cx={47} cy={47} r={3.5} color={SHADE} />
      </Cell>
      <Cell index={SPRITE.gullOpen}>
        <Gull path={GULL_OPEN} />
      </Cell>
      <Cell index={SPRITE.gullClosed}>
        <Gull path={GULL_CLOSED} />
      </Cell>
      <Cell index={SPRITE.ribbon}>
        {/* Aurora perdesi (dikdörtgen y 30–70): yumuşak elips + dikey ışık
            süzgeçleri; kenarlar saydama iner, geniş çizilince uç görünmez. */}
        <Group transform={[{ translateY: 50 }, { scaleY: 0.38 }, { translateY: -50 }]}>
          <Circle cx={50} cy={50} r={50}>
            <RadialGradient c={vec(50, 50)} r={50} colors={[fade(0.8), fade(0.42), fade(0)]} positions={[0, 0.55, 1]} />
          </Circle>
        </Group>
        {[22, 33, 41, 52, 60, 71, 79].map((x, i) => (
          <Rect key={x} x={x - 1.6} y={34 + (i % 3) * 2} width={3.2} height={26 - (i % 2) * 6}>
            <LinearGradient start={vec(x, 34)} end={vec(x, 62)} colors={[fade(0), fade(0.45), fade(0)]} />
            <BlurMask blur={1.5} style="normal" />
          </Rect>
        ))}
      </Cell>
      <Cell index={SPRITE.solid}>
        {/* Şimşek aydınlığı: dikdörtgen x/y 40–60 tam dolu (doğrusal
            örnekleme kenarda bile komşu boş piksele değmesin diye taşırıldı). */}
        <Rect x={34} y={34} width={32} height={32} color={WHITE} />
      </Cell>
      <Cell index={SPRITE.balloon}>
        {/* Dikdörtgen x 20–80: balon + düğüm + ip. */}
        <Oval x={25} y={4} width={50} height={62}>
          <RadialGradient c={vec(40, 22)} r={50} colors={[WHITE, "#e6e6e6", "#b8b8b8"]} positions={[0, 0.5, 1]} />
        </Oval>
        <Path path="M46 70 L54 70 L50 64 Z" color={SHADE} />
        <Path path="M50 70 C46 78 54 86 49 98" style="stroke" strokeWidth={1.4} strokeCap="round" color={VEIN} />
        <Path path="M36 20 C38 14 42 11 46 10" style="stroke" strokeWidth={3.5} strokeCap="round" color={fade(0.9)} />
      </Cell>
      <Cell index={SPRITE.noteA}>
        <Group transform={[{ translateX: 38 }, { translateY: 76 }, { rotate: -0.35 }, { translateX: -38 }, { translateY: -76 }]}>
          <Oval x={24} y={66} width={28} height={20} color={WHITE} />
        </Group>
        <Rect x={48.5} y={16} width={5} height={60} color={WHITE} />
        <Path path={NOTE_FLAG} color={SHADE} />
      </Cell>
      <Cell index={SPRITE.noteB}>
        {[[28, 78], [68, 70]].map(([cx, cy]) => (
          <Group key={cx} transform={[{ translateX: cx }, { translateY: cy }, { rotate: -0.35 }, { translateX: -cx }, { translateY: -cy }]}>
            <Oval x={cx - 13} y={cy - 9} width={26} height={18} color={WHITE} />
          </Group>
        ))}
        <Rect x={38} y={24} width={4.5} height={54} color={WHITE} />
        <Rect x={78.5} y={16} width={4.5} height={54} color={WHITE} />
        <Path path={NOTE_BEAM} color={SHADE} />
      </Cell>
      <Cell index={SPRITE.drop}>
        <Path path="M49.2 6 L50.8 6 L51.5 66 L48.5 66 Z">
          <LinearGradient start={vec(50, 6)} end={vec(50, 66)} colors={[fade(0), fade(0.45)]} />
        </Path>
        <Path path={DROP_HEAD}>
          <LinearGradient start={vec(44, 64)} end={vec(56, 90)} colors={[fade(0.7), WHITE]} />
        </Path>
        <Circle cx={47} cy={80} r={2.2} color={WHITE} />
      </Cell>
      <Cell index={SPRITE.confetti}>
        {/* Dikdörtgen y 37–63: kıvrık kâğıt şerit, iki yüzü farklı ton. */}
        <Path path="M22 40 L54 40 L54 60 L22 60 Z" color={WHITE} />
        <Path path="M54 40 C66 38 74 44 78 40 L78 60 C74 64 66 58 54 60 Z" color={SHADE} />
      </Cell>
      <Cell index={SPRITE.cloud}>
        <Path path={CLOUD}>
          <LinearGradient start={vec(50, 20)} end={vec(50, 66)} colors={[WHITE, "#dcdcdc"]} />
        </Path>
        <Path path="M22 60 C40 64 64 64 80 60" style="stroke" strokeWidth={3} strokeCap="round" color={SHADE} />
      </Cell>
      <Cell index={SPRITE.kite}>
        <Path path={KITE} color={WHITE} />
        <Path path={KITE_HALF} color={SHADE} />
        <Path path="M50 4 L50 74 M22 34 L78 34" style="stroke" strokeWidth={2} color={VEIN} />
        <Path path={KITE_TAIL} style="stroke" strokeWidth={1.6} strokeCap="round" color={VEIN} />
        <Path path="M44 82 L50 78 L50 86 Z M52 88 L58 84 L58 92 Z" color={WHITE} />
      </Cell>
      <Cell index={SPRITE.plane}>
        <Path path={PLANE_TOP} color={WHITE} />
        <Path path={PLANE_LOW} color={SHADE} />
        <Path path={PLANE_FOLD} color={VEIN} />
      </Cell>
      <Cell index={SPRITE.parchment}>
        <Path path={PARCHMENT}>
          <LinearGradient start={vec(14, 18)} end={vec(88, 82)} colors={[WHITE, "#cfcfcf"]} />
        </Path>
        <Path path="M26 36 L72 34 M26 46 L66 45 M26 56 L74 55 M26 66 L58 66" style="stroke" strokeWidth={2.2} strokeCap="round" color={VEIN} />
      </Cell>
      <Cell index={SPRITE.tumbleweed}>
        <Tumbleweed />
      </Cell>
      <Cell index={SPRITE.sleigh}>
        <Sleigh />
      </Cell>
      <Cell index={SPRITE.snowman}>
        {/* tabana oturur (y = 100): alt, orta, baş küre + atkı, şapka, düğme */}
        <Circle cx={50} cy={80} r={20}>
          <RadialGradient c={vec(43, 72)} r={30} colors={[WHITE, "#dcdcdc"]} />
        </Circle>
        <Circle cx={50} cy={53} r={14.5}>
          <RadialGradient c={vec(45, 48)} r={22} colors={[WHITE, "#dcdcdc"]} />
        </Circle>
        <Circle cx={50} cy={32} r={10.5}>
          <RadialGradient c={vec(46, 28)} r={16} colors={[WHITE, "#dcdcdc"]} />
        </Circle>
        <Path path="M16 52 L36 58 M84 52 L64 58 M16 52 L10 46 M84 52 L90 46" style="stroke" strokeWidth={2.6} strokeCap="round" color={VEIN} />
        <Rect x={36} y={40} width={28} height={5.5} color={SHADE} />
        <Rect x={57} y={44} width={5.5} height={12} color={SHADE} />
        <Rect x={39} y={13} width={22} height={4} color={DARK} />
        <Rect x={43} y={2} width={14} height={12} color={DARK} />
        <Path path="M50 32 L60 34.5 L50 36.5 Z" color={VEIN} />
        <Circle cx={46} cy={29} r={1.6} color={DARK} />
        <Circle cx={54} cy={29} r={1.6} color={DARK} />
        {[52, 60, 68].map((y) => (
          <Circle key={y} cx={50} cy={y} r={2} color={DARK} />
        ))}
      </Cell>
      <Cell index={SPRITE.xmasTree}>
        <Path path="M50 8 L70 36 L59 36 L78 62 L64 62 L88 94 L12 94 L36 62 L22 62 L41 36 L30 36 Z">
          <LinearGradient start={vec(50, 8)} end={vec(50, 94)} colors={[WHITE, "#bdbdbd"]} />
        </Path>
        <Rect x={44} y={94} width={12} height={6} color={DARK} />
        <Path path={STAR} transform={[{ translateX: 50 }, { translateY: 7 }, { scale: 0.16 }, { translateX: -50 }, { translateY: -50 }]} color={SHADE} />
        {[[45, 40], [57, 52], [38, 70], [62, 78], [50, 62], [30, 86], [72, 88]].map(([x, y]) => (
          <Circle key={`${x}-${y}`} cx={x} cy={y} r={3.2} color={VEIN} />
        ))}
      </Cell>
      <Cell index={SPRITE.gift}>
        <Rect x={20} y={40} width={60} height={50} color={WHITE} />
        <Rect x={16} y={32} width={68} height={14} color={SHADE} />
        <Rect x={45} y={32} width={10} height={58} color={VEIN} />
        <Path path="M50 32 C38 14 26 20 34 30 Z M50 32 C62 14 74 20 66 30 Z" color={VEIN} />
        <Circle cx={50} cy={32} r={5} color={DARK} />
      </Cell>
      <Cell index={SPRITE.candyCane}>
        <Path path="M62 94 L62 40 C62 18 34 18 34 40" style="stroke" strokeWidth={13} strokeCap="round" color={WHITE} />
        <Path path="M55 86 L69 80 M55 72 L69 66 M55 58 L69 52 M55 44 L69 38 M44 22 L48 34 M33 30 L37 42" style="stroke" strokeWidth={4.5} strokeCap="butt" color={VEIN} />
      </Cell>
      <Cell index={SPRITE.ornament}>
        <Circle cx={50} cy={58} r={29}>
          <RadialGradient c={vec(40, 46)} r={42} colors={[WHITE, "#d8d8d8", "#a8a8a8"]} positions={[0, 0.5, 1]} />
        </Circle>
        <Rect x={43} y={22} width={14} height={9} color={DARK} />
        <Path path="M50 22 C42 12 58 12 50 22" style="stroke" strokeWidth={2} strokeCap="round" color={VEIN} />
        <Path path="M30 52 C32 44 38 40 44 39" style="stroke" strokeWidth={4} strokeCap="round" color={fade(0.9)} />
        <Path path="M26 66 C40 74 60 74 74 66" style="stroke" strokeWidth={3} strokeCap="round" color={VEIN} />
      </Cell>
      <Cell index={SPRITE.ghost}>
        <Path path="M22 94 L22 46 C22 18 78 18 78 46 L78 94 L68 85 L59 94 L50 85 L41 94 L32 85 Z">
          <LinearGradient start={vec(50, 18)} end={vec(50, 94)} colors={[WHITE, "#d0d0d0"]} />
        </Path>
        <Path path="M22 62 C12 62 10 52 14 46 M78 62 C88 62 90 52 86 46" style="stroke" strokeWidth={5} strokeCap="round" color={SHADE} />
        <Oval x={34} y={38} width={10} height={14} color={DARK} />
        <Oval x={56} y={38} width={10} height={14} color={DARK} />
        <Oval x={44} y={58} width={12} height={16} color={DARK} />
      </Cell>
      <Cell index={SPRITE.tombstone}>
        <Oval x={14} y={92} width={72} height={9} color={SHADE} />
        <Path path="M28 96 L28 42 C28 20 72 20 72 42 L72 96 Z">
          <LinearGradient start={vec(28, 20)} end={vec(72, 96)} colors={[WHITE, "#b8b8b8"]} />
        </Path>
        <Path path="M50 38 L50 62 M41 47 L59 47" style="stroke" strokeWidth={4.5} strokeCap="round" color={VEIN} />
        <Path path="M38 76 L62 76 M42 84 L58 84" style="stroke" strokeWidth={2.6} strokeCap="round" color={VEIN} />
      </Cell>
      <Cell index={SPRITE.spider}>
        {/* ipin ucu gövdenin üstüne gelir (merkez = ipin ucu + yarım boy) */}
        <Path path="M44 46 C30 34 20 36 12 46 M44 52 C28 48 16 54 10 64 M44 58 C30 62 22 72 18 84 M46 62 C40 72 38 82 40 92 M56 46 C70 34 80 36 88 46 M56 52 C72 48 84 54 90 64 M56 58 C70 62 78 72 82 84 M54 62 C60 72 62 82 60 92" style="stroke" strokeWidth={3.4} strokeCap="round" color={SHADE} />
        <Circle cx={50} cy={64} r={17} color={WHITE} />
        <Circle cx={50} cy={42} r={10} color={SHADE} />
        <Circle cx={46} cy={40} r={2.4} color={DARK} />
        <Circle cx={54} cy={40} r={2.4} color={DARK} />
        <Path path="M50 56 L50 72 M44 62 L56 62" style="stroke" strokeWidth={2} strokeCap="round" color={VEIN} />
      </Cell>
      <Cell index={SPRITE.sun}><Sun /></Cell>
      <Cell index={SPRITE.mercury}><Mercury /></Cell>
      <Cell index={SPRITE.venus}><Venus /></Cell>
      <Cell index={SPRITE.earth}><Earth /></Cell>
      <Cell index={SPRITE.mars}><Mars /></Cell>
      <Cell index={SPRITE.jupiter}><Jupiter /></Cell>
      <Cell index={SPRITE.saturn}><Saturn /></Cell>
      <Cell index={SPRITE.uranus}><Uranus /></Cell>
      <Cell index={SPRITE.neptune}><Neptune /></Cell>
      <Cell index={SPRITE.moon}><Moon /></Cell>
      <Cell index={SPRITE.iss}><Iss /></Cell>
      <Cell index={SPRITE.pulsar}><Pulsar /></Cell>
      <Cell index={SPRITE.blackHole}><BlackHole /></Cell>
      <Cell index={SPRITE.thread}>
        {/* Dikdörtgen x 47–53: ince ip (merkezde 1,6 birim) */}
        <Rect x={49.2} y={0} width={1.6} height={100} color={WHITE} />
      </Cell>
      <UniverseCells />
    </Group>
  );
}
