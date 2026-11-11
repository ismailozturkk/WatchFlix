// components/decor/universeSprites.js
//
// Evren sahnelerinin şekil hücreleri (utils/weatherUniverses.js). Aynı dokuya
// (particleSprites.js SpriteSheet) çizilir; hücre numarası SPRITE tablosuyla
// birebir. Kurallar particleSprites.js ile aynı:
//   • her şekil 100 birimlik kutuda; kutunun DIŞINA taşmaz (komşu hücre)
//   • SPRITE_RECT'te daraltılmış şekil o dikdörtgenin içinde kalır
//   • renkli şekiller (COLORED_SPRITES) kendi renkleriyle; diğerleri BEYAZ/GRİ
//     çizilir, parçacık başına paletle boyanır (gri = aynı tonun koyusu)
//   • logo / amblem / karakter yüzü yok: genel, "esinli" silüetler

import React from "react";
import { Circle, Group, LinearGradient, Oval, Path, RadialGradient, Rect, RoundedRect, Skia, vec } from "@shopify/react-native-skia";
import { SPRITE, SPRITE_CELL, spriteOrigin } from "../../utils/weatherParticles";

const WHITE = "#ffffff";
const VEIN = "#9c9c9c";
const SHADE = "#c8c8c8";
const DARK = "#6e6e6e";
const fade = (a) => `rgba(255,255,255,${a})`;

function Cell({ index, children }) {
  const o = spriteOrigin(index);
  return <Group transform={[{ translateX: o.x }, { translateY: o.y }, { scale: SPRITE_CELL / 100 }]}>{children}</Group>;
}

const circlePath = (cx, cy, r) => {
  const p = Skia.Path.Make();
  p.addCircle(cx, cy, r);
  return p;
};

// ── Star Wars ───────────────────────────────────────────────────────────────
const DS_CLIP = circlePath(50, 50, 45);
function DeathStar() {
  return (
    <>
      <Circle cx={50} cy={50} r={45}>
        <RadialGradient c={vec(38, 34)} r={62} colors={["#d9dce1", "#9aa0a8", "#5a5f67"]} positions={[0, 0.55, 1]} />
      </Circle>
      <Group clip={DS_CLIP}>
        <Rect x={0} y={48} width={100} height={3.4} color="#4a4e55" />
        <Rect x={0} y={51.4} width={100} height={1} color="#b8bdc4" />
        <Path path="M10 30 L34 30 M60 26 L86 26 M14 64 L44 64 M58 70 L90 70 M22 78 L52 78 M64 40 L92 40 M8 42 L20 42" style="stroke" strokeWidth={1.1} color="#7d828a" />
        <Path path="M6 36 L28 36 M66 60 L94 60 M30 86 L70 86" style="stroke" strokeWidth={0.9} color="#c4c8ce" />
      </Group>
      <Circle cx={33} cy={32} r={11.5} color="#80868e" />
      <Circle cx={33} cy={32} r={11.5} style="stroke" strokeWidth={1.4} color="#555a61" />
      <Circle cx={33} cy={32} r={6} style="stroke" strokeWidth={1} color="#666b73" />
      <Circle cx={33} cy={32} r={2.2} color="#4a4e55" />
      <Circle cx={50} cy={50} r={45} style="stroke" strokeWidth={1.2} color="rgba(255,255,255,0.35)" />
    </>
  );
}

function XWing() {
  // üstten görünüş, burun sağda (dikdörtgen y 14–86)
  return (
    <>
      <Path path="M28 46 L46 46 L41 18 L32 18 Z M28 54 L46 54 L41 82 L32 82 Z" color="#cfd3d9" />
      <Path path="M33 26 L41 26 L40 22 L33 22 Z M33 74 L41 74 L40 78 L33 78 Z" color="#c0392b" />
      <Rect x={31} y={16.6} width={50} height={2.4} color="#9aa0a8" />
      <Rect x={31} y={81} width={50} height={2.4} color="#9aa0a8" />
      <Path path="M8 45.5 L70 44.5 L96 50 L70 55.5 L8 54.5 Z" color="#e3e6ea" />
      <Path path="M70 44.5 L96 50 L70 55.5 Z" color="#c9ced4" />
      <Path path="M56 47 L66 47.5 L66 52.5 L56 53 Z" color="#33475b" />
      <Path path="M20 46 L20 54 M44 46 L44 54" style="stroke" strokeWidth={1} color="#9aa0a8" />
      <Rect x={14} y={48.6} width={30} height={2.8} color="#c0392b" />
      <Circle cx={10} cy={46} r={2.6} color="#ffb066" />
      <Circle cx={10} cy={54} r={2.6} color="#ffb066" />
    </>
  );
}

const TIE_PANEL = "M11 10 L25 10 L28 50 L25 90 L11 90 L8 50 Z";
function Tie() {
  return (
    <>
      <Rect x={26} y={47} width={48} height={6} color="#7d838c" />
      <Path path={TIE_PANEL} color="#3b3f47" />
      <Path path={TIE_PANEL} transform={[{ translateX: 100 }, { scaleX: -1 }]} color="#3b3f47" />
      <Path path="M18 12 L18 88 M10 30 L26 30 M9 50 L27 50 M10 70 L26 70 M82 12 L82 88 M74 30 L90 30 M73 50 L91 50 M74 70 L90 70" style="stroke" strokeWidth={1.2} color="#6b7079" />
      <Circle cx={50} cy={50} r={14}>
        <RadialGradient c={vec(45, 44)} r={20} colors={["#c4c9d0", "#7d838c"]} />
      </Circle>
      <Circle cx={50} cy={50} r={8} color="#22262c" />
      <Path path="M50 42 L50 58 M42 50 L58 50 M44.5 44.5 L55.5 55.5 M55.5 44.5 L44.5 55.5" style="stroke" strokeWidth={1} color="#5a6069" />
    </>
  );
}

// ── Matrix ──────────────────────────────────────────────────────────────────
// Kod simgeleri (dikdörtgen x 25–75): ayna harf benzeri çizgiler, iki kare.
const GLYPHS = [
  "M32 22 L68 22 M50 22 L50 80 M34 52 L66 46",
  "M34 22 L66 22 L60 50 M40 50 L64 80 M30 80 L50 64",
  "M36 18 L36 82 M36 50 L66 38 M62 18 L64 72",
  "M38 26 C60 14 70 34 50 50 C34 64 42 82 66 78",
];
function Glyph({ d }) {
  return (
    <>
      <Path path={d} style="stroke" strokeWidth={12} strokeCap="round" strokeJoin="round" color={fade(0.18)} />
      <Path path={d} style="stroke" strokeWidth={6.5} strokeCap="round" strokeJoin="round" color={WHITE} />
    </>
  );
}

function Pill() {
  return (
    <>
      <RoundedRect x={14} y={36} width={72} height={28} r={14} color={WHITE} />
      <Path path="M50 36 L36 36 A14 14 0 0 0 36 64 L50 64 Z" color={SHADE} />
      <Path path="M24 43 C30 40 40 40 46 40" style="stroke" strokeWidth={3} strokeCap="round" color={fade(0.9)} />
    </>
  );
}

function Bullet() {
  // dikdörtgen y 36–64, uç sağda
  return (
    <>
      <Path path="M8 42 L60 42 C80 42 92 46 96 50 C92 54 80 58 60 58 L8 58 Z">
        <LinearGradient start={vec(50, 42)} end={vec(50, 58)} colors={["#f6dc93", "#d4a64a", "#8a6422"]} />
      </Path>
      <Rect x={8} y={42} width={6} height={16} color="#7a5a24" />
      <Path path="M20 45 L64 45" style="stroke" strokeWidth={1.6} strokeCap="round" color="rgba(255,248,220,0.85)" />
    </>
  );
}

function ShockRing() {
  return (
    <>
      <Oval x={36} y={8} width={28} height={84} style="stroke" strokeWidth={6} color={fade(0.3)} />
      <Oval x={38} y={10} width={24} height={80} style="stroke" strokeWidth={2.6} color={WHITE} />
    </>
  );
}

const CAT_BODY = "M22 52 C22 42 34 38 50 39 C62 40 70 40 74 42 L77 46 C75 54 70 60 62 62 L30 62 C24 61 22 57 22 52 Z";
function Cat({ legs }) {
  return (
    <>
      <Path path="M24 50 C12 44 10 30 18 22" style="stroke" strokeWidth={4.2} strokeCap="round" color={WHITE} />
      <Path path={CAT_BODY} color={WHITE} />
      <Circle cx={80} cy={40} r={9} color={WHITE} />
      <Path path="M73 35 L75 24 L80 32 Z M82 32 L88 24 L88.5 36 Z" color={WHITE} />
      <Path path={legs} style="stroke" strokeWidth={4.2} strokeCap="round" color={WHITE} />
      <Circle cx={84} cy={39} r={1.4} color={DARK} />
    </>
  );
}

// ── Harry Potter ────────────────────────────────────────────────────────────
function Candle() {
  return (
    <>
      <Circle cx={50} cy={20} r={13}>
        <RadialGradient c={vec(50, 20)} r={13} colors={["rgba(255,214,120,0.7)", "rgba(255,180,60,0)"]} />
      </Circle>
      <Path path="M50 6 C56 14 58 22 54 28 C52 31 48 31 46 28 C42 22 44 14 50 6 Z">
        <LinearGradient start={vec(50, 6)} end={vec(50, 31)} colors={["#ff7a1a", "#ffb703", "#fff3b0"]} />
      </Path>
      <Path path="M50 16 C52 20 52 25 50 28 C48 25 48 20 50 16 Z" color="#fffbe6" />
      <Rect x={49.3} y={28} width={1.4} height={6} color="#3a2a1a" />
      <Path path="M42 34 L58 34 L58 92 L42 92 Z">
        <LinearGradient start={vec(42, 0)} end={vec(58, 0)} colors={["#fff8e6", "#efe0bb", "#d9c69a"]} />
      </Path>
      <Path path="M42 34 L58 34 L58 40 C56 44 55 38 53 42 C51 48 50 38 48 41 C46 45 44 38 42 42 Z" color="#fffdf4" />
    </>
  );
}

function SnitchBall() {
  return (
    <>
      <Circle cx={50} cy={54} r={13}>
        <RadialGradient c={vec(45, 49)} r={16} colors={["#fff4b0", "#e9bd2c", "#9c7414"]} positions={[0, 0.55, 1]} />
      </Circle>
      <Path path="M38 52 C44 46 56 46 62 52 M40 60 C46 64 54 64 60 60" style="stroke" strokeWidth={1.1} color="#8a6410" />
    </>
  );
}
const SNITCH_WING_OPEN = "M61 49 C72 32 88 26 96 30 C90 34 84 38 80 42 C84 42 88 42 90 44 C80 48 70 52 62 54 Z";
const SNITCH_WING_CLOSED = "M59 46 C63 32 70 22 78 16 C76 28 72 36 70 40 C72 40 74 42 74 44 C68 48 64 50 61 52 Z";
const mirrorX = { transform: [{ translateX: 100 }, { scaleX: -1 }] };
function SnitchWings({ d }) {
  return (
    <>
      {[null, mirrorX].map((m, i) => (
        <Group key={i} {...(m || {})}>
          <Path path={d} color="#eef2f7" />
          <Path path={d} style="stroke" strokeWidth={0.9} color="#a9b4c0" />
        </Group>
      ))}
    </>
  );
}

// Kar baykuşu (sağa uçar)
const OWL_BODY = "M24 60 C26 50 40 46 54 48 C60 44 66 40 72 42 C80 44 82 52 78 58 C74 66 60 70 46 70 C36 70 28 68 24 60 Z";
function Owl({ wings }) {
  return (
    <>
      <Path path="M24 60 L10 54 L12 64 Z" color="#e9e9e2" />
      {wings.map((d, i) => (
        <Path key={d} path={d} color={i ? "#f4f4ee" : "#d9d9d0"} />
      ))}
      <Path path={OWL_BODY} color="#f7f7f2" />
      <Path path="M40 54 L42 56 M48 58 L50 60 M36 62 L38 64 M56 62 L58 64 M46 64 L48 66" style="stroke" strokeWidth={1.8} strokeCap="round" color="#a8a89c" />
      <Circle cx={74} cy={48} r={2.6} color="#f5c400" />
      <Circle cx={74.6} cy={48} r={1.2} color="#1a1a1a" />
      <Path path="M80 51 L84 53 L80 55 Z" color="#4a4a42" />
    </>
  );
}
const OWL_UP = ["M38 52 C30 32 18 20 6 16 C14 28 18 40 30 58 Z", "M50 50 C54 30 64 16 80 10 C74 26 68 40 60 54 Z"];
const OWL_DOWN = ["M38 60 C30 72 18 82 6 84 C16 76 22 68 30 58 Z", "M52 64 C58 78 68 88 82 92 C74 80 68 70 62 60 Z"];

function Letter() {
  return (
    <>
      <RoundedRect x={14} y={28} width={72} height={44} r={2} color="#f3e6c8" />
      <Path path="M14 30 L50 56 L86 30" style="stroke" strokeWidth={1.8} strokeJoin="round" color="#c9b48a" />
      <Path path="M14 70 L40 50 M86 70 L60 50" style="stroke" strokeWidth={1.2} color="#d8c69e" />
      <Circle cx={50} cy={54} r={7} color="#b3261e" />
      <Circle cx={50} cy={54} r={4} style="stroke" strokeWidth={1} color="#e05a4f" />
    </>
  );
}

// ── Yüzüklerin Efendisi ─────────────────────────────────────────────────────
const FELL_BODY =
  "M14 62 C24 56 40 52 56 52 L72 46 C80 42 86 40 92 42 L94 46 C88 46 82 48 76 52 C66 58 52 60 38 60 C30 60 22 62 12 68 Z";
function Fell({ wings }) {
  return (
    <>
      {wings.map((d, i) => (
        <Path key={d} path={d} color={i ? WHITE : SHADE} />
      ))}
      <Path path={FELL_BODY} color={WHITE} />
      <Path path="M44 59 L40 68 M52 58 L52 67" style="stroke" strokeWidth={2.4} strokeCap="round" color={WHITE} />
    </>
  );
}
const FELL_UP = [
  "M50 52 C54 30 64 14 80 6 C74 20 72 30 74 40 C66 38 58 44 56 52 Z",
  "M34 56 C30 34 20 16 6 8 C14 22 16 32 14 42 C22 38 30 44 40 54 Z",
];
const FELL_DOWN = [
  "M52 56 C58 72 68 84 82 92 C76 80 74 70 74 62 C66 64 60 60 58 54 Z",
  "M36 58 C32 74 22 86 8 94 C16 82 18 72 16 64 C24 66 32 62 40 56 Z",
];

function OneRing() {
  return (
    <>
      <Oval x={16} y={33} width={68} height={34} style="stroke" strokeWidth={10} color="#9a6f14" />
      <Oval x={16} y={32} width={68} height={34} style="stroke" strokeWidth={8}>
        <LinearGradient start={vec(50, 26)} end={vec(50, 72)} colors={["#fff2b0", "#e8b53a", "#a67812"]} />
      </Oval>
      <Path path="M28 40 L33 38 M38 35.5 L44 34.6 M56 34.6 L62 35.5 M67 38 L72 40" style="stroke" strokeWidth={1.2} strokeCap="round" color="rgba(255,122,26,0.75)" />
      <Path path="M26 38 C34 31 46 29.5 56 30" style="stroke" strokeWidth={1.8} strokeCap="round" color="rgba(255,255,240,0.9)" />
    </>
  );
}

// ── Dune ────────────────────────────────────────────────────────────────────
function WormHead() {
  // gidiş yönü sağ: sağda yuvarlak ağız, ışınsal dişler
  const teeth = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const cx = 80;
    const cy = 50;
    const x1 = cx + Math.cos(a) * 8;
    const y1 = cy + Math.sin(a) * 26;
    const x0 = cx + Math.cos(a) * 3;
    const y0 = cy + Math.sin(a) * 12;
    return `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x0.toFixed(1)} ${y0.toFixed(1)}`;
  }).join(" ");
  return (
    <>
      <Path path="M8 50 C8 26 26 12 50 12 C64 12 74 18 80 22 L80 78 C74 82 64 88 50 88 C26 88 8 74 8 50 Z">
        <LinearGradient start={vec(50, 12)} end={vec(50, 88)} colors={[WHITE, "#d4d4d4", "#a8a8a8"]} />
      </Path>
      <Path path="M24 18 C18 36 18 64 24 82 M40 13 C34 34 34 66 40 87 M58 13 C53 34 53 66 58 87" style="stroke" strokeWidth={2} color={VEIN} />
      <Oval x={70} y={20} width={22} height={60} color={DARK} />
      <Oval x={73} y={26} width={14} height={48} color="#3e3e3e" />
      <Path path={teeth} style="stroke" strokeWidth={1.8} strokeCap="round" color={WHITE} />
    </>
  );
}

function WormSeg() {
  return (
    <>
      <Circle cx={50} cy={50} r={42}>
        <LinearGradient start={vec(50, 8)} end={vec(50, 92)} colors={[WHITE, "#d0d0d0", "#a4a4a4"]} />
      </Circle>
      <Path path="M30 13 C22 34 22 66 30 87 M50 8 C44 32 44 68 50 92 M70 13 C64 34 64 66 70 87" style="stroke" strokeWidth={2.2} color={VEIN} />
    </>
  );
}

function Thopter({ wings }) {
  return (
    <>
      <Path path={wings} color={SHADE} />
      <Path path={wings} style="stroke" strokeWidth={0.8} color={VEIN} />
      <Path path="M14 52 L28 48 L70 47 C80 47 88 50 88 53 C88 56 80 58 70 58 L28 57 Z" color={WHITE} />
      <Path path="M70 48.5 C78 48.5 84 50.5 85 53 L70 53 Z" color={DARK} />
      <Path path="M14 52 L6 46 L8 56 Z" color={SHADE} />
      <Path path="M36 58 L32 66 M60 58 L64 66" style="stroke" strokeWidth={1.6} strokeCap="round" color={VEIN} />
    </>
  );
}
const THOPTER_UP = "M36 48 L8 20 L12 18 L42 46 Z M52 47 L78 16 L82 18 L58 47 Z";
const THOPTER_FLAT = "M36 48 L2 45 L2 42 L40 45 Z M54 47 L98 42 L98 45 L58 48 Z";

// ── Batman ──────────────────────────────────────────────────────────────────
function Caped({ cape }) {
  return (
    <>
      <Path path={cape} color={SHADE} />
      <Path path="M42 30 C38 46 40 66 44 86 L56 86 C60 66 62 46 58 30 Z" color={WHITE} />
      <Path path="M44 24 L44.6 9 L48.4 16 L51.6 16 L55.4 9 L56 24 C56 30 44 30 44 24 Z" color={WHITE} />
    </>
  );
}
const CAPE_A = "M42 28 C30 34 24 58 16 92 L50 86 L84 92 C76 62 70 34 58 28 Z";
const CAPE_B = "M42 28 C26 36 14 58 4 86 C18 84 30 90 50 86 C70 90 82 82 96 88 C86 60 74 36 58 28 Z";

// ── Spider-Man ──────────────────────────────────────────────────────────────
// Köşe ağı: köşe hücrenin sol üstünde; kollar ve sarkık halkalar kutunun içinde.
const WEB = (() => {
  const angles = [0, 0.3, 0.62, 0.95, 1.27, Math.PI / 2];
  const reach = (a) => Math.min(97 / Math.max(Math.cos(a), 1e-3), 97 / Math.max(Math.sin(a), 1e-3), 132);
  let d = "";
  for (const a of angles) d += `M0 0 L${(Math.cos(a) * reach(a)).toFixed(1)} ${(Math.sin(a) * reach(a)).toFixed(1)} `;
  for (const r of [18, 34, 50, 66, 82]) {
    angles.forEach((a, i) => {
      const x = Math.cos(a) * Math.min(r, reach(a));
      const y = Math.sin(a) * Math.min(r, reach(a));
      if (i === 0) d += `M${x.toFixed(1)} ${y.toFixed(1)} `;
      else {
        const pa = angles[i - 1];
        const mid = (a + pa) / 2;
        const sag = r * 0.86;
        d += `Q${(Math.cos(mid) * sag).toFixed(1)} ${(Math.sin(mid) * sag).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)} `;
      }
    });
  }
  return d.trim();
})();

// Ağ sallanan kahraman (renkli; kırmızı-mavi kostüm, ağ desenli maske, beyaz göz camları).
// Üstte kaldırılmış el ağı tutar (50, 5); gövde hafif kıvrık, bacaklar geride.
function Swinger() {
  return (
    <>
      {/* geriye uzanan bacaklar: kırmızı üst, mavi alt, bot */}
      <Path path="M45 64 L34 78 L38 90" style="stroke" strokeWidth={7} strokeCap="round" strokeJoin="round" color="#d6282f" />
      <Path path="M34 78 L38 90" style="stroke" strokeWidth={7} strokeCap="round" color="#1f4a9c" />
      <Path path="M54 63 L64 75 L58 90" style="stroke" strokeWidth={7} strokeCap="round" strokeJoin="round" color="#d6282f" />
      <Path path="M64 75 L58 90" style="stroke" strokeWidth={7} strokeCap="round" color="#1f4a9c" />
      <Path path="M36 90 L42 93 M56 90 L62 93" style="stroke" strokeWidth={4} strokeCap="round" color="#d6282f" />
      {/* gövde: kırmızı üst, mavi yanlar */}
      <Path path="M37 36 C33 48 36 60 43 68 L56 66 C60 54 59 44 54 36 Z">
        <LinearGradient start={vec(36, 36)} end={vec(58, 68)} colors={["#e33a40", "#b81d24"]} />
      </Path>
      <Path path="M37 36 C33 48 36 60 43 68 L46 66 C41 58 39 48 42 38 Z M54 36 C59 44 60 54 56 66 L53 65 C56 55 55 46 51 38 Z" color="#1f4a9c" />
      <Path path="M44 40 L48 64 M50 40 L52 62 M40 47 L56 47 M41 55 L57 55" style="stroke" strokeWidth={0.7} color="rgba(60,10,14,0.55)" />
      {/* öne uzanan serbest kol */}
      <Path path="M54 41 L66 49 L75 44" style="stroke" strokeWidth={5.4} strokeCap="round" strokeJoin="round" color="#d6282f" />
      <Circle cx={76} cy={43.4} r={3} color="#d6282f" />
      {/* ağı tutan yukarı kol */}
      <Path path="M47 38 L49 20 L50 8" style="stroke" strokeWidth={5.4} strokeCap="round" strokeJoin="round" color="#d6282f" />
      <Circle cx={50} cy={6.4} r={3.2} color="#d6282f" />
      {/* baş ve maske */}
      <Circle cx={46} cy={29} r={9} color="#d6282f" />
      <Path path="M46 20 L46 38 M38 29 L54 29 M40 23 C44 26 48 26 52 23 M39 34 C43 31 49 31 53 34" style="stroke" strokeWidth={0.7} color="rgba(60,10,14,0.65)" />
      <Path path="M39.5 27 C41 24.4 45 25 46.6 28 C44 30.6 41 30.6 39.5 27 Z" color="#ffffff" />
      <Path path="M47.4 28 C49 25 53 24.6 54.4 27 C53 30.6 50 30.6 47.4 28 Z" color="#ffffff" />
      <Path path="M39.5 27 C41 24.4 45 25 46.6 28 C44 30.6 41 30.6 39.5 27 Z M47.4 28 C49 25 53 24.6 54.4 27 C53 30.6 50 30.6 47.4 28 Z" style="stroke" strokeWidth={0.8} color="#2a0c10" />
    </>
  );
}

// ── Breaking Bad ────────────────────────────────────────────────────────────
function Rv() {
  // dikdörtgen y 18–82: karavan sağa dönük
  return (
    <>
      <Rect x={30} y={18} width={6} height={12} color="#6b6b6b" />
      <Path path="M6 32 L72 32 C78 32 82 36 86 44 L92 56 L92 70 L6 70 Z" color="#efe8d6" />
      <Rect x={6} y={52} width={86} height={6} color="#a0522d" />
      <Rect x={6} y={60} width={86} height={2} color="#c98a5a" />
      <Path path="M74 38 L83 38 L88 50 L74 50 Z" color="#6a8fa8" />
      <Rect x={14} y={38} width={16} height={9} color="#7f9db2" />
      <Rect x={40} y={38} width={20} height={9} color="#7f9db2" />
      <Rect x={62} y={40} width={8} height={24} color="#d8cfb8" />
      <Circle cx={24} cy={72} r={8} color="#26282c" />
      <Circle cx={74} cy={72} r={8} color="#26282c" />
      <Circle cx={24} cy={72} r={3.4} color="#9aa0a8" />
      <Circle cx={74} cy={72} r={3.4} color="#9aa0a8" />
    </>
  );
}

const SYM_B = "M28 30 L28 70 M28 30 L41 30 C51 30 51 48 41 48 L28 48 M41 48 C53 48 53 70 41 70 L28 70";
function ElementTile({ sym }) {
  return (
    <>
      <RoundedRect x={8} y={8} width={84} height={84} r={3}>
        <LinearGradient start={vec(8, 8)} end={vec(92, 92)} colors={["#4fae5a", "#2a7d36", "#1c5e27"]} />
      </RoundedRect>
      <RoundedRect x={8} y={8} width={84} height={84} r={3} style="stroke" strokeWidth={2.2} color="#8fe09c" />
      <Path path="M16 18 L26 18 M16 22 L22 22" style="stroke" strokeWidth={1.6} strokeCap="round" color="rgba(255,255,255,0.75)" />
      <Path path={`${SYM_B} ${sym}`} style="stroke" strokeWidth={5} strokeCap="round" strokeJoin="round" color={WHITE} />
    </>
  );
}
const SYM_R = "M60 52 L60 70 M60 58 C62 52 68 50 75 52";
const SYM_A = "M75 58 C71 51 60 51 60 61 C60 71 71 71 75 64 M75 53 L75 70";

function Hat() {
  return (
    <>
      <Oval x={8} y={56} width={84} height={16} color={SHADE} />
      <Path path="M26 63 L28 38 C28 33 72 33 72 38 L74 63 Z" color={WHITE} />
      <Rect x={26.8} y={52} width={46.4} height={6} color={VEIN} />
      <Oval x={28} y={32} width={44} height={9} color={SHADE} />
    </>
  );
}

function Flask() {
  return (
    <>
      <Path path="M44 46 L28 80 C26 86 30 90 36 90 L64 90 C70 90 74 86 72 80 L56 46 Z" color={fade(0.55)} />
      <Path path="M44 14 L44 36 L20 86 C18 90 22 92 26 92 L74 92 C78 92 82 90 80 86 L56 36 L56 14" style="stroke" strokeWidth={3} strokeJoin="round" color={WHITE} />
      <Path path="M40 14 L60 14" style="stroke" strokeWidth={3.4} strokeCap="round" color={WHITE} />
      <Circle cx={44} cy={74} r={2.6} color={WHITE} />
      <Circle cx={56} cy={66} r={2} color={WHITE} />
      <Circle cx={50} cy={80} r={1.6} color={WHITE} />
    </>
  );
}

// ── Game of Thrones ─────────────────────────────────────────────────────────
// Buz ejderhası, yandan, burun sağda ve hafif aşağı (ağız ~(90,52): ateş
// emitter'ı ox D*0.4, oy 8 ile buradan çıkar). İki kare: kanat yukarı / aşağı.
// Katman sırası: uzak kanat → arka bacak/kuyruk ucu → dikenler/boynuz → ağız
// içi (parlayan) → gövde → karın/gırtlak plakaları → ayrıntı → yakın kanat.
const DRG_BODY = "M60 45 C63 41 66 36 70 33 C72.5 31.4 75.5 31 78 31.6 C80.6 32.2 82.6 33.8 84.4 35.8 L95 45.4 C96 46.6 95.4 48.2 93.8 48.2 L84.6 44.6 " +
  "L91.4 53.4 C91.6 55 90 56 88.6 55.4 C85 53.6 81 51 78.4 48.8 C76 47.2 73 47 70.6 48.6 " +
  "C67.6 53 62.6 58.6 55 60.6 C48 62.4 40 62.2 34 60.4 C27 58.8 20 58.6 14.4 61.4 C11 63.2 9.8 66 10.8 68.6 " +
  "C9 66.8 8.4 63.6 10 60.6 C13 55.6 20 52.6 28 51.6 C35 50.8 41 47.4 47 45.8 C51 44.8 56 45.4 60 45 Z";
const DRG_BELLY = "M70.6 48.6 C67.6 53 62.6 58.6 55 60.6 C48 62.4 40 62.2 34 60.4 C40 59.4 48 58.8 55 56.6 C61.6 54.4 66.6 51.4 70.6 48.6 Z";
const DRG_THROAT = "M88.6 55.4 C85 53.6 81 51 78.4 48.8 C76 47.2 73 47 70.6 48.6 C73 48.4 75.4 49.4 77.6 51.2 C81 53.8 84.6 55.2 88.6 55.4 Z";
const DRG_BELLY_LINES = "M63 54.6 L64.4 57.2 M57.4 57.2 L58.4 60 M51.8 58.8 L52.4 61.6 M46 59.6 L46.4 62.2 M40.6 59.8 L40.6 62.2 M74.4 48.6 L73.6 50.6 M78.6 50.6 L77.4 52.8 M82.6 52.8 L81.6 54.6";
const DRG_RIM = "M10 60.6 C13 55.6 20 52.6 28 51.6 C35 50.8 41 47.4 47 45.8 C51 44.8 56 45.4 60 45 C63 41 66 36 70 33 C72.5 31.4 75.5 31 78 31.6 C80.6 32.2 82.6 33.8 84.4 35.8 L95 45.4";
const DRG_SPINES = "M18 54.4 L19.4 50.6 L21.6 53.4 Z M25 52.2 L27 48.2 L29 51.6 Z M32 50.8 L34.4 46.2 L36 49.8 Z M39 48.6 L41.6 43.8 L43 47.4 Z " +
  "M46 46 L48.6 41.4 L50 45.2 Z M53 45.2 L55.6 40.6 L57 44.8 Z M61.4 43.4 L62.4 38.4 L64.4 40.8 Z M65.8 37.6 L66.8 32.6 L68.8 35 Z";
const DRG_HORNS = "M78.6 32.4 C74 28.4 69 26.6 62 27 C67.6 28.4 72 30.8 75.6 34.4 Z " +
  "M81.4 33.4 C79.6 28.6 76.6 25.4 71.6 23.2 C75 26.8 77.4 30.2 78.6 34.6 Z";
const DRG_FRILL = "M80.6 50.2 L75 53.6 L78.6 48.8 Z M84.2 52.4 L80 57 L82.6 51.6 Z";
const DRG_TEETH = "M86.8 45.46 L86.71 47.6 L87.92 45.9 Z M88.64 46.18 L88.55 48.1 L89.76 46.62 Z M90.48 46.9 L90.3 49.4 L91.6 47.34 Z M92.14 47.58 L92.05 49.2 L93.26 48.02 Z " +
  "M87.32 48.13 L88.7 47.9 L88 48.99 Z M88.68 49.89 L90.1 49.6 L89.36 50.75 Z M90.04 51.65 L91.3 51.4 L90.72 52.51 Z";
const DRG_MOUTH = "M84.6 44.6 L93.8 48.2 L91.4 53.4 Z";
const DRG_HIND =
  "M33 56 C30 60 30.6 64.6 34.4 66.6 C36 68 35.4 70 33.4 71 L29.6 72.2 L33.6 72.6 L31.2 75.4 L35.4 73.4 L35.6 76.2 L37.6 71.6 " +
  "C39.4 68.6 39 65.6 37.4 63.4 C39.4 61.6 40.6 59.6 40.4 57.4 Z";
const DRG_FORE =
  "M62 54.6 C60.4 58.4 61 61.6 63.6 63.4 L61.4 66 L64.4 65.2 L63.6 68.4 L66 65.2 L67.6 67.4 L67.2 63.4 C65.6 61.4 65.6 58.6 67 55.6 Z";
const DRG_SPADE = "M11.2 67.6 L4 70.4 L8.6 71.6 L6.6 77 L13 70 Z";
const DRG_EYE = [83.2, 38.8];
const DRG_BROW = "M79.6 37 C81.6 35.8 84 36 86.4 37.6";
const DRG_SCALES = "M38 54.6 q1.6 1.2 3.2 0 M44 53.4 q1.6 1.2 3.2 0 M50 52.6 q1.6 1.2 3.2 0 M41 57.4 q1.6 1.2 3.2 0 M47 56.6 q1.6 1.2 3.2 0 M24 56.4 q1.4 1 2.8 0 M30 55.6 q1.4 1 2.8 0 M64 46.4 q1.4 1 2.8 0 M67 41.6 q1.4 1 2.8 0";

function Dragon({ far, near }) {
  return (
    <>
      <Path path={far.skin} color="#1c2f50" />
      <Path path={far.skin} style="stroke" strokeWidth={0.7} strokeJoin="round" color="#3a5a88" />
      <Path path={far.bones} style="stroke" strokeWidth={1.1} strokeCap="round" color="#35557f" />
      <Path path={DRG_HIND} color="#1a2a46" />
      <Path path={DRG_SPADE} color="#22375a" />
      <Path path={DRG_SPINES} color="#9dbfe4" />
      <Path path={DRG_HORNS} color="#c9dcef" />
      <Path path={DRG_MOUTH}>
        <RadialGradient c={vec(91, 49.6)} r={6} colors={["#bff4ff", "#3fa6e8", "#0a1830"]} positions={[0, 0.45, 1]} />
      </Path>
      <Path path={DRG_BODY}>
        <LinearGradient start={vec(0, 30)} end={vec(0, 64)} colors={["#6d8db8", "#34507a", "#14223a"]} positions={[0, 0.45, 1]} />
      </Path>
      <Path path={`${DRG_BELLY} ${DRG_THROAT}`}>
        <LinearGradient start={vec(0, 48)} end={vec(0, 62)} colors={["#a9c6e6", "#5f7fa8"]} />
      </Path>
      <Path path={DRG_BELLY_LINES} style="stroke" strokeWidth={0.8} strokeCap="round" color="#46658f" />
      <Path path={DRG_RIM} style="stroke" strokeWidth={1} strokeCap="round" color="rgba(188,216,244,0.7)" />
      <Path path={DRG_SCALES} style="stroke" strokeWidth={0.6} strokeCap="round" color="rgba(134,168,210,0.3)" />
      <Path path={DRG_TEETH} color="#eef6ff" />
      <Path path={DRG_BROW} style="stroke" strokeWidth={1.1} strokeCap="round" color="#d6e8fa" />
      <Circle cx={93.2} cy={46.2} r={0.7} color="#0c1628" />
      <Path path={DRG_FRILL} color="#7f9fc8" />
      <Path path={DRG_FORE} color="#22375a" />
      <Circle cx={DRG_EYE[0]} cy={DRG_EYE[1]} r={5}>
        <RadialGradient c={vec(DRG_EYE[0], DRG_EYE[1])} r={5} colors={["rgba(159,246,255,0.9)", "rgba(91,224,255,0)"]} />
      </Circle>
      <Circle cx={DRG_EYE[0]} cy={DRG_EYE[1]} r={1.5} color="#d8fbff" />
      <Path path={near.skin}>
        <RadialGradient c={vec(near.glow[0], near.glow[1])} r={34} colors={["#4f75a8", "#26406a", "#101d36"]} positions={[0, 0.6, 1]} />
      </Path>
      <Path path={near.fingers} style="stroke" strokeWidth={1.3} strokeCap="round" color="#7aa3d4" />
      <Path path={near.arm} style="stroke" strokeWidth={2.6} strokeCap="round" strokeJoin="round" color="#93b8e2" />
      <Path path={near.skin} style="stroke" strokeWidth={0.8} strokeJoin="round" color="rgba(111,162,216,0.8)" />
      <Path path={near.claw} color="#d8e8f8" />
    </>
  );
}
const DRAGON_OPEN = {
  far: {
    skin: "M60 46 C61.6 36 64 26 68.6 16.6 C75 13 81 10.6 89 8.6 Q84 15.4 84.4 21.6 Q78.4 26 76 33.6 Q72.4 38.6 66 47 Z",
    bones: "M60 46 L68.6 16.6 M68.6 16.6 L89 8.6 M68.6 16.6 L84.4 21.6 M68.6 16.6 L76 33.6",
  },
  near: {
    skin:
      "M55 47 C50.6 41 47.4 35.6 46.4 30 C49.6 22.4 53.6 14.6 58.6 8.6 C46 5 30 3.4 13.6 4.4 Q21.6 13.4 15.4 21.8 " +
      "Q25.6 26.4 25.4 35.6 Q32 40.6 37.4 50.4 C43.6 48.6 49.6 47.4 55 47 Z",
    arm: "M55 47 C50.6 41 47.4 35.6 46.4 30 C49.6 22.4 53.6 14.6 58.6 8.6",
    fingers: "M58.6 8.6 C46 5 30 3.4 13.6 4.4 M58.6 8.6 C44 12 28 17 15.4 21.8 M58.6 8.6 C48 18 36 27 25.4 35.6",
    claw: "M58.6 8.6 L61.6 5 L60 9.4 Z",
    glow: [40, 18],
  },
};
const DRAGON_CLOSED = {
  far: {
    skin: "M62 53 C63.6 62 65.6 71 68 79 C74 84.6 80 87.4 88 90 Q82.4 83.6 82.6 77.4 Q76.6 73.4 74.6 66.6 Q70.6 60.6 67 53.6 Z",
    bones: "M62 53 L68 79 M68 79 L88 90 M68 79 L82.6 77.4 M68 79 L74.6 66.6",
  },
  near: {
    skin:
      "M55.6 48 C50.6 52.6 46.6 57.6 44.6 62.4 C46.6 70.6 50 78.6 54.6 86.6 C42 91 28 94 13 95 Q19.6 87.4 17 80.4 " +
      "Q25.6 77 25.4 68.6 Q31 63 34.6 58.6 C41.6 54.6 48.6 50.6 55.6 48 Z",
    arm: "M55.6 48 C50.6 52.6 46.6 57.6 44.6 62.4 C46.6 70.6 50 78.6 54.6 86.6",
    fingers: "M54.6 86.6 C42 91 28 94 13 95 M54.6 86.6 C42 85 28 82.6 17 80.4 M54.6 86.6 C46 80 34 74 25.4 68.6",
    claw: "M54.6 86.6 L58.4 89 L54 89.6 Z",
    glow: [38, 76],
  },
};

const RAVEN_BODY = "M30 53 C40 47 56 47 66 49 L76 46 L85 48.5 L76 51 C70 56 56 58 44 57 C38 57 32 58 22 63 L17 60 Z";
function Raven({ wings }) {
  return (
    <>
      {wings.map((d, i) => (
        <Path key={d} path={d} color={i ? WHITE : SHADE} />
      ))}
      <Path path={RAVEN_BODY} color={WHITE} />
      <Path path="M76 46 L85 48.5 L76 51 Z" color={SHADE} />
    </>
  );
}
const RAVEN_UP = ["M50 50 C52 33 60 21 74 14 C68 28 62 40 57 52 Z", "M42 51 C36 35 24 23 10 19 C18 29 24 39 37 55 Z"];
const RAVEN_DOWN = ["M51 55 C56 69 64 79 76 86 C70 74 64 64 58 54 Z", "M42 55 C36 69 26 79 12 84 C20 74 26 66 36 54 Z"];

// ── Vikingler ───────────────────────────────────────────────────────────────
// Eski Futhark runları (kamu malı): Fehu, Algiz, Othala
const RUNES = [
  "M42 14 L42 86 M42 32 L64 18 M42 50 L66 34",
  "M50 86 L50 14 M50 46 L30 22 M50 46 L70 22",
  "M50 12 L72 36 L50 60 L28 36 Z M36 52 L22 88 M64 52 L78 88",
];
function Rune({ d }) {
  return (
    <>
      <Path path={d} style="stroke" strokeWidth={14} strokeCap="round" strokeJoin="round" color={fade(0.22)} />
      <Path path={d} style="stroke" strokeWidth={6} strokeCap="round" strokeJoin="round" color={WHITE} />
    </>
  );
}

// ── Prison Break / Sherlock / Sopranos ──────────────────────────────────────
function Crane() {
  return (
    <>
      <Path path="M34 60 L12 40 L16 40 L40 58 Z" color={WHITE} />
      <Path path="M52 56 L66 26 L62 56 Z" color={SHADE} />
      <Path path="M30 60 L50 52 L70 60 L50 66 Z" color={SHADE} />
      <Path path="M44 56 L36 18 L58 56 Z" color={WHITE} />
      <Path path="M66 58 L84 34 L86 36 L72 60 Z" color={WHITE} />
      <Path path="M84 34 L92 36 L86 38 Z" color={VEIN} />
      <Path path="M36 18 L50 56" style="stroke" strokeWidth={0.9} color={VEIN} />
    </>
  );
}

function Footprint() {
  return (
    <>
      <Path path="M50 34 C60 34 63 44 62 56 C61 66 58 74 50 74 C42 74 39 66 38 56 C37 44 40 34 50 34 Z" color={WHITE} />
      <Oval x={41} y={77} width={18} height={15} color={WHITE} />
    </>
  );
}

function Magnifier() {
  return (
    <>
      <Path path="M58 58 L86 86" style="stroke" strokeWidth={10} strokeCap="round" color="#5a3a20" />
      <Path path="M58 58 L64 64" style="stroke" strokeWidth={11} strokeCap="butt" color="#c9a046" />
      <Circle cx={40} cy={40} r={26} color="rgba(191,227,255,0.35)" />
      <Path path="M24 32 C27 24 34 19 42 18" style="stroke" strokeWidth={3} strokeCap="round" color="rgba(255,255,255,0.9)" />
      <Circle cx={40} cy={40} r={26} style="stroke" strokeWidth={6} color="#c9a046" />
      <Circle cx={40} cy={40} r={28.6} style="stroke" strokeWidth={1} color="#8a6a24" />
    </>
  );
}

// Yeşilbaş ördek, sağa dönük. Yüzerken gövde suda; uçarken kanatlar.
function DuckHead({ x = 76, y = 34 }) {
  return (
    <>
      <Circle cx={x} cy={y} r={8} color="#1f7a4a" />
      <Path path={`M${x + 6} ${y + 1} L${x + 16} ${y + 3} L${x + 6} ${y + 6} Z`} color="#e8b02a" />
      <Circle cx={x + 2.4} cy={y - 1.6} r={1.3} color="#111111" />
    </>
  );
}
function DuckSwim() {
  return (
    <>
      <Path path="M18 58 C18 48 34 44 50 46 C58 47 62 44 64 40 L68 38 C70 44 74 50 74 58 C74 68 60 72 44 72 C30 72 18 68 18 58 Z" color="#9a8a76" />
      <Path path="M18 58 C12 54 12 48 16 46 C18 50 20 53 22 54 Z" color="#2a2a2a" />
      <Path path="M30 54 C40 50 54 52 62 58 C54 62 40 62 30 58 Z" color="#7a6a58" />
      <Rect x={48} y={55} width={8} height={4} color="#2b5fb3" />
      <Path path="M64 40 C66 46 70 50 74 52 L72 44 Z" color="#7a4a34" />
      <Path path="M66 42 C68 40 72 40 74 41" style="stroke" strokeWidth={2} color={WHITE} />
      <DuckHead />
    </>
  );
}
function DuckFly({ up }) {
  const wing = up
    ? "M40 50 C34 30 26 18 12 12 C26 16 42 26 54 48 Z"
    : "M40 56 C34 70 24 82 10 88 C24 84 42 74 54 56 Z";
  const far = up ? "M50 48 C54 32 62 22 74 16 C68 30 62 40 58 50 Z" : "M52 56 C58 68 66 76 78 82 C70 72 64 64 60 56 Z";
  return (
    <>
      <Path path={far} color="#7a6a58" />
      <Path path="M14 52 C22 46 40 44 58 46 C64 44 68 42 70 40 L72 44 C72 50 64 56 54 58 C40 60 26 58 14 56 Z" color="#9a8a76" />
      <Path path="M14 52 L6 48 L8 56 Z" color="#2a2a2a" />
      <Path path={wing} color="#8a7a66" />
      <Path path={up ? "M38 40 L46 44 L44 48 L36 44 Z" : "M38 64 L46 60 L44 56 L36 60 Z"} color="#2b5fb3" />
      <Path path="M70 41 C72 39 75 39 77 40" style="stroke" strokeWidth={2} color={WHITE} />
      <DuckHead x={78} y={36} />
    </>
  );
}

// ── Death Note ──────────────────────────────────────────────────────────────
function Feather() {
  return (
    <>
      <Path path="M50 8 C62 20 64 50 56 80 L50 92 L44 80 C36 50 38 20 50 8 Z" color={WHITE} />
      <Path path="M50 8 C44 20 42 50 46 80 L50 92 L44 80 C36 50 38 20 50 8 Z" color={SHADE} />
      <Path path="M56 30 L60 34 M58 46 L62 50 M44 38 L40 42 M45 56 L40 60 M56 62 L60 66" style="stroke" strokeWidth={1.4} color={VEIN} />
      <Path path="M50 6 L50 96" style="stroke" strokeWidth={1.6} strokeCap="round" color={VEIN} />
    </>
  );
}

const APPLE = "M50 30 C40 22 20 24 18 46 C16 68 32 90 50 84 C68 90 84 68 82 46 C80 24 60 22 50 30 Z";
const APPLE_PATH = Skia.Path.MakeFromSVGString(APPLE);
const BITE = (() => {
  const p = Skia.Path.Make();
  p.addCircle(86, 46, 11);
  p.addCircle(87, 63, 10);
  return p;
})();
function AppleBody() {
  return (
    <>
      <Path path={APPLE}>
        <RadialGradient c={vec(38, 42)} r={50} colors={["#ff6b6b", "#d62828", "#8a0f1a"]} positions={[0, 0.55, 1]} />
      </Path>
      <Path path="M30 42 C32 36 36 32 42 31" style="stroke" strokeWidth={3.4} strokeCap="round" color="rgba(255,255,255,0.75)" />
    </>
  );
}
function AppleTop() {
  return (
    <>
      <Path path="M50 30 C50 22 52 16 56 12" style="stroke" strokeWidth={3} strokeCap="round" color="#5a3a1e" />
      <Path path="M53 20 C60 12 70 14 72 18 C64 22 58 22 53 20 Z" color="#3f9a3a" />
    </>
  );
}
function AppleBitten() {
  return (
    <>
      <Group clip={BITE} invertClip>
        <AppleBody />
      </Group>
      {APPLE_PATH ? (
        <Group clip={APPLE_PATH}>
          <Path path={BITE} style="stroke" strokeWidth={5} color="#fff1d6" />
        </Group>
      ) : null}
      <AppleTop />
    </>
  );
}

function Page() {
  return (
    <>
      <Path path="M20 10 L70 10 L80 20 L80 90 L20 90 Z" color={WHITE} />
      <Path path="M70 10 L70 20 L80 20 Z" color={SHADE} />
      <Path path="M26 28 L74 28 M26 38 L74 38 M26 48 L74 48 M26 58 L74 58 M26 68 L74 68 M26 78 L60 78" style="stroke" strokeWidth={1.2} color={SHADE} />
      <Path path="M30 14 L30 86" style="stroke" strokeWidth={1} color={VEIN} />
      <Path path="M34 26 L58 26 M34 36 L66 36 M34 46 L52 46" style="stroke" strokeWidth={1.6} strokeCap="round" color={VEIN} />
    </>
  );
}

// ── Attack on Titan ─────────────────────────────────────────────────────────
function Titan() {
  return (
    <>
      <Path path="M0 100 L0 78 C10 66 28 60 40 60 L60 60 C72 60 90 66 100 78 L100 100 Z" color="#9a2e26" />
      <Path path="M8 92 C14 80 24 70 36 66 M18 98 C24 86 32 76 42 70 M92 92 C86 80 76 70 64 66 M82 98 C76 86 68 76 58 70" style="stroke" strokeWidth={1.6} color="#5e1712" />
      <Path path="M30 50 C26 30 30 8 50 4 C70 8 74 30 70 50 C66 58 60 62 50 62 C40 62 34 58 30 50 Z">
        <LinearGradient start={vec(50, 4)} end={vec(50, 62)} colors={["#c2443a", "#9a2e26", "#7a221c"]} />
      </Path>
      <Path path="M40 8 C36 20 36 34 38 46 M50 5 C48 18 48 30 49 40 M60 8 C64 20 64 34 62 46 M33 20 C31 30 32 40 34 48 M67 20 C69 30 68 40 66 48" style="stroke" strokeWidth={1.3} color="#5e1712" />
      <Path path="M34 26 C40 22 46 24 48 28 M52 28 C54 24 60 22 66 26" style="stroke" strokeWidth={2.6} strokeCap="round" color="#5e1712" />
      <Oval x={37} y={28} width={9} height={6} color="#2a0e0c" />
      <Oval x={54} y={28} width={9} height={6} color="#2a0e0c" />
      <Circle cx={41.5} cy={31} r={1.3} color="#e8d66a" />
      <Circle cx={58.5} cy={31} r={1.3} color="#e8d66a" />
      <Path path="M36 46 L64 46 L62 56 L38 56 Z" color="#ead9c0" />
      <Path path="M40 46 L40 56 M44 46 L44 56 M48 46 L48 56 M52 46 L52 56 M56 46 L56 56 M60 46 L60 56 M37 51 L63 51" style="stroke" strokeWidth={0.9} color="#a8977c" />
    </>
  );
}

// Keşif birliği askeri (sağa dönük, ileri atılmış): yeşil pelerin, yeleğin üstünde 3 boyutlu
// manevra düzeneği (bel kutuları + gaz hortumları), iki ince kılıç, kemer ve botlar.
function Scout() {
  return (
    <>
      {/* pelerin: arkada dalgalanır */}
      <Path path="M56 34 C42 30 24 36 6 52 C20 50 30 56 40 62 C48 56 54 50 58 44 Z">
        <LinearGradient start={vec(6, 40)} end={vec(58, 50)} colors={["#2c5a30", "#4f8a48"]} />
      </Path>
      <Path path="M56 36 C44 38 32 44 22 52 M52 40 C42 44 34 50 28 56" style="stroke" strokeWidth={0.9} color="rgba(20,50,24,0.7)" />
      {/* bacaklar: beyaz pantolon, kahverengi botlar */}
      <Path path="M55 57 L45 72 L38 86 M61 58 L58 74 L64 88" style="stroke" strokeWidth={6} strokeCap="round" strokeJoin="round" color="#ece6d6" />
      <Path path="M45 72 L38 86 M58 74 L64 88" style="stroke" strokeWidth={6.4} strokeCap="round" color="#5a3a22" />
      <Path path="M36 88 L42 89 M63 90 L70 89" style="stroke" strokeWidth={4} strokeCap="round" color="#3a2414" />
      {/* gövde: kahverengi ceket, kemerler */}
      <Path path="M56 34 L72 37 L66 60 L53 58 Z">
        <LinearGradient start={vec(56, 34)} end={vec(66, 60)} colors={["#9a7450", "#6e4f33"]} />
      </Path>
      <Path path="M58 38 L66 57 M64 38 L58 58" style="stroke" strokeWidth={1.2} color="#3a2414" />
      <Rect x={51} y={55} width={18} height={4} color="#3a2414" />
      {/* manevra düzeneği: kutular, hortumlar, bıçak kabzaları */}
      <Rect x={47} y={50} width={9} height={8} color="#9aa2ab" />
      <Rect x={47} y={50} width={9} height={8} style="stroke" strokeWidth={0.9} color="#4a515b" />
      <Rect x={56} y={52} width={9} height={7} color="#868e98" />
      <Path path="M52 50 C48 42 44 38 40 36 M60 52 C60 44 56 40 52 38" style="stroke" strokeWidth={1.2} strokeCap="round" color="#5a616b" />
      <Path path="M50 56 L40 66 M58 58 L50 70" style="stroke" strokeWidth={2.4} strokeCap="round" color="#3a2414" />
      {/* kollar ve kılıçlar */}
      <Path path="M70 40 L84 48 M68 46 L81 56" style="stroke" strokeWidth={3.6} strokeCap="round" color="#8a6a4a" />
      <Circle cx={85} cy={48.6} r={2} color="#f0c9a0" />
      <Circle cx={82} cy={56.6} r={2} color="#f0c9a0" />
      <Path path="M85 48 L99 41 M82 56 L98 55" style="stroke" strokeWidth={1.7} strokeCap="round" color="#e4eaf0" />
      <Path path="M85 48 L99 41 M82 56 L98 55" style="stroke" strokeWidth={0.6} strokeCap="round" color="#ffffff" />
      {/* baş */}
      <Circle cx={70} cy={28} r={6.8} color="#f0c9a0" />
      <Path path="M63 27 C62 20 70 17 76 23 L74 26 C72 23 68 23 66 28 Z" color="#4a2e1a" />
      <Path path="M72 29 L75 29" style="stroke" strokeWidth={0.9} strokeCap="round" color="#3a2414" />
    </>
  );
}

// ── Naruto ──────────────────────────────────────────────────────────────────
function Shuriken() {
  return (
    <>
      <Path path="M50 6 L58 42 L94 50 L58 58 L50 94 L42 58 L6 50 L42 42 Z" color={WHITE} />
      <Path path="M50 6 L58 42 L50 50 Z M94 50 L58 58 L50 50 Z M50 94 L42 58 L50 50 Z M6 50 L42 42 L50 50 Z" color={SHADE} />
      <Circle cx={50} cy={50} r={6} color={DARK} />
    </>
  );
}

function Kunai() {
  // dikdörtgen y 38–62, uç sağda
  return (
    <>
      <Path path="M48 50 L60 42 L96 50 L60 58 Z" color={WHITE} />
      <Path path="M48 50 L60 42 L96 50 Z" color={SHADE} />
      <Rect x={20} y={46.6} width={28} height={6.8} color={SHADE} />
      <Path path="M24 46.6 L28 53.4 M30 46.6 L34 53.4 M36 46.6 L40 53.4 M42 46.6 L46 53.4" style="stroke" strokeWidth={1.2} color={VEIN} />
      <Circle cx={12} cy={50} r={6} style="stroke" strokeWidth={3} color={VEIN} />
    </>
  );
}

// ── One Piece ───────────────────────────────────────────────────────────────
function PirateShip() {
  const mane = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    return [90 + Math.cos(a) * 7.5, 50 + Math.sin(a) * 7.5];
  });
  return (
    <>
      <Rect x={49} y={10} width={2.4} height={52} color="#6b4220" />
      <Path path="M51 8 L64 11 L51 14 Z" color="#c0392b" />
      <Path path="M32 18 C40 16 62 16 68 18 C71 30 71 42 68 50 L32 50 C29 42 29 30 32 18 Z" color="#f6f3ea" />
      <Path path="M32 18 C30 30 30 42 32 50 L36 50 C34 42 34 30 36 18 Z" color="#dcd6c6" />
      <Path path="M8 62 C16 78 80 80 92 60 L86 58 L12 58 Z" color="#d9a441" />
      <Path path="M10 62 C24 72 76 72 90 61" style="stroke" strokeWidth={2.4} color="#8a5a24" />
      <Rect x={12} y={55} width={74} height={3} color="#7a4a26" />
      {[24, 38, 52, 66].map((x) => (
        <Circle key={x} cx={x} cy={66} r={2.2} color="#5a3a1e" />
      ))}
      {mane.map(([x, y]) => (
        <Circle key={`${x.toFixed(1)}-${y.toFixed(1)}`} cx={x} cy={y} r={3.4} color="#e07a1f" />
      ))}
      <Circle cx={90} cy={50} r={6} color="#f2c14e" />
      <Circle cx={92} cy={48.6} r={1} color="#3a2a1a" />
    </>
  );
}

function StrawHat() {
  return (
    <>
      <Oval x={6} y={50} width={88} height={22} color="#e9c46a" />
      <Oval x={6} y={50} width={88} height={22} style="stroke" strokeWidth={1.2} color="#b8902e" />
      <Path path="M14 61 C30 66 70 66 86 61 M18 56 C34 60 66 60 82 56" style="stroke" strokeWidth={0.9} color="#c9a24a" />
      <Path path="M28 58 C28 32 72 32 72 58 Z" color="#efcf7a" />
      <Path path="M36 40 C44 36 56 36 64 40 M32 48 C44 44 56 44 68 48" style="stroke" strokeWidth={0.9} color="#c9a24a" />
      <Path path="M28.6 50 L71.4 50 L72 58 L28 58 Z" color="#c62828" />
    </>
  );
}

function DevilFruit() {
  return (
    <>
      <Circle cx={50} cy={56} r={34}>
        <RadialGradient c={vec(40, 44)} r={46} colors={["#b06ad0", "#8e44ad", "#4a1a6a"]} positions={[0, 0.5, 1]} />
      </Circle>
      <Path path="M34 46 C34 38 44 38 44 44 C44 50 36 50 38 44 M58 40 C58 32 68 32 68 38 C68 44 60 44 62 38 M30 66 C30 58 40 58 40 64 C40 70 32 70 34 64 M52 62 C52 54 62 54 62 60 C62 66 54 66 56 60 M68 70 C68 64 76 64 76 68 C76 72 70 72 72 68 M46 80 C46 74 54 74 54 78" style="stroke" strokeWidth={2.2} strokeCap="round" color="#d7b2e8" />
      <Path path="M50 22 C50 14 56 10 62 12 C58 14 56 18 56 24" style="stroke" strokeWidth={3} strokeCap="round" color="#2f6b2a" />
      <Path path="M56 18 C62 10 72 12 74 16 C66 20 60 20 56 18 Z" color="#3f9a3a" />
    </>
  );
}

// ── Fullmetal Alchemist ─────────────────────────────────────────────────────
function PocketWatch() {
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const r0 = i % 3 ? 23 : 20;
    return `M${(50 + Math.cos(a) * r0).toFixed(1)} ${(58 + Math.sin(a) * r0).toFixed(1)} L${(50 + Math.cos(a) * 26).toFixed(1)} ${(58 + Math.sin(a) * 26).toFixed(1)}`;
  }).join(" ");
  return (
    <>
      <Circle cx={50} cy={10} r={6} style="stroke" strokeWidth={3} color="#c9ced6" />
      <RoundedRect x={45} y={15} width={10} height={9} r={2} color="#aeb5bf" />
      <Circle cx={50} cy={58} r={34}>
        <LinearGradient start={vec(26, 30)} end={vec(76, 90)} colors={["#f1f4f8", "#aab2bc", "#7d8590"]} />
      </Circle>
      <Circle cx={50} cy={58} r={34} style="stroke" strokeWidth={1.6} color="#5f6670" />
      <Circle cx={50} cy={58} r={28} color="#fbf6ea" />
      <Path path={ticks} style="stroke" strokeWidth={1.8} strokeCap="round" color="#3a3a3a" />
      <Path path="M50 58 L50 40 M50 58 L63 64" style="stroke" strokeWidth={2.4} strokeCap="round" color="#2a2a2a" />
      <Circle cx={50} cy={58} r={2.4} color="#2a2a2a" />
    </>
  );
}


// ── Harry Potter: süpürgeli oyuncu (sağa dönük) ─────────────────────────────
function BroomRider() {
  return (
    <>
      {/* süpürge: sap + kıçta saman demeti */}
      <Path path="M10 64 L90 49" style="stroke" strokeWidth={3} strokeCap="round" color="#7a4a24" />
      <Path path="M10 64 L90 49" style="stroke" strokeWidth={1} strokeCap="round" color="#b87a42" />
      <Path path="M3 58 C8 59 14 61 18 62.4 L18 66.6 C13 67.6 7 69.6 2 71 C5 67 5 62 3 58 Z" color="#caa34f" />
      <Path path="M5 60 L17 63.6 M4 64 L17 64.6 M4 68 L17 65.8" style="stroke" strokeWidth={0.8} color="#8a6a28" />
      <Rect x={17.4} y={62} width={3} height={5} color="#5a3a1c" />
      {/* pelerin: arkaya savrulur */}
      <Path path="M50 52 C44 42 33 38 14 44 C26 47 29 54 20 62 C32 61 43 62 52 60 Z">
        <LinearGradient start={vec(14, 44)} end={vec(52, 60)} colors={["#4a3f78", "#241d45"]} />
      </Path>
      <Path path="M46 52 C38 46 28 45 20 48" style="stroke" strokeWidth={1} color="rgba(150,130,220,0.55)" />
      {/* atkı: iki renk şeritli, arkada uçuşur */}
      <Path path="M57 41 C47 42 38 43 28 39 C22 38 20 40 16 42" style="stroke" strokeWidth={4} strokeCap="round" color="#b8342c" />
      <Path path="M52 41.5 L51.4 38.6 M45 42 L44.4 39.2 M38 41.6 L37.4 38.8 M31 39.6 L30.2 37" style="stroke" strokeWidth={1.4} color="#e0b84a" />
      {/* gövde ve bacaklar */}
      <Path path="M44 56 C44 46 50 40 58 40 C62 44 60 52 56 58 Z" color="#3a3158" />
      <Path path="M50 58 L60 66 L56 75 M44 58 L52 68 L49 77" style="stroke" strokeWidth={4.4} strokeCap="round" strokeJoin="round" color="#2c2840" />
      <Path path="M56 75 L61 76 M49 77 L54 78" style="stroke" strokeWidth={3} strokeCap="round" color="#121118" />
      {/* kollar sapı tutar */}
      <Path path="M58 44 L72 52 L77 50.6" style="stroke" strokeWidth={4} strokeCap="round" strokeJoin="round" color="#3a3158" />
      <Circle cx={78} cy={50.4} r={2.6} color="#f0c9a0" />
      {/* baş: kısa saç, gözlük */}
      <Circle cx={62} cy={32} r={8} color="#f0c9a0" />
      <Path path="M54 31 C53 23 60 20 66 22 C70 24 71 28 70 31 C66 26 60 26 54 31 Z" color="#2a1c14" />
      <Circle cx={65.4} cy={33} r={2.4} style="stroke" strokeWidth={0.9} color="#1f1a14" />
      <Circle cx={65.4} cy={33} r={0.9} color="#1f1a14" />
      <Path path="M64 38 C66 39 68 38.4 69 37" style="stroke" strokeWidth={0.8} strokeCap="round" color="#a8654a" />
    </>
  );
}

// ── Rick and Morty (sağa bakan profil) ──────────────────────────────────────
function Rick() {
  return (
    <>
      {/* bacaklar ve ayakkabılar */}
      <Path path="M44 74 L42 92 M56 74 L58 92" style="stroke" strokeWidth={7} strokeCap="butt" color="#7a6a58" />
      <Path path="M38 93 L48 93 L50 97 L38 97 Z M54 93 L64 93 L66 97 L54 97 Z" color="#e8e2d2" />
      {/* laboratuvar önlüğü */}
      <Path path="M36 36 C34 50 33 64 33 80 L68 80 C67 64 66 50 64 36 Z">
        <LinearGradient start={vec(34, 36)} end={vec(66, 80)} colors={["#fbfcfd", "#dfe5ea"]} />
      </Path>
      <Path path="M50 36 L50 80 M36 42 L46 54 M64 42 L54 54" style="stroke" strokeWidth={0.9} color="#b9c2cb" />
      <Path path="M44 36 L50 46 L56 36 Z" color="#8fd3e8" />
      {/* öne uzanan kol ve portal tabancası */}
      <Path path="M60 40 L72 52" style="stroke" strokeWidth={6} strokeCap="round" color="#f1f4f6" />
      <Circle cx={73} cy={53} r={3.2} color="#d8e0b8" />
      <Path path="M74 50 L90 46 L91 52 L76 57 Z" color="#c8ccd2" />
      <Path path="M74 50 L90 46" style="stroke" strokeWidth={1} color="#f4f6f8" />
      <Circle cx={92} cy={49} r={3.2} color="#7dff8a" />
      <Circle cx={92} cy={49} r={5.6} color="rgba(125,255,138,0.35)" />
      <Circle cx={80} cy={48} r={1.6} color="#2a6a30" />
      {/* baş: sivri açık mavi saç, kalın kaş, burun */}
      <Circle cx={49} cy={22} r={11} color="#f1d9b6" />
      <Path path="M37 22 L34 8 L41 14 L43 3 L49 12 L54 2 L57 12 L63 6 L61 17 C56 11 44 11 39 18 Z" color="#b9e0ea" />
      <Path path="M45 25 L60 24" style="stroke" strokeWidth={1.8} strokeCap="round" color="#4a4a42" />
      <Circle cx={57} cy={26.6} r={2.3} color="#ffffff" />
      <Circle cx={57.8} cy={26.8} r={0.9} color="#1f1f1f" />
      <Path path="M61 24 L66 28 L61 30" style="stroke" strokeWidth={1.3} strokeJoin="round" color="#d8b48a" />
      <Path path="M56 34 C58 35 61 34.6 62 33" style="stroke" strokeWidth={1.1} strokeCap="round" color="#8a5a40" />
    </>
  );
}

function Morty() {
  return (
    <>
      <Path path="M44 76 L43 91 M55 76 L56 91" style="stroke" strokeWidth={7} color="#3c5a99" />
      <Path path="M38 92 L48 92 L50 96 L38 96 Z M52 92 L62 92 L64 96 L52 96 Z" color="#f3f3f3" />
      {/* sarı tişört */}
      <Path path="M37 42 C35 54 35 66 36 78 L66 78 C67 66 67 54 65 42 Z">
        <LinearGradient start={vec(36, 42)} end={vec(66, 78)} colors={["#ffd84a", "#f0b81c"]} />
      </Path>
      <Path path="M44 42 C46 47 56 47 58 42" style="stroke" strokeWidth={1.2} color="#c99512" />
      <Path path="M59 46 L68 58" style="stroke" strokeWidth={5.6} strokeCap="round" color="#ffd84a" />
      <Circle cx={69} cy={59} r={3} color="#f3d2b0" />
      {/* kocaman kafa: kahverengi saç, iri gözler */}
      <Circle cx={51} cy={27} r={13} color="#f3d2b0" />
      <Path path="M38 26 C36 12 48 6 58 9 C66 11 68 20 64 26 C60 19 50 17 42 22 Z" color="#6b3f22" />
      <Circle cx={59} cy={29} r={3.4} color="#ffffff" />
      <Circle cx={60} cy={29.4} r={1.3} color="#1f1f1f" />
      <Path path="M55 24 L63 23" style="stroke" strokeWidth={1.1} strokeCap="round" color="#6b3f22" />
      <Path path="M63 29 L66 32 L63 33" style="stroke" strokeWidth={1.1} strokeJoin="round" color="#cfa27c" />
      <Path path="M57 38 C58.5 39 61 38.6 62 37" style="stroke" strokeWidth={1} strokeCap="round" color="#8a5a40" />
    </>
  );
}

// Rick'in uçan dairesi: cam kubbe, gümüş disk, alt ışıklar
function Saucer() {
  return (
    <>
      <Path path="M30 46 C32 28 68 28 70 46 Z">
        <LinearGradient start={vec(50, 28)} end={vec(50, 46)} colors={["rgba(190,255,200,0.95)", "rgba(110,214,150,0.8)"]} />
      </Path>
      <Path path="M36 44 C38 34 46 31 52 32" style="stroke" strokeWidth={1.4} strokeCap="round" color="rgba(255,255,255,0.8)" />
      <Path path="M6 52 C6 44 24 41 50 41 C76 41 94 44 94 52 C94 60 76 64 50 64 C24 64 6 60 6 52 Z">
        <LinearGradient start={vec(0, 41)} end={vec(0, 64)} colors={["#e6eaee", "#9aa3ad", "#5f6872"]} />
      </Path>
      <Path path="M8 52 C24 56 76 56 92 52" style="stroke" strokeWidth={1} color="rgba(40,46,56,0.6)" />
      {[18, 30, 42, 54, 66, 78].map((x, i) => (
        <Circle key={x} cx={x + 2} cy={55 + (i % 2 ? 1 : 0)} r={2.1} color={["#7dff8a", "#ffe08a", "#8fd0ff"][i % 3]} />
      ))}
      <Path path="M36 64 L40 72 L60 72 L64 64" color="#6b747e" />
    </>
  );
}

/** Evren şekilleri (SpriteSheet'in içinde). */
export default function UniverseCells() {
  return (
    <>
      <Cell index={SPRITE.deathStar}><DeathStar /></Cell>
      <Cell index={SPRITE.xwing}><XWing /></Cell>
      <Cell index={SPRITE.tie}><Tie /></Cell>
      <Cell index={SPRITE.glyphA}><Glyph d={GLYPHS[0]} /></Cell>
      <Cell index={SPRITE.glyphA2}><Glyph d={GLYPHS[1]} /></Cell>
      <Cell index={SPRITE.glyphB}><Glyph d={GLYPHS[2]} /></Cell>
      <Cell index={SPRITE.glyphB2}><Glyph d={GLYPHS[3]} /></Cell>
      <Cell index={SPRITE.pill}><Pill /></Cell>
      <Cell index={SPRITE.bullet}><Bullet /></Cell>
      <Cell index={SPRITE.shockRing}><ShockRing /></Cell>
      <Cell index={SPRITE.catA}><Cat legs="M30 60 L24 76 M38 61 L42 76 M60 60 L54 76 M68 58 L74 75" /></Cell>
      <Cell index={SPRITE.catB}><Cat legs="M30 60 L30 76 M38 61 L36 76 M60 60 L62 76 M68 58 L66 76" /></Cell>
      <Cell index={SPRITE.candle}><Candle /></Cell>
      <Cell index={SPRITE.snitchOpen}><SnitchWings d={SNITCH_WING_OPEN} /><SnitchBall /></Cell>
      <Cell index={SPRITE.snitchClosed}><SnitchWings d={SNITCH_WING_CLOSED} /><SnitchBall /></Cell>
      <Cell index={SPRITE.owlOpen}><Owl wings={OWL_UP} /></Cell>
      <Cell index={SPRITE.owlClosed}><Owl wings={OWL_DOWN} /></Cell>
      <Cell index={SPRITE.letter}><Letter /></Cell>
      <Cell index={SPRITE.fellOpen}><Fell wings={FELL_UP} /></Cell>
      <Cell index={SPRITE.fellClosed}><Fell wings={FELL_DOWN} /></Cell>
      <Cell index={SPRITE.oneRing}><OneRing /></Cell>
      <Cell index={SPRITE.wormHead}><WormHead /></Cell>
      <Cell index={SPRITE.wormSeg}><WormSeg /></Cell>
      <Cell index={SPRITE.thopterA}><Thopter wings={THOPTER_UP} /></Cell>
      <Cell index={SPRITE.thopterB}><Thopter wings={THOPTER_FLAT} /></Cell>
      <Cell index={SPRITE.capeA}><Caped cape={CAPE_A} /></Cell>
      <Cell index={SPRITE.capeB}><Caped cape={CAPE_B} /></Cell>
      <Cell index={SPRITE.web}>
        <Path path={WEB} style="stroke" strokeWidth={1.5} strokeCap="round" color={WHITE} />
      </Cell>
      <Cell index={SPRITE.swinger}><Swinger /></Cell>
      <Cell index={SPRITE.rv}><Rv /></Cell>
      <Cell index={SPRITE.tileBr}><ElementTile sym={SYM_R} /></Cell>
      <Cell index={SPRITE.tileBa}><ElementTile sym={SYM_A} /></Cell>
      <Cell index={SPRITE.hat}><Hat /></Cell>
      <Cell index={SPRITE.flask}><Flask /></Cell>
      <Cell index={SPRITE.dragonOpen}><Dragon {...DRAGON_OPEN} /></Cell>
      <Cell index={SPRITE.dragonClosed}><Dragon {...DRAGON_CLOSED} /></Cell>
      <Cell index={SPRITE.ravenOpen}><Raven wings={RAVEN_UP} /></Cell>
      <Cell index={SPRITE.ravenClosed}><Raven wings={RAVEN_DOWN} /></Cell>
      <Cell index={SPRITE.runeA}><Rune d={RUNES[0]} /></Cell>
      <Cell index={SPRITE.runeB}><Rune d={RUNES[1]} /></Cell>
      <Cell index={SPRITE.runeC}><Rune d={RUNES[2]} /></Cell>
      <Cell index={SPRITE.crane}><Crane /></Cell>
      <Cell index={SPRITE.footprint}><Footprint /></Cell>
      <Cell index={SPRITE.magnifier}><Magnifier /></Cell>
      <Cell index={SPRITE.duckSwim}><DuckSwim /></Cell>
      <Cell index={SPRITE.duckFlyOpen}><DuckFly up /></Cell>
      <Cell index={SPRITE.duckFlyClosed}><DuckFly up={false} /></Cell>
      <Cell index={SPRITE.feather}><Feather /></Cell>
      <Cell index={SPRITE.apple}><AppleBody /><AppleTop /></Cell>
      <Cell index={SPRITE.appleBitten}><AppleBitten /></Cell>
      <Cell index={SPRITE.page}><Page /></Cell>
      <Cell index={SPRITE.titan}><Titan /></Cell>
      <Cell index={SPRITE.scout}><Scout /></Cell>
      <Cell index={SPRITE.shuriken}><Shuriken /></Cell>
      <Cell index={SPRITE.kunai}><Kunai /></Cell>
      <Cell index={SPRITE.pirateShip}><PirateShip /></Cell>
      <Cell index={SPRITE.strawHat}><StrawHat /></Cell>
      <Cell index={SPRITE.devilFruit}><DevilFruit /></Cell>
      <Cell index={SPRITE.pocketWatch}><PocketWatch /></Cell>
      <Cell index={SPRITE.broomRider}><BroomRider /></Cell>
      <Cell index={SPRITE.broomRiderL}>
        <Group transform={[{ translateX: 100 }, { scaleX: -1 }]}>
          <BroomRider />
        </Group>
      </Cell>
      <Cell index={SPRITE.rick}><Rick /></Cell>
      <Cell index={SPRITE.morty}><Morty /></Cell>
      <Cell index={SPRITE.saucer}><Saucer /></Cell>
    </>
  );
}
