// components/decor/moneyHeistScene.js
//
// Money Heist (La Casa de Papel) evren sahnesi (OVERLAY.mhVec = 75) — tamamı VEKTÖR:
//   • Gece meydan: kırmızı projektörlerle aydınlanan neoklasik darphane cephesi (sütunlu revak,
//     alınlık, basamaklar, sıcak pencereler); iki yanda ağaçlar, fenerler; gökte iki projektör
//     yavaşça tarar; önde iki polis aracı yumuşak mavi/kırmızı ışık nefes alır (çakma yok).
//   • İKİ olay (döngüde sırayla, eventPick):
//       A) PARA YAĞMURU: bir zeplin meydanın üstünden geçerken banknotlar saçılır; kâğıtlar
//          dönerek, salınarak yere süzülür.
//       B) MASKELER: revakta, sütunların arasında kırmızı tulumlu, beyaz maskeli altı siluet tek tek
//          belirir, yumruklarını kaldırır, sonra tek tek kaybolur.
//
// Logo / amblem YOK: maske "esinli" genel tiyatro maskesi; banknotlarda yazı/simge yok.
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[75] (MH_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Group, LinearGradient, Path, Rect, Skia, vec } from "@shopify/react-native-skia";
import { eventPick, restU } from "../../utils/weatherParticles";
import { Glow, addRoundTree, groundLayout, hash, rgba, sm, toneMap } from "./seasonKit";

export const MH_TONE = [
  "beamLight",
  "build",
  "buildShade",
  "column",
  "pediment",
  "window",
  "step",
  "floodRed",
  "tree",
  "lamp",
  "lampPost",
  "street",
  "car",
  "police1",
  "police2",
  "blimp",
  "blimpDark",
  "note",
  "noteDark",
  "suit",
  "suitShade",
  "mask",
  "maskInk",
];

const COLS = 8;
const FIGS = 6;

export function mhLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  const u = Math.min(k * 1.2, (width * 0.96) / 330);
  const plazaY = ground - 30 * k;
  const cx = width * 0.5;
  const colBase = plazaY - 14 * u; // revak tabanı (basamakların üstü)
  const colTop = colBase - 86 * u;
  return { ...L, u, plazaY, cx, colBase, colTop, W: 160 * u, facadeTop: colTop - 46 * u };
}

// ───────────────────────────── statik

function buildFacade(L) {
  const { u, cx, plazaY, colBase, colTop, W, facadeTop, k, width } = L;
  const build = Skia.Path.Make();
  const shade = Skia.Path.Make();
  const column = Skia.Path.Make();
  const ped = Skia.Path.Make();
  const win = Skia.Path.Make();
  const step = Skia.Path.Make();
  // kanatlar (revakın iki yanı) + arka gövde
  build.addRect(Skia.XYWHRect(cx - W, colTop - 12 * u, W * 2, colBase - colTop + 12 * u));
  build.addRect(Skia.XYWHRect(cx - W * 0.62, facadeTop + 10 * u, W * 1.24, colTop - facadeTop));
  // revak: sütunların arkası gölgede
  const pw = W * 0.62;
  shade.addRect(Skia.XYWHRect(cx - pw, colTop, pw * 2, colBase - colTop));
  // alınlık (üçgen) + saçak + friz
  ped.moveTo(cx - pw - 10 * u, colTop - 4 * u);
  ped.lineTo(cx, colTop - 44 * u);
  ped.lineTo(cx + pw + 10 * u, colTop - 4 * u);
  ped.close();
  shade.moveTo(cx - pw + 8 * u, colTop - 8 * u);
  shade.lineTo(cx, colTop - 36 * u);
  shade.lineTo(cx + pw - 8 * u, colTop - 8 * u);
  shade.close();
  ped.addRect(Skia.XYWHRect(cx - pw - 12 * u, colTop - 6 * u, (pw + 12 * u) * 2, 8 * u));
  ped.addRect(Skia.XYWHRect(cx - W - 4 * u, colTop - 16 * u, W * 2 + 8 * u, 5 * u));
  // sütunlar (yivli: ince gölge çizgileri)
  for (let i = 0; i < COLS; i += 1) {
    const x = cx - pw + 8 * u + (i * (pw * 2 - 16 * u)) / (COLS - 1);
    column.addRect(Skia.XYWHRect(x - 4.4 * u, colTop + 4 * u, 8.8 * u, colBase - colTop - 8 * u));
    column.addRect(Skia.XYWHRect(x - 6.4 * u, colTop + 1 * u, 12.8 * u, 4 * u));
    column.addRect(Skia.XYWHRect(x - 6.4 * u, colBase - 5 * u, 12.8 * u, 4 * u));
    shade.addRect(Skia.XYWHRect(x - 1.6 * u, colTop + 6 * u, 0.8 * u, colBase - colTop - 12 * u));
    shade.addRect(Skia.XYWHRect(x + 1.2 * u, colTop + 6 * u, 0.8 * u, colBase - colTop - 12 * u));
  }
  // kanat pencereleri (2 kat) + üst gövde pencereleri
  for (let side = -1; side <= 1; side += 2)
    for (let r = 0; r < 2; r += 1)
      for (let i = 0; i < 3; i += 1) {
        const x = cx + side * (pw + 10 * u + i * 13 * u) - (side < 0 ? 7 * u : 0);
        if (Math.abs(x - cx) > W - 8 * u) continue;
        const y = colTop + 6 * u + r * 40 * u;
        if (hash(i + side * 5, r + 3) < 0.2) shade.addRect(Skia.XYWHRect(x, y, 7 * u, 18 * u));
        else win.addRRect(Skia.RRectXY(Skia.XYWHRect(x, y, 7 * u, 18 * u), 3.5 * u, 3.5 * u));
      }
  for (let i = 0; i < 9; i += 1) {
    const x = cx - W * 0.56 + i * ((W * 1.12) / 9) + 3 * u;
    win.addRect(Skia.XYWHRect(x, facadeTop + 18 * u, 6 * u, 8 * u));
  }
  // basamaklar
  for (let i = 0; i < 4; i += 1) {
    const w = pw + 14 * u + i * 6 * u;
    step.addRect(Skia.XYWHRect(cx - w, colBase + i * 3.5 * u, w * 2, 3.5 * u));
  }
  // ağaçlar + fenerler
  const trees = Skia.Path.Make();
  [
    [cx - W - 22 * k, 70],
    [cx + W + 24 * k, 76],
    [width * 0.02, 60],
    [width * 0.99, 58],
  ].forEach(([x, h], i) => addRoundTree(trees, x, plazaY, h * k, i + 11));
  const posts = Skia.Path.Make();
  const lamps = [];
  [cx - W - 54 * k, cx - W + 4 * k, cx + W - 4 * k, cx + W + 54 * k].forEach((x) => {
    if (x < 0 || x > width) return;
    posts.addRect(Skia.XYWHRect(x - 1.2 * k, plazaY - 46 * k, 2.4 * k, 46 * k));
    posts.addRRect(Skia.RRectXY(Skia.XYWHRect(x - 3.4 * k, plazaY - 54 * k, 6.8 * k, 9 * k), 2 * k, 2 * k));
    lamps.push([x, plazaY - 50 * k]);
  });
  return { build, shade, column, ped, win, step, trees, posts, lamps, pw };
}

/** Polis aracı (yan; taban y = 0) + ışık çubuğu yuvaları. */
const CAR =
  "M -24 -3 Q -25 -9 -18 -10 L -10 -10 L -5 -17 L 9 -17 L 14 -10 L 22 -9 Q 26 -8 25 -3 Z M -14 -3 m -4.4 0 a 4.4 4.4 0 1 0 8.8 0 a 4.4 4.4 0 1 0 -8.8 0 M 15 -3 m -4.4 0 a 4.4 4.4 0 1 0 8.8 0 a 4.4 4.4 0 1 0 -8.8 0";

function PoliceCar({ clock, x, y, k, flip, c }) {
  const blue = useDerivedValue(() => 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(clock.value * 3.6 + (flip ? 1.5 : 0))));
  const red = useDerivedValue(() => 0.25 + 0.75 * (0.5 - 0.5 * Math.sin(clock.value * 3.6 + (flip ? 1.5 : 0))));
  const s = flip ? -1 : 1;
  return (
    <Group transform={[{ translateX: x }, { translateY: y }, { scaleX: s * k }, { scaleY: k }]}>
      <Group opacity={blue}>
        <Glow cx={-3} cy={-19} r={30} color={c.police1} a={0.55} mid={0.3} />
        <Path path="M -5 -20 L 0 -20 L 0 -17.6 L -5 -17.6 Z" color={c.police1} />
      </Group>
      <Group opacity={red}>
        <Glow cx={5} cy={-19} r={30} color={c.police2} a={0.55} mid={0.3} />
        <Path path="M 1 -20 L 6 -20 L 6 -17.6 L 1 -17.6 Z" color={c.police2} />
      </Group>
      <Path path={CAR} color={c.car} />
    </Group>
  );
}

function Searchlight({ clock, x, y, k, phase, c }) {
  const at = useDerivedValue(() => [{ translateX: x }, { translateY: y }, { rotate: Math.sin(clock.value * 0.22 + phase) * 0.5 }]);
  return (
    <Group transform={at}>
      <Path path={`M ${-5 * k} 0 L ${-46 * k} ${-520 * k} L ${46 * k} ${-520 * k} L ${5 * k} 0 Z`}>
        <LinearGradient start={vec(0, 0)} end={vec(0, -520 * k)} colors={[rgba(c.beamLight, 0.22), rgba(c.beamLight, 0)]} />
      </Path>
    </Group>
  );
}

// ───────────────────────────── A: zeplin + para yağmuru

function blimpX(u, width, k) {
  "worklet";
  return -110 * k + (width + 220 * k) * sm(0.04, 0.8, u);
}

function MoneyRain({ p, clock, L, c }) {
  const { k, width, facadeTop, ground } = L;
  const by = facadeTop - 190 * k;
  const show = useDerivedValue(() => {
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 0) return 0;
    return sm(0.03, 0.07, u) * (1 - sm(0.8, 0.86, u));
  });
  const at = useDerivedValue(() => {
    const u = Math.min(1, restU(p, clock.value));
    return [{ translateX: blimpX(u, width, k) }, { translateY: by + Math.sin(clock.value * 0.8) * 4 * k }, { scale: k }];
  });
  // kâğıtlar: her biri zeplinin geçtiği yerden, kendi anında bırakılır
  const notes = useDerivedValue(() => {
    const light = Skia.Path.Make();
    const dark = Skia.Path.Make();
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 0) return [light, dark];
    const D = p.period / (p.rest || 1); // olay süresi (sn)
    for (let i = 0; i < 64; i += 1) {
      const u0 = 0.14 + hash(i, 1) * 0.6;
      if (u < u0) continue;
      const tau = (u - u0) * D;
      const x0 = blimpX(u0, width, k) + (hash(i, 2) - 0.5) * 40 * k;
      const y = by + 14 * k + tau * (34 + hash(i, 3) * 26) * k;
      if (y > ground + 30 * k) continue;
      const x = x0 + Math.sin(tau * (1.2 + hash(i, 4)) + i) * 22 * k + tau * 6 * k;
      const a = Math.sin(tau * (1.8 + hash(i, 5) * 1.4) + i * 1.3) * 1.2;
      const flip = Math.cos(tau * (2.6 + hash(i, 6) * 2) + i);
      const w = 8 * k * Math.max(0.15, Math.abs(flip));
      const h = 4 * k;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const q = flip > 0 ? light : dark;
      q.moveTo(x - ca * w + sa * h, y - sa * w - ca * h);
      q.lineTo(x + ca * w + sa * h, y + sa * w - ca * h);
      q.lineTo(x + ca * w - sa * h, y + sa * w + ca * h);
      q.lineTo(x - ca * w - sa * h, y - sa * w + ca * h);
      q.close();
    }
    return [light, dark];
  });
  const noteL = useDerivedValue(() => notes.value[0]);
  const noteD = useDerivedValue(() => notes.value[1]);
  const fallOp = useDerivedValue(() => {
    const u = restU(p, clock.value);
    return u > 1 ? 0 : 1 - sm(0.9, 1, u);
  });
  return (
    <>
      <Group opacity={show}>
        <Group transform={at}>
          {/* zeplin: gövde, kuyruk yüzgeçleri, gondol */}
          <Path path="M -62 0 Q -60 -22 0 -23 Q 58 -22 64 0 Q 58 22 0 23 Q -60 22 -62 0 Z" color={c.blimp} />
          <Path path="M -48 -4 L 56 -4 L 56 4 L -48 4 Z" color={c.blimpDark} opacity={0.35} />
          <Path path="M -54 -6 L -74 -24 L -66 -4 Z M -54 6 L -74 24 L -66 4 Z" color={c.blimpDark} />
          <Path path="M -8 21 L 16 21 L 14 29 L -6 29 Z" color={c.blimpDark} />
          <Path path="M -4 23.4 L 12 23.4 L 11 26 L -3 26 Z" color={c.window} />
        </Group>
      </Group>
      <Group opacity={fallOp}>
        <Path path={noteL} color={c.note} />
        <Path path={noteD} color={c.noteDark} />
      </Group>
    </>
  );
}

// ───────────────────────────── B: maskeli siluetler (revakta, sütun aralarında)

const FIG_BODY = "M -6 0 L -6.6 -20 Q -6 -27 0 -27.4 Q 6 -27 6.6 -20 L 6 0 Z";
const HOOD = "M -5.6 -27 Q -6 -37 0 -37.6 Q 6 -37 5.6 -27 Z";
const MASK_FACE = "M 0 -35.4 Q 4.4 -35.2 4.2 -30.6 Q 3.8 -26.4 0 -26 Q -3.8 -26.4 -4.2 -30.6 Q -4.4 -35.2 0 -35.4 Z";
// kaşlar, gözler, kıvrık bıyık (ince mürekkep)
const MASK_INK =
  "M -3.2 -32.6 Q -2 -33.6 -0.8 -32.8 M 0.8 -32.8 Q 2 -33.6 3.2 -32.6 M -2 -31.2 m -0.6 0 a 0.6 0.5 0 1 0 1.2 0 a 0.6 0.5 0 1 0 -1.2 0 M 2 -31.2 m -0.6 0 a 0.6 0.5 0 1 0 1.2 0 a 0.6 0.5 0 1 0 -1.2 0 M 0 -29 Q -2.4 -29.4 -3.4 -31 M 0 -29 Q 2.4 -29.4 3.4 -31 M -1.2 -27.6 Q 0 -27 1.2 -27.6";

function MaskedFigure({ p, clock, L, j, x, c }) {
  const { u: s, colBase } = L;
  const show = useDerivedValue(() => {
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 1) return 0;
    const a = 0.1 + j * 0.06;
    const b = 0.72 + j * 0.03;
    return sm(a, a + 0.05, u) * (1 - sm(b, b + 0.05, u));
  });
  const arm = useDerivedValue(() => {
    const u = Math.min(1, restU(p, clock.value));
    const up = sm(0.46, 0.52, u) * (1 - sm(0.64, 0.7, u));
    const q = Skia.Path.Make();
    const side = j % 2 === 0 ? 1 : -1;
    q.moveTo(side * 5.4, -22);
    q.lineTo(side * (7.6 + up * 0.4), -14 - up * 18);
    q.lineTo(side * (7.4 + up * 0.2), -8 - up * 32);
    return q;
  });
  const fist = useDerivedValue(() => {
    const u = Math.min(1, restU(p, clock.value));
    const up = sm(0.46, 0.52, u) * (1 - sm(0.64, 0.7, u));
    const side = j % 2 === 0 ? 1 : -1;
    const q = Skia.Path.Make();
    if (up > 0.5) q.addCircle(side * 7.6, -41, 2.2);
    return q;
  });
  return (
    <Group opacity={show}>
      <Group transform={[{ translateX: x }, { translateY: colBase - 4 * s }, { scale: s * 1.25 }]}>
        <Path path={arm} style="stroke" strokeWidth={3} strokeCap="round" strokeJoin="round" color={c.suit} />
        <Path path={fist} color={c.suitShade} />
        <Path path={FIG_BODY} color={c.suit} />
        <Path path="M -0.6 -26 L 0.6 -26 L 0.6 -2 L -0.6 -2 Z" color={c.suitShade} />
        <Path path={HOOD} color={c.suitShade} />
        <Path path={MASK_FACE} color={c.mask} />
        <Path path={MASK_INK} style="stroke" strokeWidth={0.6} strokeCap="round" color={c.maskInk} />
      </Group>
    </Group>
  );
}

export default function MoneyHeistScene({ p, clock, width, height, tone, lightSurface }) {
  const L = useMemo(() => mhLayout(width, height), [width, height]);
  const fac = useMemo(() => buildFacade(L), [L]);
  const c = useMemo(() => toneMap(MH_TONE, tone.colors), [tone]);
  const { k, cx, plazaY, colTop, colBase, u: s, facadeTop } = L;
  const night = !lightSurface;
  const pw = fac.pw;
  // sütun aralarının ortaları (6 siluet)
  const figX = useMemo(() => {
    const out = [];
    // 7 aralıktan ortadaki (kapı ekseni) boş kalır
    [0, 1, 2, 4, 5, 6].slice(0, FIGS).forEach((g) => {
      out.push(cx - pw + 8 * s + ((g + 0.5) * (pw * 2 - 16 * s)) / (COLS - 1));
    });
    return out;
  }, [cx, pw, s]);
  const flood = useDerivedValue(() => (night ? 0.42 : 0.28) + Math.sin(clock.value * 0.5) * 0.04);
  return (
    <Group opacity={tone.alpha}>
      <Searchlight clock={clock} x={cx - L.W * 0.7} y={facadeTop + 10 * s} k={k} phase={0} c={c} />
      <Searchlight clock={clock} x={cx + L.W * 0.7} y={facadeTop + 10 * s} k={k} phase={2.2} c={c} />
      <MoneyRain p={p} clock={clock} L={L} c={c} />
      <Path path={fac.trees} color={c.tree} />
      <Path path={fac.build} color={c.build} />
      <Path path={fac.ped} color={c.pediment} />
      <Path path={fac.shade} color={c.buildShade} />
      <Path path={fac.win} color={c.window} opacity={night ? 0.85 : 0.6} />
      {figX.map((x, j) => (
        <MaskedFigure key={j} p={p} clock={clock} L={L} j={j} x={x} c={c} />
      ))}
      <Path path={fac.column} color={c.column} />
      <Path path={fac.step} color={c.step} />
      {/* kırmızı projektörler: cepheyi alttan boyar */}
      <Group opacity={flood}>
        <Rect x={cx - L.W} y={colTop - 50 * s} width={L.W * 2} height={colBase - colTop + 50 * s}>
          <LinearGradient start={vec(0, colBase)} end={vec(0, colTop - 50 * s)} colors={[rgba(c.floodRed, 0.7), rgba(c.floodRed, 0)]} />
        </Rect>
      </Group>
      <Path path={fac.posts} color={c.lampPost} />
      {fac.lamps.map(([x, y], i) => (
        <Group key={i} transform={[{ translateX: x }, { translateY: y }]}>
          <Glow r={22 * k} color={c.lamp} a={night ? 0.6 : 0.35} mid={0.3} />
        </Group>
      ))}
      <Rect x={0} y={plazaY} width={width} height={L.height - plazaY} color={c.street} />
      <PoliceCar clock={clock} x={width * 0.12} y={L.ground - 4 * k} k={k} flip={false} c={c} />
      <PoliceCar clock={clock} x={width * 0.88} y={L.ground - 4 * k} k={k} flip c={c} />
    </Group>
  );
}
