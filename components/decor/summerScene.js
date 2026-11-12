// components/decor/summerScene.js
//
// Yaz kıyısı atmosfer sahnesi — iki VEKTÖR katman, aralarında mevcut kıyı (dalga + kum, VectorLayers):
//   • SummerSky (OVERLAY.summerSky = 39, KIYININ ALTINDA): açık temada tepede ışınlı öğle güneşi,
//     koyu temada ufka inen gün batımı güneşi ve sıcak ufuk ışığı; uzun ince bulutlar; ufuk çizgisine
//     kadar açık deniz (ufukta açık, yakında derin), güneşin altında titreşen parıltı sütunu, ufukta
//     palmiyeli ada, yavaşça süzülen yelkenli, uzak dalgacık çizgileri.
//     Olay (66 sn'de bir ~27 sn): üç yunus sırayla denizden sıçrar (yay boyunca döner), girişte ve
//     çıkışta köpük halkası + damlalar; ikinci seri biraz daha yakında.
//   • SummerBeach (OVERLAY.summerBeach = 40, kıyının ÖNÜNDE): soldan eğilen halkalı gövdeli palmiye
//     (yaprakları rüzgârda salınır, hindistan cevizleri), sağda çizgili plaj şemsiyesi + gölgesi,
//     çizgili havlu, deniz yıldızı ve deniz kabuğu.
//
// Kıyı geometrisi weatherParticles.shoreMetrics ile aynı (kum üstü H − 36k, ilk dalga tabanı − 58k).
// Renkler OVERLAY_TONES[39] (SUMMER_SKY_TONE) ve [40] (BEACH_TONE).

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
import { restU, shoreMetrics } from "../../utils/weatherParticles";
import { SCENERY } from "../../utils/weatherUniverses";
import { Glow, TAU, hash, rgba, toneMap } from "./seasonKit";

export const SUMMER_SKY_TONE = [
  "sun",
  "sunGlow",
  "cloud",
  "sea",
  "seaDeep",
  "horizon",
  "glitter",
  "island",
  "boat",
  "sail",
  "dolphin",
];
export const BEACH_TONE = [
  "trunk",
  "trunkDark",
  "frond",
  "frondDark",
  "coconut",
  "umbrellaA",
  "umbrellaB",
  "pole",
  "towelA",
  "towelB",
  "shadow",
  "shell",
];

export function summerLayout(width, height) {
  const m = shoreMetrics(width, height);
  const { k } = m;
  // kıyı sekme çubuğunun üstüne kaldırılır (ParticleField seaLift ile aynı)
  const lift = SCENERY.lift * k;
  const seaTop = m.seaTop - lift;
  const horizon = seaTop - 118 * k;
  return { k, width, height, horizon, seaTop, sandTop: m.sandTop - lift };
}

function buildSky(L, night) {
  const { k, width, horizon, seaTop } = L;
  const sun = night
    ? [width * 0.64, horizon - 26 * k, 34 * k]
    : [width * 0.74, L.height * 0.12, 28 * k];
  // parıltı sütunu: güneşin altında, ufuktan yakına genişleyen kısa çizgiler (3 titreşim grubu)
  const glitter = [Skia.Path.Make(), Skia.Path.Make(), Skia.Path.Make()];
  for (let i = 0; i < 70; i += 1) {
    const f = hash(i, 1);
    const y = horizon + 3 * k + f * f * (seaTop - horizon);
    const spread = (10 + f * 70) * k * (night ? 1 : 1.4);
    const x = sun[0] + (hash(i, 2) - 0.5) * 2 * spread;
    const w = (3 + f * 14) * k * (0.5 + hash(i, 3));
    glitter[i % 3].addRRect(
      Skia.RRectXY(
        Skia.XYWHRect(x - w / 2, y, w, (0.8 + f * 1.4) * k),
        1 * k,
        1 * k,
      ),
    );
  }
  const ripples = Skia.Path.Make();
  for (let i = 0; i < 26; i += 1) {
    const f = hash(i, 4);
    const y = horizon + 6 * k + f * f * (seaTop - horizon - 6 * k);
    const x = hash(i, 5) * width;
    const w = (8 + f * 34) * k;
    ripples.moveTo(x, y);
    ripples.quadTo(x + w / 2, y - 1.2 * k, x + w, y);
  }
  // ada: alçak tümsek + birkaç palmiye silüeti
  const island = Skia.Path.Make();
  const ix = width * 0.14;
  island.moveTo(ix - 70 * k, horizon + 1);
  island.cubicTo(
    ix - 40 * k,
    horizon - 12 * k,
    ix + 10 * k,
    horizon - 20 * k,
    ix + 70 * k,
    horizon + 1,
  );
  island.close();
  [
    [-22, 30],
    [-8, 38],
    [14, 26],
  ].forEach(([dx, h]) => {
    const bx = ix + dx * k;
    const by = horizon - 12 * k;
    island.moveTo(bx - 1 * k, by);
    island.quadTo(bx + 2 * k, by - h * 0.5 * k, bx + 4 * k, by - h * k);
    island.lineTo(bx + 5.5 * k, by - h * k);
    island.quadTo(bx + 3 * k, by - h * 0.5 * k, bx + 1.2 * k, by);
    island.close();
    for (let j = 0; j < 5; j += 1) {
      const a = -Math.PI * (0.1 + j * 0.2);
      const tx = bx + 4.5 * k;
      const ty = by - h * k;
      island.moveTo(tx, ty);
      island.quadTo(
        tx + Math.cos(a) * 8 * k,
        ty + Math.sin(a) * 8 * k - 3 * k,
        tx + Math.cos(a) * 14 * k,
        ty + Math.sin(a) * 14 * k + 4 * k,
      );
      island.quadTo(
        tx + Math.cos(a) * 7 * k,
        ty + Math.sin(a) * 7 * k,
        tx,
        ty + 1.5 * k,
      );
      island.close();
    }
  });
  // ince uzun bulutlar (yerel)
  const clouds = [0, 1, 2].map((i) => {
    const q = Skia.Path.Make();
    const w = (120 + i * 40) * k;
    for (let j = 0; j < 4; j += 1) {
      const x = (hash(i * 4 + j, 6) - 0.5) * w * 0.6;
      const ww = w * (0.4 + hash(i * 4 + j, 7) * 0.5);
      q.addRRect(
        Skia.RRectXY(
          Skia.XYWHRect(
            x - ww / 2,
            j * 5 * k - 6 * k,
            ww,
            (5 + hash(j, i) * 4) * k,
          ),
          4 * k,
          4 * k,
        ),
      );
    }
    return q;
  });
  return { sun, glitter, ripples, island, clouds };
}

// ── Yelkenli ─────────────────────────────────────────────────────────────────
function Sailboat({ clock, L, c }) {
  const { k, width, horizon } = L;
  const transform = useDerivedValue(() => {
    const span = width + 120 * k;
    const x = ((clock.value * 3.2 * k + span * 0.55) % span) - 60 * k;
    const bob = Math.sin(clock.value * 1.4) * 0.8 * k;
    return [
      { translateX: x },
      { translateY: horizon + 6 * k + bob },
      { scale: k },
      { rotate: Math.sin(clock.value * 1.1) * 0.03 },
    ];
  });
  return (
    <Group transform={transform}>
      <Path path="M-14 -3 L14 -3 L10 2 L-11 2 Z" color={c.boat} />
      <Rect x={-0.6} y={-30} width={1.2} height={27} color={c.boat} />
      <Path path="M1 -29 C9 -22 12 -12 13 -5 L1 -5 Z" color={c.sail} />
      <Path
        path="M-1 -26 C-6 -18 -8 -10 -10 -5 L-1 -5 Z"
        color={rgba(c.sail, 0.85)}
      />
      <Path
        path="M-14 3 L14 3"
        style="stroke"
        strokeWidth={0.8}
        color={rgba(c.glitter, 0.6)}
      />
    </Group>
  );
}

// ── Yunus (olay) ─────────────────────────────────────────────────────────────
const DOLPHIN =
  "M-22 2 C-16 -6 -2 -10 10 -8 C16 -7 20 -4 24 -3 L30 -2 C26 0 22 1 18 1 C10 4 -6 5 -16 4 C-19 6 -24 9 -28 8 C-26 5 -25 3 -22 2 Z M-2 -9 C0 -15 3 -18 7 -19 C5 -15 5 -11 6 -8 Z M-28 8 C-31 4 -33 0 -32 -3 C-30 1 -27 3 -24 4 Z";
const BELLY = "M-14 3 C-4 4 8 3 18 1 C10 5 -4 6 -14 3 Z";

function dolphinAt(L, i, u) {
  "worklet";
  const set = i < 3 ? 0 : 1;
  const j = i % 3;
  const start = (set ? 0.52 : 0.08) + j * 0.07;
  const f = (u - start) / 0.16;
  const { k, width, horizon, seaTop } = L;
  const baseY = set ? seaTop - 22 * k : horizon + (seaTop - horizon) * 0.42;
  const s = set ? 1 : 0.72;
  const x0 = width * (set ? 0.26 : 0.38) + j * 30 * k * s;
  return { on: f > 0 && f < 1, f, x0, baseY, s };
}

function Dolphin({ p, clock, L, i, c }) {
  const { k } = L;
  const transform = useDerivedValue(() => {
    const u = restU(p, clock.value);
    const d = dolphinAt(L, i, u > 1 ? -1 : u);
    const f = d.f < 0 ? 0 : d.f > 1 ? 1 : d.f;
    const jump = 58 * k * d.s;
    const run = 80 * k * d.s;
    const x = d.x0 + f * run;
    const y = d.baseY - Math.sin(f * Math.PI) * jump;
    const ang = Math.atan2(-Math.cos(f * Math.PI) * Math.PI * jump, run);
    return [
      { translateX: x },
      { translateY: y },
      { rotate: ang },
      { scale: k * d.s * 0.9 },
    ];
  });
  // su yüzeyinin altında kalan kısmı kes: grup kırpması sahne koordinatında
  const clip = useDerivedValue(() => {
    const u = restU(p, clock.value);
    const d = dolphinAt(L, i, u > 1 ? -1 : u);
    return Skia.XYWHRect(0, 0, L.width, d.baseY + 1 * k);
  });
  const opacity = useDerivedValue(() => {
    const u = restU(p, clock.value);
    return dolphinAt(L, i, u > 1 ? -1 : u).on ? 1 : 0;
  });
  return (
    <Group clip={clip} opacity={opacity}>
      <Group transform={transform}>
        <Path path={DOLPHIN} color={c.dolphin} />
        <Path path={BELLY} color={rgba(c.glitter, 0.55)} />
        <Circle cx={17} cy={-4.5} r={0.9} color={c.seaDeep} />
      </Group>
    </Group>
  );
}

function Splash({ p, clock, L, i, at, c }) {
  const { k } = L;
  const ring = useDerivedValue(() => {
    const u = restU(p, clock.value);
    const d = dolphinAt(L, i, u > 1 ? -1 : u);
    const g = (d.f - at) / 0.35;
    const x = d.x0 + at * 80 * k * d.s;
    return { x, y: d.baseY, g, s: d.s, on: u <= 1 && g > 0 && g < 1 };
  });
  const transform = useDerivedValue(() => {
    const r = ring.value;
    return [
      { translateX: r.x },
      { translateY: r.y },
      { scaleX: (0.4 + r.g * 1.4) * r.s },
      { scaleY: (0.4 + r.g * 1.4) * r.s * 0.28 },
    ];
  });
  const opacity = useDerivedValue(() =>
    ring.value.on ? (1 - ring.value.g) * 0.8 : 0,
  );
  const drops = useDerivedValue(() => {
    const r = ring.value;
    const q = Skia.Path.Make();
    if (!r.on || r.g > 0.6) return q;
    const g = r.g / 0.6;
    for (let j = 0; j < 7; j += 1) {
      const a = -Math.PI * (0.15 + 0.7 * (j / 6));
      const v = (16 + hash(j, i) * 10) * k * r.s;
      q.addCircle(
        r.x + Math.cos(a) * v * g,
        r.y + Math.sin(a) * v * g + 22 * k * g * g * r.s,
        1.2 * k * r.s,
      );
    }
    return q;
  });
  return (
    <Group opacity={opacity}>
      <Group transform={transform}>
        <Circle
          cx={0}
          cy={0}
          r={14 * k}
          style="stroke"
          strokeWidth={2.4 * k}
          color={c.glitter}
        />
      </Group>
      <Path path={drops} color={c.glitter} />
    </Group>
  );
}

function Shimmer({ clock, paths, color }) {
  const o0 = useDerivedValue(
    () => 0.3 + 0.7 * Math.max(0, Math.sin(clock.value * 2.3)),
  );
  const o1 = useDerivedValue(
    () => 0.3 + 0.7 * Math.max(0, Math.sin(clock.value * 1.9 + 2.1)),
  );
  const o2 = useDerivedValue(
    () => 0.3 + 0.7 * Math.max(0, Math.sin(clock.value * 2.7 + 4.2)),
  );
  return (
    <Group>
      <Path path={paths[0]} color={color} opacity={o0} />
      <Path path={paths[1]} color={color} opacity={o1} />
      <Path path={paths[2]} color={color} opacity={o2} />
    </Group>
  );
}

function SkyCloud({ clock, path, i, L, c, night }) {
  const { k, width } = L;
  const transform = useDerivedValue(() => {
    const span = width + 300 * k;
    const x = ((clock.value * (2.2 + i) * k + i * 0.4 * span) % span) - 150 * k;
    return [
      { translateX: x },
      { translateY: L.height * (night ? 0.2 + i * 0.07 : 0.07 + i * 0.08) },
    ];
  });
  return (
    <Group transform={transform} opacity={night ? 0.55 : 0.85}>
      <Path path={path} color={c.cloud} />
    </Group>
  );
}

export function SummerSky({ p, clock, width, height, tone, lightSurface }) {
  const night = !lightSurface;
  const L = useMemo(() => summerLayout(width, height), [width, height]);
  const geo = useMemo(() => buildSky(L, night), [L, night]);
  const c = useMemo(() => toneMap(SUMMER_SKY_TONE, tone.colors), [tone]);
  const { k, horizon } = L;
  const [sx, sy, sr] = geo.sun;
  const rays = useDerivedValue(() => [
    { translateX: sx },
    { translateY: sy },
    { rotate: clock.value * 0.04 },
  ]);
  const rayPath = useMemo(() => {
    const q = Skia.Path.Make();
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * TAU;
      const r1 = sr * 1.35;
      const r2 = sr * (i % 2 ? 2.4 : 3);
      q.moveTo(Math.cos(a - 0.05) * r1, Math.sin(a - 0.05) * r1);
      q.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
      q.lineTo(Math.cos(a + 0.05) * r1, Math.sin(a + 0.05) * r1);
      q.close();
    }
    return q;
  }, [sr]);
  return (
    <Group opacity={tone.alpha}>
      {night ? (
        <Rect x={0} y={horizon - 260 * k} width={width} height={262 * k}>
          <LinearGradient
            start={vec(0, horizon - 260 * k)}
            end={vec(0, horizon)}
            colors={[
              rgba(c.horizon, 0),
              rgba(c.horizon, 0.28),
              rgba(c.sunGlow, 0.5),
            ]}
            positions={[0, 0.6, 1]}
          />
        </Rect>
      ) : null}
      <Glow
        cx={sx}
        cy={sy}
        r={sr * (night ? 6 : 5)}
        color={c.sunGlow}
        a={night ? 0.5 : 0.45}
      />
      {night ? null : (
        <Group transform={rays} opacity={0.3}>
          <Path path={rayPath} color={c.sun} />
        </Group>
      )}
      {geo.clouds.map((q, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <SkyCloud
          key={i}
          clock={clock}
          path={q}
          i={i}
          L={L}
          c={c}
          night={night}
        />
      ))}
      <Circle cx={sx} cy={sy} r={sr} color={c.sun} />
      {/* deniz: güneş ufkun arkasına batar */}
      <Rect x={0} y={horizon} width={width} height={height - horizon}>
        <LinearGradient
          start={vec(0, horizon)}
          end={vec(0, L.seaTop)}
          colors={[c.horizon, c.sea, c.seaDeep]}
          positions={[0, 0.25, 1]}
        />
      </Rect>
      <Rect
        x={0}
        y={horizon - 0.5 * k}
        width={width}
        height={1.2 * k}
        color={rgba(c.glitter, 0.5)}
      />
      <Path
        path={geo.ripples}
        style="stroke"
        strokeWidth={1 * k}
        strokeCap="round"
        color={rgba(c.glitter, 0.28)}
      />
      <Shimmer clock={clock} paths={geo.glitter} color={c.glitter} />
      <Path path={geo.island} color={c.island} />
      <Sailboat clock={clock} L={L} c={c} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Group key={i}>
          <Dolphin p={p} clock={clock} L={L} i={i} c={c} />
          <Splash p={p} clock={clock} L={L} i={i} at={0} c={c} />
          <Splash p={p} clock={clock} L={L} i={i} at={1} c={c} />
        </Group>
      ))}
    </Group>
  );
}

// ── Kumsal önü ───────────────────────────────────────────────────────────────

function buildBeach(L) {
  const { k, width, sandTop } = L;
  // palmiye gövdesi: kıyının solundan sağa-yukarı eğilen kavis, halka halka
  const bx = width * 0.05;
  const by = sandTop + 14 * k;
  const crown = [width * 0.2, sandTop - 250 * k];
  const ctrl = [width * 0.02, sandTop - 150 * k];
  const at = (f) => [
    (1 - f) * (1 - f) * bx + 2 * (1 - f) * f * ctrl[0] + f * f * crown[0],
    (1 - f) * (1 - f) * by + 2 * (1 - f) * f * ctrl[1] + f * f * crown[1],
  ];
  const trunk = Skia.Path.Make();
  const rings = Skia.Path.Make();
  const left = [];
  const right = [];
  const N = 22;
  for (let i = 0; i <= N; i += 1) {
    const f = i / N;
    const [x, y] = at(f);
    const [x2, y2] = at(Math.min(1, f + 0.01));
    const ang = Math.atan2(y2 - y, x2 - x);
    const w = (9 - 4.2 * f) * k;
    const nx = -Math.sin(ang);
    const ny = Math.cos(ang);
    left.push([x + nx * w, y + ny * w]);
    right.push([x - nx * w, y - ny * w]);
    if (i > 0 && i < N) {
      rings.moveTo(x + nx * w, y + ny * w);
      rings.quadTo(
        x + Math.cos(ang) * 3 * k,
        y + Math.sin(ang) * 3 * k,
        x - nx * w,
        y - ny * w,
      );
    }
  }
  trunk.moveTo(left[0][0], left[0][1]);
  left.forEach(([x, y]) => trunk.lineTo(x, y));
  for (let i = right.length - 1; i >= 0; i -= 1)
    trunk.lineTo(right[i][0], right[i][1]);
  trunk.close();
  // yaprak: omurga + iki yanda yaprakçıklar (yerel, kökten +x yönüne)
  const frond = (len, droop, seed) => {
    const q = Skia.Path.Make();
    const pt = (f) => [f * len, droop * f * f * len];
    for (let j = 1; j <= 14; j += 1) {
      const f = j / 15;
      const [x, y] = pt(f);
      const l = (1 - f * 0.6) * len * 0.26 * (0.8 + hash(j, seed) * 0.4);
      for (const s of [-1, 1]) {
        q.moveTo(x - len * 0.03, y);
        q.quadTo(
          x + l * 0.3,
          y + s * l * 0.5,
          x + l * 0.35,
          y + s * l + l * 0.4,
        );
        q.lineTo(x + len * 0.03, y + 1.5 * k);
        q.close();
      }
    }
    const spine = Skia.Path.Make();
    spine.moveTo(0, 0);
    spine.quadTo(len * 0.5, 0, len, droop * len);
    return { leaf: q, spine };
  };
  const fronds = [
    [-2.6, 92, 0.55],
    [-2.1, 100, 0.45],
    [-1.45, 86, 0.3],
    [-0.9, 96, 0.4],
    [-0.35, 104, 0.5],
    [0.25, 92, 0.6],
    [0.8, 80, 0.75],
    [2.9, 70, 0.6],
  ].map(([ang, len, droop], i) => ({
    ang,
    ...frond(len * k, droop, i),
    phase: hash(i, 9) * TAU,
    dark: i % 2 === 0,
  }));
  // şemsiye
  const ux = width * 0.8;
  const uy = sandTop - 104 * k;
  const R = 54 * k;
  const canopy = [Skia.Path.Make(), Skia.Path.Make()];
  const S = 8;
  const apexY = uy - R * 0.55;
  for (let i = 0; i < S; i += 1) {
    const x0 = ux + R * Math.cos(Math.PI - (i / S) * Math.PI);
    const x1 = ux + R * Math.cos(Math.PI - ((i + 1) / S) * Math.PI);
    const q = canopy[i % 2];
    // meridyenler: tepeden kenara çeyrek elips; kenarda fisto
    q.moveTo(ux, apexY);
    q.quadTo(x0, apexY, x0, uy);
    q.quadTo((x0 + x1) / 2, uy + 7 * k, x1, uy);
    q.quadTo(x1, apexY, ux, apexY);
    q.close();
  }
  const towel = [Skia.Path.Make(), Skia.Path.Make()];
  const tx = width * 0.6;
  const ty = sandTop + 8 * k;
  for (let i = 0; i < 6; i += 1) {
    const x0 = tx + i * 10 * k;
    const q = towel[i % 2];
    q.moveTo(x0, ty);
    q.lineTo(x0 + 10 * k, ty);
    q.lineTo(x0 + 10 * k - 9 * k, ty + 18 * k);
    q.lineTo(x0 - 9 * k, ty + 18 * k);
    q.close();
  }
  const star = Skia.Path.Make();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i / 10) * TAU;
    const r = (i % 2 ? 2.6 : 7) * k;
    const x = width * 0.46 + Math.cos(a) * r;
    const y = sandTop + 22 * k + Math.sin(a) * r;
    if (i) star.lineTo(x, y);
    else star.moveTo(x, y);
  }
  star.close();
  const shell = Skia.Path.Make();
  const sx = width * 0.93;
  const sy = sandTop + 24 * k;
  shell.moveTo(sx, sy + 4 * k);
  for (let i = 0; i <= 6; i += 1) {
    const a = Math.PI + (i / 6) * Math.PI;
    shell.lineTo(sx + Math.cos(a) * 8 * k, sy + Math.sin(a) * 7 * k);
  }
  shell.close();
  const shellRib = Skia.Path.Make();
  for (let i = 1; i < 6; i += 1) {
    const a = Math.PI + (i / 6) * Math.PI;
    shellRib.moveTo(sx, sy + 4 * k);
    shellRib.lineTo(sx + Math.cos(a) * 7 * k, sy + Math.sin(a) * 6 * k);
  }
  return {
    trunk,
    rings,
    crown,
    fronds,
    canopy,
    umbrella: [ux, uy, R],
    towel,
    star,
    shell,
    shellRib,
  };
}

function Frond({ clock, f, crown, c, k }) {
  const transform = useDerivedValue(() => {
    const t = clock.value;
    const a =
      f.ang +
      0.05 * Math.sin(t * 1.1 + f.phase) +
      0.03 * Math.sin(t * 2.3 + f.phase * 2);
    return [{ translateX: crown[0] }, { translateY: crown[1] }, { rotate: a }];
  });
  return (
    <Group transform={transform}>
      <Path path={f.leaf} color={f.dark ? c.frondDark : c.frond} />
      <Path
        path={f.spine}
        style="stroke"
        strokeWidth={1.6 * k}
        strokeCap="round"
        color={c.frondDark}
      />
    </Group>
  );
}

export function SummerBeach({ clock, width, height, tone }) {
  const L = useMemo(() => summerLayout(width, height), [width, height]);
  const geo = useMemo(() => buildBeach(L), [L]);
  const c = useMemo(() => toneMap(BEACH_TONE, tone.colors), [tone]);
  const { k, sandTop } = L;
  const [ux, uy, R] = geo.umbrella;
  const [cx, cy] = geo.crown;
  return (
    <Group opacity={tone.alpha}>
      {/* şemsiye gölgesi + havlu */}
      <Oval
        x={ux - R * 1.1}
        y={sandTop + 6 * k}
        width={R * 2}
        height={20 * k}
        color={rgba(c.shadow, 0.16)}
      />
      <Path path={geo.towel[0]} color={c.towelA} />
      <Path path={geo.towel[1]} color={c.towelB} />
      <Path path={geo.star} color={c.umbrellaA} opacity={0.85} />
      <Path path={geo.shell} color={c.shell} />
      <Path
        path={geo.shellRib}
        style="stroke"
        strokeWidth={0.8 * k}
        color={rgba(c.trunkDark, 0.5)}
      />
      {/* şemsiye */}
      <Path
        path={`M${ux} ${uy - R * 0.55} L${ux + 6 * k} ${sandTop + 16 * k}`}
        style="stroke"
        strokeWidth={2.6 * k}
        strokeCap="round"
        color={c.pole}
      />
      <Path path={geo.canopy[0]} color={c.umbrellaA} />
      <Path path={geo.canopy[1]} color={c.umbrellaB} />
      <Circle cx={ux} cy={uy - R * 0.56} r={3 * k} color={c.umbrellaA} />
      {/* palmiye */}
      <Path path={geo.trunk} color={c.trunk} />
      <Path
        path={geo.rings}
        style="stroke"
        strokeWidth={1.4 * k}
        color={c.trunkDark}
      />
      {geo.fronds.slice(0, 4).map((f, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <Frond key={i} clock={clock} f={f} crown={geo.crown} c={c} k={k} />
      ))}
      <Circle cx={cx - 4 * k} cy={cy + 6 * k} r={5 * k} color={c.coconut} />
      <Circle cx={cx + 5 * k} cy={cy + 7 * k} r={5 * k} color={c.coconut} />
      <Circle cx={cx} cy={cy + 12 * k} r={4.6 * k} color={c.coconut} />
      {geo.fronds.slice(4).map((f, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <Frond key={i} clock={clock} f={f} crown={geo.crown} c={c} k={k} />
      ))}
    </Group>
  );
}

export default SummerSky;
