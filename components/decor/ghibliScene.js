// components/decor/ghibliScene.js
//
// Ghibli dünyası evren sahnesi (OVERLAY.ghVec = 59) — tamamı VEKTÖR, karakter yok (yalnız ortam):
//   • Yaz kırsalı: kocaman kümülüs bulutlar (gündüz parlak, gece yağmur bulutu), uzak mavi dağlar,
//     yeşil tepeler; sağda dev, gür kafur ağacı (taç katmanları rüzgârda ayrı ayrı salınır); kiremit
//     çatılı küçük köy evi; önde pirinç tarlası — üstünden rüzgâr dalgası geçer; toprak yol.
//   • Kırsal otobüs durağı: tahta direk, yuvarlak tabela, küçük lamba; şemsiyeli bir yolcu bekler.
//   • Yağmur ve ateş böcekleri bileşikteki parçacıklardan.
//   • Olay (66 sn'de bir ~25 sn): eski, yuvarlak burunlu kırsal otobüs farlarıyla soldan gelir, durakta
//     durur (kapı ışığı), yolcu biner, otobüs sağa gider; tarlada büyük bir rüzgâr dalgası geçer.
//   • Olay B (dönüşümlü): sert bir esinti — ağaçtan kopan yapraklar girdap çizerek savrulur; tepelerin
//     üstünden pervanesi dönen küçük, kırmızı eski bir deniz uçağı alçaktan geçer, gölgesi tarlada
//     koşar; tarladaki rüzgâr dalgası yine geçer.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[59] (GH_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Circle, Group, LinearGradient, Path, Rect, Skia, vec } from "@shopify/react-native-skia";
import { eventU, restU } from "../../utils/weatherParticles";
import { Glow, addCloud, groundLayout, hash, rgba, ridgePath, sm, toneMap } from "./seasonKit";

export const GH_TONE = [
  "cloud",
  "cloudShade",
  "mount",
  "hill",
  "tree",
  "treeLight",
  "trunk",
  "field",
  "fieldLight",
  "road",
  "house",
  "roof",
  "post",
  "lamp",
  "lampGlow",
  "sign",
  "umbrella",
  "figure",
  "bus",
  "busTrim",
  "busWin",
  "busLight",
];

export function ghLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  return {
    ...L,
    road: ground + 6 * k,
    fieldTop: ground - 58 * k,
    stop: width * 0.56,
    tree: [width * 0.86, ground - 150 * k, 112 * k],
    house: [width * 0.16, ground - 58 * k],
  };
}

// ───────────────────────────── durağan yollar

function buildLand(L) {
  const { k, width, height, fieldTop } = L;
  const mount = ridgePath(width, fieldTop - 70 * k, 70 * k, 3, 0.7, height).path;
  const hill = ridgePath(width, fieldTop - 14 * k, 34 * k, 4, 2.2, height).path;
  const clouds = Skia.Path.Make();
  const shade = Skia.Path.Make();
  // dev kümülüs: üst üste binen kabarık katlar
  const big = (cx, cy, w, h, seed) => {
    addCloud(clouds, cx, cy, w, h, seed);
    addCloud(clouds, cx - w * 0.12, cy - h * 1.1, w * 0.7, h * 0.9, seed + 1);
    addCloud(clouds, cx + w * 0.05, cy - h * 2, w * 0.42, h * 0.7, seed + 2);
    shade.addRRect(Skia.RRectXY(Skia.XYWHRect(cx - w * 0.42, cy - h * 0.05, w * 0.84, h * 0.4), h * 0.2, h * 0.2));
  };
  big(width * 0.32, fieldTop - 210 * k, 240 * k, 42 * k, 3);
  big(width * 0.8, fieldTop - 360 * k, 170 * k, 30 * k, 8);
  return { mount, hill, clouds, shade };
}

function buildTree(L) {
  const { k } = L;
  const [tx, ty, r] = L.tree;
  const trunk = Skia.Path.Make();
  const base = L.fieldTop + 18 * k;
  trunk.moveTo(tx - 16 * k, base);
  trunk.quadTo(tx - 8 * k, ty + r * 0.3, tx - 30 * k, ty + r * 0.05);
  trunk.lineTo(tx - 22 * k, ty);
  trunk.quadTo(tx - 2 * k, ty + r * 0.2, tx + 2 * k, ty - r * 0.1);
  trunk.lineTo(tx + 10 * k, ty - r * 0.05);
  trunk.quadTo(tx + 8 * k, ty + r * 0.3, tx + 24 * k, ty + r * 0.1);
  trunk.lineTo(tx + 28 * k, ty + r * 0.16);
  trunk.quadTo(tx + 12 * k, ty + r * 0.5, tx + 16 * k, base);
  trunk.close();
  // üç taç katmanı (arka koyu, orta, ön açık) — her biri ayrı salınır
  const layers = [0, 1, 2].map((j) => {
    const q = Skia.Path.Make();
    const n = 16 - j * 3;
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2;
      const rr = r * (0.72 - j * 0.12) * (0.75 + hash(i, j + 1) * 0.35);
      const cx = tx + Math.cos(a) * rr * 0.95 + (j - 1) * 8 * k;
      const cy = ty - r * 0.15 + Math.sin(a) * rr * 0.55 - j * 10 * k;
      q.addCircle(cx, cy, r * (0.36 - j * 0.05) * (0.8 + hash(i, j + 4) * 0.4));
    }
    return q;
  });
  return { trunk, layers };
}

function buildVillage(L) {
  const { k } = L;
  const [hx, hb] = L.house;
  const house = Skia.Path.Make();
  const roof = Skia.Path.Make();
  const win = Skia.Path.Make();
  house.addRect(Skia.XYWHRect(hx - 34 * k, hb - 30 * k, 68 * k, 30 * k));
  roof.moveTo(hx - 44 * k, hb - 28 * k);
  roof.quadTo(hx - 30 * k, hb - 32 * k, hx - 22 * k, hb - 52 * k);
  roof.lineTo(hx + 22 * k, hb - 52 * k);
  roof.quadTo(hx + 30 * k, hb - 32 * k, hx + 44 * k, hb - 28 * k);
  roof.close();
  roof.addRect(Skia.XYWHRect(hx + 12 * k, hb - 64 * k, 7 * k, 14 * k));
  win.addRect(Skia.XYWHRect(hx - 24 * k, hb - 22 * k, 14 * k, 12 * k));
  win.addRect(Skia.XYWHRect(hx + 6 * k, hb - 22 * k, 18 * k, 12 * k));
  // durak: direk + yuvarlak tabela + küçük lamba kolu, yanında tahta bank
  const post = Skia.Path.Make();
  const sx = L.stop;
  const g = L.road - 4 * k;
  post.addRect(Skia.XYWHRect(sx - 1.6 * k, g - 74 * k, 3.2 * k, 74 * k));
  post.addRect(Skia.XYWHRect(sx - 1.6 * k, g - 70 * k, 16 * k, 2 * k));
  post.addRect(Skia.XYWHRect(sx + 24 * k, g - 14 * k, 34 * k, 3 * k));
  post.addRect(Skia.XYWHRect(sx + 26 * k, g - 11 * k, 2.4 * k, 11 * k));
  post.addRect(Skia.XYWHRect(sx + 53 * k, g - 11 * k, 2.4 * k, 11 * k));
  return { house, roof, win, post, sign: [sx, g - 80 * k, 9 * k], lamp: [sx + 14 * k, g - 66 * k] };
}

/** Tarla sıraları: perspektif yatay bantlar + filiz çizgileri. */
function buildField(L) {
  const { k, width, fieldTop } = L;
  const rows = Skia.Path.Make();
  for (let i = 0; i < 10; i += 1) {
    const f = i / 9;
    const y = fieldTop + Math.pow(f, 1.5) * (L.road - fieldTop - 8 * k);
    rows.addRect(Skia.XYWHRect(0, y, width, (0.6 + f * 1.2) * k));
    for (let x = hash(i, 2) * 8 * k; x < width; x += (6 + f * 8) * k) {
      const hh = (2 + f * 5) * k;
      rows.addRect(Skia.XYWHRect(x, y - hh, (0.6 + f * 0.8) * k, hh));
    }
  }
  return rows;
}

// ───────────────────────────── hareketli parçalar

function TreeLayer({ path, i, tx, ty, clock, color }) {
  const at = useDerivedValue(() => {
    const a = Math.sin(clock.value * (0.6 + i * 0.13) + i * 1.7);
    return [{ translateX: tx }, { translateY: ty }, { rotate: a * 0.012 * (i + 1) }, { translateX: -tx + a * (1 + i) }, { translateY: -ty }];
  });
  return (
    <Group transform={at}>
      <Path path={path} color={color} />
    </Group>
  );
}

function Bus({ p, clock, L, c }) {
  const { k, width } = L;
  const body = useMemo(() => {
    const q = Skia.Path.Make();
    // yuvarlak burunlu, yüksek kasa, kavisli tavan
    q.moveTo(-58 * k, -6 * k);
    q.lineTo(-58 * k, -40 * k);
    q.quadTo(-58 * k, -50 * k, -46 * k, -50 * k);
    q.lineTo(36 * k, -50 * k);
    q.quadTo(48 * k, -50 * k, 50 * k, -40 * k);
    q.lineTo(52 * k, -26 * k);
    q.quadTo(68 * k, -26 * k, 68 * k, -14 * k); // kaput
    q.lineTo(68 * k, -6 * k);
    q.close();
    return q;
  }, [k]);
  const trim = useMemo(() => {
    const q = Skia.Path.Make();
    q.addRect(Skia.XYWHRect(-58 * k, -22 * k, 126 * k, 4 * k));
    q.addRect(Skia.XYWHRect(-58 * k, -10 * k, 126 * k, 4 * k));
    return q;
  }, [k]);
  const wins = useMemo(() => {
    const q = Skia.Path.Make();
    for (let i = 0; i < 5; i += 1) q.addRRect(Skia.RRectXY(Skia.XYWHRect(-52 * k + i * 18 * k, -44 * k, 14 * k, 14 * k), 3 * k, 3 * k));
    q.addRRect(Skia.RRectXY(Skia.XYWHRect(38 * k, -44 * k, 10 * k, 16 * k), 3 * k, 3 * k));
    return q;
  }, [k]);
  const at = useDerivedValue(() => {
    const u = eventU(p, clock.value, 0);
    if (u > 1) return [{ translateX: -900 }, { translateY: -900 }];
    const stopX = L.stop - 30 * k;
    const x = u < 0.55 ? -90 * k + (stopX + 90 * k) * sm(0, 0.3, u) : stopX + (width + 120 * k - stopX) * sm(0.55, 0.85, u) * sm(0.55, 0.85, u);
    const moving = (u > 0.02 && u < 0.3) || (u > 0.56 && u < 0.85);
    const bob = moving ? Math.sin(clock.value * 11) * 0.8 * k : 0;
    return [{ translateX: x }, { translateY: L.road + bob }];
  });
  const wheel = useDerivedValue(() => [{ rotate: clock.value * 6 }]);
  const door = useDerivedValue(() => {
    const u = eventU(p, clock.value, 0);
    return u > 1 ? 0 : sm(0.32, 0.36, u) * (1 - sm(0.5, 0.54, u));
  });
  return (
    <Group transform={at}>
      <Path path={`M ${68 * k} ${-14 * k} L ${190 * k} ${-34 * k} L ${190 * k} ${8 * k} Z`}>
        <LinearGradient start={vec(68 * k, 0)} end={vec(190 * k, 0)} colors={[c.busLight, rgba(c.busLight, 0)]} />
      </Path>
      <Glow cx={66 * k} cy={-14 * k} r={10 * k} color={c.busLight} a={0.95} mid={0.35} />
      <Path path={body} color={c.bus} />
      <Path path={trim} color={c.busTrim} />
      <Path path={wins} color={c.busWin} />
      <Group opacity={door}>
        <Rect x={22 * k} y={-40 * k} width={12 * k} height={32 * k} color={c.busLight} opacity={0.8} />
        <Glow cx={28 * k} cy={-4 * k} r={22 * k} color={c.busLight} a={0.5} mid={0.3} />
      </Group>
      {[-36 * k, 46 * k].map((wx) => (
        <Group key={wx} transform={[{ translateX: wx }, { translateY: -4 * k }]}>
          <Circle cx={0} cy={0} r={8 * k} color={c.figure} />
          <Group transform={wheel}>
            <Rect x={-5 * k} y={-0.8 * k} width={10 * k} height={1.6 * k} color={c.busTrim} />
          </Group>
        </Group>
      ))}
    </Group>
  );
}

function Waiter({ p, clock, L, c }) {
  const { k } = L;
  const x = L.stop + 34 * k;
  const g = L.road - 4 * k;
  const a = useDerivedValue(() => {
    const u = eventU(p, clock.value, 0);
    // otobüs gelince biner; otobüs gidince yeni bir yolcu belirir
    return u > 1 ? 1 : 1 - sm(0.42, 0.48, u) + sm(0.9, 1, u);
  });
  const tilt = useDerivedValue(() => [{ translateX: x }, { translateY: g - 46 * k }, { rotate: 0.06 * Math.sin(clock.value * 0.9) }]);
  return (
    <Group opacity={a}>
      {/* yolcu: sade silüet */}
      <Rect x={x - 5 * k} y={g - 30 * k} width={10 * k} height={22 * k} color={c.figure} />
      <Rect x={x - 4 * k} y={g - 8 * k} width={3 * k} height={8 * k} color={c.figure} />
      <Rect x={x + 1 * k} y={g - 8 * k} width={3 * k} height={8 * k} color={c.figure} />
      <Circle cx={x} cy={g - 35 * k} r={5 * k} color={c.figure} />
      <Rect x={x + 4 * k} y={g - 44 * k} width={1.2 * k} height={20 * k} color={c.figure} />
      {/* şemsiye */}
      <Group transform={tilt}>
        <Path path={`M ${-20 * k} ${6 * k} Q ${-18 * k} ${-12 * k} ${4 * k} ${-14 * k} Q ${26 * k} ${-12 * k} ${28 * k} ${6 * k} Q ${22 * k} ${3 * k} ${16 * k} ${6 * k} Q ${10 * k} ${3 * k} ${4 * k} ${6 * k} Q ${-2 * k} ${3 * k} ${-8 * k} ${6 * k} Q ${-14 * k} ${3 * k} ${-20 * k} ${6 * k} Z`} color={c.umbrella} />
      </Group>
    </Group>
  );
}

function FieldWave({ p, clock, L, c }) {
  const { k, width, fieldTop } = L;
  // sürekli hafif esinti + olayda büyük dalga: tarlanın üstünden geçen açık şerit
  const at = useDerivedValue(() => {
    const u = restU(p, clock.value);
    const big = u > 1 ? 0 : sm(0.55, 0.95, u);
    const x = big > 0 && big < 1 ? -width * 0.4 + big * width * 1.8 : ((clock.value * 18 * k) % (width * 1.6)) - width * 0.4;
    return [{ translateX: x }, { translateY: fieldTop + (L.road - fieldTop) * 0.5 }, { scaleY: 0.32 }];
  });
  const a = useDerivedValue(() => {
    const u = restU(p, clock.value);
    return u > 1 ? 0.45 : 0.45 + 0.4 * sm(0.55, 0.65, u) * (1 - sm(0.85, 0.95, u));
  });
  return (
    <Group transform={at} opacity={a}>
      <Glow r={110 * k} color={c.fieldLight} a={0.9} mid={0.45} />
    </Group>
  );
}

// ───────────────────────────── olay B: esinti + alçaktan geçen eski uçak

function Seaplane({ p, clock, L, c }) {
  const { k, width, fieldTop } = L;
  const s = k * 1.7;
  const st = useMemo(() => {
    const body = Skia.Path.Make();
    body.moveTo(-26 * s, -2 * s);
    body.quadTo(-20 * s, -7 * s, -4 * s, -7 * s);
    body.lineTo(22 * s, -4 * s);
    body.lineTo(30 * s, -12 * s);
    body.lineTo(33 * s, -12 * s);
    body.lineTo(31 * s, 0);
    body.quadTo(0, 4 * s, -26 * s, -2 * s);
    body.close();
    const wing = Skia.Path.Make();
    wing.addRRect(Skia.RRectXY(Skia.XYWHRect(-14 * s, -15 * s, 24 * s, 3 * s), 1.4 * s, 1.4 * s));
    wing.addRRect(Skia.RRectXY(Skia.XYWHRect(-12 * s, -2 * s, 20 * s, 2.4 * s), 1.2 * s, 1.2 * s));
    wing.addRect(Skia.XYWHRect(-9 * s, -13 * s, 1.2 * s, 11 * s));
    wing.addRect(Skia.XYWHRect(5 * s, -13 * s, 1.2 * s, 11 * s));
    wing.addRRect(Skia.RRectXY(Skia.XYWHRect(-16 * s, 6 * s, 26 * s, 3 * s), 1.5 * s, 1.5 * s));
    wing.addRect(Skia.XYWHRect(-8 * s, 0, 1 * s, 6 * s));
    wing.addRect(Skia.XYWHRect(4 * s, 0, 1 * s, 6 * s));
    const win = Skia.Path.Make();
    win.addRRect(Skia.RRectXY(Skia.XYWHRect(-6 * s, -10 * s, 7 * s, 3.4 * s), 1.4 * s, 1.4 * s));
    return { body, wing, win };
  }, [s]);
  const fly = useDerivedValue(() => {
    const u = eventU(p, clock.value, 1);
    return u > 1 ? -1 : sm(0.18, 0.86, u);
  });
  const at = useDerivedValue(() => {
    const e = fly.value;
    if (e < 0) return [{ translateX: -999 }, { translateY: -999 }];
    const x = width + 60 * s - e * (width + 120 * s);
    const y = fieldTop - 150 * k + Math.sin(e * 5) * 16 * k - Math.sin(e * Math.PI) * 40 * k;
    return [{ translateX: x }, { translateY: y }, { rotate: Math.cos(e * 5) * 0.06 }];
  });
  const shadow = useDerivedValue(() => {
    const e = fly.value;
    if (e < 0) return [{ translateX: -999 }, { translateY: -999 }];
    const x = width + 60 * s - e * (width + 120 * s) + 30 * k;
    return [{ translateX: x }, { translateY: fieldTop + 20 * k }, { scaleY: 0.22 }];
  });
  const prop = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const a = Math.abs(Math.sin(clock.value * 40));
    q.addOval(Skia.XYWHRect(-30 * s, -2 * s - 9 * s * a, 3 * s, 18 * s * a + 1));
    return q;
  });
  return (
    <Group>
      <Group transform={shadow} opacity={0.25}>
        <Path path={st.body} color={c.field} />
        <Path path={st.wing} color={c.field} />
      </Group>
      <Group transform={at}>
        <Path path={st.wing} color={c.busTrim} />
        <Path path={st.body} color={c.roof} />
        <Path path={st.win} color={c.busWin} />
        <Path path={prop} color={c.post} opacity={0.6} />
      </Group>
    </Group>
  );
}

function LeafGust({ p, clock, L, c }) {
  const { k, width } = L;
  const [tx, ty, tr] = L.tree;
  const q = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const u = eventU(p, clock.value, 1);
    if (u > 1) return path;
    const t = clock.value;
    for (let i = 0; i < 26; i += 1) {
      const e = (u - 0.08 - hash(i, 191) * 0.3) / 0.45;
      if (e <= 0 || e >= 1) continue;
      const sx = tx + (hash(i, 192) - 0.5) * tr * 1.4;
      const sy = ty + (hash(i, 193) - 0.5) * tr * 0.8;
      const x = sx - e * width * (0.5 + hash(i, 194) * 0.5) + Math.sin(e * 9 + i) * 26 * k;
      const y = sy + Math.cos(e * 7 + i) * 30 * k - e * 60 * k + e * e * 120 * k;
      const r = t * 4 + i;
      const ca = Math.cos(r) * 4 * k;
      const sa = Math.sin(r) * 1.8 * k;
      path.moveTo(x - ca, y - sa);
      path.quadTo(x - sa, y + ca * 0.4, x + ca, y + sa);
      path.quadTo(x + sa, y - ca * 0.4, x - ca, y - sa);
      path.close();
    }
    return path;
  });
  return <Path path={q} color={c.treeLight} />;
}

export default function GhibliScene({ p, clock, width, height, tone, lightSurface }) {
  const L = useMemo(() => ghLayout(width, height), [width, height]);
  const land = useMemo(() => buildLand(L), [L]);
  const tree = useMemo(() => buildTree(L), [L]);
  const village = useMemo(() => buildVillage(L), [L]);
  const field = useMemo(() => buildField(L), [L]);
  const c = useMemo(() => toneMap(GH_TONE, tone.colors), [tone]);
  const { k, fieldTop } = L;
  const night = !lightSurface;
  const [tx, ty] = L.tree;
  const [lx, ly] = village.lamp;
  const [sgx, sgy, sgr] = village.sign;
  // bulutlar ekrandan çıkmadan ağır ağır salınır (~5 dk'lık döngü)
  const drift = useDerivedValue(() => [{ translateX: Math.sin(clock.value * 0.021) * 36 * k }]);
  const lampA = useDerivedValue(() => 0.86 + 0.08 * Math.sin(clock.value * 2.7) + 0.06 * Math.sin(clock.value * 6.1));
  const treeCols = [c.tree, c.treeLight, c.treeLight];
  return (
    <Group opacity={tone.alpha}>
      {/* bulutlar: ağır ağır sürüklenir */}
      <Group transform={drift}>
        <Path path={land.clouds} color={c.cloud} opacity={night ? 0.55 : 0.95} />
        <Path path={land.shade} color={c.cloudShade} opacity={night ? 0.4 : 0.5} />
      </Group>
      <Path path={land.mount} color={c.mount} />
      <Path path={land.hill} color={c.hill} />
      {/* köy evi */}
      <Path path={village.roof} color={c.roof} />
      <Path path={village.house} color={c.house} />
      <Path path={village.win} color={c.lamp} opacity={night ? 0.85 : 0.45} />
      {/* kafur ağacı */}
      <Path path={tree.trunk} color={c.trunk} />
      {tree.layers.map((q, i) => (
        <TreeLayer key={i} path={q} i={i} tx={tx} ty={ty} clock={clock} color={i === 0 ? c.tree : treeCols[i]} />
      ))}
      <Group transform={[{ translateX: tx - 10 * k }, { translateY: ty - 30 * k }]} opacity={0.35}>
        <Glow r={60 * k} color={c.fieldLight} a={night ? 0.15 : 0.5} mid={0.4} />
      </Group>
      <Seaplane p={p} clock={clock} L={L} c={c} />
      {/* pirinç tarlası */}
      <Rect x={0} y={fieldTop} width={width} height={L.road - fieldTop}>
        <LinearGradient start={vec(0, fieldTop)} end={vec(0, L.road)} colors={[c.fieldLight, c.field]} />
      </Rect>
      <Path path={field} color={c.field} opacity={0.65} />
      <FieldWave p={p} clock={clock} L={L} c={c} />
      {/* yol */}
      <Rect x={0} y={L.road - 4 * k} width={width} height={L.height - L.road + 4 * k}>
        <LinearGradient start={vec(0, L.road)} end={vec(0, L.height)} colors={[c.road, c.hill]} />
      </Rect>
      {/* durak */}
      <Group opacity={lampA}>
        <Glow cx={lx} cy={ly + 4 * k} r={night ? 46 * k : 20 * k} color={c.lampGlow} a={night ? 0.8 : 0.4} mid={0.3} />
        <Circle cx={lx} cy={ly + 2 * k} r={2.4 * k} color={c.lamp} />
      </Group>
      <Path path={village.post} color={c.post} />
      <Circle cx={sgx} cy={sgy} r={sgr} color={c.sign} />
      <Circle cx={sgx} cy={sgy} r={sgr * 0.62} color={c.post} />
      <Waiter p={p} clock={clock} L={L} c={c} />
      <Bus p={p} clock={clock} L={L} c={c} />
      <LeafGust p={p} clock={clock} L={L} c={c} />
    </Group>
  );
}
