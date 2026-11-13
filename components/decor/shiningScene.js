// components/decor/shiningScene.js
//
// The Shining evren sahnesi (OVERLAY.snVec = 72) — tamamı VEKTÖR:
//   • Karlı dağların önünde, çam ormanına yaslanmış uzun dağ oteli: üç kat sıcak pencere,
//     karlı çatı, bacalar. Önde, perspektifte uzanan KARLI ÇİT LABİRENTİ (her açılışta aynı
//     tohumdan kurulan gerçek labirent; çit yüzleri + kar kapakları).
//   • Kar yağar (ortam parçacığı), ay soluk parlar.
//   • İKİ olay (döngüde sırayla, eventPick):
//       A) Elinde fenerle küçük bir siluet labirente girer, koridorlardan merkeze yürür; karda
//          ayak izleri bırakır, izler sonra kar altında kaybolur.
//       B) Tipi: rüzgâr karı yatay sürükler, otelin pencereleri kanat kanat söner ve yeniden yanar;
//          farları açık paletli bir kar aracı otele doğru ilerler.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[72] (SN_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Group, LinearGradient, Path, Rect, Skia, vec } from "@shopify/react-native-skia";
import { eventPick, restU } from "../../utils/weatherParticles";
import { Glow, addPine, groundLayout, hash, peaksPath, rgba, sm, toneMap } from "./seasonKit";

export const SN_TONE = [
  "sky",
  "moon",
  "mtn",
  "mtnShade",
  "mtnSnow",
  "pine",
  "pineSnow",
  "hotel",
  "hotelShade",
  "roof",
  "roofSnow",
  "window",
  "snow",
  "snowShade",
  "hedge",
  "hedgeDark",
  "hedgeSnow",
  "figure",
  "lantern",
  "cat",
  "beam",
  "wind",
  "print",
];

const MZ_N = 9; // sütun
const MZ_M = 5; // sıra

export function snLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  const mazeTop = ground - 104 * k;
  const mazeBot = ground + 18 * k;
  return { ...L, mazeTop, mazeBot, hotelY: mazeTop - 16 * k, mtnBase: mazeTop - 40 * k };
}

/** Labirent ızgara noktası (gx 0…N, gy 0…M; gy 0 arkada) → ekran [x, y, derinlik 0…1]. */
function mazePt(L, gx, gy) {
  "worklet";
  const fy = Math.max(0, gy) / MZ_M;
  const e = Math.pow(fy, 1.25);
  const y = L.mazeTop + (L.mazeBot - L.mazeTop) * e;
  const xl = L.width * (0.15 - 0.27 * e);
  const xr = L.width * (0.85 + 0.27 * e);
  return [xl + ((xr - xl) * gx) / MZ_N, y, e];
}

const hedgeH = (L, e) => {
  "worklet";
  return (9 + 13 * e) * L.k;
};

// ───────────────────────────── labirent (tohumlu DFS) + merkeze giden yol (BFS)

function buildMazeGrid() {
  const N = MZ_N;
  const M = MZ_M;
  const id = (x, y) => y * N + x;
  // duvarlar: h[y][x] → (x,y) hücresinin ÜST kenarı (y = 0…M), v[y][x] → SOL kenarı (x = 0…N)
  const h = Array.from({ length: M + 1 }, () => Array(N).fill(true));
  const v = Array.from({ length: M }, () => Array(N + 1).fill(true));
  const seen = new Set();
  const stack = [[Math.floor(N / 2), M - 1]];
  seen.add(id(Math.floor(N / 2), M - 1));
  let step = 0;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const options = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ].filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < M && !seen.has(id(a, b)));
    if (!options.length) {
      stack.pop();
      continue;
    }
    step += 1;
    const [nx, ny] = options[Math.floor(hash(step, 41) * options.length)];
    if (nx !== x) v[y][Math.max(x, nx)] = false;
    else h[Math.max(y, ny)][x] = false;
    seen.add(id(nx, ny));
    stack.push([nx, ny]);
  }
  // giriş: ön kenarın ortası
  const entry = Math.floor(N / 2);
  h[M][entry] = false;
  // BFS: girişten merkez hücreye
  const goal = [Math.floor(N / 2), Math.floor(M / 2) - 1];
  const prev = new Map();
  const q = [[entry, M - 1]];
  prev.set(id(entry, M - 1), null);
  while (q.length) {
    const [x, y] = q.shift();
    if (x === goal[0] && y === goal[1]) break;
    const nb = [];
    if (x + 1 < N && !v[y][x + 1]) nb.push([x + 1, y]);
    if (x - 1 >= 0 && !v[y][x]) nb.push([x - 1, y]);
    if (y + 1 < M && !h[y + 1][x]) nb.push([x, y + 1]);
    if (y - 1 >= 0 && !h[y][x]) nb.push([x, y - 1]);
    nb.forEach(([a, b]) => {
      if (prev.has(id(a, b))) return;
      prev.set(id(a, b), [x, y]);
      q.push([a, b]);
    });
  }
  const route = [];
  let cur = goal;
  while (cur) {
    route.unshift(cur);
    cur = prev.get(id(cur[0], cur[1]));
  }
  route.unshift([entry, M + 0.7]); // dışarıdan girer
  return { h, v, route };
}

function buildMaze(L) {
  const { h, v, route } = buildMazeGrid();
  const rows = [];
  const quad = (q, a, b, ha, hb) => {
    q.moveTo(a[0], a[1]);
    q.lineTo(b[0], b[1]);
    q.lineTo(b[0], b[1] - hb);
    q.lineTo(a[0], a[1] - ha);
    q.close();
  };
  const cap = (q, a, b, ha, hb, k) => {
    q.moveTo(a[0], a[1] - ha - 1.6 * k);
    q.lineTo(b[0], b[1] - hb - 1.6 * k);
    q.lineTo(b[0], b[1] - hb + 2.2 * k);
    q.lineTo(a[0], a[1] - ha + 2.2 * k);
    q.close();
  };
  for (let r = 0; r <= MZ_M; r += 1) {
    const face = Skia.Path.Make();
    const side = Skia.Path.Make();
    const snow = Skia.Path.Make();
    // önce (r−1 … r) bandındaki dikey duvarlar (derinliğe giden yan yüzler)
    if (r > 0) {
      for (let x = 0; x <= MZ_N; x += 1) {
        if (!v[r - 1][x]) continue;
        const a = mazePt(L, x, r - 1);
        const b = mazePt(L, x, r);
        const ha = hedgeH(L, a[2]);
        const hb = hedgeH(L, b[2]);
        // kalınlık: sağ/sol yüz biraz kayık
        const off = 2.6 * L.k * (0.6 + b[2] * 0.6);
        quad(side, [a[0] - off * 0.6, a[1]], [b[0] - off, b[1]], ha, hb);
        quad(side, [a[0] + off * 0.6, a[1]], [b[0] + off, b[1]], ha, hb);
        cap(snow, [a[0] - off * 0.6, a[1]], [b[0] - off, b[1]], ha, hb, L.k * 0.8);
        cap(snow, [a[0] + off * 0.6, a[1]], [b[0] + off, b[1]], ha, hb, L.k * 0.8);
      }
    }
    // sonra r çizgisindeki yatay duvarlar (bize bakan yüz)
    for (let x = 0; x < MZ_N; x += 1) {
      if (!h[r][x]) continue;
      const a = mazePt(L, x, r);
      const b = mazePt(L, x + 1, r);
      const ha = hedgeH(L, a[2]);
      const off = 2.6 * L.k * (0.6 + a[2] * 0.6);
      quad(face, [a[0] - off, a[1]], [b[0] + off, b[1]], ha, ha);
      cap(snow, [a[0] - off, a[1]], [b[0] + off, b[1]], ha, ha, L.k);
    }
    rows.push({ face, side, snow });
  }
  // zemin: labirent tabanı (kar) + koridor gölgeleri
  const floor = Skia.Path.Make();
  const p00 = mazePt(L, 0, 0);
  const p10 = mazePt(L, MZ_N, 0);
  const p11 = mazePt(L, MZ_N, MZ_M);
  const p01 = mazePt(L, 0, MZ_M);
  floor.moveTo(p00[0], p00[1]);
  floor.lineTo(p10[0], p10[1]);
  floor.lineTo(p11[0], p11[1]);
  floor.lineTo(p01[0], p01[1]);
  floor.close();
  // rota: hücre merkezleri (maze koordinatı)
  const pts = route.map(([x, y]) => [x + 0.5, y + 0.5]);
  return { rows, floor, route: pts };
}

// ───────────────────────────── otel, dağlar, çamlar

function buildBack(L) {
  const { width, k, hotelY, mtnBase, height } = L;
  const peaks = [
    [width * 0.05, mtnBase - 150 * k],
    [width * 0.27, mtnBase - 230 * k],
    [width * 0.5, mtnBase - 170 * k],
    [width * 0.74, mtnBase - 260 * k],
    [width * 0.97, mtnBase - 180 * k],
  ];
  const mtn = peaksPath(width, peaks, mtnBase, height, 5);
  const pines = Skia.Path.Make();
  const pineSnow = Skia.Path.Make();
  for (let i = 0; i < 14; i += 1) {
    const x = (i / 13) * width * 0.4 - 10 * k + hash(i, 3) * 10 * k;
    addPine(pines, x, hotelY + 4 * k, (44 + hash(i, 4) * 40) * k, (18 + hash(i, 5) * 8) * k, 4, pineSnow);
  }
  for (let i = 0; i < 6; i += 1) {
    const x = width * (0.9 + i * 0.03);
    addPine(pines, x, hotelY + 4 * k, (36 + hash(i, 8) * 30) * k, 18 * k, 4, pineSnow);
  }
  // otel: uzun gövde + ortada yüksek blok
  const hotel = Skia.Path.Make();
  const shade = Skia.Path.Make();
  const roof = Skia.Path.Make();
  const roofSnow = Skia.Path.Make();
  const win = [Skia.Path.Make(), Skia.Path.Make(), Skia.Path.Make()];
  const x0 = width * 0.36;
  const x1 = width * 0.97;
  const mid = width * 0.6;
  const hMain = 44 * k;
  const hMid = 64 * k;
  const bw = 34 * k;
  hotel.addRect(Skia.XYWHRect(x0, hotelY - hMain, x1 - x0, hMain));
  hotel.addRect(Skia.XYWHRect(mid - bw, hotelY - hMid, bw * 2, hMid));
  shade.addRect(Skia.XYWHRect(x0, hotelY - 4 * k, x1 - x0, 4 * k));
  shade.addRect(Skia.XYWHRect(mid - bw, hotelY - hMid + 20 * k, 3 * k, hMid - 20 * k));
  // çatılar: alçak eğimli + kar
  const addRoof = (a, b, y, rise) => {
    roof.moveTo(a - 6 * k, y);
    roof.lineTo(a + 10 * k, y - rise);
    roof.lineTo(b - 10 * k, y - rise);
    roof.lineTo(b + 6 * k, y);
    roof.close();
    roofSnow.moveTo(a - 6 * k, y - 0.5 * k);
    roofSnow.lineTo(a + 10 * k, y - rise - 1 * k);
    roofSnow.lineTo(b - 10 * k, y - rise - 1 * k);
    roofSnow.lineTo(b + 6 * k, y - 0.5 * k);
    roofSnow.lineTo(b + 2 * k, y + 1.4 * k);
    roofSnow.lineTo(a - 2 * k, y + 1.4 * k);
    roofSnow.close();
  };
  addRoof(x0, x1, hotelY - hMain, 12 * k);
  addRoof(mid - bw, mid + bw, hotelY - hMid, 16 * k);
  // bacalar
  [x0 + 30 * k, mid + bw + 40 * k, x1 - 30 * k].forEach((x) => {
    roof.addRect(Skia.XYWHRect(x - 4 * k, hotelY - hMain - 26 * k, 8 * k, 16 * k));
    roofSnow.addRect(Skia.XYWHRect(x - 5 * k, hotelY - hMain - 28 * k, 10 * k, 3 * k));
  });
  // pencereler: 3 kat; 3 kanat grubu (olay B'de sırayla söner)
  for (let r = 0; r < 3; r += 1) {
    const y = hotelY - hMain + 9 * k + r * 11 * k;
    for (let x = x0 + 8 * k; x < x1 - 10 * k; x += 9 * k) {
      if (x > mid - bw - 4 * k && x < mid + bw + 2 * k) continue;
      if (hash(Math.round(x), r + 2) < 0.28) continue;
      const g = x < mid ? 0 : x < mid + (x1 - mid) / 2 ? 1 : 2;
      win[g].addRect(Skia.XYWHRect(x, y, 4.4 * k, 5.6 * k));
    }
  }
  for (let r = 0; r < 4; r += 1)
    for (let i = 0; i < 5; i += 1) {
      if (hash(i, r + 11) < 0.25) continue;
      win[1].addRect(Skia.XYWHRect(mid - bw + 7 * k + i * 12 * k, hotelY - hMid + 8 * k + r * 12 * k, 4.4 * k, 6 * k));
    }
  // giriş saçağı
  shade.addRect(Skia.XYWHRect(mid - 12 * k, hotelY - 12 * k, 24 * k, 12 * k));
  win[1].addRect(Skia.XYWHRect(mid - 8 * k, hotelY - 10 * k, 16 * k, 2 * k));
  return { mtn, pines, pineSnow, hotel, shade, roof, roofSnow, win, door: [mid, hotelY] };
}

// ───────────────────────────── olay worklet'leri

/** Rotada ilerleme (hücre adımı cinsinden): u → [mx, my] labirent koordinatı. */
function routeAt(route, d) {
  "worklet";
  const n = route.length - 1;
  const i = Math.min(n - 1, Math.max(0, Math.floor(d)));
  const f = Math.min(1, Math.max(0, d - i));
  const a = route[i];
  const b = route[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

function Wanderer({ p, clock, L, maze, c }) {
  const { k } = L;
  const route = maze.route;
  const n = route.length - 1;
  const prog = (u) => {
    "worklet";
    return sm(0.06, 0.86, u) * n;
  };
  const show = useDerivedValue(() => {
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 0) return 0;
    return sm(0.04, 0.09, u) * (1 - sm(0.86, 0.94, u));
  });
  const at = useDerivedValue(() => {
    const u = Math.min(1, restU(p, clock.value));
    const [mx, my] = routeAt(route, prog(u));
    const [x, y, e] = mazePt(L, mx, my);
    const s = (0.5 + 0.5 * e) * k;
    const bob = Math.abs(Math.sin(clock.value * 6)) * 0.8 * s;
    return [{ translateX: x }, { translateY: y - bob }, { scale: s }];
  });
  const lantern = useDerivedValue(() => 0.75 + 0.25 * Math.sin(clock.value * 7.3) * Math.sin(clock.value * 3.1));
  // ayak izleri: geçilen yol boyunca, sonra kar altında kalır
  const prints = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 0) return q;
    const d = prog(u);
    for (let s = 0.5; s < d; s += 0.22) {
      const [mx, my] = routeAt(route, s);
      const [x, y, e] = mazePt(L, mx, my);
      const side = Math.round(s / 0.22) % 2 === 0 ? -1 : 1;
      q.addOval(Skia.XYWHRect(x + side * 1.6 * k * (0.5 + e) - 1.1 * k, y - 0.6 * k, 2.2 * k * (0.6 + e * 0.5), 1.2 * k));
    }
    return q;
  });
  const printOp = useDerivedValue(() => {
    const u = restU(p, clock.value);
    return u > 1 ? 0 : 0.8 * (1 - sm(0.86, 1, u));
  });
  return (
    <>
      <Group opacity={printOp}>
        <Path path={prints} color={c.print} />
      </Group>
      <Group opacity={show}>
        <Group transform={at}>
          <Group opacity={lantern}>
            <Glow cx={6} cy={-8} r={26} color={c.lantern} a={0.6} mid={0.3} />
          </Group>
          {/* siluet: palto, baş, fener tutan kol */}
          <Path
            path="M -3.2 0 L -3.6 -9 Q -3.6 -13 0 -13.4 Q 3.6 -13 3.6 -9 L 3.2 0 Z M 0 -14 m -2.4 0 a 2.4 2.4 0 1 0 4.8 0 a 2.4 2.4 0 1 0 -4.8 0 M 3 -11 L 6.4 -8 L 6 -7 L 2.6 -9.6 Z"
            color={c.figure}
          />
          <Path path="M 4.8 -8 L 7.4 -8 L 7.4 -4.6 L 4.8 -4.6 Z" color={c.lantern} />
        </Group>
      </Group>
    </>
  );
}

function Blizzard({ p, clock, L, c }) {
  const { k, width, mazeBot } = L;
  const w = useDerivedValue(() => {
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 1) return 0;
    return sm(0.04, 0.2, u) * (1 - sm(0.8, 0.96, u));
  });
  const streaks = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const s = w.value;
    if (s < 0.02) return q;
    const span = width + 200 * k;
    for (let i = 0; i < 46; i += 1) {
      const v = (300 + hash(i, 2) * 260) * k;
      const x = ((hash(i, 1) * span + clock.value * v) % span) - 100 * k;
      const y = hash(i, 3) * mazeBot + Math.sin(clock.value * 2 + i) * 8 * k;
      const len = (18 + hash(i, 4) * 34) * k * s;
      q.moveTo(x, y);
      q.lineTo(x - len, y - len * 0.08);
    }
    return q;
  });
  return (
    <Group opacity={w}>
      <Path path={streaks} style="stroke" strokeWidth={1.3 * k} strokeCap="round" color={c.wind} />
    </Group>
  );
}

function SnowCat({ p, clock, L, door, c }) {
  const { k, hotelY } = L;
  const show = useDerivedValue(() => {
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 1) return 0;
    return sm(0.12, 0.18, u) * (1 - sm(0.8, 0.88, u));
  });
  const at = useDerivedValue(() => {
    const u = Math.min(1, restU(p, clock.value));
    const e = sm(0.12, 0.82, u);
    const x = -40 * k + (door[0] - 60 * k + 40 * k) * e;
    return [{ translateX: x }, { translateY: hotelY + 9 * k + Math.sin(clock.value * 9) * 0.3 * k }, { scale: k }];
  });
  const beam = useDerivedValue(() => 0.5 + 0.1 * Math.sin(clock.value * 5));
  return (
    <Group opacity={show}>
      <Group transform={at}>
        <Group opacity={beam}>
          <Path path="M 13 -7 L 70 -16 L 70 4 Z">
            <LinearGradient start={vec(13, 0)} end={vec(70, 0)} colors={[rgba(c.beam, 0.8), rgba(c.beam, 0)]} />
          </Path>
        </Group>
        {/* gövde + kabin + palet */}
        <Path path="M -14 -4 L -14 -10 L -4 -10 L -1 -17 L 8 -17 L 11 -10 L 14 -9 L 14 -4 Z" color={c.cat} />
        <Path path="M 0 -15.6 L 7.4 -15.6 L 9.4 -10.6 L 0 -10.6 Z" color={c.beam} opacity={0.75} />
        <Path path="M -15 -4 L 15 -4 Q 17 -1 15 1.6 L -15 1.6 Q -17 -1 -15 -4 Z" color={c.figure} />
        <Path path="M 12.4 -8.6 m -1.6 0 a 1.6 1.6 0 1 0 3.2 0 a 1.6 1.6 0 1 0 -3.2 0" color={c.beam} />
      </Group>
    </Group>
  );
}

export default function ShiningScene({ p, clock, width, height, tone, lightSurface }) {
  const L = useMemo(() => snLayout(width, height), [width, height]);
  const back = useMemo(() => buildBack(L), [L]);
  const maze = useMemo(() => buildMaze(L), [L]);
  const c = useMemo(() => toneMap(SN_TONE, tone.colors), [tone]);
  const { k, hotelY, mtnBase } = L;
  const night = !lightSurface;
  // olay B: pencere kanatları sırayla söner (tipi), sonra yeniden yanar
  const winOp = [0, 1, 2].map((g) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDerivedValue(() => {
      const base = (night ? 0.9 : 0.65) + Math.sin(clock.value * 0.8 + g) * 0.04;
      const u = restU(p, clock.value);
      if (u > 1 || eventPick(p, clock.value, 2) !== 1) return base;
      const off = sm(0.3 + g * 0.08, 0.34 + g * 0.08, u) * (1 - sm(0.62 + g * 0.05, 0.68 + g * 0.05, u));
      const flick = off > 0.02 && off < 0.98 ? 0.5 + 0.5 * Math.sin(clock.value * 23 + g) : 1;
      return base * (1 - off * 0.92) * (off > 0.02 && off < 0.98 ? flick : 1);
    }),
  );
  return (
    <Group opacity={tone.alpha}>
      <Group transform={[{ translateX: width * 0.78 }, { translateY: mtnBase - 330 * k }]}>
        <Glow r={120 * k} color={c.moon} a={night ? 0.22 : 0.18} mid={0.3} />
      </Group>
      <Path path={`M ${width * 0.78} ${mtnBase - 330 * k} m -16 0 a 16 16 0 1 0 32 0 a 16 16 0 1 0 -32 0`} color={c.moon} opacity={night ? 0.9 : 0.7} />
      <Rect x={0} y={mtnBase - 300 * k} width={width} height={300 * k}>
        <LinearGradient start={vec(0, mtnBase - 300 * k)} end={vec(0, mtnBase)} colors={[rgba(c.sky, 0), c.sky]} />
      </Rect>
      <Path path={back.mtn.path} color={c.mtn} />
      <Path path={back.mtn.shade} color={c.mtnShade} />
      <Path path={back.mtn.snow} color={c.mtnSnow} />
      {/* kar düzlüğü (otelin önü ve labirentin çevresi) */}
      <Rect x={0} y={hotelY - 2 * k} width={width} height={L.height - hotelY + 2 * k}>
        <LinearGradient start={vec(0, hotelY)} end={vec(0, L.mazeBot)} colors={[c.snowShade, c.snow]} />
      </Rect>
      <Path path={back.pines} color={c.pine} />
      <Path path={back.pineSnow} color={c.pineSnow} />
      <Path path={back.hotel} color={c.hotel} />
      <Path path={back.shade} color={c.hotelShade} />
      {back.win.map((w, i) => (
        <Group key={i} opacity={winOp[i]}>
          <Path path={w} color={c.window} />
        </Group>
      ))}
      <Path path={back.roof} color={c.roof} />
      <Path path={back.roofSnow} color={c.roofSnow} />
      <SnowCat p={p} clock={clock} L={L} door={back.door} c={c} />
      {/* labirent: taban + arkadan öne sıra sıra çitler */}
      <Path path={maze.floor} color={c.snow} />
      {maze.rows.map((r, i) => (
        <Group key={i}>
          <Path path={r.side} color={c.hedgeDark} />
          <Path path={r.face} color={c.hedge} />
          <Path path={r.snow} color={c.hedgeSnow} />
        </Group>
      ))}
      <Wanderer p={p} clock={clock} L={L} maze={maze} c={c} />
      <Blizzard p={p} clock={clock} L={L} c={c} />
    </Group>
  );
}
