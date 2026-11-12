// components/decor/gotScene.js
//
// Game of Thrones atmosfer sahnesi (OVERLAY.iceWall = 17, ön katman) — tamamı VEKTÖR
// (eski ejderha 128 px atlas sprite'ıydı, büyütülünce bulanıyordu):
//   • Duvar: yüzlü (prizmatik) buz kayalığı, kar kasketi + sarkıtlar, tabakalar, çatlaklar,
//     parıldayan buz kristalleri; solda zikzak ahşap merdiven, iniş-çıkış yapan asansör kafesi
//     ve tepedeki ahşap yürüyüş yolunda meşaleli iki nöbetçi.
//   • Kara Kale (önde): taş salonlar ve mazgallı kuleler, sıcak ışıklı pencereler, bacadan
//     tüten duman, ahşap çit, karlı avlu.
//   • Olay (gotFrame, 30 sn): ölü buz ejderhası (sırtında Gece Kralı) uzaktan süzülür → Duvar'ın
//     önünde havada durur, nefes alır → mavi ateş üfler, ateş duvar tepesinde kayar, çatlaklar
//     ısınır → gedik çöker (sarsıntı, buz kırıkları, toz) → ejderha yükselip gider → ölüler
//     ordusu gedikten akar → duvar döngü sonunda yeniden belirir.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift (sekme çubuğu), duvar tepesi SCENERY.wallTop.
// Ejderha kendi renkleriyle; buz/taş/kar tonları OVERLAY_TONES[17] (GOT_TONE adları).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Circle, Group, LinearGradient, Oval, Path, RadialGradient, Skia, vec } from "@shopify/react-native-skia";
import { gotFrame, hash01, sceneScale } from "../../utils/weatherParticles";
import { SCENERY } from "../../utils/weatherUniverses";

const GOT_TONE = ["ice", "deep", "glint", "wood", "blue", "stone", "stoneDark", "roof", "window", "snow", "night", "plain"];
const toneMap = (colors) => Object.fromEntries(GOT_TONE.map((name, i) => [name, colors[i] || colors[0]]));

function rgba(hex, a) {
  const h = String(hex).replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const WALL_N = 40;
const BREACH_A = 22;
const BREACH_B = 36;
const BREACH_COL = 2;

/** Sahne yerleşimi (dp). */
export function gotLayout(width, height) {
  const k = sceneScale(width, height);
  const ground = height - SCENERY.lift * k;
  const wallTop = height - SCENERY.wallTop * k;
  const step = width / WALL_N;
  return {
    k, ground, wallTop, step,
    bx0: BREACH_A * step,
    bx1: BREACH_B * step,
    hitX: width * 0.7,
    hx: width * 0.3,
    hy: wallTop - 120 * k,
    stairs: { x0: width * 0.07, x1: width * 0.33 },
    liftX: width * 0.4,
    walk: { x0: width * 0.04, x1: width * 0.5 },
  };
}

// ── Duvar ──────────────────────────────────────────────────────────────────────
function wallProfile(L) {
  const ys = [];
  for (let s = -1; s <= WALL_N + 1; s += 1) {
    let y = L.wallTop + (hash01(s, 1.3) - 0.5) * 5 * L.k;
    if (s >= 19 && hash01(s, 4.7) > 0.72) y -= (7 + hash01(s, 9.1) * 13) * L.k; // sivri buz kütleleri
    ys.push(y);
  }
  return { y: (s) => ys[s + 1], x: (s) => s * L.step };
}

function wallPiece(prof, s0, s1, L) {
  const { k, wallTop } = L;
  const foot = L.ground + 6 * k;
  const H = foot - wallTop;
  const body = Skia.Path.Make();
  body.moveTo(prof.x(s0), foot);
  for (let s = s0; s <= s1; s += 1) body.lineTo(prof.x(s), prof.y(s));
  body.lineTo(prof.x(s1), foot);
  body.close();
  const lit = Skia.Path.Make();
  const dark = Skia.Path.Make();
  const ridge = Skia.Path.Make();
  const cracks = Skia.Path.Make();
  const strata = Skia.Path.Make();
  const cap = Skia.Path.Make();
  const icicles = Skia.Path.Make();
  const rim = Skia.Path.Make();
  for (let s = s0; s < s1; s += 1) {
    const x0 = prof.x(s);
    const x1 = prof.x(s + 1);
    const y0 = prof.y(s);
    const y1 = prof.y(s + 1);
    const xm = (x0 + x1) / 2;
    const lean = (hash01(s, 2.2) - 0.5) * 10 * k;
    // uzun dikey prizma yüzleri: sol yarı ışık, sağ yarı gölge (her dilimde farklı boy)
    const litBot = wallTop + H * (0.55 + hash01(s, 3.3) * 0.45);
    lit.moveTo(x0, y0 + 6 * k);
    lit.lineTo(xm + lean * 0.2, (y0 + y1) / 2 + 6 * k);
    lit.lineTo(xm + lean, litBot);
    lit.lineTo(x0 + lean * 0.7, litBot + 10 * k);
    lit.close();
    if (hash01(s, 6.6) > 0.3) {
      const darkBot = wallTop + H * (0.4 + hash01(s, 5.1) * 0.6);
      dark.moveTo(xm + lean * 0.2, (y0 + y1) / 2 + 8 * k);
      dark.lineTo(x1, y1 + 8 * k);
      dark.lineTo(x1 + lean * 0.9, darkBot);
      dark.lineTo(xm + lean, darkBot - 12 * k);
      dark.close();
    }
    ridge.moveTo(xm + lean * 0.2, (y0 + y1) / 2 + 10 * k);
    ridge.lineTo(xm + lean, litBot);
    // kar kasketi (kalın, topaklı) + sarkıtlar
    const capD0 = (5 + hash01(s, 8.8) * 6) * k;
    const capD1 = (5 + hash01(s + 1, 8.8) * 6) * k;
    cap.moveTo(x0, y0 - 1.5 * k);
    cap.quadTo(xm, Math.min(y0, y1) - 4 * k, x1, y1 - 1.5 * k);
    cap.lineTo(x1, y1 + capD1);
    cap.quadTo(xm, (y0 + y1) / 2 + Math.max(capD0, capD1) + 3 * k, x0, y0 + capD0);
    cap.close();
    rim.moveTo(x0, y0 - 1.5 * k);
    rim.quadTo(xm, Math.min(y0, y1) - 4 * k, x1, y1 - 1.5 * k);
    const nI = 1 + Math.floor(hash01(s, 7.1) * 3);
    for (let j = 0; j < nI; j += 1) {
      const ix = x0 + (x1 - x0) * (0.2 + 0.6 * hash01(s * 3 + j, 1.7));
      const iy = y0 + (y1 - y0) * ((ix - x0) / (x1 - x0)) + capD0 + 1 * k;
      const il = (5 + hash01(s * 5 + j, 2.9) * 12) * k;
      icicles.moveTo(ix - 1.4 * k, iy - 1 * k);
      icicles.lineTo(ix + 1.4 * k, iy - 1 * k);
      icicles.lineTo(ix + 0.2 * k, iy + il);
      icicles.close();
    }
    // çatlak
    if (hash01(s, 7.7) > 0.5) {
      let cx = x0 + (x1 - x0) * hash01(s, 1.9);
      let cy = y0 + 14 * k;
      cracks.moveTo(cx, cy);
      for (let j = 0; j < 6 && cy < foot; j += 1) {
        cy += (12 + hash01(s * 7 + j, 3.1) * 22) * k;
        cx += (hash01(s * 5 + j, 2.7) - 0.5) * 12 * k;
        cracks.lineTo(cx, cy);
      }
    }
  }
  for (let j = 1; j < 7; j += 1) {
    const y = wallTop + (H * j) / 7.2;
    strata.moveTo(prof.x(s0), y);
    for (let s = s0; s <= s1; s += 1) strata.lineTo(prof.x(s), y + Math.sin(s * 0.9 + j * 1.7) * 2.2 * k);
  }
  return { body, lit, dark, ridge, cracks, strata, cap, icicles, rim, x0: prof.x(s0), x1: prof.x(s1) };
}

function WallPiece({ piece, L, c, heat }) {
  return (
    <>
      <Path path={piece.body}>
        <LinearGradient start={vec(0, L.wallTop - 10 * L.k)} end={vec(0, L.ground)} colors={[c.ice, rgba(c.ice, 0.95), c.deep]} positions={[0, 0.3, 1]} />
      </Path>
      <Path path={piece.lit} color={rgba(c.glint, 0.2)} />
      <Path path={piece.dark} color={rgba(c.deep, 0.38)} />
      <Path path={piece.ridge} style="stroke" strokeWidth={1.1 * L.k} color={rgba(c.glint, 0.45)} />
      <Path path={piece.strata} style="stroke" strokeWidth={0.8 * L.k} color={rgba(c.glint, 0.22)} />
      <Path path={piece.cracks} style="stroke" strokeWidth={1.1 * L.k} strokeJoin="round" color={rgba(c.deep, 0.85)} />
      <Group opacity={heat}>
        <Path path={piece.cracks} style="stroke" strokeWidth={5 * L.k} strokeJoin="round" color={rgba(c.blue, 0.4)} />
        <Path path={piece.cracks} style="stroke" strokeWidth={1.6 * L.k} strokeJoin="round" color="rgba(255,255,255,0.95)" />
      </Group>
      <Path path={piece.icicles} color={rgba(c.glint, 0.85)} />
      <Path path={piece.cap} color={c.snow} />
      <Path path={piece.rim} style="stroke" strokeWidth={1.4 * L.k} color={rgba(c.glint, 0.95)} />
    </>
  );
}

// Çöken sütun: gecikmeli hızlanan düşüş + hafif devrilme; ateşe yakın olan önce çöker.
function WallColumn({ piece, order, f, L, c, heat }) {
  const { k } = L;
  const H = L.ground - L.wallTop;
  const cx = (piece.x0 + piece.x1) / 2;
  const pivotY = L.wallTop + 24 * k;
  const lean = (order % 2 ? 1 : -1) * (0.05 + 0.05 * hash01(order, 2));
  const transform = useDerivedValue(() => {
    const v = (f.value.fall - order * 0.07) / 0.5;
    const q = v < 0 ? 0 : v > 1 ? 1 : v;
    const e = q * q;
    return [
      { translateX: cx + lean * e * 60 * k },
      { translateY: pivotY + e * (H + 80 * k) },
      { rotate: lean * e },
      { translateX: -cx },
      { translateY: -pivotY },
    ];
  });
  const opacity = useDerivedValue(() => f.value.vis);
  return (
    <Group transform={transform} opacity={opacity}>
      <WallPiece piece={piece} L={L} c={c} heat={heat} />
    </Group>
  );
}

function buildDebris(L) {
  const out = [];
  for (let i = 0; i < 12; i += 1) {
    const path = Skia.Path.Make();
    const w = (3 + hash01(i, 1.1) * 8) * L.k;
    path.moveTo(-w, 0);
    path.lineTo(-w * 0.2, -w * 0.9);
    path.lineTo(w * 0.8, -w * 0.4);
    path.lineTo(w, w * 0.4);
    path.lineTo(-w * 0.3, w * 0.8);
    path.close();
    const hi = Skia.Path.Make();
    hi.moveTo(-w, 0);
    hi.lineTo(-w * 0.2, -w * 0.9);
    hi.lineTo(w * 0.8, -w * 0.4);
    hi.lineTo(0, 0);
    hi.close();
    out.push({
      path, hi,
      x: L.bx0 + (L.bx1 - L.bx0) * hash01(i, 2.3),
      y: L.wallTop + (6 + hash01(i, 3.9) * 50) * L.k,
      vx: (hash01(i, 6.2) - 0.4) * 150,
      vy: -(60 + hash01(i, 8.4) * 130),
      rot: (hash01(i, 9.7) - 0.5) * 2.4,
      t: 0.7 + hash01(i, 4.4) * 0.5,
    });
  }
  return out;
}

function Debris({ d, f, k, c }) {
  const transform = useDerivedValue(() => {
    const q = f.value.fall * d.t;
    return [{ translateX: d.x + d.vx * q * k }, { translateY: d.y + (d.vy * q + 300 * q * q) * k }, { rotate: d.rot * q * 3 }];
  });
  return (
    <Group transform={transform}>
      <Path path={d.path} color={c.ice} />
      <Path path={d.hi} color={rgba(c.glint, 0.8)} />
    </Group>
  );
}

// ── Merdiven, asansör, yürüyüş yolu ───────────────────────────────────────────
function buildWorks(L) {
  const { k, ground, wallTop, stairs } = L;
  const flights = 7;
  const yb = ground - 4 * k;
  const yt = wallTop + 16 * k;
  const beams = Skia.Path.Make();
  const steps = Skia.Path.Make();
  const rails = Skia.Path.Make();
  const posts = Skia.Path.Make();
  const landings = Skia.Path.Make();
  for (let i = 0; i < flights; i += 1) {
    const ya = yb - ((yb - yt) * i) / flights;
    const yz = yb - ((yb - yt) * (i + 1)) / flights;
    const xa = i % 2 ? stairs.x1 : stairs.x0;
    const xz = i % 2 ? stairs.x0 : stairs.x1;
    beams.moveTo(xa, ya);
    beams.lineTo(xz, yz);
    rails.moveTo(xa, ya - 6 * k);
    rails.lineTo(xz, yz - 6 * k);
    const n = 14;
    for (let j = 1; j < n; j += 1) {
      const x = xa + ((xz - xa) * j) / n;
      const y = ya + ((yz - ya) * j) / n;
      steps.moveTo(x, y);
      steps.lineTo(x, y - 2 * k);
      if (j % 4 === 0) {
        posts.moveTo(x, y);
        posts.lineTo(x, y - 6 * k);
      }
    }
    landings.addRect(Skia.XYWHRect(xz - 6 * k, yz - 1 * k, 12 * k, 2.4 * k));
    posts.moveTo(xz, yz);
    posts.lineTo(xz, yz + 12 * k);
  }
  // asansör: tepede vinç kulübesi, iki halat
  const hut = Skia.Path.Make();
  hut.addRect(Skia.XYWHRect(L.liftX - 10 * k, wallTop - 16 * k, 20 * k, 12 * k));
  const hutRoof = Skia.Path.Make();
  hutRoof.moveTo(L.liftX - 13 * k, wallTop - 15 * k);
  hutRoof.lineTo(L.liftX, wallTop - 24 * k);
  hutRoof.lineTo(L.liftX + 13 * k, wallTop - 15 * k);
  hutRoof.close();
  const ropes = Skia.Path.Make();
  for (const dx of [-3, 3]) {
    ropes.moveTo(L.liftX + dx * k, wallTop - 4 * k);
    ropes.lineTo(L.liftX + dx * k, ground - 2 * k);
  }
  // tepe yürüyüş yolu: korkuluk + direkler
  const walk = Skia.Path.Make();
  walk.moveTo(L.walk.x0, wallTop - 3 * k);
  walk.lineTo(L.walk.x1, wallTop - 3 * k);
  walk.moveTo(L.walk.x0, wallTop - 8 * k);
  walk.lineTo(L.walk.x1, wallTop - 8 * k);
  for (let x = L.walk.x0; x <= L.walk.x1; x += 9 * k) {
    walk.moveTo(x, wallTop - 2 * k);
    walk.lineTo(x, wallTop - 9 * k);
  }
  return { beams, steps, rails, posts, landings, hut, hutRoof, ropes, walk };
}

function LiftCage({ L, c, clock }) {
  const { k } = L;
  const T = useDerivedValue(() => {
    const ph = (clock.value / 46) % 1;
    const tri = ph < 0.5 ? ph * 2 : 2 - ph * 2;
    const e = tri * tri * (3 - 2 * tri);
    return [{ translateX: L.liftX }, { translateY: L.ground - 16 * k - (L.ground - L.wallTop - 26 * k) * e }];
  });
  return (
    <Group transform={T}>
      <Path path={`M${-6 * k} ${-6 * k} L${6 * k} ${-6 * k} L${6 * k} ${6 * k} L${-6 * k} ${6 * k} Z`} color={rgba(c.wood, 1)} />
      <Path path={`M${-6 * k} ${-6 * k} L${6 * k} ${6 * k} M${6 * k} ${-6 * k} L${-6 * k} ${6 * k} M${-6 * k} 0 L${6 * k} 0`} style="stroke" strokeWidth={0.8 * k} color={rgba(c.snow, 0.5)} />
    </Group>
  );
}

// Meşaleli nöbetçi (siyah pelerin): yürüyüş yolunda gidip gelir.
function Sentry({ L, clock, i }) {
  const { k } = L;
  const per = 34 + i * 9;
  const T = useDerivedValue(() => {
    const ph = (clock.value / per + i * 0.37) % 1;
    const tri = ph < 0.5 ? ph * 2 : 2 - ph * 2;
    const x = L.walk.x0 + 8 * k + (L.walk.x1 - L.walk.x0 - 16 * k) * tri;
    const bob = Math.abs(Math.sin(clock.value * 5 + i)) * 0.6 * k;
    return [{ translateX: x }, { translateY: L.wallTop - 3 * k - bob }, { scaleX: (ph < 0.5 ? 1 : -1) * 1.15 * k }, { scaleY: 1.15 * k }];
  });
  const glow = useDerivedValue(() => 0.65 + 0.2 * Math.sin(clock.value * 9 + i * 2) + 0.15 * Math.sin(clock.value * 13.7));
  return (
    <Group transform={T}>
      <Path path="M-2.6 0 L2.4 0 L1.6 -7.4 L-1.8 -7.4 Z" color="#101216" />
      <Circle cx={0} cy={-8.8} r={1.6} color="#14161b" />
      <Path path="M1.2 -6 L4.2 -10.5" style="stroke" strokeWidth={0.7} color="#5a4334" />
      <Group opacity={glow}>
        <Circle cx={4.4} cy={-11.2} r={5}>
          <RadialGradient c={vec(4.4, -11.2)} r={5} colors={["rgba(255,190,90,0.8)", "rgba(255,140,40,0)"]} />
        </Circle>
        <Path path="M3.4 -10.6 C3.4 -12 4.4 -13.6 4.6 -14.4 C5.2 -13 5.6 -12 5.4 -10.6 Z" color="#ffd27a" />
      </Group>
    </Group>
  );
}

// ── Kara Kale ──────────────────────────────────────────────────────────────────
// [x oranı, genişlik, yükseklik, tür]
const KEEP = [
  [-0.01, 50, 30, "hall"], [0.12, 22, 70, "tower"], [0.2, 52, 38, "hall"], [0.345, 28, 54, "tower"],
  [0.43, 36, 24, "hall"], [0.9, 30, 22, "hall"],
];

function buildCastle(width, L) {
  const { k, ground } = L;
  const lit = Skia.Path.Make();
  const shade = Skia.Path.Make();
  const roofs = Skia.Path.Make();
  const courses = Skia.Path.Make();
  const windows = Skia.Path.Make();
  const doors = Skia.Path.Make();
  const snowRoof = Skia.Path.Make();
  const chimneys = [];
  KEEP.forEach(([fx, w0, h0, type], idx) => {
    const x = width * fx;
    const w = w0 * k;
    const h = h0 * k;
    const y = ground - h;
    lit.addRect(Skia.XYWHRect(x, y, w * 0.78, h + 2 * k));
    shade.addRect(Skia.XYWHRect(x + w * 0.78, y, w * 0.22, h + 2 * k));
    for (let yy = y + 5 * k; yy < ground; yy += 5 * k) {
      courses.moveTo(x, yy);
      courses.lineTo(x + w, yy);
    }
    if (type === "tower") {
      for (let b = 0; b < 4; b += 1) {
        const bw = w / 7;
        lit.addRect(Skia.XYWHRect(x + b * bw * 2, y - 5 * k, bw, 5 * k));
      }
      snowRoof.addRect(Skia.XYWHRect(x - 0.5 * k, y - 1.4 * k, w + 1 * k, 2 * k));
      for (let r = 0; r < 3; r += 1) {
        windows.addRect(Skia.XYWHRect(x + w * 0.38, y + (10 + r * 16) * k, 3 * k, 5 * k));
      }
    } else {
      roofs.moveTo(x - 3 * k, y + 1 * k);
      roofs.lineTo(x + w * 0.5, y - h * 0.45 - 4 * k);
      roofs.lineTo(x + w + 3 * k, y + 1 * k);
      roofs.close();
      snowRoof.moveTo(x - 3 * k, y + 1 * k);
      snowRoof.lineTo(x + w * 0.5, y - h * 0.45 - 4 * k);
      snowRoof.lineTo(x + w * 0.5 + 3 * k, y - h * 0.45 - 2 * k);
      snowRoof.lineTo(x + 2 * k, y + 1 * k);
      snowRoof.close();
      const nW = Math.max(2, Math.floor(w / (12 * k)));
      for (let j = 0; j < nW; j += 1) {
        if (hash01(idx * 9 + j, 4.1) > 0.25) windows.addRect(Skia.XYWHRect(x + (j + 0.5) * (w / nW) - 1.6 * k, y + h * 0.35, 3.2 * k, 4.6 * k));
      }
      doors.addRect(Skia.XYWHRect(x + w * 0.62, ground - 10 * k, 5 * k, 10 * k));
      chimneys.push({ x: x + w * 0.24, y: y - h * 0.2 - 6 * k });
      lit.addRect(Skia.XYWHRect(x + w * 0.24 - 2 * k, y - h * 0.2 - 6 * k, 4 * k, 8 * k));
    }
  });
  // ahşap çit (sivri kazıklar), kapı boşluğu
  const fence = Skia.Path.Make();
  for (let x = 0; x < width * 0.55; x += 5 * k) {
    if (x > width * 0.27 && x < width * 0.31) continue;
    const h = (10 + hash01(Math.round(x), 2.4) * 3) * k;
    fence.moveTo(x, ground + 4 * k);
    fence.lineTo(x, ground + 4 * k - h);
    fence.lineTo(x + 2 * k, ground + 4 * k - h - 3 * k);
    fence.lineTo(x + 4 * k, ground + 4 * k - h);
    fence.lineTo(x + 4 * k, ground + 4 * k);
    fence.close();
  }
  const torches = [[0.11, ground - 14 * k], [0.27, ground - 12 * k], [0.32, ground - 12 * k], [0.5, ground - 10 * k]].map(([fx, y]) => ({ x: width * fx, y }));
  return { lit, shade, roofs, courses, windows, doors, snowRoof, fence, chimneys, torches };
}

function Smoke({ x, y, k, i, clock, color }) {
  const T = useDerivedValue(() => {
    const ph = (clock.value / 7 + i * 0.25) % 1;
    return [{ translateX: x + ph * 22 * k + Math.sin(ph * 6 + i) * 3 * k }, { translateY: y - ph * 46 * k }, { scale: (3 + ph * 9) * k }];
  });
  const O = useDerivedValue(() => {
    const ph = (clock.value / 7 + i * 0.25) % 1;
    return Math.sin(ph * Math.PI) * 0.35;
  });
  return (
    <Group transform={T} opacity={O}>
      <Circle cx={0} cy={0} r={1}>
        <RadialGradient c={vec(0, 0)} r={1} colors={[rgba(color, 0.9), rgba(color, 0)]} />
      </Circle>
    </Group>
  );
}

// ── Ölüler ordusu: 3 saf, her saf tek yol; gedikten öne doğru akar ────────────
function buildRank(L, r) {
  const fig = Skia.Path.Make();
  const eyes = Skia.Path.Make();
  const half = (L.bx1 - L.bx0) * 0.5;
  const n = 11 + r * 2;
  for (let i = 0; i < n; i += 1) {
    const x = (-0.92 + (1.84 * (i + hash01(i + r * 31, 2.2) * 0.6)) / n) * half;
    const y = (hash01(i + r * 17, 5.3) - 0.5) * 8;
    const s = 0.9 + hash01(i, 7.7 + r) * 0.25;
    const P = (px, py) => [x + px * s, y + py * s];
    const pts = [[-2.2, 0], [-1.6, -7], [-2.8, -8.6], [-1.3, -10.4], [1.3, -10.4], [2.9, -8.2], [1.5, -7], [2.2, 0], [0.8, 0], [0, -4], [-0.8, 0]];
    pts.forEach(([px, py], j) => {
      const [X, Y] = P(px, py);
      if (j === 0) fig.moveTo(X, Y);
      else fig.lineTo(X, Y);
    });
    fig.close();
    const [hx, hy] = P(0, -12.1);
    fig.addCircle(hx, hy, 1.7 * s);
    eyes.addCircle(hx - 0.6 * s, hy - 0.2 * s, 0.45 * s);
    eyes.addCircle(hx + 0.6 * s, hy - 0.2 * s, 0.45 * s);
  }
  return { fig, eyes };
}

function Rank({ L, r, f, clock, geo, c }) {
  const { k } = L;
  const cx = (L.bx0 + L.bx1) / 2;
  const T = useDerivedValue(() => {
    const raw = f.value.army * 1.35 - r * 0.17;
    const q = raw < 0 ? 0 : raw > 1 ? 1 : raw;
    const y = L.wallTop + 70 * k + (L.ground + 20 * k - L.wallTop - 70 * k) * q;
    const bob = Math.abs(Math.sin(clock.value * 6 + r * 1.3)) * 1.2 * k;
    const s = (0.42 + 0.72 * q) * k;
    return [{ translateX: cx + Math.sin(clock.value * 0.8 + r) * 4 * k }, { translateY: y - bob }, { scale: s }];
  });
  const O = useDerivedValue(() => {
    const raw = f.value.army * 1.35 - r * 0.17;
    return raw > 0 ? f.value.armyO : 0;
  });
  return (
    <Group transform={T} opacity={O}>
      <Path path={geo.fig} color="#0d1015" />
      <Path path={geo.eyes} color={c.blue} />
    </Group>
  );
}

// ── Buz ejderhası (yerel birim; gövde merkezi (0,0), sağa bakar) ──────────────
const NK_T = [{ translateX: 34 }, { translateY: -16 }, { rotate: 0.12 }];
const DR = {
  body: "#b9c6d2",
  bodyD: "#6f7f8f",
  scale: "#4f5c69",
  mem: "#7d8fa2",
  memD: "#56677a",
  bone: "#dfe7ee",
  eye: "#8fdcff",
};

const WING =
  "M0 0 C8 -14 16 -28 20 -40 C19 -56 17 -72 16 -86 L22 -97 L18 -86 C2 -92 -14 -97 -30 -100 " +
  "Q-44 -86 -54 -88 L-57 -84 Q-62 -86 -70 -84 Q-80 -66 -100 -52 Q-96 -40 -103 -34 L-99 -30 Q-104 -22 -110 -14 " +
  "Q-92 -14 -80 -7 L-78 -11 Q-62 -4 -46 -6 Q-24 -2 0 0 Z";
const WING_BONES = "M0 0 C8 -14 16 -28 20 -40 C19 -56 17 -72 16 -86";
const WING_FINGERS = "M16 -86 C0 -92 -16 -97 -30 -100 M16 -86 C-14 -86 -46 -86 -70 -84 M16 -86 C-20 -76 -66 -62 -100 -52 M16 -86 C-24 -60 -76 -30 -110 -14";
const WING_VEINS = "M-12 -94 Q-14 -80 -30 -72 M-46 -86 Q-44 -72 -56 -62 M-84 -64 Q-72 -50 -76 -38 M-60 -40 Q-50 -26 -46 -10 M-20 -50 Q-14 -30 -18 -6";
function DragonWing({ angle, sy, far }) {
  const T = useDerivedValue(() => [{ rotate: angle.value }, { scaleY: sy.value }]);
  return (
    <Group transform={T}>
      <Path path={WING}>
        <LinearGradient start={vec(0, -100)} end={vec(-60, 0)} colors={far ? [DR.memD, "#3d4a58"] : [DR.mem, DR.memD]} />
      </Path>
      <Path path={WING_VEINS} style="stroke" strokeWidth={0.7} color={far ? "rgba(40,50,62,0.5)" : "rgba(60,74,90,0.45)"} />
      <Path path={WING_FINGERS} style="stroke" strokeWidth={far ? 1.1 : 1.5} strokeCap="round" color={far ? "#7a8a9a" : "#c2ced9"} />
      <Path path={WING_BONES} style="stroke" strokeWidth={far ? 2.6 : 3.4} strokeCap="round" color={far ? "#7a8a9a" : "#cdd8e2"} />
      <Path path="M16 -86 L23 -97 L19 -85 Z" color="#2b3138" />
    </Group>
  );
}

function DragonArt({ pose }) {
  const wingA = useDerivedValue(() => pose.value.wa);
  const wingS = useDerivedValue(() => pose.value.ws);
  const wingAF = useDerivedValue(() => pose.value.wa * 0.9 - 0.1);
  const wingSF = useDerivedValue(() => pose.value.wsf);
  const tailT = useDerivedValue(() => [{ translateX: -44 }, { translateY: 4 }, { rotate: pose.value.tail }]);
  const headT = useDerivedValue(() => [{ translateX: 86 }, { translateY: 8 }, { rotate: pose.value.head }]);
  const jawT = useDerivedValue(() => [{ translateX: 4 }, { translateY: 3 }, { rotate: pose.value.jaw }]);
  const glowO = useDerivedValue(() => pose.value.glow);
  const farT = [{ translateX: 12 }, { translateY: -18 }, { scale: 0.86 }];
  return (
    <>
      <Group transform={farT}>
        <DragonWing angle={wingAF} sy={wingSF} far />
      </Group>
      {/* kuyruk: kalçadan incelerek uzanır, diken sırası, mızrak uçlu */}
      <Group transform={tailT}>
        <Path path="M4 -9 C-24 -8 -54 0 -82 18 C-94 26 -104 32 -112 35 L-110 39 C-98 37 -86 33 -72 25 C-50 13 -24 9 4 9 Z">
          <LinearGradient start={vec(0, -8)} end={vec(0, 12)} colors={["#a3b1bf", DR.bodyD]} />
        </Path>
        <Path path="M-112 35 C-118 28 -124 27 -130 28 C-124 32 -122 36 -128 46 C-120 44 -114 41 -110 39 Z" color={DR.scale} />
        <Path path="M-8 -9 L-12 -16 L-16 -8 Z M-28 -6 L-33 -13 L-36 -4 Z M-48 0 L-54 -6 L-56 3 Z M-68 9 L-74 4 L-75 13 Z M-88 20 L-93 16 L-93 24 Z" color={DR.scale} />
        <Path path="M0 6 C-26 6 -52 12 -76 24" style="stroke" strokeWidth={1} color="rgba(225,234,242,0.5)" />
      </Group>
      {/* arka bacak: kalça kası, ince alt bacak, pençe */}
      <Path path="M-36 4 C-40 18 -34 26 -28 28 C-30 34 -28 40 -24 44 L-19 43 C-22 38 -22 32 -18 26 C-12 22 -12 10 -18 2 Z" color={DR.bodyD} />
      <Path path="M-24 44 L-30 49 M-22 44 L-25 51 M-20 43 L-18 50" style="stroke" strokeWidth={1.4} strokeCap="round" color="#2b3138" />
      {/* boyun: kalın kökten başa doğru incelen kemer */}
      <Path path="M24 -16 C44 -34 74 -30 92 -2 L88 12 C80 0 66 -6 54 0 C46 4 40 10 36 14 Z">
        <LinearGradient start={vec(40, -30)} end={vec(60, 10)} colors={[DR.body, "#9aa9b8"]} />
      </Path>
      <Path path="M38 12 C50 0 70 -6 88 12" style="stroke" strokeWidth={2.4} color="rgba(225,234,242,0.65)" />
      <Path path="M46 3 L47 -1 M54 -1 L55 -5 M62 -2 L64 -6 M70 -1 L72 -5 M78 2 L80 -2" style="stroke" strokeWidth={0.8} color="rgba(80,94,108,0.6)" />
      {/* gövde: derin göğüs, incelen bel */}
      <Path path="M-48 2 C-46 -8 -30 -12 -10 -15 C10 -19 28 -20 40 -12 C50 -6 50 8 42 15 C30 22 8 20 -14 15 C-30 12 -48 10 -48 2 Z">
        <LinearGradient start={vec(0, -20)} end={vec(0, 20)} colors={[DR.body, "#9aa9b8", DR.bodyD]} positions={[0, 0.55, 1]} />
      </Path>
      <Path path="M-46 -2 C-30 -10 -6 -14 14 -17 C26 -19 36 -17 42 -12" style="stroke" strokeWidth={1.6} color="rgba(70,84,98,0.55)" />
      <Path path="M-40 11 C-20 16 10 19 42 13" style="stroke" strokeWidth={1} color="rgba(230,238,245,0.6)" />
      <Path path="M-30 13 L-29 9 M-18 15 L-17 11 M-6 16 L-5 12 M6 17 L6 13 M18 16 L18 12 M30 14 L29 10" style="stroke" strokeWidth={0.8} color="rgba(90,104,118,0.7)" />
      {/* sırt dikenleri */}
      <Path path="M-36 -8 L-35 -15 L-29 -10 Z M-22 -12 L-20 -20 L-15 -14 Z M-8 -15 L-5 -23 L0 -16 Z M48 -24 L53 -32 L55 -21 Z M64 -24 L70 -31 L71 -19 Z M78 -16 L85 -21 L84 -10 Z" color={DR.scale} />
      {/* ön pençe */}
      <Path path="M30 10 C30 20 36 26 44 28 L46 25 C40 22 38 16 40 8 Z" color={DR.bodyD} />
      <Path path="M44 28 L49 32 M45 26 L51 28 M46 25 L51 23" style="stroke" strokeWidth={1.2} strokeCap="round" color="#2b3138" />
      {/* Gece Kralı (boyun kökünde, kanadın önünde) */}
      <Group transform={NK_T}>
        <Path path="M-4 0 L5 0 L3.4 -12 L-2.6 -12 Z" color="#1a1f27" />
        <Path path="M-2.6 -12 L-6 -6 L-7 1 L-3 -2 Z" color="#232a34" />
        <Path path="M3 -10 L8 -6 L9 -3" style="stroke" strokeWidth={1.6} strokeCap="round" color="#1a1f27" />
        <Circle cx={0.6} cy={-15.4} r={3.4} color="#a9bccb" />
        <Path path="M-2.8 -17.2 L-2.6 -21.6 L-1.2 -18.4 L0.6 -22.8 L2.2 -18.4 L3.8 -21.4 L4 -17 Z" color="#c9d6e0" />
        <Circle cx={2.6} cy={-15.6} r={0.9} color={DR.eye} />
      </Group>
      {/* baş */}
      <Group transform={headT}>
        <Group transform={jawT}>
          <Path path="M-2 0 C10 2 22 3 32 1 L29 6 C19 9 8 9 -2 6 Z" color={DR.bodyD} />
          <Path path="M6 2 L7 -0.6 L8.4 2 M12 2.4 L13 -0.2 L14.4 2.4 M18 2.6 L19 0 L20.4 2.6 M24 2.2 L25 -0.2 L26.4 2" color="#f2f6f8" />
        </Group>
        <Group opacity={glowO}>
          <Circle cx={30} cy={3} r={14}>
            <RadialGradient c={vec(30, 3)} r={14} colors={["rgba(220,245,255,0.95)", "rgba(89,184,255,0.5)", "rgba(89,184,255,0)"]} positions={[0, 0.4, 1]} />
          </Circle>
        </Group>
        <Path path="M-4 -8 C8 -13 22 -10 34 -2 L35 2 C26 3 14 4 2 4 C-4 2 -7 -4 -4 -8 Z" color={DR.body} />
        <Path path="M4 -3 C14 -3 24 -1 34 0" style="stroke" strokeWidth={0.8} color="rgba(80,94,108,0.7)" />
        <Path path="M0 -8 L-16 -20 L4 -5 Z M8 -10 L-4 -27 L11 -8 Z M15 -9 L10 -18 L18 -7 Z" color={DR.bone} />
        <Path path="M-4 0 L-12 4 L-3 3 Z" color={DR.scale} />
        <Circle cx={17} cy={-4.4} r={4.5} color="rgba(143,220,255,0.35)" />
        <Path path="M14.4 -4.6 C16 -6 18.4 -6 19.8 -4.6 C18.4 -3.6 16 -3.6 14.4 -4.6 Z" color={DR.eye} />
        <Circle cx={33} cy={-1} r={0.9} color="#3b4652" />
      </Group>
      <Group transform={[{ translateX: 6 }, { translateY: -14 }]}>
        <DragonWing angle={wingA} sy={wingS} />
      </Group>
    </>
  );
}

/** Ejderhanın dünya konumu (dp) ve ölçeği. */
function dragonPose(L, width, fr, t) {
  "worklet";
  const { k } = L;
  const a = fr.fly;
  const l = fr.leave;
  const x0 = width * 0.04;
  const y0 = L.wallTop - 330 * k;
  let x = x0 + (L.hx - x0) * a;
  let y = y0 + (L.hy - y0) * a;
  let sc = (0.24 + 0.76 * a) * 0.82 * k;
  x += l * l * width * 0.8;
  y -= l * 280 * k;
  sc *= 1 - 0.45 * l;
  const rot = -0.04 + 0.1 * fr.breath - 0.08 * fr.inhale - 0.32 * l;
  const bob = Math.sin(t * 6.2832 * 0.9 - 1) * 5 * sc;
  return { x, y: y + bob, sc, rot };
}

function mouthOf(pose, fr) {
  "worklet";
  const hr = -0.25 * fr.inhale + 0.22 * fr.breath;
  const mx = 86 + 34 * Math.cos(hr) - 3 * Math.sin(hr);
  const my = 8 + 34 * Math.sin(hr) + 3 * Math.cos(hr);
  const c = Math.cos(pose.rot);
  const s = Math.sin(pose.rot);
  return { x: pose.x + pose.sc * (mx * c - my * s), y: pose.y + pose.sc * (mx * s + my * c), hr };
}

// Ateş: birim koni (x 0→1, y ±1); dünyada döndürülüp boy/en ile ölçeklenir.
const FLAME_OUT = "M0 -0.12 C0.25 -0.3 0.5 -0.62 0.75 -0.8 C0.86 -0.95 0.95 -1.05 1.04 -0.9 C1.1 -0.4 1.1 0.4 1.04 0.9 C0.95 1.05 0.86 0.95 0.75 0.8 C0.5 0.62 0.25 0.3 0 0.12 Z";
const FLAME_MID = "M0 -0.08 C0.3 -0.2 0.6 -0.42 0.85 -0.55 C0.98 -0.6 1.02 -0.3 1.02 0 C1.02 0.3 0.98 0.6 0.85 0.55 C0.6 0.42 0.3 0.2 0 0.08 Z";
const FLAME_CORE = "M0 -0.04 C0.3 -0.1 0.62 -0.2 0.9 -0.22 C0.98 -0.1 0.98 0.1 0.9 0.22 C0.62 0.2 0.3 0.1 0 0.04 Z";
const STREAK = "M-0.07 0 C-0.04 -0.05 0.04 -0.05 0.07 0 C0.04 0.05 -0.04 0.05 -0.07 0 Z";

function Streak({ clock, i, breath }) {
  const T = useDerivedValue(() => {
    const ph = (clock.value * 2.6 + i / 3) % 1;
    return [{ translateX: 0.1 + ph * 0.85 }, { translateY: Math.sin(i * 2.1 + clock.value * 5) * 0.3 * ph }, { scaleY: 1 + ph * 3 }];
  });
  const O = useDerivedValue(() => breath.value * 0.8);
  return (
    <Group transform={T} opacity={O}>
      <Path path={STREAK} color="rgba(255,255,255,0.9)" />
    </Group>
  );
}

function SteamPuff({ L, i, f, clock, color }) {
  const { k } = L;
  const T = useDerivedValue(() => {
    const ph = (clock.value / 2.4 + i * 0.25) % 1;
    const tx = L.hitX + (f.value.sweep - 0.5) * 70 * k + (i - 1.5) * 16 * k;
    return [{ translateX: tx + ph * 8 * k }, { translateY: L.wallTop - 4 * k - ph * 50 * k }, { scale: (8 + ph * 16) * k }];
  });
  const O = useDerivedValue(() => {
    const ph = (clock.value / 2.4 + i * 0.25) % 1;
    return f.value.heat * Math.sin(ph * Math.PI) * 0.55;
  });
  return (
    <Group transform={T} opacity={O}>
      <Circle cx={0} cy={0} r={1}>
        <RadialGradient c={vec(0, 0)} r={1} colors={[rgba(color, 0.95), rgba(color, 0)]} />
      </Circle>
    </Group>
  );
}

function DustPuff({ L, i, f, color }) {
  const { k } = L;
  const sx = L.bx0 + (L.bx1 - L.bx0) * (0.1 + 0.8 * hash01(i, 3.3));
  const T = useDerivedValue(() => {
    const d = f.value.dust;
    return [{ translateX: sx + (hash01(i, 1.7) - 0.5) * 40 * k * d }, { translateY: L.ground - 20 * k - d * (40 + 60 * hash01(i, 2.9)) * k }, { scale: (20 + 40 * d + 16 * hash01(i, 5.5)) * k }];
  });
  const O = useDerivedValue(() => f.value.dust * 0.38);
  return (
    <Group transform={T} opacity={O}>
      <Circle cx={0} cy={0} r={1}>
        <RadialGradient c={vec(0, 0)} r={1} colors={[rgba(color, 0.9), rgba(color, 0.4), rgba(color, 0)]} positions={[0, 0.5, 1]} />
      </Circle>
    </Group>
  );
}

// ── Sahne ─────────────────────────────────────────────────────────────────────
export default function GotScene({ p, clock, width, height, tone }) {
  const L = useMemo(() => gotLayout(width, height), [width, height]);
  const c = useMemo(() => toneMap(tone.colors), [tone.colors]);
  const { k } = L;
  const geo = useMemo(() => {
    const prof = wallProfile(L);
    const left = wallPiece(prof, -1, BREACH_A, L);
    const right = wallPiece(prof, BREACH_B, WALL_N + 1, L);
    const cols = [];
    for (let s = BREACH_A; s < BREACH_B; s += BREACH_COL) cols.push(wallPiece(prof, s, Math.min(BREACH_B, s + BREACH_COL), L));
    // gedikte kalan moloz yığını
    const rubble = Skia.Path.Make();
    rubble.moveTo(L.bx0 - 6 * k, L.ground + 6 * k);
    for (let x = L.bx0 - 6 * k; x <= L.bx1 + 6 * k; x += 7 * k) {
      const u = (x - L.bx0) / (L.bx1 - L.bx0);
      rubble.lineTo(x, L.ground - (10 + 34 * Math.sin(Math.max(0, Math.min(1, u)) * Math.PI) + hash01(Math.round(x), 5.1) * 14) * k);
    }
    rubble.lineTo(L.bx1 + 6 * k, L.ground + 6 * k);
    rubble.close();
    const rubbleHi = Skia.Path.Make();
    for (let i = 0; i < 16; i += 1) {
      const x = L.bx0 + (L.bx1 - L.bx0) * hash01(i, 8.1);
      const y = L.ground - (4 + hash01(i, 2.6) * 26) * k;
      const w = (3 + hash01(i, 3.4) * 6) * k;
      rubbleHi.moveTo(x - w, y + w * 0.4);
      rubbleHi.lineTo(x - w * 0.2, y - w * 0.6);
      rubbleHi.lineTo(x + w, y);
      rubbleHi.close();
    }
    // kuzey: ufuk dağları + ova (yalnız gedikten görünür)
    const north = Skia.Path.Make();
    north.moveTo(L.bx0 - 20 * k, L.ground + 4 * k);
    for (let x = L.bx0 - 20 * k; x <= L.bx1 + 20 * k; x += 8 * k) {
      north.lineTo(x, L.wallTop + 64 * k - 18 * k * Math.abs(Math.sin(x / (31 * k))) - 10 * k * hash01(Math.round(x), 1.2));
    }
    north.lineTo(L.bx1 + 20 * k, L.ground + 4 * k);
    north.close();
    // duvarda parıldayan kristaller (4 uçlu yıldız)
    const stars = [Skia.Path.Make(), Skia.Path.Make()];
    for (let i = 0; i < 10; i += 1) {
      let x = width * hash01(i, 6.6);
      if (x > L.bx0 - 6 * k && x < L.bx1 + 6 * k) x = (x * 0.4) % (L.bx0 - 10 * k);
      const y = L.wallTop + (14 + hash01(i, 3.7) * (L.ground - L.wallTop - 60 * k) / k) * k;
      const r = (2.5 + hash01(i, 9.2) * 2.5) * k;
      const sp = stars[i % 2];
      sp.moveTo(x, y - r);
      sp.lineTo(x + r * 0.22, y - r * 0.22);
      sp.lineTo(x + r, y);
      sp.lineTo(x + r * 0.22, y + r * 0.22);
      sp.lineTo(x, y + r);
      sp.lineTo(x - r * 0.22, y + r * 0.22);
      sp.lineTo(x - r, y);
      sp.lineTo(x - r * 0.22, y - r * 0.22);
      sp.close();
    }
    // ön zemin: karlı avlu
    const snow = Skia.Path.Make();
    snow.moveTo(-4, height + 4);
    for (let x = -4; x <= width + 8; x += 8) snow.lineTo(x, L.ground + 2 * k + 3 * k * Math.sin(x / (37 * k) + 0.6) + 1.6 * k * Math.sin(x / (11 * k)));
    snow.lineTo(width + 8, height + 4);
    snow.close();
    const trail = Skia.Path.Make();
    trail.moveTo(width * 0.27, L.ground + 6 * k);
    trail.cubicTo(width * 0.3, L.ground + 26 * k, width * 0.2, L.ground + 44 * k, width * 0.24, height);
    trail.lineTo(width * 0.34, height);
    trail.cubicTo(width * 0.3, L.ground + 44 * k, width * 0.34, L.ground + 26 * k, width * 0.31, L.ground + 6 * k);
    trail.close();
    // kuzey ışıkları (iki şerit)
    const aurora = [0, 1].map((j) => {
      const a = Skia.Path.Make();
      const yb = L.wallTop - (150 + j * 60) * k;
      a.moveTo(-40 * k, yb);
      for (let x = -40 * k; x <= width + 40 * k; x += 10 * k) a.lineTo(x, yb + Math.sin(x / (60 * k) + j * 2) * 22 * k);
      for (let x = width + 40 * k; x >= -40 * k; x -= 10 * k) a.lineTo(x, yb - 46 * k + Math.sin(x / (60 * k) + j * 2 + 0.4) * 26 * k);
      a.close();
      return { path: a, yb };
    });
    const colClip = Skia.XYWHRect(-10, -10, width + 20, L.ground + 10 * k);
    return { colClip, left, right, cols, rubble, rubbleHi, north, stars, snow, trail, aurora };
  }, [L, width, height, k]);
  const works = useMemo(() => buildWorks(L), [L]);
  const castle = useMemo(() => buildCastle(width, L), [width, L]);
  const debris = useMemo(() => buildDebris(L), [L]);
  const ranks = useMemo(() => [0, 1, 2].map((r) => buildRank(L, r)), [L]);

  const f = useDerivedValue(() => gotFrame(p, clock.value));
  const heat = useDerivedValue(() => f.value.heat * f.value.fl);
  const rubbleO = useDerivedValue(() => f.value.rubble);
  const debrisO = useDerivedValue(() => (f.value.fall > 0.02 && f.value.fall < 0.98 ? 1 - f.value.fall * f.value.fall : 0) * f.value.vis);
  const northO = useDerivedValue(() => (f.value.fall > 0.01 ? 1 : 0));
  const shakeT = useDerivedValue(() => [{ translateX: f.value.shake * Math.sin(clock.value * 47) * 3 * k }, { translateY: f.value.shake * Math.cos(clock.value * 39) * 2 * k }]);
  const starA = useDerivedValue(() => 0.25 + 0.75 * Math.max(0, Math.sin(clock.value * 1.3)));
  const starB = useDerivedValue(() => 0.25 + 0.75 * Math.max(0, Math.sin(clock.value * 1.3 + 2.4)));
  const winO = useDerivedValue(() => 0.75 + 0.15 * Math.sin(clock.value * 2.3) + 0.1 * Math.sin(clock.value * 5.1));
  const auroraT = useDerivedValue(() => [{ translateX: Math.sin(clock.value * 0.07) * 26 * k }]);
  const auroraO = useDerivedValue(() => 0.32 + 0.14 * Math.sin(clock.value * 0.21));

  // ejderha
  const pose = useDerivedValue(() => {
    const fr = f.value;
    const t = clock.value;
    const dp = dragonPose(L, width, fr, t);
    const ph = t * 6.2832 * 0.9;
    const m = mouthOf(dp, fr);
    return {
      ...dp,
      wa: 0.18 * Math.sin(ph),
      ws: 0.25 + 0.75 * Math.cos(ph),
      wsf: 0.25 + 0.75 * Math.cos(ph - 0.35),
      tail: Math.sin(t * 1.4) * 0.09,
      head: m.hr,
      jaw: 0.08 * fr.inhale + 0.38 * fr.breath,
      glow: Math.max(fr.inhale, fr.breath),
      mx: m.x,
      my: m.y,
    };
  });
  const dragonT = useDerivedValue(() => [{ translateX: pose.value.x }, { translateY: pose.value.y }, { rotate: pose.value.rot }, { scale: pose.value.sc }]);
  const dragonO = useDerivedValue(() => f.value.dvis);
  const breath = useDerivedValue(() => f.value.breath);
  const flameT = useDerivedValue(() => {
    const tx = L.hitX + (f.value.sweep - 0.5) * 70 * k;
    const ty = L.wallTop + 2 * k;
    const dx = tx - pose.value.mx;
    const dy = ty - pose.value.my;
    const len = Math.sqrt(dx * dx + dy * dy) * f.value.reach;
    const flick = 1 + 0.07 * Math.sin(clock.value * 23) + 0.05 * Math.sin(clock.value * 37);
    return [
      { translateX: pose.value.mx }, { translateY: pose.value.my }, { rotate: Math.atan2(dy, dx) },
      { scaleX: Math.max(0.001, len) }, { scaleY: (10 * k + len * 0.13) * flick },
    ];
  });
  const flameO = useDerivedValue(() => (f.value.breath > 0.01 ? Math.min(1, f.value.breath * 1.6) : 0));
  const impactT = useDerivedValue(() => [{ translateX: L.hitX + (f.value.sweep - 0.5) * 70 * k }, { translateY: L.wallTop + 2 * k }]);
  const impactO = useDerivedValue(() => (f.value.breath > 0.75 ? (f.value.breath - 0.75) * 4 : 0) * f.value.fl);
  const wallGlowO = useDerivedValue(() => f.value.heat * f.value.fl * 0.8);

  const piece = (pc, key) => <WallPiece key={key} piece={pc} L={L} c={c} heat={heat} />;
  return (
    <Group transform={shakeT}>
      {/* kuzey ışıkları */}
      <Group transform={auroraT} opacity={auroraO}>
        {geo.aurora.map((a, j) => (
          <Path key={j} path={a.path}>
            <LinearGradient start={vec(0, a.yb - 60 * k)} end={vec(0, a.yb + 20 * k)} colors={["rgba(111,255,208,0)", j ? "rgba(140,160,255,0.16)" : "rgba(111,255,208,0.2)", "rgba(111,255,208,0)"]} />
          </Path>
        ))}
      </Group>

      {/* ejderha (Duvar'ın kuzeyinde, önünden geçmez) */}
      <Group opacity={dragonO} transform={dragonT}>
        <DragonArt pose={pose} />
      </Group>

      <Group opacity={tone.alpha}>
        {/* gedikten görünen kuzey */}
        <Group opacity={northO}>
          <Path path={geo.north}>
            <LinearGradient start={vec(0, L.wallTop + 40 * k)} end={vec(0, L.ground)} colors={[c.plain, c.night]} />
          </Path>
        </Group>
        {piece(geo.left, "l")}
        {piece(geo.right, "r")}
        <Group opacity={rubbleO}>
          <Path path={geo.rubble}>
            <LinearGradient start={vec(0, L.ground - 50 * k)} end={vec(0, L.ground)} colors={[c.ice, c.deep]} />
          </Path>
          <Path path={geo.rubbleHi} color={rgba(c.glint, 0.6)} />
        </Group>
        <Group clip={geo.colClip}>
          {geo.cols.map((col, i) => (
            <WallColumn key={`c${i}`} piece={col} order={Math.abs(i - 3)} f={f} L={L} c={c} heat={heat} />
          ))}
        </Group>
        <Group opacity={starA}>
          <Path path={geo.stars[0]} color={c.glint} />
        </Group>
        <Group opacity={starB}>
          <Path path={geo.stars[1]} color={c.glint} />
        </Group>
        {/* merdiven, asansör, yürüyüş yolu */}
        <Path path={works.beams} style="stroke" strokeWidth={2.2 * k} color={c.wood} />
        <Path path={works.steps} style="stroke" strokeWidth={0.9 * k} color={c.wood} />
        <Path path={works.rails} style="stroke" strokeWidth={0.8 * k} color={rgba(c.wood, 0.85)} />
        <Path path={works.posts} style="stroke" strokeWidth={0.9 * k} color={rgba(c.wood, 0.9)} />
        <Path path={works.landings} color={c.wood} />
        <Path path={works.ropes} style="stroke" strokeWidth={0.7 * k} color={rgba(c.wood, 0.8)} />
        <Path path={works.walk} style="stroke" strokeWidth={1 * k} color={c.wood} />
        <Path path={works.hut} color={c.wood} />
        <Path path={works.hutRoof} color={c.snow} />
        <LiftCage L={L} c={c} clock={clock} />
      </Group>
      <Sentry L={L} clock={clock} i={0} />
      <Sentry L={L} clock={clock} i={1} />

      {/* ateşin duvardaki ışığı */}
      <Group opacity={wallGlowO}>
        <Circle cx={L.hitX} cy={L.wallTop + 30 * k} r={150 * k}>
          <RadialGradient c={vec(L.hitX, L.wallTop + 30 * k)} r={150 * k} colors={[rgba(c.blue, 0.7), rgba(c.blue, 0.22), rgba(c.blue, 0)]} positions={[0, 0.4, 1]} />
        </Circle>
      </Group>

      {/* buz ateşi */}
      <Group opacity={flameO} transform={flameT}>
        <Path path={FLAME_OUT} color="rgba(47,140,255,0.55)" />
        <Path path={FLAME_MID} color="rgba(120,200,255,0.8)" />
        <Path path={FLAME_CORE} color="rgba(236,248,255,0.95)" />
        {[0, 1, 2].map((i) => (
          <Streak key={i} clock={clock} i={i} breath={breath} />
        ))}
      </Group>
      <Group opacity={impactO} transform={impactT}>
        <Circle cx={0} cy={0} r={46 * k}>
          <RadialGradient c={vec(0, 0)} r={46 * k} colors={["rgba(255,255,255,0.95)", "rgba(120,200,255,0.55)", "rgba(89,184,255,0)"]} positions={[0, 0.35, 1]} />
        </Circle>
        <Oval x={-50 * k} y={-6 * k} width={100 * k} height={12 * k} color="rgba(200,236,255,0.75)" />
      </Group>
      {[0, 1, 2, 3].map((i) => (
        <SteamPuff key={i} L={L} i={i} f={f} clock={clock} color={c.snow} />
      ))}

      {/* çöküş: buz kırıkları */}
      <Group opacity={debrisO}>
        {debris.map((d, i) => (
          <Debris key={i} d={d} f={f} k={k} c={c} />
        ))}
      </Group>

      {/* ölüler ordusu */}
      {[0, 1, 2].map((r) => (
        <Rank key={r} L={L} r={r} f={f} clock={clock} geo={ranks[r]} c={c} />
      ))}

      {/* Kara Kale */}
      <Group opacity={tone.alpha}>
        {castle.chimneys.flatMap((ch, j) => [0, 1, 2, 3].map((i) => (
          <Smoke key={`${j}-${i}`} x={ch.x} y={ch.y} k={k} i={i + j * 0.5} clock={clock} color={c.ice} />
        )))}
        <Path path={castle.lit}>
          <LinearGradient start={vec(0, L.ground - 70 * k)} end={vec(0, L.ground)} colors={[c.stone, c.stoneDark]} />
        </Path>
        <Path path={castle.shade} color={c.stoneDark} />
        <Path path={castle.courses} style="stroke" strokeWidth={0.6 * k} color="rgba(0,0,0,0.18)" />
        <Path path={castle.roofs} color={c.roof} />
        <Path path={castle.snowRoof} color={c.snow} />
        <Path path={castle.doors} color={c.wood} />
        <Group opacity={winO}>
          <Path path={castle.windows} color={c.window} />
        </Group>
        <Path path={geo.snow}>
          <LinearGradient start={vec(0, L.ground)} end={vec(0, height)} colors={[c.snow, c.deep]} />
        </Path>
        <Path path={geo.trail} color={rgba(c.deep, 0.18)} />
        <Path path={castle.fence} color={c.wood} />
        <Group opacity={winO}>
          {castle.torches.map((tc, i) => (
            <Circle key={i} cx={tc.x} cy={tc.y} r={9 * k}>
              <RadialGradient c={vec(tc.x, tc.y)} r={9 * k} colors={["rgba(255,210,120,0.9)", "rgba(255,140,40,0)"]} />
            </Circle>
          ))}
        </Group>
      </Group>

      {/* yıkılış tozu (en önde) */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <DustPuff key={i} L={L} i={i} f={f} color={c.snow} />
      ))}
    </Group>
  );
}
