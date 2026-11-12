// components/decor/rainScene.js
//
// Yağmur (OVERLAY.rain = 42) ve fırtına (OVERLAY.storm = 43) atmosfer sahnesi — tamamı VEKTÖR;
// yağmur çizgileri ve şimşek (parçacık / BoltLayer) önünde:
//   • Üstte üç kat, farklı hızlarda kayan bulut tabanı (fırtınada daha koyu ve hızlı; bulutların
//     içinden rastgele çakan ışık).
//   • Ufukta pus içinde şehir silüeti ve yanıp sönen sıcak pencereler; solda yapraklı ağaç
//     (fırtınada rüzgârla eğilir).
//   • Islak sokak: pencerelerin ve lambanın titreşen yansımaları, su birikintilerinde genişleyen
//     yağmur halkaları, yere çarpan damla taçları; sağda sokak lambası ve ışık konisinde parlayan
//     yağmur çizgileri.
//   • Olay: şemsiyeli yaya soldan sağa yürür (yansıması ıslak zeminde). Fırtınada ortada sert bir
//     rüzgâr şemsiyesini ters çevirir, yaya sendeleyip öyle devam eder.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[42] / [43] (RAIN_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import {
  Circle,
  Group,
  LinearGradient,
  Oval,
  Path,
  Rect,
  Skia,
  vec,
} from "@shopify/react-native-skia";
import { OVERLAY, RAIN_SLANT, restU } from "../../utils/weatherParticles";
import { Glow, TAU, groundLayout, hash, rgba, sm, toneMap } from "./seasonKit";

export const RAIN_TONE = [
  "cloud",
  "cloudDark",
  "cloudLit",
  "city",
  "cityWin",
  "street",
  "streetWet",
  "reflect",
  "lamp",
  "lampLight",
  "puddle",
  "ripple",
  "coat",
  "umbrella",
  "tree",
  "flash",
];

export function rainLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  return {
    ...L,
    street: ground - 4 * k,
    lamp: [width * 0.78, ground + 4 * k, 156 * k],
    tree: [width * 0.1, ground],
  };
}

function buildRain(L, storm) {
  const { k, width, height, ground } = L;
  // bulut bantları (2W genişlik; yatay kayıp W'de sarar). Taban y = 0, yukarı kabarır.
  const bands = [0, 1, 2].map((b) => {
    const q = Skia.Path.Make();
    const n = 14;
    for (let i = 0; i < n * 2; i += 1) {
      const j = i % n;
      const x = ((i + 0.5) * width) / n;
      const r = (26 + hash(j, b + 1) * 44 + b * 6) * k * (storm ? 1.15 : 1);
      q.addCircle(
        x + (hash(j, b + 3) - 0.5) * 20 * k,
        -r * 0.5 + hash(j, b + 7) * 22 * k,
        r,
      );
    }
    q.addRect(Skia.XYWHRect(0, -height, width * 2, height));
    return q;
  });
  // şehir
  const city = Skia.Path.Make();
  const wins = Skia.Path.Make();
  const winsOff = Skia.Path.Make();
  const reflections = [];
  let x = -6 * k;
  let i = 0;
  while (x < width) {
    const w = (26 + hash(i, 1) * 34) * k;
    const h =
      (46 + hash(i, 2) * 110) *
      k *
      (x > width * 0.62 && x < width * 0.9 ? 0.55 : 1);
    const top = ground - 22 * k - h;
    city.addRect(Skia.XYWHRect(x, top, w - 2 * k, h + 24 * k));
    if (hash(i, 3) > 0.6)
      city.addRect(Skia.XYWHRect(x + w * 0.4, top - 12 * k, 2 * k, 12 * k));
    for (let yy = top + 8 * k; yy < ground - 30 * k; yy += 11 * k) {
      for (let xx = x + 5 * k; xx < x + w - 8 * k; xx += 8 * k) {
        const r = hash(Math.round(xx), Math.round(yy));
        if (r > 0.78) {
          wins.addRect(Skia.XYWHRect(xx, yy, 3.4 * k, 4.6 * k));
          if (r > 0.95 && reflections.length < 10)
            reflections.push([xx + 1.7 * k, (r - 0.95) * 20]);
        } else if (r > 0.74)
          winsOff.addRect(Skia.XYWHRect(xx, yy, 3.4 * k, 4.6 * k));
      }
    }
    x += w;
    i += 1;
  }
  // sokak: birikintiler
  const puddles = [0.22, 0.48, 0.66, 0.92].map((f, j) => [
    width * f,
    L.street + (14 + hash(j, 4) * 26) * k,
    (34 + hash(j, 5) * 26) * k,
  ]);
  // ağaç
  const [tx, tb] = L.tree;
  const tree = Skia.Path.Make();
  tree.addRect(Skia.XYWHRect(tx - 4 * k, tb - 70 * k, 8 * k, 74 * k));
  const crown = Skia.Path.Make();
  for (let j = 0; j < 9; j += 1) {
    const a = (j / 9) * TAU;
    crown.addCircle(
      tx + Math.cos(a) * 26 * k,
      tb - 104 * k + Math.sin(a) * 20 * k,
      (20 + hash(j, 6) * 8) * k,
    );
  }
  crown.addCircle(tx, tb - 104 * k, 30 * k);
  // lamba
  const [lx, lb, lh] = L.lamp;
  const lamp = Skia.Path.Make();
  lamp.addRect(Skia.XYWHRect(lx - 2 * k, lb - lh, 4 * k, lh));
  lamp.addRect(Skia.XYWHRect(lx - 5 * k, lb - 12 * k, 10 * k, 12 * k));
  lamp.moveTo(lx, lb - lh);
  lamp.quadTo(lx, lb - lh - 16 * k, lx - 22 * k, lb - lh - 14 * k);
  lamp.lineTo(lx - 22 * k, lb - lh - 11 * k);
  lamp.quadTo(lx - 3 * k, lb - lh - 13 * k, lx - 2 * k, lb - lh);
  lamp.close();
  const head = [lx - 24 * k, lb - lh - 6 * k];
  lamp.moveTo(head[0] - 9 * k, head[1]);
  lamp.lineTo(head[0] + 9 * k, head[1]);
  lamp.lineTo(head[0] + 5 * k, head[1] - 8 * k);
  lamp.lineTo(head[0] - 5 * k, head[1] - 8 * k);
  lamp.close();
  const cone = Skia.Path.Make();
  cone.moveTo(head[0] - 6 * k, head[1]);
  cone.lineTo(head[0] + 6 * k, head[1]);
  cone.lineTo(head[0] + 62 * k, L.street + 20 * k);
  cone.lineTo(head[0] - 62 * k, L.street + 20 * k);
  cone.close();
  return {
    bands,
    city,
    wins,
    winsOff,
    reflections,
    puddles,
    tree,
    crown,
    lamp,
    head,
    cone,
  };
}

// ── Bulut bandı ──────────────────────────────────────────────────────────────
function CloudBand({ clock, path, b, L, c, storm }) {
  const { k, width, height } = L;
  const transform = useDerivedValue(() => {
    const sp = (3 + b * 3) * k * (storm ? 2.6 : 1);
    const x = -(((clock.value * sp) % width) + width) % width;
    return [{ translateX: x }, { translateY: height * (0.04 + b * 0.06) }];
  });
  const top = -60 * k;
  const cols =
    b === 0
      ? [c.cloud, c.cloud]
      : b === 1
        ? [c.cloud, c.cloudDark]
        : [c.cloudDark, c.cloudDark];
  return (
    <Group transform={transform} opacity={b === 0 ? 0.75 : 0.92}>
      <Path path={path}>
        <LinearGradient
          start={vec(0, top)}
          end={vec(0, 30 * k)}
          colors={cols}
        />
      </Path>
    </Group>
  );
}

// fırtına: bulut içinde çakan ışık (3,7 sn'lik yuvalar, yuvaların ~yarısında)
function cloudFlash(t, i) {
  "worklet";
  const slot = Math.floor(t / 3.7 + i * 0.37);
  if (hash(slot, 40 + i) > 0.5) return 0;
  const f = t / 3.7 + i * 0.37 - slot;
  const a = f < 0.04 ? f / 0.04 : Math.exp(-(f - 0.04) * 14);
  const b =
    f > 0.12 && f < 0.2 ? 0.7 * Math.sin(((f - 0.12) / 0.08) * Math.PI) : 0;
  return Math.max(a, b);
}

function CloudFlash({ clock, i, L, c }) {
  const { k, width, height } = L;
  const opacity = useDerivedValue(() => cloudFlash(clock.value, i) * 0.85);
  const transform = useDerivedValue(() => {
    const slot = Math.floor(clock.value / 3.7 + i * 0.37);
    return [
      { translateX: width * (0.1 + hash(slot, 50 + i) * 0.8) },
      { translateY: height * (0.04 + hash(slot, 60 + i) * 0.12) },
    ];
  });
  return (
    <Group opacity={opacity} transform={transform}>
      <Glow r={110 * k} color={c.cloudLit} a={0.9} mid={0.5} />
    </Group>
  );
}

// ── Birikinti halkaları ──────────────────────────────────────────────────────
function Ripple({ clock, q, j, c, k }) {
  const [x, y, w] = q;
  const transform = useDerivedValue(() => {
    const f = (clock.value * 0.9 + hash(j, 7)) % 1;
    const dx =
      (hash(Math.floor(clock.value * 0.9 + hash(j, 7)), j) - 0.5) * w * 0.6;
    return [
      { translateX: x + dx },
      { translateY: y },
      { scaleX: 0.15 + f },
      { scaleY: (0.15 + f) * 0.3 },
    ];
  });
  const opacity = useDerivedValue(() => {
    const f = (clock.value * 0.9 + hash(j, 7)) % 1;
    return (1 - f) * 0.7;
  });
  return (
    <Group transform={transform} opacity={opacity}>
      <Circle
        cx={0}
        cy={0}
        r={w * 0.3}
        style="stroke"
        strokeWidth={1.4 * k}
        color={c.ripple}
      />
    </Group>
  );
}

// ── Yere çarpan damlalar (taçlar) ───────────────────────────────────────────
function Splashes({ clock, L, c, storm }) {
  const { k, width, street, height } = L;
  const path = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const t = clock.value;
    const n = storm ? 26 : 18;
    for (let i = 0; i < n; i += 1) {
      const rate = 1.6 + hash(i, 1);
      const cyc = t * rate + hash(i, 2);
      const slot = Math.floor(cyc);
      const f = cyc - slot;
      if (f > 0.35) continue;
      const g = f / 0.35;
      const x = hash(slot, i + 3) * width;
      const y =
        street + 6 * k + hash(slot, i + 9) * (height - street - 30 * k) * 0.6;
      const r = (3 + g * 5) * k;
      for (let j = 0; j < 5; j += 1) {
        const a = -Math.PI * (0.15 + (0.7 * j) / 4);
        q.moveTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5);
        q.lineTo(
          x + Math.cos(a) * r,
          y + Math.sin(a) * r - 2 * k * Math.sin(g * Math.PI),
        );
      }
    }
    return q;
  });
  return (
    <Path
      path={path}
      style="stroke"
      strokeWidth={1 * k}
      strokeCap="round"
      color={c.ripple}
      opacity={0.6}
    />
  );
}

// ── Lamba konisinde parlayan yağmur ──────────────────────────────────────────
function ConeRain({ clock, geo, L, c, storm }) {
  const { k, street } = L;
  const [hx, hy] = geo.head;
  const path = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const t = clock.value;
    const H = street + 20 * k - hy;
    const slant = storm ? RAIN_SLANT * 2 : RAIN_SLANT;
    for (let i = 0; i < 26; i += 1) {
      const sp = (420 + hash(i, 1) * 180) * k;
      const y = hy + ((hash(i, 2) * H + t * sp) % H);
      const x = hx + (hash(i, 3) - 0.5) * 130 * k + (y - hy) * slant;
      q.moveTo(x, y);
      q.lineTo(x + 16 * k * slant, y + 16 * k);
    }
    return q;
  });
  return (
    <Group clip={geo.cone}>
      <Path
        path={path}
        style="stroke"
        strokeWidth={1.3 * k}
        strokeCap="round"
        color={c.lampLight}
        opacity={0.8}
      />
    </Group>
  );
}

// ── Şemsiyeli yaya (olay) ───────────────────────────────────────────────────
function walkerState(p, t, width, k, storm) {
  "worklet";
  const u = restU(p, t);
  if (u > 1) return { on: 0, x: -999, step: 0, flip: 0, lean: 0, stop: 0 };
  const stop = storm ? sm(0.44, 0.48, u) * (1 - sm(0.56, 0.6, u)) : 0;
  // yürüyüş: durakta x sabit
  const a = 0.04;
  const b = 0.96;
  const pause = storm ? 0.1 : 0;
  const w = (u - a) / (b - a - pause);
  let f = w;
  if (storm && u > 0.48)
    f =
      u < 0.58
        ? (0.48 - a) / (b - a - pause)
        : (u - a - pause) / (b - a - pause);
  const x = -40 * k + (f < 0 ? 0 : f > 1 ? 1 : f) * (width + 80 * k);
  const flip = storm ? sm(0.45, 0.49, u) : 0;
  const lean = storm ? Math.sin(sm(0.44, 0.6, u) * Math.PI) * 0.18 : 0;
  return { on: u > a && u < b ? 1 : 0, x, step: t * 6.5, flip, lean, stop };
}

function Leg({ s, phase, color }) {
  const transform = useDerivedValue(() => {
    const q = s.value;
    return [
      { translateX: 0 },
      { translateY: -30 },
      { rotate: Math.sin(q.step + phase) * 0.45 * (1 - q.stop) },
    ];
  });
  return (
    <Group transform={transform}>
      <Rect x={-2.2} y={0} width={4.4} height={29} color={color} />
      <Rect x={-2.2} y={26} width={7} height={3.4} color={color} />
    </Group>
  );
}

function WalkerFigure({ s, c, gust }) {
  const umb = useDerivedValue(() => {
    const q = s.value;
    // ters dönüş: kubbe dikeyde aynalanır (1 → −1), rüzgârla hafif sallanır
    // tepe noktası etrafında: ters dönünce kubbe sapın ucundan YUKARI açılan bir çanağa döner
    return [
      { translateX: 9 },
      { translateY: -114 },
      { rotate: gust ? Math.sin(q.step * 1.7) * 0.08 * q.flip : 0 },
      { scaleY: 1 - 1.7 * q.flip },
      { translateY: 26 },
    ];
  });
  const body = useDerivedValue(() => [{ rotate: -s.value.lean }]);
  return (
    <Group transform={body}>
      <Leg s={s} phase={0} color={c.coat} />
      <Leg s={s} phase={Math.PI} color={c.coat} />
      <Path
        path="M-8 -30 L8 -30 L6 -56 C4 -59 -4 -59 -6 -56 Z"
        color={c.coat}
      />
      <Circle cx={1} cy={-64} r={6.4} color={c.coat} />
      <Path
        path="M3 -53 L9 -62"
        style="stroke"
        strokeWidth={3.2}
        strokeCap="round"
        color={c.coat}
      />
      <Path
        path="M9 -62 L9 -114"
        style="stroke"
        strokeWidth={1.4}
        color={c.lamp}
      />
      <Group transform={umb}>
        <Path
          path="M-28 0 C-26 -18 -12 -26 0 -26 C12 -26 26 -18 28 0 Q21 -4 14 0 Q7 -4 0 0 Q-7 -4 -14 0 Q-21 -4 -28 0 Z"
          color={c.umbrella}
        />
        <Path
          path="M0 -26 L0 -30 M-14 0 Q-12 -18 0 -26 M14 0 Q12 -18 0 -26"
          style="stroke"
          strokeWidth={1}
          color={rgba("#000000", 0.3)}
        />
      </Group>
    </Group>
  );
}

function Walker({ p, clock, L, c, storm }) {
  const { k, width, street } = L;
  const s = useDerivedValue(() => walkerState(p, clock.value, width, k, storm));
  const y = street + 16 * k;
  const transform = useDerivedValue(() => {
    const q = s.value;
    const bob = Math.abs(Math.sin(q.step)) * 1.4 * (1 - q.stop);
    return [{ translateX: q.x }, { translateY: y - bob * k }, { scale: k }];
  });
  const mirror = useDerivedValue(() => {
    const q = s.value;
    return [
      { translateX: q.x },
      { translateY: y + 2 * k },
      { scaleX: k },
      { scaleY: -k * 0.8 },
    ];
  });
  const opacity = useDerivedValue(() => s.value.on);
  return (
    <Group opacity={opacity}>
      <Group transform={mirror} opacity={0.22}>
        <WalkerFigure s={s} c={c} gust={storm} />
      </Group>
      <Group transform={transform}>
        <WalkerFigure s={s} c={c} gust={storm} />
      </Group>
    </Group>
  );
}

function Reflection({ clock, x, y0, len, color, k, i }) {
  const transform = useDerivedValue(() => [
    { translateX: x },
    { translateY: y0 },
    { scaleX: 1 + 0.5 * Math.sin(clock.value * 3 + i * 1.3) },
  ]);
  return (
    <Group transform={transform}>
      <Rect x={-2 * k} y={0} width={4 * k} height={len}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, len)}
          colors={[rgba(color, 0.55), rgba(color, 0)]}
        />
      </Rect>
    </Group>
  );
}

export default function RainScene({
  p,
  clock,
  width,
  height,
  tone,
  lightSurface,
}) {
  const storm = p.part === OVERLAY.storm;
  const L = useMemo(() => rainLayout(width, height), [width, height]);
  const geo = useMemo(() => buildRain(L, storm), [L, storm]);
  const c = useMemo(() => toneMap(RAIN_TONE, tone.colors), [tone]);
  const { k, ground, street } = L;
  const night = !lightSurface;
  const [tx, tb] = L.tree;
  const treeSway = useDerivedValue(() => {
    const t = clock.value;
    const gust = storm
      ? 0.09 + 0.06 * Math.sin(t * 0.7) + 0.04 * Math.sin(t * 3.1)
      : 0.015 * Math.sin(t * 0.9);
    return [
      { translateX: tx },
      { translateY: tb },
      { rotate: gust },
      { translateX: -tx },
      { translateY: -tb },
    ];
  });
  const winFlicker = useDerivedValue(
    () => 0.8 + 0.2 * Math.sin(clock.value * 0.7),
  );
  const lampFlicker = useDerivedValue(() => {
    const t = clock.value;
    const dip = storm && hash(Math.floor(t * 2), 77) > 0.9 ? 0.45 : 1;
    return (0.9 + 0.1 * Math.sin(t * 9)) * dip;
  });
  const skyFlash = useDerivedValue(() =>
    storm
      ? Math.max(cloudFlash(clock.value, 0), cloudFlash(clock.value, 1)) * 0.18
      : 0,
  );
  const [hx, hy] = geo.head;
  return (
    <Group opacity={tone.alpha}>
      {/* şehir + pus */}
      <Path path={geo.city} color={c.city} opacity={0.9} />
      <Path path={geo.winsOff} color={rgba("#000000", 0.25)} />
      <Group opacity={winFlicker}>
        <Path path={geo.wins} color={c.cityWin} opacity={night ? 0.9 : 0.75} />
      </Group>
      <Rect x={0} y={ground - 180 * k} width={width} height={180 * k}>
        <LinearGradient
          start={vec(0, ground - 180 * k)}
          end={vec(0, ground)}
          colors={[rgba(c.cloud, 0), rgba(c.cloud, 0.5)]}
        />
      </Rect>
      {/* sokak */}
      <Rect x={0} y={street} width={width} height={height - street}>
        <LinearGradient
          start={vec(0, street)}
          end={vec(0, height)}
          colors={[c.streetWet, c.street]}
        />
      </Rect>
      <Rect
        x={0}
        y={street}
        width={width}
        height={1.6 * k}
        color={rgba(c.ripple, 0.25)}
      />
      {geo.reflections.map(([x, f], i) => (
        // eslint-disable-next-line react/no-array-index-key
        <Reflection
          key={i}
          clock={clock}
          x={x}
          y0={street + 2 * k}
          len={(30 + f * 40) * k}
          color={c.reflect}
          k={k}
          i={i}
        />
      ))}
      {geo.puddles.map(([x, y, w], j) => (
        // eslint-disable-next-line react/no-array-index-key
        <Group key={j}>
          <Oval
            x={x - w}
            y={y - w * 0.16}
            width={w * 2}
            height={w * 0.32}
            color={c.puddle}
          />
          <Ripple clock={clock} q={[x, y, w]} j={j * 3} c={c} k={k} />
          <Ripple clock={clock} q={[x, y, w]} j={j * 3 + 1} c={c} k={k} />
          <Ripple clock={clock} q={[x, y, w]} j={j * 3 + 2} c={c} k={k} />
        </Group>
      ))}
      <Splashes clock={clock} L={L} c={c} storm={storm} />
      {/* ağaç */}
      <Group transform={treeSway}>
        <Path path={geo.tree} color={c.tree} />
        <Path path={geo.crown} color={c.tree} />
      </Group>
      {/* lamba + koni */}
      <Path path={geo.lamp} color={c.lamp} />
      <Group opacity={lampFlicker}>
        <Path path={geo.cone}>
          <LinearGradient
            start={vec(0, hy)}
            end={vec(0, street + 20 * k)}
            colors={[
              rgba(c.lampLight, night ? 0.38 : 0.3),
              rgba(c.lampLight, 0.04),
            ]}
          />
        </Path>
        <Glow
          cx={hx}
          cy={hy + 2 * k}
          r={44 * k}
          color={c.lampLight}
          a={night ? 0.6 : 0.35}
        />
        <Group
          transform={[
            { translateX: hx },
            { translateY: street + 18 * k },
            { scaleY: 0.18 },
          ]}
        >
          <Glow r={70 * k} color={c.lampLight} a={night ? 0.5 : 0.3} />
        </Group>
        <Reflection
          clock={clock}
          x={hx}
          y0={street + 20 * k}
          len={60 * k}
          color={c.lampLight}
          k={k * 1.6}
          i={9}
        />
        <ConeRain clock={clock} geo={geo} L={L} c={c} storm={storm} />
      </Group>
      <Walker p={p} clock={clock} L={L} c={c} storm={storm} />
      {/* bulutlar (en üstte, yağmurun çıktığı yer) */}
      {geo.bands.map((q, b) => (
        // eslint-disable-next-line react/no-array-index-key
        <CloudBand
          key={b}
          clock={clock}
          path={q}
          b={b}
          L={L}
          c={c}
          storm={storm}
        />
      ))}
      <Rect x={0} y={height * 0.15} width={width} height={150 * k}>
        <LinearGradient
          start={vec(0, height * 0.15)}
          end={vec(0, height * 0.15 + 150 * k)}
          colors={[
            rgba(c.cloudDark, night ? 0.55 : 0.35),
            rgba(c.cloudDark, 0),
          ]}
        />
      </Rect>
      {storm ? (
        <>
          <CloudFlash clock={clock} i={0} L={L} c={c} />
          <CloudFlash clock={clock} i={1} L={L} c={c} />
          <Group opacity={skyFlash}>
            <Rect x={0} y={0} width={width} height={height} color={c.flash} />
          </Group>
        </>
      ) : null}
    </Group>
  );
}
