// components/decor/autumnScene.js
//
// Sonbahar (yaprak) atmosfer sahnesi (OVERLAY.autumn = 41) — tamamı VEKTÖR; düşen yapraklar
// (parçacık) önünde:
//   • Alçak, sıcak akşam güneşi ve ufuk ışığı; arkada pus içinde turuncu-kızıl ağaçlı tepeler.
//   • Solda büyük yaşlı ağaç: kalın gövde, dallar, kızıl-turuncu-sarı taç öbekleri (arada çıplak
//     dallar görünür), rüzgârda salınır; dibinde yaprak yığını.
//   • Yere serilmiş yaprak halısı, tepeye kıvrılan patika, sağda park bankı ve sıcak ışıklı lamba.
//   • Olay (66 sn'de bir ~25 sn): rüzgâr çıkar — ağaç sallanır, yerden kalkan yapraklar sarmal bir
//     girdap halinde soldan sağa savrulup dağılır.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[41] (AUTUMN_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import {
  Circle,
  Group,
  LinearGradient,
  Path,
  Rect,
  Skia,
  vec,
} from "@shopify/react-native-skia";
import { restU } from "../../utils/weatherParticles";
import {
  Glow,
  TAU,
  addRoundTree,
  groundLayout,
  hash,
  rgba,
  ridgePath,
  ridgeY,
  sm,
  toneMap,
} from "./seasonKit";

export const AUTUMN_TONE = [
  "sky",
  "sun",
  "hillFar",
  "treesFar",
  "ground",
  "groundDark",
  "trunk",
  "leafA",
  "leafB",
  "leafC",
  "leafD",
  "bench",
  "lamp",
  "glow",
  "path",
];
const LEAVES = ["leafA", "leafB", "leafC", "leafD"];
const LEAF = "M0 -5 C3 -3.4 3.2 2.6 0 5 C-3.2 2.6 -3 -3.4 0 -5 Z M0 5 L0 7.5";

export function autumnLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  return {
    ...L,
    farBase: ground - 92 * k,
    nearBase: ground - 30 * k,
    tree: [width * 0.17, 210 * k],
    sun: [width * 0.68, ground - 128 * k],
  };
}

function buildAutumn(L) {
  const { k, width, height, ground } = L;
  const bottom = height + 20;
  const far = ridgePath(width, L.farBase, 30 * k, 2, 2.1, bottom);
  const farTrees = [Skia.Path.Make(), Skia.Path.Make()];
  for (let i = 0; i < 26; i += 1) {
    const x = width * (i / 25) + (hash(i, 1) - 0.5) * 12 * k;
    addRoundTree(
      farTrees[i % 2],
      x,
      ridgeY(far.pts, x) + 6 * k,
      (18 + hash(i, 2) * 16) * k,
      i,
    );
  }
  const near = ridgePath(width, L.nearBase, 14 * k, 2, 0.4, bottom);
  // patika: önden tepeye daralan kıvrım
  const trail = Skia.Path.Make();
  trail.moveTo(width * 0.34, height + 10);
  trail.cubicTo(
    width * 0.42,
    ground - 10 * k,
    width * 0.62,
    ground - 20 * k,
    width * 0.56,
    L.nearBase - 4 * k,
  );
  trail.lineTo(width * 0.585, L.nearBase - 4 * k);
  trail.cubicTo(
    width * 0.7,
    ground - 18 * k,
    width * 0.62,
    ground + 10 * k,
    width * 0.58,
    height + 10,
  );
  trail.close();
  // ağaç
  const [tx, th] = L.tree;
  const tb = ground + 6 * k;
  const trunk = Skia.Path.Make();
  trunk.moveTo(tx - 15 * k, tb);
  trunk.cubicTo(
    tx - 8 * k,
    tb - th * 0.25,
    tx - 12 * k,
    tb - th * 0.45,
    tx - 4 * k,
    tb - th * 0.62,
  );
  trunk.lineTo(tx + 6 * k, tb - th * 0.62);
  trunk.cubicTo(
    tx + 6 * k,
    tb - th * 0.42,
    tx + 4 * k,
    tb - th * 0.22,
    tx + 17 * k,
    tb,
  );
  trunk.close();
  // kökler
  trunk.moveTo(tx - 15 * k, tb);
  trunk.quadTo(tx - 22 * k, tb - 2 * k, tx - 28 * k, tb + 2 * k);
  trunk.lineTo(tx - 10 * k, tb - 4 * k);
  trunk.close();
  trunk.moveTo(tx + 17 * k, tb);
  trunk.quadTo(tx + 24 * k, tb - 2 * k, tx + 30 * k, tb + 3 * k);
  trunk.lineTo(tx + 12 * k, tb - 5 * k);
  trunk.close();
  const branches = [Skia.Path.Make(), Skia.Path.Make()];
  const bs = [
    [0, -0.6, -70, -0.88, 0],
    [1, -0.62, 80, -0.92, 0],
    [0, -0.62, 10, -1.06, 0],
    [-4, -0.45, -40, -0.62, 1],
    [4, -0.5, 60, -0.7, 1],
    [0, -0.8, -30, -1.0, 1],
    [6, -0.8, 110, -0.86, 1],
    [-2, -0.7, -100, -0.78, 1],
  ];
  bs.forEach(([x0, y0, x1, y1, thin]) => {
    const q = branches[thin];
    q.moveTo(tx + x0 * k, tb + th * y0);
    q.quadTo(
      tx + (x0 + x1) * 0.45 * k,
      tb + th * (y0 + y1) * 0.5 - 12 * k,
      tx + x1 * k,
      tb + th * y1,
    );
  });
  const canopy = LEAVES.map(() => Skia.Path.Make());
  for (let i = 0; i < 46; i += 1) {
    const a = hash(i, 3) * TAU;
    const rr = Math.sqrt(hash(i, 4));
    const x = tx + 14 * k + Math.cos(a) * rr * 118 * k;
    const y = tb - th * 0.9 + Math.sin(a) * rr * 58 * k;
    if (Math.abs(x - tx) < 26 * k && y > tb - th * 0.82) continue; // gövde üstü açık
    canopy[i % 4].addCircle(x, y, (12 + hash(i, 5) * 14) * k);
  }
  const speck = Skia.Path.Make();
  for (let i = 0; i < 60; i += 1) {
    const a = hash(i, 6) * TAU;
    const rr = Math.sqrt(hash(i, 7));
    speck.addCircle(
      tx + 14 * k + Math.cos(a) * rr * 128 * k,
      tb - th * 0.9 + Math.sin(a) * rr * 64 * k,
      (1.2 + hash(i, 8) * 1.4) * k,
    );
  }
  // yaprak halısı + yığın
  const carpet = LEAVES.map(() => Skia.Path.Make());
  for (let i = 0; i < 110; i += 1) {
    const x = hash(i, 9) * width;
    const y =
      ridgeY(near.pts, x) +
      (4 + hash(i, 10) * (height - ground + 30 * k)) * (i % 3 ? 0.35 : 1);
    const w = (3 + hash(i, 11) * 3) * k;
    carpet[i % 4].addOval(Skia.XYWHRect(x, y, w, w * 0.55));
  }
  const pile = LEAVES.map(() => Skia.Path.Make());
  for (let i = 0; i < 70; i += 1) {
    const f = hash(i, 12) * 2 - 1;
    const x = tx + 40 * k + f * 56 * k;
    const y = tb - (1 - f * f) * 16 * k * hash(i, 13);
    pile[i % 4].addOval(Skia.XYWHRect(x, y, 6 * k, 3.4 * k));
  }
  // bank
  const bx = width * 0.66;
  const by = ridgeY(near.pts, bx) + 18 * k;
  const bench = Skia.Path.Make();
  bench.addRect(Skia.XYWHRect(bx - 34 * k, by - 18 * k, 68 * k, 4 * k));
  bench.addRect(Skia.XYWHRect(bx - 34 * k, by - 29 * k, 68 * k, 3 * k));
  bench.addRect(Skia.XYWHRect(bx - 34 * k, by - 36 * k, 68 * k, 3 * k));
  for (const dx of [-28, 26]) {
    bench.addRect(Skia.XYWHRect(bx + dx * k, by - 36 * k, 3 * k, 36 * k));
  }
  // lamba
  const lx = width * 0.88;
  const lb = ridgeY(near.pts, lx) + 16 * k;
  const lamp = Skia.Path.Make();
  lamp.addRect(Skia.XYWHRect(lx - 1.8 * k, lb - 118 * k, 3.6 * k, 118 * k));
  lamp.addRect(Skia.XYWHRect(lx - 5 * k, lb - 10 * k, 10 * k, 10 * k));
  lamp.moveTo(lx - 8 * k, lb - 120 * k);
  lamp.lineTo(lx + 8 * k, lb - 120 * k);
  lamp.lineTo(lx + 4 * k, lb - 136 * k);
  lamp.lineTo(lx - 4 * k, lb - 136 * k);
  lamp.close();
  lamp.moveTo(lx - 9 * k, lb - 135 * k);
  lamp.lineTo(lx, lb - 143 * k);
  lamp.lineTo(lx + 9 * k, lb - 135 * k);
  lamp.close();
  return {
    far,
    farTrees,
    near,
    trail,
    trunk,
    branches,
    canopy,
    speck,
    carpet,
    pile,
    treeBase: tb,
    bench,
    benchPos: [bx, by],
    lamp,
    lampPos: [lx, lb - 128 * k],
  };
}

function gustAt(p, t) {
  "worklet";
  const u = restU(p, t);
  return u > 1 ? 0 : sm(0.06, 0.16, u) * (1 - sm(0.66, 0.86, u));
}

function SwirlLeaf({ p, clock, i, L, c }) {
  const { k, width, ground } = L;
  const transform = useDerivedValue(() => {
    const u = restU(p, clock.value);
    const g = (u - 0.1 - i * 0.012) / 0.6;
    const f = g < 0 ? 0 : g > 1 ? 1 : g;
    const th = f * TAU * 2.2 + i * 0.9;
    const R = (24 + hash(i, 1) * 34) * k * Math.sin(f * Math.PI);
    const x = -30 * k + f * (width + 60 * k) + Math.cos(th) * R;
    const y =
      ground -
      20 * k -
      Math.sin(f * Math.PI) * (90 + hash(i, 2) * 80) * k +
      Math.sin(th) * R * 0.6;
    return [
      { translateX: x },
      { translateY: y },
      { rotate: clock.value * (3 + hash(i, 3) * 4) + i },
      { scale: k * (1 + hash(i, 4) * 0.7) },
    ];
  });
  const opacity = useDerivedValue(() => {
    const u = restU(p, clock.value);
    const g = (u - 0.1 - i * 0.012) / 0.6;
    return u > 1 || g <= 0 || g >= 1 ? 0 : Math.min(1, g * 8, (1 - g) * 6);
  });
  return (
    <Group transform={transform} opacity={opacity}>
      <Path path={LEAF} color={c[LEAVES[i % 4]]} />
    </Group>
  );
}

export default function AutumnScene({
  p,
  clock,
  width,
  height,
  tone,
  lightSurface,
}) {
  const L = useMemo(() => autumnLayout(width, height), [width, height]);
  const geo = useMemo(() => buildAutumn(L), [L]);
  const c = useMemo(() => toneMap(AUTUMN_TONE, tone.colors), [tone]);
  const { k, ground } = L;
  const night = !lightSurface;
  const [sx, sy] = L.sun;
  const tb = geo.treeBase;
  const [tx] = L.tree;
  const sway = useDerivedValue(() => {
    const t = clock.value;
    const g = gustAt(p, t);
    const a = 0.008 * Math.sin(t * 0.7) + g * (0.035 + 0.015 * Math.sin(t * 5));
    return [
      { translateX: tx },
      { translateY: tb },
      { rotate: a },
      { translateX: -tx },
      { translateY: -tb },
    ];
  });
  const crown = useDerivedValue(() => {
    const t = clock.value;
    const g = gustAt(p, t);
    return [{ translateX: g * 6 * k * Math.sin(t * 6) }, { translateY: 0 }];
  });
  const pile = useDerivedValue(() => {
    const g = gustAt(p, clock.value);
    return [{ translateX: 0 }, { translateY: -g * 3 * k }];
  });
  const [lx, ly] = geo.lampPos;
  return (
    <Group opacity={tone.alpha}>
      {/* güneş + ufuk ışığı */}
      <Rect x={0} y={L.farBase - 200 * k} width={width} height={200 * k}>
        <LinearGradient
          start={vec(0, L.farBase - 200 * k)}
          end={vec(0, L.farBase)}
          colors={[rgba(c.sky, 0), rgba(c.sky, night ? 0.55 : 0.7)]}
        />
      </Rect>
      <Glow cx={sx} cy={sy} r={190 * k} color={c.sun} a={night ? 0.45 : 0.55} />
      <Circle cx={sx} cy={sy} r={24 * k} color={c.sun} />
      {/* tepeler */}
      <Path path={geo.far.path} color={c.hillFar} />
      <Path path={geo.farTrees[0]} color={rgba(c.treesFar, 0.85)} />
      <Path path={geo.farTrees[1]} color={rgba(c.leafD, 0.75)} />
      <Rect x={0} y={L.farBase - 30 * k} width={width} height={60 * k}>
        <LinearGradient
          start={vec(0, L.farBase - 30 * k)}
          end={vec(0, L.farBase + 30 * k)}
          colors={[rgba(c.sky, 0), rgba(c.sky, 0.45), rgba(c.sky, 0)]}
        />
      </Rect>
      <Path path={geo.near.path}>
        <LinearGradient
          start={vec(0, L.nearBase - 20 * k)}
          end={vec(0, height)}
          colors={[c.ground, c.groundDark]}
        />
      </Path>
      <Path path={geo.trail} color={c.path} opacity={0.75} />
      {geo.carpet.map((q, i) => (
        <Path key={LEAVES[i]} path={q} color={c[LEAVES[i]]} opacity={0.85} />
      ))}
      {/* bank + lamba */}
      <Path path={geo.bench} color={c.bench} />
      <Glow cx={lx} cy={ly} r={70 * k} color={c.glow} a={night ? 0.5 : 0.25} />
      <Path path={geo.lamp} color={c.lamp} />
      <Circle cx={lx} cy={ly} r={4.5 * k} color={c.glow} />
      {/* ağaç */}
      <Group transform={sway}>
        <Path
          path={geo.branches[0]}
          style="stroke"
          strokeWidth={8 * k}
          strokeCap="round"
          color={c.trunk}
        />
        <Path
          path={geo.branches[1]}
          style="stroke"
          strokeWidth={4.5 * k}
          strokeCap="round"
          color={c.trunk}
        />
        <Path path={geo.trunk} color={c.trunk} />
        <Group transform={crown}>
          <Path path={geo.canopy[3]} color={c.leafD} />
          <Path path={geo.canopy[2]} color={c.leafC} />
          <Path path={geo.canopy[0]} color={c.leafA} />
          <Path path={geo.canopy[1]} color={c.leafB} />
          <Path
            path={geo.speck}
            color={night ? c.leafB : c.leafC}
            opacity={0.8}
          />
        </Group>
      </Group>
      <Group transform={pile}>
        {geo.pile.map((q, i) => (
          <Path key={LEAVES[i]} path={q} color={c[LEAVES[i]]} />
        ))}
      </Group>
      {Array.from({ length: 28 }, (_, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <SwirlLeaf key={i} p={p} clock={clock} i={i} L={L} c={c} />
      ))}
    </Group>
  );
}
