// components/decor/springScene.js
//
// Bahar bahçesi atmosfer sahnesi (OVERLAY.spring = 38) — tamamı VEKTÖR; sakura yaprakları,
// karahindiba tohumları ve kelebekler (parçacık) önünde uçar:
//   • Gök: açık temada ışınlı güneş, koyu temada tepelerin ardında batan sıcak akşam güneşi;
//     yavaşça süzülen kabarık bulutlar.
//   • Arkada yumuşak tepeler ve üstlerinde yuvarlak ağaçlar; sağda pembe çiçek açmış kiraz ağacı
//     (rüzgârda hafif salınır).
//   • Önde rüzgârla dalgalanan çayır: öbek öbek çim yaprakları, laleler ve papatyalar; çiçeklerin
//     arasında dolaşan arı.
//   • Olay (72 sn'de bir ~28 sn): bulutlar kararır, kısa bir bahar yağmuru yağar, sonra tepelerin
//     üstünde gökkuşağı belirip söner.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[38] (SPRING_TONE).

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
import { restU } from "../../utils/weatherParticles";
import {
  Glow,
  TAU,
  addCloud,
  addRoundTree,
  groundLayout,
  hash,
  rgba,
  ridgePath,
  ridgeY,
  sm,
  toneMap,
} from "./seasonKit";

export const SPRING_TONE = [
  "sky",
  "sun",
  "cloud",
  "cloudShade",
  "hillFar",
  "hillNear",
  "grassDark",
  "grassLight",
  "trunk",
  "blossom",
  "blossomDeep",
  "tulipA",
  "tulipB",
  "daisy",
  "center",
  "rain",
];

const RAINBOW = [
  "#ff5a5a",
  "#ff9f40",
  "#ffd84d",
  "#5fd068",
  "#4aa8ff",
  "#5a6cff",
  "#a56bff",
];

export function springLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  return {
    ...L,
    farBase: ground - 84 * k,
    nearBase: ground - 40 * k,
    tree: [width * 0.8, 150 * k],
  };
}

function bladePath(path, x, yb, w, h, bend) {
  path.moveTo(x - w / 2, yb);
  path.quadTo(x - w * 0.15 + bend * 0.45, yb - h * 0.6, x + bend, yb - h);
  path.quadTo(x + w * 0.25 + bend * 0.45, yb - h * 0.55, x + w / 2, yb);
  path.close();
}

function buildSpring(L) {
  const { k, width, height, ground } = L;
  const bottom = height + 20;
  const far = ridgePath(width, L.farBase, 34 * k, 2, 0.7, bottom);
  const near = ridgePath(width, L.nearBase, 22 * k, 3, 2.2, bottom);
  const farTrees = Skia.Path.Make();
  for (let i = 0; i < 16; i += 1) {
    const x = width * (0.02 + i * 0.065) + hash(i, 1) * 10 * k;
    if (x > width * 0.68 && x < width * 0.92) continue;
    addRoundTree(
      farTrees,
      x,
      ridgeY(far.pts, x) + 4 * k,
      (16 + hash(i, 2) * 14) * k,
      i,
    );
  }
  // kiraz ağacı: gövde + dallar (kalın çizgi), taç öbekleri
  const [tx, th] = L.tree;
  const tb = ridgeY(near.pts, tx) + 6 * k;
  const trunk = Skia.Path.Make();
  trunk.moveTo(tx - 7 * k, tb);
  trunk.cubicTo(
    tx - 4 * k,
    tb - th * 0.3,
    tx - 9 * k,
    tb - th * 0.45,
    tx - 3 * k,
    tb - th * 0.6,
  );
  trunk.lineTo(tx + 4 * k, tb - th * 0.6);
  trunk.cubicTo(
    tx + 2 * k,
    tb - th * 0.42,
    tx + 6 * k,
    tb - th * 0.25,
    tx + 8 * k,
    tb,
  );
  trunk.close();
  const branches = Skia.Path.Make();
  const twigs = [
    [0, -0.58, -42, -0.86],
    [0, -0.58, 36, -0.9],
    [0, -0.6, -8, -1],
    [-4, -0.45, -60, -0.62],
    [3, -0.48, 56, -0.66],
  ];
  twigs.forEach(([x0, y0, x1, y1]) => {
    branches.moveTo(tx + x0 * k, tb + th * y0);
    branches.quadTo(
      tx + (x0 + x1) * 0.5 * k,
      tb + th * (y0 + y1) * 0.5 - 10 * k,
      tx + x1 * k,
      tb + th * y1,
    );
  });
  const canopy = [Skia.Path.Make(), Skia.Path.Make(), Skia.Path.Make()];
  for (let i = 0; i < 34; i += 1) {
    const a = hash(i, 3) * TAU;
    const rr = Math.sqrt(hash(i, 4));
    const x = tx + Math.cos(a) * rr * 66 * k;
    const y = tb - th * 0.8 + Math.sin(a) * rr * 34 * k;
    const r = (11 + hash(i, 5) * 10) * k;
    canopy[i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : 2].addCircle(x, y, r);
  }
  const blossoms = Skia.Path.Make();
  for (let i = 0; i < 40; i += 1) {
    const a = hash(i, 6) * TAU;
    const rr = Math.sqrt(hash(i, 7));
    blossoms.addCircle(
      tx + Math.cos(a) * rr * 72 * k,
      tb - th * 0.8 + Math.sin(a) * rr * 38 * k,
      (1.4 + hash(i, 8) * 1.4) * k,
    );
  }
  // yere düşmüş yapraklar
  const fallen = Skia.Path.Make();
  for (let i = 0; i < 22; i += 1) {
    const x = tx + (hash(i, 9) - 0.5) * 130 * k;
    fallen.addOval(
      Skia.XYWHRect(
        x,
        ridgeY(near.pts, x) + (2 + hash(i, 10) * 14) * k,
        3.4 * k,
        2 * k,
      ),
    );
  }
  // çayır öbekleri: yaprak + çiçek (her öbek kendi tabanında salınır)
  const clumps = [];
  const n = Math.max(14, Math.round(width / (22 * k)));
  for (let i = 0; i < n; i += 1) {
    const x = (width * (i + 0.5)) / n + (hash(i, 11) - 0.5) * 12 * k;
    const yb = ground + (2 + hash(i, 12) * 8) * k;
    const dark = Skia.Path.Make();
    const light = Skia.Path.Make();
    for (let j = 0; j < 9; j += 1) {
      const bx = (hash(i * 9 + j, 13) - 0.5) * 22 * k;
      const h = (16 + hash(i * 9 + j, 14) * 26) * k;
      const bend = (hash(i * 9 + j, 15) - 0.5) * 14 * k;
      bladePath(
        j % 2 ? dark : light,
        bx,
        0,
        (2.4 + hash(i, j) * 1.6) * k,
        h,
        bend,
      );
    }
    const kind = hash(i, 16);
    const flower = kind < 0.3 ? "tulip" : kind < 0.62 ? "daisy" : null;
    const fh = (32 + hash(i, 17) * 22) * k;
    const fx = (hash(i, 18) - 0.5) * 10 * k;
    clumps.push({
      x,
      yb,
      dark,
      light,
      flower,
      fh,
      fx,
      tulipCol: hash(i, 19) < 0.55 ? "tulipA" : "tulipB",
      phase: hash(i, 20) * TAU,
    });
  }
  // lale ve papatya başları (yerel)
  const tulip = Skia.Path.Make();
  tulip.moveTo(-5.5 * k, 0);
  tulip.cubicTo(-7 * k, -7 * k, -4.5 * k, -12 * k, -2.5 * k, -11 * k);
  tulip.lineTo(0, -7 * k);
  tulip.lineTo(2.5 * k, -11 * k);
  tulip.cubicTo(4.5 * k, -12 * k, 7 * k, -7 * k, 5.5 * k, 0);
  tulip.quadTo(0, 3.5 * k, -5.5 * k, 0);
  tulip.close();
  const tulipMid = Skia.Path.Make();
  tulipMid.moveTo(-2.4 * k, -1 * k);
  tulipMid.quadTo(0, -15 * k, 2.4 * k, -1 * k);
  tulipMid.close();
  const daisy = Skia.Path.Make();
  for (let j = 0; j < 12; j += 1) {
    const a = (j / 12) * TAU;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const m = 5.8 * k;
    daisy.moveTo(ux * 2 * k, uy * 2 * k);
    daisy.quadTo(
      ux * m - uy * 3.2 * k,
      uy * m + ux * 3.2 * k,
      ux * 9.5 * k,
      uy * 9.5 * k,
    );
    daisy.quadTo(
      ux * m + uy * 3.2 * k,
      uy * m - ux * 3.2 * k,
      ux * 2 * k,
      uy * 2 * k,
    );
    daisy.close();
  }
  const leaf = Skia.Path.Make();
  leaf.moveTo(0, 0);
  leaf.quadTo(7 * k, -4 * k, 10 * k, -12 * k);
  leaf.quadTo(3 * k, -9 * k, 0, 0);
  leaf.close();
  // bulutlar (yerel; tabanı y = 0)
  const clouds = [0, 1, 2].map((i) => {
    const q = Skia.Path.Make();
    addCloud(q, 0, 0, (110 + i * 22) * k, (30 + i * 4) * k, i + 3);
    return q;
  });
  return {
    far,
    near,
    farTrees,
    trunk,
    branches,
    canopy,
    blossoms,
    fallen,
    treeBase: tb,
    clumps,
    tulip,
    tulipMid,
    daisy,
    leaf,
    clouds,
  };
}

// ── Bulut ────────────────────────────────────────────────────────────────────
function Cloud({ p, clock, path, i, width, k, c, top, dim }) {
  const transform = useDerivedValue(() => {
    const span = width + 260 * k;
    const x =
      ((((clock.value * (5 + i * 2.2) * k + i * 0.37 * span) % span) + span) %
        span) -
      130 * k;
    return [{ translateX: x }, { translateY: top }];
  });
  const shade = useDerivedValue(() => {
    const u = restU(p, clock.value);
    return u > 1 ? 0 : 0.75 * sm(0.02, 0.12, u) * (1 - sm(0.42, 0.56, u));
  });
  return (
    <Group transform={transform}>
      <Path path={path}>
        <LinearGradient
          start={vec(0, -40 * k)}
          end={vec(0, 16 * k)}
          colors={[c.cloud, c.cloudShade]}
        />
      </Path>
      <Path path={path} color={dim} opacity={shade} />
    </Group>
  );
}

// ── Yağmur (olay) ────────────────────────────────────────────────────────────
function Shower({ p, clock, width, k, L, c }) {
  const path = useDerivedValue(() => {
    const u = restU(p, clock.value);
    const q = Skia.Path.Make();
    if (u > 1 || u < 0.05 || u > 0.5) return q;
    const t = clock.value;
    const H = L.ground;
    for (let i = 0; i < 70; i += 1) {
      const x0 = hash(i, 31) * (width + 60 * k) - 20 * k;
      const sp = (360 + hash(i, 32) * 160) * k;
      const y = ((hash(i, 33) * H + t * sp) % (H + 40 * k)) - 20 * k;
      const x = x0 - y * 0.12;
      q.moveTo(x, y);
      q.lineTo(x - 2.2 * k, y + 14 * k);
    }
    return q;
  });
  const opacity = useDerivedValue(() => {
    const u = restU(p, clock.value);
    return u > 1 ? 0 : 0.55 * sm(0.05, 0.1, u) * (1 - sm(0.42, 0.5, u));
  });
  return (
    <Path
      path={path}
      style="stroke"
      strokeWidth={1.2 * k}
      strokeCap="round"
      color={c.rain}
      opacity={opacity}
    />
  );
}

function Rainbow({ p, clock, width, k, L }) {
  const opacity = useDerivedValue(() => {
    const u = restU(p, clock.value);
    return u > 1 ? 0 : 0.42 * sm(0.42, 0.56, u) * (1 - sm(0.84, 0.98, u));
  });
  const R = width * 0.62;
  const cx = width * 0.42;
  const cy = L.nearBase + 10 * k;
  return (
    <Group opacity={opacity} clip={Skia.XYWHRect(0, 0, width, cy - 8 * k)}>
      {RAINBOW.map((col, i) => (
        <Circle
          key={col}
          cx={cx}
          cy={cy}
          r={R - i * 5 * k}
          style="stroke"
          strokeWidth={5.2 * k}
          color={col}
        />
      ))}
    </Group>
  );
}

// ── Çayır öbeği ──────────────────────────────────────────────────────────────
function Clump({ p, clock, q, k, c, geo }) {
  const transform = useDerivedValue(() => {
    const t = clock.value;
    const u = restU(p, t);
    const gust = u <= 1 ? 0.05 * sm(0.04, 0.12, u) * (1 - sm(0.4, 0.5, u)) : 0;
    const a =
      0.05 * Math.sin(t * 1.25 - q.x * 0.012 + q.phase * 0.3) +
      0.02 * Math.sin(t * 2.7 + q.phase) +
      gust;
    return [{ translateX: q.x }, { translateY: q.yb }, { rotate: a }];
  });
  const headT = [{ translateX: q.fx }, { translateY: -q.fh }];
  return (
    <Group transform={transform}>
      {q.flower ? (
        <Group>
          <Path
            path={`M0 0 Q ${q.fx * 0.3} ${-q.fh * 0.5} ${q.fx} ${-q.fh}`}
            style="stroke"
            strokeWidth={1.6 * k}
            color={c.grassDark}
          />
          <Group
            transform={[
              { translateX: q.fx * 0.4 },
              { translateY: -q.fh * 0.35 },
            ]}
          >
            <Path path={geo.leaf} color={c.grassLight} />
          </Group>
          <Group transform={headT}>
            {q.flower === "tulip" ? (
              <>
                <Path path={geo.tulip} color={c[q.tulipCol]} />
                <Path path={geo.tulipMid} color={rgba("#000000", 0.12)} />
              </>
            ) : (
              <>
                <Path path={geo.daisy} color={c.daisy} />
                <Circle cx={0} cy={0} r={3 * k} color={c.center} />
              </>
            )}
          </Group>
        </Group>
      ) : null}
      <Path path={q.dark} color={c.grassDark} />
      <Path path={q.light} color={c.grassLight} />
    </Group>
  );
}

// ── Arı ──────────────────────────────────────────────────────────────────────
function Bee({ clock, width, k, L }) {
  const transform = useDerivedValue(() => {
    const t = clock.value;
    const x =
      width * (0.5 + 0.38 * Math.sin(t * 0.21) + 0.06 * Math.sin(t * 1.3));
    const y =
      L.ground - (52 + 18 * Math.sin(t * 0.9) + 6 * Math.sin(t * 4.1)) * k;
    const dir = Math.cos(t * 0.21) >= 0 ? 1 : -1;
    return [
      { translateX: x },
      { translateY: y },
      { scaleX: dir * k },
      { scaleY: k },
    ];
  });
  const wing = useDerivedValue(() => [
    { translateX: -1 },
    { translateY: -3 },
    { scaleY: 0.4 + 0.6 * Math.abs(Math.sin(clock.value * 40)) },
  ]);
  return (
    <Group transform={transform}>
      <Group transform={wing}>
        <Oval
          x={-4}
          y={-6}
          width={6}
          height={7}
          color="rgba(255,255,255,0.75)"
        />
        <Oval x={0} y={-6} width={6} height={7} color="rgba(255,255,255,0.6)" />
      </Group>
      <Oval x={-5} y={-3} width={10} height={6.4} color="#ffc93c" />
      <Rect x={-2.2} y={-3} width={1.6} height={6.4} color="#2a2018" />
      <Rect x={1.2} y={-3} width={1.6} height={6.4} color="#2a2018" />
      <Circle cx={5.5} cy={0} r={2.2} color="#2a2018" />
    </Group>
  );
}

export default function SpringScene({
  p,
  clock,
  width,
  height,
  tone,
  lightSurface,
}) {
  const L = useMemo(() => springLayout(width, height), [width, height]);
  const geo = useMemo(() => buildSpring(L), [L]);
  const c = useMemo(() => toneMap(SPRING_TONE, tone.colors), [tone]);
  const { k, ground } = L;
  const night = !lightSurface;
  const [tx, th] = L.tree;
  const treeSway = useDerivedValue(() => {
    const t = clock.value;
    return [
      { translateX: tx },
      { translateY: geo.treeBase },
      { rotate: 0.012 * Math.sin(t * 0.8) },
      { translateX: -tx },
      { translateY: -geo.treeBase },
    ];
  });
  const sunRays = useDerivedValue(() => [
    { translateX: width * 0.18 },
    { translateY: height * 0.1 },
    { rotate: clock.value * 0.05 },
  ]);
  const sunPos = night
    ? [width * 0.24, L.farBase - 18 * k]
    : [width * 0.18, height * 0.1];
  const rays = useMemo(() => {
    const q = Skia.Path.Make();
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * TAU;
      q.moveTo(Math.cos(a - 0.06) * 34 * k, Math.sin(a - 0.06) * 34 * k);
      q.lineTo(
        Math.cos(a) * (i % 2 ? 58 : 70) * k,
        Math.sin(a) * (i % 2 ? 58 : 70) * k,
      );
      q.lineTo(Math.cos(a + 0.06) * 34 * k, Math.sin(a + 0.06) * 34 * k);
      q.close();
    }
    return q;
  }, [k]);
  const cloudTops = [height * 0.09, height * 0.17, height * 0.25];
  return (
    <Group opacity={tone.alpha}>
      {/* güneş */}
      <Glow
        cx={sunPos[0]}
        cy={sunPos[1]}
        r={(night ? 170 : 120) * k}
        color={night ? c.sun : c.sun}
        a={night ? 0.45 : 0.6}
      />
      {night ? null : (
        <Group transform={sunRays} opacity={0.35}>
          <Path path={rays} color={c.sun} />
        </Group>
      )}
      <Circle cx={sunPos[0]} cy={sunPos[1]} r={26 * k} color={c.sun} />
      {geo.clouds.map((q, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <Cloud
          key={i}
          p={p}
          clock={clock}
          path={q}
          i={i}
          width={width}
          k={k}
          c={c}
          top={cloudTops[i]}
          dim={night ? "rgba(30,26,48,0.85)" : "rgba(108,120,140,0.8)"}
        />
      ))}
      <Rainbow p={p} clock={clock} width={width} k={k} L={L} />
      {/* tepeler */}
      <Path path={geo.far.path} color={c.hillFar} />
      <Path path={geo.farTrees} color={rgba(c.grassDark, night ? 0.7 : 0.45)} />
      <Path path={geo.near.path}>
        <LinearGradient
          start={vec(0, L.nearBase - 30 * k)}
          end={vec(0, ground + 20 * k)}
          colors={[c.hillNear, c.grassDark]}
        />
      </Path>
      {/* kiraz ağacı */}
      <Group transform={treeSway}>
        <Path
          path={geo.branches}
          style="stroke"
          strokeWidth={5 * k}
          strokeCap="round"
          color={c.trunk}
        />
        <Path path={geo.trunk} color={c.trunk} />
        <Path path={geo.canopy[0]} color={c.blossomDeep} />
        <Path path={geo.canopy[1]} color={c.blossom} />
        <Path path={geo.canopy[2]} color={rgba(c.blossom, 0.85)} />
        <Path path={geo.blossoms} color={c.daisy} opacity={0.8} />
      </Group>
      <Path path={geo.fallen} color={c.blossom} />
      {/* ön zemin + çayır */}
      <Rect
        x={0}
        y={ground - 2 * k}
        width={width}
        height={height - ground + 4 * k}
      >
        <LinearGradient
          start={vec(0, ground)}
          end={vec(0, height)}
          colors={[c.grassDark, rgba(c.grassDark, 0.9)]}
        />
      </Rect>
      {geo.clumps.map((q, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <Clump key={i} p={p} clock={clock} q={q} k={k} c={c} geo={geo} />
      ))}
      <Bee clock={clock} width={width} k={k} L={L} />
      <Shower p={p} clock={clock} width={width} k={k} L={L} c={c} />
    </Group>
  );
}
