// components/decor/interstellarScene.js
//
// Interstellar evren sahnesi (OVERLAY.isVec = 55) — tamamı VEKTÖR:
//   • Gök: soluk bulutsu ışığı; ortada dev kara delik — sıcak birikim diski önden geçen ince bir bant,
//     arkasındaki disk ışığı bükülüp deliğin üstünden ve altından halka olarak görünür (kütleçekimsel
//     mercek). Disk yavaşça ışıldar.
//   • Solda halka biçimli uzay istasyonu (12 modül) kendi ekseninde ağır ağır döner.
//   • Alt bant: sığ, dümdüz su gezegeni — ufukta "dağ" sanılan sırtlar, suda ışık çizgileri.
//   • Olay (66 sn'de bir ~25 sn): ufuktaki sırtlardan biri yükselir, dev bir dalga duvarına dönüşüp
//     yaklaşır; tepesinde köpük. Dalga gelmeden sudaki iniş aracı motorlarını yakıp yükselir ve kaçar;
//     dalga söner, su durulur.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[55] (IS_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Circle, Group, LinearGradient, Path, Rect, Skia, vec } from "@shopify/react-native-skia";
import { restU } from "../../utils/weatherParticles";
import { Glow, TAU, groundLayout, hash, rgba, sm, toneMap } from "./seasonKit";

export const IS_TONE = [
  "nebula",
  "diskGlow",
  "diskHot",
  "diskCool",
  "hole",
  "station",
  "stationLit",
  "water",
  "waterDeep",
  "horizon",
  "foam",
  "wave",
  "waveDark",
  "lander",
  "engine",
  "glint",
];

export function isLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  return {
    ...L,
    hole: [width * 0.56, height * 0.2, 30 * k],
    station: [width * 0.2, height * 0.36, 26 * k],
    horizon: ground - 150 * k,
    lander: [width * 0.7, ground - 64 * k],
  };
}

/** Elips üzerindeki noktalar (a0 → a1 radyan). */
function ellipseArc(path, cx, cy, rx, ry, a0, a1, steps = 40) {
  for (let i = 0; i <= steps; i += 1) {
    const a = a0 + ((a1 - a0) * i) / steps;
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
}

function buildHole(L) {
  const { k } = L;
  const [x, y, r] = L.hole;
  // disk: arka yarı (deliğin arkasında, üstte) ve ön yarı (önde, altta)
  const back = Skia.Path.Make();
  ellipseArc(back, x, y, r * 4.2, r * 0.42, Math.PI, TAU);
  const front = Skia.Path.Make();
  ellipseArc(front, x, y, r * 4.2, r * 0.42, 0, Math.PI);
  // ince iç bant (daha sıcak)
  const inner = Skia.Path.Make();
  ellipseArc(inner, x, y, r * 2.4, r * 0.24, 0, Math.PI);
  // mercek halkası: deliğin çevresinde, üstte kalın altta ince
  const lens = Skia.Path.Make();
  ellipseArc(lens, x, y - r * 0.08, r * 1.42, r * 1.32, Math.PI * 1.02, Math.PI * 1.98, 36);
  const lensLow = Skia.Path.Make();
  ellipseArc(lensLow, x, y + r * 0.05, r * 1.22, r * 1.12, Math.PI * 0.08, Math.PI * 0.92, 30);
  return { back, front, inner, lens, lensLow, k };
}

/** Halka istasyon: eğik elips üzerinde dönen 12 modül (önde büyük ve parlak, arkada küçük). */
function Station({ clock, L, c }) {
  const { k } = L;
  const [x, y, r] = L.station;
  const ry = r * 0.42;
  const parts = useDerivedValue(() => {
    const mods = Skia.Path.Make();
    const lit = Skia.Path.Make();
    const spokes = Skia.Path.Make();
    const spin = clock.value * 0.12;
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * TAU + spin;
      const mx = x + Math.cos(a) * r;
      const my = y + Math.sin(a) * ry;
      const depth = 0.75 + 0.25 * Math.sin(a); // alt yarı izleyiciye yakın
      const s = 3.2 * k * depth;
      mods.addRect(Skia.XYWHRect(mx - s, my - s * 0.7, s * 2, s * 1.4));
      if (i % 3 === 0) {
        lit.addRect(Skia.XYWHRect(mx - s * 0.35, my - s * 0.3, s * 0.7, s * 0.6));
        spokes.moveTo(x, y);
        spokes.lineTo(mx, my);
      }
    }
    return { mods, lit, spokes };
  });
  const mods = useDerivedValue(() => parts.value.mods);
  const lit = useDerivedValue(() => parts.value.lit);
  const spokes = useDerivedValue(() => parts.value.spokes);
  const ring = useMemo(() => {
    const q = Skia.Path.Make();
    ellipseArc(q, x, y, r, ry, 0, TAU, 48);
    return q;
  }, [x, y, r, ry]);
  return (
    <Group>
      <Path path={ring} style="stroke" strokeWidth={1.2 * k} color={c.station} opacity={0.6} />
      <Path path={spokes} style="stroke" strokeWidth={0.9 * k} color={c.station} opacity={0.7} />
      <Circle cx={x} cy={y} r={3.2 * k} color={c.station} />
      <Path path={mods} color={c.station} />
      <Path path={lit} color={c.stationLit} />
    </Group>
  );
}

function buildSea(L) {
  const { k, width, horizon } = L;
  // ufuk sırtları: uzaktan dağ gibi duran alçak tümsekler
  const ridges = Skia.Path.Make();
  ridges.moveTo(-10, horizon + 1);
  const n = 7;
  for (let i = 0; i <= n; i += 1) {
    const x = (width * i) / n;
    const h = (6 + hash(i, 4) * 14) * k;
    ridges.quadTo(x - width / n / 2, horizon - h, x, horizon + 1);
  }
  ridges.lineTo(width + 10, horizon + 1);
  ridges.close();
  // su yüzeyi ışık çizgileri (perspektif: ufka yaklaştıkça sık ve kısa)
  const lines = Skia.Path.Make();
  for (let i = 0; i < 26; i += 1) {
    const f = hash(i, 9);
    const y = horizon + 6 * k + Math.pow(f, 1.7) * (L.height - horizon - 20 * k);
    const len = (12 + f * 70) * k;
    const x = hash(i, 11) * (width + len) - len / 2;
    lines.addRect(Skia.XYWHRect(x, y, len, (0.6 + f * 1.4) * k));
  }
  return { ridges, lines };
}

// ───────────────────────────── olay: dev dalga

function wavePath(u, L) {
  "worklet";
  const { k, width, horizon } = L;
  const q = Skia.Path.Make();
  if (u > 1) return q;
  // 0–.18 sırt büyür (dağ gibi), .18–.62 duvar yükselip yaklaşır, .62–.8 çöker ve söner
  const grow = sm(0, 0.18, u) * 0.18 + sm(0.18, 0.62, u) * 0.82;
  const h = (14 + grow * 300) * k;
  const base = horizon + sm(0.18, 0.66, u) * 120 * k;
  const curl = sm(0.4, 0.62, u);
  const peak = width * 0.42;
  q.moveTo(-10, base + 2);
  q.lineTo(-10, base - h * 0.55);
  q.cubicTo(width * 0.12, base - h * 0.78, peak - 80 * k, base - h, peak, base - h);
  // tepe kıvrımı: ileri devrilen ağız
  q.cubicTo(peak + 40 * k, base - h * (1 + 0.04 * curl), peak + 70 * k + 40 * k * curl, base - h * (0.97 - 0.05 * curl), peak + 40 * k + 50 * k * curl, base - h * (0.9 - 0.12 * curl));
  q.quadTo(peak + 30 * k + 30 * k * curl, base - h * (0.84 - 0.1 * curl), peak + 60 * k, base - h * 0.78);
  q.cubicTo(width * 0.78, base - h * 0.7, width * 0.92, base - h * 0.6, width + 10, base - h * 0.52);
  q.lineTo(width + 10, base + 2);
  q.close();
  return q;
}

/** Dalga tabanının altında kademeli sönen etek (tabandaki sert yatay kenarı yumuşatır). */
function skirtPaths(u, L) {
  "worklet";
  const out = [Skia.Path.Make(), Skia.Path.Make(), Skia.Path.Make(), Skia.Path.Make(), Skia.Path.Make()];
  if (u > 1) return out;
  const { k, width } = L;
  const base = L.horizon + sm(0.18, 0.66, u) * 120 * k;
  for (let i = 0; i < 5; i += 1) out[i].addRect(Skia.XYWHRect(-10, base + i * 9 * k, width + 20, 9 * k + 1));
  return out;
}

function Wave({ p, clock, L, c }) {
  const { k, width } = L;
  const u = useDerivedValue(() => restU(p, clock.value));
  const wave = useDerivedValue(() => wavePath(u.value, L));
  const skirt = useDerivedValue(() => skirtPaths(u.value, L));
  const sk0 = useDerivedValue(() => skirt.value[0]);
  const sk1 = useDerivedValue(() => skirt.value[1]);
  const sk2 = useDerivedValue(() => skirt.value[2]);
  const sk3 = useDerivedValue(() => skirt.value[3]);
  const sk4 = useDerivedValue(() => skirt.value[4]);
  const foam = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const v = u.value;
    if (v > 1 || v < 0.2) return q;
    const grow = sm(0, 0.18, v) * 0.18 + sm(0.18, 0.62, v) * 0.82;
    const h = (14 + grow * 300) * k;
    const base = L.horizon + sm(0.18, 0.66, v) * 120 * k;
    const peak = width * 0.42;
    // sırt boyunca ARKAYA savrulan serpinti (eski: sıra sıra boncuk gibi daireler)
    const t = clock.value;
    for (let i = 0; i < 26; i += 1) {
      const f = ((t * (0.35 + hash(i, 5) * 0.25) + hash(i, 6)) % 1 + 1) % 1;
      const x0 = peak - 90 * k + hash(i, 7) * 170 * k;
      const d = Math.abs(x0 - peak) / (120 * k);
      const y0 = base - h * (1 - 0.18 * Math.min(1, d) * Math.min(1, d));
      const x = x0 - f * 46 * k;
      const y = y0 - Math.sin(f * Math.PI) * 18 * k - f * 4 * k;
      q.addCircle(x, y, (1.2 + hash(i, 3) * 2.2) * k * (1 - f * 0.7));
    }
    return q;
  });
  // köpüklü sırt çizgisi + yüzeyde aşağı akan su izleri
  const crest = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const v = u.value;
    if (v > 1 || v < 0.12) return q;
    const grow = sm(0, 0.18, v) * 0.18 + sm(0.18, 0.62, v) * 0.82;
    const h = (14 + grow * 300) * k;
    const base = L.horizon + sm(0.18, 0.66, v) * 120 * k;
    const peak = width * 0.42;
    for (let i = 0; i <= 20; i += 1) {
      const f = i / 20;
      const x = peak - 95 * k + f * 175 * k;
      const d = Math.min(1.3, Math.abs(x - peak) / (120 * k));
      const y = base - h * (1 - 0.18 * d * d) + Math.sin(clock.value * 2.4 + i * 0.9) * 1.6 * k;
      if (i === 0) q.moveTo(x, y);
      else q.lineTo(x, y);
    }
    return q;
  });
  const streaks = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const v = u.value;
    if (v > 1 || v < 0.2) return q;
    const grow = sm(0, 0.18, v) * 0.18 + sm(0.18, 0.62, v) * 0.82;
    const h = (14 + grow * 300) * k;
    const base = L.horizon + sm(0.18, 0.66, v) * 120 * k;
    const peak = width * 0.42;
    for (let i = 0; i < 7; i += 1) {
      const x = peak - 90 * k + i * 27 * k + Math.sin(clock.value * 0.8 + i) * 3 * k;
      const d = Math.min(1.3, Math.abs(x - peak) / (120 * k));
      const top = base - h * (1 - 0.18 * d * d) + 12 * k;
      const len = h * (0.35 + hash(i, 8) * 0.35);
      q.moveTo(x, top);
      q.quadTo(x - 6 * k, top + len * 0.5, x - 2 * k, top + len);
    }
    return q;
  });
  const alpha = useDerivedValue(() => {
    const v = u.value;
    return v > 1 ? 0 : sm(0, 0.06, v) * (1 - sm(0.66, 0.82, v));
  });
  return (
    <Group opacity={alpha}>
      <Path path={sk0} color={c.waveDark} opacity={0.75} />
      <Path path={sk1} color={c.waveDark} opacity={0.55} />
      <Path path={sk2} color={c.waveDark} opacity={0.36} />
      <Path path={sk3} color={c.waveDark} opacity={0.2} />
      <Path path={sk4} color={c.waveDark} opacity={0.08} />
      <Path path={wave}>
        <LinearGradient start={vec(0, L.horizon - 320 * k)} end={vec(0, L.horizon + 120 * k)} colors={[c.wave, c.waveDark]} />
      </Path>
      {/* yüzeye vuran ışık: tepeye yakın açık bant */}
      <Path path={wave}>
        <LinearGradient
          start={vec(width * 0.1, 0)}
          end={vec(width * 0.75, 0)}
          colors={[rgba(c.foam, 0), rgba(c.foam, 0.14), rgba(c.foam, 0.02)]}
          positions={[0, 0.55, 1]}
        />
      </Path>
      <Path path={streaks} style="stroke" strokeWidth={1.6 * k} strokeCap="round" color={rgba(c.foam, 0.16)} />
      <Path path={crest} style="stroke" strokeWidth={7 * k} strokeCap="round" strokeJoin="round" color={rgba(c.foam, 0.35)} />
      <Path path={crest} style="stroke" strokeWidth={2.6 * k} strokeCap="round" strokeJoin="round" color={c.foam} opacity={0.9} />
      <Path path={foam} color={c.foam} opacity={0.75} />
    </Group>
  );
}

function Lander({ p, clock, L, c }) {
  const { k, width } = L;
  const [lx, ly] = L.lander;
  const body = useMemo(() => {
    const q = Skia.Path.Make();
    // kanatlı, alçak gövdeli iniş aracı (yandan)
    q.moveTo(-26 * k, 0);
    q.lineTo(-20 * k, -9 * k);
    q.lineTo(14 * k, -11 * k);
    q.lineTo(28 * k, -4 * k);
    q.lineTo(24 * k, 0);
    q.close();
    q.moveTo(-14 * k, -6 * k);
    q.lineTo(-30 * k, -2 * k);
    q.lineTo(-12 * k, -2 * k);
    q.close();
    q.addRect(Skia.XYWHRect(-4 * k, -15 * k, 10 * k, 5 * k));
    return q;
  }, [k]);
  const at = useDerivedValue(() => {
    const u = restU(p, clock.value);
    const lift = u > 1 ? 0 : sm(0.42, 0.7, u) * (1 - sm(0.88, 0.9, u));
    const x = lx + lift * lift * (width * 0.5);
    const y = ly - lift * (ly - 40 * k) + Math.sin(clock.value * 1.3) * (1 - lift) * 0.8 * k;
    return [{ translateX: x }, { translateY: y }, { rotate: -0.35 * sm(0.42, 0.55, u > 1 ? 0 : u) }];
  });
  const burn = useDerivedValue(() => {
    const u = restU(p, clock.value);
    return u > 1 ? 0 : sm(0.36, 0.44, u) * (1 - sm(0.72, 0.78, u)) * (0.85 + 0.15 * Math.sin(clock.value * 23));
  });
  const shown = useDerivedValue(() => {
    const u = restU(p, clock.value);
    return u > 1 ? 1 : 1 - sm(0.7, 0.76, u) + sm(0.92, 1, u);
  });
  return (
    <Group opacity={shown} transform={at}>
      <Group opacity={burn}>
        <Glow cx={-26 * k} cy={-3 * k} r={22 * k} color={c.engine} a={0.9} mid={0.35} />
        <Glow cx={0} cy={4 * k} r={16 * k} color={c.engine} a={0.6} mid={0.3} />
      </Group>
      <Path path={body} color={c.lander} />
      <Rect x={10 * k} y={-9 * k} width={7 * k} height={2.4 * k} color={c.glint} opacity={0.7} />
    </Group>
  );
}

export default function InterstellarScene({ p, clock, width, height, tone, lightSurface }) {
  const L = useMemo(() => isLayout(width, height), [width, height]);
  const hole = useMemo(() => buildHole(L), [L]);
  const sea = useMemo(() => buildSea(L), [L]);
  const c = useMemo(() => toneMap(IS_TONE, tone.colors), [tone]);
  const { k, ground, horizon } = L;
  const night = !lightSurface;
  const [hx, hy, hr] = L.hole;
  const pulse = useDerivedValue(() => 0.86 + 0.1 * Math.sin(clock.value * 0.7) + 0.04 * Math.sin(clock.value * 2.3));
  const shimmer = useDerivedValue(() => 0.5 + 0.25 * Math.sin(clock.value * 0.9));
  // dalga yaklaşırken su kararır
  const dim = useDerivedValue(() => {
    const u = restU(p, clock.value);
    return u > 1 ? 0 : 0.35 * sm(0.2, 0.55, u) * (1 - sm(0.66, 0.85, u));
  });
  return (
    <Group opacity={tone.alpha}>
      {/* bulutsu */}
      <Group transform={[{ translateX: width * 0.3 }, { translateY: height * 0.12 }, { scaleY: 0.55 }]}>
        <Glow r={width * 0.6} color={c.nebula} a={night ? 0.22 : 0.18} mid={0.35} />
      </Group>
      {/* kara delik: ışık, arka disk, mercek halkası, karanlık çekirdek, ön disk */}
      <Group opacity={pulse}>
        <Glow cx={hx} cy={hy} r={hr * 5.2} color={c.diskGlow} a={night ? 0.3 : 0.35} mid={0.3} />
        <Path path={hole.back} style="stroke" strokeWidth={5 * k} strokeCap="round" color={c.diskCool} opacity={0.75} />
        <Path path={hole.lens} style="stroke" strokeWidth={7 * k} strokeCap="round" color={c.diskHot} />
        <Path path={hole.lens} style="stroke" strokeWidth={2.4 * k} strokeCap="round" color={c.glint} opacity={0.7} />
        <Path path={hole.lensLow} style="stroke" strokeWidth={2.6 * k} strokeCap="round" color={c.diskHot} opacity={0.85} />
      </Group>
      <Circle cx={hx} cy={hy} r={hr} color={c.hole} />
      <Group opacity={pulse}>
        <Path path={hole.front} style="stroke" strokeWidth={6 * k} strokeCap="round" color={c.diskHot} />
        <Path path={hole.inner} style="stroke" strokeWidth={2.2 * k} strokeCap="round" color={c.glint} opacity={0.85} />
      </Group>
      {/* halka istasyon */}
      <Station clock={clock} L={L} c={c} />
      {/* su gezegeni */}
      <Path path={sea.ridges} color={c.horizon} opacity={0.9} />
      <Rect x={0} y={horizon} width={width} height={height - horizon}>
        <LinearGradient start={vec(0, horizon)} end={vec(0, height)} colors={[c.water, c.waterDeep]} />
      </Rect>
      <Group transform={[{ translateX: hx }, { translateY: horizon + 30 * k }, { scaleX: 0.22 }, { scaleY: 1.4 }]}>
        <Glow r={70 * k} color={c.diskGlow} a={night ? 0.22 : 0.2} mid={0.4} />
      </Group>
      <Group opacity={shimmer}>
        <Path path={sea.lines} color={c.glint} />
      </Group>
      <Rect x={0} y={horizon} width={width} height={height - horizon} color={c.waterDeep} opacity={dim} />
      <Rect x={0} y={horizon - 0.5 * k} width={width} height={1.2 * k} color={c.glint} opacity={0.35} />
      <Wave p={p} clock={clock} L={L} c={c} />
      <Lander p={p} clock={clock} L={L} c={c} />
      {/* alt kararma: sert kenar yerine degrade */}
      <Rect x={0} y={ground - 20 * k} width={width} height={height - ground + 20 * k}>
        <LinearGradient start={vec(0, ground - 20 * k)} end={vec(0, height)} colors={[rgba(c.waterDeep, 0), rgba(c.waterDeep, 0.45)]} />
      </Rect>
    </Group>
  );
}

