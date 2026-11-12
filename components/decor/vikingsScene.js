// components/decor/vikingsScene.js
//
// Vikings atmosfer sahnesi (OVERLAY.river = 31) — tamamı VEKTÖR: Lindisfarne baskını.
//   • Sağda dalgaların dövdüğü kayalık burun; tepesinde taş manastır (arduvaz çatılı kilise,
//     yuvarlak kemerli sıcak pencereler, çanlı kule + haç, sazdan çatılı hücreler, taş duvar).
//   • Solda ay ışıklı deniz: ufukta uzak tepeler, dalga çizgileri, ayın yansıma parıltısı,
//     sürüklenen sis bankı; gökte ay (kutup ışıkları ve yıldızlar parçacık katmanından).
//   • Olay (vikFrame, 30 sn): sisin içinden üç ejder başlı uzun gemi kürek çekerek gelir (çizgili
//     yelken, sıra kalkanlar, miğferli savaşçılar, köpüklü iz) → öndeki gemideki okçu alevli ok
//     yağdırır → manastır çatıları tutuşur (alev, ışıma, duman), çan alarmla sallanır → gemiler
//     kıyıda bekler → geri çekilip sise karışır, yangın söner.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift (sekme çubuğu). Renkler OVERLAY_TONES[31] (VIK_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Circle, Group, LinearGradient, Oval, Path, RadialGradient, Skia, vec } from "@shopify/react-native-skia";
import { sceneScale, vikFrame } from "../../utils/weatherParticles";
import { SCENERY } from "../../utils/weatherUniverses";

const VIK_TONE = ["sea", "deep", "glint", "cliff", "cliffLit", "stone", "roof", "wood", "fire", "fog", "grass", "window", "night"];
const toneMap = (colors) => Object.fromEntries(VIK_TONE.map((name, i) => [name, colors[i] || colors[0]]));

function rgba(hex, a) {
  const h = String(hex).replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Gemi şeritleri: y (zeminden dp), ölçek, varış x (W oranı), gecikme (u), kalkan renkleri
const LANES = [
  { dy: 84, s: 0.42, at: 0.47, lag: 0.05, stripe: "#2b5f8a" },
  { dy: 58, s: 0.6, at: 0.1, lag: 0.025, stripe: "#c0392b" },
  { dy: 26, s: 0.86, at: 0.3, lag: 0, stripe: "#b8322a" },
];
// Alevli oklar: [fırlatma u, hedef (manastır içi indeks)]
const ARROWS = [[0.235, 0], [0.26, 1], [0.285, 2], [0.31, 0], [0.335, 3], [0.36, 1], [0.39, 2], [0.42, 3]];
const FLIGHT = 0.05;

/** Sahne yerleşimi (dp). */
export function vikLayout(width, height) {
  const k = sceneScale(width, height);
  const ground = height - SCENERY.lift * k;
  const horizon = ground - 140 * k;
  const plateau = ground - 196 * k;
  const church = { x0: width * 0.7, x1: width * 0.86, top: plateau - 42 * k };
  const tower = { x0: width * 0.885, x1: width * 0.96, top: plateau - 86 * k };
  // yanma noktaları: kilise çatısı (2), hücre çatısı, kule çatısı
  const fires = [
    [width * 0.75, church.top - 12 * k, 1],
    [width * 0.82, church.top - 14 * k, 1.1],
    [width * 0.635, plateau - 26 * k, 0.8],
    [width * 0.92, tower.top - 12 * k, 0.75],
  ];
  return { k, ground, horizon, plateau, church, tower, fires, moon: { x: width * 0.28, y: height * 0.17, r: 22 * k } };
}

function shipPos(L, width, lane, q) {
  "worklet";
  const ln = LANES[lane];
  const s0 = q.sail - ln.lag;
  const a = s0 <= 0 ? 0 : s0 >= 1 - ln.lag ? 1 : s0 / (1 - ln.lag);
  const e = a * a * (3 - 2 * a);
  const from = -0.75 * width;
  const at = ln.at * width;
  let x = from + (at - from) * e;
  x -= q.leave * (at - from) * 1.05;
  const y = L.ground - ln.dy * L.k + Math.sin(q.t * 1.3 + lane) * 1.2 * L.k;
  return { x, y, s: ln.s * L.k, rock: Math.sin(q.t * 1.1 + lane * 2) * 0.012 };
}

// ── Manzara ────────────────────────────────────────────────────────────────────
function buildLand(L, width, height) {
  const { k, ground, horizon, plateau } = L;
  // uzak tepeler (solda ufuk)
  const far = Skia.Path.Make();
  far.moveTo(-5, horizon + 2 * k);
  for (const [x, h] of [[0, 14], [0.06, 22], [0.12, 18], [0.2, 30], [0.27, 20], [0.33, 12], [0.4, 8], [0.46, 4]]) far.lineTo(width * x, horizon - h * k);
  far.lineTo(width * 0.5, horizon + 2 * k);
  far.close();
  const sea = Skia.Path.Make();
  sea.addRect(Skia.XYWHRect(-5, horizon, width + 10, height - horizon + 2));
  // dalga çizgileri (uzakta sık ve kısa, yakında seyrek ve uzun)
  const waves = Skia.Path.Make();
  for (let r = 0; r < 14; r += 1) {
    const t = r / 13;
    const y = horizon + 4 * k + Math.pow(t, 1.6) * (ground - horizon + 30 * k);
    const len = (8 + t * 34) * k;
    let x = ((r * 41) % 37) * k - 20;
    while (x < width * 0.7) {
      waves.moveTo(x, y);
      waves.quadTo(x + len / 2, y - (1 + t * 2.2) * k, x + len, y);
      x += len + (10 + t * 40 + ((x * 3) % 17)) * k;
    }
  }
  // ayın yansıması (dikey parıltı şeridi)
  const glitter = Skia.Path.Make();
  for (let r = 0; r < 18; r += 1) {
    const t = r / 17;
    const y = horizon + 3 * k + t * (ground - horizon - 10 * k);
    const w = (4 + t * 16) * k * (0.6 + ((r * 7) % 5) / 8);
    glitter.addRect(Skia.XYWHRect(L.moon.x - w / 2 + ((r * 13) % 9 - 4) * k, y, w, (0.8 + t * 1.4) * k));
  }
  // kayalık burun
  const cliff = Skia.Path.Make();
  const pts = [
    [width * 0.56, height + 2], [width * 0.57, ground - 30 * k], [width * 0.585, ground - 60 * k], [width * 0.6, ground - 92 * k],
    [width * 0.6, ground - 128 * k], [width * 0.605, ground - 160 * k], [width * 0.615, plateau + 8 * k], [width * 0.635, plateau],
    [width + 5, plateau - 4 * k], [width + 5, height + 2],
  ];
  cliff.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) cliff.lineTo(x, y);
  cliff.close();
  const cliffLit = Skia.Path.Make();
  cliffLit.moveTo(width * 0.635, plateau);
  cliffLit.lineTo(width * 0.615, plateau + 8 * k);
  cliffLit.lineTo(width * 0.605, ground - 160 * k);
  cliffLit.lineTo(width * 0.6, ground - 128 * k);
  cliffLit.lineTo(width * 0.6, ground - 92 * k);
  cliffLit.lineTo(width * 0.585, ground - 60 * k);
  cliffLit.lineTo(width * 0.57, ground - 30 * k);
  cliffLit.lineTo(width * 0.6, ground - 34 * k);
  cliffLit.lineTo(width * 0.63, ground - 96 * k);
  cliffLit.lineTo(width * 0.64, plateau + 20 * k);
  cliffLit.close();
  const cracks = Skia.Path.Make();
  for (let i = 0; i < 9; i += 1) {
    const y = plateau + (14 + i * 17) * k;
    const x0 = width * (0.6 + (i % 3) * 0.03);
    cracks.moveTo(x0, y);
    cracks.lineTo(x0 + (20 + (i * 7) % 30) * k, y + (3 - (i % 4)) * k);
    cracks.lineTo(x0 + (34 + (i * 11) % 40) * k, y + 2 * k);
  }
  for (let i = 0; i < 5; i += 1) {
    const x = width * (0.66 + i * 0.07);
    cracks.moveTo(x, plateau + 6 * k);
    cracks.lineTo(x + 3 * k, plateau + (40 + i * 12) * k);
  }
  // çimen örtüsü
  const grass = Skia.Path.Make();
  grass.moveTo(width * 0.628, plateau + 2 * k);
  grass.quadTo(width * 0.635, plateau - 3 * k, width * 0.66, plateau - 2 * k);
  grass.lineTo(width + 5, plateau - 6 * k);
  grass.lineTo(width + 5, plateau + 6 * k);
  grass.lineTo(width * 0.66, plateau + 6 * k);
  grass.close();
  // dip köpüğü
  const foam = Skia.Path.Make();
  for (let i = 0; i < 4; i += 1) {
    const y = ground - (6 + i * 9) * k;
    foam.moveTo(width * (0.5 - i * 0.03), y + 4 * k);
    foam.quadTo(width * 0.55, y - 2 * k, width * (0.575 + i * 0.006), y - 4 * k);
  }
  return { far, sea, waves, glitter, cliff, cliffLit, cracks, grass, foam };
}

function buildAbbey(L, width) {
  const { k, plateau, church, tower } = L;
  const stone = Skia.Path.Make();
  // kilise gövdesi
  stone.addRect(Skia.XYWHRect(church.x0, church.top, church.x1 - church.x0, plateau - church.top + 2 * k));
  // apsis (sağda alçak)
  stone.addRect(Skia.XYWHRect(church.x1, church.top + 14 * k, 12 * k, plateau - church.top - 12 * k));
  // kule
  stone.addRect(Skia.XYWHRect(tower.x0, tower.top, tower.x1 - tower.x0, plateau - tower.top + 2 * k));
  // çevre duvarı
  stone.addRect(Skia.XYWHRect(width * 0.645, plateau - 9 * k, width * 0.36, 9 * k));
  const roofs = Skia.Path.Make();
  const mid = (church.x0 + church.x1) / 2;
  roofs.moveTo(church.x0 - 4 * k, church.top + 1 * k);
  roofs.lineTo(church.x0 + 10 * k, church.top - 28 * k);
  roofs.lineTo(church.x1 - 10 * k, church.top - 28 * k);
  roofs.lineTo(church.x1 + 4 * k, church.top + 1 * k);
  roofs.close();
  roofs.moveTo(church.x1 - 1 * k, church.top + 15 * k);
  roofs.lineTo(church.x1 + 6 * k, church.top + 4 * k);
  roofs.lineTo(church.x1 + 14 * k, church.top + 15 * k);
  roofs.close();
  const tx = (tower.x0 + tower.x1) / 2;
  roofs.moveTo(tower.x0 - 3 * k, tower.top + 1 * k);
  roofs.lineTo(tx, tower.top - 26 * k);
  roofs.lineTo(tower.x1 + 3 * k, tower.top + 1 * k);
  roofs.close();
  // arduvaz sıraları
  const slates = Skia.Path.Make();
  for (let i = 1; i < 6; i += 1) {
    const y = church.top - 28 * k + i * 5 * k;
    const inset = 10 * k - i * (14 / 6) * k;
    slates.moveTo(church.x0 + inset, y);
    slates.lineTo(church.x1 - inset, y);
  }
  // haç
  const cross = Skia.Path.Make();
  cross.addRect(Skia.XYWHRect(tx - 0.9 * k, tower.top - 38 * k, 1.8 * k, 13 * k));
  cross.addRect(Skia.XYWHRect(tx - 4 * k, tower.top - 34 * k, 8 * k, 1.8 * k));
  cross.addRect(Skia.XYWHRect(church.x0 + 9 * k, church.top - 38 * k, 1.6 * k, 11 * k));
  cross.addRect(Skia.XYWHRect(church.x0 + 6 * k, church.top - 35 * k, 7.6 * k, 1.6 * k));
  // pencereler (yuvarlak kemer) + kapı
  const wins = Skia.Path.Make();
  for (let i = 0; i < 4; i += 1) {
    const x = church.x0 + 10 * k + i * ((church.x1 - church.x0 - 26 * k) / 3);
    wins.addRRect(Skia.RRectXY(Skia.XYWHRect(x, church.top + 10 * k, 6 * k, 14 * k), 3 * k, 3 * k));
  }
  wins.addRRect(Skia.RRectXY(Skia.XYWHRect(tx - 3 * k, tower.top + 30 * k, 6 * k, 12 * k), 3 * k, 3 * k));
  const door = Skia.Path.Make();
  door.addRRect(Skia.RRectXY(Skia.XYWHRect(mid - 5 * k, plateau - 18 * k, 10 * k, 18 * k), 5 * k, 5 * k));
  // çan penceresi (kule tepesi)
  const belfry = Skia.Path.Make();
  belfry.addRRect(Skia.RRectXY(Skia.XYWHRect(tx - 6 * k, tower.top + 6 * k, 12 * k, 16 * k), 6 * k, 6 * k));
  // taş örgü
  const masonry = Skia.Path.Make();
  for (let y = church.top + 5 * k; y < plateau; y += 6 * k) {
    masonry.moveTo(church.x0, y);
    masonry.lineTo(church.x1, y);
  }
  for (let y = tower.top + 5 * k; y < plateau; y += 6 * k) {
    masonry.moveTo(tower.x0, y);
    masonry.lineTo(tower.x1, y);
  }
  // sazdan çatılı hücreler (solda)
  const huts = Skia.Path.Make();
  const thatch = Skia.Path.Make();
  for (const [x, w, h] of [[0.635, 26, 16], [0.672, 20, 13]]) {
    const cx = width * x;
    huts.addRect(Skia.XYWHRect(cx - (w / 2) * k, plateau - h * k, w * k, h * k));
    thatch.moveTo(cx - (w / 2 + 4) * k, plateau - (h - 1) * k);
    thatch.quadTo(cx - (w / 4) * k, plateau - (h + 14) * k, cx, plateau - (h + 15) * k);
    thatch.quadTo(cx + (w / 4) * k, plateau - (h + 14) * k, cx + (w / 2 + 4) * k, plateau - (h - 1) * k);
    thatch.close();
  }
  // hedefler: kilise çatısı (iki nokta), hücre, kule
  const targets = L.fires.map(([x, y]) => [x, y + 6 * k]);
  return { stone, roofs, slates, cross, wins, door, belfry, masonry, huts, thatch, targets, bell: [tx, tower.top + 9 * k] };
}

// ── Uzun gemi — yerel: su hattı y=0, merkez x=0, burun +x; ~170 birim ──
const HULL = "M-82 -38 C-76 -14 -62 4 -40 6 L40 6 C62 4 76 -14 82 -38 L78 -38 C73 -22 60 -9 40 -9 L-40 -9 C-60 -9 -73 -22 -78 -38 Z";
const PLANKS = "M-74 -26 C-64 -6 -48 -1 -30 -1 L30 -1 C48 -1 64 -6 74 -26 M-78 -32 C-70 -12 -54 2 -34 3 L34 3 C54 2 70 -12 78 -32";
const HEAD = "M80 -38 C84 -46 84 -54 80 -61 C83 -66 90 -66 94 -62 L97 -60 L92 -58 C93 -55 91 -53 88 -53 C86 -50 84 -46 83 -38 Z";
const TAIL = "M-80 -38 C-86 -46 -86 -56 -80 -60 C-74 -64 -70 -58 -74 -54 C-77 -51 -80 -53 -79 -55";
const SAIL = "M-42 -112 L42 -112 C47 -90 47 -66 40 -46 L-40 -46 C-47 -66 -47 -90 -42 -112 Z";
const STRIPES = "M-30 -112 L-20 -112 L-20 -46 L-30 -46 Z M-10 -112 L0 -112 L0 -46 L-10 -46 Z M10 -112 L20 -112 L20 -46 L10 -46 Z M30 -112 L40 -112 L40 -46 L30 -46 Z";
const SHIELD_X = [-52, -42, -32, -22, -12, -2, 8, 18, 28, 38, 48];
const SHIELD_COL = ["#c0392b", "#e6c34a", "#e8e2d0", "#2b2b2b", "#2b5f8a"];

function Ship({ L, width, lane, f, clock, c }) {
  const ln = LANES[lane];
  const pos = useDerivedValue(() => shipPos(L, width, lane, { ...f.value, t: clock.value }));
  const tr = useDerivedValue(() => [{ translateX: pos.value.x }, { translateY: pos.value.y }, { scale: pos.value.s }, { rotate: pos.value.rock }]);
  const op = useDerivedValue(() => {
    // sisten çıkış/sise giriş: solda soluk
    const x = pos.value.x;
    const vis = Math.max(0, Math.min(1, (x + width * 0.25) / (width * 0.35)));
    return f.value.u > 1 ? 0 : vis * (lane === 0 ? 0.75 : 1);
  });
  const oarT = useDerivedValue(() => [{ rotate: 0.45 + Math.sin(clock.value * 2.6 + lane) * 0.3 * f.value.row }]);
  const wakeO = useDerivedValue(() => f.value.row * 0.8);
  const bowT = useDerivedValue(() => [{ rotate: -0.6 - 0.5 * f.value.draw }]);
  return (
    <Group transform={tr} opacity={op}>
      {/* iz ve gölge */}
      <Group opacity={wakeO}>
        <Path path="M-90 2 L-160 6 M-80 4 L-140 10 M84 0 C92 -2 98 2 104 4" style="stroke" strokeWidth={1.6} strokeCap="round" color={rgba(c.glint, 0.55)} />
      </Group>
      <Oval x={-84} y={-1} width={170} height={7} color="rgba(0,0,0,0.3)" />
      {/* kürekler (ön yüz) */}
      {[-46, -30, -14, 2, 18, 34, 50].map((x) => (
        <Group key={x} transform={[{ translateX: x }, { translateY: -10 }]}>
          <Group transform={oarT}>
            <Path path="M0 0 L0 26" style="stroke" strokeWidth={1.3} color={c.wood} />
            <Path path="M-1.6 22 L1.6 22 L1 30 L-1 30 Z" color={c.wood} />
          </Group>
        </Group>
      ))}
      {/* direk, halatlar, yelken */}
      <Path path="M0 -10 L0 -122 M-44 -112 L44 -112 M0 -122 L80 -40 M0 -122 L-80 -40" style="stroke" strokeWidth={1} color={rgba(c.wood, 0.9)} />
      <Path path="M0 -10 L0 -122" style="stroke" strokeWidth={2.6} color={c.wood} />
      <Path path={SAIL} color="#ece2c8" />
      <Group clip={SAIL}>
        <Path path={STRIPES} color={ln.stripe} />
      </Group>
      <Path path="M-42 -112 C-44 -88 -44 -66 -40 -46" style="stroke" strokeWidth={0.8} color="rgba(0,0,0,0.25)" />
      <Path path="M-20 -112 C-18 -90 -18 -66 -20 -46 M20 -112 C22 -90 22 -66 20 -46" style="stroke" strokeWidth={0.6} color="rgba(0,0,0,0.15)" />
      <Path path="M-44 -112 L44 -112" style="stroke" strokeWidth={2.2} color={c.wood} />
      {/* savaşçılar (kalkan arkasında miğferler) */}
      {[-40, -18, 6, 30].map((x, i) => (
        <Group key={x}>
          <Circle cx={x} cy={-20} r={4} color="#d8b090" />
          <Path path={`M${x - 4.4} -20 C${x - 4.4} -26 ${x + 4.4} -26 ${x + 4.4} -20 Z`} color="#8a8f96" />
          <Path path={`M${x} -20 L${x} -16`} style="stroke" strokeWidth={0.8} color="#6a6f76" />
          {i % 2 === 0 && <Path path={`M${x + 3} -18 L${x + 10} -44`} style="stroke" strokeWidth={1} color={c.wood} />}
        </Group>
      ))}
      {/* gövde */}
      <Path path={HULL}>
        <LinearGradient start={vec(0, -38)} end={vec(0, 6)} colors={[c.wood, "#24160c"]} />
      </Path>
      <Path path={PLANKS} style="stroke" strokeWidth={0.7} color="rgba(0,0,0,0.4)" />
      <Path path={HEAD} color={c.wood} />
      <Circle cx={89} cy={-60} r={1.1} color="#ffcf6a" />
      <Path path="M84 -64 L80 -72 M88 -65 L87 -73" style="stroke" strokeWidth={1} color={c.wood} />
      <Path path={TAIL} style="stroke" strokeWidth={3.2} strokeCap="round" color={c.wood} />
      {/* kalkanlar */}
      {SHIELD_X.map((x, i) => (
        <Group key={x}>
          <Circle cx={x} cy={-12} r={4.8} color={SHIELD_COL[(i + lane) % SHIELD_COL.length]} />
          <Path path={`M${x - 4.8} -12 L${x + 4.8} -12 M${x} -16.8 L${x} -7.2`} style="stroke" strokeWidth={0.8} color="rgba(0,0,0,0.3)" />
          <Circle cx={x} cy={-12} r={1.3} color="#b0b4b8" />
        </Group>
      ))}
      {/* öndeki okçu (yalnız en yakın gemide) */}
      {lane === 2 && (
        <Group transform={[{ translateX: 62 }, { translateY: -24 }]}>
          <Path path="M-3 0 C-3.6 -6 -3 -12 0 -14 C3 -12 3.6 -6 3 0 Z" color="#4a3a2a" />
          <Circle cx={0} cy={-17} r={3.4} color="#d8b090" />
          <Path path="M-3.8 -17 C-3.8 -22 3.8 -22 3.8 -17 Z" color="#8a8f96" />
          <Group transform={[{ translateX: 2 }, { translateY: -11 }]}>
            <Group transform={bowT}>
              <Path path="M0 0 L12 0" style="stroke" strokeWidth={1.6} strokeCap="round" color="#4a3a2a" />
              <Path path="M12 -9 C17 -4 17 4 12 9" style="stroke" strokeWidth={1.4} color={c.wood} />
              <Path path="M12 -9 L12 9" style="stroke" strokeWidth={0.4} color="rgba(255,255,255,0.6)" />
            </Group>
          </Group>
        </Group>
      )}
    </Group>
  );
}

// Alevli ok
function Arrow({ L, width, f, i, abbey, c }) {
  const [t0, tgt] = ARROWS[i];
  const st = useDerivedValue(() => {
    const q = f.value;
    const s = (q.u - t0) / FLIGHT;
    if (q.u > 1 || s <= 0 || s >= 1) return { o: 0, x: -999, y: 0, a: 0 };
    const ship = shipPos(L, width, 2, { ...q, t: 0 });
    const x0 = ship.x + 74 * ship.s;
    const y0 = ship.y - 35 * ship.s;
    const [x1, y1] = abbey.targets[tgt];
    const lift = 120 * L.k;
    const x = x0 + (x1 - x0) * s;
    const y = y0 + (y1 - y0) * s - lift * 4 * s * (1 - s);
    const dx = x1 - x0;
    const dy = y1 - y0 - lift * 4 * (1 - 2 * s);
    return { o: 1, x, y, a: Math.atan2(dy, dx) };
  });
  const tr = useDerivedValue(() => [{ translateX: st.value.x }, { translateY: st.value.y }, { rotate: st.value.a }, { scale: L.k }]);
  const op = useDerivedValue(() => st.value.o);
  return (
    <Group transform={tr} opacity={op}>
      <Path path="M-26 0 L0 0" style="stroke" strokeWidth={2.4} strokeCap="round" color="rgba(255,170,60,0.22)" />
      <Path path="M-16 0 L2 0" style="stroke" strokeWidth={1} color="#3a2a1a" />
      <Circle cx={2} cy={0} r={4} color="rgba(255,170,60,0.75)" />
      <Circle cx={2} cy={0} r={2} color="#fff0b0" />
    </Group>
  );
}

// Çatı alevi
const FLAME = "M0 0 C-6 -4 -8 -12 -4 -20 C-3 -14 -1 -12 0 -12 C-1 -18 1 -26 6 -32 C6 -24 10 -18 9 -10 C11 -12 12 -15 12 -17 C15 -10 12 -2 6 0 Z";
function Fire({ L, f, clock, i, c }) {
  const [x, y, s] = L.fires[i];
  const on = useDerivedValue(() => {
    const q = f.value;
    const st = (q.u - (0.255 + i * 0.03)) / 0.06;
    const ign = st <= 0 ? 0 : st >= 1 ? 1 : st;
    return q.u > 1 ? 0 : ign * q.burn;
  });
  const tr = useDerivedValue(() => [
    { translateX: x }, { translateY: y }, { scale: L.k * s * (0.4 + 0.6 * on.value) },
    { scaleY: 1 + 0.16 * Math.sin(clock.value * 9 + i) + 0.08 * Math.sin(clock.value * 17 + i * 2) },
  ]);
  const glowO = useDerivedValue(() => on.value * (0.75 + 0.15 * Math.sin(clock.value * 6 + i)));
  return (
    <Group>
      <Group opacity={glowO}>
        <Circle cx={x} cy={y - 10 * L.k} r={52 * L.k * s}>
          <RadialGradient c={vec(x, y - 10 * L.k)} r={52 * L.k * s} colors={[rgba(c.fire, 0.55), rgba(c.fire, 0)]} />
        </Circle>
      </Group>
      <Group opacity={on} transform={tr}>
        <Group transform={[{ translateX: -10 }]}>
          <Path path={FLAME} color="rgba(220,60,20,0.9)" />
        </Group>
        <Group transform={[{ translateX: 2 }, { scale: 1.25 }]}>
          <Path path={FLAME} color="rgba(255,120,30,0.92)" />
        </Group>
        <Group transform={[{ translateX: -2 }, { scale: 0.7 }]}>
          <Path path={FLAME} color="rgba(255,214,110,0.95)" />
        </Group>
      </Group>
    </Group>
  );
}

function Smoke({ L, f, clock, i, c }) {
  const j = i % L.fires.length;
  const [x, y, s] = L.fires[j];
  const tr = useDerivedValue(() => {
    const c0 = (clock.value * 0.12 + i / 8) % 1;
    return [{ translateX: x + c0 * 46 * L.k + Math.sin(c0 * 5 + i) * 6 * L.k }, { translateY: y - 20 * L.k - c0 * 120 * L.k }, { scale: L.k * s * (0.6 + c0 * 2.6) }];
  });
  const op = useDerivedValue(() => {
    const c0 = (clock.value * 0.12 + i / 8) % 1;
    return f.value.smoke * Math.sin(c0 * Math.PI) * 0.55;
  });
  return (
    <Group transform={tr} opacity={op}>
      <Oval x={-12} y={-8} width={24} height={16} color={rgba(c.fog, 0.6)} />
    </Group>
  );
}

function FogBank({ i, clock, width, L, c }) {
  const tr = useDerivedValue(() => [{ translateX: -40 * L.k + Math.sin(clock.value * 0.08 + i * 2) * 30 * L.k + i * width * 0.12 }, { translateY: L.ground - (30 + i * 26) * L.k }]);
  return (
    <Group transform={tr}>
      <Oval x={-width * 0.3} y={-22 * L.k} width={width * 0.62} height={44 * L.k}>
        <RadialGradient c={vec(0, 0)} r={width * 0.31} colors={[rgba(c.fog, 0.16), rgba(c.fog, 0)]} />
      </Oval>
    </Group>
  );
}

export default function VikingsScene({ p, clock, width, height, tone }) {
  const c = toneMap(tone.colors);
  const L = vikLayout(width, height);
  const { k } = L;
  const light = c.glint === "#ffffff";
  const land = useMemo(() => buildLand(L, width, height), [width, height]);
  const abbey = useMemo(() => buildAbbey(L, width), [width, height]);
  const f = useDerivedValue(() => vikFrame(p, clock.value));
  const glitT = useDerivedValue(() => [{ translateX: Math.sin(clock.value * 0.7) * 3 * k }]);
  const glitO = useDerivedValue(() => 0.45 + 0.15 * Math.sin(clock.value * 1.9));
  const waveT = useDerivedValue(() => [{ translateX: ((clock.value * 3) % (40 * k)) - 20 * k }]);
  const winO = useDerivedValue(() => 0.85 + 0.15 * Math.sin(clock.value * 1.3));
  const bellT = useDerivedValue(() => [{ translateX: abbey.bell[0] }, { translateY: abbey.bell[1] }, { rotate: Math.sin(clock.value * 4.2) * 0.5 * f.value.bell }]);
  const abbeyGlowO = useDerivedValue(() => f.value.burn * (0.7 + 0.2 * Math.sin(clock.value * 3)));
  return (
    <Group>
      {/* ay */}
      <Circle cx={L.moon.x} cy={L.moon.y} r={L.moon.r * 3}>
        <RadialGradient c={vec(L.moon.x, L.moon.y)} r={L.moon.r * 3} colors={[light ? "rgba(255,255,255,0.4)" : "rgba(220,235,255,0.16)", "rgba(220,235,255,0)"]} />
      </Circle>
      <Circle cx={L.moon.x} cy={L.moon.y} r={L.moon.r} color={light ? "#ffffff" : "#e9eef6"} />
      <Circle cx={L.moon.x - 6 * k} cy={L.moon.y - 4 * k} r={5 * k} color="rgba(120,135,160,0.25)" />
      <Circle cx={L.moon.x + 7 * k} cy={L.moon.y + 6 * k} r={3.4 * k} color="rgba(120,135,160,0.22)" />

      <Group opacity={tone.alpha}>
        <Path path={land.far} color={rgba(c.cliff, 0.75)} />
        <Path path={land.sea}>
          <LinearGradient start={vec(0, L.horizon)} end={vec(0, height)} colors={[c.sea, c.deep, c.night]} positions={[0, 0.55, 1]} />
        </Path>
        <Group transform={waveT}>
          <Path path={land.waves} style="stroke" strokeWidth={0.8 * k} color={rgba(c.glint, light ? 0.45 : 0.22)} />
        </Group>
        <Group transform={glitT} opacity={glitO}>
          <Path path={land.glitter} color={c.glint} />
        </Group>
      </Group>
      {[0, 1, 2].map((i) => (
        <FogBank key={`f${i}`} i={i} clock={clock} width={width} L={L} c={c} />
      ))}

      {/* gemiler: uzaktan yakına */}
      {[0, 1, 2].map((lane) => (
        <Ship key={lane} L={L} width={width} lane={lane} f={f} clock={clock} c={c} />
      ))}

      {/* kayalık + manastır */}
      <Group opacity={tone.alpha}>
        <Path path={land.cliff}>
          <LinearGradient start={vec(0, L.plateau)} end={vec(0, height)} colors={[c.cliff, c.night]} />
        </Path>
        <Path path={land.cliffLit} color={rgba(c.cliffLit, 0.55)} />
        <Path path={land.cracks} style="stroke" strokeWidth={0.8 * k} color="rgba(0,0,0,0.35)" />
        <Path path={land.foam} style="stroke" strokeWidth={1.2 * k} strokeCap="round" color={rgba(c.glint, 0.5)} />
        <Group opacity={abbeyGlowO}>
          <Circle cx={width * 0.8} cy={L.church.top} r={130 * k}>
            <RadialGradient c={vec(width * 0.8, L.church.top)} r={130 * k} colors={[rgba(c.fire, 0.35), rgba(c.fire, 0)]} />
          </Circle>
        </Group>
        <Path path={abbey.thatch} color="#6a5432" />
        <Path path={abbey.huts} color={c.stone} />
        <Path path={abbey.stone}>
          <LinearGradient start={vec(0, L.tower.top)} end={vec(0, L.plateau)} colors={[c.stone, rgba(c.stone, 0.75)]} />
        </Path>
        <Path path={abbey.masonry} style="stroke" strokeWidth={0.45 * k} color="rgba(0,0,0,0.2)" />
        <Path path={abbey.roofs} color={c.roof} />
        <Path path={abbey.slates} style="stroke" strokeWidth={0.5 * k} color="rgba(255,255,255,0.12)" />
        <Path path={abbey.cross} color={c.stone} />
        <Group opacity={winO}>
          <Path path={abbey.wins} color={c.window} />
        </Group>
        <Path path={abbey.door} color={c.wood} />
        <Path path={abbey.belfry} color="#141414" />
        <Group transform={bellT}>
          <Path path={`M${-4 * k} ${8 * k} C${-4 * k} ${2 * k} ${-3 * k} 0 0 0 C${3 * k} 0 ${4 * k} ${2 * k} ${4 * k} ${8 * k} Z`} color="#b08a3a" />
        </Group>
        <Path path={land.grass} color={c.grass} />
      </Group>

      {/* yangın */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <Smoke key={`s${i}`} L={L} f={f} clock={clock} i={i} c={c} />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <Fire key={`r${i}`} L={L} f={f} clock={clock} i={i} c={c} />
      ))}
      {ARROWS.map((_, i) => (
        <Arrow key={`a${i}`} L={L} width={width} f={f} i={i} abbey={abbey} c={c} />
      ))}
    </Group>
  );
}
