// components/decor/particleSprites.js
//
// Atmosfer efektlerinin şekil dokusu: her şekil 100 birimlik bir kutuda,
// BEYAZ (ana yüzey) ve GRİ (gölge/damar/desen) çizilir. ParticleField bunu
// bir kez dokuya çevirir; renk parçacık başına "modulate" ile verilir — gri
// bölgeler aynı tonun koyusu olur.
//
// Düzen: SPRITE_COLS sütunlu ızgara (8 × 5 hücre, 512 × 320 px). Hücre
// numarası utils/weatherParticles.js SPRITE tablosuyla BİREBİR aynı olmalı.
// Şimşek, dalga ve kum burada DEĞİL: vektör (VectorLayers.js).
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
  vec,
} from "@shopify/react-native-skia";
import { SPRITE, SPRITE_CELL, spriteOrigin } from "../../utils/weatherParticles";

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
    </Group>
  );
}
