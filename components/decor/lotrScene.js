// components/decor/lotrScene.js
//
// Yüzüklerin Efendisi atmosfer sahnesi (OVERLAY.mordor = 21) — tamamı VEKTÖR:
//   • Mordor: kızıl ışıklı gök, kül bulutu bantları, sivri dağ sırtı (Ephel Dúath), solda Hüküm Dağı
//     (yamaçlarda akan lav damarları, kızıl krater, duman sütunu, dağa sarılan patika, Sammath Naur
//     kapısı), sağda Barad-dûr (kademeli kara kule, payandalar, dikenler, iki pençe boynuz) ve
//     boynuzların arasında alevli GÖZ (yarık gözbebeği, titreyen alev dilleri, ovayı tarayan bakış
//     ışığı); önde lav çatlaklı Gorgoroth ovası; kulenin çevresinde dönen iki Nazgûl.
//   • Olay (lotrFrame, 30 sn): iki hobbit patikadan kapıya tırmanır, Göz dağa döner → kapıda Yüzük
//     parlar, krater alevlenir → Hüküm Dağı patlar (lav fıskiyesi, akan lav, sarsıntı) → Göz
//     söner ve patlar, kulenin tepesi çöker (toz bulutu), Nazgûllar alevlere düşer → kartallar
//     gelip hobbitleri alır ve uçar → duman yatışır; döngü sonunda kule sis içinde yeniden belirir.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift (sekme çubuğu). Renkler OVERLAY_TONES[21] (LOTR_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Circle, Group, LinearGradient, Oval, Path, RadialGradient, Skia, vec } from "@shopify/react-native-skia";
import { lotrFrame, sceneScale } from "../../utils/weatherParticles";
import { SCENERY } from "../../utils/weatherUniverses";

const LOTR_TONE = ["sky", "ridge", "rock", "rockLit", "tower", "towerLit", "lava", "fire", "core", "ash", "smoke", "eagle", "beast", "ground", "glow"];
const toneMap = (colors) => Object.fromEntries(LOTR_TONE.map((name, i) => [name, colors[i] || colors[0]]));

function rgba(hex, a) {
  const h = String(hex).replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const hash = (i, s) => {
  "worklet";
  const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/** Sahne yerleşimi (dp). */
export function lotrLayout(width, height) {
  const k = sceneScale(width, height);
  const ground = height - SCENERY.lift * k;
  const vx = width * 0.27;
  const peak = ground - 250 * k;
  const tx = width * 0.73;
  const th = Math.min(420 * k, (ground - height * 0.12) * 0.85);
  const tTop = ground - th;
  const eye = [tx, tTop - 30 * k];
  // patika: dağ eteğinden kapıya zikzak
  const door = [vx + 30 * k, ground - 178 * k];
  const path = [
    vx + 120 * k, ground - 20 * k,
    vx + 70 * k, ground - 60 * k,
    vx + 100 * k, ground - 96 * k,
    vx + 48 * k, ground - 128 * k,
    vx + 70 * k, ground - 156 * k,
    door[0] + 6 * k, door[1] + 4 * k,
  ];
  return { k, ground, vx, peak, crater: [vx, peak + 6 * k], tx, th, tTop, eye, door, path };
}

function along(pts, s) {
  "worklet";
  const n = pts.length / 2 - 1;
  let f = s * n;
  if (f < 0) f = 0;
  if (f > n - 0.0001) f = n - 0.0001;
  const i = Math.floor(f);
  const r = f - i;
  return [pts[2 * i] + (pts[2 * i + 2] - pts[2 * i]) * r, pts[2 * i + 1] + (pts[2 * i + 3] - pts[2 * i + 1]) * r];
}

// ── Manzara ──────────────────────────────────────────────────────────────────
function buildLand(L, width, height) {
  const { k, ground, vx, peak } = L;
  const ridge = Skia.Path.Make();
  ridge.moveTo(-10, ground);
  let x = -10;
  let i = 0;
  while (x < width + 10) {
    const h = (120 + hash(i, 1) * 90) * k;
    ridge.lineTo(x, ground - h * 0.7);
    x += (8 + hash(i, 2) * 14) * k;
    ridge.lineTo(x, ground - h);
    x += (8 + hash(i, 3) * 14) * k;
    i += 1;
  }
  ridge.lineTo(width + 10, ground);
  ridge.close();
  // yanardağ: iç bükey yamaçlar, krater dudağı
  const volcano = Skia.Path.Make();
  volcano.moveTo(vx - width * 0.36, ground + 2);
  volcano.cubicTo(vx - 90 * k, ground - 40 * k, vx - 40 * k, peak + 60 * k, vx - 20 * k, peak);
  volcano.lineTo(vx - 12 * k, peak + 5 * k);
  volcano.lineTo(vx + 12 * k, peak + 5 * k);
  volcano.lineTo(vx + 20 * k, peak);
  volcano.cubicTo(vx + 46 * k, peak + 70 * k, vx + 100 * k, ground - 30 * k, vx + width * 0.4, ground + 2);
  volcano.close();
  const volcanoLit = Skia.Path.Make();
  volcanoLit.moveTo(vx + 20 * k, peak);
  volcanoLit.cubicTo(vx + 46 * k, peak + 70 * k, vx + 100 * k, ground - 30 * k, vx + width * 0.4, ground + 2);
  volcanoLit.lineTo(vx + 60 * k, ground + 2);
  volcanoLit.cubicTo(vx + 40 * k, ground - 60 * k, vx + 20 * k, peak + 60 * k, vx + 8 * k, peak + 5 * k);
  volcanoLit.close();
  // lav damarları
  const lava = Skia.Path.Make();
  for (const [ox, sw, len] of [[-8, -1, 1], [4, 1, 0.8], [-2, -0.4, 0.62]]) {
    let px = vx + ox * k;
    let py = peak + 5 * k;
    lava.moveTo(px, py);
    for (let j = 1; j <= 8; j += 1) {
      const nx = px + (sw * 9 + Math.sin(j * 1.7 + ox) * 6) * k;
      const ny = py + (ground - peak) * 0.115 * len;
      lava.quadTo(px + Math.sin(j + ox) * 6 * k, (py + ny) / 2, nx, ny);
      px = nx;
      py = ny;
    }
  }
  // patika
  const trail = Skia.Path.Make();
  const P = L.path;
  trail.moveTo(P[0], P[1]);
  for (let j = 2; j < P.length; j += 2) trail.lineTo(P[j], P[j + 1]);
  // ova: lav çatlakları + kayalar
  const cracks = Skia.Path.Make();
  for (let j = 0; j < 9; j += 1) {
    let cx = width * hash(j, 5);
    let cy = ground + (6 + hash(j, 6) * 40) * k;
    cracks.moveTo(cx, cy);
    for (let m = 0; m < 4; m += 1) {
      cx += (8 + hash(j * 4 + m, 7) * 18) * k;
      cy += (hash(j * 4 + m, 8) - 0.5) * 8 * k;
      cracks.lineTo(cx, cy);
    }
  }
  const rocks = Skia.Path.Make();
  for (let j = 0; j < 7; j += 1) {
    const rx = width * (0.05 + j * 0.15 + hash(j, 9) * 0.05);
    const ry = ground + 2 * k;
    const rw = (8 + hash(j, 10) * 14) * k;
    rocks.moveTo(rx - rw, ry);
    rocks.lineTo(rx - rw * 0.6, ry - rw * 0.7);
    rocks.lineTo(rx + rw * 0.1, ry - rw);
    rocks.lineTo(rx + rw * 0.8, ry - rw * 0.4);
    rocks.lineTo(rx + rw, ry);
    rocks.close();
  }
  // kül bulutu bantları
  const ash = [];
  for (let j = 0; j < 6; j += 1) ash.push([width * (j * 0.2 - 0.05), height * (0.06 + hash(j, 11) * 0.16), (90 + hash(j, 12) * 80) * k, (14 + hash(j, 13) * 10) * k]);
  return { ridge, volcano, volcanoLit, lava, trail, cracks, rocks, ash };
}

// Barad-dûr: taban (kalır), gövde (çöker), taç + boynuzlar (yıkılır). Yerel: x = kule ekseni, y mutlak.
function buildTower(L) {
  const { k, ground, tx, tTop, th } = L;
  const W = 54 * k;
  const yAt = (f) => ground - th * f;
  const base = Skia.Path.Make();
  base.moveTo(tx - W * 2.1, ground + 2);
  base.lineTo(tx - W * 1.5, yAt(0.16));
  base.lineTo(tx - W * 1.25, yAt(0.16));
  base.lineTo(tx - W * 1.15, yAt(0.34));
  base.lineTo(tx + W * 1.15, yAt(0.34));
  base.lineTo(tx + W * 1.25, yAt(0.16));
  base.lineTo(tx + W * 1.5, yAt(0.16));
  base.lineTo(tx + W * 2.1, ground + 2);
  base.close();
  // payandalar
  base.moveTo(tx - W * 2.4, ground + 2);
  base.lineTo(tx - W * 1.7, yAt(0.25));
  base.lineTo(tx - W * 1.55, yAt(0.25));
  base.lineTo(tx - W * 1.9, ground + 2);
  base.close();
  base.moveTo(tx + W * 2.4, ground + 2);
  base.lineTo(tx + W * 1.7, yAt(0.25));
  base.lineTo(tx + W * 1.55, yAt(0.25));
  base.lineTo(tx + W * 1.9, ground + 2);
  base.close();
  const mid = Skia.Path.Make();
  mid.moveTo(tx - W * 1.12, yAt(0.34) + 1);
  mid.lineTo(tx - W * 0.9, yAt(0.55));
  mid.lineTo(tx - W * 1.05, yAt(0.56));
  mid.lineTo(tx - W * 0.7, yAt(0.78));
  mid.lineTo(tx + W * 0.7, yAt(0.78));
  mid.lineTo(tx + W * 1.05, yAt(0.56));
  mid.lineTo(tx + W * 0.9, yAt(0.55));
  mid.lineTo(tx + W * 1.12, yAt(0.34) + 1);
  mid.close();
  // yan dikenler
  for (const sgn of [-1, 1]) {
    for (const f of [0.42, 0.62]) {
      mid.moveTo(tx + sgn * W * 0.95, yAt(f));
      mid.lineTo(tx + sgn * W * 1.45, yAt(f + 0.05));
      mid.lineTo(tx + sgn * W * 0.95, yAt(f + 0.025));
      mid.close();
    }
  }
  const crown = Skia.Path.Make();
  crown.moveTo(tx - W * 0.7, yAt(0.78) + 1);
  crown.lineTo(tx - W * 0.55, yAt(0.9));
  crown.lineTo(tx - W * 0.85, yAt(0.92));
  crown.lineTo(tx - W * 0.45, yAt(0.95));
  crown.lineTo(tx + W * 0.45, yAt(0.95));
  crown.lineTo(tx + W * 0.85, yAt(0.92));
  crown.lineTo(tx + W * 0.55, yAt(0.9));
  crown.lineTo(tx + W * 0.7, yAt(0.78) + 1);
  crown.close();
  // pençe boynuzlar (göz aralarında)
  for (const sgn of [-1, 1]) {
    crown.moveTo(tx + sgn * W * 0.45, yAt(0.95));
    crown.cubicTo(tx + sgn * W * 0.62, tTop - 10 * k, tx + sgn * W * 0.6, tTop - 40 * k, tx + sgn * W * 0.3, tTop - 62 * k);
    crown.cubicTo(tx + sgn * W * 0.42, tTop - 36 * k, tx + sgn * W * 0.36, tTop - 12 * k, tx + sgn * W * 0.18, yAt(0.95));
    crown.close();
  }
  // kademeler/yarıklar (ışık çizgileri)
  const lines = Skia.Path.Make();
  for (const f of [0.16, 0.34, 0.55, 0.78, 0.9]) {
    lines.moveTo(tx - W * 1.3, yAt(f));
    lines.lineTo(tx + W * 1.3, yAt(f));
  }
  const slits = Skia.Path.Make();
  for (let j = 0; j < 14; j += 1) {
    const f = 0.2 + hash(j, 21) * 0.55;
    const xx = tx + (hash(j, 22) - 0.5) * W * 1.4;
    slits.addRect(Skia.XYWHRect(xx, yAt(f), 1.6 * k, 5 * k));
  }
  return { base, mid, crown, lines, slits };
}

// Göz: badem biçimli alev (yerel 0,0)
function buildEye(k) {
  const outer = Skia.Path.Make();
  outer.moveTo(-26 * k, 0);
  outer.cubicTo(-14 * k, -15 * k, 14 * k, -15 * k, 26 * k, 0);
  outer.cubicTo(14 * k, 15 * k, -14 * k, 15 * k, -26 * k, 0);
  outer.close();
  const inner = Skia.Path.Make();
  inner.moveTo(-15 * k, 0);
  inner.cubicTo(-8 * k, -9 * k, 8 * k, -9 * k, 15 * k, 0);
  inner.cubicTo(8 * k, 9 * k, -8 * k, 9 * k, -15 * k, 0);
  inner.close();
  const pupil = Skia.Path.Make();
  pupil.moveTo(0, -12 * k);
  pupil.quadTo(3.2 * k, 0, 0, 12 * k);
  pupil.quadTo(-3.2 * k, 0, 0, -12 * k);
  pupil.close();
  return { outer, inner, pupil };
}

// Nazgûl bineği: yerel, sağa uçar; kanat ayrı yol (çırpma için)
const BEAST_BODY = "M-14 2 C-8 -1 2 -2 8 -1 L13 -4 L17 -3 L15 0 L18 1 L12 2 C6 4 -4 5 -14 2 Z M-14 2 L-24 6 L-20 3 Z M2 -2 L1 -7 L4 -9 L5 -3 Z";
const BEAST_WING = "M0 0 C-4 -10 -10 -18 -20 -22 L-17 -14 L-24 -14 L-17 -7 L-22 -4 L-12 -2 Z";
// Kartal: yerel, sola uçar
const EAGLE_BODY = "M18 0 C12 -3 0 -4 -8 -2 L-14 -3 L-18 -1 L-14 1 C-8 2 0 4 10 3 L20 5 L24 3 L22 0 Z";
const EAGLE_WING = "M0 0 C6 -10 14 -20 26 -30 L24 -24 L30 -26 L26 -19 L32 -20 L26 -13 L31 -12 L22 -6 C14 -3 6 -1 0 0 Z";
const EAGLE_HEAD = "M-14 -3 C-17 -5 -20 -4 -21 -2 L-24 -1 L-21 0 C-19 1 -16 1 -14 1 Z";

function Beast({ f, i, L, clock, c }) {
  const tr = useDerivedValue(() => {
    const q = f.value;
    const t = clock.value;
    const a = t * 0.32 + i * Math.PI;
    let x = L.tx + Math.cos(a) * 120 * L.k;
    let y = L.tTop + 40 * L.k + Math.sin(a) * 34 * L.k + i * 26 * L.k;
    const dir = -Math.sin(a) >= 0 ? 1 : -1;
    let rot = 0;
    let sc = 0.8 + 0.25 * Math.sin(a);
    if (q.beastFall >= 0) {
      const g = q.beastFall;
      x += (i ? 40 : -60) * L.k * g;
      y += g * g * (L.ground - y + 20 * L.k);
      rot = g * 5 * (i ? 1 : -1);
      sc *= 1 - 0.3 * g;
    }
    return [{ translateX: x }, { translateY: y }, { scaleX: dir * sc * L.k * 1.3 }, { scaleY: sc * L.k * 1.3 }, { rotate: rot }];
  });
  const op = useDerivedValue(() => {
    const q = f.value;
    if (q.u > 1) return 1;
    if (q.beastFall >= 0) return 1 - Math.max(0, (q.beastFall - 0.8) / 0.2);
    if (q.u >= 0.64) return q.restore;
    return 1;
  });
  const wingT = useDerivedValue(() => [{ scaleY: 0.35 + 0.65 * Math.abs(Math.sin(clock.value * 2.6 + i)) }]);
  return (
    <Group opacity={op}>
      <Group transform={tr}>
        <Path path={BEAST_BODY} color={c.beast} />
        <Group transform={wingT}>
          <Path path={BEAST_WING} color={c.beast} />
        </Group>
        <Path path="M2 -6 L3 -12 L5 -8 Z" color={c.beast} />
      </Group>
    </Group>
  );
}

function Eagle({ f, i, L, clock, c }) {
  const tr = useDerivedValue(() => {
    const q = f.value;
    const g = q.eagles;
    if (g < 0) return [{ translateX: -9999 }];
    const lx = L.door[0] + (i ? 30 : 10) * L.k;
    const ly = L.door[1] - (i ? 30 : 16) * L.k;
    let x;
    let y;
    let dir = 1;
    if (g < 0.4) {
      const e = g / 0.4;
      const s = 1 - (1 - e) * (1 - e);
      x = L.tx + 200 * L.k + (lx - L.tx - 200 * L.k) * s;
      y = L.tTop + 20 * L.k + i * 40 * L.k + (ly - L.tTop - 20 * L.k - i * 40 * L.k) * s;
    } else if (g < 0.5) {
      x = lx;
      y = ly + Math.sin((g - 0.4) * 30) * 2 * L.k;
    } else {
      const e = (g - 0.5) / 0.5;
      dir = -1;
      x = lx + e * e * (L.tx + 260 * L.k - lx);
      y = ly - e * 240 * L.k;
    }
    const sc = (1.5 + i * 0.25) * L.k;
    return [{ translateX: x }, { translateY: y }, { scaleX: dir * sc }, { scaleY: sc }];
  });
  const wingT = useDerivedValue(() => [{ scaleY: 0.2 + 0.8 * Math.abs(Math.sin(clock.value * 2.1 + i * 1.3)) }]);
  const wing2T = useDerivedValue(() => [{ scaleY: -(0.1 + 0.4 * Math.abs(Math.sin(clock.value * 2.1 + i * 1.3))) }]);
  const op = useDerivedValue(() => {
    const g = f.value.eagles;
    return g < 0 ? 0 : Math.min(1, g * 12, (1 - g) * 10);
  });
  return (
    <Group opacity={op}>
      <Group transform={tr}>
        <Group transform={wing2T}>
          <Path path={EAGLE_WING} color={rgba(c.eagle, 0.7)} />
        </Group>
        <Path path={EAGLE_BODY} color={c.eagle} />
        <Path path={EAGLE_HEAD} color="#d9cfc0" />
        <Path path="M-24 -1 L-26 0 L-23 0.6 Z" color="#e0a830" />
        <Group transform={wingT}>
          <Path path={EAGLE_WING} color={c.eagle} />
          <Path path="M6 -6 L20 -22 M10 -4 L26 -16 M14 -3 L28 -10" style="stroke" strokeWidth={0.6} color="rgba(30,18,8,0.5)" />
        </Group>
      </Group>
    </Group>
  );
}

// Lav fıskiyesi damlası
function Bomb({ f, i, L, c }) {
  const tr = useDerivedValue(() => {
    const e = f.value.erupt;
    const ph = (f.value.u * 9 + hash(i, 1)) % 1;
    if (e <= 0) return [{ translateX: -9999 }];
    const ang = -Math.PI / 2 + (hash(i, 2) - 0.5) * 1.6;
    const v = (120 + hash(i, 3) * 140) * L.k;
    const x = L.crater[0] + Math.cos(ang) * v * ph;
    const y = L.crater[1] + Math.sin(ang) * v * ph + 260 * L.k * ph * ph;
    return [{ translateX: x }, { translateY: y }];
  });
  const op = useDerivedValue(() => {
    const e = f.value.erupt;
    const ph = (f.value.u * 9 + hash(i, 1)) % 1;
    return e * (1 - ph);
  });
  return (
    <Group opacity={op} transform={tr}>
      <Circle cx={0} cy={0} r={7 * L.k}>
        <RadialGradient c={vec(0, 0)} r={7 * L.k} colors={[c.core, rgba(c.lava, 0.9), rgba(c.lava, 0)]} />
      </Circle>
    </Group>
  );
}

// Duman/toz topağı
function Puff({ x, y, r, o, color, tr }) {
  return (
    <Group opacity={o} transform={tr}>
      <Circle cx={x} cy={y} r={r}>
        <RadialGradient c={vec(x, y)} r={r} colors={[rgba(color, 0.85), rgba(color, 0.5), rgba(color, 0)]} positions={[0, 0.6, 1]} />
      </Circle>
    </Group>
  );
}

function SmokeColumn({ L, clock, f, c, i }) {
  const tr = useDerivedValue(() => {
    const ph = (clock.value * 0.05 + i / 6) % 1;
    const big = 1 + f.value.erupt * 1.6;
    return [{ translateX: Math.sin(ph * 3 + i) * 10 * L.k + ph * 40 * L.k }, { translateY: -ph * 260 * L.k * big }, { scale: 0.6 + ph * 1.8 * big }];
  });
  const op = useDerivedValue(() => {
    const ph = (clock.value * 0.05 + i / 6) % 1;
    return Math.sin(ph * Math.PI) * (0.55 + 0.35 * f.value.erupt);
  });
  return (
    <Group transform={[{ translateX: L.crater[0] }, { translateY: L.crater[1] }]}>
      <Group opacity={op} transform={tr}>
        <Circle cx={0} cy={0} r={22 * L.k}>
          <RadialGradient c={vec(0, 0)} r={22 * L.k} colors={[rgba(c.smoke, 0.9), rgba(c.smoke, 0)]} />
        </Circle>
      </Group>
    </Group>
  );
}

// Hobbitler: Sam, Frodo'yu sırtında taşır (minik silüet). Yerel: ayaklar 0,0, sağa bakar.
const HOBBITS = "M-3 0 L-2.2 -4 L-3.2 -8 C-3.4 -10 -2 -11.2 -0.6 -10.6 C0.6 -10 1 -8.6 0.4 -7.6 L1.6 -4 L0.6 0 L-0.4 0 L-0.6 -3.4 L-1.6 0 Z M-3.4 -9 C-5 -10.6 -5.2 -13 -3.6 -14 C-2.4 -14.6 -1 -13.6 -1.2 -12.2 L-1.4 -10.6 Z";

export default function LotrScene({ p, clock, width, height, tone }) {
  const c = toneMap(tone.colors);
  const L = lotrLayout(width, height);
  const { k } = L;
  const light = c.ground === "#4a3430";
  const geo = useMemo(
    () => ({ land: buildLand(L, width, height), tower: buildTower(L), eye: buildEye(k), hobbits: Skia.Path.MakeFromSVGString(HOBBITS) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, height],
  );
  const f = useDerivedValue(() => lotrFrame(p, clock.value));
  const shakeT = useDerivedValue(() => {
    const s = f.value.shake;
    return [{ translateX: Math.sin(clock.value * 53) * 2 * k * s }, { translateY: Math.sin(clock.value * 67) * 1.4 * k * s }];
  });
  // bakış ışığı: ovayı tarar; olayda dağa döner; göz ölünce söner
  const beamT = useDerivedValue(() => {
    const t = clock.value;
    const sweep = 0.25 + 0.55 * Math.sin(t * 0.09);
    const toDoom = Math.atan2(L.door[0] - L.eye[0], L.door[1] - L.eye[1]);
    const a = sweep + (toDoom - sweep) * f.value.look;
    return [{ translateX: L.eye[0] }, { translateY: L.eye[1] }, { rotate: -a }];
  });
  const beamO = useDerivedValue(() => (1 - f.value.eyeDie) * (light ? 0.3 : 0.26));
  const eyeO = useDerivedValue(() => {
    const q = f.value;
    const alive = 1 - q.eyeDie;
    return alive * (0.88 + 0.12 * Math.sin(clock.value * 7));
  });
  const eyeT = useDerivedValue(() => {
    const q = f.value;
    const s = 1 + q.flare * 0.25 + q.eyeDie * 0.8;
    return [{ translateX: L.eye[0] }, { translateY: L.eye[1] }, { scale: s * (1 + 0.03 * Math.sin(clock.value * 11)) }];
  });
  const pupilT = useDerivedValue(() => [{ scaleX: 1 + f.value.look * 0.6 + f.value.flare * 0.8 }]);
  const flames = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const t = clock.value;
    for (let j = 0; j < 12; j += 1) {
      const a = (j / 12) * Math.PI * 2;
      const r0 = 20 * k;
      const ex = Math.cos(a) * 26 * k;
      const ey = Math.sin(a) * 13 * k;
      const len = (8 + 6 * Math.abs(Math.sin(t * 5 + j * 1.7))) * k;
      const up = -Math.abs(Math.sin(a)) * 0.5;
      q.moveTo(ex * 0.8 - Math.sin(a) * 3 * k, ey * 0.8);
      q.quadTo(ex + Math.cos(a) * len * 0.5, ey + Math.sin(a) * len * 0.5 + up * len, ex + Math.cos(a) * len + Math.sin(t * 6 + j) * 2 * k, ey + Math.sin(a) * len + up * len - r0 * 0.1);
      q.quadTo(ex + Math.cos(a) * len * 0.4, ey + Math.sin(a) * len * 0.4, ex * 0.8 + Math.sin(a) * 3 * k, ey * 0.8);
      q.close();
    }
    return q;
  });
  const boomT = useDerivedValue(() => {
    const b = f.value.boom;
    const s = b < 0 ? 0 : 0.2 + 4 * (1 - (1 - b) * (1 - b));
    return [{ translateX: L.eye[0] }, { translateY: L.eye[1] }, { scaleX: s }, { scaleY: s * 0.45 }];
  });
  const boomO = useDerivedValue(() => {
    const b = f.value.boom;
    return b < 0 ? 0 : Math.min(1, b * 10) * (1 - b);
  });
  // çöken taç ve gövde
  const crownT = useDerivedValue(() => {
    const g = f.value.collapse;
    const e = g * g;
    return [{ translateX: L.tx }, { translateY: L.tTop + e * 220 * k }, { rotate: e * 0.5 }, { translateX: -L.tx }, { translateY: -L.tTop }];
  });
  const crownO = useDerivedValue(() => {
    const q = f.value;
    if (q.fallen <= 0) return 1;
    if (q.u < 0.68) return 1 - Math.max(0, (q.collapse - 0.45) / 0.55);
    return q.restore;
  });
  const midT = useDerivedValue(() => {
    const g = f.value.collapse;
    const e = g > 0.25 ? ((g - 0.25) / 0.75) ** 2 : 0;
    return [{ translateY: e * 140 * k }, { translateX: e * -12 * k }];
  });
  const midO = useDerivedValue(() => {
    const q = f.value;
    if (q.fallen <= 0) return 1;
    if (q.u < 0.68) return 1 - Math.max(0, (q.collapse - 0.55) / 0.45);
    return q.restore;
  });
  const dustO = useDerivedValue(() => f.value.dust);
  const dustT = useDerivedValue(() => {
    const s = 0.6 + f.value.dust * 0.6;
    const cy = L.ground - L.th * 0.5;
    return [{ translateX: L.tx }, { translateY: cy }, { scale: s }, { translateX: -L.tx }, { translateY: -cy }];
  });
  const fountP = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const e = f.value.erupt;
    if (e <= 0.01) return q;
    const t = clock.value;
    const h = (60 + 50 * Math.abs(Math.sin(t * 3.1))) * k * e;
    const [cx, cy] = L.crater;
    q.moveTo(cx - 12 * k, cy);
    q.cubicTo(cx - 16 * k, cy - h * 0.5, cx - 8 * k + Math.sin(t * 5) * 4 * k, cy - h, cx + Math.sin(t * 7) * 3 * k, cy - h * 1.05);
    q.cubicTo(cx + 8 * k + Math.sin(t * 4) * 4 * k, cy - h, cx + 16 * k, cy - h * 0.5, cx + 12 * k, cy);
    q.close();
    return q;
  });
  const craterO = useDerivedValue(() => 0.55 + 0.25 * Math.sin(clock.value * 1.4) + f.value.flare * 0.5 + f.value.erupt * 0.6);
  const lavaO = useDerivedValue(() => 0.55 + 0.2 * Math.sin(clock.value * 0.9) + f.value.erupt * 0.45);
  const skyO = useDerivedValue(() => (light ? 0.3 : 0.45) + f.value.erupt * 0.3);
  const hobT = useDerivedValue(() => {
    const q = f.value;
    if (q.climb >= 0) {
      const [x, y] = along(L.path, q.climb);
      return [{ translateX: x }, { translateY: y + Math.abs(Math.sin(clock.value * 6)) * -0.6 * k }, { scaleX: -1.1 * k }, { scaleY: 1.1 * k }];
    }
    if (q.out > 0) return [{ translateX: L.door[0] + 10 * k }, { translateY: L.door[1] + 4 * k }, { scaleX: -1.1 * k }, { scaleY: 1.1 * k }];
    return [{ translateX: -9999 }];
  });
  const hobO = useDerivedValue(() => {
    const q = f.value;
    if (q.climb >= 0) return Math.min(1, q.climb * 20, (1 - q.climb) * 12);
    return q.out;
  });
  const glintO = useDerivedValue(() => f.value.glint);
  const glintT = useDerivedValue(() => [{ translateX: L.door[0] }, { translateY: L.door[1] - 4 * k }, { rotate: clock.value * 2 }, { scale: 0.6 + f.value.glint }]);
  const doorO = useDerivedValue(() => 0.6 + 0.3 * Math.sin(clock.value * 2) + f.value.flare * 0.4);
  const G = geo.land;
  const T = geo.tower;
  const E = geo.eye;
  const beamLen = Math.max(width, height) * 1.2;
  const ha = 0.07;
  const beamPath = `M0 0 L${-Math.tan(ha) * beamLen} ${beamLen} L${Math.tan(ha) * beamLen} ${beamLen} Z`;
  return (
    <Group transform={shakeT}>
      {/* kızıl gök ışıması */}
      <Group opacity={skyO}>
        <Path path={`M0 ${L.ground - 420 * k} L${width} ${L.ground - 420 * k} L${width} ${L.ground} L0 ${L.ground} Z`}>
          <LinearGradient start={vec(0, L.ground - 420 * k)} end={vec(0, L.ground)} colors={[rgba(c.glow, 0), rgba(c.glow, 0.45)]} />
        </Path>
      </Group>
      {G.ash.map(([x, y, rx, ry], i) => (
        <Oval key={i} x={x - rx} y={y - ry} width={rx * 2} height={ry * 2} color={rgba(c.ash, light ? 0.35 : 0.5)} />
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <SmokeColumn key={i} L={L} clock={clock} f={f} c={c} i={i} />
      ))}

      <Group opacity={tone.alpha}>
        <Path path={G.ridge} color={c.ridge} />
      </Group>

      {/* Barad-dûr */}
      <Group opacity={tone.alpha}>
        <Path path={T.base} color={c.tower} />
        <Group opacity={midO}>
          <Group transform={midT}>
            <Path path={T.mid} color={c.tower} />
          </Group>
        </Group>
        <Group opacity={crownO}>
          <Group transform={crownT}>
            <Path path={T.crown} color={c.tower} />
          </Group>
        </Group>
        <Path path={T.lines} style="stroke" strokeWidth={0.8 * k} color={rgba(c.towerLit, 0.6)} />
        <Path path={T.slits} color={rgba(c.fire, 0.55)} />
      </Group>
      <Group opacity={dustO}>
        <Group transform={dustT}>
          <Puff x={L.tx} y={L.ground - L.th * 0.55} r={170 * k} o={1} color={c.ash} />
          <Puff x={L.tx - 40 * k} y={L.ground - L.th * 0.35} r={110 * k} o={0.8} color={c.rockLit} />
        </Group>
      </Group>

      {/* bakış ışığı + Göz */}
      <Group opacity={beamO} transform={beamT}>
        <Path path={beamPath}>
          <LinearGradient start={vec(0, 0)} end={vec(0, beamLen)} colors={[rgba(c.fire, 0.9), rgba(c.fire, 0)]} />
        </Path>
      </Group>
      <Group opacity={eyeO} transform={eyeT}>
        <Circle cx={0} cy={0} r={46 * k}>
          <RadialGradient c={vec(0, 0)} r={46 * k} colors={[rgba(c.fire, 0.6), rgba(c.lava, 0)]} />
        </Circle>
        <Path path={flames} color={rgba(c.fire, 0.85)} />
        <Path path={E.outer}>
          <RadialGradient c={vec(0, 0)} r={26 * k} colors={[c.core, c.fire, c.lava]} positions={[0, 0.5, 1]} />
        </Path>
        <Path path={E.inner} color={rgba(c.core, 0.8)} />
        <Group transform={pupilT}>
          <Path path={E.pupil} color="#1a0400" />
        </Group>
      </Group>
      <Group opacity={boomO} transform={boomT}>
        <Circle cx={0} cy={0} r={40 * k}>
          <RadialGradient c={vec(0, 0)} r={40 * k} colors={[rgba(c.core, 0), rgba(c.core, 0), rgba(c.fire, 0.8), rgba(c.core, 1), rgba(c.fire, 0)]} positions={[0, 0.6, 0.82, 0.9, 1]} />
        </Circle>
      </Group>

      {[0, 1].map((i) => (
        <Beast key={i} f={f} i={i} L={L} clock={clock} c={c} />
      ))}

      {/* Hüküm Dağı */}
      <Group opacity={tone.alpha}>
        <Path path={G.volcano}>
          <LinearGradient start={vec(0, L.peak)} end={vec(0, L.ground)} colors={[c.rock, rgba(c.ridge, 1)]} />
        </Path>
        <Path path={G.volcanoLit} color={rgba(c.rockLit, 0.4)} />
        <Path path={G.trail} style="stroke" strokeWidth={1 * k} color={rgba(c.rockLit, 0.7)} />
      </Group>
      <Group opacity={lavaO}>
        <Path path={G.lava} style="stroke" strokeWidth={3.2 * k} strokeCap="round" color={rgba(c.lava, 0.55)} />
        <Path path={G.lava} style="stroke" strokeWidth={1.3 * k} strokeCap="round" color={c.fire} />
      </Group>
      <Group opacity={craterO}>
        <Circle cx={L.crater[0]} cy={L.crater[1]} r={60 * k}>
          <RadialGradient c={vec(L.crater[0], L.crater[1])} r={60 * k} colors={[rgba(c.core, 0.9), rgba(c.fire, 0.5), rgba(c.lava, 0)]} positions={[0, 0.3, 1]} />
        </Circle>
      </Group>
      {/* Sammath Naur kapısı */}
      <Group opacity={doorO}>
        <Circle cx={L.door[0]} cy={L.door[1]} r={12 * k}>
          <RadialGradient c={vec(L.door[0], L.door[1])} r={12 * k} colors={[rgba(c.fire, 0.8), rgba(c.fire, 0)]} />
        </Circle>
      </Group>
      <Path path={`M${L.door[0] - 3.5 * k} ${L.door[1] + 5 * k} L${L.door[0] - 3.5 * k} ${L.door[1] - 3 * k} L${L.door[0]} ${L.door[1] - 7 * k} L${L.door[0] + 3.5 * k} ${L.door[1] - 3 * k} L${L.door[0] + 3.5 * k} ${L.door[1] + 5 * k} Z`} color={c.core} />
      <Path path={fountP}>
        <LinearGradient start={vec(0, L.crater[1])} end={vec(0, L.crater[1] - 110 * k)} colors={[c.core, c.fire, rgba(c.lava, 0.2)]} />
      </Path>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((i) => (
        <Bomb key={i} f={f} i={i} L={L} c={c} />
      ))}

      {/* hobbitler + Yüzük parıltısı */}
      <Group opacity={hobO} transform={hobT}>
        <Path path={geo.hobbits} color="#120a08" />
      </Group>
      <Group opacity={glintO} transform={glintT}>
        <Path path={`M0 ${-9 * k} L${1.2 * k} ${-1.2 * k} L${9 * k} 0 L${1.2 * k} ${1.2 * k} L0 ${9 * k} L${-1.2 * k} ${1.2 * k} L${-9 * k} 0 L${-1.2 * k} ${-1.2 * k} Z`} color="#ffe680" />
        <Circle cx={0} cy={0} r={2.4 * k} style="stroke" strokeWidth={1 * k} color="#ffd24a" />
      </Group>
      {[0, 1].map((i) => (
        <Eagle key={i} f={f} i={i} L={L} clock={clock} c={c} />
      ))}

      {/* Gorgoroth ovası */}
      <Group opacity={tone.alpha}>
        <Path path={`M-4 ${L.ground} L${width + 4} ${L.ground} L${width + 4} ${height} L-4 ${height} Z`}>
          <LinearGradient start={vec(0, L.ground)} end={vec(0, height)} colors={[c.ground, rgba(c.ground, 1)]} />
        </Path>
        <Path path={G.rocks} color={c.rock} />
      </Group>
      <Group opacity={lavaO}>
        <Path path={G.cracks} style="stroke" strokeWidth={1.6 * k} strokeJoin="round" color={rgba(c.lava, 0.75)} />
      </Group>
    </Group>
  );
}
