// components/decor/auroraScene.js
//
// Aurora atmosfer sahnesi (OVERLAY.aurora = 44, Atlas'ın ÖNÜNDE: yıldız parçacıkları dağların
// arkasında kalır) — tamamı VEKTÖR:
//   • Üç kat aurora perdesi: dalgalanan alt kenarı parlak yeşil, yukarı doğru morla sönen ışık,
//     perde boyunca dikey ışın çizgileri; perdeler farklı hızlarda kıvrılır.
//   • Ufukta karlı sivri dağlar (gölgeli yamaçlar), önlerinde durgun göl: aurora ve dağlar gölde
//     yansır, yüzeyde ince buz çizgileri.
//   • Önde karlı kıyı, solda çam silüetleri, sağda içi ışıklı çadır ve yanında gökyüzünü izleyen
//     oturan bir figür.
//   • Olay (60 sn'de bir ~25 sn): alt fırtına — perdeler parlayıp hızlanır, alt kenarda pembe saçak
//     belirir, gökten bir kayan yıldız geçer.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[44] (AURORA_TONE).

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
  addPine,
  groundLayout,
  hash,
  peaksPath,
  rgba,
  ridgePath,
  ridgeY,
  sm,
  toneMap,
} from "./seasonKit";

export const AURORA_TONE = [
  "auroraA",
  "auroraB",
  "auroraC",
  "fringe",
  "mtn",
  "mtnSnow",
  "lake",
  "lakeIce",
  "pine",
  "tent",
  "tentGlow",
  "person",
  "horizon",
];

// perde: [taban y (H), genlik (dp), dalga sıklığı, hız, ışın boyu (dp), opaklık]
const CURTAINS = [
  [0.19, 14, 0.011, 0.15, 150, 0.65],
  [0.29, 18, 0.008, -0.12, 190, 0.9],
  [0.38, 12, 0.014, 0.19, 120, 0.7],
];

export function auroraLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  return { ...L, lakeTop: ground - 54 * k, shore: ground + 2 * k };
}

function buildAurora(L) {
  const { k, width, height, ground } = L;
  const bottom = height + 20;
  const mtn = peaksPath(
    width,
    [
      [0.04, 70],
      [0.18, 118],
      [0.33, 84],
      [0.5, 140],
      [0.66, 96],
      [0.82, 128],
      [0.97, 80],
    ].map(([f, h]) => [width * f, L.lakeTop - h * k]),
    L.lakeTop,
    L.lakeTop + 2,
    5,
  );
  const shore = ridgePath(width, L.shore, 12 * k, 2, 1.7, bottom);
  const pines = Skia.Path.Make();
  const pineSnow = Skia.Path.Make();
  [-0.02, 0.05, 0.11, 0.17, 0.23, 0.29].forEach((f, i) => {
    const x = width * f + hash(i, 1) * 6 * k;
    const h = (60 + hash(i, 2) * 50 - i * 5) * k;
    addPine(pines, x, ridgeY(shore.pts, x) + 6 * k, h, h * 0.42, 6, pineSnow);
  });
  // buz çizgileri
  const ice = Skia.Path.Make();
  for (let i = 0; i < 18; i += 1) {
    const y = L.lakeTop + (4 + hash(i, 3) * (L.shore - L.lakeTop - 6 * k));
    const x = hash(i, 4) * width;
    const w = (16 + hash(i, 5) * 50) * k;
    ice.moveTo(x, y);
    ice.lineTo(x + w, y + (hash(i, 6) - 0.5) * 2 * k);
  }
  // çadır
  const tx = width * 0.74;
  const tb = ridgeY(shore.pts, tx) + 8 * k;
  const tent = Skia.Path.Make();
  tent.moveTo(tx - 30 * k, tb);
  tent.lineTo(tx, tb - 38 * k);
  tent.lineTo(tx + 30 * k, tb);
  tent.close();
  const door = Skia.Path.Make();
  door.moveTo(tx - 9 * k, tb);
  door.lineTo(tx, tb - 30 * k);
  door.lineTo(tx + 9 * k, tb);
  door.close();
  const poles = Skia.Path.Make();
  poles.moveTo(tx - 3 * k, tb - 44 * k);
  poles.lineTo(tx + 1 * k, tb - 36 * k);
  poles.moveTo(tx + 3 * k, tb - 44 * k);
  poles.lineTo(tx - 1 * k, tb - 36 * k);
  // oturan figür (yukarı bakar)
  const px = width * 0.88;
  const pb = ridgeY(shore.pts, px) + 6 * k;
  const person = Skia.Path.Make();
  person.addCircle(px - 1 * k, pb - 27 * k, 5 * k);
  person.moveTo(px - 7 * k, pb - 1 * k);
  person.lineTo(px - 6 * k, pb - 20 * k);
  person.quadTo(px, pb - 24 * k, px + 5 * k, pb - 19 * k);
  person.lineTo(px + 6 * k, pb - 8 * k);
  person.lineTo(px + 16 * k, pb - 7 * k);
  person.lineTo(px + 16 * k, pb - 1 * k);
  person.close();
  return {
    mtn,
    shore,
    pines,
    pineSnow,
    ice,
    tent,
    door,
    poles,
    tentPos: [tx, tb],
    person,
  };
}

function stormI(p, t) {
  "worklet";
  const u = restU(p, t);
  return u > 1 ? 0 : sm(0.04, 0.2, u) * (1 - sm(0.74, 0.96, u));
}

// Olayın ek fazı: dinlenmede 0, olay boyunca yumuşakça bir tam tur (2π).
function stormE(p, t) {
  "worklet";
  const u = restU(p, t);
  return u > 1 ? 0 : TAU * sm(0.04, 0.96, u);
}

/** Perde yolu: dolgu (alt kenar → ışın boyu), dikey ışınlar ve alt kenar çizgisi. */
function curtainPaths(ci, t, I, E, width, height, k) {
  "worklet";
  const [yr, A0, f, w, hr] = CURTAINS[ci];
  const fill = Skia.Path.Make();
  const rays = Skia.Path.Make();
  const edge = Skia.Path.Make();
  const A = A0 * k * (1 + I * 0.45);
  // Hız SABİT: saat (cihaz açılışından beri sn) büyük olduğundan t × (değişken hız) fazı
  // sıçratır. Olay yalnız sınırlı bir ek faz (E: 0 → 2π) ekler; tam tur olduğundan
  // olay bitince faz dikişsiz döner.
  const ph = t * w;
  const dir = w < 0 ? -1 : 1;
  const e = E * dir;
  const n = 40;
  const top = [];
  for (let i = 0; i <= n; i += 1) {
    const x = -20 * k + ((width + 40 * k) * i) / n;
    const y =
      height * yr +
      A * Math.sin(x * f + ph + e + ci * 1.7) +
      A * 0.45 * Math.sin(x * f * 2.6 - ph * 1.4 - e + ci) +
      A * 0.18 * Math.sin(x * f * 4.2 + ph * 1.8 + e);
    const h =
      hr *
      k *
      (0.75 + 0.25 * Math.sin(x * f * 1.7 + ph * 0.6 + e + ci * 2.3)) *
      (1 + I * 0.25);
    top.push([x, y - h]);
    if (i) edge.lineTo(x, y);
    else edge.moveTo(x, y);
    if (i) fill.lineTo(x, y);
    else fill.moveTo(x, y);
  }
  for (let i = n; i >= 0; i -= 1) fill.lineTo(top[i][0], top[i][1]);
  fill.close();
  // ışınlar: alt kenardan yukarı, yavaşça kayan
  const m = 54;
  for (let i = 0; i < m; i += 1) {
    const s = (i / m + t * 0.004 * (ci + 1)) % 1;
    const x = -20 * k + (width + 40 * k) * s;
    const j = Math.floor(s * n);
    const y =
      height * yr +
      A * Math.sin(x * f + ph + e + ci * 1.7) +
      A * 0.45 * Math.sin(x * f * 2.6 - ph * 1.4 - e + ci);
    const h = (y - top[j][1]) * (0.45 + 0.55 * hash(i, ci + 1));
    rays.moveTo(x, y);
    rays.lineTo(x + 2 * k, y - h);
  }
  return { fill, rays, edge };
}

function Curtain({ p, clock, ci, L, c }) {
  const { k, width, height } = L;
  const d = useDerivedValue(() =>
    curtainPaths(ci, clock.value, stormI(p, clock.value), stormE(p, clock.value), width, height, k),
  );
  const fill = useDerivedValue(() => d.value.fill);
  const rays = useDerivedValue(() => d.value.rays);
  const edge = useDerivedValue(() => d.value.edge);
  const bright = useDerivedValue(() => {
    const t = clock.value;
    return (
      CURTAINS[ci][5] *
      (0.75 + 0.25 * Math.sin(t * 0.5 + ci * 2)) *
      (1 + stormI(p, t) * 0.5)
    );
  });
  const fringe = useDerivedValue(() => stormI(p, clock.value));
  const y = height * CURTAINS[ci][0];
  const hr = CURTAINS[ci][4] * k;
  const main = ci === 1 ? c.auroraA : ci === 0 ? c.auroraB : c.auroraA;
  return (
    <Group opacity={bright}>
      <Path path={fill}>
        <LinearGradient
          start={vec(0, y - hr * 0.72)}
          end={vec(0, y + 18 * k)}
          colors={[
            rgba(c.auroraC, 0),
            rgba(c.auroraC, 0.22),
            rgba(main, 0.45),
            rgba(main, 0.85),
          ]}
          positions={[0, 0.4, 0.78, 1]}
        />
      </Path>
      <Path
        path={rays}
        style="stroke"
        strokeWidth={1.8 * k}
        strokeCap="round"
        color={rgba(main, 0.22)}
      />
      <Path
        path={edge}
        style="stroke"
        strokeWidth={1.4 * k}
        color={rgba(main, 0.6)}
      />
      <Group transform={[{ translateY: 3 * k }]}>
        <Path
          path={edge}
          style="stroke"
          strokeWidth={3 * k}
          color={rgba(c.fringe, 0.55)}
          opacity={fringe}
        />
      </Group>
    </Group>
  );
}

function ShootingStar({ p, clock, L, c }) {
  const { k, width, height } = L;
  const transform = useDerivedValue(() => {
    const u = restU(p, clock.value);
    const f = (u - 0.32) / 0.05;
    const g = f < 0 ? 0 : f > 1 ? 1 : f;
    return [
      { translateX: width * (0.15 + g * 0.5) },
      { translateY: height * (0.06 + g * 0.12) },
      { rotate: 0.35 },
    ];
  });
  const opacity = useDerivedValue(() => {
    const u = restU(p, clock.value);
    const f = (u - 0.32) / 0.05;
    return u > 1 || f <= 0 || f >= 1 ? 0 : Math.sin(f * Math.PI);
  });
  return (
    <Group transform={transform} opacity={opacity}>
      <Rect x={-90 * k} y={-1 * k} width={90 * k} height={2 * k}>
        <LinearGradient
          start={vec(-90 * k, 0)}
          end={vec(0, 0)}
          colors={[rgba(c.mtnSnow, 0), rgba("#ffffff", 0.95)]}
        />
      </Rect>
      <Circle cx={0} cy={0} r={2.2 * k} color="#ffffff" />
    </Group>
  );
}

export default function AuroraScene({
  p,
  clock,
  width,
  height,
  tone,
  lightSurface,
}) {
  const L = useMemo(() => auroraLayout(width, height), [width, height]);
  const geo = useMemo(() => buildAurora(L), [L]);
  const c = useMemo(() => toneMap(AURORA_TONE, tone.colors), [tone]);
  const { k, lakeTop } = L;
  const night = !lightSurface;
  const [tx, tb] = geo.tentPos;
  const tentGlow = useDerivedValue(
    () =>
      0.8 +
      0.15 * Math.sin(clock.value * 6.1) +
      0.05 * Math.sin(clock.value * 13),
  );
  const mirror = [{ translateY: lakeTop * 2 }, { scaleY: -1 }];
  const lakeClip = Skia.XYWHRect(0, lakeTop, width, height - lakeTop);
  return (
    <Group opacity={tone.alpha}>
      {/* ufuk ışığı */}
      <Rect x={0} y={lakeTop - 220 * k} width={width} height={220 * k}>
        <LinearGradient
          start={vec(0, lakeTop - 220 * k)}
          end={vec(0, lakeTop)}
          colors={[rgba(c.horizon, 0), rgba(c.horizon, night ? 0.5 : 0.4)]}
        />
      </Rect>
      {CURTAINS.map((_, ci) => (
        // eslint-disable-next-line react/no-array-index-key
        <Curtain key={ci} p={p} clock={clock} ci={ci} L={L} c={c} />
      ))}
      <ShootingStar p={p} clock={clock} L={L} c={c} />
      {/* dağlar */}
      <Path path={geo.mtn.path} color={c.mtn} />
      <Path path={geo.mtn.snow} color={rgba(c.mtnSnow, night ? 0.75 : 0.95)} />
      <Path path={geo.mtn.shade} color={rgba("#000000", night ? 0.3 : 0.15)} />
      {/* göl + yansımalar */}
      <Rect x={0} y={lakeTop} width={width} height={height - lakeTop}>
        <LinearGradient
          start={vec(0, lakeTop)}
          end={vec(0, L.shore + 20 * k)}
          colors={[c.lake, rgba(c.lake, 0.95)]}
        />
      </Rect>
      <Group clip={lakeClip}>
        <Group
          transform={[
            { translateY: lakeTop },
            { scaleY: -0.12 },
            { translateY: -lakeTop },
          ]}
          opacity={0.4}
        >
          {CURTAINS.map((_, ci) => (
            // eslint-disable-next-line react/no-array-index-key
            <Curtain key={ci} p={p} clock={clock} ci={ci} L={L} c={c} />
          ))}
        </Group>
        <Group transform={mirror} opacity={0.55}>
          <Path path={geo.mtn.path} color={c.mtn} />
          <Path path={geo.mtn.snow} color={rgba(c.mtnSnow, 0.4)} />
        </Group>
      </Group>
      <Path
        path={geo.ice}
        style="stroke"
        strokeWidth={1 * k}
        strokeCap="round"
        color={rgba(c.lakeIce, 0.45)}
      />
      {/* kıyı */}
      <Path path={geo.shore.path}>
        <LinearGradient
          start={vec(0, L.shore - 14 * k)}
          end={vec(0, height)}
          colors={[c.lakeIce, c.lake]}
        />
      </Path>
      <Path path={geo.pines} color={c.pine} />
      <Path path={geo.pineSnow} color={rgba(c.mtnSnow, 0.7)} />
      {/* çadır */}
      <Group opacity={tentGlow}>
        <Group
          transform={[
            { translateX: tx },
            { translateY: tb + 2 * k },
            { scaleY: 0.25 },
          ]}
        >
          <Glow r={80 * k} color={c.tentGlow} a={night ? 0.6 : 0.35} />
        </Group>
        <Glow
          cx={tx}
          cy={tb - 16 * k}
          r={50 * k}
          color={c.tentGlow}
          a={night ? 0.35 : 0.2}
        />
      </Group>
      <Path path={geo.tent} color={c.tent} />
      <Group opacity={tentGlow}>
        <Path path={geo.door} color={c.tentGlow} />
      </Group>
      <Path
        path={geo.poles}
        style="stroke"
        strokeWidth={1.4 * k}
        color={c.person}
      />
      <Path path={geo.person} color={c.person} />
    </Group>
  );
}
