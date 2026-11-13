// components/decor/jujutsuScene.js
//
// Jujutsu Kaisen evren sahnesi (OVERLAY.jjVec = 70) — tamamı VEKTÖR:
//   • Dolunaylı Tokyo gecesi; solda tepede okulun katlı pagodası ve kırmızı torii kapısı.
//   • Sağda Shibuya: gökdelenler, yanan pencereler, renk değiştiren dev ekranlar.
//   • Binaların arasından bakan lanet gözleri (göz kırpar), yerden yükselen mor lanet enerjisi alevleri.
//   • Olay (70 sn'de bir ~28 sn): Hollow Purple — solda mavi, sağda kırmızı küre belirir, ortada birleşip
//     mor küreye dönüşür, sonra ekranı yatay bir ışın olarak süpürür (parlama), iz yavaşça söner.
//   • Olay B (dönüşümlü): alan genişlemesi — şehrin ortasındaki bir noktadan kara bir küre yayılıp
//     sahneyi yutar; içinde merkeze akan sonsuz ışık çizgileri, kıyısında mor-mavi hale; sonra küre
//     çatlayıp kırılır ve şehir geri gelir.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[70] (JJ_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Group, LinearGradient, Path, Rect, Skia, vec } from "@shopify/react-native-skia";
import { eventU } from "../../utils/weatherParticles";
import { Glow, groundLayout, hash, rgba, sm, toneMap } from "./seasonKit";
import { addFlame } from "./universeKit";

export const JJ_TONE = [
  "moon",
  "moonGlow",
  "haze",
  "bldFar",
  "bld",
  "bldDark",
  "window",
  "screen",
  "screen2",
  "roof",
  "temple",
  "templeDark",
  "torii",
  "ground",
  "curse",
  "curseEye",
  "blue",
  "red",
  "purple",
  "purpleCore",
];

export function jjLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  return { ...L, base: ground - 6 * k, orbY: ground - 360 * k };
}

/** Hollow Purple zaman çizelgesi. */
function hollow(u, width, k) {
  "worklet";
  if (u > 1) return null;
  const grow = sm(0.08, 0.24, u);
  const meet = sm(0.3, 0.46, u);
  const fuse = sm(0.44, 0.5, u);
  const fire = sm(0.56, 0.66, u);
  const fade = sm(0.7, 0.92, u);
  return {
    blueX: width * (0.18 + 0.32 * meet),
    redX: width * (0.82 - 0.32 * meet),
    sep: grow * (1 - fuse),
    purple: fuse * (1 - fire * 0.4) * (1 - fade),
    purpleX: width * 0.5 + fire * (width * 0.7),
    trail: fire * (1 - fade),
    flash: Math.max(0, Math.sin(Math.min(1, Math.max(0, (u - 0.56) / 0.1)) * Math.PI)),
    r: (22 + fuse * 20 + Math.sin(u * 80) * 3 * fuse) * k,
  };
}

// ───────────────────────────── durağan yollar

function buildTemple(L) {
  const { k, width, base } = L;
  const hill = Skia.Path.Make();
  hill.moveTo(-10, base + 10 * k);
  hill.lineTo(-10, base - 90 * k);
  hill.quadTo(width * 0.18, base - 120 * k, width * 0.42, base - 30 * k);
  hill.lineTo(width * 0.5, base + 10 * k);
  hill.close();
  const body = Skia.Path.Make();
  const dark = Skia.Path.Make();
  const roof = Skia.Path.Make();
  const x = width * 0.2;
  let y = base - 104 * k;
  const tiers = [
    [62, 36],
    [52, 32],
    [42, 28],
    [32, 24],
  ];
  tiers.forEach(([w, h], i) => {
    const W = w * k;
    const H = h * k;
    body.addRect(Skia.XYWHRect(x - W * 0.55, y - H, W * 1.1, H));
    for (let j = 0; j < 3; j += 1) dark.addRect(Skia.XYWHRect(x - W * 0.4 + j * W * 0.32, y - H * 0.75, W * 0.16, H * 0.5));
    // kıvrık saçak
    const ry = y - H;
    roof.moveTo(x - W * 1.05, ry - 6 * k);
    roof.quadTo(x - W * 0.7, ry + 2 * k, x - W * 0.5, ry - 8 * k);
    roof.lineTo(x - W * 0.3, ry - 16 * k);
    roof.lineTo(x + W * 0.3, ry - 16 * k);
    roof.lineTo(x + W * 0.5, ry - 8 * k);
    roof.quadTo(x + W * 0.7, ry + 2 * k, x + W * 1.05, ry - 6 * k);
    roof.lineTo(x + W * 0.6, ry + 2 * k);
    roof.lineTo(x - W * 0.6, ry + 2 * k);
    roof.close();
    y -= H + 14 * k;
    if (i === tiers.length - 1) {
      dark.addRect(Skia.XYWHRect(x - 1.2 * k, y - 30 * k, 2.4 * k, 34 * k)); // sorin
      for (let r = 0; r < 5; r += 1) dark.addRect(Skia.XYWHRect(x - 5 * k, y - 26 * k + r * 5 * k, 10 * k, 1.6 * k));
    }
  });
  // torii
  const torii = Skia.Path.Make();
  const tx = width * 0.4;
  const tb = base - 22 * k;
  torii.addRect(Skia.XYWHRect(tx - 26 * k, tb - 80 * k, 6 * k, 80 * k));
  torii.addRect(Skia.XYWHRect(tx + 20 * k, tb - 80 * k, 6 * k, 80 * k));
  torii.addRect(Skia.XYWHRect(tx - 32 * k, tb - 66 * k, 64 * k, 5 * k));
  torii.moveTo(tx - 44 * k, tb - 90 * k);
  torii.quadTo(tx, tb - 82 * k, tx + 44 * k, tb - 90 * k);
  torii.lineTo(tx + 40 * k, tb - 80 * k);
  torii.quadTo(tx, tb - 74 * k, tx - 40 * k, tb - 80 * k);
  torii.close();
  return { hill, body, dark, roof, torii };
}

function buildCity(L) {
  const { k, width, base } = L;
  const far = Skia.Path.Make();
  const near = Skia.Path.Make();
  const dark = Skia.Path.Make();
  const win = Skia.Path.Make();
  const screens = [];
  for (let x = width * 0.4, i = 0; x < width + 20 * k; i += 1) {
    const w = (24 + hash(i, 1) * 26) * k;
    const h = (200 + hash(i, 2) * 220) * k;
    far.addRect(Skia.XYWHRect(x, base - h, w, h));
    x += w + 2 * k;
  }
  const blocks = [
    [0.5, 54, 260],
    [0.64, 64, 330],
    [0.8, 50, 240],
    [0.92, 60, 300],
  ];
  blocks.forEach(([f, w, h], i) => {
    const x = width * f;
    const W = w * k;
    const H = h * k;
    near.addRect(Skia.XYWHRect(x, base - H, W, H));
    dark.addRect(Skia.XYWHRect(x + W * 0.72, base - H, W * 0.28, H));
    near.addRect(Skia.XYWHRect(x + W * 0.4, base - H - 20 * k, 2 * k, 20 * k));
    for (let r = 0; r < Math.floor(H / (12 * k)) - 2; r += 1)
      for (let cI = 0; cI < 4; cI += 1) {
        if (hash(i * 31 + r, cI) < 0.55) continue;
        win.addRect(Skia.XYWHRect(x + 5 * k + cI * (W * 0.17), base - H + 16 * k + r * 12 * k, W * 0.1, 5 * k));
      }
    if (i !== 2) screens.push([x + 4 * k, base - H * (0.55 + hash(i, 5) * 0.2), W * 0.62, 34 * k, i]);
  });
  // sokak: yaya geçidi çizgileri
  const cross = Skia.Path.Make();
  for (let i = 0; i < 12; i += 1) cross.addRect(Skia.XYWHRect(width * 0.48 + i * 16 * k, base + 22 * k, 9 * k, 22 * k));
  return { far, near, dark, win, screens, cross };
}

// ───────────────────────────── canlı parçalar

function Screen({ s, clock, c }) {
  const [x, y, w, h, i] = s;
  const a = useDerivedValue(() => 0.55 + 0.45 * Math.sin(clock.value * (0.7 + i * 0.3) + i));
  const b = useDerivedValue(() => 1 - a.value);
  return (
    <Group>
      <Rect x={x} y={y} width={w} height={h} color={c.screen} opacity={a} />
      <Rect x={x} y={y} width={w} height={h} color={c.screen2} opacity={b} />
      {/* yazısız içerik: yatay bantlar + çerçeve */}
      <Rect x={x + w * 0.08} y={y + h * 0.2} width={w * 0.5} height={h * 0.14} color={c.bldDark} opacity={0.35} />
      <Rect x={x + w * 0.08} y={y + h * 0.45} width={w * 0.78} height={h * 0.1} color={c.bldDark} opacity={0.25} />
      <Rect x={x + w * 0.08} y={y + h * 0.66} width={w * 0.62} height={h * 0.1} color={c.bldDark} opacity={0.25} />
      <Rect x={x} y={y} width={w} height={h} style="stroke" strokeWidth={2} color={c.bldDark} />
    </Group>
  );
}

function CurseEyes({ clock, L, c }) {
  const { k, width, base } = L;
  const spots = useMemo(
    () =>
      [
        [0.6, 60],
        [0.76, 130],
        [0.9, 40],
        [0.47, 90],
      ].map(([f, dy], i) => [width * f, base - dy * k, i]),
    [width, base, k],
  );
  const q = useDerivedValue(() => {
    const path = Skia.Path.Make();
    spots.forEach(([x, y, i]) => {
      const blink = Math.sin(clock.value * (0.5 + i * 0.13) + i * 2);
      if (blink < -0.6) return;
      const open = blink > 0.92 ? 0.2 : 1;
      path.addOval(Skia.XYWHRect(x - 6 * k, y - 1.6 * k * open, 4.4 * k, 3.2 * k * open));
      path.addOval(Skia.XYWHRect(x + 2 * k, y - 1.6 * k * open, 4.4 * k, 3.2 * k * open));
    });
    return path;
  });
  return <Path path={q} color={c.curseEye} />;
}

function CursedFlames({ clock, L, c }) {
  const { k, width, base } = L;
  const q = useDerivedValue(() => {
    const path = Skia.Path.Make();
    for (let i = 0; i < 9; i += 1) {
      const f = (((clock.value * (0.08 + hash(i, 2) * 0.05) + hash(i, 3)) % 1) + 1) % 1;
      const x = width * (0.42 + hash(i, 1) * 0.58) + Math.sin(f * 6 + i) * 10 * k;
      const y = base + 10 * k - f * 140 * k;
      const s = Math.sin(f * Math.PI);
      if (s < 0.05) continue;
      addFlame(path, x, y, 10 * k * s, 26 * k * s, clock.value, i);
    }
    return path;
  });
  return (
    <Group opacity={0.55}>
      <Path path={q} color={c.curse} />
    </Group>
  );
}

function HollowPurple({ p, clock, L, c }) {
  const { k, width, height, orbY } = L;
  const st = useDerivedValue(() => hollow(eventU(p, clock.value, 0), width, k));
  const blueAt = useDerivedValue(() => {
    const s = st.value;
    return s && s.sep > 0.01 ? [{ translateX: s.blueX }, { translateY: orbY }, { scale: s.sep }] : [{ translateX: -900 }, { translateY: -900 }];
  });
  const redAt = useDerivedValue(() => {
    const s = st.value;
    return s && s.sep > 0.01 ? [{ translateX: s.redX }, { translateY: orbY }, { scale: s.sep }] : [{ translateX: -900 }, { translateY: -900 }];
  });
  const purpleAt = useDerivedValue(() => {
    const s = st.value;
    return s && s.purple > 0.01
      ? [{ translateX: s.purpleX }, { translateY: orbY }, { scale: s.r / (40 * k) }]
      : [{ translateX: -900 }, { translateY: -900 }];
  });
  const purpleA = useDerivedValue(() => (st.value ? Math.min(1, st.value.purple) : 0));
  // ışın: çıkış noktasından başa doğru genişleyen, yumuşak kenarlı üç katmanlı kama
  // (eski dikdörtgen degrade sert üst/alt kenar ve ekran dışına taşan blok bırakıyordu)
  const beams = useDerivedValue(() => {
    const out = [Skia.Path.Make(), Skia.Path.Make(), Skia.Path.Make()];
    const s = st.value;
    if (!s || s.trail < 0.01) return out;
    const x0 = width * 0.5;
    const x1 = Math.min(s.purpleX, width + 60 * k);
    const t = clock.value;
    [1, 0.58, 0.24].forEach((f, li) => {
      const q = out[li];
      const h1 = (46 + s.trail * 18) * k * f;
      const h0 = 6 * k * f;
      const n = 12;
      q.moveTo(x0, orbY - h0);
      for (let i = 1; i <= n; i += 1) {
        const g = i / n;
        const x = x0 + (x1 - x0) * g;
        const w = h0 + (h1 - h0) * Math.sqrt(g) + Math.sin(g * 9 - t * 14 + li) * 2.5 * k * f;
        q.lineTo(x, orbY - w);
      }
      q.quadTo(x1 + h1 * 1.3, orbY, x1, orbY + h1);
      for (let i = n; i >= 0; i -= 1) {
        const g = i / n;
        const x = x0 + (x1 - x0) * g;
        const w = h0 + (h1 - h0) * Math.sqrt(g) + Math.sin(g * 7 - t * 12 + li + 2) * 2.5 * k * f;
        q.lineTo(x, orbY + w);
      }
      q.close();
    });
    return out;
  });
  const beam0 = useDerivedValue(() => beams.value[0]);
  const beam1 = useDerivedValue(() => beams.value[1]);
  const beam2 = useDerivedValue(() => beams.value[2]);
  const trailA = useDerivedValue(() => (st.value ? st.value.trail * 0.7 : 0));
  const flashA = useDerivedValue(() => (st.value ? st.value.flash * 0.28 : 0));
  // küre etrafında dönen enerji halkası
  const swirl = useDerivedValue(() => {
    const q = Skia.Path.Make();
    for (let i = 0; i < 3; i += 1) {
      const a = clock.value * 4 + (i / 3) * Math.PI * 2;
      q.addOval(Skia.XYWHRect(-48 * k, -12 * k + Math.sin(a) * 6 * k, 96 * k, 24 * k));
    }
    return q;
  });
  return (
    <Group>
      <Group opacity={trailA}>
        <Path path={beam0}>
          <LinearGradient start={vec(width * 0.5, 0)} end={vec(width, 0)} colors={[rgba(c.purple, 0), rgba(c.purple, 0.35)]} />
        </Path>
        <Path path={beam1}>
          <LinearGradient start={vec(width * 0.5, 0)} end={vec(width, 0)} colors={[rgba(c.purple, 0.1), rgba(c.purple, 0.7)]} />
        </Path>
        <Path path={beam2}>
          <LinearGradient start={vec(width * 0.5, 0)} end={vec(width, 0)} colors={[rgba(c.purpleCore, 0.3), c.purpleCore]} />
        </Path>
      </Group>
      <Group transform={blueAt}>
        <Glow r={60 * k} color={c.blue} a={0.9} mid={0.45} />
        <Glow r={18 * k} color={c.purpleCore} a={1} mid={0.8} />
      </Group>
      <Group transform={redAt}>
        <Glow r={60 * k} color={c.red} a={0.9} mid={0.45} />
        <Glow r={18 * k} color={c.purpleCore} a={1} mid={0.8} />
      </Group>
      <Group transform={purpleAt} opacity={purpleA}>
        <Glow r={110 * k} color={c.purple} a={0.85} mid={0.5} />
        <Glow r={36 * k} color={c.purpleCore} a={1} mid={0.85} />
        <Path path={swirl} style="stroke" strokeWidth={1.4 * k} color={c.purpleCore} opacity={0.6} />
      </Group>
      <Group opacity={flashA}>
        <Rect x={0} y={0} width={width} height={height} color={c.purple} />
      </Group>
    </Group>
  );
}

// ───────────────────────────── olay B: alan genişlemesi

function Domain({ p, clock, L, c }) {
  const { k, width, height, base } = L;
  const cx = width * 0.62;
  const cy = base - 210 * k;
  const RMAX = Math.hypot(Math.max(cx, width - cx), Math.max(cy, height - cy)) + 20 * k;
  const grow = useDerivedValue(() => {
    const u = eventU(p, clock.value, 1);
    return u > 1 ? 0 : sm(0.08, 0.36, u);
  });
  const fade = useDerivedValue(() => {
    const u = eventU(p, clock.value, 1);
    return u > 1 ? 0 : 1 - sm(0.8, 0.92, u);
  });
  const disk = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const r = grow.value * grow.value * RMAX;
    if (r > 0.5) q.addCircle(cx, cy, r);
    return q;
  });
  const streaks = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const r = grow.value * grow.value * RMAX;
    if (r < 2) return q;
    const t = clock.value;
    for (let i = 0; i < 60; i += 1) {
      const a = hash(i, 181) * Math.PI * 2;
      const f = (((t * (0.25 + hash(i, 182) * 0.3) + hash(i, 183)) % 1) + 1) % 1;
      const d0 = (1 - f) * r;
      const d1 = Math.max(0, d0 - (10 + 40 * (1 - f)) * k);
      q.moveTo(cx + Math.cos(a) * d0, cy + Math.sin(a) * d0);
      q.lineTo(cx + Math.cos(a) * d1, cy + Math.sin(a) * d1);
    }
    return q;
  });
  const cracks = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const u = eventU(p, clock.value, 1);
    if (u > 1 || u < 0.7) return q;
    const e = sm(0.7, 0.82, u);
    for (let i = 0; i < 9; i += 1) {
      let a = (i / 9) * Math.PI * 2 + hash(i, 184);
      let x = cx;
      let y = cy;
      q.moveTo(x, y);
      const steps = 6;
      for (let j = 1; j <= steps; j += 1) {
        a += (hash(i, j + 185) - 0.5) * 0.7;
        const d = (RMAX / steps) * e;
        x += Math.cos(a) * d;
        y += Math.sin(a) * d;
        q.lineTo(x, y);
      }
    }
    return q;
  });
  const coreA = useDerivedValue(() => 0.6 + 0.4 * Math.sin(clock.value * 2));
  return (
    <Group opacity={fade}>
      <Path path={disk} color={c.bldDark} opacity={0.94} />
      <Group clip={disk}>
        <Path path={streaks} style="stroke" strokeWidth={1.3 * k} strokeCap="round" color={c.moon} opacity={0.75} />
        <Group transform={[{ translateX: cx }, { translateY: cy }]} opacity={coreA}>
          <Glow r={90 * k} color={c.purple} a={0.6} mid={0.3} />
          <Glow r={26 * k} color={c.purpleCore} a={1} mid={0.6} />
        </Group>
      </Group>
      <Path path={disk} style="stroke" strokeWidth={6 * k} color={c.purple} opacity={0.5} />
      <Path path={disk} style="stroke" strokeWidth={1.6 * k} color={c.blue} />
      <Path path={cracks} style="stroke" strokeWidth={2 * k} strokeJoin="round" color={c.purpleCore} />
    </Group>
  );
}

export default function JujutsuScene({ p, clock, width, height, tone, lightSurface }) {
  const L = useMemo(() => jjLayout(width, height), [width, height]);
  const temple = useMemo(() => buildTemple(L), [L]);
  const city = useMemo(() => buildCity(L), [L]);
  const c = useMemo(() => toneMap(JJ_TONE, tone.colors), [tone]);
  const { k, base } = L;
  const night = !lightSurface;
  const moon = useMemo(() => {
    const q = Skia.Path.Make();
    q.addCircle(width * 0.3, base - 560 * k, 38 * k);
    return q;
  }, [width, base, k]);
  const winA = useDerivedValue(() => (night ? 0.85 : 0.6) + 0.1 * Math.sin(clock.value * 0.8));
  return (
    <Group opacity={tone.alpha}>
      <Group transform={[{ translateX: width * 0.3 }, { translateY: base - 560 * k }]}>
        <Glow r={150 * k} color={c.moonGlow} a={night ? 0.35 : 0.25} mid={0.3} />
      </Group>
      <Path path={moon} color={c.moon} />
      <Rect x={0} y={base - 300 * k} width={width} height={300 * k}>
        <LinearGradient start={vec(0, base - 300 * k)} end={vec(0, base)} colors={[rgba(c.haze, 0), c.haze]} />
      </Rect>
      <Path path={city.far} color={c.bldFar} />
      <Path path={city.near} color={c.bld} />
      <Path path={city.dark} color={c.bldDark} />
      <Group opacity={winA}>
        <Path path={city.win} color={c.window} />
      </Group>
      {city.screens.map((s) => (
        <Screen key={s[4]} s={s} clock={clock} c={c} />
      ))}
      <CurseEyes clock={clock} L={L} c={c} />
      <Rect x={0} y={base} width={width} height={L.height - base + 10} color={c.ground} />
      <Path path={city.cross} color={c.window} opacity={0.25} />
      <Path path={temple.hill} color={c.templeDark} />
      <Path path={temple.body} color={c.temple} />
      <Path path={temple.dark} color={c.templeDark} />
      <Path path={temple.roof} color={c.roof} />
      <Path path={temple.torii} color={c.torii} />
      <CursedFlames clock={clock} L={L} c={c} />
      <HollowPurple p={p} clock={clock} L={L} c={c} />
      <Domain p={p} clock={clock} L={L} c={c} />
    </Group>
  );
}
