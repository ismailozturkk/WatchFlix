// components/decor/bladeRunnerScene.js
//
// Blade Runner evren sahnesi (OVERLAY.brVec = 58) — tamamı VEKTÖR:
//   • Turuncu-camgöbeği pus içinde gece megakenti: ufukta dev basamaklı piramit yapı (ışıklı pencere
//     şeritleri), uzakta sanayi bacaları — tepelerinden aralıklı alev püskürür ve pusu turuncuya boyar.
//   • Önde dar, yüksek kuleler: dikey neon tabelalar (yazısız renkli şeritler, yavaş nefes alır),
//     dev holografik reklam panosu (yumuşak dalgalanan renk), ıslak caddede neon yansımaları.
//   • Yağmur: bileşikteki "rain" parçacığı.
//   • Olay (60 sn'de bir ~24 sn): uçan polis arabası sağdan süzülerek gelir, kırmızı-mavi tepe lambası
//     yumuşakça yanıp söner, farları yağmuru yarar; piramidin önünde yavaşlayıp yükselir ve gider.
//     Aynı anda bir projektör gökte ağır ağır tarar.
//   • Olay B (dönüşümlü): dev reklam zeplini şehrin üstünden ağır ağır geçer — yan yüzünde kayan
//     renkli ekran şeridi, yanıp sönen seyir ışıkları, alttan yağmurlu caddeyi tarayan iki ışık konisi.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[58] (BR_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Group, LinearGradient, Path, Rect, Skia, vec } from "@shopify/react-native-skia";
import { eventU } from "../../utils/weatherParticles";
import { Glow, groundLayout, hash, rgba, sm, toneMap } from "./seasonKit";

export const BR_TONE = [
  "haze",
  "hazeHot",
  "pyramid",
  "pyramidLit",
  "stack",
  "flame",
  "towerFar",
  "tower",
  "window",
  "neon1",
  "neon2",
  "neon3",
  "neon4",
  "street",
  "wet",
  "car",
  "carLight",
  "beacon1",
  "beacon2",
  "search",
];

export function brLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  return {
    ...L,
    base: ground - 4 * k,
    pyramid: [width * 0.56, ground - 40 * k, 330 * k, 290 * k],
    stacks: [width * 0.08, width * 0.2, width * 0.88],
    billboard: [width * 0.04, ground - 330 * k, 92 * k, 120 * k],
  };
}

// ───────────────────────────── durağan yollar

function buildPyramid(L) {
  const { k } = L;
  const [cx, b, w, h] = L.pyramid;
  const body = Skia.Path.Make();
  const lit = Skia.Path.Make();
  const steps = 7;
  for (let i = 0; i < steps; i += 1) {
    const f0 = i / steps;
    const f1 = (i + 1) / steps;
    const y0 = b - h * f0;
    const y1 = b - h * f1;
    const half0 = (w / 2) * (1 - f0 * 0.82);
    const half1 = (w / 2) * (1 - f1 * 0.82);
    // basamak: önce dikey yüz, sonra eğim
    body.moveTo(cx - half0, y0);
    body.lineTo(cx - half0, y0 - (y0 - y1) * 0.35);
    body.lineTo(cx - half1, y1);
    body.lineTo(cx + half1, y1);
    body.lineTo(cx + half0, y0 - (y0 - y1) * 0.35);
    body.lineTo(cx + half0, y0);
    body.close();
    // pencere şeritleri (seyrek, kesik)
    const yl = y0 - (y0 - y1) * 0.18;
    for (let x = cx - half0 + 4 * k; x < cx + half0 - 6 * k; x += 7 * k) {
      if (hash(i * 31 + x, 3) > 0.45) lit.addRect(Skia.XYWHRect(x, yl, 4 * k, 1.6 * k));
    }
  }
  // yanlarda kuleler
  [-1, 1].forEach((s) => {
    const tx = cx + s * w * 0.56;
    body.addRect(Skia.XYWHRect(tx - 12 * k, b - h * 0.55, 24 * k, h * 0.55));
    for (let y = b - h * 0.52; y < b - 6 * k; y += 8 * k) if (hash(y, s + 4) > 0.4) lit.addRect(Skia.XYWHRect(tx - 8 * k, y, 16 * k, 1.4 * k));
  });
  return { body, lit, top: [cx, b - h] };
}

function buildCity(L) {
  const { k, width, base } = L;
  const far = Skia.Path.Make();
  const near = Skia.Path.Make();
  const winFar = Skia.Path.Make();
  const winNear = Skia.Path.Make();
  const stacks = Skia.Path.Make();
  L.stacks.forEach((x, i) => {
    const h = (190 + hash(i, 1) * 50) * k;
    stacks.moveTo(x - 9 * k, base - 40 * k);
    stacks.lineTo(x - 5 * k, base - 40 * k - h);
    stacks.lineTo(x + 5 * k, base - 40 * k - h);
    stacks.lineTo(x + 9 * k, base - 40 * k);
    stacks.close();
  });
  for (let x = -6 * k, i = 0; x < width + 6 * k; i += 1) {
    const w = (16 + hash(i, 2) * 22) * k;
    const midF = Math.abs(x + w / 2 - width * 0.56) / (width * 0.5);
    const h = (40 + Math.min(1, midF) * 110 + hash(i, 3) * 50) * k;
    far.addRect(Skia.XYWHRect(x, base - 30 * k - h, w + 1, h + 30 * k));
    for (let y = base - 26 * k - h; y < base - 34 * k; y += 6 * k)
      if (hash(y + i, 5) > 0.72) winFar.addRect(Skia.XYWHRect(x + 3 * k, y, w - 6 * k, 1.2 * k));
    x += w + hash(i, 4) * 6 * k;
  }
  // önde dar kuleler (iki yanda yoğun, ortada alçak)
  const neon = [Skia.Path.Make(), Skia.Path.Make(), Skia.Path.Make(), Skia.Path.Make()];
  for (let x = -4 * k, i = 0; x < width + 4 * k; i += 1) {
    const w = (26 + hash(i, 6) * 30) * k;
    const mid = Math.abs(x + w / 2 - width / 2) / (width / 2);
    const h = (36 + Math.pow(Math.min(1, mid), 1.6) * 270 + hash(i, 7) * 34) * k;
    near.addRect(Skia.XYWHRect(x, base - h, w + 1, h + 4 * k));
    near.addRect(Skia.XYWHRect(x + w * 0.3, base - h - 14 * k, 3 * k, 14 * k)); // anten
    for (let y = base - h + 8 * k; y < base - 10 * k; y += 9 * k)
      for (let wx = x + 4 * k; wx < x + w - 6 * k; wx += 7 * k)
        if (hash(wx * 3 + y, 9) > 0.8) winNear.addRect(Skia.XYWHRect(wx, y, 3.2 * k, 3.2 * k));
    // dikey neon şerit (yazısız)
    if (hash(i, 8) > 0.35 && h > 110 * k) {
      const ny = base - h * (0.4 + hash(i, 10) * 0.35);
      const nh = (34 + hash(i, 11) * 40) * k;
      const nx = hash(i, 12) > 0.5 ? x + w - 3 * k : x - 4 * k;
      const q = neon[i % 4];
      q.addRect(Skia.XYWHRect(nx, ny, 7 * k, nh));
      // kutu içinde kesik çizgiler: harf izlenimi vermeyen yatay bölmeler
      for (let yy = ny + 5 * k; yy < ny + nh - 3 * k; yy += 7 * k) q.addRect(Skia.XYWHRect(nx + 1.6 * k, yy, 3.8 * k, 2.2 * k));
    }
    x += w + hash(i, 13) * 10 * k;
  }
  return { far, near, winFar, winNear, stacks, neon };
}

// ───────────────────────────── hareketli parçalar

function Flame({ x, top, i, clock, c, k }) {
  // her baca ~11–15 sn'de bir, 1,8 sn süren yumuşak püskürme
  const per = 11 + i * 2;
  const a = useDerivedValue(() => {
    const ph = ((clock.value + i * 4.3) % per) / per;
    return ph < 0.16 ? Math.sin((ph / 0.16) * Math.PI) : 0;
  });
  const shape = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const h = (22 + 10 * Math.sin(clock.value * 13 + i)) * k;
    q.moveTo(x - 5 * k, top);
    q.quadTo(x - 7 * k, top - h * 0.5, x + Math.sin(clock.value * 9) * 2 * k, top - h);
    q.quadTo(x + 7 * k, top - h * 0.5, x + 5 * k, top);
    q.close();
    return q;
  });
  return (
    <Group opacity={a}>
      <Glow cx={x} cy={top - 10 * k} r={90 * k} color={c.hazeHot} a={0.5} mid={0.3} />
      <Path path={shape} color={c.flame} />
    </Group>
  );
}

function NeonGroup({ path, color, i, clock }) {
  const a = useDerivedValue(() => 0.72 + 0.2 * Math.sin(clock.value * (0.6 + i * 0.17) + i * 1.9) + 0.08 * Math.sin(clock.value * 2.3 + i));
  return (
    <Group opacity={a}>
      <Path path={path} color={color} />
    </Group>
  );
}

function Billboard({ L, clock, c }) {
  const { k } = L;
  const [x, y, w, h] = L.billboard;
  // holografik pano: dikey kayan renk bantları, yazısız
  const shift = useDerivedValue(() => [{ translateY: ((clock.value * 6 * k) % h) - h }]);
  const a = useDerivedValue(() => 0.55 + 0.15 * Math.sin(clock.value * 0.7));
  const clip = useMemo(() => Skia.XYWHRect(x, y, w, h), [x, y, w, h]);
  return (
    <Group opacity={a}>
      <Glow cx={x + w / 2} cy={y + h / 2} r={w} color={c.neon2} a={0.25} mid={0.3} />
      <Group clip={clip}>
        <Group transform={shift}>
          {[0, 1].map((r) => (
            <Rect key={r} x={x} y={y + r * h} width={w} height={h}>
              <LinearGradient start={vec(x, y + r * h)} end={vec(x, y + (r + 1) * h)} colors={[c.neon2, c.neon4, c.neon1, c.neon2]} />
            </Rect>
          ))}
        </Group>
        {Array.from({ length: Math.floor(h / (4 * k)) }, (_, j) => (
          <Rect key={j} x={x} y={y + j * 4 * k} width={w} height={1.2 * k} color={c.towerFar} opacity={0.35} />
        ))}
      </Group>
    </Group>
  );
}

function Spinner({ p, clock, L, c }) {
  const { k, width } = L;
  const body = useMemo(() => {
    const q = Skia.Path.Make();
    // yandan uçan araba: alçak kama gövde, kubbe, yan itici
    q.moveTo(-34 * k, -2 * k);
    q.lineTo(-28 * k, -9 * k);
    q.lineTo(-10 * k, -12 * k);
    q.lineTo(-2 * k, -20 * k);
    q.lineTo(16 * k, -20 * k);
    q.lineTo(26 * k, -11 * k);
    q.lineTo(36 * k, -8 * k);
    q.lineTo(34 * k, 0);
    q.close();
    q.addRRect(Skia.RRectXY(Skia.XYWHRect(-24 * k, -1 * k, 46 * k, 6 * k), 3 * k, 3 * k));
    return q;
  }, [k]);
  const glass = useMemo(() => {
    const q = Skia.Path.Make();
    q.moveTo(-1 * k, -18 * k);
    q.lineTo(14 * k, -18 * k);
    q.lineTo(21 * k, -11 * k);
    q.lineTo(-6 * k, -11 * k);
    q.close();
    return q;
  }, [k]);
  const at = useDerivedValue(() => {
    const u = eventU(p, clock.value, 0);
    if (u > 1) return [{ translateX: -900 }, { translateY: -900 }];
    // sağdan gelir (aynalı), ortada yavaşlar, yükselip sola gider
    const e = sm(0, 0.45, u) * 0.5 + sm(0.55, 1, u) * 0.5;
    const x = width + 80 * k - (width + 200 * k) * e;
    const y = L.base - 150 * k - sm(0.5, 0.95, u) * 190 * k + Math.sin(clock.value * 1.6) * 3 * k;
    return [{ translateX: x }, { translateY: y }, { rotate: 0.06 * Math.sin(clock.value * 0.9) - 0.08 * sm(0.5, 0.7, u) }, { scaleX: -1 }];
  });
  const b1 = useDerivedValue(() => 0.5 + 0.5 * Math.sin(clock.value * 5));
  const b2 = useDerivedValue(() => 0.5 - 0.5 * Math.sin(clock.value * 5));
  return (
    <Group transform={at}>
      {/* farlar: yağmuru yaran ışık konisi */}
      <Path path={`M ${34 * k} ${-6 * k} L ${190 * k} ${-50 * k} L ${190 * k} ${46 * k} Z`}>
        <LinearGradient start={vec(34 * k, 0)} end={vec(190 * k, 0)} colors={[c.carLight, rgba(c.carLight, 0)]} />
      </Path>
      <Glow cx={34 * k} cy={-5 * k} r={14 * k} color={c.carLight} a={0.95} mid={0.35} />
      <Glow cx={-6 * k} cy={8 * k} r={18 * k} color={c.neon2} a={0.45} mid={0.3} />
      <Path path={body} color={c.car} />
      <Path path={glass} color={c.window} opacity={0.6} />
      <Group opacity={b1}>
        <Glow cx={2 * k} cy={-21 * k} r={9 * k} color={c.beacon1} a={0.9} mid={0.35} />
      </Group>
      <Group opacity={b2}>
        <Glow cx={12 * k} cy={-21 * k} r={9 * k} color={c.beacon2} a={0.9} mid={0.35} />
      </Group>
    </Group>
  );
}

function Searchlight({ p, clock, L, c }) {
  const { k, width } = L;
  const [cx, top] = [L.pyramid[0], L.pyramid[1] - L.pyramid[3]];
  const beam = useMemo(() => {
    const q = Skia.Path.Make();
    q.moveTo(-3 * k, 0);
    q.lineTo(-60 * k, -width * 1.1);
    q.lineTo(60 * k, -width * 1.1);
    q.lineTo(3 * k, 0);
    q.close();
    return q;
  }, [k, width]);
  const at = useDerivedValue(() => [{ translateX: cx }, { translateY: top }, { rotate: 0.55 * Math.sin(clock.value * 0.11) }]);
  const a = useDerivedValue(() => {
    const u = eventU(p, clock.value, 0);
    return 0.35 + (u > 1 ? 0 : 0.35 * sm(0.1, 0.3, u) * (1 - sm(0.8, 1, u)));
  });
  return (
    <Group transform={at} opacity={a}>
      <Path path={beam}>
        <LinearGradient start={vec(0, 0)} end={vec(0, -width * 1.1)} colors={[c.search, rgba(c.search, 0)]} />
      </Path>
    </Group>
  );
}

// ───────────────────────────── olay B: reklam zeplini

function AdBlimp({ p, clock, L, c }) {
  const { k, width, base } = L;
  const s = k * 1.15;
  const st = useMemo(() => {
    const body = Skia.Path.Make();
    body.addOval(Skia.XYWHRect(-90 * s, -24 * s, 180 * s, 48 * s));
    const fins = Skia.Path.Make();
    fins.moveTo(78 * s, -6 * s);
    fins.lineTo(104 * s, -30 * s);
    fins.lineTo(108 * s, -26 * s);
    fins.lineTo(92 * s, 0);
    fins.lineTo(108 * s, 24 * s);
    fins.lineTo(104 * s, 28 * s);
    fins.lineTo(78 * s, 6 * s);
    fins.close();
    fins.addRRect(Skia.RRectXY(Skia.XYWHRect(-22 * s, 20 * s, 44 * s, 10 * s), 4 * s, 4 * s));
    const screen = Skia.XYWHRect(-60 * s, -12 * s, 120 * s, 18 * s);
    const scan = Skia.Path.Make();
    for (let j = 0; j < 6; j += 1) scan.addRect(Skia.XYWHRect(-60 * s, (-12 + j * 3) * s, 120 * s, 0.8 * s));
    const beams = Skia.Path.Make();
    [-14, 14].forEach((bx) => {
      beams.moveTo((bx - 3) * s, 28 * s);
      beams.lineTo((bx + 3) * s, 28 * s);
      beams.lineTo((bx + 40) * s, 330 * s);
      beams.lineTo((bx - 40) * s, 330 * s);
      beams.close();
    });
    return { body, fins, screen, scan, beams };
  }, [s]);
  const at = useDerivedValue(() => {
    const u = eventU(p, clock.value, 1);
    if (u > 1) return [{ translateX: -999 }, { translateY: -999 }];
    const e = u;
    return [
      { translateX: -130 * s + e * (width + 260 * s) },
      { translateY: base - 470 * k + Math.sin(clock.value * 0.5) * 4 * k },
      { rotate: Math.sin(clock.value * 0.4) * 0.02 },
    ];
  });
  const shift = useDerivedValue(() => [{ translateX: ((clock.value * 24 * s) % (120 * s)) - 120 * s }]);
  const blink = useDerivedValue(() => (Math.sin(clock.value * 5) > 0.6 ? 1 : 0.15));
  const beamT = useDerivedValue(() => [{ translateY: 28 * s }, { rotate: Math.sin(clock.value * 0.7) * 0.25 }, { translateY: -28 * s }]);
  return (
    <Group transform={at}>
      <Group transform={beamT}>
        <Path path={st.beams}>
          <LinearGradient start={vec(0, 28 * s)} end={vec(0, 330 * s)} colors={[rgba(c.search, 0.4), rgba(c.search, 0)]} />
        </Path>
      </Group>
      <Glow r={140 * s} color={c.neon2} a={0.18} mid={0.3} />
      <Path path={st.fins} color={c.towerFar} />
      <Path path={st.body} color={c.tower} />
      <Group clip={st.screen}>
        <Group transform={shift}>
          {[0, 1].map((r) => (
            <Rect key={r} x={-60 * s + r * 120 * s} y={-12 * s} width={120 * s} height={18 * s}>
              <LinearGradient start={vec(-60 * s + r * 120 * s, 0)} end={vec(60 * s + r * 120 * s, 0)} colors={[c.neon1, c.neon3, c.neon4, c.neon1]} />
            </Rect>
          ))}
        </Group>
        <Path path={st.scan} color={c.tower} opacity={0.4} />
      </Group>
      <Group opacity={blink}>
        <Glow cx={-88 * s} cy={0} r={8 * s} color={c.beacon1} a={0.9} mid={0.3} />
        <Glow cx={106 * s} cy={-28 * s} r={8 * s} color={c.beacon2} a={0.9} mid={0.3} />
      </Group>
    </Group>
  );
}

export default function BladeRunnerScene({ p, clock, width, height, tone, lightSurface }) {
  const L = useMemo(() => brLayout(width, height), [width, height]);
  const pyr = useMemo(() => buildPyramid(L), [L]);
  const city = useMemo(() => buildCity(L), [L]);
  const c = useMemo(() => toneMap(BR_TONE, tone.colors), [tone]);
  const { k, base } = L;
  const night = !lightSurface;
  const neonCols = [c.neon1, c.neon2, c.neon3, c.neon4];
  const stackTops = L.stacks.map((x, i) => [x, base - 40 * k - (190 + hash(i, 1) * 50) * k]);
  const hazeA = useDerivedValue(() => 0.8 + 0.12 * Math.sin(clock.value * 0.4));
  return (
    <Group opacity={tone.alpha}>
      {/* pus: alçak turuncu + yukarı camgöbeği */}
      <Group opacity={hazeA}>
        <Rect x={0} y={base - 420 * k} width={width} height={420 * k}>
          <LinearGradient start={vec(0, base - 420 * k)} end={vec(0, base)} colors={[rgba(c.haze, 0), c.haze, c.hazeHot]} positions={[0, 0.6, 1]} />
        </Rect>
      </Group>
      <Searchlight p={p} clock={clock} L={L} c={c} />
      <AdBlimp p={p} clock={clock} L={L} c={c} />
      {/* sanayi bacaları + alevler */}
      <Path path={city.stacks} color={c.stack} />
      {stackTops.map(([x, top], i) => (
        <Flame key={i} x={x} top={top} i={i} clock={clock} c={c} k={k} />
      ))}
      {/* piramit: arkasında sıcak pus */}
      <Group transform={[{ translateX: pyr.top[0] }, { translateY: pyr.top[1] + L.pyramid[3] * 0.6 }, { scaleY: 0.6 }]}>
        <Glow r={L.pyramid[2] * 0.8} color={c.hazeHot} a={night ? 0.35 : 0.3} mid={0.4} />
      </Group>
      <Path path={pyr.body} color={c.pyramid} />
      <Path path={pyr.lit} color={c.pyramidLit} opacity={night ? 0.8 : 0.9} />
      <Glow cx={pyr.top[0]} cy={pyr.top[1]} r={36 * k} color={c.pyramidLit} a={0.35} mid={0.3} />
      {/* uzak ve yakın kuleler */}
      <Path path={city.far} color={c.towerFar} />
      <Path path={city.winFar} color={c.window} opacity={0.5} />
      <Billboard L={L} clock={clock} c={c} />
      <Spinner p={p} clock={clock} L={L} c={c} />
      <Path path={city.near} color={c.tower} />
      <Path path={city.winNear} color={c.window} opacity={0.75} />
      {city.neon.map((q, i) => (
        <NeonGroup key={i} path={q} color={neonCols[i]} i={i} clock={clock} />
      ))}
      {/* ıslak cadde + neon yansımaları */}
      <Rect x={0} y={base} width={width} height={L.height - base}>
        <LinearGradient start={vec(0, base)} end={vec(0, L.height)} colors={[c.street, c.wet]} />
      </Rect>
      {neonCols.map((col, i) => (
        <Group key={i} transform={[{ translateX: width * (0.15 + i * 0.24) }, { translateY: base + 30 * k }, { scaleX: 0.18 }, { scaleY: 1.3 }]}>
          <Glow r={46 * k} color={col} a={night ? 0.35 : 0.3} mid={0.4} />
        </Group>
      ))}
    </Group>
  );
}
