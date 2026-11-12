// components/decor/starScene.js
//
// Yıldız tozu atmosfer sahnesi (OVERLAY.stars = 45, Atlas'ın ÖNÜNDE: yıldız tozu parçacıkları
// tepenin arkasında kalır) — tamamı VEKTÖR:
//   • Çapraz uzanan Samanyolu: yumuşak ışık şeridi, sıcak çekirdek, içinden geçen koyu toz kuşağı ve
//     şeride yoğunlaşan küçük yıldız kümeleri (iki grup halinde titreşir); renkli bulutsular.
//   • Kırınım çizgili parlak yıldızlar (nefes alır gibi parlayıp söner).
//   • Önde tepe silüeti, yalnız bir akasya ağacı ve tripod üstünde teleskopla gökyüzüne bakan biri.
//   • Olay (64 sn'de bir ~27 sn): bir takımyıldız (sırayla Büyük Ayı, Avcı, Kraliçe) yıldızları
//     parlayıp çizgileri tek tek çizilerek belirir ve söner; ardından tek noktadan saçılan meteor
//     yağmuru.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[45] (STAR_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import {
  Circle,
  Group,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Skia,
  vec,
} from "@shopify/react-native-skia";
import { restU } from "../../utils/weatherParticles";
import {
  Glow,
  TAU,
  groundLayout,
  hash,
  rgba,
  ridgePath,
  ridgeY,
  sm,
  toneMap,
} from "./seasonKit";

export const STAR_TONE = [
  "milky",
  "milkyCore",
  "dust",
  "nebA",
  "nebB",
  "star",
  "starWarm",
  "line",
  "hill",
  "tree",
  "person",
  "meteor",
];

// Takımyıldızlar: yıldızlar (0–1 kutu) ve çizgiler (sırayla çizilir)
export const CONSTELLATIONS = [
  {
    stars: [
      [0, 0.1],
      [0.18, 0.15],
      [0.33, 0.22],
      [0.47, 0.26],
      [0.5, 0.5],
      [0.76, 0.54],
      [0.8, 0.3],
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 3],
    ],
  },
  {
    stars: [
      [0.2, 0.08],
      [0.62, 0.14],
      [0.33, 0.48],
      [0.41, 0.5],
      [0.49, 0.53],
      [0.24, 0.92],
      [0.66, 0.86],
      [0.4, -0.06],
    ],
    lines: [
      [7, 0],
      [7, 1],
      [0, 2],
      [1, 4],
      [2, 3],
      [3, 4],
      [2, 5],
      [4, 6],
    ],
  },
  {
    stars: [
      [0, 0.2],
      [0.22, 0.48],
      [0.44, 0.26],
      [0.66, 0.5],
      [0.88, 0.16],
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
  },
];

export function starLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  return {
    ...L,
    hillBase: ground - 16 * k,
    con: [width * 0.24, height * 0.12, Math.min(width * 0.56, 240 * k)],
  };
}

function buildStars(L) {
  const { k, width, height } = L;
  const bottom = height + 20;
  const hill = ridgePath(width, L.hillBase, 34 * k, 2, 2.6, bottom);
  // Samanyolu ekseni: sol alttan sağ üste
  const ax = [width * -0.1, height * 0.62];
  const bx = [width * 1.1, height * 0.04];
  const along = (f, off) => {
    const dx = bx[0] - ax[0];
    const dy = bx[1] - ax[1];
    const len = Math.hypot(dx, dy);
    return [
      ax[0] + dx * f - (dy / len) * off,
      ax[1] + dy * f + (dx / len) * off,
    ];
  };
  const cluster = [Skia.Path.Make(), Skia.Path.Make()];
  for (let i = 0; i < 220; i += 1) {
    const g = (hash(i, 1) + hash(i, 2) + hash(i, 3) - 1.5) * 0.9; // ~normal
    const [x, y] = along(hash(i, 4), g * 70 * k);
    cluster[i % 2].addCircle(x, y, (0.35 + hash(i, 5) ** 3 * 1.1) * k);
  }
  const dust = Skia.Path.Make();
  {
    const top = [];
    const bot = [];
    for (let i = 0; i <= 24; i += 1) {
      const f = i / 24;
      const off = Math.sin(f * 9 + 1) * 10 * k;
      const w =
        (5 + 9 * Math.sin(f * Math.PI) * (0.6 + 0.4 * Math.sin(f * 17))) * k;
      top.push(along(f, off - w));
      bot.push(along(f, off + w));
    }
    dust.moveTo(top[0][0], top[0][1]);
    top.forEach(([x, y]) => dust.lineTo(x, y));
    for (let i = bot.length - 1; i >= 0; i -= 1)
      dust.lineTo(bot[i][0], bot[i][1]);
    dust.close();
  }
  const angle = Math.atan2(bx[1] - ax[1], bx[0] - ax[0]);
  const mid = along(0.5, 0);
  const core = along(0.36, 0);
  // parlak yıldızlar
  const bright = Array.from({ length: 8 }, (_, i) => [
    width * (0.06 + hash(i, 6) * 0.88),
    height * (0.05 + hash(i, 7) * 0.5),
    (0.7 + hash(i, 8) * 0.6) * k,
    hash(i, 9) * TAU,
    i % 3 === 0,
  ]);
  // ağaç (akasya): eğri gövde + yassı taç
  const tx = width * 0.18;
  const tb = ridgeY(hill.pts, tx) + 4 * k;
  const tree = Skia.Path.Make();
  tree.moveTo(tx - 3 * k, tb);
  tree.quadTo(tx - 2 * k, tb - 30 * k, tx + 6 * k, tb - 52 * k);
  tree.lineTo(tx + 10 * k, tb - 52 * k);
  tree.quadTo(tx + 3 * k, tb - 30 * k, tx + 3 * k, tb);
  tree.close();
  tree.moveTo(tx + 1 * k, tb - 30 * k);
  tree.quadTo(tx - 10 * k, tb - 42 * k, tx - 18 * k, tb - 54 * k);
  tree.lineTo(tx - 15 * k, tb - 55 * k);
  tree.quadTo(tx - 6 * k, tb - 44 * k, tx + 2 * k, tb - 35 * k);
  tree.close();
  tree.addOval(Skia.XYWHRect(tx - 46 * k, tb - 66 * k, 70 * k, 14 * k));
  tree.addOval(Skia.XYWHRect(tx - 14 * k, tb - 72 * k, 62 * k, 14 * k));
  tree.addOval(Skia.XYWHRect(tx - 34 * k, tb - 74 * k, 40 * k, 10 * k));
  // teleskop + izleyici
  const sx = width * 0.66;
  const sb = ridgeY(hill.pts, sx) + 4 * k;
  const scope = Skia.Path.Make();
  scope.moveTo(sx - 12 * k, sb);
  scope.lineTo(sx, sb - 30 * k);
  scope.lineTo(sx + 12 * k, sb);
  scope.moveTo(sx, sb - 30 * k);
  scope.lineTo(sx + 1 * k, sb);
  const tube = Skia.Path.Make();
  tube.moveTo(sx - 16 * k, sb - 24 * k);
  tube.lineTo(sx + 22 * k, sb - 52 * k);
  tube.lineTo(sx + 25 * k, sb - 47 * k);
  tube.lineTo(sx - 13 * k, sb - 20 * k);
  tube.close();
  tube.addCircle(sx, sb - 31 * k, 2.5 * k);
  const person = Skia.Path.Make();
  const px = sx - 24 * k;
  person.addCircle(px + 4 * k, sb - 42 * k, 5 * k);
  person.moveTo(px - 4 * k, sb);
  person.lineTo(px - 3 * k, sb - 24 * k);
  person.quadTo(px - 2 * k, sb - 36 * k, px + 4 * k, sb - 36 * k);
  person.lineTo(px + 7 * k, sb - 34 * k);
  person.lineTo(px + 5 * k, sb - 22 * k);
  person.lineTo(px + 4 * k, sb);
  person.close();
  person.moveTo(px + 4 * k, sb - 33 * k);
  person.lineTo(px + 12 * k, sb - 27 * k);
  person.lineTo(px + 12 * k, sb - 24 * k);
  person.lineTo(px + 3 * k, sb - 29 * k);
  person.close();
  return {
    hill,
    cluster,
    dust,
    angle,
    mid,
    core,
    bright,
    tree,
    scope,
    tube,
    person,
  };
}

function BrightStar({ clock, s, c, k }) {
  const [x, y, sc, ph, warm] = s;
  const transform = useDerivedValue(() => {
    const tw = 0.7 + 0.3 * Math.sin(clock.value * (0.9 + ph * 0.2) + ph);
    return [{ translateX: x }, { translateY: y }, { scale: sc * tw }];
  });
  const col = warm ? c.starWarm : c.star;
  return (
    <Group transform={transform}>
      <Glow r={14} color={col} a={0.5} />
      <Path
        path="M-16 0 L0 -0.8 L16 0 L0 0.8 Z M0 -16 L0.8 0 L0 16 L-0.8 0 Z"
        color={col}
      />
      <Path
        path="M-6 -6 L0 -0.5 L6 6 L0 0.5 Z M6 -6 L0.5 0 L-6 6 L-0.5 0 Z"
        color={rgba(col, 0.5)}
      />
      <Circle cx={0} cy={0} r={1.8} color={col} />
    </Group>
  );
}

function Constellation({ p, clock, L, c }) {
  const { k, width, height } = L;
  const [cx, cy, S] = L.con;
  const d = useDerivedValue(() => {
    const t = clock.value;
    const u = restU(p, t);
    const lines = Skia.Path.Make();
    const stars = Skia.Path.Make();
    if (u > 1 || u > 0.66) return { lines, stars, a: 0 };
    const cyc = Math.floor(t / p.period);
    const C = CONSTELLATIONS[((cyc % 3) + 3) % 3];
    const appear = sm(0.03, 0.1, u);
    for (let i = 0; i < C.stars.length; i += 1) {
      const [sx, sy] = C.stars[i];
      stars.addCircle(cx + sx * S, cy + sy * S, (1.6 + appear * 1.2) * k);
    }
    const prog = ((u - 0.1) / 0.3) * C.lines.length;
    for (let j = 0; j < C.lines.length; j += 1) {
      const f = prog - j;
      if (f <= 0) break;
      const g = f > 1 ? 1 : f;
      const [a, b] = C.lines[j];
      const ax = cx + C.stars[a][0] * S;
      const ay = cy + C.stars[a][1] * S;
      const bx = cx + C.stars[b][0] * S;
      const by = cy + C.stars[b][1] * S;
      lines.moveTo(ax, ay);
      lines.lineTo(ax + (bx - ax) * g, ay + (by - ay) * g);
    }
    return { lines, stars, a: appear * (1 - sm(0.56, 0.66, u)) };
  });
  const lines = useDerivedValue(() => d.value.lines);
  const stars = useDerivedValue(() => d.value.stars);
  const opacity = useDerivedValue(() => d.value.a);
  return (
    <Group opacity={opacity}>
      <Path
        path={lines}
        style="stroke"
        strokeWidth={1.2 * k}
        strokeCap="round"
        color={rgba(c.line, 0.7)}
      />
      <Path path={stars} color={c.star} />
    </Group>
  );
}

function Meteor({ p, clock, L, j, c }) {
  const { k, width, height } = L;
  const rad = [width * 0.86, height * 0.08];
  const ang = 2.25 + (hash(j, 1) - 0.5) * 0.9;
  const transform = useDerivedValue(() => {
    const u = restU(p, clock.value);
    const f = (u - 0.62 - j * 0.035) / 0.07;
    const g = f < 0 ? 0 : f > 1 ? 1 : f;
    const dist = (40 + g * (180 + hash(j, 2) * 120)) * k;
    return [
      { translateX: rad[0] + Math.cos(ang) * dist },
      { translateY: rad[1] + Math.sin(ang) * dist },
      { rotate: ang },
    ];
  });
  const opacity = useDerivedValue(() => {
    const u = restU(p, clock.value);
    const f = (u - 0.62 - j * 0.035) / 0.07;
    return u > 1 || f <= 0 || f >= 1 ? 0 : Math.sin(f * Math.PI);
  });
  const len = (50 + hash(j, 3) * 40) * k;
  return (
    <Group transform={transform} opacity={opacity}>
      <Rect x={-len} y={-0.9 * k} width={len} height={1.8 * k}>
        <LinearGradient
          start={vec(-len, 0)}
          end={vec(0, 0)}
          colors={[rgba(c.meteor, 0), rgba(c.meteor, 0.95)]}
        />
      </Rect>
      <Circle cx={0} cy={0} r={1.8 * k} color={c.meteor} />
    </Group>
  );
}

export default function StarScene({
  p,
  clock,
  width,
  height,
  tone,
  lightSurface,
}) {
  const L = useMemo(() => starLayout(width, height), [width, height]);
  const geo = useMemo(() => buildStars(L), [L]);
  const c = useMemo(() => toneMap(STAR_TONE, tone.colors), [tone]);
  const { k } = L;
  const night = !lightSurface;
  const tw0 = useDerivedValue(() => 0.55 + 0.45 * Math.sin(clock.value * 1.3));
  const tw1 = useDerivedValue(
    () => 0.55 + 0.45 * Math.sin(clock.value * 1.1 + 2),
  );
  const band = [
    { translateX: geo.mid[0] },
    { translateY: geo.mid[1] },
    { rotate: geo.angle },
    { scaleY: 0.14 },
  ];
  const R = Math.hypot(width, height) * 0.62;
  return (
    <Group opacity={tone.alpha}>
      {/* bulutsular */}
      <Glow
        cx={width * 0.22}
        cy={height * 0.24}
        r={130 * k}
        color={c.nebA}
        a={night ? 0.22 : 0.14}
      />
      <Glow
        cx={width * 0.8}
        cy={height * 0.44}
        r={110 * k}
        color={c.nebB}
        a={night ? 0.2 : 0.12}
      />
      {/* Samanyolu */}
      <Group transform={band}>
        <Circle cx={0} cy={0} r={R}>
          <RadialGradient
            c={vec(0, 0)}
            r={R}
            colors={[
              rgba(c.milky, night ? 0.26 : 0.16),
              rgba(c.milky, night ? 0.12 : 0.08),
              rgba(c.milky, 0),
            ]}
            positions={[0, 0.5, 1]}
          />
        </Circle>
      </Group>
      <Glow
        cx={geo.core[0]}
        cy={geo.core[1]}
        r={90 * k}
        color={c.milkyCore}
        a={night ? 0.22 : 0.16}
      />
      <Path path={geo.dust} color={rgba(c.dust, night ? 0.45 : 0.35)} />
      <Path path={geo.cluster[0]} color={c.star} opacity={tw0} />
      <Path path={geo.cluster[1]} color={c.star} opacity={tw1} />
      {geo.bright.map((s, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <BrightStar key={i} clock={clock} s={s} c={c} k={k} />
      ))}
      <Constellation p={p} clock={clock} L={L} c={c} />
      {Array.from({ length: 7 }, (_, j) => (
        // eslint-disable-next-line react/no-array-index-key
        <Meteor key={j} p={p} clock={clock} L={L} j={j} c={c} />
      ))}
      {/* ufuk ışığı + tepe + ağaç + teleskop */}
      <Rect x={0} y={L.hillBase - 150 * k} width={width} height={150 * k}>
        <LinearGradient
          start={vec(0, L.hillBase - 150 * k)}
          end={vec(0, L.hillBase)}
          colors={[rgba(c.nebB, 0), rgba(c.nebB, night ? 0.22 : 0.14)]}
        />
      </Rect>
      <Path path={geo.hill.path} color={c.hill} />
      <Path path={geo.tree} color={c.tree} />
      <Path
        path={geo.scope}
        style="stroke"
        strokeWidth={1.6 * k}
        color={c.person}
      />
      <Path path={geo.tube} color={c.person} />
      <Path path={geo.person} color={c.person} />
    </Group>
  );
}
