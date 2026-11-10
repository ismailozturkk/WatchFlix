// components/decor/universeOverlays.js
//
// Evren sahnelerinin vektör katmanları (KIND.overlay, OVERLAY 17–30): büyük
// silüetler (buz duvarı, kum tepeleri, Gotham, gökdelenler, Mordor, çöl
// masaları, hapishane, Londra, havuz, titan duvarı), sahne ışıkları (süpüren
// göz, kule projektörü, şehir projektörleri), kendini çizen çember / plan ve
// ipler (ağ, ODM halatı, saat zinciri).
//
// Yollar boyut değişince BİR KEZ kurulur (useMemo); kare başına yalnız Group
// dönüşümü / opaklık / yol kırpma (end) değişir. Yükseklikler kıyı katmanıyla
// aynı ölçekte (sceneScale): sahne parçacıkları (gemi, ördek, pelerinli silüet,
// titan) bu silüetlere dp ile oturur — ortak sabitler utils/weatherUniverses SCENERY.
//
// Işığa duyarlılık: hiçbir katman çakmaz. Göz ve projektörler yavaş nefes alır,
// simya şimşekleri küçük alanlı ve saniyede ≤ 2,5 (sparkSlot).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { BlurMask, Circle, Group, LinearGradient, Oval, Path, RadialGradient, Rect, Skia, vec } from "@shopify/react-native-skia";
import { drawCycle, hash01, overlayFrame, sceneScale, sparkSlot, tetherFrame, wallFrame, riverFrame, swFrame, duneFrame, rmFrame, restU } from "../../utils/weatherParticles";
import { SCENERY } from "../../utils/weatherUniverses";
import { seededRandom } from "../../utils/decorLayout";

function rgba(hex, a) {
  const h = String(hex).replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Alt kenara kapanan silüet: [[x, y], ...] (px) → yol.
function silhouette(points, bottom) {
  const p = Skia.Path.Make();
  if (!points.length) return p;
  p.moveTo(points[0][0], bottom);
  for (const [x, y] of points) p.lineTo(x, y);
  p.lineTo(points[points.length - 1][0], bottom);
  p.close();
  return p;
}

// Işık hüzmesi: tepe (0,0), +y yönünde L boyunda, yarım açı ha.
function beamPath(L, ha, w0 = 3) {
  const p = Skia.Path.Make();
  const s = Math.tan(ha) * L;
  p.moveTo(-w0, 0);
  p.lineTo(w0, 0);
  p.lineTo(s, L);
  p.lineTo(-s, L);
  p.close();
  return p;
}

function Beam({ L, ha, color, alpha = 1, tail = 0 }) {
  const path = useMemo(() => beamPath(L, ha), [L, ha]);
  return (
    <Path path={path} opacity={alpha}>
      <LinearGradient start={vec(0, 0)} end={vec(0, L)} colors={[rgba(color, 0.95), rgba(color, 0.35), rgba(color, tail)]} positions={[0, 0.45, 1]} />
    </Path>
  );
}

function Glow({ cx = 0, cy = 0, r, color, mid = 0.45 }) {
  return (
    <Circle cx={cx} cy={cy} r={r}>
      <RadialGradient c={vec(cx, cy)} r={r} colors={[rgba(color, 1), rgba(color, mid), rgba(color, 0)]} positions={[0, 0.4, 1]} />
    </Circle>
  );
}

const useFrame = (p, clock, width, height) => useDerivedValue(() => overlayFrame(p, clock.value, width, height));

// ── 17 · Game of Thrones: buz duvarı (ejderha ateşiyle yıkılır) + Kara Kale ──
// Duvar 40 dilimlik bir profilden kurulur: kenar parçaları sabit, ortadaki
// "gedik" (dilim 22–36) 7 sütundur. Ateş vurunca (heat) çatlaklar mavi parlar,
// sütunlar sırayla çöker (fall), moloz birikir (rubble), toz kalkar (dust);
// ejderha turu bitince duvar yeniden belirir. Tümü yumuşak geçiş, çakma yok.
const WALL_N = 40;
const BREACH_A = 22;
const BREACH_B = 36;
const BREACH_COL = 2; // sütun başına dilim

function wallProfile(width, top, k) {
  const step = width / WALL_N;
  const ys = [];
  for (let s = -1; s <= WALL_N + 1; s += 1) {
    let y = top + (hash01(s, 1.3) - 0.5) * 9 * k;
    if (hash01(s, 4.7) > 0.82) y -= (8 + hash01(s, 9.1) * 12) * k; // sivri buz kütleleri
    ys.push(y);
  }
  return { step, y: (s) => ys[s + 1], x: (s) => s * step };
}

// [s0, s1] dilim aralığı için duvar parçası: gövde, yüzey (açık/koyu), tabaka, çatlak, kar, tepe parıltısı.
function wallPiece(prof, s0, s1, top, height, k) {
  const body = Skia.Path.Make();
  body.moveTo(prof.x(s0), height + 4);
  for (let s = s0; s <= s1; s += 1) body.lineTo(prof.x(s), prof.y(s));
  body.lineTo(prof.x(s1), height + 4);
  body.close();
  const lit = Skia.Path.Make();
  const dark = Skia.Path.Make();
  const cracks = Skia.Path.Make();
  const strata = Skia.Path.Make();
  const cap = Skia.Path.Make();
  const rim = Skia.Path.Make();
  const H = height - top;
  for (let s = s0; s < s1; s += 1) {
    const x0 = prof.x(s);
    const x1 = prof.x(s + 1);
    const y0 = prof.y(s);
    const y1 = prof.y(s + 1);
    const lean = (hash01(s, 2.2) - 0.5) * 18 * k;
    const bottomY = top + H * (0.45 + hash01(s, 3.3) * 0.5);
    // ışık gören yüz
    lit.moveTo(x0, y0);
    lit.lineTo(x1, y1);
    lit.lineTo(x1 + lean * 0.6, bottomY);
    lit.lineTo(x0 + lean, bottomY + 14 * k);
    lit.close();
    // gölge yüz (sağ yarısı)
    if (hash01(s, 6.6) > 0.4) {
      dark.moveTo((x0 + x1) / 2, (y0 + y1) / 2);
      dark.lineTo(x1, y1);
      dark.lineTo(x1 + lean * 0.8, bottomY + 24 * k);
      dark.lineTo((x0 + x1) / 2 + lean * 0.4, bottomY);
      dark.close();
    }
    // kar kasketi
    cap.moveTo(x0, y0);
    cap.lineTo(x1, y1);
    cap.lineTo(x1, y1 + (3 + hash01(s, 8.8) * 6) * k);
    cap.lineTo((x0 + x1) / 2, y0 + (5 + hash01(s, 5.5) * 8) * k);
    cap.lineTo(x0, y0 + 4 * k);
    cap.close();
    rim.moveTo(x0, y0);
    rim.lineTo(x1, y1);
    // çatlak
    if (hash01(s, 7.7) > 0.45) {
      let cx = x0 + (x1 - x0) * hash01(s, 1.9);
      let cy = y0 + 10 * k;
      cracks.moveTo(cx, cy);
      for (let j = 0; j < 5 && cy < height; j += 1) {
        cy += (12 + hash01(s * 7 + j, 3.1) * 20) * k;
        cx += (hash01(s * 5 + j, 2.7) - 0.5) * 14 * k;
        cracks.lineTo(cx, cy);
      }
    }
  }
  for (let j = 1; j < 6; j += 1) {
    const y = top + (H * j) / 6.4;
    strata.moveTo(prof.x(s0), y);
    for (let s = s0; s <= s1; s += 1) strata.lineTo(prof.x(s), y + Math.sin(s * 0.9 + j * 1.7) * 2.4 * k);
  }
  return { body, lit, dark, cracks, strata, cap, rim, x0: prof.x(s0), x1: prof.x(s1) };
}

function WallPiece({ piece, top, height, k, ice, deep, glint, blue, heat }) {
  return (
    <>
      <Path path={piece.body}>
        <LinearGradient start={vec(0, top - 20 * k)} end={vec(0, height)} colors={[rgba(ice, 1), rgba(ice, 0.85), rgba(deep, 1)]} positions={[0, 0.35, 1]} />
      </Path>
      <Path path={piece.lit} color={rgba(glint, 0.22)} />
      <Path path={piece.dark} color={rgba(deep, 0.5)} />
      <Path path={piece.strata} style="stroke" strokeWidth={1} color={rgba(glint, 0.3)} />
      <Path path={piece.cracks} style="stroke" strokeWidth={1.2} strokeJoin="round" color={rgba(deep, 0.95)} />
      <Group opacity={heat}>
        <Path path={piece.cracks} style="stroke" strokeWidth={4.5 * k} strokeJoin="round" color={rgba(blue, 0.35)} />
        <Path path={piece.cracks} style="stroke" strokeWidth={1.6} strokeJoin="round" color={rgba("#ffffff", 0.95)} />
      </Group>
      <Path path={piece.cap} color={rgba("#ffffff", 0.78)} />
      <Path path={piece.rim} style="stroke" strokeWidth={2 * k} strokeJoin="round" color={rgba(glint, 0.9)} />
    </>
  );
}

// Çöken sütun: gecikmeli hızlanan düşüş + hafif devrilme; ateş bölgesine yakın olan önce çöker.
function WallColumn({ piece, order, f, top, height, k, ice, deep, glint, blue, heat }) {
  const H = height - top;
  const cx = (piece.x0 + piece.x1) / 2;
  const pivotY = top + 24 * k;
  const lean = (order % 2 ? 1 : -1) * (0.05 + 0.05 * hash01(order, 2));
  const transform = useDerivedValue(() => {
    const v = (f.value.fall - order * 0.07) / 0.5;
    const c = v < 0 ? 0 : v > 1 ? 1 : v;
    const e = c * c;
    return [
      { translateX: cx + lean * e * 60 * k },
      { translateY: pivotY + e * (H + 60 * k) },
      { rotate: lean * e },
      { translateX: -cx },
      { translateY: -pivotY },
    ];
  });
  const opacity = useDerivedValue(() => f.value.vis);
  return (
    <Group transform={transform} opacity={opacity}>
      <WallPiece piece={piece} top={top} height={height} k={k} ice={ice} deep={deep} glint={glint} blue={blue} heat={heat} />
    </Group>
  );
}

// Savrulan buz kırığı: yaydan uçar, düşerken solar.
function WallDebris({ d, f, k, color }) {
  const { x, y, vx, vy, rot, t } = d;
  const transform = useDerivedValue(() => {
    const q = f.value.fall * t;
    return [
      { translateX: x + vx * q * k },
      { translateY: y + (vy * q + 260 * q * q) * k },
      { rotate: rot * q * 3 },
    ];
  });
  const opacity = useDerivedValue(() => (f.value.fall > 0.02 && f.value.fall < 0.98 ? 0.95 * (1 - f.value.fall * f.value.fall) : 0) * f.value.vis);
  return (
    <Group transform={transform}>
      <Path path={d.path} color={rgba(color, 0.95)} opacity={opacity} />
    </Group>
  );
}

function IceWall({ p, clock, width, height, tone }) {
  const k = sceneScale(width, height);
  const geo = useMemo(() => {
    const top = height - SCENERY.wallTop * k;
    const prof = wallProfile(width, top, k);
    const left = wallPiece(prof, -1, BREACH_A, top, height, k);
    const right = wallPiece(prof, BREACH_B, WALL_N + 1, top, height, k);
    const cols = [];
    for (let s = BREACH_A; s < BREACH_B; s += BREACH_COL) cols.push(wallPiece(prof, s, Math.min(BREACH_B, s + BREACH_COL), top, height, k));
    // çöken gedikte kalan moloz yığını
    const rubble = Skia.Path.Make();
    const rx0 = prof.x(BREACH_A);
    const rx1 = prof.x(BREACH_B);
    rubble.moveTo(rx0, height + 2);
    for (let x = rx0; x <= rx1; x += 9 * k) {
      const u = (x - rx0) / (rx1 - rx0);
      rubble.lineTo(x, height - (14 + 26 * Math.sin(u * Math.PI) + hash01(Math.round(x), 5.1) * 16) * k);
    }
    rubble.lineTo(rx1, height + 2);
    rubble.close();
    // savrulan kırıklar
    const debris = [];
    for (let i = 0; i < 14; i += 1) {
      const path = Skia.Path.Make();
      const w = (3 + hash01(i, 1.1) * 7) * k;
      path.moveTo(-w, 0);
      path.lineTo(w * 0.4, -w * 0.8);
      path.lineTo(w, w * 0.3);
      path.lineTo(-w * 0.2, w);
      path.close();
      debris.push({
        path,
        x: rx0 + (rx1 - rx0) * hash01(i, 2.3),
        y: top + (10 + hash01(i, 3.9) * 70) * k,
        vx: (hash01(i, 6.2) - 0.35) * 120,
        vy: -(50 + hash01(i, 8.4) * 120),
        rot: (hash01(i, 9.7) - 0.5) * 2,
        t: 0.7 + hash01(i, 4.4) * 0.5,
      });
    }
    // Kara Kale: duvarın dibinde ahşap kuleler
    const keep = Skia.Path.Make();
    [[0.06, 64], [0.14, 46], [0.22, 78], [0.31, 40]].forEach(([fx, h]) => {
      const x = width * fx;
      const w = 22 * k;
      const y = height - h * k;
      keep.addRect(Skia.XYWHRect(x, y, w, h * k + 2));
      for (let b = 0; b < 3; b += 1) keep.addRect(Skia.XYWHRect(x + b * (w / 2.6), y - 5 * k, w / 5, 5 * k));
    });
    return { top, left, right, cols, rubble, debris, keep, hitX: width * 0.72 };
  }, [width, height, k]);
  const f = useDerivedValue(() => wallFrame(p, clock.value));
  const heat = useDerivedValue(() => f.value.heat * f.value.fl);
  const rubbleOpacity = useDerivedValue(() => f.value.rubble);
  const glowOpacity = useDerivedValue(() => f.value.heat * f.value.fl * 0.9);
  const dustOpacity = useDerivedValue(() => f.value.dust * 0.55);
  const dustLift = useDerivedValue(() => [{ translateY: -f.value.dust * 40 * k }]);
  const [ice, deep, glint, wood, blue] = tone.colors;
  const piece = (pc, key) => (
    <WallPiece key={key} piece={pc} top={geo.top} height={height} k={k} ice={ice} deep={deep} glint={glint} blue={blue} heat={heat} />
  );
  return (
    <>
      <Group opacity={tone.alpha}>
        {piece(geo.left, "l")}
        {piece(geo.right, "r")}
        <Group opacity={rubbleOpacity}>
          <Path path={geo.rubble}>
            <LinearGradient start={vec(0, height - 50 * k)} end={vec(0, height)} colors={[rgba(ice, 1), rgba(deep, 1)]} />
          </Path>
        </Group>
        {geo.cols.map((c, i) => (
          <WallColumn
            key={`c${i}`} piece={c} order={Math.abs(i - 3)} f={f} top={geo.top} height={height} k={k}
            ice={ice} deep={deep} glint={glint} blue={blue} heat={heat}
          />
        ))}
        {geo.debris.map((d, i) => (
          <WallDebris key={`d${i}`} d={d} f={f} k={k} color={glint} />
        ))}
        <Path path={geo.keep} color={rgba(wood, 1)} />
      </Group>
      {/* ateşin ışığı: duvar yüzünde mavi parlama (yumuşak, çakmaz) */}
      <Group opacity={glowOpacity}>
        <Glow cx={geo.hitX} cy={geo.top + 30 * k} r={150 * k} color={blue} mid={0.3} />
        <Glow cx={geo.hitX} cy={geo.top + 40 * k} r={60 * k} color="#ffffff" mid={0.25} />
      </Group>
      {/* çöküşte kalkan buz tozu */}
      <Group opacity={dustOpacity} transform={dustLift}>
        <Glow cx={geo.hitX - 40 * k} cy={height - 50 * k} r={90 * k} color={glint} mid={0.35} />
        <Glow cx={geo.hitX + 30 * k} cy={height - 70 * k} r={110 * k} color={ice} mid={0.3} />
      </Group>
    </>
  );
}

// ── 18 · Dune: kum tepeleri, iki ay, baharat toplayıcılar, çöl solucanı + titreşim ──
// Solucan VEKTÖR: kum çizgisinin altından yay çizerek çıkar (halkalı gövde, dişli ağız),
// geri dalar. Gelmeden önce zemin hafifçe titrer (shake). Dalış/çıkışta kum parçacıkları
// duneScene'den gelir (aynı 40 sn saati, faz 0).
const DUNE_SEG = 26;
const DUNE_STEP = 0.016;

// Baharat toplayıcı: palet gövdesi, kabin, ön kepçe, bacalar, üstte yavaş yanıp sönen ışık.
function Harvester({ x, y, s, body, metal, glow, f }) {
  const geo = useMemo(() => {
    const hull = Skia.Path.Make();
    hull.moveTo(-34, 0);
    hull.lineTo(-30, -16);
    hull.lineTo(22, -16);
    hull.lineTo(36, -6);
    hull.lineTo(36, 0);
    hull.close();
    const cab = Skia.Path.Make();
    cab.moveTo(8, -16);
    cab.lineTo(12, -28);
    cab.lineTo(28, -28);
    cab.lineTo(34, -10);
    cab.lineTo(30, -6);
    cab.close();
    const hopper = Skia.Path.Make();
    hopper.moveTo(-28, -16);
    hopper.lineTo(-24, -30);
    hopper.lineTo(0, -30);
    hopper.lineTo(4, -16);
    hopper.close();
    const scoop = Skia.Path.Make();
    scoop.moveTo(34, -4);
    scoop.lineTo(48, 4);
    scoop.lineTo(36, 4);
    scoop.close();
    const stacks = Skia.Path.Make();
    stacks.addRect(Skia.XYWHRect(-18, -42, 4, 14));
    stacks.addRect(Skia.XYWHRect(-10, -38, 3, 10));
    const treads = Skia.Path.Make();
    treads.addRRect(Skia.RRectXY(Skia.XYWHRect(-36, -2, 62, 11), 5.5, 5.5));
    const wheels = Skia.Path.Make();
    [-28, -16, -4, 8, 20].forEach((cx) => wheels.addCircle(cx, 3.5, 3.4));
    return { hull, cab, hopper, scoop, stacks, treads, wheels };
  }, []);
  const rumble = useDerivedValue(() => [
    { translateX: x },
    { translateY: y + Math.sin(f.value.u * 900) * 0.5 },
    { scale: s },
  ]);
  const beacon = useDerivedValue(() => 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(f.value.u * 210)));
  return (
    <Group transform={rumble}>
      <Path path={geo.hopper} color={rgba(body, 0.92)} />
      <Path path={geo.stacks} color={rgba(metal, 1)} />
      <Path path={geo.hull} color={rgba(body, 1)} />
      <Path path={geo.cab} color={rgba(metal, 1)} />
      <Path path="M14 -24 L26 -24 L30 -12 L12 -12 Z" color="rgba(255,226,150,0.55)" />
      <Path path={geo.scoop} color={rgba(metal, 1)} />
      <Path path={geo.treads} color="rgba(24,22,20,0.95)" />
      <Path path={geo.wheels} color={rgba(metal, 0.9)} />
      <Path path="M-30 -10 L20 -10" style="stroke" strokeWidth={1} color="rgba(0,0,0,0.35)" />
      <Group opacity={beacon}>
        <Circle cx={-12} cy={-44} r={2} color={rgba(glow, 1)} />
        <Circle cx={-12} cy={-44} r={6} color={rgba(glow, 0.3)} />
      </Group>
    </Group>
  );
}

function SandWorm({ f, geo, sand, shade, mouthC, tooth }) {
  const { xa, xb, ySurf, Hh, Rh, k } = geo;
  const at = (t) => {
    "worklet";
    return { x: xa + (xb - xa) * t, y: ySurf - Hh * 4 * t * (1 - t) };
  };
  const body = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const h = f.value.head;
    if (h < -0.04 || h - (DUNE_SEG - 1) * DUNE_STEP > 1.04) return q;
    for (let i = DUNE_SEG - 1; i >= 0; i -= 1) {
      const t = h - i * DUNE_STEP;
      if (t < -0.04 || t > 1.04) continue;
      const c = at(t);
      q.addCircle(c.x, c.y, Rh * (1 - i * 0.012));
    }
    return q;
  });
  const rings = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const h = f.value.head;
    if (h < -0.04 || h - (DUNE_SEG - 1) * DUNE_STEP > 1.04) return q;
    for (let i = DUNE_SEG - 1; i >= 1; i -= 1) {
      const t = h - i * DUNE_STEP;
      if (t < -0.04 || t > 1.04) continue;
      const c = at(t);
      const c2 = at(t + 0.004);
      const ang = Math.atan2(c2.y - c.y, c2.x - c.x) + 1.5708;
      const r = Rh * (1 - i * 0.012);
      q.moveTo(c.x + Math.cos(ang) * r, c.y + Math.sin(ang) * r);
      q.lineTo(c.x - Math.cos(ang) * r, c.y - Math.sin(ang) * r);
    }
    return q;
  });
  const headT = useDerivedValue(() => {
    const h = f.value.head;
    const c = at(h);
    const c2 = at(h + 0.004);
    const ang = Math.atan2(c2.y - c.y, c2.x - c.x);
    return [{ translateX: c.x }, { translateY: c.y }, { rotate: ang }];
  });
  const headO = useDerivedValue(() => (f.value.head > -0.04 && f.value.head < 1.04 ? 1 : 0));
  const mouth = useMemo(() => {
    const m = Skia.Path.Make();
    m.addOval(Skia.XYWHRect(Rh * 0.3, -Rh * 0.98, Rh * 0.7, Rh * 1.96));
    const teeth = Skia.Path.Make();
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * 6.2832;
      const ex = Rh * 0.65 + Math.cos(a) * Rh * 0.35;
      const ey = Math.sin(a) * Rh * 0.98;
      const ix = Rh * 0.65 + Math.cos(a) * Rh * 0.12;
      const iy = Math.sin(a) * Rh * 0.42;
      const px = -Math.sin(a) * 0.1 * Rh;
      const py = Math.cos(a) * 0.14 * Rh;
      teeth.moveTo(ex + px, ey + py);
      teeth.lineTo(ix, iy);
      teeth.lineTo(ex - px, ey - py);
      teeth.close();
    }
    return { m, teeth };
  }, [Rh]);
  return (
    <Group clip={Skia.XYWHRect(-20, 0, 4000, ySurf + 4 * k)}>
      <Path path={body}>
        <LinearGradient start={vec(0, ySurf - Hh)} end={vec(0, ySurf)} colors={[rgba(sand, 1), rgba(shade, 1)]} />
      </Path>
      <Path path={rings} style="stroke" strokeWidth={1.2 * k} color={rgba(shade, 0.8)} />
      <Group opacity={headO} transform={headT}>
        <Circle cx={0} cy={0} r={Rh * 1.04} color={rgba(sand, 1)} />
        <Path path={mouth.m} color={rgba(mouthC, 1)} />
        <Path path={mouth.teeth} color={rgba(tooth, 0.95)} />
        <Path path={mouth.m} style="stroke" strokeWidth={1.4 * k} color={rgba(shade, 0.9)} />
      </Group>
    </Group>
  );
}

function Dunes({ p, clock, width, height, tone }) {
  const k = sceneScale(width, height);
  const f = useDerivedValue(() => duneFrame(p, clock.value));
  const layers = useMemo(() => {
    const dune = (base, amp, waves, ph) => {
      const pts = [];
      for (let x = -10; x <= width + 10; x += 8) {
        const u = x / width;
        const y = height - base * k - amp * k * (0.6 * Math.sin(u * Math.PI * waves + ph) + 0.4 * Math.sin(u * Math.PI * waves * 2.3 + ph * 2));
        pts.push([x, y]);
      }
      return silhouette(pts, height + 40);
    };
    return [dune(108, 22, 2.2, 0.4), dune(76, 18, 3.1, 1.7), dune(44, 14, 4.2, 2.6)];
  }, [width, height, k]);
  const wormGeo = useMemo(
    () => ({ xa: width * 0.18, xb: width * 0.82, ySurf: height - 64 * k, Hh: 150 * k, Rh: 19 * k, k }),
    [width, height, k],
  );
  const shake = useDerivedValue(() => {
    const a = f.value.shake * 1.3 * k;
    const t = clock.value;
    return [{ translateX: Math.sin(t * 43) * a * 0.55 }, { translateY: Math.sin(t * 61 + 1.3) * a }];
  });
  const [mid, near, far, moon, machine, lamp] = tone.colors;
  return (
    <>
      <Group opacity={tone.alpha * 1.4 > 1 ? 1 : tone.alpha * 1.4}>
        <Circle cx={width * 0.16} cy={height * 0.11} r={18 * k} color={rgba(moon, 0.55)} />
        <Circle cx={width * 0.16 - 5 * k} cy={height * 0.11 - 3 * k} r={4 * k} color={rgba(moon, 0.35)} />
        <Circle cx={width * 0.28} cy={height * 0.07} r={9 * k} color={rgba(moon, 0.5)} />
      </Group>
      <Group opacity={tone.alpha} transform={shake}>
        <Path path={layers[0]} color={rgba(far, 0.7)} />
        <Path path={layers[1]} color={rgba(mid, 0.9)} />
        <Harvester x={width * 0.09} y={height - 70 * k} s={0.8 * k} body={machine} metal={far} glow={lamp} f={f} />
        <Harvester x={width * 0.93} y={height - 82 * k} s={0.55 * k} body={machine} metal={far} glow={lamp} f={f} />
        <SandWorm f={f} geo={wormGeo} sand="#b98f63" shade="#6b4e34" mouthC="#3a1410" tooth="#efe3c8" />
        <Path path={layers[2]} color={rgba(near, 1)} />
      </Group>
    </>
  );
}

// Şehir silüeti yardımcısı: binalar soldan sağa, [genişlik oranı, yükseklik dp, çatı türü].
function buildingsPath(list, width, height, k, extra) {
  const p = Skia.Path.Make();
  let x = -4;
  for (const [fw, h, roof] of list) {
    const w = fw * width;
    const y = height - h * k;
    p.moveTo(x, height + 2);
    p.lineTo(x, y);
    if (roof === "spire") {
      p.lineTo(x + w * 0.35, y);
      p.lineTo(x + w * 0.5, y - 40 * k);
      p.lineTo(x + w * 0.65, y);
    } else if (roof === "gable") {
      p.lineTo(x + w * 0.5, y - 22 * k);
    } else if (roof === "step") {
      p.lineTo(x + w * 0.2, y);
      p.lineTo(x + w * 0.2, y - 24 * k);
      p.lineTo(x + w * 0.4, y - 24 * k);
      p.lineTo(x + w * 0.4, y - 48 * k);
      p.lineTo(x + w * 0.48, y - 48 * k);
      p.lineTo(x + w * 0.5, y - 90 * k);
      p.lineTo(x + w * 0.52, y - 48 * k);
      p.lineTo(x + w * 0.6, y - 48 * k);
      p.lineTo(x + w * 0.6, y - 24 * k);
      p.lineTo(x + w * 0.8, y - 24 * k);
      p.lineTo(x + w * 0.8, y);
    } else if (roof === "twin") {
      p.lineTo(x + w * 0.2, y);
      p.lineTo(x + w * 0.3, y - 30 * k);
      p.lineTo(x + w * 0.4, y);
      p.lineTo(x + w * 0.6, y);
      p.lineTo(x + w * 0.7, y - 30 * k);
      p.lineTo(x + w * 0.8, y);
    }
    p.lineTo(x + w, y);
    p.lineTo(x + w, height + 2);
    p.close();
    if (extra) extra(x, y, w);
    x += w;
  }
  return p;
}

function windowsPath(list, width, height, k, seed, density = 0.12) {
  const rand = seededRandom(seed);
  const p = Skia.Path.Make();
  let x = -4;
  for (const [fw, h] of list) {
    const w = fw * width;
    const top = height - h * k;
    for (let wy = top + 10 * k; wy < height - 8 * k; wy += 12 * k) {
      for (let wx = x + 5 * k; wx < x + w - 7 * k; wx += 9 * k) {
        if (rand() < density) p.addRect(Skia.XYWHRect(wx, wy, 3.4 * k, 5 * k));
      }
    }
    x += w;
  }
  return p;
}

// ── 19 · Batman: gotik şehir + heykelli kule ───────────────────────────────
const GOTHAM_BACK = [[0.12, 150, "spire"], [0.1, 190, "gable"], [0.14, 230, "spire"], [0.09, 170, "gable"], [0.13, 250, "spire"], [0.1, 160, "twin"], [0.16, 210, "spire"], [0.2, 180, "gable"]];
const GOTHAM_FRONT = [[0.14, 96, "gable"], [0.11, 130, "twin"], [0.16, 84, "gable"], [0.12, 120, "spire"], [0.2, 70, "flat"], [0.12, 110, "gable"], [0.2, 80, "flat"]];
function Gotham({ width, height, tone }) {
  const k = sceneScale(width, height);
  const geo = useMemo(() => {
    const back = buildingsPath(GOTHAM_BACK, width, height, k);
    const front = buildingsPath(GOTHAM_FRONT, width, height, k);
    // heykelli kule: çıkıntının üstü SCENERY.gargoyle.top (pelerinli silüet oraya oturur)
    const g = SCENERY.gargoyle;
    const gx = width * g.x;
    const tower = Skia.Path.Make();
    tower.addRect(Skia.XYWHRect(gx - 15 * k, height - (g.top - 12) * k, 30 * k, (g.top - 12) * k + 2));
    tower.addRect(Skia.XYWHRect(gx - 22 * k, height - g.top * k, 44 * k, 12 * k));
    // heykel: çömelmiş kanatlı yaratık (ledge'in sağ ucunda)
    const gy = height - g.top * k;
    tower.moveTo(gx + 12 * k, gy);
    tower.cubicTo(gx + 14 * k, gy - 12 * k, gx + 22 * k, gy - 16 * k, gx + 26 * k, gy - 10 * k);
    tower.lineTo(gx + 32 * k, gy - 18 * k);
    tower.lineTo(gx + 30 * k, gy - 6 * k);
    tower.lineTo(gx + 36 * k, gy - 2 * k);
    tower.lineTo(gx + 22 * k, gy);
    tower.close();
    const lit = windowsPath(GOTHAM_BACK, width, height, k, 19, 0.1);
    return { back, front, tower, lit };
  }, [width, height, k]);
  const [front, back, light] = tone.colors;
  return (
    <Group opacity={tone.alpha}>
      <Path path={geo.back} color={rgba(back, 0.85)} />
      <Path path={geo.lit} color={rgba(light, 0.45)} />
      <Path path={geo.front} color={rgba(front, 1)} />
      <Path path={geo.tower} color={rgba(front, 1)} />
    </Group>
  );
}

// ── 20 · Spider-Man: gökdelenler, su kuleleri, anten ışığı ──────────────────
const SKY_BACK = [[0.1, 200, "flat"], [0.12, 260, "flat"], [0.14, 320, "step"], [0.1, 230, "flat"], [0.12, 280, "flat"], [0.16, 210, "flat"], [0.12, 250, "flat"], [0.18, 190, "flat"]];
const SKY_FRONT = [[0.16, 120, "flat"], [0.12, 160, "flat"], [0.18, 110, "flat"], [0.14, 150, "flat"], [0.2, 100, "flat"], [0.24, 140, "flat"]];
function Skyline({ p, clock, width, height, tone }) {
  const k = sceneScale(width, height);
  const f = useFrame(p, clock, width, height);
  const blink = useDerivedValue(() => f.value.r);
  const geo = useMemo(() => {
    const tanks = Skia.Path.Make();
    const front = buildingsPath(SKY_FRONT, width, height, k, (x, y, w) => {
      if (w > 50 * k) {
        // su kulesi: bacaklı silindir + konik çatı
        const cx = x + w * 0.7;
        tanks.addRect(Skia.XYWHRect(cx - 7 * k, y - 22 * k, 14 * k, 14 * k));
        tanks.moveTo(cx - 8 * k, y - 22 * k);
        tanks.lineTo(cx, y - 30 * k);
        tanks.lineTo(cx + 8 * k, y - 22 * k);
        tanks.close();
        tanks.addRect(Skia.XYWHRect(cx - 6 * k, y - 8 * k, 1.6 * k, 8 * k));
        tanks.addRect(Skia.XYWHRect(cx + 4.4 * k, y - 8 * k, 1.6 * k, 8 * k));
      }
    });
    const back = buildingsPath(SKY_BACK, width, height, k);
    const grid = windowsPath(SKY_BACK, width, height, k, 20, 0.16);
    // en uzun binanın anteni (step çatı: x payı)
    let x = -4;
    let ant = null;
    for (const [fw, h, roof] of SKY_BACK) {
      if (roof === "step") ant = [x + fw * width * 0.5, height - h * k - 90 * k];
      x += fw * width;
    }
    return { front, back, tanks, grid, ant };
  }, [width, height, k]);
  const [front, back, red, win] = tone.colors;
  return (
    <>
      <Group opacity={tone.alpha}>
        <Path path={geo.back} color={rgba(back, 0.8)} />
        <Path path={geo.grid} color={rgba(win, 0.35)} />
        <Path path={geo.front} color={rgba(front, 1)} />
        <Path path={geo.tanks} color={rgba(front, 1)} />
      </Group>
      {geo.ant ? (
        <Group opacity={blink}>
          <Glow cx={geo.ant[0]} cy={geo.ant[1]} r={9 * k} color={red} mid={0.5} />
          <Circle cx={geo.ant[0]} cy={geo.ant[1]} r={2 * k} color={red} />
        </Group>
      ) : null}
    </>
  );
}

// ── 21 · Yüzüklerin Efendisi: yanardağ, kule, alevli göz ve süpüren bakış ──
function Mordor({ p, clock, width, height, tone }) {
  const k = sceneScale(width, height);
  const f = useFrame(p, clock, width, height);
  const geo = useMemo(() => {
    const ridge = [];
    const rand = seededRandom(21);
    for (let x = -10; x <= width + 10; x += 18 * k) ridge.push([x, height - (40 + rand() * 30) * k]);
    const mountains = silhouette(ridge, height + 2);
    // yanardağ (sol)
    const vx = width * 0.26;
    const vh = 150 * k;
    const volcano = Skia.Path.Make();
    volcano.moveTo(vx - width * 0.24, height + 2);
    volcano.lineTo(vx - 18 * k, height - vh);
    volcano.lineTo(vx - 8 * k, height - vh + 6 * k);
    volcano.lineTo(vx + 8 * k, height - vh + 6 * k);
    volcano.lineTo(vx + 18 * k, height - vh);
    volcano.lineTo(vx + width * 0.24, height + 2);
    volcano.close();
    const lava = Skia.Path.Make();
    lava.moveTo(vx + 4 * k, height - vh + 6 * k);
    lava.cubicTo(vx + 12 * k, height - vh * 0.7, vx - 4 * k, height - vh * 0.45, vx + 14 * k, height - vh * 0.15);
    // kule (sağ): geniş taban, sivri iki uç; göz uçların arasında
    const tx = width * 0.72;
    const th = Math.min(300 * k, height * 0.42);
    const tw = 34 * k;
    const tower = Skia.Path.Make();
    tower.moveTo(tx - tw * 1.6, height + 2);
    tower.lineTo(tx - tw * 0.9, height - th * 0.35);
    tower.lineTo(tx - tw * 0.55, height - th * 0.4);
    tower.lineTo(tx - tw * 0.45, height - th * 0.85);
    tower.lineTo(tx - tw * 0.62, height - th);
    tower.lineTo(tx - tw * 0.2, height - th * 0.88);
    tower.lineTo(tx + tw * 0.2, height - th * 0.88);
    tower.lineTo(tx + tw * 0.62, height - th);
    tower.lineTo(tx + tw * 0.45, height - th * 0.85);
    tower.lineTo(tx + tw * 0.55, height - th * 0.4);
    tower.lineTo(tx + tw * 0.9, height - th * 0.35);
    tower.lineTo(tx + tw * 1.6, height + 2);
    tower.close();
    const eye = [tx, height - th * 0.93];
    const iris = Skia.Path.Make();
    iris.moveTo(eye[0] - 13 * k, eye[1]);
    iris.quadTo(eye[0], eye[1] - 8 * k, eye[0] + 13 * k, eye[1]);
    iris.quadTo(eye[0], eye[1] + 8 * k, eye[0] - 13 * k, eye[1]);
    iris.close();
    return { mountains, volcano, lava, crater: [vx, height - vh + 4 * k], tower, eye, iris };
  }, [width, height, k]);
  const [stone, ridgeCol, fire, core] = tone.colors;
  const glow = useDerivedValue(() => f.value.a);
  const beamT = useDerivedValue(() => [{ translateX: geo.eye[0] }, { translateY: geo.eye[1] }, { rotate: f.value.r }]);
  const L = Math.max(width, height) * 1.1;
  return (
    <>
      <Group opacity={tone.alpha}>
        <Path path={geo.mountains} color={rgba(ridgeCol, 1)} />
        <Path path={geo.volcano} color={rgba(stone, 1)} />
        <Path path={geo.tower} color={rgba(stone, 1)} />
      </Group>
      <Path path={geo.lava} style="stroke" strokeWidth={2.4 * k} strokeCap="round" color={rgba(fire, 0.75)} />
      <Glow cx={geo.crater[0]} cy={geo.crater[1]} r={44 * k} color={fire} mid={0.35} />
      <Group opacity={0.32} transform={beamT}>
        <Beam L={L} ha={0.06} color={fire} />
      </Group>
      <Group opacity={glow}>
        <Glow cx={geo.eye[0]} cy={geo.eye[1]} r={30 * k} color={fire} mid={0.4} />
        <Path path={geo.iris} color={rgba(fire, 1)} />
        <Path path={geo.iris} color={rgba(core, 0.85)} transform={[{ translateX: geo.eye[0] }, { translateY: geo.eye[1] }, { scaleX: 0.55 }, { scaleY: 0.6 }, { translateX: -geo.eye[0] }, { translateY: -geo.eye[1] }]} />
        <Rect x={geo.eye[0] - 1.2 * k} y={geo.eye[1] - 6 * k} width={2.4 * k} height={12 * k} color="rgba(20,4,0,0.9)" />
      </Group>
    </>
  );
}

// ── 22 · Breaking Bad: çöl masaları + zemin ─────────────────────────────────
function Mesa({ width, height, tone }) {
  const k = sceneScale(width, height);
  const geo = useMemo(() => {
    const mesa = (list) => {
      const p = Skia.Path.Make();
      p.moveTo(-10, height + 2);
      for (const [fx, h, w] of list) {
        const x = fx * width;
        const y = height - h * k;
        p.lineTo(x - w * k * 0.7, height - SCENERY.mesaGround * k);
        p.lineTo(x - w * k * 0.5, y + 6 * k);
        p.lineTo(x - w * k * 0.45, y);
        p.lineTo(x + w * k * 0.45, y);
        p.lineTo(x + w * k * 0.5, y + 6 * k);
        p.lineTo(x + w * k * 0.7, height - SCENERY.mesaGround * k);
      }
      p.lineTo(width + 10, height - SCENERY.mesaGround * k);
      p.lineTo(width + 10, height + 2);
      p.close();
      return p;
    };
    const far = mesa([[0.18, 120, 110], [0.55, 96, 80], [0.86, 132, 120]]);
    const near = mesa([[0.36, 70, 90], [0.7, 58, 60]]);
    const ground = Skia.Path.Make();
    ground.addRect(Skia.XYWHRect(-4, height - SCENERY.mesaGround * k, width + 8, SCENERY.mesaGround * k + 4));
    const scrub = Skia.Path.Make();
    const rand = seededRandom(22);
    for (let i = 0; i < 14; i += 1) scrub.addCircle(rand() * width, height - SCENERY.mesaGround * k + (2 + rand() * 6) * k, (1.5 + rand() * 2.5) * k);
    return { far, near, ground, scrub };
  }, [width, height, k]);
  const [mid, near, far] = tone.colors;
  return (
    <Group opacity={tone.alpha}>
      <Path path={geo.far} color={rgba(far, 0.75)} />
      <Path path={geo.near} color={rgba(mid, 1)} />
      <Path path={geo.ground} color={rgba(near, 1)} />
      <Path path={geo.scrub} color={rgba(far, 1)} />
    </Group>
  );
}

// ── 23 · Prison Break: tel örgü, dikenli tel, kule ve projektör ────────────
function Prison({ p, clock, width, height, tone }) {
  const k = sceneScale(width, height);
  const f = useFrame(p, clock, width, height);
  const geo = useMemo(() => {
    const fh = 118 * k;
    const top = height - fh;
    const mesh = Skia.Path.Make();
    const step = 12 * k;
    for (let x = -fh; x < width + fh; x += step) {
      mesh.moveTo(x, height);
      mesh.lineTo(x + fh, top);
      mesh.moveTo(x, top);
      mesh.lineTo(x + fh, height);
    }
    const posts = Skia.Path.Make();
    for (let x = 6 * k; x < width; x += 72 * k) {
      posts.addRect(Skia.XYWHRect(x, top - 14 * k, 3.4 * k, fh + 16 * k));
      posts.moveTo(x + 1.7 * k, top - 14 * k);
      posts.lineTo(x - 8 * k, top - 24 * k);
    }
    posts.addRect(Skia.XYWHRect(-4, top - 1 * k, width + 8, 2.2 * k));
    const wire = Skia.Path.Make();
    for (let x = 0; x < width + 14 * k; x += 11 * k) wire.addCircle(x, top - 9 * k, 7 * k);
    // gözetleme kulesi (sağ)
    const cx = width * 0.86;
    const ch = 250 * k;
    const tower = Skia.Path.Make();
    tower.moveTo(cx - 26 * k, height + 2);
    tower.lineTo(cx - 12 * k, height - ch + 34 * k);
    tower.lineTo(cx - 10 * k, height - ch + 34 * k);
    tower.lineTo(cx - 22 * k, height + 2);
    tower.close();
    tower.moveTo(cx + 26 * k, height + 2);
    tower.lineTo(cx + 12 * k, height - ch + 34 * k);
    tower.lineTo(cx + 10 * k, height - ch + 34 * k);
    tower.lineTo(cx + 22 * k, height + 2);
    tower.close();
    tower.addRect(Skia.XYWHRect(cx - 22 * k, height - ch, 44 * k, 34 * k));
    tower.moveTo(cx - 28 * k, height - ch);
    tower.lineTo(cx, height - ch - 16 * k);
    tower.lineTo(cx + 28 * k, height - ch);
    tower.close();
    const braces = Skia.Path.Make();
    for (let j = 0; j < 4; j += 1) {
      const y0 = height - ch + 40 * k + j * 50 * k;
      braces.moveTo(cx - 20 * k + j * 1.5 * k, y0);
      braces.lineTo(cx + 18 * k - j * 1.5 * k, y0 + 48 * k);
    }
    return { mesh, posts, wire, tower, braces, lamp: [cx - 18 * k, height - ch + 18 * k], window: Skia.XYWHRect(cx - 14 * k, height - ch + 8 * k, 28 * k, 14 * k) };
  }, [width, height, k]);
  const [metal, mesh, lampCol, tower] = tone.colors;
  const beamT = useDerivedValue(() => [{ translateX: geo.lamp[0] }, { translateY: geo.lamp[1] }, { rotate: f.value.r }]);
  const L = Math.max(width, height) * 1.05;
  return (
    <>
      <Group opacity={0.55} transform={beamT}>
        <Beam L={L} ha={0.11} color={lampCol} alpha={0.42} />
      </Group>
      <Group opacity={tone.alpha}>
        <Path path={geo.mesh} style="stroke" strokeWidth={0.8} color={rgba(mesh, 0.6)} />
        <Path path={geo.wire} style="stroke" strokeWidth={1.1} color={rgba(metal, 0.9)} />
        <Path path={geo.posts} color={rgba(metal, 1)} />
        <Path path={geo.tower} color={rgba(tower, 1)} />
        <Path path={geo.braces} style="stroke" strokeWidth={1.6 * k} color={rgba(tower, 1)} />
        <Rect rect={geo.window} color={rgba(lampCol, 0.55)} />
      </Group>
      <Glow cx={geo.lamp[0]} cy={geo.lamp[1]} r={12 * k} color={lampCol} mid={0.6} />
    </>
  );
}

// ── 24 · Sherlock: çatılar, bacalar, saat kulesi, kubbe ─────────────────────
function London({ width, height, tone }) {
  const k = sceneScale(width, height);
  const geo = useMemo(() => {
    const roofs = Skia.Path.Make();
    const rand = seededRandom(24);
    let x = -4;
    while (x < width + 4) {
      const w = (40 + rand() * 40) * k;
      const h = (70 + rand() * 60) * k;
      const y = height - h;
      roofs.moveTo(x, height + 2);
      roofs.lineTo(x, y);
      roofs.lineTo(x + w * 0.5, y - 16 * k);
      roofs.lineTo(x + w, y);
      roofs.lineTo(x + w, height + 2);
      roofs.close();
      // baca + baca kapakları
      const cx = x + w * (0.2 + rand() * 0.5);
      roofs.addRect(Skia.XYWHRect(cx, y - 26 * k, 9 * k, 26 * k));
      roofs.addRect(Skia.XYWHRect(cx + 1 * k, y - 31 * k, 2.6 * k, 5 * k));
      roofs.addRect(Skia.XYWHRect(cx + 5.4 * k, y - 31 * k, 2.6 * k, 5 * k));
      x += w;
    }
    // saat kulesi (sol): gövde, saat odası, sivri çatı
    const bx = width * 0.2;
    const bw = 30 * k;
    const bh = 270 * k;
    const tower = Skia.Path.Make();
    tower.addRect(Skia.XYWHRect(bx - bw / 2, height - bh, bw, bh));
    tower.addRect(Skia.XYWHRect(bx - bw * 0.62, height - bh - 4 * k, bw * 1.24, 40 * k));
    tower.moveTo(bx - bw * 0.62, height - bh - 4 * k);
    tower.lineTo(bx, height - bh - 74 * k);
    tower.lineTo(bx + bw * 0.62, height - bh - 4 * k);
    tower.close();
    // kubbe (sağ)
    const dx = width * 0.66;
    const dome = Skia.Path.Make();
    dome.addRect(Skia.XYWHRect(dx - 42 * k, height - 150 * k, 84 * k, 150 * k));
    dome.addOval(Skia.XYWHRect(dx - 36 * k, height - 186 * k, 72 * k, 72 * k));
    dome.addRect(Skia.XYWHRect(dx - 5 * k, height - 206 * k, 10 * k, 22 * k));
    dome.moveTo(dx - 5 * k, height - 206 * k);
    dome.lineTo(dx, height - 220 * k);
    dome.lineTo(dx + 5 * k, height - 206 * k);
    dome.close();
    const clock = [bx, height - bh + 16 * k];
    const hands = Skia.Path.Make();
    hands.moveTo(clock[0], clock[1]);
    hands.lineTo(clock[0], clock[1] - 7 * k);
    hands.moveTo(clock[0], clock[1]);
    hands.lineTo(clock[0] + 5 * k, clock[1] + 2 * k);
    return { roofs, tower, dome, clock, hands };
  }, [width, height, k]);
  const [front, back, lamp] = tone.colors;
  return (
    <>
      <Group opacity={tone.alpha}>
        <Path path={geo.dome} color={rgba(back, 0.9)} />
        <Path path={geo.tower} color={rgba(back, 1)} />
        <Path path={geo.roofs} color={rgba(front, 1)} />
      </Group>
      <Glow cx={geo.clock[0]} cy={geo.clock[1]} r={20 * k} color={lamp} mid={0.3} />
      <Circle cx={geo.clock[0]} cy={geo.clock[1]} r={10 * k} color={rgba(lamp, 0.6)} />
      <Path path={geo.hands} style="stroke" strokeWidth={1.4 * k} strokeCap="round" color={rgba(back, 1)} />
    </>
  );
}

// ── 25 · Sopranos: banliyö ağaçları + havuz (dalgacıklar kayar) ────────────
function Pool({ p, clock, width, height, tone }) {
  const k = sceneScale(width, height);
  const f = useFrame(p, clock, width, height);
  const geo = useMemo(() => {
    const rand = seededRandom(25);
    const trees = Skia.Path.Make();
    for (let i = 0; i < 9; i += 1) {
      const cx = width * (i / 8) + (rand() - 0.5) * 30 * k;
      const r = (34 + rand() * 26) * k;
      const cy = height - (SCENERY.poolTop + 40 + rand() * 50) * k;
      trees.addCircle(cx, cy, r);
      trees.addCircle(cx + r * 0.6, cy + r * 0.3, r * 0.75);
      trees.addRect(Skia.XYWHRect(cx - 3 * k, cy, 6 * k, height - cy));
    }
    const roof = Skia.Path.Make();
    roof.moveTo(width * 0.5, height - (SCENERY.poolTop + 70) * k);
    roof.lineTo(width * 0.72, height - (SCENERY.poolTop + 120) * k);
    roof.lineTo(width * 0.96, height - (SCENERY.poolTop + 70) * k);
    roof.lineTo(width * 0.96, height - SCENERY.poolTop * k);
    roof.lineTo(width * 0.5, height - SCENERY.poolTop * k);
    roof.close();
    const top = height - SCENERY.poolTop * k;
    const bottom = height - SCENERY.poolBottom * k;
    const water = Skia.Path.Make();
    water.moveTo(width * 0.14, top);
    water.lineTo(width * 0.86, top);
    water.lineTo(width * 0.95, bottom);
    water.lineTo(width * 0.05, bottom);
    water.close();
    const ripples = Skia.Path.Make();
    for (let j = 0; j < 7; j += 1) {
      const y = top + ((bottom - top) * (j + 0.6)) / 7;
      for (let x = -width; x < width * 2; x += 40 * k) {
        ripples.moveTo(x, y);
        ripples.quadTo(x + 10 * k, y - 2.4 * k, x + 20 * k, y);
      }
    }
    const deck = Skia.Path.Make();
    deck.addRect(Skia.XYWHRect(-4, bottom, width + 8, height - bottom + 4));
    return { trees, roof, water, ripples, deck, top, bottom };
  }, [width, height, k]);
  const [water, deep, shine, leaf] = tone.colors;
  const slide = useDerivedValue(() => [{ translateX: -f.value.x * 40 * k }]);
  const shimmer = useDerivedValue(() => f.value.a * 0.8);
  return (
    <Group opacity={tone.alpha}>
      <Path path={geo.trees} color={rgba(leaf, 0.85)} />
      <Path path={geo.roof} color={rgba(leaf, 0.6)} />
      <Path path={geo.water}>
        <LinearGradient start={vec(0, geo.top)} end={vec(0, geo.bottom)} colors={[rgba(water, 1), rgba(deep, 1)]} />
      </Path>
      <Group clip={geo.water}>
        <Group transform={slide} opacity={shimmer}>
          <Path path={geo.ripples} style="stroke" strokeWidth={1.3} strokeCap="round" color={rgba(shine, 0.8)} />
        </Group>
      </Group>
      <Path path={geo.water} style="stroke" strokeWidth={2.4 * k} color={rgba(shine, 0.9)} />
      <Path path={geo.deck} color={rgba(shine, 0.35)} />
    </Group>
  );
}

// ── 26 · Attack on Titan: dev duvar (ÖNDE; titan arkasından yükselir) ───────
function TitanWall({ width, height, tone }) {
  const k = sceneScale(width, height);
  const geo = useMemo(() => {
    const top = height - SCENERY.titanWallTop * k;
    const body = Skia.Path.Make();
    body.addRect(Skia.XYWHRect(-4, top, width + 8, height - top + 4));
    const crenel = Skia.Path.Make();
    crenel.addRect(Skia.XYWHRect(-4, top - 8 * k, width + 8, 10 * k));
    const blocks = Skia.Path.Make();
    const rowH = 26 * k;
    let row = 0;
    for (let y = top + 10 * k; y < height; y += rowH) {
      blocks.moveTo(-4, y);
      blocks.lineTo(width + 4, y);
      const off = row % 2 ? 0 : 30 * k;
      for (let x = off; x < width; x += 60 * k) {
        blocks.moveTo(x, y);
        blocks.lineTo(x, Math.min(height, y + rowH));
      }
      row += 1;
    }
    const rand = seededRandom(26);
    const stains = Skia.Path.Make();
    for (let i = 0; i < 10; i += 1) {
      const x = rand() * width;
      const y = top + (14 + rand() * 120) * k;
      stains.moveTo(x, y);
      stains.lineTo(x + (rand() - 0.5) * 4 * k, y + (20 + rand() * 30) * k);
    }
    return { top, body, crenel, blocks, stains };
  }, [width, height, k]);
  const [face, low, edge, line] = tone.colors;
  return (
    <Group opacity={1}>
      <Path path={geo.body}>
        <LinearGradient start={vec(0, geo.top)} end={vec(0, height)} colors={[rgba(face, 1), rgba(low, 1)]} />
      </Path>
      <Path path={geo.crenel} color={rgba(edge, 1)} />
      <Path path={geo.blocks} style="stroke" strokeWidth={1} color={rgba(line, 0.8)} />
      <Path path={geo.stains} style="stroke" strokeWidth={2 * k} strokeCap="round" color={rgba(line, 0.35)} />
    </Group>
  );
}

// ── 27 · Fullmetal Alchemist: kendini çizen dönüşüm çemberi ─────────────────
function SparkBolt({ p, clock, i, cx, cy, R, path, color }) {
  const s = useDerivedValue(() => sparkSlot(p, clock.value, i));
  const opacity = useDerivedValue(() => s.value.a);
  const transform = useDerivedValue(() => [
    { translateX: cx },
    { translateY: cy },
    { rotate: hash01(s.value.n, p.salt + i * 13) * 6.283185307179586 },
    { translateX: R * 0.98 },
  ]);
  return (
    <Group opacity={opacity} transform={transform}>
      <Path path={path} style="stroke" strokeWidth={2} strokeCap="round" strokeJoin="round" color={color} />
    </Group>
  );
}

function Transmute({ p, clock, width, height, tone }) {
  const cx = width * 0.5;
  const cy = height * 0.42;
  const R = Math.min(width, height) * 0.32;
  const geo = useMemo(() => {
    const path = Skia.Path.Make();
    path.addCircle(cx, cy, R);
    path.addCircle(cx, cy, R * 0.86);
    const tri = (rot) => {
      for (let j = 0; j <= 3; j += 1) {
        const a = rot + (j * Math.PI * 2) / 3;
        const x = cx + Math.cos(a) * R * 0.86;
        const y = cy + Math.sin(a) * R * 0.86;
        if (j === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      }
    };
    tri(-Math.PI / 2);
    tri(Math.PI / 2);
    path.addCircle(cx, cy, R * 0.4);
    for (let j = 0; j < 6; j += 1) {
      const a = -Math.PI / 2 + (j * Math.PI) / 3;
      path.addCircle(cx + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.86, R * 0.075);
    }
    for (let j = 0; j < 4; j += 1) {
      const a = Math.PI / 4 + (j * Math.PI) / 2;
      path.moveTo(cx + Math.cos(a) * R * 0.4, cy + Math.sin(a) * R * 0.4);
      path.lineTo(cx + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.86);
    }
    const bolt = Skia.Path.Make();
    bolt.moveTo(0, 0);
    bolt.lineTo(10, -6);
    bolt.lineTo(16, 4);
    bolt.lineTo(26, -4);
    bolt.lineTo(32, 6);
    bolt.moveTo(16, 4);
    bolt.lineTo(20, 14);
    return { path, bolt };
  }, [cx, cy, R]);
  const d = useDerivedValue(() => drawCycle(p, clock.value));
  const end = useDerivedValue(() => d.value.draw);
  const opacity = useDerivedValue(() => d.value.a * tone.alpha);
  const glow = useDerivedValue(() => d.value.glow * d.value.a);
  const [line, deep, hot] = tone.colors;
  return (
    <>
      <Group opacity={glow}>
        <Glow cx={cx} cy={cy} r={R * 1.3} color={deep} mid={0.25} />
        <Path path={geo.path} style="stroke" strokeWidth={6} color={rgba(hot, 0.7)}>
          <BlurMask blur={5} style="normal" />
        </Path>
      </Group>
      <Group opacity={opacity}>
        <Path path={geo.path} style="stroke" strokeWidth={1.8} strokeCap="round" color={line} start={0} end={end} />
      </Group>
      {[0, 1, 2].map((i) => (
        <SparkBolt key={i} p={p} clock={clock} i={i} cx={cx} cy={cy} R={R} path={geo.bolt} color={hot} />
      ))}
    </>
  );
}

// ── 28 · Prison Break: kendini çizen kaçış planı ───────────────────────────
function Blueprint({ p, clock, width, height, tone }) {
  const geo = useMemo(() => {
    const x0 = width * 0.1;
    const y0 = height * 0.2;
    const w = width * 0.8;
    const h = height * 0.32;
    const plan = Skia.Path.Make();
    plan.addRect(Skia.XYWHRect(x0, y0, w, h));
    // hücre bloğu
    for (let j = 1; j < 6; j += 1) {
      plan.moveTo(x0 + (w * 0.5 * j) / 6, y0);
      plan.lineTo(x0 + (w * 0.5 * j) / 6, y0 + h * 0.34);
    }
    plan.moveTo(x0, y0 + h * 0.34);
    plan.lineTo(x0 + w * 0.5, y0 + h * 0.34);
    // koridor + odalar
    plan.moveTo(x0 + w * 0.5, y0);
    plan.lineTo(x0 + w * 0.5, y0 + h);
    plan.addRect(Skia.XYWHRect(x0 + w * 0.6, y0 + h * 0.12, w * 0.3, h * 0.3));
    plan.addRect(Skia.XYWHRect(x0 + w * 0.08, y0 + h * 0.56, w * 0.32, h * 0.34));
    // borular
    plan.moveTo(x0 + w * 0.04, y0 + h * 0.46);
    plan.lineTo(x0 + w * 0.96, y0 + h * 0.46);
    plan.moveTo(x0 + w * 0.04, y0 + h * 0.5);
    plan.lineTo(x0 + w * 0.96, y0 + h * 0.5);
    // kaçış yolu (kırmızı): hücreden borulara, odadan dışarı
    const route = Skia.Path.Make();
    route.moveTo(x0 + w * 0.12, y0 + h * 0.18);
    route.lineTo(x0 + w * 0.12, y0 + h * 0.48);
    route.lineTo(x0 + w * 0.7, y0 + h * 0.48);
    route.lineTo(x0 + w * 0.7, y0 + h * 0.86);
    route.lineTo(x0 + w * 1.04, y0 + h * 0.86);
    route.moveTo(x0 + w * 1.0, y0 + h * 0.82);
    route.lineTo(x0 + w * 1.04, y0 + h * 0.86);
    route.lineTo(x0 + w * 1.0, y0 + h * 0.9);
    return { plan, route };
  }, [width, height]);
  const d = useDerivedValue(() => drawCycle(p, clock.value));
  const end = useDerivedValue(() => d.value.draw);
  const routeEnd = useDerivedValue(() => {
    const v = (d.value.draw - 0.55) / 0.45;
    return v < 0 ? 0 : v;
  });
  const opacity = useDerivedValue(() => d.value.a * tone.alpha);
  const [line, red] = tone.colors;
  return (
    <Group opacity={opacity}>
      <Path path={geo.plan} style="stroke" strokeWidth={1.3} strokeJoin="round" color={line} start={0} end={end} />
      <Path path={geo.route} style="stroke" strokeWidth={2.2} strokeCap="round" strokeJoin="round" color={red} start={0} end={routeEnd} />
    </Group>
  );
}

// ── 29 · İp / halat / zincir ────────────────────────────────────────────────
function Tether({ p, clock, width, height, tone }) {
  const k = sceneScale(width, height);
  const f = useDerivedValue(() => tetherFrame(p, clock.value, width, height));
  const path = useDerivedValue(() => {
    const q = Skia.Path.Make();
    q.moveTo(f.value.x1, f.value.y1);
    q.lineTo(f.value.x2, f.value.y2);
    return q;
  });
  const opacity = useDerivedValue(() => f.value.a * tone.alpha);
  const color = tone.colors[p.slots] || tone.colors[0];
  return (
    <Group opacity={opacity}>
      <Path path={path} style="stroke" strokeWidth={p.size * k} strokeCap="round" color={color} />
    </Group>
  );
}

// Yarasa işareti (jenerik yarasa silüeti, birim kutu −1…1)
const BAT_HALF = [[0, -0.5], [0.1, -0.72], [0.2, -0.5], [0.34, -0.44], [0.62, -0.6], [0.92, -0.46], [1.02, -0.12], [0.86, -0.22], [0.74, -0.02],
  [0.58, -0.16], [0.44, 0.1], [0.3, -0.04], [0.16, 0.3], [0.06, 0.12], [0, 0.44]];
function batPath(r) {
  const q = Skia.Path.Make();
  BAT_HALF.forEach(([x, y], i) => (i ? q.lineTo(x * r, y * r) : q.moveTo(x * r, y * r)));
  BAT_HALF.slice(1, -1).reverse().forEach(([x, y]) => q.lineTo(-x * r, y * r));
  q.close();
  return q;
}

// ── 30 · Batman: şehirden göğe projektör; hüzme ekranın içinde biter, ucunda yarasa işareti ──
function SkyBeam({ p, clock, width, height, tone }) {
  const k = sceneScale(width, height);
  const f = useFrame(p, clock, width, height);
  const ox = p.xr0 * width;
  const oy = p.yr0 * height - SCENERY.lift * k;
  const transform = useDerivedValue(() => [{ translateX: ox }, { translateY: oy }, { rotate: f.value.r }]);
  const opacity = useDerivedValue(() => tone.alpha * f.value.a);
  const spotOpacity = useDerivedValue(() => f.value.a * 0.85);
  const L = Math.max(120 * k, (oy - height * (p.xr0 > 0.5 ? 0.42 : 0.16)) * 1.04);
  const Rs = Math.tan(0.085) * L;
  const symbolT = useDerivedValue(() => [{ translateY: L }, { rotate: -f.value.r }]);
  const bat = useMemo(() => batPath(Rs * 0.74), [Rs]);
  return (
    <Group transform={transform}>
      <Group opacity={opacity}>
        <Beam L={L} ha={0.085} color={tone.colors[0]} tail={0.32} />
        <Glow cx={0} cy={L * 0.04} r={46 * k} color={tone.colors[0]} mid={0.3} />
      </Group>
      <Group opacity={spotOpacity} transform={symbolT}>
        <Circle cx={0} cy={0} r={Rs * 1.15}>
          <RadialGradient c={vec(0, 0)} r={Rs * 1.15} colors={[rgba(tone.colors[0], 0.72), rgba(tone.colors[0], 0.5), rgba(tone.colors[0], 0)]} positions={[0, 0.7, 1]} />
        </Circle>
        <Path path={bat} color="rgba(8,12,20,0.82)" />
      </Group>
    </Group>
  );
}


// ── 31 · Vikings: nehir, ormanlı kıyılar, kuşatılan kale, vektör uzun gemiler ──
// Geometri alt kenardan dp ile (SCENERY.river; tab çubuğunun üstünde kalır).
// Gemiler dokudan değil VEKTÖR çizilir (büyütülünce bulanmaz); konumları vikScene
// ile aynı zaman çizelgesinden (SCENERY.vikShips). Kale 30 sn'lik baskında tutuşur.
const FIRE_SPOTS = [[0.742, 66, 1.15], [0.942, 66, 1.15], [0.838, 50, 1.5], [0.8, 22, 0.9]]; // [x oranı, zeminden dp, ölçek]

const shipX = (o, u) => {
  "worklet";
  const ss = (v) => {
    const c = v < 0 ? 0 : v > 1 ? 1 : v;
    return c * c * (3 - 2 * c);
  };
  if (u < o.at) return o.from + (o.hold - o.from) * ss(u / o.at);
  if (u < 0.62) return o.hold + 0.03 * ss((u - o.at) / (0.62 - o.at));
  return o.hold + 0.03 + (1.4 - o.hold - 0.03) * ss((u - 0.62) / 0.38);
};

function Flame({ x, y, size, f, color, phase }) {
  const transform = useDerivedValue(() => {
    const s = f.value.burn * size * (0.92 + 0.08 * Math.sin(f.value.u * 420 + phase));
    return [{ translateX: x }, { translateY: y }, { scale: s }];
  });
  const opacity = useDerivedValue(() => f.value.burn);
  return (
    <Group transform={transform} opacity={opacity}>
      <Path path="M0 0 C-8 -5 -10 -15 0 -29 C3 -19 11 -13 8 -4 C6 0 2 1 0 0 Z" color={rgba(color, 0.95)} />
      <Path path="M-7 -1 C-10 -6 -8 -12 -4 -15 C-4 -10 -2 -7 -3 -3 Z" color={rgba(color, 0.8)} />
      <Path path="M0 -1 C-4 -4 -4 -11 0 -19 C1 -12 5 -8 3 -3 Z" color="rgba(255,226,140,0.95)" />
    </Group>
  );
}

// Çizim kutusu 100×100 (su hattı y=79, ortası x=50); ölçek dışarıdan.
const SHIP_SAIL = "M24 15 C35 22 65 22 76 15 L73 50 C62 56 38 56 27 50 Z";
const SHIP_HULL = "M3 55 C8 73 30 80 52 80 C74 80 91 73 97 52 C85 60 67 65 50 65 C33 65 15 61 3 55 Z";
const shipRail = (x) => 65 - 9 * ((x - 50) / 47) ** 2;
const SHIP_OARS_A = "M20 66 L11 86 M31 68 L22 88 M42 69 L33 89 M58 69 L49 89 M69 68 L60 88 M80 66 L71 86";
const SHIP_OARS_B = "M20 66 L26 87 M31 68 L37 89 M42 69 L48 90 M58 69 L64 90 M69 68 L75 89 M80 66 L86 87";

function ShipArt({ stripe, oarsA, oarsB }) {
  const sail = useMemo(() => Skia.Path.MakeFromSVGString(SHIP_SAIL), []);
  const heads = [18, 34, 50, 66, 82];
  return (
    <>
      {/* halatlar */}
      <Path path="M50 6 L97 52 M50 6 L3 55 M50 6 L74 40 M50 6 L26 40" style="stroke" strokeWidth={0.6} color="rgba(30,20,10,0.6)" />
      {/* direk ve serenler */}
      <Rect x={48.6} y={6} width={2.8} height={60} color="#4a2c14" />
      <Rect x={21} y={13} width={58} height={2.4} color="#5a3a1c" />
      <Rect x={26} y={53} width={48} height={1.8} color="#5a3a1c" />
      {/* yelken */}
      <Path path={SHIP_SAIL} color="#f4e9d2" />
      {sail ? (
        <Group clip={sail}>
          {[25, 37, 49, 61, 73].map((x) => (
            <Rect key={x} x={x} y={14} width={6} height={44} color={stripe} />
          ))}
          <Rect x={20} y={14} width={60} height={44}>
            <LinearGradient start={vec(20, 0)} end={vec(80, 0)} colors={["rgba(0,0,0,0.26)", "rgba(0,0,0,0)", "rgba(0,0,0,0.2)"]} />
          </Rect>
          <Rect x={20} y={14} width={60} height={5} color="rgba(0,0,0,0.18)" />
          <Rect x={20} y={46} width={60} height={3} color={stripe} />
        </Group>
      ) : null}
      <Path path={SHIP_SAIL} style="stroke" strokeWidth={1} strokeJoin="round" color="#7a5a2c" />
      {/* küreklerin iki evresi (yumuşak geçişle çekiş) */}
      <Group opacity={oarsA}>
        <Path path={SHIP_OARS_A} style="stroke" strokeWidth={1.8} strokeCap="round" color="#a06a38" />
      </Group>
      <Group opacity={oarsB}>
        <Path path={SHIP_OARS_B} style="stroke" strokeWidth={1.8} strokeCap="round" color="#a06a38" />
      </Group>
      {/* gövde */}
      <Path path={SHIP_HULL}>
        <LinearGradient start={vec(0, 62)} end={vec(0, 81)} colors={["#a8683a", "#6b3e1e", "#3e2210"]} positions={[0, 0.55, 1]} />
      </Path>
      <Path path="M8 63 C28 72 74 72 92 61 M13 68 C32 76 70 76 87 67 M20 73 C36 78 68 78 80 72" style="stroke" strokeWidth={0.8} color="rgba(30,16,6,0.75)" />
      <Path path="M10 64 L10 67 M26 69 L26 72 M42 71 L42 74 M58 71 L58 74 M74 69 L74 72 M90 62 L90 65" style="stroke" strokeWidth={0.7} color="rgba(255,220,160,0.45)" />
      {/* küpeşte */}
      <Path path="M3 55 C15 61 33 65 50 65 C67 65 85 61 97 52" style="stroke" strokeWidth={2} strokeCap="round" color="#e0b06a" />
      {/* ejder pruva */}
      <Path path="M96 54 C101 46 100 35 93 28 C91 26 89 28 91 31 C94 36 93 43 90 50 Z" color="#7a4620" />
      <Path path="M88 29 C90 23 97 23 100 28 L96 30 C95 32 90 32 88 29 Z" color="#94582a" />
      <Path path="M92 23 L93 19 L95 23 Z M95 24 L97 20 L98 25 Z" color="#e0b06a" />
      <Circle cx={94} cy={26.6} r={1} color="#f4e9d2" />
      <Circle cx={94.2} cy={26.7} r={0.5} color="#111111" />
      <Path path="M5 56 C0 47 1 37 8 33 C9 38 7 45 10 51 Z" color="#7a4620" />
      <Path path="M4 36 C2 33 4 30 8 31" style="stroke" strokeWidth={1.4} strokeCap="round" color="#e0b06a" />
      {/* tayfa: miğferli başlar kalkanların arkasında */}
      {heads.map((x) => (
        <React.Fragment key={`h${x}`}>
          <Circle cx={x + 4} cy={shipRail(x + 4) - 7} r={2.6} color="#c79a72" />
          <Path path={`M${x + 1.2} ${shipRail(x + 4) - 7.4} C${x + 1.4} ${shipRail(x + 4) - 12} ${x + 6.6} ${shipRail(x + 4) - 12} ${x + 6.8} ${shipRail(x + 4) - 7.4} Z`} color="#8d949e" />
          <Rect x={x + 3.4} y={shipRail(x + 4) - 5} width={1.2} height={3} color="#5a3a1c" />
        </React.Fragment>
      ))}
      {/* kalkanlar */}
      {[10, 18, 26, 34, 42, 50, 58, 66, 74, 82, 90].map((x, i) => (
        <React.Fragment key={`s${x}`}>
          <Circle cx={x} cy={shipRail(x) + 1.6} r={4.3} color={["#d4a017", "#2b5f8a", "#c0392b", "#f4e9d2"][i % 4]} />
          <Circle cx={x} cy={shipRail(x) + 1.6} r={4.3} style="stroke" strokeWidth={0.7} color="rgba(30,16,6,0.8)" />
          <Circle cx={x} cy={shipRail(x) + 1.6} r={1.3} color="rgba(255,255,255,0.75)" />
        </React.Fragment>
      ))}
      {/* su hattı köpüğü */}
      <Path path="M2 79 C22 84 78 84 98 78" style="stroke" strokeWidth={1.3} strokeCap="round" color="rgba(235,248,255,0.65)" />
    </>
  );
}

function ShipVec({ o, f, clock, width, height, k }) {
  const sc = (o.S * k) / 100;
  const yW = height - o.w * k;
  const ph = o.ph;
  const transform = useDerivedValue(() => {
    const t = clock.value;
    return [
      { translateX: shipX(o, f.value.u) * width },
      { translateY: yW + Math.sin(t * 0.9 + ph) * 2.2 * k },
      { rotate: Math.sin(t * 0.85 + ph) * 0.035 },
      { scale: sc },
      { translateX: -50 },
      { translateY: -79 },
    ];
  });
  const oarsA = useDerivedValue(() => 0.5 + 0.5 * Math.sin(clock.value * 2.2 + ph));
  const oarsB = useDerivedValue(() => 0.5 - 0.5 * Math.sin(clock.value * 2.2 + ph));
  return (
    <Group transform={transform}>
      <ShipArt stripe={o.stripe} oarsA={oarsA} oarsB={oarsB} />
    </Group>
  );
}

function pineRow(path, x0, x1, step, base, hMin, hMax, w, rand) {
  for (let x = x0; x < x1; x += step) {
    const h = hMin + rand() * (hMax - hMin);
    const b = base + (rand() - 0.5) * 4;
    path.moveTo(x - w, b);
    path.lineTo(x - w * 0.55, b - h * 0.42);
    path.lineTo(x - w * 0.8, b - h * 0.42);
    path.lineTo(x - w * 0.3, b - h * 0.75);
    path.lineTo(x - w * 0.5, b - h * 0.75);
    path.lineTo(x, b - h);
    path.lineTo(x + w * 0.5, b - h * 0.75);
    path.lineTo(x + w * 0.3, b - h * 0.75);
    path.lineTo(x + w * 0.8, b - h * 0.42);
    path.lineTo(x + w * 0.55, b - h * 0.42);
    path.lineTo(x + w, b);
    path.close();
  }
}

function River({ p, clock, width, height, tone }) {
  const k = sceneScale(width, height);
  const L = SCENERY.river;
  const geo = useMemo(() => {
    const yFar = height - L.farBank * k;
    const yNear = height - L.near * k;
    const rand = seededRandom(31);
    // uzak kıyı: arka tepeler, yakın tepeler, iki sıra çam
    const ridge = (amp, ph, lift) => {
      const pts = [];
      for (let x = -10; x <= width + 10; x += 12 * k) {
        const u = x / width;
        pts.push([x, yFar - (lift + amp * (0.6 * Math.sin(u * 6 + ph) + 0.4 * Math.sin(u * 15 + ph * 2))) * k]);
      }
      return silhouette(pts, yFar + 2);
    };
    const hillsBack = ridge(16, 0.7, 40);
    const hillsFront = ridge(11, 2.1, 20);
    const pinesBack = Skia.Path.Make();
    pineRow(pinesBack, 2 * k, width * 0.7 - 6 * k, 8 * k, yFar - 14 * k, 18 * k, 34 * k, 4.4 * k, rand);
    const pinesFront = Skia.Path.Make();
    pineRow(pinesFront, 4 * k, width * 0.69, 10 * k, yFar - 1 * k, 22 * k, 46 * k, 6 * k, rand);
    pineRow(pinesFront, width * 0.975, width + 8 * k, 10 * k, yFar - 1 * k, 22 * k, 40 * k, 6 * k, rand);
    // kale höyüğü
    const fx0 = width * 0.7;
    const fx1 = width * 0.97;
    const mound = Skia.Path.Make();
    mound.moveTo(fx0 - 26 * k, yFar + 2);
    mound.cubicTo(fx0 - 6 * k, yFar - 4 * k, fx0, yFar - 8 * k, fx0 + 20 * k, yFar - 8 * k);
    mound.lineTo(fx1 - 14 * k, yFar - 8 * k);
    mound.cubicTo(fx1, yFar - 8 * k, fx1 + 8 * k, yFar - 3 * k, fx1 + 22 * k, yFar + 2);
    mound.close();
    const gy = yFar - 6 * k; // kale zemini
    // çit: iki sıra yüksek kazık, yatay bağlar
    const wall = Skia.Path.Make();
    for (let x = fx0 + 6 * k; x < fx1 - 6 * k; x += 5 * k) {
      const h = (27 + ((x * 7) % 5)) * k;
      wall.moveTo(x, gy + 3 * k);
      wall.lineTo(x, gy - h + 5 * k);
      wall.lineTo(x + 2.2 * k, gy - h);
      wall.lineTo(x + 4.4 * k, gy - h + 5 * k);
      wall.lineTo(x + 4.4 * k, gy + 3 * k);
      wall.close();
    }
    const rails = Skia.Path.Make();
    rails.addRect(Skia.XYWHRect(fx0 + 4 * k, gy - 20 * k, fx1 - fx0 - 8 * k, 2.2 * k));
    rails.addRect(Skia.XYWHRect(fx0 + 4 * k, gy - 8 * k, fx1 - fx0 - 8 * k, 2.2 * k));
    // gözetleme kuleleri: gövde, kayış, platform, korkuluk, çatı, flama direği
    const towerX = [width * 0.742, width * 0.942];
    const towers = Skia.Path.Make();
    const towerBands = Skia.Path.Make();
    const towerRoofs = Skia.Path.Make();
    const rails2 = Skia.Path.Make();
    const poles = Skia.Path.Make();
    towerX.forEach((cx) => {
      const x = cx - 9 * k;
      towers.addRect(Skia.XYWHRect(x, gy - 56 * k, 18 * k, 60 * k));
      towers.addRect(Skia.XYWHRect(x - 4 * k, gy - 60 * k, 26 * k, 5 * k)); // platform
      for (let j = 0; j < 4; j += 1) towerBands.addRect(Skia.XYWHRect(x, gy - (14 + j * 12) * k, 18 * k, 1.4 * k));
      rails2.addRect(Skia.XYWHRect(x - 4 * k, gy - 68 * k, 26 * k, 1.4 * k));
      for (let j = 0; j < 6; j += 1) rails2.addRect(Skia.XYWHRect(x - 3.6 * k + j * 5 * k, gy - 68 * k, 1.2 * k, 8 * k));
      towerRoofs.moveTo(x - 3 * k, gy - 68 * k);
      towerRoofs.lineTo(cx, gy - 88 * k);
      towerRoofs.lineTo(x + 21 * k, gy - 68 * k);
      towerRoofs.close();
      poles.addRect(Skia.XYWHRect(cx - 0.6 * k, gy - 100 * k, 1.2 * k, 14 * k));
    });
    // kapı yapısı: iki direk, lento, çatı, kemerli karanlık açıklık
    const gateX = width * 0.838;
    const gate = Skia.Path.Make();
    gate.addRect(Skia.XYWHRect(gateX - 15 * k, gy - 40 * k, 6 * k, 44 * k));
    gate.addRect(Skia.XYWHRect(gateX + 9 * k, gy - 40 * k, 6 * k, 44 * k));
    gate.addRect(Skia.XYWHRect(gateX - 18 * k, gy - 44 * k, 36 * k, 6 * k));
    const gateRoof = Skia.Path.Make();
    gateRoof.moveTo(gateX - 22 * k, gy - 44 * k);
    gateRoof.lineTo(gateX, gy - 58 * k);
    gateRoof.lineTo(gateX + 22 * k, gy - 44 * k);
    gateRoof.close();
    const gateOpen = Skia.Path.Make();
    gateOpen.moveTo(gateX - 9 * k, gy + 3 * k);
    gateOpen.lineTo(gateX - 9 * k, gy - 24 * k);
    gateOpen.quadTo(gateX, gy - 36 * k, gateX + 9 * k, gy - 24 * k);
    gateOpen.lineTo(gateX + 9 * k, gy + 3 * k);
    gateOpen.close();
    // uzun ev: gövde, beşik çatı, çatıda ejder başı süsü, duman deliği
    const hx = width * 0.77;
    const hw = 46 * k;
    const hall = Skia.Path.Make();
    hall.addRect(Skia.XYWHRect(hx, gy - 30 * k, hw, 34 * k));
    const hallRoof = Skia.Path.Make();
    hallRoof.moveTo(hx - 6 * k, gy - 30 * k);
    hallRoof.lineTo(hx + hw / 2, gy - 56 * k);
    hallRoof.lineTo(hx + hw + 6 * k, gy - 30 * k);
    hallRoof.close();
    const hallTrim = Skia.Path.Make();
    hallTrim.moveTo(hx - 6 * k, gy - 30 * k);
    hallTrim.lineTo(hx + hw / 2, gy - 56 * k);
    hallTrim.lineTo(hx + hw + 6 * k, gy - 30 * k);
    hallTrim.moveTo(hx - 6 * k, gy - 30 * k);
    hallTrim.quadTo(hx - 12 * k, gy - 38 * k, hx - 8 * k, gy - 44 * k);
    hallTrim.moveTo(hx + hw + 6 * k, gy - 30 * k);
    hallTrim.quadTo(hx + hw + 12 * k, gy - 38 * k, hx + hw + 8 * k, gy - 44 * k);
    const windows = Skia.Path.Make();
    for (let i = 0; i < 3; i += 1) windows.addRect(Skia.XYWHRect(hx + (8 + i * 14) * k, gy - 22 * k, 5 * k, 8 * k));
    // bayraklar (kule direklerinde)
    const flags = Skia.Path.Make();
    towerX.forEach((cx) => {
      flags.moveTo(cx + 0.6 * k, gy - 100 * k);
      flags.cubicTo(cx + 8 * k, gy - 101 * k, cx + 10 * k, gy - 96 * k, cx + 18 * k, gy - 97 * k);
      flags.lineTo(cx + 18 * k, gy - 90 * k);
      flags.cubicTo(cx + 10 * k, gy - 91 * k, cx + 8 * k, gy - 95 * k, cx + 0.6 * k, gy - 94 * k);
      flags.close();
    });
    // meşale noktaları (çitte, kapının iki yanı)
    const torches = [gateX - 24 * k, gateX + 24 * k, width * 0.79, width * 0.9].map((x) => [x, gy - 22 * k]);
    // yakın kıyı: ormanlı kara, alt kenara kadar
    const nearPts = [];
    for (let x = -10; x <= width + 10; x += 10 * k) nearPts.push([x, yNear + (rand() - 0.5) * 5 * k]);
    const nearBank = silhouette(nearPts, height + 2);
    const nearPines = Skia.Path.Make();
    pineRow(nearPines, 6 * k, width, 15 * k, yNear + 14 * k, 18 * k, 36 * k, 8 * k, rand);
    pineRow(nearPines, 14 * k, width, 21 * k, yNear + 30 * k, 24 * k, 44 * k, 9 * k, rand);
    const reeds = Skia.Path.Make();
    for (let x = 3 * k; x < width; x += 9 * k) {
      const h = (8 + rand() * 14) * k;
      reeds.moveTo(x, yNear + 3 * k);
      reeds.quadTo(x + (rand() - 0.5) * 6 * k, yNear - h * 0.6, x + (rand() - 0.5) * 8 * k, yNear - h);
    }
    // su: parıltı çizgileri (kayma tam dalga boyu → dikişsiz)
    const lam = 44 * k;
    const ripples = Skia.Path.Make();
    for (let j = 0; j < 6; j += 1) {
      const t = (j + 0.5) / 6;
      const y = yFar + (yNear - yFar) * (t * t * 0.6 + t * 0.4);
      ripples.moveTo(-lam, y);
      for (let x = -lam; x <= width + lam; x += 6 * k) ripples.lineTo(x, y + Math.sin((x / lam) * Math.PI * 2 + j * 1.9) * (0.8 + t * 1.4) * k);
    }
    return {
      yFar, yNear, hillsBack, hillsFront, pinesBack, pinesFront, mound, wall, rails, towers, towerBands, towerRoofs, rails2, poles, gate,
      gateRoof, gateOpen, hall, hallRoof, hallTrim, windows, flags, torches, nearBank, nearPines, reeds, ripples, lam, fx0, fx1, gateX, gy,
    };
  }, [width, height, k, L.farBank, L.near]);
  const f = useDerivedValue(() => riverFrame(p, clock.value));
  const slide = useDerivedValue(() => [{ translateX: -f.value.slide * geo.lam }]);
  const burnGlow = useDerivedValue(() => f.value.burn * f.value.fl * 0.75);
  const litGlow = useDerivedValue(() => 0.3 + f.value.burn * 0.7);
  const [water, deep, shine, forest, wood, fire] = tone.colors;
  const dark = rgba("#000000", 0.28);
  const cx = (geo.fx0 + geo.fx1) / 2;
  return (
    <>
      <Group opacity={tone.alpha}>
        {/* uzak kıyı: tepeler ve çamlar */}
        <Path path={geo.hillsBack} color={rgba(forest, 0.55)} />
        <Path path={geo.pinesBack} color={rgba(forest, 0.75)} />
        <Path path={geo.hillsFront} color={rgba(forest, 0.85)} />
        <Path path={geo.pinesFront} color={rgba(forest, 1)} />
        {/* kale */}
        <Path path={geo.mound} color={rgba(forest, 1)} />
        <Path path={geo.wall} color={rgba(wood, 1)} />
        <Path path={geo.wall} color={dark} />
        <Path path={geo.rails} color={rgba(wood, 1)} />
        <Path path={geo.hall} color={rgba(wood, 1)} />
        <Path path={geo.hallRoof} color={rgba(wood, 1)} />
        <Path path={geo.hallRoof} color={dark} />
        <Path path={geo.hallTrim} style="stroke" strokeWidth={1.6 * k} strokeCap="round" strokeJoin="round" color={rgba(shine, 0.55)} />
        <Group opacity={litGlow}>
          <Path path={geo.windows} color={rgba(fire, 1)} />
        </Group>
        <Path path={geo.towers} color={rgba(wood, 1)} />
        <Path path={geo.towerBands} color={dark} />
        <Path path={geo.rails2} color={rgba(wood, 1)} />
        <Path path={geo.towerRoofs} color={rgba(wood, 1)} />
        <Path path={geo.towerRoofs} color={dark} />
        <Path path={geo.poles} color={rgba(wood, 1)} />
        <Path path={geo.flags} color="rgba(192,57,43,0.95)" />
        <Path path={geo.gate} color={rgba(wood, 1)} />
        <Path path={geo.gateRoof} color={rgba(wood, 1)} />
        <Path path={geo.gateRoof} color={dark} />
        <Path path={geo.gateOpen} color="rgba(6,10,16,0.92)" />
        <Group opacity={litGlow}>
          <Path path={geo.gateOpen} color={rgba(fire, 0.5)} />
          {geo.torches.map(([x, y], i) => (
            <Glow key={i} cx={x} cy={y} r={9 * k} color={fire} mid={0.4} />
          ))}
        </Group>
        {/* nehir */}
        <Rect x={0} y={geo.yFar} width={width} height={geo.yNear - geo.yFar}>
          <LinearGradient start={vec(0, geo.yFar)} end={vec(0, geo.yNear)} colors={[rgba(water, 0.95), rgba(deep, 1)]} />
        </Rect>
        <Group clip={Skia.XYWHRect(0, geo.yFar, width, geo.yNear - geo.yFar)}>
          <Group transform={slide}>
            <Path path={geo.ripples} style="stroke" strokeWidth={1.2} strokeCap="round" color={rgba(shine, 0.4)} />
          </Group>
          <Group opacity={burnGlow}>
            <Rect x={cx - 90 * k} y={geo.yFar} width={180 * k} height={geo.yNear - geo.yFar}>
              <LinearGradient start={vec(0, geo.yFar)} end={vec(0, geo.yNear)} colors={[rgba(fire, 0.7), rgba(fire, 0)]} />
            </Rect>
          </Group>
        </Group>
        {/* yakın kıyı: ormanlı kara */}
        <Path path={geo.nearPines} color={rgba(forest, 0.9)} />
        <Path path={geo.nearBank} color={rgba(forest, 1)} />
        <Path path={geo.reeds} style="stroke" strokeWidth={1.2 * k} strokeCap="round" color={rgba(forest, 1)} />
      </Group>
      {/* gemiler: net vektör, kıyının önünde */}
      {SCENERY.vikShips.map((o, i) => (
        <ShipVec key={i} o={o} f={f} clock={clock} width={width} height={height} k={k} />
      ))}
      {/* yangının ışığı ve alevler */}
      <Group opacity={burnGlow}>
        <Glow cx={cx} cy={geo.gy - 40 * k} r={150 * k} color={fire} mid={0.28} />
      </Group>
      {FIRE_SPOTS.map(([fx, h, sz], i) => (
        <Flame key={i} x={width * fx} y={geo.gy - h * k} size={k * sz} f={f} color={fire} phase={i * 2.1} />
      ))}
    </>
  );
}

// ── Tab çubuğunun üstüne taşınan sahneler: kaldırma + zemin ─────────────────
// Silüetler alt kenara oturur; yüzen tab çubuğunun altında kalmasın diye katman
// SCENERY.lift (dp) kadar yukarı alınır ve altı sahneye uygun bir zeminle dolar.
// Zemin yalnızca görünür bandın üst kısmında ayrıntılıdır; altı tab çubuğuna girer.

function Band({ top, height, width, color, dark = 0.3 }) {
  return (
    <>
      <Rect x={-4} y={top} width={width + 8} height={height - top + 8} color={color} />
      <Rect x={-4} y={top} width={width + 8} height={height - top + 8}>
        <LinearGradient start={vec(0, top)} end={vec(0, height)} colors={["rgba(0,0,0,0)", `rgba(0,0,0,${dark})`]} />
      </Rect>
    </>
  );
}

// Sokak lambası: direk + kol; ışık halesi dışarıda Glow ile.
function lampPosts(xs, top, k, h = 52) {
  const p = Skia.Path.Make();
  xs.forEach((x) => {
    p.addRect(Skia.XYWHRect(x - 1.1 * k, top - (h - 34) * k, 2.2 * k, h * k));
    p.addRect(Skia.XYWHRect(x - 5 * k, top - (h - 34) * k, 10 * k, 2.4 * k));
    p.addRect(Skia.XYWHRect(x - 3 * k, top - (h - 34) * k + 2.4 * k, 6 * k, 3 * k));
  });
  return p;
}

function GroundDunes({ width, height, top, k, tone }) {
  const [mid, near, , moon] = tone.colors;
  const geo = useMemo(() => {
    const rip = Skia.Path.Make();
    for (let j = 0; j < 4; j += 1) {
      const y = top + (10 + j * 14) * k;
      rip.moveTo(-8, y);
      for (let x = 0; x <= width + 8; x += 7 * k) rip.lineTo(x, y + Math.sin(x * 0.045 + j * 2.1) * 1.8 * k);
    }
    const rocks = Skia.Path.Make();
    for (let i = 0; i < 6; i += 1) rocks.addOval(Skia.XYWHRect(width * hash01(i, 3.3), top + (8 + hash01(i, 5.7) * 40) * k, (5 + hash01(i, 8.1) * 8) * k, 3.4 * k));
    return { rip, rocks };
  }, [width, top, k]);
  return (
    <>
      <Band top={top} height={height} width={width} color={rgba(near, 1)} dark={0.35} />
      <Path path={geo.rip} style="stroke" strokeWidth={1 * k} color={rgba(moon, 0.28)} />
      <Path path={geo.rocks} color={rgba(mid, 0.9)} />
    </>
  );
}

function GroundGotham({ width, height, top, k, tone }) {
  const [front, , light] = tone.colors;
  const geo = useMemo(() => {
    const xs = [0.1, 0.4, 0.68, 0.94].map((f) => width * f);
    const walk = Skia.Path.Make();
    walk.addRect(Skia.XYWHRect(-4, top, width + 8, 6 * k));
    const lines = Skia.Path.Make();
    for (let x = 0; x < width; x += 38 * k) lines.addRect(Skia.XYWHRect(x, top + 40 * k, 20 * k, 2 * k));
    return { xs, walk, lines, posts: lampPosts(xs, top + 6 * k, k) };
  }, [width, top, k]);
  return (
    <>
      <Band top={top} height={height} width={width} color={rgba(front, 1)} dark={0.4} />
      <Path path={geo.walk} color={rgba(light, 0.14)} />
      <Path path={geo.lines} color={rgba(light, 0.22)} />
      <Path path={geo.posts} color="rgba(8,10,14,0.95)" />
      {geo.xs.map((x, i) => (
        <React.Fragment key={i}>
          <Glow cx={x} cy={top - 6 * k} r={34 * k} color={light} mid={0.28} />
          <Rect x={x - 10 * k} y={top + 6 * k} width={20 * k} height={46 * k}>
            <LinearGradient start={vec(0, top + 6 * k)} end={vec(0, top + 52 * k)} colors={[rgba(light, 0.2), rgba(light, 0)]} />
          </Rect>
        </React.Fragment>
      ))}
    </>
  );
}

function GroundSkyline({ width, height, top, k, tone }) {
  const [front, back, red, win] = tone.colors;
  const geo = useMemo(() => {
    const shops = Skia.Path.Make();
    const awn = Skia.Path.Make();
    for (let x = 8 * k; x < width - 14 * k; x += 26 * k) {
      shops.addRect(Skia.XYWHRect(x, top + 12 * k, 15 * k, 11 * k));
      awn.addRect(Skia.XYWHRect(x - 2 * k, top + 8 * k, 19 * k, 4 * k));
    }
    const lights = Skia.Path.Make();
    for (let i = 0; i < 9; i += 1) lights.addRect(Skia.XYWHRect(width * hash01(i, 1.7), top + (34 + hash01(i, 4.2) * 14) * k, (14 + hash01(i, 6.3) * 20) * k, 1.6 * k));
    return { shops, awn, lights };
  }, [width, top, k]);
  return (
    <>
      <Band top={top} height={height} width={width} color={rgba(front, 1)} dark={0.4} />
      <Rect x={-4} y={top} width={width + 8} height={30 * k} color={rgba(back, 0.9)} />
      <Path path={geo.shops} color={rgba(win, 0.7)} />
      <Path path={geo.awn} color={rgba(red, 0.85)} />
      <Path path={geo.lights} color={rgba(red, 0.55)} />
    </>
  );
}

function GroundMordor({ width, height, top, k, tone }) {
  const [stone, ridge, fire, core] = tone.colors;
  const geo = useMemo(() => {
    const spikes = Skia.Path.Make();
    for (let x = 0; x < width; x += 15 * k) {
      const h = (6 + hash01(Math.round(x), 2.2) * 22) * k;
      spikes.moveTo(x, top + 4 * k);
      spikes.lineTo(x + 5 * k, top - h + 4 * k);
      spikes.lineTo(x + 11 * k, top + 4 * k);
      spikes.close();
    }
    const cracks = Skia.Path.Make();
    for (let i = 0; i < 6; i += 1) {
      let x = width * (0.06 + i * 0.17 + hash01(i, 1.3) * 0.05);
      let y = top + 6 * k;
      cracks.moveTo(x, y);
      for (let j = 0; j < 4; j += 1) {
        x += (hash01(i * 9 + j, 2.9) - 0.5) * 30 * k;
        y += (8 + hash01(i * 7 + j, 3.7) * 12) * k;
        cracks.lineTo(x, y);
      }
    }
    return { spikes, cracks };
  }, [width, top, k]);
  return (
    <>
      <Band top={top} height={height} width={width} color={rgba(stone, 1)} dark={0.45} />
      <Path path={geo.spikes} color={rgba(stone, 1)} />
      <Path path={geo.cracks} style="stroke" strokeWidth={5 * k} strokeJoin="round" color={rgba(fire, 0.22)} />
      <Path path={geo.cracks} style="stroke" strokeWidth={1.8 * k} strokeJoin="round" strokeCap="round" color={rgba(core, 0.75)} />
      <Rect x={-4} y={top} width={width + 8} height={3 * k} color={rgba(ridge, 0.6)} />
    </>
  );
}

function GroundMesa({ width, height, top, k, tone }) {
  const [mid, near, far] = tone.colors;
  const geo = useMemo(() => {
    const cacti = Skia.Path.Make();
    [[0.12, 30], [0.5, 24], [0.82, 34]].forEach(([fx, h]) => {
      const x = width * fx;
      const w = 5 * k;
      const y = top + 34 * k;
      const rr = (rx, ry, rw, rh) => cacti.addRRect(Skia.RRectXY(Skia.XYWHRect(rx, ry, rw, rh), w / 2, w / 2));
      rr(x - w / 2, y - h * k, w, h * k);
      rr(x - w * 2.2, y - h * k * 0.62, w * 0.9, h * k * 0.34);
      cacti.addRect(Skia.XYWHRect(x - w * 2.2, y - h * k * 0.34, w * 1.7, w * 0.9));
      rr(x + w * 1.3, y - h * k * 0.78, w * 0.9, h * k * 0.34);
      cacti.addRect(Skia.XYWHRect(x + w * 0.5, y - h * k * 0.46, w * 1.7, w * 0.9));
    });
    const rocks = Skia.Path.Make();
    for (let i = 0; i < 9; i += 1) rocks.addOval(Skia.XYWHRect(width * hash01(i, 2.1), top + (10 + hash01(i, 7.7) * 46) * k, (5 + hash01(i, 9.9) * 9) * k, 4 * k));
    const road = Skia.Path.Make();
    road.moveTo(width * 0.34, top + 56 * k);
    road.quadTo(width * 0.55, top + 30 * k, width * 0.7, top + 8 * k);
    road.lineTo(width * 0.75, top + 8 * k);
    road.quadTo(width * 0.62, top + 34 * k, width * 0.5, top + 60 * k);
    road.close();
    return { cacti, rocks, road };
  }, [width, top, k]);
  return (
    <>
      <Band top={top} height={height} width={width} color={rgba(near, 1)} dark={0.35} />
      <Path path={geo.road} color={rgba(far, 0.5)} />
      <Path path={geo.rocks} color={rgba(mid, 0.9)} />
      <Path path={geo.cacti} color={rgba(far, 1)} />
    </>
  );
}

function GroundPrison({ width, height, top, k, tone }) {
  const [metal, , lamp, tower] = tone.colors;
  const geo = useMemo(() => {
    const gravel = Skia.Path.Make();
    for (let i = 0; i < 70; i += 1) gravel.addCircle(width * hash01(i, 1.1), top + (4 + hash01(i, 2.2) * 64) * k, (0.8 + hash01(i, 3.3) * 1.4) * k);
    const marks = Skia.Path.Make();
    for (let x = 0; x < width; x += 40 * k) marks.addRect(Skia.XYWHRect(x, top + 30 * k, 22 * k, 2.4 * k));
    const crates = Skia.Path.Make();
    [[0.2, 18], [0.27, 12], [0.7, 16]].forEach(([fx, s]) => crates.addRect(Skia.XYWHRect(width * fx, top + (22 - s) * k, s * k, s * k)));
    return { gravel, marks, crates };
  }, [width, top, k]);
  return (
    <>
      <Band top={top} height={height} width={width} color={rgba(tower, 1)} dark={0.4} />
      <Path path={geo.gravel} color={rgba(metal, 0.45)} />
      <Path path={geo.marks} color={rgba(lamp, 0.35)} />
      <Path path={geo.crates} color={rgba(metal, 0.85)} />
      <Rect x={-4} y={top} width={width + 8} height={3 * k} color={rgba(metal, 0.7)} />
    </>
  );
}

function GroundLondon({ width, height, top, k, tone }) {
  const [front, back, lamp] = tone.colors;
  const geo = useMemo(() => {
    const cobbles = Skia.Path.Make();
    for (let r = 0; r < 5; r += 1) {
      const y = top + (12 + r * 12) * k;
      for (let x = (r % 2) * 7 * k; x < width; x += 14 * k) cobbles.addOval(Skia.XYWHRect(x, y, 11 * k, 6 * k));
    }
    const xs = [0.14, 0.5, 0.86].map((f) => width * f);
    return { cobbles, xs, posts: lampPosts(xs, top + 4 * k, k, 56) };
  }, [width, top, k]);
  return (
    <>
      <Band top={top} height={height} width={width} color={rgba(front, 1)} dark={0.4} />
      <Rect x={-4} y={top} width={width + 8} height={5 * k} color={rgba(back, 0.9)} />
      <Path path={geo.cobbles} style="stroke" strokeWidth={0.8 * k} color={rgba(back, 0.75)} />
      <Path path={geo.posts} color="rgba(6,8,12,0.95)" />
      {geo.xs.map((x, i) => (
        <Glow key={i} cx={x} cy={top - 12 * k} r={30 * k} color={lamp} mid={0.3} />
      ))}
    </>
  );
}

function GroundPool({ width, height, top, k, tone }) {
  const [, deep, shine, leaf] = tone.colors;
  const geo = useMemo(() => {
    const tiles = Skia.Path.Make();
    for (let y = top + 10 * k; y < height; y += 14 * k) {
      tiles.moveTo(-4, y);
      tiles.lineTo(width + 4, y);
    }
    for (let x = 0; x < width; x += 30 * k) {
      tiles.moveTo(x, top);
      tiles.lineTo(x, height);
    }
    const shrubs = Skia.Path.Make();
    [0.08, 0.3, 0.7, 0.92].forEach((fx, i) => {
      const x = width * fx;
      shrubs.addCircle(x, top + 8 * k, (8 + (i % 2) * 3) * k);
      shrubs.addCircle(x + 7 * k, top + 12 * k, 6 * k);
    });
    return { tiles, shrubs };
  }, [width, height, top, k]);
  return (
    <>
      <Band top={top} height={height} width={width} color={rgba(shine, 0.38)} dark={0.25} />
      <Path path={geo.tiles} style="stroke" strokeWidth={0.8} color={rgba(deep, 0.35)} />
      <Path path={geo.shrubs} color={rgba(leaf, 0.95)} />
    </>
  );
}

function GroundTitan({ width, height, top, k, tone }) {
  const [face, low, edge, line] = tone.colors;
  const geo = useMemo(() => {
    const roofs = Skia.Path.Make();
    const walls = Skia.Path.Make();
    const rand = seededRandom(26);
    let x = -6 * k;
    while (x < width + 6 * k) {
      const w = (24 + rand() * 20) * k;
      const h = (16 + rand() * 14) * k;
      const y = top + 8 * k;
      walls.addRect(Skia.XYWHRect(x, y, w, 60 * k));
      roofs.moveTo(x - 2 * k, y + 1);
      roofs.lineTo(x + w / 2, y - h);
      roofs.lineTo(x + w + 2 * k, y + 1);
      roofs.close();
      x += w + (2 + rand() * 6) * k;
    }
    const win = Skia.Path.Make();
    for (let i = 0; i < 16; i += 1) win.addRect(Skia.XYWHRect(width * hash01(i, 4.4), top + (16 + hash01(i, 6.1) * 28) * k, 3 * k, 4.4 * k));
    return { roofs, walls, win };
  }, [width, top, k]);
  return (
    <>
      <Band top={top} height={height} width={width} color={rgba(low, 1)} dark={0.35} />
      <Path path={geo.walls} color={rgba(face, 0.9)} />
      <Path path={geo.win} color="rgba(255,214,128,0.75)" />
      <Path path={geo.roofs} color={rgba("#7a3a2e", 1)} />
      <Path path={geo.roofs} style="stroke" strokeWidth={1} color={rgba(line, 0.7)} />
      <Rect x={-4} y={top - 1} width={width + 8} height={2.4 * k} color={rgba(edge, 0.8)} />
    </>
  );
}

function liftedLayer(Layer, Ground) {
  return function Lifted(props) {
    const { width, height, tone } = props;
    const k = sceneScale(width, height);
    const lift = SCENERY.lift * k;
    const transform = useMemo(() => [{ translateY: -lift }], [lift]);
    return (
      <>
        <Group transform={transform}>
          <Layer {...props} />
        </Group>
        <Group opacity={Math.min(1, tone.alpha * 1.15)}>
          <Ground width={width} height={height} top={height - lift + 1} k={k} tone={tone} />
        </Group>
      </>
    );
  };
}

// ── 32 · Star Wars: Ölüm Yıldızı, gezegen, süperlazer ışını ve patlama ──────
// Hepsi vektör (büyütülünce bulanmaz). Zaman çizelgesi swScene ile aynı 72 sn
// (swFrame): Ölüm Yıldızı gelir → dişli yeşil şarj olur → ışın gezegene değer,
// çatlaklar parlar → gezegen patlar (tek yumuşak parlama, halkalar, ışınlar, moloz).
const smoothStep = (a, b, x) => {
  "worklet";
  const v = (x - a) / (b - a);
  const c = v < 0 ? 0 : v > 1 ? 1 : v;
  return c * c * (3 - 2 * c);
};

const easeOut = (x) => {
  "worklet";
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return 1 - (1 - c) * (1 - c) * (1 - c);
};

function ChargeRing({ f, cx, cy, R, color, i }) {
  const r = useDerivedValue(() => {
    const ph = (f.value.charge * 3.2 + i / 3) % 1;
    return (1 - ph) * R * 0.95 + 2;
  });
  const opacity = useDerivedValue(() => {
    const ph = (f.value.charge * 3.2 + i / 3) % 1;
    return f.value.charge > 0.01 ? Math.sin(ph * 3.14159) * 0.7 * f.value.charge : 0;
  });
  return <Circle cx={cx} cy={cy} r={r} style="stroke" strokeWidth={1.6} color={color} opacity={opacity} />;
}

function Chunk({ d, f }) {
  const { x, y, vx, vy, rot, delay } = d;
  const transform = useDerivedValue(() => {
    const q = (f.value.b - delay) > 0 ? easeOut((f.value.b - delay) / (1 - delay)) : 0;
    return [{ translateX: x + vx * q }, { translateY: y + vy * q }, { rotate: rot * q * 5 }];
  });
  const opacity = useDerivedValue(() => (f.value.blast ? Math.max(0, 1 - f.value.b * 1.05) : 0));
  return (
    <Group transform={transform}>
      <Path path={d.path} color={d.color} opacity={opacity} />
    </Group>
  );
}

// Millennium Falcon (VEKTÖR, 100 birimlik kutu, burun SAĞDA; ekranda -90° döndürülür → burun yukarı).
const FAL_BODY = "M20 38 C16 44 16 56 20 62 C30 78 56 80 68 66 L70 62 L70 38 L68 34 C56 20 30 22 20 38 Z";
const FAL_MAND_U = "M60 27 L97 39.5 L97 46.5 L72 45 L60 40 Z";
const FAL_MAND_L = "M60 73 L97 60.5 L97 53.5 L72 55 L60 60 Z";
const FAL_TUBE = "M50 67 L82 74 L82 83 L52 79 Z";

function FalconArt({ hull, engine }) {
  const clip = useMemo(() => Skia.Path.MakeFromSVGString(FAL_BODY), []);
  const geo = useMemo(() => {
    const panels = Skia.Path.Make();
    const lightP = Skia.Path.Make();
    const darkP = Skia.Path.Make();
    for (let i = 0; i < 46; i += 1) {
      const a = hash01(i, 1.9) * 6.2832;
      const r = 8 + hash01(i, 2.3) * 24;
      const x = 44 + Math.cos(a) * r;
      const y = 50 + Math.sin(a) * r;
      const w = 2 + hash01(i, 3.1) * 5;
      const h = 1.6 + hash01(i, 4.7) * 3.4;
      (i % 3 ? darkP : lightP).addRect(Skia.XYWHRect(x, y, w, h));
      if (i % 4 === 0) panels.addRect(Skia.XYWHRect(x - 1, y - 1, w + 2, h + 2));
    }
    const spokes = Skia.Path.Make();
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * 6.2832;
      spokes.moveTo(44 + Math.cos(a) * 11, 50 + Math.sin(a) * 11);
      spokes.lineTo(44 + Math.cos(a) * 30, 50 + Math.sin(a) * 30);
    }
    const vents = Skia.Path.Make();
    for (let i = 0; i < 7; i += 1) vents.addRect(Skia.XYWHRect(13.4, 40.5 + i * 2.9, 3.2, 1.7));
    const mandLines = Skia.Path.Make();
    for (let i = 0; i < 6; i += 1) {
      const x = 66 + i * 5.2;
      mandLines.moveTo(x, 29.5 + i * 1.7);
      mandLines.lineTo(x + 0.4, 43.5);
      mandLines.moveTo(x, 70.5 - i * 1.7);
      mandLines.lineTo(x + 0.4, 56.5);
    }
    return { panels, lightP, darkP, spokes, vents, mandLines };
  }, []);
  return (
    <>
      {/* kıç motor ışıltısı */}
      <Group opacity={engine}>
        <Rect x={4} y={36} width={12} height={28}>
          <LinearGradient start={vec(4, 0)} end={vec(16, 0)} colors={["rgba(120,190,255,0)", "rgba(150,210,255,0.9)"]} />
        </Rect>
      </Group>
      {/* kokpit tüpü */}
      <Path path={FAL_TUBE}>
        <LinearGradient start={vec(0, 66)} end={vec(0, 83)} colors={["#d3d8de", "#7b838d"]} />
      </Path>
      <Path path="M52 69 L80 75.5 M53 74 L81 79.5" style="stroke" strokeWidth={0.6} color="rgba(50,58,68,0.6)" />
      <Path path="M82 72.5 C90 73 93 78 91 83.5 L82 84 Z" color="#8f97a1" />
      <Path path="M84 75 L90 76.5 L89.6 81.4 L84 80 Z">
        <LinearGradient start={vec(84, 75)} end={vec(90, 81)} colors={["#9fd6ff", "#1f3b57"]} />
      </Path>
      <Path path="M82 72.5 C90 73 93 78 91 83.5" style="stroke" strokeWidth={0.8} color="#4a515b" />
      {/* çatal burun: iki mandible */}
      <Path path={FAL_MAND_U}>
        <LinearGradient start={vec(60, 27)} end={vec(97, 46)} colors={["#e3e7eb", "#9aa2ac"]} />
      </Path>
      <Path path={FAL_MAND_L}>
        <LinearGradient start={vec(60, 73)} end={vec(97, 54)} colors={["#c3c9d0", "#8a929c"]} />
      </Path>
      <Path path={geo.mandLines} style="stroke" strokeWidth={0.5} color="rgba(50,58,68,0.55)" />
      <Path path="M60 27 L97 39.5 M60 73 L97 60.5" style="stroke" strokeWidth={0.9} color="#f5f6f8" />
      <Path path="M97 39.5 L97 46.5 M97 60.5 L97 53.5" style="stroke" strokeWidth={1.4} color="#5a616b" />
      <Path path="M72 45 L86 46.4 L86 53.6 L72 55 Z" color="#3a4048" />
      <Circle cx={95} cy={43} r={0.9} color="#ff8a5a" />
      <Circle cx={95} cy={57} r={0.9} color="#ff8a5a" />
      {/* disk gövde */}
      <Path path={FAL_BODY}>
        <RadialGradient c={vec(36, 34)} r={58} colors={[hull[0], hull[1], hull[2]]} positions={[0, 0.55, 1]} />
      </Path>
      {clip ? (
        <Group clip={clip}>
          <Path path={geo.darkP} color="rgba(48,56,66,0.42)" />
          <Path path={geo.lightP} color="rgba(255,255,255,0.4)" />
          <Path path={geo.panels} style="stroke" strokeWidth={0.4} color="rgba(40,46,56,0.55)" />
          <Path path={geo.spokes} style="stroke" strokeWidth={0.6} color="rgba(50,58,68,0.55)" />
          <Circle cx={44} cy={50} r={30} style="stroke" strokeWidth={0.9} color="rgba(50,58,68,0.6)" />
          <Circle cx={44} cy={50} r={22} style="stroke" strokeWidth={0.7} color="rgba(50,58,68,0.5)" />
          <Circle cx={44} cy={50} r={14} style="stroke" strokeWidth={0.7} color="rgba(50,58,68,0.5)" />
          <Rect x={12} y={34} width={9} height={32} color="rgba(30,36,44,0.55)" />
          <Circle cx={44} cy={50} r={46}>
            <RadialGradient c={vec(62, 66)} r={44} colors={["rgba(10,14,22,0.5)", "rgba(10,14,22,0)"]} positions={[0.1, 1]} />
          </Circle>
        </Group>
      ) : null}
      <Path path={FAL_BODY} style="stroke" strokeWidth={1.3} strokeJoin="round" color="#59616b" />
      <Path path="M20 38 C30 22 56 20 68 34" style="stroke" strokeWidth={0.9} strokeCap="round" color="rgba(255,255,255,0.7)" />
      {/* radar çanağı */}
      <Circle cx={33} cy={35} r={7.8} color="#7a828c" />
      <Circle cx={33} cy={35} r={7.8} style="stroke" strokeWidth={1.1} color="#454c55" />
      <Circle cx={33} cy={35} r={5.2} style="stroke" strokeWidth={0.7} color="#cdd4db" />
      <Circle cx={33} cy={35} r={2.6} style="stroke" strokeWidth={0.6} color="#2e343b" />
      <Circle cx={33} cy={35} r={1.1} color="#1f2429" />
      <Path path="M33 35 L39.4 29.4 M33 35 L39 36 M33 35 L30 29.5" style="stroke" strokeWidth={0.8} color="#2e343b" />
      {/* torete kuleleri */}
      <Circle cx={50} cy={60} r={4.4} color="#dde1e5" />
      <Circle cx={50} cy={60} r={4.4} style="stroke" strokeWidth={0.8} color="#454c55" />
      <Circle cx={50} cy={60} r={1.5} color="#33475b" />
      <Path path="M50 60 L58 63" style="stroke" strokeWidth={0.9} strokeCap="round" color="#454c55" />
      <Circle cx={46} cy={40} r={3.6} color="#dde1e5" />
      <Circle cx={46} cy={40} r={3.6} style="stroke" strokeWidth={0.7} color="#454c55" />
      <Path path="M46 40 L53 37.5" style="stroke" strokeWidth={0.8} strokeCap="round" color="#454c55" />
      {/* merkez kubbe */}
      <Circle cx={44} cy={50} r={6.6} color="#eceef0" />
      <Circle cx={44} cy={50} r={6.6} style="stroke" strokeWidth={0.8} color="#454c55" />
      <Circle cx={44} cy={50} r={2.6} color="#9aa3ad" />
      {/* kıç: havalandırmalar */}
      <Rect x={13} y={39.5} width={4.4} height={21} color="#2a3037" />
      <Path path={geo.vents} color="#9fd2ff" />
    </>
  );
}

function StarWarsFx({ p, clock, width, height, tone }) {
  const k = sceneScale(width, height);
  const [sea, land, beamC, fireC, dsC] = tone.colors;
  const geo = useMemo(() => {
    const R = 56 * k;
    const dcx = width * 0.78;
    const dcy = height * 0.2;
    const dish = [dcx - R * 0.32, dcy - R * 0.34];
    const dishR = R * 0.2;
    const Rp = 42 * k;
    const pcx = width * 0.24;
    const pcy = height * 0.36;
    // ışın: dişliden gezegen yüzeyine
    const dx = pcx - dish[0];
    const dy = pcy - dish[1];
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    const hit = [pcx - ux * Rp * 0.96, pcy - uy * Rp * 0.96];
    const beam = Skia.Path.Make();
    beam.moveTo(dish[0], dish[1]);
    beam.lineTo(hit[0], hit[1]);
    // Ölüm Yıldızı yüzeyi: panel çizgileri, ışıklar, ekvator hendeği
    const rand = seededRandom(32);
    const dsLines = Skia.Path.Make();
    const dsLit = Skia.Path.Make();
    for (let i = 0; i < 26; i += 1) {
      const a = rand() * 6.283;
      const r1 = R * (0.25 + rand() * 0.7);
      const x = dcx + Math.cos(a) * r1;
      const y = dcy + Math.sin(a) * r1;
      const l = (6 + rand() * 18) * k;
      const horiz = rand() < 0.55;
      dsLines.moveTo(x, y);
      dsLines.lineTo(horiz ? x + l : x, horiz ? y : y + l);
    }
    for (let i = 0; i < 60; i += 1) {
      const a = rand() * 6.283;
      const r1 = R * Math.sqrt(rand()) * 0.94;
      dsLit.addCircle(dcx + Math.cos(a) * r1, dcy + Math.sin(a) * r1, 0.55 * k);
    }
    const dsClip = Skia.Path.Make();
    dsClip.addCircle(dcx, dcy, R);
    // gezegen: kıtalar, bulutlar
    const lands = Skia.Path.Make();
    [[-0.3, -0.2, 0.34], [0.25, 0.1, 0.4], [-0.1, 0.45, 0.26], [0.4, -0.35, 0.2]].forEach(([ox, oy, s], i) => {
      const cx = pcx + ox * Rp;
      const cy = pcy + oy * Rp;
      lands.moveTo(cx - s * Rp, cy);
      for (let j = 0; j <= 10; j += 1) {
        const a = Math.PI + (j / 10) * Math.PI * 2;
        const rr = s * Rp * (0.7 + 0.5 * hash01(i * 11 + j, 3.3));
        lands.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.75);
      }
      lands.close();
    });
    const clouds = Skia.Path.Make();
    for (let j = 0; j < 7; j += 1) {
      const y = pcy - Rp * 0.8 + j * Rp * 0.26;
      clouds.moveTo(pcx - Rp, y);
      clouds.cubicTo(pcx - Rp * 0.4, y - 6 * k, pcx + Rp * 0.3, y + 6 * k, pcx + Rp, y - 2 * k);
    }
    const plClip = Skia.Path.Make();
    plClip.addCircle(pcx, pcy, Rp);
    // çatlaklar (çarpma noktasından)
    const cracks = Skia.Path.Make();
    for (let i = 0; i < 9; i += 1) {
      const a = Math.atan2(-uy, -ux) + (i - 4) * 0.33 + (hash01(i, 8.1) - 0.5) * 0.3;
      let x = hit[0];
      let y = hit[1];
      cracks.moveTo(x, y);
      const steps = 4 + (i % 3);
      for (let s = 1; s <= steps; s += 1) {
        x += Math.cos(a + (hash01(i * 7 + s, 2.9) - 0.5) * 0.7) * Rp * 0.34;
        y += Math.sin(a + (hash01(i * 7 + s, 2.9) - 0.5) * 0.7) * Rp * 0.34;
        cracks.lineTo(x, y);
      }
    }
    // patlama ışınları
    const spikes = Skia.Path.Make();
    for (let i = 0; i < 28; i += 1) {
      const a = (i / 28) * 6.2832 + hash01(i, 5.5) * 0.2;
      const r0 = Rp * 0.9;
      const r1 = Rp * (1.5 + hash01(i, 6.6) * 1.1);
      const w = 0.05 + hash01(i, 7.7) * 0.05;
      spikes.moveTo(pcx + Math.cos(a - w) * r0, pcy + Math.sin(a - w) * r0);
      spikes.lineTo(pcx + Math.cos(a) * r1, pcy + Math.sin(a) * r1);
      spikes.lineTo(pcx + Math.cos(a + w) * r0, pcy + Math.sin(a + w) * r0);
      spikes.close();
    }
    // moloz parçaları
    const chunks = [];
    for (let i = 0; i < 18; i += 1) {
      const a = hash01(i, 1.4) * 6.2832;
      const dist = (70 + hash01(i, 2.6) * 150) * k;
      const w = (2.5 + hash01(i, 3.6) * 5) * k;
      const path = Skia.Path.Make();
      path.moveTo(-w, -w * 0.4);
      path.lineTo(w * 0.5, -w);
      path.lineTo(w, w * 0.3);
      path.lineTo(-w * 0.3, w);
      path.close();
      chunks.push({
        path, x: pcx + Math.cos(a) * Rp * 0.5, y: pcy + Math.sin(a) * Rp * 0.5,
        vx: Math.cos(a) * dist, vy: Math.sin(a) * dist, rot: (hash01(i, 4.9) - 0.5) * 2, delay: hash01(i, 5.2) * 0.12,
        color: i % 3 ? "rgba(130,150,170,0.95)" : "rgba(255,170,90,0.95)",
      });
    }
    return {
      R, dcx, dcy, dish, dishR, Rp, pcx, pcy, hit, beam, dsLines, dsLit, dsClip, lands, clouds, plClip, cracks, spikes, chunks,
    };
  }, [width, height, k]);

  const f = useDerivedValue(() => swFrame(p, clock.value));
  const FS = 190 * k; // Falcon kutusu (uzun kenar ≈ 0,83 × FS)
  const falconT = useDerivedValue(() => [
    { translateX: width * 0.5 + Math.sin(clock.value * 0.7) * 1.6 * k },
    { translateY: f.value.fy * height + Math.sin(clock.value * 0.9) * 1.8 * k },
    { rotate: -Math.PI / 2 },
    { scale: (FS / 100) * f.value.fs },
    { translateX: -46 },
    { translateY: -50 },
  ]);
  const falconO = useDerivedValue(() => f.value.fv);
  const engineO = useDerivedValue(() => 0.75 + 0.25 * Math.sin(clock.value * 3.1));
  const dsT = useDerivedValue(() => [
    { translateX: f.value.slide * width * 0.14 + Math.sin(clock.value * 0.2) * 1.5 * k },
    { translateY: -f.value.slide * 8 * k + Math.cos(clock.value * 0.17) * 1.2 * k },
  ]);
  const dsOpacity = useDerivedValue(() => f.value.ds);
  const plOpacity = useDerivedValue(() => f.value.planet);
  const chargeOpacity = useDerivedValue(() => f.value.charge);
  const beamEnd = useDerivedValue(() => f.value.grow);
  const beamOpacity = useDerivedValue(() => f.value.beam);
  const impactOpacity = useDerivedValue(() => f.value.impact);
  const crackOpacity = useDerivedValue(() => f.value.impact * 0.95);
  const fireT = useDerivedValue(() => [
    { translateX: geo.pcx }, { translateY: geo.pcy }, { scale: 0.45 + 3.1 * easeOut(f.value.b) },
  ]);
  const fireOpacity = useDerivedValue(() => (f.value.blast ? Math.min(1, f.value.b * 14) * (1 - smoothStep(0.12, 0.7, f.value.b)) * 0.95 : 0));
  const ring1T = useDerivedValue(() => [{ translateX: geo.pcx }, { translateY: geo.pcy }, { scale: 0.7 + 5.2 * easeOut(f.value.b) }]);
  const ring1O = useDerivedValue(() => (f.value.blast ? (1 - f.value.b) * (1 - f.value.b) * 0.85 : 0));
  const ring2T = useDerivedValue(() => [{ translateX: geo.pcx }, { translateY: geo.pcy }, { scale: 0.5 + 3.6 * easeOut(Math.max(0, f.value.b - 0.06) / 0.94) }]);
  const ring2O = useDerivedValue(() => (f.value.blast ? (1 - f.value.b) * 0.55 : 0));
  const spikeT = useDerivedValue(() => {
    const s = 0.8 + 2.4 * easeOut(f.value.b);
    return [{ translateX: geo.pcx }, { translateY: geo.pcy }, { scale: s }, { translateX: -geo.pcx }, { translateY: -geo.pcy }];
  });
  const spikeO = useDerivedValue(() => (f.value.blast ? (1 - smoothStep(0, 0.45, f.value.b)) * 0.9 : 0));
  const ambientO = useDerivedValue(() => (f.value.blast ? Math.min(1, f.value.b * 10) * (1 - f.value.b) * 0.5 : 0));
  const { R, dcx, dcy, dish, dishR, Rp, pcx, pcy, hit } = geo;
  const lineW = (w) => w * k;
  return (
    <>
      {/* Millennium Falcon: alttan burnu yukarı */}
      <Group opacity={falconO} transform={falconT}>
        <FalconArt hull={tone.colors[5]} engine={engineO} />
      </Group>

      {/* Ölüm Yıldızı */}
      <Group opacity={dsOpacity} transform={dsT}>
        <Circle cx={dcx} cy={dcy} r={R * 1.12}>
          <RadialGradient c={vec(dcx, dcy)} r={R * 1.12} colors={[rgba(dsC, 0), rgba(dsC, 0.18), rgba(dsC, 0)]} positions={[0.82, 0.92, 1]} />
        </Circle>
        <Circle cx={dcx} cy={dcy} r={R}>
          <RadialGradient c={vec(dcx - R * 0.35, dcy - R * 0.4)} r={R * 1.6} colors={["#e6e9ed", "#a9afb7", "#636a73", "#2c3138"]} positions={[0, 0.42, 0.78, 1]} />
        </Circle>
        <Group clip={geo.dsClip}>
          <Path path={geo.dsLines} style="stroke" strokeWidth={0.9 * k} color="rgba(60,66,76,0.55)" />
          <Rect x={dcx - R} y={dcy + R * 0.02} width={R * 2} height={R * 0.05} color="rgba(30,34,40,0.85)" />
          <Rect x={dcx - R} y={dcy + R * 0.07} width={R * 2} height={R * 0.012} color="rgba(220,226,234,0.55)" />
          <Rect x={dcx - R} y={dcy - R * 0.012} width={R * 2} height={R * 0.012} color="rgba(220,226,234,0.4)" />
          <Path path={geo.dsLit} color="rgba(255,236,170,0.8)" />
          <Circle cx={dcx} cy={dcy} r={R}>
            <RadialGradient c={vec(dcx + R * 0.45, dcy + R * 0.5)} r={R * 1.15} colors={["rgba(0,0,10,0.55)", "rgba(0,0,10,0)"]} positions={[0.15, 1]} />
          </Circle>
        </Group>
        {/* süperlazer dişlisi */}
        <Circle cx={dish[0]} cy={dish[1]} r={dishR}>
          <RadialGradient c={vec(dish[0] + dishR * 0.2, dish[1] + dishR * 0.2)} r={dishR} colors={["#2a2f36", "#5b626b", "#8a9099"]} positions={[0, 0.6, 1]} />
        </Circle>
        <Circle cx={dish[0]} cy={dish[1]} r={dishR} style="stroke" strokeWidth={1.2 * k} color="#40454d" />
        <Circle cx={dish[0]} cy={dish[1]} r={dishR * 0.62} style="stroke" strokeWidth={0.8 * k} color="rgba(30,34,40,0.8)" />
        <Circle cx={dish[0]} cy={dish[1]} r={dishR * 0.26} color="#1f2328" />
        <Group opacity={chargeOpacity}>
          <Glow cx={dish[0]} cy={dish[1]} r={dishR * 2.6} color={beamC} mid={0.4} />
          <Circle cx={dish[0]} cy={dish[1]} r={dishR * 0.5} color={rgba(beamC, 0.95)} />
          <Circle cx={dish[0]} cy={dish[1]} r={dishR * 0.25} color="rgba(240,255,240,1)" />
          {[0, 1, 2].map((i) => (
            <ChargeRing key={i} f={f} cx={dish[0]} cy={dish[1]} R={R * 0.55} color={beamC} i={i} />
          ))}
        </Group>
      </Group>

      {/* ışın */}
      <Group opacity={beamOpacity}>
        <Path path={geo.beam} style="stroke" strokeWidth={lineW(34)} strokeCap="round" color={rgba(beamC, 0.1)} start={0} end={beamEnd} />
        <Path path={geo.beam} style="stroke" strokeWidth={lineW(20)} strokeCap="round" color={rgba(beamC, 0.2)} start={0} end={beamEnd} />
        <Path path={geo.beam} style="stroke" strokeWidth={lineW(11)} strokeCap="round" color={rgba(beamC, 0.5)} start={0} end={beamEnd} />
        <Path path={geo.beam} style="stroke" strokeWidth={lineW(4.4)} strokeCap="round" color="rgba(236,255,238,0.98)" start={0} end={beamEnd} />
      </Group>

      {/* gezegen */}
      <Group opacity={plOpacity}>
        <Circle cx={pcx} cy={pcy} r={Rp * 1.18}>
          <RadialGradient c={vec(pcx, pcy)} r={Rp * 1.18} colors={[rgba(sea, 0), rgba(sea, 0.35), rgba(sea, 0)]} positions={[0.78, 0.9, 1]} />
        </Circle>
        <Circle cx={pcx} cy={pcy} r={Rp}>
          <RadialGradient c={vec(pcx - Rp * 0.35, pcy - Rp * 0.35)} r={Rp * 1.5} colors={[rgba(sea, 1), "#1d4f8a", "#0e2a4d"]} positions={[0, 0.6, 1]} />
        </Circle>
        <Group clip={geo.plClip}>
          <Path path={geo.lands} color={rgba(land, 0.95)} />
          <Path path={geo.clouds} style="stroke" strokeWidth={3 * k} strokeCap="round" color="rgba(255,255,255,0.4)" />
          <Circle cx={pcx} cy={pcy} r={Rp}>
            <RadialGradient c={vec(pcx + Rp * 0.5, pcy + Rp * 0.5)} r={Rp * 1.3} colors={["rgba(0,0,12,0.7)", "rgba(0,0,12,0)"]} positions={[0.1, 1]} />
          </Circle>
          <Group opacity={crackOpacity}>
            <Path path={geo.cracks} style="stroke" strokeWidth={5 * k} strokeJoin="round" color={rgba(beamC, 0.35)} />
            <Path path={geo.cracks} style="stroke" strokeWidth={1.6 * k} strokeJoin="round" strokeCap="round" color="rgba(255,250,220,0.98)" />
          </Group>
        </Group>
        <Group opacity={impactOpacity}>
          <Glow cx={hit[0]} cy={hit[1]} r={Rp * 0.9} color={beamC} mid={0.4} />
          <Glow cx={hit[0]} cy={hit[1]} r={Rp * 0.4} color="#ffffff" mid={0.5} />
        </Group>
      </Group>

      {/* patlama */}
      <Group opacity={ambientO}>
        <Glow cx={pcx} cy={pcy} r={Rp * 5} color={fireC} mid={0.18} />
      </Group>
      <Group opacity={spikeO}>
        <Group transform={spikeT}>
          <Path path={geo.spikes} color={rgba(fireC, 0.9)} />
        </Group>
      </Group>
      <Group opacity={fireOpacity} transform={fireT}>
        <Circle cx={0} cy={0} r={Rp}>
          <RadialGradient c={vec(0, 0)} r={Rp} colors={["rgba(255,255,255,1)", "rgba(255,244,200,0.95)", rgba(fireC, 0.8), "rgba(200,60,10,0.35)", "rgba(120,20,0,0)"]} positions={[0, 0.25, 0.55, 0.85, 1]} />
        </Circle>
      </Group>
      <Group opacity={ring1O} transform={ring1T}>
        <Circle cx={0} cy={0} r={Rp} style="stroke" strokeWidth={5 * k} color="rgba(255,236,200,0.85)" />
        <Circle cx={0} cy={0} r={Rp} style="stroke" strokeWidth={12 * k} color="rgba(255,170,90,0.22)" />
      </Group>
      <Group opacity={ring2O} transform={ring2T}>
        <Circle cx={0} cy={0} r={Rp} style="stroke" strokeWidth={2.4 * k} color="rgba(255,255,255,0.75)" />
      </Group>
      {geo.chunks.map((d, i) => (
        <Chunk key={i} d={d} f={f} />
      ))}
    </>
  );
}


// ── 33 · Harry Potter: Hogwarts şatosu (arka planda), göl ve ay ───────────────
// Kule ve çatılar silüet; pencereler yavaşça, birbirinden bağımsız nefes alır (çakma yok).
const HOG_WIN = 36;

function HogWindows({ path, ph, color, f }) {
  const o = useDerivedValue(() => 0.55 + 0.4 * Math.sin(f.value.u * 90 + ph) * Math.sin(f.value.u * 37 + ph * 2.3));
  return <Path path={path} color={rgba(color, 0.95)} opacity={o} />;
}

function Hogwarts({ p, clock, width, height, tone }) {
  const k = sceneScale(width, height);
  const f = useDerivedValue(() => ({ u: clock.value / 60 }));
  const geo = useMemo(() => {
    const base = height; // lift'li grupta taban = height
    const castle = Skia.Path.Make();
    const roofs = Skia.Path.Make();
    const wins = [];
    const tower = (cx, w, h, roofH, flare = 0) => {
      castle.addRect(Skia.XYWHRect(cx - w / 2, base - h, w, h + 2));
      castle.addRect(Skia.XYWHRect(cx - w / 2 - 2 * k, base - h, w + 4 * k, 4 * k));
      roofs.moveTo(cx - w / 2 - 3 * k, base - h);
      roofs.lineTo(cx + flare, base - h - roofH);
      roofs.lineTo(cx + w / 2 + 3 * k, base - h);
      roofs.close();
      for (let j = 0; j < Math.floor(h / (22 * k)); j += 1) {
        if (hash01(Math.round(cx) + j, 7.7) > 0.45) wins.push([cx - 1.6 * k, base - h + (10 + j * 20) * k, 3.2 * k, 5.4 * k, hash01(Math.round(cx) + j, 3.1) * 6]);
      }
    };
    const W = width;
    // ana gövde ve büyük salon
    castle.addRect(Skia.XYWHRect(W * 0.3, base - 54 * k, W * 0.5, 56 * k));
    castle.addRect(Skia.XYWHRect(W * 0.42, base - 78 * k, W * 0.22, 26 * k));
    roofs.moveTo(W * 0.42 - 4 * k, base - 78 * k);
    roofs.lineTo(W * 0.53, base - 100 * k);
    roofs.lineTo(W * 0.64 + 4 * k, base - 78 * k);
    roofs.close();
    for (let i = 0; i < 9; i += 1) {
      wins.push([W * 0.32 + i * (W * 0.046), base - 44 * k, 3.4 * k, 6.4 * k, hash01(i, 2.2) * 6]);
    }
    // kuleler: [x oranı, genişlik, yükseklik, çatı, eğim]
    [[0.27, 16, 108, 40, 0], [0.34, 12, 140, 52, 3], [0.46, 14, 168, 60, 0], [0.57, 18, 124, 46, -3], [0.68, 12, 150, 56, 2],
      [0.77, 16, 104, 38, 0], [0.84, 11, 126, 44, 0], [0.22, 10, 80, 30, 0]].forEach(([fx, w, h, r, fl]) =>
      tower(W * fx, w * k, h * k, r * k, fl * k));
    // köprü ve kemerler
    const bridge = Skia.Path.Make();
    bridge.addRect(Skia.XYWHRect(W * 0.8, base - 34 * k, W * 0.2, 5 * k));
    for (let i = 0; i < 4; i += 1) {
      bridge.addRect(Skia.XYWHRect(W * 0.82 + i * W * 0.045, base - 30 * k, 3 * k, 30 * k));
    }
    // uzak tepeler
    const hills = [];
    for (let x = -10; x <= W + 10; x += 12 * k) hills.push([x, base - (34 + 14 * Math.sin(x / W * 5 + 1) + 8 * Math.sin(x / W * 13)) * k]);
    const winPaths = [0, 1, 2, 3].map(() => Skia.Path.Make());
    wins.slice(0, HOG_WIN * 3).forEach(([x, y, w, h], i) => winPaths[i % 4].addRect(Skia.XYWHRect(x, y, w, h)));
    return { castle, roofs, winPaths, bridge, hills: silhouette(hills, base + 40) };
  }, [width, height, k]);
  const [stone, hill, lamp, , moon] = tone.colors;
  return (
    <>
      <Group opacity={Math.min(1, tone.alpha * 1.2)}>
        <Circle cx={width * 0.18} cy={height * 0.14} r={20 * k} color={rgba(moon, 0.5)} />
        <Circle cx={width * 0.18} cy={height * 0.14} r={46 * k}>
          <RadialGradient c={vec(width * 0.18, height * 0.14)} r={46 * k} colors={[rgba(moon, 0.25), rgba(moon, 0)]} />
        </Circle>
      </Group>
      <Group opacity={tone.alpha}>
        <Path path={geo.hills} color={rgba(hill, 0.9)} />
      </Group>
      {/* şato küçültüldü: tabanda ve ekranın sağ yarısına doğru ölçeklenir */}
      <Group opacity={tone.alpha} transform={[{ translateX: width * 0.58 }, { translateY: height }, { scale: 0.66 }, { translateX: -width * 0.58 }, { translateY: -height }]}>
        <Path path={geo.castle} color={rgba(stone, 1)} />
        <Path path={geo.bridge} color={rgba(stone, 1)} />
        <Path path={geo.roofs} color={rgba(stone, 1)} />
        <Path path={geo.roofs} color="rgba(30,40,70,0.35)" />
        {geo.winPaths.map((wp, i) => (
          <HogWindows key={i} path={wp} ph={i * 1.7} color={lamp} f={f} />
        ))}
      </Group>
    </>
  );
}

function GroundHogwarts({ width, height, top, k, tone }) {
  const [stone, hill, lamp, lake, moon] = tone.colors;
  const geo = useMemo(() => {
    const streaks = Skia.Path.Make();
    for (let i = 0; i < 18; i += 1) {
      const x = width * (0.22 + hash01(i, 1.7) * 0.6);
      const y = top + (6 + hash01(i, 2.9) * 40) * k;
      streaks.addRect(Skia.XYWHRect(x, y, 2 * k, (3 + hash01(i, 5.5) * 7) * k));
    }
    const wave = Skia.Path.Make();
    for (let j = 0; j < 4; j += 1) {
      const y = top + (12 + j * 14) * k;
      wave.moveTo(-8, y);
      for (let x = 0; x <= width + 8; x += 8 * k) wave.lineTo(x, y + Math.sin(x * 0.05 + j * 1.9) * 1.2 * k);
    }
    return { streaks, wave };
  }, [width, top, k]);
  return (
    <>
      <Rect x={-4} y={top} width={width + 8} height={height - top + 8}>
        <LinearGradient start={vec(0, top)} end={vec(0, height)} colors={[rgba(lake, 1), rgba(hill, 1)]} />
      </Rect>
      <Path path={geo.wave} style="stroke" strokeWidth={0.9 * k} color={rgba(moon, 0.3)} />
      <Path path={geo.streaks} color={rgba(lamp, 0.55)} />
      <Rect x={-4} y={top} width={width + 8} height={3 * k} color={rgba(stone, 1)} />
    </>
  );
}

// ── 34 · One Piece: aslan başlı yelkenli (VEKTÖR) ────────────────────────────
const OP_HULL = "M4 62 C10 78 34 84 56 84 C78 84 92 76 97 56 C84 66 66 70 50 70 C34 70 16 68 4 62 Z";

function OpShipArt() {
  const sailA = useMemo(() => Skia.Path.MakeFromSVGString("M24 14 C34 20 56 20 64 14 L62 52 C52 57 36 57 26 52 Z"), []);
  return (
    <>
      <Path path="M30 8 L82 56 M30 8 L6 62 M70 18 L92 54" style="stroke" strokeWidth={0.6} color="rgba(40,26,14,0.6)" />
      <Rect x={43.6} y={6} width={2.8} height={66} color="#5a3a1c" />
      <Rect x={71} y={22} width={2.4} height={50} color="#5a3a1c" />
      {/* büyük yelken */}
      <Path path="M24 14 C34 20 56 20 64 14 L62 52 C52 57 36 57 26 52 Z" color="#fbf6ea" />
      {sailA ? (
        <Group clip={sailA}>
          <Rect x={20} y={14} width={48} height={44}>
            <LinearGradient start={vec(20, 0)} end={vec(68, 0)} colors={["rgba(0,0,0,0.2)", "rgba(0,0,0,0)", "rgba(0,0,0,0.16)"]} />
          </Rect>
          <Path path="M30 20 L30 54 M38 22 L38 55 M46 22 L46 55 M54 22 L54 54 M62 20 L62 52" style="stroke" strokeWidth={0.5} color="rgba(120,100,70,0.35)" />
          <Circle cx={44} cy={36} r={9} style="stroke" strokeWidth={2.2} color="#e84a3a" />
          <Circle cx={44} cy={36} r={4.2} color="#f6c445" />
        </Group>
      ) : null}
      <Path path="M24 14 C34 20 56 20 64 14 L62 52 C52 57 36 57 26 52 Z" style="stroke" strokeWidth={0.9} strokeJoin="round" color="#8a6a3a" />
      <Rect x={20} y={12} width={48} height={2.4} color="#6a4624" />
      {/* küçük ön yelken */}
      <Path path="M74 24 C80 27 88 27 92 24 L90 48 C86 51 78 51 74 48 Z" color="#fdf3e0" />
      <Path path="M74 24 C80 27 88 27 92 24 L90 48 C86 51 78 51 74 48 Z" style="stroke" strokeWidth={0.8} color="#8a6a3a" />
      {/* flama */}
      <Path path="M44 6 L44 1 L58 3.4 L44 6 Z" color="#e84a3a" />
      {/* gövde */}
      <Path path={OP_HULL}>
        <LinearGradient start={vec(0, 62)} end={vec(0, 85)} colors={["#d9a368", "#9a6234", "#5a3416"]} positions={[0, 0.5, 1]} />
      </Path>
      <Path path="M7 66 C28 74 74 74 94 60 M12 72 C32 79 70 79 88 68" style="stroke" strokeWidth={0.8} color="rgba(60,30,10,0.7)" />
      <Path path="M5 61 C16 66 34 70 50 70 C66 70 84 66 97 56" style="stroke" strokeWidth={2} strokeCap="round" color="#fff2cf" />
      {[18, 30, 42, 54, 66, 78].map((x) => (
        <Circle key={x} cx={x} cy={69.5 - ((x - 48) / 46) ** 2 * 3 + 2.4} r={1.9} color="#2a2018" />
      ))}
      {/* kıç: çimenli güverte */}
      <Path path="M6 62 C8 56 16 54 24 56 L26 62 Z" color="#4f9a3a" />
      <Rect x={9} y={52} width={14} height={5} color="#d9a368" />
      {/* aslan başı pruva */}
      <Circle cx={96} cy={50} r={9} color="#f2b84a" />
      <Path path="M88 44 C90 38 98 38 102 44 C99 42 93 42 88 44 Z" color="#e08a2a" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <Circle key={i} cx={96 + Math.cos(i * 0.785) * 8.4} cy={50 + Math.sin(i * 0.785) * 8.4} r={3.2} color="#e08a2a" />
      ))}
      <Circle cx={96} cy={50} r={6} color="#fbd27a" />
      <Circle cx={93.6} cy={48.6} r={1} color="#2a1c10" />
      <Circle cx={98.4} cy={48.6} r={1} color="#2a1c10" />
      <Path path="M94 53 C96 55 98 53 99 52" style="stroke" strokeWidth={0.8} strokeCap="round" color="#7a3a1a" />
      <Path path="M2 82 C20 87 74 87 96 80" style="stroke" strokeWidth={1.3} strokeCap="round" color="rgba(235,248,255,0.65)" />
    </>
  );
}

function OpShip({ p, clock, width, height }) {
  const k = sceneScale(width, height);
  const S = 150 * k;
  const yW = height - (SCENERY.waterline + SCENERY.lift - 6) * k;
  const transform = useDerivedValue(() => {
    const t = clock.value;
    const u = Math.min(1, restU(p, t));
    return [
      { translateX: (-0.28 + 1.56 * u) * width },
      { translateY: yW + Math.sin(t * 0.9) * 3 * k },
      { rotate: Math.sin(t * 0.8 + 0.7) * 0.04 },
      { scale: S / 100 },
      { translateX: -50 },
      { translateY: -82 },
    ];
  });
  return (
    <Group transform={transform}>
      <OpShipArt />
    </Group>
  );
}

// ── 35 · Rick and Morty: yeşil portal (açılır, döner, kapanır) ───────────────
function RmPortal({ p, clock, width, height }) {
  const k = sceneScale(width, height);
  const cx = width * 0.72;
  const cy = height - (SCENERY.lift + 30 + 36) * k;
  const rx = 22 * k;
  const ry = 40 * k;
  const geo = useMemo(() => {
    const swirl = Skia.Path.Make();
    for (let a = 0; a < 5; a += 1) {
      for (let s = 0; s <= 24; s += 1) {
        const th = a * 1.2566 + s * 0.27;
        const rr = 0.18 + (s / 24) * 0.82;
        const x = Math.cos(th) * rx * rr;
        const y = Math.sin(th) * ry * rr;
        if (s === 0) swirl.moveTo(x, y);
        else swirl.lineTo(x, y);
      }
    }
    const drops = Skia.Path.Make();
    for (let i = 0; i < 14; i += 1) {
      const a = (i / 14) * 6.2832;
      drops.addCircle(Math.cos(a) * rx * 1.06, Math.sin(a) * ry * 1.06, (1.1 + hash01(i, 2.2) * 1.6) * k);
    }
    return { swirl, drops };
  }, [width, height, k]);
  const f = useDerivedValue(() => rmFrame(p, clock.value));
  const T = useDerivedValue(() => [{ translateX: cx }, { translateY: cy }, { scaleX: Math.max(0.001, f.value.open) }, { scaleY: Math.max(0.001, f.value.open) }]);
  const spinT = useDerivedValue(() => [{ rotate: clock.value * 2.2 }]);
  const spinT2 = useDerivedValue(() => [{ rotate: -clock.value * 1.4 }]);
  const O = useDerivedValue(() => (f.value.open > 0.01 ? 1 : 0));
  return (
    <Group opacity={O} transform={T}>
      <Circle cx={0} cy={0} r={ry * 2.1}>
        <RadialGradient c={vec(0, 0)} r={ry * 2.1} colors={["rgba(120,255,140,0.38)", "rgba(120,255,140,0)"]} />
      </Circle>
      <Oval x={-rx * 1.18} y={-ry * 1.18} width={rx * 2.36} height={ry * 2.36} color="rgba(80,235,110,0.5)" />
      <Oval x={-rx} y={-ry} width={rx * 2} height={ry * 2}>
        <RadialGradient c={vec(0, 0)} r={ry} colors={["#eaffe8", "#9dff9a", "#35d65a", "#0f7a30"]} positions={[0, 0.3, 0.75, 1]} />
      </Oval>
      <Group transform={spinT}>
        <Path path={geo.swirl} style="stroke" strokeWidth={1.8 * k} strokeCap="round" color="rgba(255,255,255,0.75)" />
      </Group>
      <Group transform={spinT2}>
        <Path path={geo.drops} color="rgba(190,255,190,0.85)" />
      </Group>
      <Oval x={-rx} y={-ry} width={rx * 2} height={ry * 2} style="stroke" strokeWidth={2.4 * k} color="rgba(220,255,220,0.9)" />
    </Group>
  );
}

/** OVERLAY numarası → katman (OverlayLayers LAYERS'a eklenir). */
export const UNIVERSE_LAYERS = {
  17: IceWall,
  18: liftedLayer(Dunes, GroundDunes),
  19: liftedLayer(Gotham, GroundGotham),
  20: liftedLayer(Skyline, GroundSkyline),
  21: liftedLayer(Mordor, GroundMordor),
  22: liftedLayer(Mesa, GroundMesa),
  23: liftedLayer(Prison, GroundPrison),
  24: liftedLayer(London, GroundLondon),
  25: liftedLayer(Pool, GroundPool),
  26: liftedLayer(TitanWall, GroundTitan),
  27: Transmute,
  28: Blueprint,
  29: Tether,
  30: SkyBeam,
  31: River,
  32: StarWarsFx,
  33: liftedLayer(Hogwarts, GroundHogwarts),
  34: OpShip,
  35: RmPortal,
};
