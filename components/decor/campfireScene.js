// components/decor/campfireScene.js
//
// Kıvılcım atmosfer sahnesi: kamp ateşi (OVERLAY.campfire = 46) — tamamı VEKTÖR; yükselen
// kıvılcımlar (parçacık) önünde:
//   • Ormanda açıklık: arkada çam sırası, iki yanda ateşin ışığını iç kenarlarında yakalayan uzun
//     çamlar, sağda çadır; ateşin turuncu ışığı göğe ve zemine vurur (nefes alır gibi titrer).
//   • Ortada taş halka içinde çatılmış kütükler, kor yatağı ve katmanlı alev dilleri (dış turuncu,
//     orta sarı, beyazımsı çekirdek) — her dil kendi ritmiyle uzar, kıvrılır; üstte yükselen duman;
//     ateşin iki yanında oturak kütükleri.
//   • Olay (56 sn'de bir ~22 sn): bir kütük çöker → alevler büyür, ışık parlar, sarmal bir kıvılcım
//     demeti göğe yükselir.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[46] (CAMP_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import {
  Circle,
  Group,
  LinearGradient,
  Oval,
  Path,
  Rect,
  RoundedRect,
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
  rgba,
  ridgePath,
  sm,
  toneMap,
} from "./seasonKit";

export const CAMP_TONE = [
  "sky",
  "treeFar",
  "tree",
  "treeRim",
  "ground",
  "groundLit",
  "stone",
  "stoneLit",
  "log",
  "logEnd",
  "flameOut",
  "flameMid",
  "flameCore",
  "coal",
  "smoke",
  "tent",
  "tentGlow",
];

export function campLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  return {
    ...L,
    fire: [width * 0.5, ground - 2 * k],
    groundBase: ground - 12 * k,
  };
}

function mix(a, b, f) {
  const p = (h) => {
    const s = String(h).replace("#", "");
    const n = parseInt(s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const x = p(a);
  const y = p(b);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * f)).join(",")})`;
}

function buildCamp(L) {
  const { k, width, height, ground } = L;
  const bottom = height + 20;
  const back = Skia.Path.Make();
  for (let i = 0; i < 20; i += 1) {
    const x = width * (i / 19) + (hash(i, 1) - 0.5) * 14 * k;
    const h = (60 + hash(i, 2) * 50) * k;
    addPine(back, x, L.groundBase - 2 * k, h, h * 0.42, 5);
  }
  const ridge = ridgePath(width, L.groundBase, 8 * k, 2, 0.9, bottom);
  const left = Skia.Path.Make();
  const right = Skia.Path.Make();
  [
    [-0.04, 250],
    [0.07, 200],
    [0.16, 150],
  ].forEach(([f, h], i) =>
    addPine(left, width * f, ground + 6 * k, h * k, h * k * 0.44, 7 + (i % 2)),
  );
  [
    [1.04, 260],
    [0.94, 190],
  ].forEach(([f, h], i) =>
    addPine(right, width * f, ground + 6 * k, h * k, h * k * 0.44, 7 + (i % 2)),
  );
  const [fx, fb] = L.fire;
  // taş halkası: arka ve ön yarı
  const stonesBack = Skia.Path.Make();
  const stonesFront = Skia.Path.Make();
  const lit = Skia.Path.Make();
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * TAU + 0.2;
    const x = fx + Math.cos(a) * 38 * k;
    const y = fb + Math.sin(a) * 10 * k;
    const w = (13 + hash(i, 3) * 6) * k;
    const h = (8 + hash(i, 4) * 4) * k;
    const r = Skia.RRectXY(
      Skia.XYWHRect(x - w / 2, y - h, w, h),
      h * 0.45,
      h * 0.45,
    );
    (Math.sin(a) < 0 ? stonesBack : stonesFront).addRRect(r);
    if (Math.sin(a) > -0.2)
      lit.addOval(Skia.XYWHRect(x - w * 0.35, y - h * 0.95, w * 0.7, h * 0.4));
  }
  // oturak kütükleri + çadır
  const seatL = [width * 0.2, ground + 2 * k];
  const seatR = [width * 0.76, ground + 4 * k];
  const tx = width * 0.84;
  const tb = ground - 18 * k;
  const tent = Skia.Path.Make();
  tent.moveTo(tx - 44 * k, tb);
  tent.lineTo(tx - 6 * k, tb - 56 * k);
  tent.lineTo(tx + 40 * k, tb);
  tent.close();
  const tentSide = Skia.Path.Make();
  tentSide.moveTo(tx - 44 * k, tb);
  tentSide.lineTo(tx - 6 * k, tb - 56 * k);
  tentSide.lineTo(tx - 14 * k, tb);
  tentSide.close();
  return {
    back,
    ridge,
    left,
    right,
    stonesBack,
    stonesFront,
    lit,
    seatL,
    seatR,
    tent,
    tentSide,
  };
}

function flareAt(p, t) {
  "worklet";
  const u = restU(p, t);
  return u > 1 ? 0 : sm(0.06, 0.12, u) * (1 - sm(0.42, 0.7, u));
}

/** Alev dilleri: üç katman (dış, orta, çekirdek) tek karede kurulur. */
function flamePaths(t, F, fx, fb, k) {
  "worklet";
  const outer = Skia.Path.Make();
  const mid = Skia.Path.Make();
  const core = Skia.Path.Make();
  const layers = [
    [outer, 1, 12],
    [mid, 0.72, 8.5],
    [core, 0.42, 5.5],
  ];
  for (let i = 0; i < 7; i += 1) {
    const off = (i - 3) / 3;
    const base = 1 - Math.abs(off) * 0.55;
    const fl =
      0.72 +
      0.18 * Math.sin(t * (5.3 + i * 0.7) + i * 1.9) +
      0.1 * Math.sin(t * (11 + i) + i);
    const H =
      (34 + hash(i, 1) * 22) *
      k *
      base *
      fl *
      (1 + F * 0.9 * (1 - Math.abs(off) * 0.6));
    const bx = fx + off * 18 * k;
    const sway = Math.sin(t * (2.6 + i * 0.4) + i) * 7 * k + off * 6 * k;
    for (let j = 0; j < 3; j += 1) {
      const [q, s, w0] = layers[j];
      const h = H * s;
      const w = w0 * k * base * (1 + F * 0.3);
      const tx = bx + sway * s;
      const ty = fb - 4 * k - h;
      q.moveTo(bx - w, fb - 2 * k);
      q.cubicTo(
        bx - w * 1.1,
        fb - h * 0.45,
        tx - w * 0.35,
        fb - h * 0.75,
        tx,
        ty,
      );
      q.cubicTo(
        tx + w * 0.35,
        fb - h * 0.75,
        bx + w * 1.1,
        fb - h * 0.45,
        bx + w,
        fb - 2 * k,
      );
      q.close();
    }
  }
  return { outer, mid, core };
}

function Flames({ p, clock, L, c }) {
  const { k } = L;
  const [fx, fb] = L.fire;
  const d = useDerivedValue(() =>
    flamePaths(clock.value, flareAt(p, clock.value), fx, fb, k),
  );
  const outer = useDerivedValue(() => d.value.outer);
  const mid = useDerivedValue(() => d.value.mid);
  const core = useDerivedValue(() => d.value.core);
  return (
    <Group>
      <Path path={outer}>
        <LinearGradient
          start={vec(0, fb)}
          end={vec(0, fb - 110 * k)}
          colors={[c.flameMid, c.flameOut, rgba(c.flameOut, 0.2)]}
          positions={[0, 0.45, 1]}
        />
      </Path>
      <Path path={mid}>
        <LinearGradient
          start={vec(0, fb)}
          end={vec(0, fb - 70 * k)}
          colors={[c.flameCore, c.flameMid, rgba(c.flameMid, 0.4)]}
          positions={[0, 0.5, 1]}
        />
      </Path>
      <Path path={core} color={c.flameCore} opacity={0.9} />
    </Group>
  );
}

function SmokePuff({ clock, i, L, c }) {
  const { k } = L;
  const [fx, fb] = L.fire;
  const transform = useDerivedValue(() => {
    const f = (clock.value / 9 + i / 6) % 1;
    const x =
      fx + Math.sin(clock.value * 0.5 + i * 2) * 10 * k * f + f * 30 * k;
    return [
      { translateX: x },
      { translateY: fb - 70 * k - f * 200 * k },
      { scale: 0.4 + f * 1.8 },
    ];
  });
  const opacity = useDerivedValue(() => {
    const f = (clock.value / 9 + i / 6) % 1;
    return (1 - f) * (f < 0.15 ? f / 0.15 : 1) * 0.28;
  });
  return (
    <Group transform={transform} opacity={opacity}>
      <Circle cx={0} cy={0} r={12 * k} color={c.smoke} />
      <Circle cx={8 * k} cy={-4 * k} r={8 * k} color={c.smoke} />
    </Group>
  );
}

function SparkBurst({ p, clock, L, c }) {
  const { k } = L;
  const [fx, fb] = L.fire;
  const path = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const u = restU(p, clock.value);
    if (u > 1) return q;
    for (let i = 0; i < 28; i += 1) {
      const f = (u - 0.1 - hash(i, 1) * 0.14) / (0.32 + hash(i, 2) * 0.2);
      if (f <= 0 || f >= 1) continue;
      const th = f * TAU * (1.2 + hash(i, 3)) + i;
      const r = (8 + f * 50) * k * (0.5 + hash(i, 4));
      const x = fx + Math.cos(th) * r + (hash(i, 5) - 0.5) * 40 * k * f;
      const y = fb - 40 * k - f * (260 + hash(i, 6) * 200) * k;
      q.addCircle(x, y, (1.8 - f * 1.2) * k);
    }
    return q;
  });
  return (
    <Group>
      <Path path={path} color={c.flameMid} />
    </Group>
  );
}

function Seat({ x, y, k, c, flip }) {
  return (
    <Group
      transform={[
        { translateX: x },
        { translateY: y },
        { rotate: flip ? 0.06 : -0.05 },
      ]}
    >
      <RoundedRect
        x={-42 * k}
        y={-13 * k}
        width={84 * k}
        height={13 * k}
        r={6 * k}
        color={c.log}
      />
      <Rect
        x={-36 * k}
        y={-12 * k}
        width={72 * k}
        height={2.4 * k}
        color={rgba(c.flameMid, 0.25)}
      />
      <Oval
        x={(flip ? -46 : 36) * k}
        y={-13 * k}
        width={10 * k}
        height={13 * k}
        color={c.logEnd}
      />
    </Group>
  );
}

export default function CampfireScene({
  p,
  clock,
  width,
  height,
  tone,
  lightSurface,
}) {
  const L = useMemo(() => campLayout(width, height), [width, height]);
  const geo = useMemo(() => buildCamp(L), [L]);
  const c = useMemo(() => toneMap(CAMP_TONE, tone.colors), [tone]);
  const { k, ground } = L;
  const night = !lightSurface;
  const [fx, fb] = L.fire;
  const glow = useDerivedValue(() => {
    const t = clock.value;
    return (
      (0.78 + 0.12 * Math.sin(t * 7.1) + 0.1 * Math.sin(t * 12.7)) *
      (1 + flareAt(p, t) * 0.6)
    );
  });
  const logShift = useDerivedValue(() => {
    const u = restU(p, clock.value);
    const s = u > 1 ? 0 : sm(0.06, 0.1, u) * (1 - sm(0.8, 0.95, u));
    return [
      { translateX: fx },
      { translateY: fb },
      { rotate: s * 0.12 },
      { translateY: s * 3 * k },
    ];
  });
  const rimL = useMemo(
    () => mix(c.tree, c.treeRim, night ? 0.32 : 0.22),
    [c, night],
  );
  return (
    <Group opacity={tone.alpha}>
      {/* göğe vuran ışık */}
      <Group opacity={glow}>
        <Glow
          cx={fx}
          cy={fb - 60 * k}
          r={300 * k}
          color={c.flameMid}
          a={night ? 0.22 : 0.18}
          mid={0.35}
        />
      </Group>
      <Path path={geo.back} color={c.treeFar} />
      <Path path={geo.ridge.path}>
        <LinearGradient
          start={vec(0, L.groundBase)}
          end={vec(0, height)}
          colors={[c.ground, rgba(c.ground, 1)]}
        />
      </Path>
      {/* zemine vuran ışık */}
      <Group opacity={glow}>
        <Group
          transform={[
            { translateX: fx },
            { translateY: fb + 4 * k },
            { scaleY: 0.22 },
          ]}
        >
          <Glow
            r={230 * k}
            color={c.groundLit}
            a={night ? 0.85 : 0.6}
            mid={0.45}
          />
        </Group>
      </Group>
      {/* yan çamlar (iç kenarları ateşten aydınlanır) */}
      <Path path={geo.left}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(width * 0.28, 0)}
          colors={[c.tree, c.tree, rimL]}
          positions={[0, 0.55, 1]}
        />
      </Path>
      <Path path={geo.right}>
        <LinearGradient
          start={vec(width * 0.82, 0)}
          end={vec(width, 0)}
          colors={[rimL, c.tree]}
        />
      </Path>
      {/* çadır */}
      <Path path={geo.tent} color={c.tent} />
      <Path path={geo.tentSide} color={rgba(c.tentGlow, night ? 0.35 : 0.25)} />
      <Seat x={geo.seatL[0]} y={geo.seatL[1]} k={k} c={c} flip={false} />
      <Seat x={geo.seatR[0]} y={geo.seatR[1]} k={k} c={c} flip />
      {/* ateş çukuru (ekran ölçeğinde biraz büyütülür) */}
      <Group
        transform={[
          { translateX: fx },
          { translateY: fb },
          { scale: 1.3 },
          { translateX: -fx },
          { translateY: -fb },
        ]}
      >
        <Path path={geo.stonesBack} color={c.stone} />
        <Oval
          x={fx - 30 * k}
          y={fb - 7 * k}
          width={60 * k}
          height={12 * k}
          color={c.coal}
          opacity={0.85}
        />
        <Group transform={logShift}>
          <Group transform={[{ translateY: -9 * k }, { rotate: -0.45 }]}>
            <RoundedRect
              x={-34 * k}
              y={-5 * k}
              width={60 * k}
              height={9 * k}
              r={4 * k}
              color={c.log}
            />
            <Oval
              x={-36 * k}
              y={-5 * k}
              width={7 * k}
              height={9 * k}
              color={c.logEnd}
            />
          </Group>
          <Group transform={[{ translateY: -9 * k }, { rotate: 0.45 }]}>
            <RoundedRect
              x={-26 * k}
              y={-5 * k}
              width={60 * k}
              height={9 * k}
              r={4 * k}
              color={c.log}
            />
            <Oval
              x={29 * k}
              y={-5 * k}
              width={7 * k}
              height={9 * k}
              color={c.logEnd}
            />
          </Group>
        </Group>
        <Flames p={p} clock={clock} L={L} c={c} />
        <Path path={geo.stonesFront} color={c.stone} />
        <Group opacity={glow}>
          <Path path={geo.lit} color={c.stoneLit} opacity={0.3} />
          <Glow
            cx={fx}
            cy={fb - 22 * k}
            r={70 * k}
            color={c.flameCore}
            a={0.3}
          />
        </Group>
      </Group>
      {Array.from({ length: 6 }, (_, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <SmokePuff key={i} clock={clock} i={i} L={L} c={c} />
      ))}
      <SparkBurst p={p} clock={clock} L={L} c={c} />
    </Group>
  );
}
