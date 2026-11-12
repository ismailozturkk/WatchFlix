// components/decor/squidGameScene.js
//
// Squid Game evren sahnesi (OVERLAY.sqVec = 68) — tamamı VEKTÖR:
//   • Oyun alanı: duvarlara boyanmış mavi gök + beyaz bulutlar, kumlu saha (perspektif çizgileri).
//   • Arkada çıplak dallı ağaç ve dev bebek (turuncu elbise, sarı bluz, iki örgülü siyah saç);
//     dinlenmede sırtı dönük.
//   • Sahada yeşil eşofmanlı oyuncular (uzaklığa göre küçülür), kenarlarda daire/üçgen/kare maskeli
//     pembe tulumlu muhafızlar.
//   • Olay (60 sn'de bir ~25 sn): "kırmızı ışık, yeşil ışık" — bebek üç kez döner; yeşilde oyuncular
//     koşar gibi sallanır, kırmızıda donar, bebeğin gözleri ve sahne kırmızıya boyanır.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[68] (SQ_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Group, LinearGradient, Path, Rect, Skia, vec } from "@shopify/react-native-skia";
import { restU } from "../../utils/weatherParticles";
import { Glow, addCloud, groundLayout, hash, sm, toneMap } from "./seasonKit";

export const SQ_TONE = [
  "wallSky",
  "wallSkyLow",
  "cloud",
  "wallEdge",
  "field",
  "fieldLine",
  "tree",
  "dress",
  "shirt",
  "skin",
  "hair",
  "sock",
  "eye",
  "player",
  "playerHi",
  "guard",
  "mask",
  "maskSym",
  "red",
];

export function sqLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  return { ...L, base: ground - 10 * k, wallBottom: ground - 170 * k, wallTop: ground - 560 * k };
}

/** Kırmızı ışık yoğunluğu (0 yeşil, 1 kırmızı): olay boyunca üç dönüş. */
function redLight(u) {
  "worklet";
  if (u > 1) return 0;
  let r = 0;
  for (let i = 0; i < 3; i += 1) {
    const s = 0.14 + i * 0.27;
    r = Math.max(r, sm(s, s + 0.03, u) * (1 - sm(s + 0.13, s + 0.16, u)));
  }
  return r;
}

// ───────────────────────────── durağan yollar

function buildArena(L) {
  const { k, width, height, wallBottom, wallTop } = L;
  const clouds = Skia.Path.Make();
  [
    [0.18, 0.2, 120, 40],
    [0.62, 0.12, 150, 46],
    [0.86, 0.42, 110, 36],
    [0.34, 0.5, 130, 40],
  ].forEach(([fx, fy, w, h], i) => addCloud(clouds, width * fx, wallTop + (wallBottom - wallTop) * fy, w * k, h * k, i + 2));
  const edge = Skia.Path.Make();
  edge.addRect(Skia.XYWHRect(-10, wallBottom - 6 * k, width + 20, 6 * k));
  edge.addRect(Skia.XYWHRect(-10, wallTop - 8 * k, width + 20, 8 * k));
  // duvar köşe çizgileri (perspektif)
  edge.addRect(Skia.XYWHRect(width * 0.04, wallTop, 2 * k, wallBottom - wallTop));
  edge.addRect(Skia.XYWHRect(width * 0.96, wallTop, 2 * k, wallBottom - wallTop));
  const field = Skia.Path.Make();
  field.addRect(Skia.XYWHRect(-10, wallBottom, width + 20, height - wallBottom + 10));
  const lines = Skia.Path.Make();
  // başlangıç / bitiş çizgileri
  lines.addRect(Skia.XYWHRect(-10, wallBottom + 30 * k, width + 20, 2 * k));
  lines.addRect(Skia.XYWHRect(-10, height - 60 * k, width + 20, 3 * k));
  for (let i = 0; i < 40; i += 1) {
    const x = hash(i, 4) * width;
    const y = wallBottom + 10 * k + hash(i, 5) * (height - wallBottom);
    lines.addCircle(x, y, (0.8 + hash(i, 6)) * k);
  }
  // ağaç: gövde + çatallanan dallar (çizgi)
  const tree = Skia.Path.Make();
  const tx = width * 0.22;
  const tb = wallBottom + 22 * k;
  tree.moveTo(tx - 6 * k, tb);
  tree.lineTo(tx - 3 * k, tb - 110 * k);
  tree.lineTo(tx + 3 * k, tb - 110 * k);
  tree.lineTo(tx + 6 * k, tb);
  tree.close();
  const branches = Skia.Path.Make();
  const grow = (x, y, a, len, depth, seed) => {
    if (depth === 0) return;
    const ex = x + Math.cos(a) * len;
    const ey = y + Math.sin(a) * len;
    branches.moveTo(x, y);
    branches.lineTo(ex, ey);
    grow(ex, ey, a - 0.45 - hash(seed, 1) * 0.2, len * 0.72, depth - 1, seed * 2 + 1);
    grow(ex, ey, a + 0.4 + hash(seed, 2) * 0.2, len * 0.7, depth - 1, seed * 2 + 2);
  };
  grow(tx, tb - 104 * k, -Math.PI / 2, 40 * k, 5, 1);
  // tavan: duvarın üstünde çelik makas kirişler + asılı projektörler (boş üst şerit kalmaz)
  const truss = Skia.Path.Make();
  const rows = [wallTop * 0.28, wallTop * 0.62];
  rows.forEach((y, r) => {
    truss.moveTo(-10, y);
    truss.lineTo(width + 10, y);
    truss.moveTo(-10, y + 14 * k);
    truss.lineTo(width + 10, y + 14 * k);
    const n = 9 + r * 2;
    for (let i = 0; i <= n; i += 1) {
      const x0 = (i / n) * width;
      const x1 = ((i + 0.5) / n) * width;
      truss.moveTo(x0, y + 14 * k);
      truss.lineTo(x1, y);
      truss.lineTo(((i + 1) / n) * width, y + 14 * k);
    }
  });
  for (let i = 0; i < 6; i += 1) {
    const x = ((i + 0.5) / 6) * width;
    truss.moveTo(x, rows[1] + 14 * k);
    truss.lineTo(x, wallTop - 8 * k);
  }
  const lamps = [0.2, 0.5, 0.8].map((f) => [width * f, rows[1] + 14 * k]);
  const lampBody = Skia.Path.Make();
  lamps.forEach(([x, y]) => {
    lampBody.addRect(Skia.XYWHRect(x - 1 * k, y, 2 * k, 18 * k));
    lampBody.addRRect(Skia.RRectXY(Skia.XYWHRect(x - 9 * k, y + 16 * k, 18 * k, 9 * k), 3 * k, 3 * k));
  });
  const wall = Skia.XYWHRect(0, wallTop, width, wallBottom - wallTop);
  return { clouds, edge, field, lines, tree, branches, truss, lamps, lampBody, wall };
}

function buildDoll(k) {
  const u = k * 1.15;
  const dress = Skia.Path.Make();
  dress.moveTo(-18 * u, -88 * u);
  dress.lineTo(18 * u, -88 * u);
  dress.lineTo(30 * u, -36 * u);
  dress.lineTo(-30 * u, -36 * u);
  dress.close();
  const shirt = Skia.Path.Make();
  shirt.addRRect(Skia.RRectXY(Skia.XYWHRect(-17 * u, -110 * u, 34 * u, 26 * u), 6 * u, 6 * u));
  shirt.addRRect(Skia.RRectXY(Skia.XYWHRect(-26 * u, -108 * u, 10 * u, 22 * u), 4 * u, 4 * u));
  shirt.addRRect(Skia.RRectXY(Skia.XYWHRect(16 * u, -108 * u, 10 * u, 22 * u), 4 * u, 4 * u));
  const skin = Skia.Path.Make();
  skin.addRect(Skia.XYWHRect(-12 * u, -36 * u, 7 * u, 26 * u));
  skin.addRect(Skia.XYWHRect(5 * u, -36 * u, 7 * u, 26 * u));
  skin.addCircle(-22 * u, -84 * u, 4 * u);
  skin.addCircle(22 * u, -84 * u, 4 * u);
  const sock = Skia.Path.Make();
  sock.addRRect(Skia.RRectXY(Skia.XYWHRect(-14 * u, -12 * u, 10 * u, 12 * u), 3 * u, 3 * u));
  sock.addRRect(Skia.RRectXY(Skia.XYWHRect(4 * u, -12 * u, 10 * u, 12 * u), 3 * u, 3 * u));
  // baş: arka (tamamı saç) / ön (yüz + kakül)
  const back = Skia.Path.Make();
  back.addCircle(0, -132 * u, 24 * u);
  back.addCircle(-24 * u, -120 * u, 7 * u);
  back.addCircle(24 * u, -120 * u, 7 * u);
  back.addRRect(Skia.RRectXY(Skia.XYWHRect(-28 * u, -118 * u, 8 * u, 18 * u), 4 * u, 4 * u));
  back.addRRect(Skia.RRectXY(Skia.XYWHRect(20 * u, -118 * u, 8 * u, 18 * u), 4 * u, 4 * u));
  const face = Skia.Path.Make();
  face.addOval(Skia.XYWHRect(-17 * u, -142 * u, 34 * u, 32 * u));
  const fringe = Skia.Path.Make();
  fringe.moveTo(-24 * u, -128 * u);
  fringe.quadTo(-24 * u, -158 * u, 0, -157 * u);
  fringe.quadTo(24 * u, -158 * u, 24 * u, -128 * u);
  fringe.lineTo(17 * u, -134 * u);
  fringe.lineTo(-17 * u, -134 * u);
  fringe.close();
  const eyes = Skia.Path.Make();
  eyes.addCircle(-7 * u, -126 * u, 2.4 * u);
  eyes.addCircle(7 * u, -126 * u, 2.4 * u);
  const cheeks = Skia.Path.Make();
  cheeks.addOval(Skia.XYWHRect(-13 * u, -120 * u, 6 * u, 3 * u));
  cheeks.addOval(Skia.XYWHRect(7 * u, -120 * u, 6 * u, 3 * u));
  return { dress, shirt, skin, sock, back, face, fringe, eyes, cheeks, eyeY: -126 * u, u };
}

/** Oyuncu (arkadan): eşofman, sırt şeridi; yerel taban (0,0). */
function playerPaths(k) {
  const body = Skia.Path.Make();
  const hi = Skia.Path.Make();
  body.addCircle(0, -30 * k, 4.4 * k);
  body.addRRect(Skia.RRectXY(Skia.XYWHRect(-6 * k, -26 * k, 12 * k, 15 * k), 3 * k, 3 * k));
  body.addRect(Skia.XYWHRect(-5 * k, -12 * k, 4 * k, 12 * k));
  body.addRect(Skia.XYWHRect(1 * k, -12 * k, 4 * k, 12 * k));
  hi.addRect(Skia.XYWHRect(-3 * k, -23 * k, 6 * k, 5 * k));
  return { body, hi };
}

function guardPaths(k) {
  const body = Skia.Path.Make();
  body.addRRect(Skia.RRectXY(Skia.XYWHRect(-8 * k, -36 * k, 16 * k, 22 * k), 4 * k, 4 * k));
  body.addRect(Skia.XYWHRect(-7 * k, -16 * k, 6 * k, 16 * k));
  body.addRect(Skia.XYWHRect(1 * k, -16 * k, 6 * k, 16 * k));
  body.addCircle(0, -42 * k, 9 * k); // başlık
  const mask = Skia.Path.Make();
  mask.addOval(Skia.XYWHRect(-6.5 * k, -48 * k, 13 * k, 14 * k));
  return { body, mask };
}

function symbolPath(kind, x, y, r) {
  const q = Skia.Path.Make();
  if (kind === 0) q.addCircle(x, y, r);
  else if (kind === 1) {
    q.moveTo(x, y - r);
    q.lineTo(x + r * 0.95, y + r * 0.7);
    q.lineTo(x - r * 0.95, y + r * 0.7);
    q.close();
  } else q.addRect(Skia.XYWHRect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6));
  return q;
}

// ───────────────────────────── canlı parçalar

function Doll({ p, clock, L, c }) {
  const { k, width, wallBottom } = L;
  const doll = useMemo(() => buildDoll(k), [k]);
  const red = useDerivedValue(() => redLight(restU(p, clock.value)));
  // dönüş: baş yatayda daralıp geri açılır; 0.5'te arka ↔ ön
  const headT = useDerivedValue(() => [{ scaleX: Math.max(0.05, Math.abs(1 - 2 * Math.min(1, red.value * 1.0))) }]);
  const backA = useDerivedValue(() => (red.value < 0.5 ? 1 : 0));
  const faceA = useDerivedValue(() => (red.value >= 0.5 ? 1 : 0));
  const eyeA = useDerivedValue(() => (red.value >= 0.5 ? 0.6 + 0.4 * Math.sin(clock.value * 10) : 0));
  const sing = useDerivedValue(() => [
    { translateX: width * 0.56 },
    { translateY: wallBottom + 40 * k },
    { rotate: red.value > 0.05 ? 0 : Math.sin(clock.value * 2.2) * 0.015 },
  ]);
  return (
    <Group transform={sing}>
      <Path path={doll.sock} color={c.sock} />
      <Path path={doll.skin} color={c.skin} />
      <Path path={doll.dress} color={c.dress} />
      <Path path={doll.shirt} color={c.shirt} />
      <Group transform={headT}>
        <Group opacity={backA}>
          <Path path={doll.back} color={c.hair} />
        </Group>
        <Group opacity={faceA}>
          <Path path={doll.back} color={c.hair} />
          <Path path={doll.face} color={c.skin} />
          <Path path={doll.fringe} color={c.hair} />
          <Path path={doll.eyes} color={c.hair} />
          <Path path={doll.cheeks} color={c.dress} opacity={0.5} />
        </Group>
      </Group>
      <Group opacity={eyeA}>
        <Group transform={[{ translateX: -7 * doll.u }, { translateY: doll.eyeY }]}>
          <Glow r={9 * k} color={c.eye} a={1} mid={0.5} />
        </Group>
        <Group transform={[{ translateX: 7 * doll.u }, { translateY: doll.eyeY }]}>
          <Glow r={9 * k} color={c.eye} a={1} mid={0.5} />
        </Group>
      </Group>
    </Group>
  );
}

function Players({ p, clock, L, c }) {
  const { k, width, height, wallBottom } = L;
  const shape = useMemo(() => playerPaths(k), [k]);
  const spots = useMemo(() => {
    const list = [];
    for (let i = 0; i < 16; i += 1) {
      const f = hash(i, 9);
      const y = wallBottom + 90 * k + f * (height - wallBottom - 140 * k);
      const s = 0.65 + ((y - wallBottom) / (height - wallBottom)) * 0.9;
      list.push({ x: width * (0.06 + hash(i, 10) * 0.88), y, s, ph: hash(i, 11) * 6 });
    }
    return list.sort((a, b) => a.y - b.y);
  }, [k, width, height, wallBottom]);
  return (
    <Group>
      {spots.map((sp, i) => (
        <Player key={i} sp={sp} p={p} clock={clock} c={c} shape={shape} k={k} />
      ))}
    </Group>
  );
}

function Player({ sp, p, clock, c, shape, k }) {
  const at = useDerivedValue(() => {
    const u = restU(p, clock.value);
    const red = redLight(u);
    const go = u > 1 ? 0.25 : 1;
    const run = red > 0.05 ? 0 : go;
    const bob = Math.abs(Math.sin(clock.value * 7 + sp.ph)) * 2.4 * k * run;
    const lean = Math.sin(clock.value * 7 + sp.ph) * 0.05 * run;
    return [{ translateX: sp.x }, { translateY: sp.y - bob }, { scale: sp.s }, { rotate: lean }];
  });
  return (
    <Group transform={at}>
      <Path path={shape.body} color={c.player} />
      <Path path={shape.hi} color={c.playerHi} />
    </Group>
  );
}

export default function SquidGameScene({ p, clock, width, height, tone, lightSurface }) {
  const L = useMemo(() => sqLayout(width, height), [width, height]);
  const arena = useMemo(() => buildArena(L), [L]);
  const guard = useMemo(() => guardPaths(L.k), [L]);
  const syms = useMemo(
    () => [0, 1, 2].map((kind) => symbolPath(kind, 0, -41 * L.k, 3.2 * L.k)),
    [L],
  );
  const c = useMemo(() => toneMap(SQ_TONE, tone.colors), [tone]);
  const { k, wallBottom, wallTop, height: H } = L;
  const night = !lightSurface;
  const redA = useDerivedValue(() => redLight(restU(p, clock.value)) * (night ? 0.22 : 0.16));
  const guards = [
    [width * 0.06, wallBottom + 70 * k, 1.1, 0],
    [width * 0.94, wallBottom + 90 * k, 1.2, 1],
    [width * 0.86, wallBottom + 34 * k, 0.8, 2],
  ];
  return (
    <Group opacity={tone.alpha}>
      {/* tavan + kirişler + projektörler */}
      <Rect x={0} y={0} width={width} height={wallTop}>
        <LinearGradient start={vec(0, 0)} end={vec(0, wallTop)} colors={[night ? "#0c0d12" : "#b8bcc6", c.wallEdge]} />
      </Rect>
      <Path path={arena.truss} style="stroke" strokeWidth={1.4 * k} color={night ? "rgba(150,160,180,0.28)" : "rgba(60,64,76,0.35)"} />
      <Path path={arena.lampBody} color={night ? "#3a3e4a" : "#6a6e7a"} />
      {arena.lamps.map(([x, y]) => (
        <Group key={x} transform={[{ translateX: x }, { translateY: y + 25 * k }]}>
          <Glow r={46 * k} color={c.cloud} a={night ? 0.55 : 0.7} mid={0.3} />
        </Group>
      ))}
      {/* boyalı gök duvarları */}
      <Rect x={0} y={wallTop} width={width} height={wallBottom - wallTop}>
        <LinearGradient start={vec(0, wallTop)} end={vec(0, wallBottom)} colors={[c.wallSky, c.wallSkyLow]} />
      </Rect>
      <Group clip={arena.wall}>
        <Path path={arena.clouds} color={c.cloud} />
      </Group>
      <Path path={arena.edge} color={c.wallEdge} />
      <Path path={arena.field} color={c.field} />
      <Path path={arena.lines} color={c.fieldLine} />
      <Path path={arena.branches} style="stroke" strokeWidth={2.2 * k} strokeCap="round" color={c.tree} />
      <Path path={arena.tree} color={c.tree} />
      <Doll p={p} clock={clock} L={L} c={c} />
      {guards.map(([x, y, s, kind]) => (
        <Group key={kind} transform={[{ translateX: x }, { translateY: y }, { scale: s }]}>
          <Path path={guard.body} color={c.guard} />
          <Path path={guard.mask} color={c.mask} />
          <Path path={syms[kind]} style="stroke" strokeWidth={1.2 * k} color={c.maskSym} />
        </Group>
      ))}
      <Players p={p} clock={clock} L={L} c={c} />
      <Group opacity={redA}>
        <Rect x={0} y={wallTop} width={width} height={H - wallTop} color={c.red} />
      </Group>
    </Group>
  );
}
