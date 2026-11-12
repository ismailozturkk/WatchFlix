// components/decor/inceptionScene.js
//
// Inception evren sahnesi (OVERLAY.inVec = 65) — tamamı VEKTÖR:
//   • Aşağıda Paris sokağı: mansart çatılı taş binalar, balkon çizgileri, yanan pencereler,
//     çizgili kafe tentesi, sokak lambaları.
//   • Tepede ters dönmüş ikinci şehir: rüya katlandığı için gökyüzünden aşağı sarkar (puslu).
//   • Önde masa kenarında dönen topaç: çizgileri döner, hafifçe yalpalar.
//   • Olay (70 sn'de bir ~28 sn): şehir katlanır — tepedeki şehir aşağı doğru uzayıp yaklaşır,
//     sahne hafifçe döner; topaç sallanmaya başlar… ve yeniden toparlanır.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[65] (IN_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Group, LinearGradient, Path, Rect, Skia, vec } from "@shopify/react-native-skia";
import { restU } from "../../utils/weatherParticles";
import { Glow, groundLayout, hash, rgba, sm, toneMap } from "./seasonKit";

export const IN_TONE = [
  "haze",
  "bldFar",
  "bld",
  "bldDark",
  "roof",
  "window",
  "windowLit",
  "awning",
  "awningB",
  "lamp",
  "street",
  "table",
  "tableHi",
  "top",
  "topHi",
  "topDark",
  "upCity",
  "fog",
];

export function inLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  return { ...L, base: ground - 16 * k, table: ground + 34 * k };
}

// ───────────────────────────── durağan yollar

/** Haussmann bloğu dizisi; yerel koordinat: zemin y = 0, binalar yukarı (−y). */
function buildBlocks(width, k, seed, lit) {
  const body = Skia.Path.Make();
  const dark = Skia.Path.Make();
  const roof = Skia.Path.Make();
  const win = Skia.Path.Make();
  const winLit = Skia.Path.Make();
  let x = -20 * k;
  let i = 0;
  while (x < width + 20 * k) {
    const w = (70 + hash(seed + i, 1) * 40) * k;
    const floors = 4 + Math.floor(hash(seed + i, 2) * 3);
    const fh = 24 * k;
    const h = floors * fh + 14 * k;
    body.addRect(Skia.XYWHRect(x, -h, w, h));
    // mansart çatı + çatı pencereleri + bacalar
    const rh = 26 * k;
    roof.moveTo(x - 2 * k, -h);
    roof.lineTo(x + 10 * k, -h - rh);
    roof.lineTo(x + w - 10 * k, -h - rh);
    roof.lineTo(x + w + 2 * k, -h);
    roof.close();
    for (let d = 0; d < 3; d += 1) {
      const dx = x + w * (0.2 + d * 0.28);
      roof.addRect(Skia.XYWHRect(dx - 5 * k, -h - rh * 0.8, 10 * k, rh * 0.6));
      win.addRect(Skia.XYWHRect(dx - 3 * k, -h - rh * 0.7, 6 * k, rh * 0.45));
    }
    roof.addRect(Skia.XYWHRect(x + w * 0.12, -h - rh - 12 * k, 8 * k, 12 * k));
    roof.addRect(Skia.XYWHRect(x + w * 0.78, -h - rh - 10 * k, 10 * k, 10 * k));
    // kat çizgileri (balkon) + pencereler
    const cols = Math.max(3, Math.floor(w / (16 * k)));
    for (let f = 0; f < floors; f += 1) {
      const y = -h + 10 * k + f * fh;
      dark.addRect(Skia.XYWHRect(x, y + fh - 4 * k, w, 1.6 * k));
      for (let cI = 0; cI < cols; cI += 1) {
        const wx = x + 6 * k + cI * ((w - 12 * k) / cols);
        const ww = ((w - 12 * k) / cols) * 0.55;
        const target = lit && hash(seed * 7 + i * 13 + f, cI) > 0.62 ? winLit : win;
        target.addRect(Skia.XYWHRect(wx, y + 3 * k, ww, fh - 10 * k));
      }
    }
    // zemin kat: büyük kemerli kapılar
    dark.addRect(Skia.XYWHRect(x, -14 * k, w, 14 * k));
    x += w + 2 * k;
    i += 1;
  }
  return { body, dark, roof, win, winLit };
}

function buildStreet(L) {
  const { k, width, base, height, table } = L;
  const street = Skia.Path.Make();
  street.addRect(Skia.XYWHRect(-10, base, width + 20, height - base + 10));
  const awn = Skia.Path.Make();
  const awnB = Skia.Path.Make();
  const ax = width * 0.08;
  const aw = 120 * k;
  for (let i = 0; i < 8; i += 1) {
    const x = ax + (i * aw) / 8;
    const target = i % 2 ? awnB : awn;
    target.moveTo(x, base - 52 * k);
    target.lineTo(x + aw / 8, base - 52 * k);
    target.lineTo(x + aw / 8 + 3 * k, base - 34 * k);
    target.quadTo(x + aw / 16 + 1.5 * k, base - 30 * k, x + 3 * k, base - 34 * k);
    target.close();
  }
  // masalar + lambalar
  const lamps = [];
  const poles = Skia.Path.Make();
  [0.46, 0.86].forEach((f) => {
    const x = width * f;
    poles.addRect(Skia.XYWHRect(x - 1.5 * k, base - 80 * k, 3 * k, 80 * k));
    poles.addRect(Skia.XYWHRect(x - 6 * k, base - 90 * k, 12 * k, 10 * k));
    lamps.push([x, base - 86 * k]);
  });
  for (let i = 0; i < 3; i += 1) {
    const x = ax + 20 * k + i * 36 * k;
    poles.addCircle(x, base - 14 * k, 8 * k);
    poles.addRect(Skia.XYWHRect(x - 1 * k, base - 14 * k, 2 * k, 14 * k));
  }
  // masa kenarı (ön plan)
  // masa: perspektifte yatık sol kenarlı, yuvarlatılmış köşeli ahşap yüzey + damar çizgileri
  const tableP = Skia.Path.Make();
  const tx0 = width * 0.5;
  tableP.moveTo(tx0 - 30 * k, height + 10);
  tableP.lineTo(tx0 - 4 * k, table + 10 * k);
  tableP.quadTo(tx0, table, tx0 + 12 * k, table);
  tableP.lineTo(width + 10, table);
  tableP.lineTo(width + 10, height + 10);
  tableP.close();
  const tableHi = Skia.Path.Make();
  tableHi.moveTo(tx0 - 4 * k, table + 10 * k);
  tableHi.quadTo(tx0, table, tx0 + 12 * k, table);
  tableHi.lineTo(width + 10, table);
  const grain = Skia.Path.Make();
  for (let i = 0; i < 7; i += 1) {
    const y = table + (8 + i * 9 + hash(i, 71) * 4) * k;
    const xl = tx0 - 4 * k - ((y - table) / (height - table)) * 26 * k + 8 * k;
    grain.moveTo(xl, y);
    grain.cubicTo(xl + 50 * k, y - 3 * k, xl + 110 * k, y + 4 * k, width + 10, y + (hash(i, 72) - 0.5) * 4 * k);
  }
  return { street, awn, awnB, lamps, poles, table: tableP, tableHi, grain };
}

// ───────────────────────────── topaç

function topPaths(spin, k) {
  "worklet";
  const u = k * 1.75;
  const body = Skia.Path.Make();
  const hi = Skia.Path.Make();
  const dark = Skia.Path.Make();
  // sap
  body.addRect(Skia.XYWHRect(-2.4 * u, -46 * u, 4.8 * u, 16 * u));
  // gövde: geniş disk + sivri uç
  body.moveTo(-16 * u, -30 * u);
  body.quadTo(-18 * u, -24 * u, -14 * u, -20 * u);
  body.lineTo(0, 0);
  body.lineTo(14 * u, -20 * u);
  body.quadTo(18 * u, -24 * u, 16 * u, -30 * u);
  body.quadTo(0, -36 * u, -16 * u, -30 * u);
  body.close();
  // dönen çizgiler: x = sin(faz) ile kenarlar arasında gezer
  for (let i = 0; i < 3; i += 1) {
    const ph = spin + (i / 3) * Math.PI * 2;
    const s = Math.sin(ph);
    const front = Math.cos(ph) > 0;
    const target = front ? hi : dark;
    const x = s * 15 * u;
    target.moveTo(x - 1.2 * u, -31 * u);
    target.lineTo(x + 1.2 * u, -31 * u);
    target.lineTo(x * 0.1 + 0.6 * u, -2 * u);
    target.lineTo(x * 0.1 - 0.6 * u, -2 * u);
    target.close();
  }
  hi.addOval(Skia.XYWHRect(-10 * u, -34 * u, 20 * u, 4 * u));
  return { body, hi, dark };
}

function SpinningTop({ p, clock, L, c }) {
  const { k, width, table } = L;
  const d = useDerivedValue(() => topPaths(clock.value * 22, k));
  const body = useDerivedValue(() => d.value.body);
  const hi = useDerivedValue(() => d.value.hi);
  const dark = useDerivedValue(() => d.value.dark);
  const at = useDerivedValue(() => {
    const u = restU(p, clock.value);
    const wob = u > 1 ? 0 : sm(0.5, 0.62, u) * (1 - sm(0.66, 0.74, u));
    const tilt = Math.sin(clock.value * 6) * (0.03 + wob * 0.16);
    return [{ translateX: width * 0.76 + Math.sin(clock.value * 3) * wob * 3 * k }, { translateY: table + 1 * k }, { rotate: tilt }];
  });
  return (
    <Group>
      <Group transform={[{ translateX: width * 0.76 }, { translateY: table + 2 * k }, { scaleY: 0.18 }]}>
        <Glow r={30 * k} color={c.topDark} a={0.5} mid={0.4} />
      </Group>
      <Group transform={at}>
        <Path path={body} color={c.top} />
        <Path path={dark} color={c.topDark} />
        <Path path={hi} color={c.topHi} />
      </Group>
    </Group>
  );
}

export default function InceptionScene({ p, clock, width, height, tone, lightSurface }) {
  const L = useMemo(() => inLayout(width, height), [width, height]);
  const { k, base } = L;
  const near = useMemo(() => buildBlocks(width, k, 3, true), [width, k]);
  const far = useMemo(() => buildBlocks(width * 1.2, k * 0.7, 11, false), [width, k]);
  const up = useMemo(() => buildBlocks(width * 1.3, k * 0.9, 21, true), [width, k]);
  const street = useMemo(() => buildStreet(L), [L]);
  const c = useMemo(() => toneMap(IN_TONE, tone.colors), [tone]);
  const night = !lightSurface;
  // katlanma: 0 = dinlenme (tepede sıkışık şerit), 1 = tam katlanmış (iri, aşağı sarkan)
  const fold = useDerivedValue(() => {
    const u = restU(p, clock.value);
    return u > 1 ? 0 : sm(0.08, 0.4, u) * (1 - sm(0.72, 0.96, u));
  });
  const topY = base - 760 * k;
  const upAt = useDerivedValue(() => {
    const f = fold.value;
    return [
      { translateX: width * 0.5 },
      { translateY: topY + f * 40 * k },
      { rotate: Math.PI + f * 0.06 },
      { translateX: -width * 0.65 },
      { scaleY: 0.45 + f * 0.75 },
    ];
  });
  const upA = useDerivedValue(() => 0.55 + fold.value * 0.35);
  const tilt = useDerivedValue(() => {
    const f = fold.value;
    return [
      { translateX: width / 2 },
      { translateY: base },
      { rotate: -f * 0.035 },
      { translateX: -width / 2 },
      { translateY: -base },
    ];
  });
  const lampA = useDerivedValue(() => (night ? 0.7 : 0.35) * (0.9 + 0.1 * Math.sin(clock.value * 5)));
  return (
    <Group opacity={tone.alpha}>
      {/* tepeden sarkan, katlanmış şehir */}
      <Group transform={upAt} opacity={upA}>
        <Path path={up.body} color={c.upCity} />
        <Path path={up.roof} color={c.upCity} />
        <Path path={up.win} color={c.fog} opacity={0.5} />
        <Path path={up.winLit} color={c.windowLit} opacity={0.6} />
      </Group>
      <Group transform={tilt}>
        {/* uzak bloklar */}
        <Group transform={[{ translateX: -width * 0.1 }, { translateY: base - 60 * k }]}>
          <Path path={far.body} color={c.bldFar} />
          <Path path={far.roof} color={c.bldFar} />
        </Group>
        <Rect x={0} y={base - 260 * k} width={width} height={200 * k}>
          <LinearGradient start={vec(0, base - 260 * k)} end={vec(0, base - 60 * k)} colors={[rgba(c.haze, 0), c.haze]} />
        </Rect>
        {/* yakın sokak */}
        <Group transform={[{ translateY: base }]}>
          <Path path={near.body} color={c.bld} />
          <Path path={near.dark} color={c.bldDark} />
          <Path path={near.roof} color={c.roof} />
          <Path path={near.win} color={c.window} />
          <Path path={near.winLit} color={c.windowLit} />
        </Group>
        <Path path={street.street} color={c.street} />
        <Path path={street.awn} color={c.awning} />
        <Path path={street.awnB} color={c.awningB} />
        <Path path={street.poles} color={c.bldDark} />
        {street.lamps.map(([x, y], i) => (
          <Group key={i} opacity={lampA} transform={[{ translateX: x }, { translateY: y }]}>
            <Glow r={40 * k} color={c.lamp} a={0.9} mid={0.3} />
          </Group>
        ))}
      </Group>
      {/* masa + topaç */}
      <Path path={street.table} color={c.table} />
      <Path path={street.grain} style="stroke" strokeWidth={0.8 * k} color={rgba(c.tableHi, 0.35)} />
      <Path path={street.tableHi} style="stroke" strokeWidth={2.2 * k} strokeCap="round" color={c.tableHi} />
      <SpinningTop p={p} clock={clock} L={L} c={c} />
    </Group>
  );
}
