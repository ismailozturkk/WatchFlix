// components/decor/rmScene.js
//
// Rick and Morty atmosfer sahnesi (OVERLAY.rmPortal = 35, ön katman) — tamamı VEKTÖR
// (128 px atlas sprite'ları büyütülünce bulanıyordu):
//   • Sürekli: uzaylı ova — uzak tepeler, halkalı gezegen + ay, kıvrık saplı ışıklı ampul
//     bitkiler (nefes alır gibi parlar, rüzgârda salınır), mantar ağaçları, mor kristaller.
//   • Olay (rmFrame, 30 sn): sağda yer portalı fokurdayarak açılır → Rick ve Morty adım adım
//     yürüyerek içinden çıkar → portal kapanır → Rick mataradan içer, geğirir; Morty geriye
//     bakar → Rick portal tabancasıyla nişan alır, yeşil mermi solda yeni portal açar → ikisi
//     yürüyüp içine girer (portal düzleminde kesilerek kaybolur) → gökte portal açılır, uzay
//     aracı (kokpitte ikisi) içinden fırlayıp ekranı geçer.
//
// Ölçek: sceneScale (k). Zemin çizgisi SCENERY.lift (sekme çubuğu) üstünde. Karakterler ve
// araç kendi renkleriyle; ova/bitki/gezegen tonları OVERLAY_TONES[35] (RM_TONE adları).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Circle, Group, LinearGradient, Oval, Path, RadialGradient, Skia, vec } from "@shopify/react-native-skia";
import { rmFrame, sceneScale } from "../../utils/weatherParticles";
import { SCENERY } from "../../utils/weatherUniverses";

// OVERLAY_TONES[35] renk sırası
const RM_TONE = ["portal", "ground", "groundHi", "plant", "glow", "planet", "planet2", "spore", "farHill"];
const toneMap = (colors) => Object.fromEntries(RM_TONE.map((name, i) => [name, colors[i] || colors[0]]));

function rgba(hex, a) {
  const h = String(hex).replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Sahne yerleşimi (dp). G = ayak çizgisi; portallar ayakta durur. */
export function rmLayout(width, height) {
  const k = sceneScale(width, height);
  const G = height - (SCENERY.lift + 26) * k;
  const s = 0.95 * k; // karakter ölçeği (Rick ≈ 104 birim)
  const rx = 27 * k;
  const ry = 50 * k;
  return {
    k, G, s, rx, ry,
    py: G - 44 * k,
    pax: width * 0.8,
    pbx: width * 0.2,
    standR: width * 0.47,
    standM: width * 0.47 + 44 * k,
    sky: { x: width * 0.15, y: G - 250 * k, rx: 30 * k, ry: 38 * k },
  };
}

/** Rick / Morty ekran x'i ve toplam yürünen yol (adım evresi için). */
function rickX(L, f) {
  "worklet";
  const x0 = L.pax + 30 * L.k;
  const x2 = L.pbx - 48 * L.k;
  if (f.r2 > 0) return { x: L.standR + (x2 - L.standR) * f.r2, d: x0 - L.standR + (L.standR - x2) * f.r2 };
  return { x: x0 + (L.standR - x0) * f.r1, d: (x0 - L.standR) * f.r1 };
}
function mortyX(L, f) {
  "worklet";
  const x0 = L.pax + 24 * L.k;
  const x2 = L.pbx - 40 * L.k;
  if (f.m2 > 0) return { x: L.standM + (x2 - L.standM) * f.m2, d: x0 - L.standM + (L.standM - x2) * f.m2 };
  return { x: x0 + (L.standM - x0) * f.m1, d: (x0 - L.standM) * f.m1 };
}

// ── Portal geometrisi (birim çember; rx/ry ile elipse açılır) ────────────────
function buildPortal(seed) {
  const r = rng(seed);
  const rim = Skia.Path.Make();
  const N = 30;
  const pts = [];
  for (let i = 0; i < N; i += 1) {
    const a = (i / N) * Math.PI * 2;
    const rr = 1 + (r() - 0.5) * 0.11;
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  const mid = (i) => {
    const p = pts[i % N];
    const q = pts[(i + 1) % N];
    return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  };
  const m0 = mid(0);
  rim.moveTo(m0[0], m0[1]);
  for (let i = 1; i <= N; i += 1) {
    const c = pts[i % N];
    const m = mid(i);
    rim.quadTo(c[0], c[1], m[0], m[1]);
  }
  rim.close();
  // spiral kollar (dolu şerit): 3 açık + 4 koyu ters yönde
  const arms = (count, turns, w0, phase) => {
    const path = Skia.Path.Make();
    const S = 26;
    for (let a = 0; a < count; a += 1) {
      const outer = [];
      const inner = [];
      for (let s = 0; s <= S; s += 1) {
        const tt = s / S;
        const rr = 0.08 + 0.86 * tt;
        const th = phase + (a / count) * Math.PI * 2 + tt * turns;
        const w = w0 * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, tt * 1.15)));
        outer.push([Math.cos(th) * (rr + w), Math.sin(th) * (rr + w)]);
        inner.push([Math.cos(th) * (rr - w * 0.4), Math.sin(th) * (rr - w * 0.4)]);
      }
      path.moveTo(outer[0][0], outer[0][1]);
      for (const q of outer) path.lineTo(q[0], q[1]);
      for (let i = inner.length - 1; i >= 0; i -= 1) path.lineTo(inner[i][0], inner[i][1]);
      path.close();
    }
    return path;
  };
  const drips = Skia.Path.Make();
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2 + r() * 0.3;
    const rr = 1.05 + r() * 0.07;
    drips.addCircle(Math.cos(a) * rr, Math.sin(a) * rr, 0.035 + r() * 0.045);
  }
  const splash = Skia.Path.Make();
  for (let i = 0; i < 14; i += 1) {
    const a = (i / 14) * Math.PI * 2 + r() * 0.25;
    const rr = 0.85 + r() * 0.35;
    splash.addCircle(Math.cos(a) * rr, Math.sin(a) * rr, 0.04 + r() * 0.05);
  }
  return { rim, light: arms(3, 4.2, 0.075, 0), dark: arms(4, -3.4, 0.05, 0.6), drips, splash };
}

const PORTAL_EDGE = "#1a8a35";
const RIM_OUT = [{ scale: 1.08 }];

function Portal({ geo, cx, cy, rx, ry, open, splash, spinA, spinB, spinC, glow }) {
  const T = useDerivedValue(() => {
    const o = open.value < 0.001 ? 0.001 : open.value;
    return [{ translateX: cx }, { translateY: cy }, { scaleX: rx * o }, { scaleY: ry * o }];
  });
  const O = useDerivedValue(() => (open.value > 0.01 ? 1 : 0));
  const ST = useDerivedValue(() => {
    const s = splash.value < 0 ? 0 : splash.value;
    return [{ translateX: cx }, { translateY: cy }, { scaleX: rx }, { scaleY: ry }, { scale: 0.7 + 1.1 * s }];
  });
  const SO = useDerivedValue(() => (splash.value < 0 ? 0 : (1 - splash.value) * 0.9));
  return (
    <>
      <Group opacity={O} transform={T}>
        <Circle cx={0} cy={0} r={2}>
          <RadialGradient c={vec(0, 0)} r={2} colors={[rgba(glow, 0.45), rgba(glow, 0.14), rgba(glow, 0)]} positions={[0.3, 0.6, 1]} />
        </Circle>
        <Group transform={spinC}>
          <Group transform={RIM_OUT}>
            <Path path={geo.rim} color={PORTAL_EDGE} />
          </Group>
          <Path path={geo.rim}>
            <RadialGradient c={vec(0, 0)} r={1.05} colors={["#f4ffe8", "#b4ff9c", "#4fe064", "#22a33f"]} positions={[0, 0.28, 0.72, 1]} />
          </Path>
        </Group>
        <Group transform={spinB}>
          <Path path={geo.dark} color="rgba(24,140,52,0.55)" />
        </Group>
        <Group transform={spinA}>
          <Path path={geo.light} color="rgba(236,255,228,0.85)" />
        </Group>
        <Circle cx={0} cy={0} r={0.22}>
          <RadialGradient c={vec(0, 0)} r={0.22} colors={["rgba(255,255,255,0.95)", "rgba(220,255,210,0)"]} />
        </Circle>
        <Group transform={spinC}>
          <Path path={geo.rim} style="stroke" strokeWidth={0.07} color="rgba(214,255,200,0.95)" />
          <Path path={geo.drips} color="#8cf58c" />
        </Group>
      </Group>
      <Group opacity={SO} transform={ST}>
        <Path path={geo.splash} color="#a8ff9c" />
        <Path path={geo.rim} style="stroke" strokeWidth={0.05} color="rgba(190,255,180,0.8)" />
      </Group>
    </>
  );
}

// ── Karakterler (yerel birim: ayak (0,0), sağa bakar, y yukarı negatif) ─────────
const SKIN = "#f1d3ae";
const SKIN_D = "#d9b28a";

function Limb({ x, y, angle, children }) {
  const T = useDerivedValue(() => [{ translateX: x }, { translateY: y }, { rotate: angle.value }]);
  return <Group transform={T}>{children}</Group>;
}

function RickArt({ pose, swig, aim }) {
  const legB = useDerivedValue(() => -pose.value.leg - 0.07);
  const legF = useDerivedValue(() => pose.value.leg + 0.07);
  const armB = useDerivedValue(() => pose.value.armB);
  const armF = useDerivedValue(() => pose.value.armF);
  const elbow = useDerivedValue(() => pose.value.elbow);
  const head = useDerivedValue(() => pose.value.head);
  const flaskO = useDerivedValue(() => (swig.value > 0.05 ? 1 : 0));
  const gunO = useDerivedValue(() => (aim.value > 0.05 ? 1 : 0));
  const tipO = useDerivedValue(() => 0.5 + 0.5 * aim.value);
  const leg = (pants, shoe) => (
    <>
      <Path path="M-3.6 0 L3.6 0 L3.1 40 L-3.1 40 Z" color={pants} />
      <Path path="M-4.4 39 L7.5 39 C10.5 39 11 44 9 45 L-4.4 45 Z" color={shoe} />
    </>
  );
  return (
    <>
      {/* arka kol + arka bacak */}
      <Limb x={-1} y={-77} angle={armB}>
        <Path path="M-3.4 0 L3.4 0 L2.7 27 L-2.7 27 Z" color="#c9d1d8" />
        <Circle cx={0} cy={29.5} r={3.1} color={SKIN_D} />
      </Limb>
      <Limb x={-1} y={-45} angle={legB}>{leg("#6b5640", "#2f2621")}</Limb>
      <Limb x={1} y={-45} angle={legF}>{leg("#8a7254", "#3d322a")}</Limb>
      {/* önlük gövdesi (bacakların üstünü örter), mavi gömlek, yaka */}
      <Path path="M-8 -82 C-12 -70 -13 -50 -15 -28 L-3 -29 L10 -28 C9.6 -46 9.4 -66 8 -82 Z">
        <LinearGradient start={vec(-12, -82)} end={vec(10, -28)} colors={["#ffffff", "#e7ecf0", "#c8d1d9"]} />
      </Path>
      <Path path="M3.6 -81.5 L8.6 -81.5 C9.3 -68 9.4 -58 9.1 -50 L5.2 -50 C5.6 -60 4.8 -72 3.6 -81.5 Z" color="#98cfe4" />
      <Path path="M3.6 -81.5 L1.6 -64 L5.2 -50 M-6 -80 L-4 -66" style="stroke" strokeWidth={0.9} color="#aab5bf" />
      <Path path="M-12 -44 L-4 -44" style="stroke" strokeWidth={0.8} color="#b5c0c9" />
      <Path path="M-15 -28 L-3 -29 L10 -28" style="stroke" strokeWidth={0.8} color="#9aa6b1" />
      {/* boyun + baş */}
      <Path path="M-0.5 -83 L5 -83 L5.5 -88 L0 -88 Z" color={SKIN_D} />
      <Limb x={2} y={-86} angle={head}>
        <Oval x={-8} y={-21} width={18.5} height={23} color={SKIN} />
        <Path path="M10 -10 C10.5 -5 8.5 -1.5 5 -0.5 L1 -1 C4 -3 7 -6 10 -10 Z" color="rgba(170,140,110,0.35)" />
        <Path path="M-7.5 -12 L-16 -20 L-7 -17 L-14 -29 L-4 -21 L-3 -34 L2 -22 L8 -31 L7.5 -19 L11 -21 C8 -24 1 -24 -4 -18 C-6 -15 -7 -13 -7.5 -12 Z" color="#b7dae5" />
        <Path path="M-7.5 -12 L-15 -8 L-8 -6 L-13 0 L-6.5 -2 Z" color="#a5ccd8" />
        <Path path="M-14 -29 L-4 -21 M-3 -34 L2 -22 M8 -31 L7.5 -19" style="stroke" strokeWidth={0.7} color="#8fb7c4" />
        <Oval x={-1.4} y={-12.5} width={3.4} height={5} color={SKIN_D} />
        <Path path="M3 -13.6 C6 -15.2 10 -15.2 12.6 -14" style="stroke" strokeWidth={2.6} strokeCap="round" color="#8fb7c6" />
        <Circle cx={8.6} cy={-10.6} r={2.8} color="#ffffff" />
        <Circle cx={9.6} cy={-10.5} r={1} color="#1d1d1d" />
        <Path path="M6 -7.6 C7.5 -6.6 9.6 -6.6 11 -7.4" style="stroke" strokeWidth={0.7} color={SKIN_D} />
        <Path path="M10.5 -11 L14 -5.2 L10.6 -4.6" style="stroke" strokeWidth={1.1} strokeJoin="round" color={SKIN_D} />
        <Path path="M5 -1.8 C7.5 -1 10 -1.3 12 -2.4" style="stroke" strokeWidth={1.1} strokeCap="round" color="#7c4c34" />
        <Path path="M7 -1.6 C7.6 0.6 7.4 2 7 3" style="stroke" strokeWidth={0.8} strokeCap="round" color="rgba(200,235,240,0.7)" />
      </Limb>
      {/* ön kol: matara / portal tabancası */}
      <Limb x={1} y={-77} angle={armF}>
        <Path path="M-3.5 0 L3.5 0 L3.2 16 L-3.2 16 Z" color="#f6f8fa" />
        <Limb x={0} y={15} angle={elbow}>
          <Circle cx={0} cy={0} r={3.2} color="#f6f8fa" />
          <Path path="M-3.2 0 L3.2 0 L2.8 12.5 L-2.8 12.5 Z" color="#f6f8fa" />
          <Path path="M-2.8 10 L2.8 10" style="stroke" strokeWidth={0.8} color="#c3ccd4" />
          <Group opacity={flaskO}>
            <Path path="M-1.4 13 L1.4 13 L1.6 16 L-1.6 16 Z" color="#6f7780" />
            <Path path="M-3.6 16 L3.6 16 L4 27 L-4 27 Z" color="#aeb6bf" />
            <Path path="M-2.2 18 L-2.2 25" style="stroke" strokeWidth={1} color="#e6eaee" />
          </Group>
          <Group opacity={gunO}>
            <Path path="M-3.6 13 L3.6 13 L4 29 L-4 29 Z" color="#c9ced4" />
            <Path path="M-3.6 13 L-3.6 29" style="stroke" strokeWidth={1} color="#8e959d" />
            <Path path="M3.4 15 L7.4 15 L7.4 25 L3.4 25 Z" color="#7dff8a" />
            <Path path="M4.6 16 L4.6 24" style="stroke" strokeWidth={0.9} color="#e8ffe8" />
            <Group opacity={tipO}>
              <Circle cx={0} cy={30.5} r={2.6} color="#9dff9a" />
            </Group>
          </Group>
          <Circle cx={0} cy={14.5} r={3.3} color={SKIN} />
        </Limb>
      </Limb>
    </>
  );
}
function MortyArt({ pose }) {
  const legB = useDerivedValue(() => -pose.value.leg - 0.06);
  const legF = useDerivedValue(() => pose.value.leg + 0.06);
  const armB = useDerivedValue(() => pose.value.armB);
  const armF = useDerivedValue(() => pose.value.armF);
  const headT = useDerivedValue(() => {
    const flip = 1 - 2 * pose.value.look;
    return [{ translateX: 2 }, { translateY: -56 }, { scaleX: Math.abs(flip) < 0.05 ? (flip < 0 ? -0.05 : 0.05) : flip }];
  });
  const leg = (jeans, shoe) => (
    <>
      <Path path="M-3.8 0 L3.8 0 L3.4 26 L-3.4 26 Z" color={jeans} />
      <Path path="M-4.8 25.5 L7 25.5 C9.6 25.5 10 30 8.4 31 L-4.8 31 Z" color={shoe} />
      <Path path="M-4.8 30 L8.6 30" style="stroke" strokeWidth={0.8} color="#b9bec4" />
    </>
  );
  const arm = (sleeve, skin) => (
    <>
      <Path path="M-3.8 0 L3.8 0 L3.6 9.5 L-3.6 9.5 Z" color={sleeve} />
      <Path path="M-2.5 9 L2.5 9 L2.1 20 L-2.1 20 Z" color={skin} />
      <Circle cx={0} cy={21.6} r={2.8} color={skin} />
    </>
  );
  return (
    <>
      <Limb x={-1} y={-50} angle={armB}>{arm("#e0ad1a", SKIN_D)}</Limb>
      <Limb x={-1.5} y={-29} angle={legB}>{leg("#2f4c86", "#d6d9dd")}</Limb>
      <Limb x={1.5} y={-29} angle={legF}>{leg("#3d5fa3", "#f3f3f3")}</Limb>
      <Path path="M-9 -54 C-11.5 -46 -11.5 -36 -10.5 -27 L10.5 -27 C11.5 -36 11.5 -46 9 -54 Z">
        <LinearGradient start={vec(0, -54)} end={vec(0, -27)} colors={["#ffdd52", "#f2bc1e"]} />
      </Path>
      <Path path="M-10.5 -27 L10.5 -27" style="stroke" strokeWidth={1.4} color="#d79f12" />
      <Path path="M-1 -55 L5 -55 L5.4 -59 L-0.6 -59 Z" color={SKIN_D} />
      <Group transform={headT}>
        <Circle cx={0} cy={-12} r={13.6} color={SKIN} />
        <Path path="M-13 -10 C-14.5 -25 -4 -29 4 -28.2 C11.5 -27.4 15 -21.5 14 -16.5 C9.5 -20.5 1.5 -21.5 -3.5 -17.5 C-5.5 -15 -6 -11 -7 -5.5 C-10 -6 -12.5 -7.5 -13 -10 Z" color="#6a3d20" />
        <Path path="M-6 -22 C-2 -25 4 -25.5 8 -24" style="stroke" strokeWidth={0.8} color="#8a5530" />
        <Oval x={-4.4} y={-14} width={3.6} height={5} color={SKIN_D} />
        <Circle cx={8.2} cy={-11.6} r={4} color="#ffffff" />
        <Circle cx={9.4} cy={-11.4} r={1.25} color="#1d1d1d" />
        <Path path="M5.5 -16.8 L10.8 -17.4" style="stroke" strokeWidth={1.1} strokeCap="round" color="#6a3d20" />
        <Path path="M12.4 -9.6 L14.4 -6.8 L12 -6.2" style="stroke" strokeWidth={1} strokeJoin="round" color={SKIN_D} />
        <Path path="M5 -2.6 C6.4 -3.6 7.6 -1.8 9 -2.8 C10.2 -3.6 11.2 -2.6 12 -3.2" style="stroke" strokeWidth={1} strokeCap="round" color="#7c4c34" />
      </Group>
      <Limb x={1} y={-50} angle={armF}>{arm("#ffd84a", SKIN)}</Limb>
    </>
  );
}

// ── Uzay aracı (yerel birim, merkez (0,0), sağa uçar) ──────────────────────────
function ShipArt({ flame }) {
  const flameT = useDerivedValue(() => [{ translateX: -57 }, { translateY: 3 }, { scaleX: flame.value }]);
  return (
    <>
      <Group transform={flameT}>
        <Path path="M0 -6 C-10 -6 -26 -2 -34 0 C-26 2 -10 6 0 6 Z" color="rgba(120,255,150,0.55)" />
        <Path path="M0 -3.5 C-8 -3 -16 -1 -20 0 C-16 1 -8 3 0 3.5 Z" color="#eaffd8" />
      </Group>
      <Path path="M-48 14 L-40 24 L-30 24 L-30 14 Z M30 14 L40 24 L48 24 L44 14 Z" color="#6c7680" />
      <Path path="M-26 -10 C-22 -32 14 -34 22 -10 Z" color="rgba(26,40,52,0.9)" />
      {/* kokpitte Rick ve Morty */}
      <Circle cx={-9} cy={-15} r={6} color={SKIN} />
      <Path path="M-14 -16 L-19 -22 L-13 -20 L-14 -28 L-9 -21 L-6 -28 L-4.5 -20 C-7 -23 -11 -22 -14 -16 Z" color="#b7dae5" />
      <Circle cx={-5.6} cy={-16} r={1.5} color="#ffffff" />
      <Circle cx={9} cy={-14} r={6.8} color={SKIN} />
      <Path path="M2.4 -14 C1.6 -22 8 -24 12 -22.6 C15.6 -21.4 16.4 -18 15.6 -16.6 C12 -19 8 -19 5 -17 C4 -15.6 3.6 -14 2.4 -14 Z" color="#6a3d20" />
      <Circle cx={13} cy={-13.6} r={2} color="#ffffff" />
      <Path path="M-26 -10 C-22 -32 14 -34 22 -10 Z" color="rgba(170,245,225,0.32)" />
      <Path path="M-19 -14 C-16 -25 -6 -28 2 -27" style="stroke" strokeWidth={1.6} strokeCap="round" color="rgba(255,255,255,0.7)" />
      <Path path="M-58 4 C-60 -5 -48 -11 -30 -11 L34 -11 C51 -11 62 -4 62 4 C62 12 48 17 30 17 L-38 17 C-52 17 -57 12 -58 4 Z">
        <LinearGradient start={vec(0, -11)} end={vec(0, 17)} colors={["#eef1f4", "#b4bdc6", "#7a8591"]} />
      </Path>
      <Path path="M-56 6 C-30 10 30 10 61 6" style="stroke" strokeWidth={3.2} color="#d24b3c" />
      <Path path="M-54 -3 C-30 -6 30 -6 56 -3" style="stroke" strokeWidth={1} color="rgba(255,255,255,0.65)" />
      <Circle cx={56} cy={2} r={3.2} color="#fff3b0" />
      <Circle cx={56} cy={2} r={6} color="rgba(255,240,160,0.35)" />
      {[-40, -26, -12, 2, 16, 30].map((x, i) => (
        <Circle key={x} cx={x} cy={13} r={1.7} color={["#7dff8a", "#ffe08a", "#8fd0ff"][i % 3]} />
      ))}
    </>
  );
}

function Puff({ ship, L, width, i }) {
  const T = useDerivedValue(() => {
    const s = ship.value - 0.05 - i * 0.022;
    const p = shipPose(L, width, s < 0 ? 0 : s);
    const age = ship.value < 0 ? 0 : 0.4 + i * 0.25;
    return [{ translateX: p.x - 58 * L.k * 0.9 }, { translateY: p.y + 4 * L.k + age * 3 * L.k }, { scale: (5 + age * 5) * L.k }];
  });
  const O = useDerivedValue(() => {
    const s = ship.value - 0.05 - i * 0.022;
    return ship.value < 0 || s < 0 ? 0 : 0.42 * (1 - i / 7);
  });
  return (
    <Group opacity={O} transform={T}>
      <Circle cx={0} cy={0} r={1}>
        <RadialGradient c={vec(0, 0)} r={1} colors={["rgba(210,255,220,0.9)", "rgba(160,230,180,0)"]} />
      </Circle>
    </Group>
  );
}

function shipPose(L, width, s) {
  "worklet";
  const x0 = L.sky.x - 72 * L.k;
  const x1 = width + 110 * L.k;
  const e = 0.25 * s + 0.75 * s * s;
  return { x: x0 + (x1 - x0) * e, y: L.sky.y - 120 * L.k * s * s + 7 * L.k * Math.sin(s * 11), rot: -0.06 - 0.16 * s };
}

// ── Ova: uzak tepeler, gezegen, zemin, bitkiler ─────────────────────────────
function buildLand(width, height, L) {
  const { k, G } = L;
  const r = rng(35);
  const far = Skia.Path.Make();
  far.moveTo(0, height);
  for (let x = 0; x <= width + 8; x += 8) {
    const y = G - 34 * k - 22 * k * (0.5 + 0.5 * Math.sin(x / (70 * k) + 0.8)) - 10 * k * Math.sin(x / (23 * k));
    far.lineTo(x, y);
  }
  far.lineTo(width, height);
  far.close();
  // uzak sivri kayalar (tepelerin üstünde)
  const spires = Skia.Path.Make();
  for (const fx of [0.06, 0.33, 0.58, 0.93]) {
    const x = width * fx;
    const h = (34 + r() * 30) * k;
    const b = G - 44 * k;
    spires.moveTo(x - 7 * k, b);
    spires.quadTo(x - 3 * k, b - h * 0.6, x + 1 * k, b - h);
    spires.quadTo(x + 4 * k, b - h * 0.5, x + 9 * k, b);
    spires.close();
  }
  const ground = Skia.Path.Make();
  ground.moveTo(0, height);
  for (let x = 0; x <= width + 6; x += 6) {
    ground.lineTo(x, G - 6 * k + 3 * k * Math.sin(x / (41 * k) + 1.3) + 2 * k * Math.sin(x / (13 * k)));
  }
  ground.lineTo(width, height);
  ground.close();
  const craters = Skia.Path.Make();
  for (let i = 0; i < 9; i += 1) {
    const x = width * (0.04 + r() * 0.92);
    const y = G + (6 + r() * 40) * k;
    const w = (10 + r() * 18) * k;
    craters.addOval(Skia.XYWHRect(x - w / 2, y - w * 0.14, w, w * 0.28));
  }
  const pebbles = Skia.Path.Make();
  for (let i = 0; i < 22; i += 1) {
    const x = width * r();
    const y = G + (r() * 60) * k;
    pebbles.addCircle(x, y, (0.8 + r() * 1.8) * k);
  }
  // mor kristal kümeleri
  const crystals = Skia.Path.Make();
  for (const [fx, sz] of [[0.035, 1], [0.64, 0.75], [0.965, 1.15]]) {
    const x = width * fx;
    const b = G - 2 * k;
    for (const [dx, h, lean] of [[-6, 18, -0.35], [0, 28, 0.05], [6, 20, 0.4], [10, 12, 0.6]]) {
      const H = h * sz * k;
      const bx = x + dx * sz * k;
      crystals.moveTo(bx - 3 * sz * k, b);
      crystals.lineTo(bx + Math.sin(lean) * H - 1 * k, b - H);
      crystals.lineTo(bx + Math.sin(lean) * H + 1.4 * k, b - H + 3 * k);
      crystals.lineTo(bx + 3 * sz * k, b);
      crystals.close();
    }
  }
  // gezegen
  const planet = { x: width * 0.84, y: G - 215 * k, r: 26 * k };
  const ringBack = Skia.Path.Make();
  const ringFront = Skia.Path.Make();
  const RX = planet.r * 1.9;
  const RY = planet.r * 0.42;
  ringBack.addArc(Skia.XYWHRect(planet.x - RX, planet.y - RY, RX * 2, RY * 2), 180, 180);
  ringFront.addArc(Skia.XYWHRect(planet.x - RX, planet.y - RY, RX * 2, RY * 2), 0, 180);
  const bands = Skia.Path.Make();
  for (const dy of [-0.45, -0.1, 0.3]) {
    bands.addOval(Skia.XYWHRect(planet.x - planet.r * 0.98, planet.y + dy * planet.r - planet.r * 0.08, planet.r * 1.96, planet.r * 0.16));
  }
  return { far, spires, ground, craters, pebbles, crystals, planet, ringBack, ringFront, bands, RX, RY };
}

// bitki listesi: [x oranı, tür, boy, faz]
const FLORA = [
  [0.1, "bulb", 1.0, 0.2], [0.28, "shroom", 1.0, 1.1], [0.36, "bulb", 0.7, 2.4], [0.55, "bulb", 1.15, 0.7],
  [0.7, "shroom", 0.75, 3.1], [0.9, "bulb", 0.85, 1.9],
];

function buildPlant(kind, size, k, c) {
  const z = size * k;
  if (kind === "bulb") {
    const stem = Skia.Path.Make();
    stem.moveTo(0, 0);
    stem.cubicTo(-6 * z, -14 * z, 7 * z, -26 * z, 1 * z, -40 * z);
    const leaves = Skia.Path.Make();
    leaves.moveTo(0, -2 * z);
    leaves.quadTo(-12 * z, -8 * z, -14 * z, -2 * z);
    leaves.quadTo(-8 * z, -1 * z, 0, -2 * z);
    leaves.moveTo(1 * z, -6 * z);
    leaves.quadTo(12 * z, -14 * z, 15 * z, -8 * z);
    leaves.quadTo(8 * z, -5 * z, 1 * z, -6 * z);
    return { stem, leaves, bulb: { x: 1 * z, y: -44 * z, r: 5.2 * z }, sw: 2.2 * z, color: c.plant };
  }
  const stem = Skia.Path.Make();
  stem.moveTo(-3 * z, 0);
  stem.quadTo(-1 * z, -16 * z, -2 * z, -30 * z);
  stem.lineTo(2.5 * z, -30 * z);
  stem.quadTo(2 * z, -16 * z, 4 * z, 0);
  stem.close();
  const leaves = Skia.Path.Make();
  leaves.moveTo(-20 * z, -28 * z);
  leaves.cubicTo(-18 * z, -46 * z, 20 * z, -46 * z, 22 * z, -28 * z);
  leaves.quadTo(1 * z, -33 * z, -20 * z, -28 * z);
  leaves.close();
  const spots = Skia.Path.Make();
  for (const [sx, sy, sr] of [[-9, -36, 2.4], [2, -40, 2.8], [12, -35, 2], [-2, -33, 1.5]]) spots.addCircle(sx * z, sy * z, sr * z);
  return { stem, leaves, spots, sw: 0, color: c.plant };
}

function Plant({ x, G, kind, size, phase, k, c, clock }) {
  const g = useMemo(() => buildPlant(kind, size, k, c), [kind, size, k, c]);
  const T = useDerivedValue(() => [{ translateX: x }, { translateY: G }, { rotate: Math.sin(clock.value * 0.7 + phase) * 0.06 }]);
  const glowO = useDerivedValue(() => 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(clock.value * 1.3 + phase * 2)));
  if (kind === "bulb") {
    return (
      <Group transform={T}>
        <Path path={g.leaves} color={c.plant} />
        <Path path={g.stem} style="stroke" strokeWidth={g.sw} strokeCap="round" color={c.plant} />
        <Group opacity={glowO}>
          <Circle cx={g.bulb.x} cy={g.bulb.y} r={g.bulb.r * 3}>
            <RadialGradient c={vec(g.bulb.x, g.bulb.y)} r={g.bulb.r * 3} colors={[rgba(c.glow, 0.55), rgba(c.glow, 0)]} />
          </Circle>
        </Group>
        <Circle cx={g.bulb.x} cy={g.bulb.y} r={g.bulb.r}>
          <RadialGradient c={vec(g.bulb.x - g.bulb.r * 0.3, g.bulb.y - g.bulb.r * 0.3)} r={g.bulb.r * 1.2} colors={[c.spore, c.glow]} />
        </Circle>
      </Group>
    );
  }
  return (
    <Group transform={T}>
      <Path path={g.stem} color={rgba(c.spore, 0.75)} />
      <Path path={g.leaves} color={c.plant} />
      <Group opacity={glowO}>
        <Path path={g.spots} color={c.glow} />
      </Group>
    </Group>
  );
}

// ── Sahne ─────────────────────────────────────────────────────────────────────
export default function RmScene({ p, clock, width, height, tone }) {
  const L = useMemo(() => rmLayout(width, height), [width, height]);
  const c = useMemo(() => toneMap(tone.colors), [tone.colors]);
  const land = useMemo(() => buildLand(width, height, L), [width, height, L]);
  const geoA = useMemo(() => buildPortal(11), []);
  const geoB = useMemo(() => buildPortal(23), []);
  const geoC = useMemo(() => buildPortal(37), []);
  const { k, G, s } = L;
  const landAlpha = Math.min(1, tone.alpha * 1.05);

  const f = useDerivedValue(() => rmFrame(p, clock.value));
  const spinA = useDerivedValue(() => [{ rotate: clock.value * 1.9 }]);
  const spinB = useDerivedValue(() => [{ rotate: -clock.value * 1.15 }]);
  const spinC = useDerivedValue(() => [{ rotate: clock.value * 0.35 }]);
  const openA = useDerivedValue(() => f.value.a);
  const openB = useDerivedValue(() => f.value.b);
  const openC = useDerivedValue(() => f.value.c);
  const splA = useDerivedValue(() => f.value.sa);
  const splB = useDerivedValue(() => f.value.sb);
  const splC = useDerivedValue(() => f.value.sc);
  const swig = useDerivedValue(() => f.value.swig);
  const aim = useDerivedValue(() => f.value.aim);
  const ship = useDerivedValue(() => f.value.ship);

  // Rick: konum + poz
  const rick = useDerivedValue(() => {
    const fr = f.value;
    const { x, d } = rickX(L, fr);
    const ph = (d / (23 * L.k)) * Math.PI;
    const sw = Math.sin(ph) * fr.ampR;
    const idle = Math.sin(clock.value * 1.6) * 0.03;
    const walkArm = -0.42 * sw;
    const rest = 1 - fr.swig - fr.aim;
    const armF = walkArm * rest - 1.7 * fr.swig + (-1.52 - 0.32 * fr.recoil) * fr.aim;
    const elbow = (-0.22 - 0.12 * fr.ampR) * rest - 1.94 * fr.swig;
    return {
      x,
      bob: Math.abs(Math.sin(ph)) * 1.8 * fr.ampR,
      leg: 0.46 * sw,
      armB: 0.4 * sw + idle,
      armF,
      elbow,
      head: -0.36 * fr.swig + 0.05 * fr.aim + idle * 0.5 + 0.04 * fr.ampR,
      vis: fr.u >= 0.085 && fr.u < 0.705 ? 1 : 0,
    };
  });
  const morty = useDerivedValue(() => {
    const fr = f.value;
    const { x, d } = mortyX(L, fr);
    const ph = (d / (16 * L.k)) * Math.PI;
    const sw = Math.sin(ph) * fr.ampM;
    const fright = fr.aim * (fr.u > 0.475 ? 1 : 0.4);
    return {
      x,
      bob: Math.abs(Math.sin(ph)) * 1.6 * fr.ampM + Math.sin(clock.value * 9) * 0.5 * fright,
      leg: 0.52 * sw,
      armB: 0.5 * sw - 1.1 * fright,
      armF: -0.5 * sw - 1.4 * fright,
      look: fr.look,
      vis: fr.u >= 0.13 && fr.u < 0.745 ? 1 : 0,
    };
  });
  const rickT = useDerivedValue(() => [{ translateX: rick.value.x }, { translateY: G - rick.value.bob * s }, { scaleX: -s }, { scaleY: s }]);
  const mortyT = useDerivedValue(() => [{ translateX: morty.value.x }, { translateY: G - morty.value.bob * s }, { scaleX: -s }, { scaleY: s }]);
  const rickO = useDerivedValue(() => rick.value.vis);
  const mortyO = useDerivedValue(() => morty.value.vis);
  // portal düzleminde kesme: A açıkken yalnız solu, B açıkken yalnız sağı görünür
  const walkClip = useDerivedValue(() => {
    const left = f.value.b > 0.01 ? L.pbx : -60;
    const right = f.value.a > 0.01 ? L.pax : width + 60;
    return Skia.XYWHRect(left, 0, Math.max(0, right - left), height);
  });
  const shipClip = useDerivedValue(() => {
    const left = f.value.c > 0.01 ? L.sky.x : -200;
    return Skia.XYWHRect(left, 0, width + 400, height);
  });

  // mermi (tabanca ucu → portal B merkezi), namlu parlaması, geğirme baloncukları
  const tipX = L.standR - (1 + 44) * s;
  const tipY = G - 77 * s;
  const boltT = useDerivedValue(() => {
    const q = f.value.shot < 0 ? 0 : f.value.shot;
    return [{ translateX: tipX + (L.pbx - tipX) * q }, { translateY: tipY + (L.py - tipY) * q - Math.sin(q * Math.PI) * 14 * k }];
  });
  const boltO = useDerivedValue(() => (f.value.shot < 0 ? 0 : 1));
  const muzzleO = useDerivedValue(() => f.value.recoil * 0.9);
  const burpT = useDerivedValue(() => {
    const q = f.value.burp < 0 ? 0 : f.value.burp;
    return [{ translateX: L.standR - 13 * s }, { translateY: G - 88 * s - q * 18 * k }];
  });
  const burpO = useDerivedValue(() => (f.value.burp < 0 ? 0 : Math.sin(f.value.burp * Math.PI)));
  const groundA = useDerivedValue(() => Math.min(1, f.value.a) * 0.55);
  const groundB = useDerivedValue(() => Math.min(1, f.value.b) * 0.55);

  const shipT = useDerivedValue(() => {
    const sp = shipPose(L, width, ship.value < 0 ? 0 : ship.value);
    return [{ translateX: sp.x }, { translateY: sp.y }, { rotate: sp.rot }, { scale: 0.9 * k }];
  });
  const shipO = useDerivedValue(() => (ship.value < 0 ? 0 : 1));
  const flame = useDerivedValue(() => 0.75 + 0.25 * Math.sin(clock.value * 31) + 0.15 * Math.sin(clock.value * 17));

  const pl = land.planet;
  return (
    <>
      {/* gökyüzü: halkalı gezegen + ay */}
      <Group opacity={landAlpha * 0.85}>
        <Path path={land.ringBack} style="stroke" strokeWidth={4 * k} color={rgba(c.planet2, 0.7)} />
        <Circle cx={pl.x} cy={pl.y} r={pl.r}>
          <LinearGradient start={vec(pl.x - pl.r, pl.y - pl.r)} end={vec(pl.x + pl.r, pl.y + pl.r)} colors={[c.planet, rgba(c.planet, 0.55)]} />
        </Circle>
        <Path path={land.bands} color={rgba(c.planet2, 0.28)} />
        <Path path={land.ringFront} style="stroke" strokeWidth={4 * k} color={rgba(c.planet2, 0.8)} />
        <Circle cx={width * 0.66} cy={G - 268 * k} r={7 * k} color={rgba(c.planet2, 0.7)} />
        <Circle cx={width * 0.66 - 2 * k} cy={G - 270 * k} r={2 * k} color={rgba(c.spore, 0.3)} />
      </Group>

      {/* gök portalı + uzay aracı */}
      <Portal geo={geoC} cx={L.sky.x} cy={L.sky.y} rx={L.sky.rx} ry={L.sky.ry} open={openC} splash={splC} spinA={spinA} spinB={spinB} spinC={spinC} glow={c.portal} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Puff key={i} ship={ship} L={L} width={width} i={i} />
      ))}
      <Group clip={shipClip} opacity={shipO}>
        <Group transform={shipT}>
          <ShipArt flame={flame} />
        </Group>
      </Group>

      {/* ova */}
      <Group opacity={landAlpha}>
        <Path path={land.far} color={c.farHill} />
        <Path path={land.spires} color={c.farHill} />
        {FLORA.map(([fx, kind, size, phase]) => (
          <Plant key={fx} x={width * fx} G={G - 3 * k} kind={kind} size={size} phase={phase} k={k} c={c} clock={clock} />
        ))}
        <Path path={land.ground}>
          <LinearGradient start={vec(0, G - 10 * k)} end={vec(0, height)} colors={[c.groundHi, c.ground]} />
        </Path>
        <Path path={land.craters} color={rgba(c.ground, 0.7)} />
        <Path path={land.pebbles} color={rgba(c.groundHi, 0.9)} />
        <Path path={land.crystals} color={c.planet2} />
      </Group>

      {/* portal ışığı zeminde */}
      <Group opacity={groundA}>
        <Oval x={L.pax - 60 * k} y={G - 8 * k} width={120 * k} height={18 * k}>
          <RadialGradient c={vec(L.pax, G + 1 * k)} r={60 * k} colors={["rgba(140,255,150,0.9)", "rgba(140,255,150,0)"]} />
        </Oval>
      </Group>
      <Group opacity={groundB}>
        <Oval x={L.pbx - 60 * k} y={G - 8 * k} width={120 * k} height={18 * k}>
          <RadialGradient c={vec(L.pbx, G + 1 * k)} r={60 * k} colors={["rgba(140,255,150,0.9)", "rgba(140,255,150,0)"]} />
        </Oval>
      </Group>

      <Portal geo={geoA} cx={L.pax} cy={L.py} rx={L.rx} ry={L.ry} open={openA} splash={splA} spinA={spinA} spinB={spinB} spinC={spinC} glow={c.portal} />
      <Portal geo={geoB} cx={L.pbx} cy={L.py} rx={L.rx} ry={L.ry} open={openB} splash={splB} spinA={spinA} spinB={spinB} spinC={spinC} glow={c.portal} />

      {/* karakterler (Morty arkada, Rick önde) */}
      <Group clip={walkClip}>
        <Group opacity={mortyO} transform={mortyT}>
          <MortyArt pose={morty} />
        </Group>
        <Group opacity={rickO} transform={rickT}>
          <RickArt pose={rick} swig={swig} aim={aim} />
        </Group>
      </Group>

      {/* mermi, namlu parlaması, geğirme */}
      <Group opacity={muzzleO}>
        <Circle cx={tipX} cy={tipY} r={9 * k}>
          <RadialGradient c={vec(tipX, tipY)} r={9 * k} colors={["rgba(235,255,225,1)", "rgba(125,255,138,0)"]} />
        </Circle>
      </Group>
      <Group opacity={boltO} transform={boltT}>
        <Oval x={-2 * k} y={-3.5 * k} width={26 * k} height={7 * k} color="rgba(125,255,138,0.35)" />
        <Circle cx={0} cy={0} r={9 * k}>
          <RadialGradient c={vec(0, 0)} r={9 * k} colors={["rgba(125,255,138,0.6)", "rgba(125,255,138,0)"]} />
        </Circle>
        <Circle cx={0} cy={0} r={3.6 * k} color="#d8ffd0" />
      </Group>
      <Group opacity={burpO} transform={burpT}>
        <Circle cx={0} cy={0} r={2.2 * k} style="stroke" strokeWidth={0.9 * k} color="rgba(180,255,170,0.9)" />
        <Circle cx={-6 * k} cy={-7 * k} r={3 * k} style="stroke" strokeWidth={0.9 * k} color="rgba(180,255,170,0.8)" />
        <Circle cx={-2 * k} cy={-15 * k} r={1.6 * k} style="stroke" strokeWidth={0.8 * k} color="rgba(180,255,170,0.7)" />
      </Group>
    </>
  );
}
