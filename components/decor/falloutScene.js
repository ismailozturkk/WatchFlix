// components/decor/falloutScene.js
//
// Fallout evren sahnesi (OVERLAY.foVec = 74) — tamamı VEKTÖR:
//   • Turuncu pusun içinde soluk güneş; ufukta yıkık gökdelenler (kırık tepeler, açıkta kirişler);
//     çorak kum tepeleri, eğilmiş elektrik direği, paslı eski bir araba enkazı, boş reklam panosu.
//   • Solda kayaya gömülü DEV YUVARLAK SIĞINAK KAPISI (dişli kenar, göbek, cıvatalar; numara/logo yok).
//   • İKİ olay (döngüde sırayla, eventPick):
//       A) Kapının üstündeki uyarı lambası döner; kapı geri çekilip yana yuvarlanır, içeriden ışık
//          taşar; mavi tulumlu biri dışarı çıkıp elini gözüne siper eder, sonra kapı geri kapanır.
//       B) Pervaneli dikey kalkışlı bir uçak pusun içinden geçer, projektörü çorak araziyi tarar,
//          alçaldığı yerde toz kaldırır.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[74] (FO_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Group, LinearGradient, Path, Rect, Skia, vec } from "@shopify/react-native-skia";
import { eventPick, restU } from "../../utils/weatherParticles";
import { Glow, groundLayout, hash, ridgePath, ridgeY, rgba, sm, toneMap } from "./seasonKit";

export const FO_TONE = [
  "haze",
  "sun",
  "sky2",
  "city",
  "cityFar",
  "dune",
  "duneShade",
  "rock",
  "rockShade",
  "door",
  "doorRim",
  "doorDark",
  "hole",
  "holeLit",
  "beacon",
  "pylon",
  "wreck",
  "rust",
  "suit",
  "suitStripe",
  "skin",
  "craft",
  "craftDark",
  "rotor",
  "beam",
  "dust",
];

export function foLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  const doorR = 44 * k;
  return {
    ...L,
    horizon: ground - 150 * k,
    duneBase: ground - 40 * k,
    doorR,
    doorX: width * 0.2,
    doorY: ground - 34 * k - doorR,
  };
}

// ───────────────────────────── statik

function buildCity(L) {
  const { width, k, horizon } = L;
  const far = Skia.Path.Make();
  const near = Skia.Path.Make();
  let x = -6 * k;
  let i = 0;
  while (x < width + 10 * k) {
    const w = (16 + hash(i, 1) * 26) * k;
    const h = (40 + hash(i, 2) * 90) * k;
    const target = i % 3 === 0 ? near : far;
    const top = horizon - h * (i % 3 === 0 ? 0.8 : 1);
    // kırık tepe: iki-üç basamaklı çentik
    target.moveTo(x, horizon + 2 * k);
    target.lineTo(x, top + hash(i, 3) * 10 * k);
    target.lineTo(x + w * 0.3, top);
    target.lineTo(x + w * 0.45, top + (6 + hash(i, 4) * 14) * k);
    target.lineTo(x + w * 0.62, top + 4 * k);
    target.lineTo(x + w, top + (12 + hash(i, 5) * 26) * k);
    target.lineTo(x + w, horizon + 2 * k);
    target.close();
    // açıkta kirişler
    if (hash(i, 6) > 0.5) {
      for (let j = 0; j < 3; j += 1) target.addRect(Skia.XYWHRect(x + w * (0.2 + j * 0.25), top - (8 + j * 4) * k, 1.4 * k, (10 + j * 4) * k));
    }
    x += w + (2 + hash(i, 7) * 8) * k;
    i += 1;
  }
  return { far, near };
}

function buildLand(L) {
  const { width, k, duneBase, height, doorX, doorY, doorR, ground } = L;
  const dunes = ridgePath(width, duneBase, 26 * k, 2, 2.3, height);
  const back = ridgePath(width, duneBase - 34 * k, 30 * k, 3, 0.9, height);
  // kaya: kapının çevresi (soldan yükselen yamaç)
  const rock = Skia.Path.Make();
  const shade = Skia.Path.Make();
  rock.moveTo(-10, height);
  rock.lineTo(-10, doorY - doorR - 70 * k);
  rock.lineTo(doorX - 40 * k, doorY - doorR - 80 * k);
  rock.lineTo(doorX + 10 * k, doorY - doorR - 50 * k);
  rock.lineTo(doorX + doorR + 30 * k, doorY - doorR - 20 * k);
  rock.lineTo(doorX + doorR + 60 * k, doorY + 10 * k);
  rock.lineTo(doorX + doorR + 90 * k, ground - 20 * k);
  rock.lineTo(doorX + doorR + 110 * k, height);
  rock.close();
  shade.moveTo(doorX + doorR + 30 * k, doorY - doorR - 20 * k);
  shade.lineTo(doorX + doorR + 60 * k, doorY + 10 * k);
  shade.lineTo(doorX + doorR + 90 * k, ground - 20 * k);
  shade.lineTo(doorX + doorR + 40 * k, ground - 30 * k);
  shade.close();
  for (let i = 0; i < 6; i += 1) {
    const x = doorX - 60 * k + hash(i, 3) * 120 * k;
    const y = doorY - doorR - 60 * k + hash(i, 4) * 40 * k;
    shade.moveTo(x, y);
    shade.lineTo(x + 18 * k, y + 4 * k);
    shade.lineTo(x + 8 * k, y + 7 * k);
    shade.close();
  }
  // kapı yuvası + çerçeve
  const hole = Skia.Path.Make();
  hole.addCircle(doorX, doorY, doorR * 1.02);
  const frame = Skia.Path.Make();
  frame.addCircle(doorX, doorY, doorR * 1.16);
  // geçit platformu
  frame.addRect(Skia.XYWHRect(doorX - doorR * 1.1, doorY + doorR * 0.98, doorR * 2.6, 6 * k));
  // direk, enkaz, pano
  const pylon = Skia.Path.Make();
  const px = width * 0.76;
  const py = ridgeY(back.pts, px) + 6 * k;
  const lean = 0.14;
  const tx = (y) => px + (py - y) * lean;
  pylon.moveTo(px - 12 * k, py);
  pylon.lineTo(tx(py - 120 * k) - 2 * k, py - 120 * k);
  pylon.moveTo(px + 12 * k, py);
  pylon.lineTo(tx(py - 120 * k) + 2 * k, py - 120 * k);
  for (let j = 0; j < 6; j += 1) {
    const y0 = py - j * 20 * k;
    const y1 = y0 - 20 * k;
    const w0 = 12 * k * (1 - j / 6.6);
    const w1 = 12 * k * (1 - (j + 1) / 6.6);
    pylon.moveTo(tx(y0) - w0, y0);
    pylon.lineTo(tx(y1) + w1, y1);
    pylon.moveTo(tx(y0) + w0, y0);
    pylon.lineTo(tx(y1) - w1, y1);
  }
  pylon.moveTo(tx(py - 104 * k) - 26 * k, py - 104 * k);
  pylon.lineTo(tx(py - 104 * k) + 26 * k, py - 100 * k);
  pylon.moveTo(tx(py - 104 * k) + 26 * k, py - 100 * k);
  pylon.quadTo(tx(py - 104 * k) + 70 * k, py - 60 * k, width + 20 * k, py - 76 * k); // kopuk kablo
  const board = Skia.Path.Make();
  const bx = width * 0.5;
  const by = ridgeY(back.pts, bx) + 4 * k;
  board.addRect(Skia.XYWHRect(bx - 30 * k, by - 66 * k, 60 * k, 30 * k));
  board.addRect(Skia.XYWHRect(bx - 22 * k, by - 36 * k, 2.4 * k, 36 * k));
  board.addRect(Skia.XYWHRect(bx + 20 * k, by - 36 * k, 2.4 * k, 36 * k));
  const boardRip = Skia.Path.Make();
  boardRip.moveTo(bx - 4 * k, by - 66 * k);
  boardRip.lineTo(bx + 8 * k, by - 50 * k);
  boardRip.lineTo(bx + 2 * k, by - 44 * k);
  boardRip.lineTo(bx + 18 * k, by - 36 * k);
  boardRip.lineTo(bx + 30 * k, by - 36 * k);
  boardRip.lineTo(bx + 30 * k, by - 66 * k);
  boardRip.close();
  // eski araba enkazı (yuvarlak hatlı), kuma gömülü
  const wreck = Skia.Path.Make();
  const rust = Skia.Path.Make();
  const wx = width * 0.66;
  const wy = ridgeY(dunes.pts, wx) + 8 * k;
  wreck.moveTo(wx - 34 * k, wy);
  wreck.quadTo(wx - 36 * k, wy - 14 * k, wx - 22 * k, wy - 16 * k);
  wreck.quadTo(wx - 12 * k, wy - 30 * k, wx + 6 * k, wy - 28 * k);
  wreck.quadTo(wx + 16 * k, wy - 18 * k, wx + 30 * k, wy - 15 * k);
  wreck.quadTo(wx + 38 * k, wy - 12 * k, wx + 36 * k, wy);
  wreck.close();
  rust.moveTo(wx - 8 * k, wy - 26 * k);
  rust.lineTo(wx + 4 * k, wy - 26 * k);
  rust.lineTo(wx + 12 * k, wy - 17 * k);
  rust.lineTo(wx - 10 * k, wy - 17 * k);
  rust.close();
  rust.addCircle(wx - 20 * k, wy - 3 * k, 6 * k);
  rust.addRect(Skia.XYWHRect(wx - 30 * k, wy - 12 * k, 64 * k, 1.6 * k));
  return { dunes, back, rock, shade, hole, frame, pylon, board, boardRip, wreck, rust };
}

/** Kapı (merkez 0,0): dişli kenar, halkalar, cıvatalar, göbek. */
function buildDoor(r, k) {
  const door = Skia.Path.Make();
  const rim = Skia.Path.Make();
  const dark = Skia.Path.Make();
  const T = 18;
  for (let i = 0; i < T; i += 1) {
    const a0 = (i / T) * Math.PI * 2;
    const a1 = ((i + 0.5) / T) * Math.PI * 2;
    const a2 = ((i + 1) / T) * Math.PI * 2;
    const ro = r;
    const ri = r * 0.9;
    if (i === 0) door.moveTo(Math.cos(a0) * ro, Math.sin(a0) * ro);
    door.lineTo(Math.cos(a0 + 0.04) * ro, Math.sin(a0 + 0.04) * ro);
    door.lineTo(Math.cos(a1 - 0.04) * ro, Math.sin(a1 - 0.04) * ro);
    door.lineTo(Math.cos(a1 + 0.03) * ri, Math.sin(a1 + 0.03) * ri);
    door.lineTo(Math.cos(a2 - 0.03) * ri, Math.sin(a2 - 0.03) * ri);
  }
  door.close();
  rim.addCircle(0, 0, r * 0.82);
  dark.addCircle(0, 0, r * 0.74);
  const inner = Skia.Path.Make();
  inner.addCircle(0, 0, r * 0.7);
  const hub = Skia.Path.Make();
  hub.addCircle(0, 0, r * 0.3);
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    dark.addCircle(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78, 1.6 * k);
  }
  // göbekten çıkan 6 kalın kol
  const spokes = Skia.Path.Make();
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + 0.26;
    const nx = -Math.sin(a) * 3 * k;
    const ny = Math.cos(a) * 3 * k;
    spokes.moveTo(Math.cos(a) * r * 0.3 + nx, Math.sin(a) * r * 0.3 + ny);
    spokes.lineTo(Math.cos(a) * r * 0.66 + nx, Math.sin(a) * r * 0.66 + ny);
    spokes.lineTo(Math.cos(a) * r * 0.66 - nx, Math.sin(a) * r * 0.66 - ny);
    spokes.lineTo(Math.cos(a) * r * 0.3 - nx, Math.sin(a) * r * 0.3 - ny);
    spokes.close();
  }
  hub.addCircle(0, 0, r * 0.12);
  return { door, rim, dark, inner, hub, spokes };
}

// ───────────────────────────── olaylar

/** A olayında kapının açılma oranı 0…1 (geri çekil + yuvarlan, sonra kapan). */
function doorOpen(u) {
  "worklet";
  return sm(0.16, 0.32, u) * (1 - sm(0.8, 0.94, u));
}

function VaultDoor({ p, clock, L, door, c }) {
  const { doorX, doorY, doorR, k } = L;
  const open = useDerivedValue(() => {
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 0) return 0;
    return doorOpen(u);
  });
  const at = useDerivedValue(() => {
    const o = open.value;
    const back = sm(0, 0.25, o);
    const roll = sm(0.2, 1, o) * doorR * 2.15;
    return [{ translateX: doorX + roll }, { translateY: doorY + back * 2 * k }, { rotate: roll / doorR }, { scale: 1 - back * 0.05 }];
  });
  const light = useDerivedValue(() => sm(0.3, 0.9, open.value));
  // uyarı lambası: dönen sarı ışık (yumuşak, yavaş)
  const beacon = useDerivedValue(() => {
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 0) return 0;
    const on = sm(0.08, 0.12, u) * (1 - sm(0.36, 0.42, u));
    return on * (0.45 + 0.55 * Math.max(0, Math.sin(clock.value * 4.2)));
  });
  return (
    <>
      <Group opacity={light}>
        <Group transform={[{ translateX: doorX }, { translateY: doorY }]}>
          <Glow r={doorR * 2.4} color={c.holeLit} a={0.55} mid={0.35} />
        </Group>
        <Path path={`M ${doorX} ${doorY} m ${-doorR} 0 a ${doorR} ${doorR} 0 1 0 ${doorR * 2} 0 a ${doorR} ${doorR} 0 1 0 ${-doorR * 2} 0`} color={c.holeLit} />
      </Group>
      <Group transform={at}>
        <Path path={door.door} color={c.door} />
        <Path path={door.rim} color={c.doorRim} />
        <Path path={door.dark} color={c.doorDark} />
        <Path path={door.inner} color={c.door} />
        <Path path={door.spokes} color={c.doorRim} />
        <Path path={door.hub} color={c.doorDark} />
      </Group>
      <Group opacity={beacon}>
        <Group transform={[{ translateX: doorX + doorR * 1.05 }, { translateY: doorY - doorR * 1.2 }]}>
          <Glow r={24 * k} color={c.beacon} a={0.8} mid={0.35} />
        </Group>
      </Group>
      <Path
        path={`M ${doorX + doorR * 1.05 - 3 * k} ${doorY - doorR * 1.2 + 4 * k} L ${doorX + doorR * 1.05 + 3 * k} ${doorY - doorR * 1.2 + 4 * k} L ${doorX + doorR * 1.05 + 2.4 * k} ${doorY - doorR * 1.2 - 3 * k} L ${doorX + doorR * 1.05 - 2.4 * k} ${doorY - doorR * 1.2 - 3 * k} Z`}
        color={c.beacon}
        opacity={0.8}
      />
    </>
  );
}

function Dweller({ p, clock, L, c }) {
  const { doorX, doorY, doorR, k } = L;
  const show = useDerivedValue(() => {
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 0) return 0;
    return sm(0.34, 0.4, u) * (1 - sm(0.74, 0.8, u));
  });
  const walk = (u) => {
    "worklet";
    return sm(0.34, 0.5, u);
  };
  const at = useDerivedValue(() => {
    const u = Math.min(1, restU(p, clock.value));
    const x = doorX + walk(u) * doorR * 1.1;
    const s = k * (1.6 + walk(u) * 0.35);
    return [{ translateX: x }, { translateY: doorY + doorR * 0.98 }, { scale: s }];
  });
  const legs = useDerivedValue(() => {
    const u = Math.min(1, restU(p, clock.value));
    const moving = u > 0.34 && u < 0.5 ? 1 : 0;
    const a = Math.sin(clock.value * 8) * 0.45 * moving;
    const q = Skia.Path.Make();
    q.moveTo(0, -12);
    q.lineTo(Math.sin(a) * 12, Math.cos(a) * 12 - 12);
    q.moveTo(0, -12);
    q.lineTo(-Math.sin(a) * 12, Math.cos(a) * 12 - 12);
    return q;
  });
  // el göze siper (0.52–0.7)
  const arm = useDerivedValue(() => {
    const u = Math.min(1, restU(p, clock.value));
    const up = sm(0.5, 0.55, u) * (1 - sm(0.68, 0.72, u));
    const q = Skia.Path.Make();
    q.moveTo(0.6, -22);
    q.lineTo(3 + up * 2, -16 + -up * 11);
    q.lineTo(5 - up * 1, -12 + -up * 17.4);
    return q;
  });
  return (
    <Group opacity={show}>
      <Group transform={at}>
        <Path path={legs} style="stroke" strokeWidth={3.2} strokeCap="round" color={c.suit} />
        <Path path="M -3.4 -11 L -3.6 -23 Q 0 -25.4 3.6 -23 L 3.4 -11 Z" color={c.suit} />
        <Path path="M -0.6 -24 L 0.6 -24 L 0.6 -11 L -0.6 -11 Z" color={c.suitStripe} />
        <Path path={arm} style="stroke" strokeWidth={2.2} strokeCap="round" strokeJoin="round" color={c.suit} />
        <Path path="M 0 -28 m -2.8 0 a 2.8 3 0 1 0 5.6 0 a 2.8 3 0 1 0 -5.6 0" color={c.skin} />
        <Path path="M -2.9 -28.6 Q -2.4 -31.6 0.4 -31.4 Q 3 -31.2 2.8 -29.4 Q 0 -30 -2.9 -28.6 Z" color={c.craftDark} />
      </Group>
    </Group>
  );
}

const CRAFT_BODY =
  "M -34 -2 Q -36 -8 -28 -9 L 8 -10 Q 16 -12 24 -8 L 34 -5 Q 36 -2 32 0 L 18 2 L -26 2 Q -32 2 -34 -2 Z M -30 -9 L -38 -20 L -33 -20 L -22 -9 Z";

function Vertibird({ p, clock, L, land, c }) {
  const { k, width, horizon, duneBase } = L;
  const pos = (u) => {
    "worklet";
    const e = sm(0.06, 0.88, u);
    const x = width + 70 * k - (width + 140 * k) * e;
    const y = horizon - 150 * k + Math.sin(e * Math.PI) * 120 * k;
    return [x, y];
  };
  const show = useDerivedValue(() => {
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 1) return 0;
    return sm(0.06, 0.12, u) * (1 - sm(0.82, 0.88, u));
  });
  const at = useDerivedValue(() => {
    const u = Math.min(1, restU(p, clock.value));
    const [x, y] = pos(u);
    return [{ translateX: x }, { translateY: y + Math.sin(clock.value * 2) * 2 * k }, { scale: k * 1.15 }, { rotate: -0.04 + Math.sin(clock.value * 1.3) * 0.02 }];
  });
  // pervane diskleri: hızlı dönüş = basık elips nefesi
  const rotor = useDerivedValue(() => 0.35 + 0.25 * Math.abs(Math.sin(clock.value * 30)));
  // projektör konisi: yere doğru, yavaş tarar
  const beam = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const u = Math.min(1, restU(p, clock.value));
    const [x, y] = pos(u);
    const gy = ridgeY(land.dunes.pts, Math.max(0, Math.min(width, x))) + 10 * k;
    const sw = Math.sin(clock.value * 0.9) * 50 * k;
    q.moveTo(x - 6 * k, y + 4 * k);
    q.lineTo(x - 40 * k + sw, gy);
    q.lineTo(x + 30 * k + sw, gy);
    q.close();
    return q;
  });
  // toz: uçak alçaldığında, altında
  const dust = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 1) return q;
    const [x, y] = pos(u);
    const low = sm(horizon - 60 * k, horizon - 30 * k, y);
    if (low < 0.02) return q;
    const gy = ridgeY(land.dunes.pts, Math.max(0, Math.min(width, x))) + 6 * k;
    for (let i = 0; i < 16; i += 1) {
      const f = (clock.value * 0.8 + hash(i, 1)) % 1;
      const side = i % 2 === 0 ? -1 : 1;
      q.addCircle(x + side * (8 + f * 70) * k, gy - f * 18 * k, (4 + f * 12) * k * low * (1 - f * 0.5));
    }
    return q;
  });
  return (
    <Group opacity={show}>
      <Group opacity={0.3}>
        <Path path={beam}>
          <LinearGradient start={vec(0, horizon - 100 * k)} end={vec(0, duneBase + 20 * k)} colors={[rgba(c.beam, 0.9), rgba(c.beam, 0.15)]} />
        </Path>
      </Group>
      <Path path={dust} color={c.dust} opacity={0.5} />
      <Group transform={at}>
        <Path path={CRAFT_BODY} color={c.craft} />
        <Path path="M -4 -8.6 L 12 -9.4 Q 18 -9 22 -6.6 L 6 -6 Z" color={c.craftDark} />
        {/* kanat + iki nasel */}
        <Path path="M -14 -10 L 14 -10 L 14 -7.6 L -14 -7.6 Z" color={c.craftDark} />
        <Path path="M -18 -16 L -10 -16 L -10 -8 L -18 -8 Z M 10 -16 L 18 -16 L 18 -8 L 10 -8 Z" color={c.craft} />
        <Group opacity={rotor}>
          <Path path="M -14 -17 m -16 0 a 16 2.4 0 1 0 32 0 a 16 2.4 0 1 0 -32 0 M 14 -17 m -16 0 a 16 2.4 0 1 0 32 0 a 16 2.4 0 1 0 -32 0" color={c.rotor} />
        </Group>
        <Path path="M 25 -3 m -1.6 0 a 1.6 1.6 0 1 0 3.2 0 a 1.6 1.6 0 1 0 -3.2 0" color={c.beam} />
      </Group>
    </Group>
  );
}

export default function FalloutScene({ p, clock, width, height, tone, lightSurface }) {
  const L = useMemo(() => foLayout(width, height), [width, height]);
  const city = useMemo(() => buildCity(L), [L]);
  const land = useMemo(() => buildLand(L), [L]);
  const door = useMemo(() => buildDoor(L.doorR, L.k), [L]);
  const c = useMemo(() => toneMap(FO_TONE, tone.colors), [tone]);
  const { k, horizon } = L;
  const night = !lightSurface;
  const sunX = width * 0.7;
  const sunY = horizon - 150 * k;
  return (
    <Group opacity={tone.alpha}>
      <Rect x={0} y={horizon - 360 * k} width={width} height={360 * k}>
        <LinearGradient start={vec(0, horizon - 360 * k)} end={vec(0, horizon)} colors={[rgba(c.sky2, 0), rgba(c.haze, night ? 0.75 : 0.65)]} />
      </Rect>
      <Group transform={[{ translateX: sunX }, { translateY: sunY }]}>
        <Glow r={130 * k} color={c.sun} a={night ? 0.35 : 0.5} mid={0.3} />
      </Group>
      <Path path={`M ${sunX} ${sunY} m ${-30 * k} 0 a ${30 * k} ${30 * k} 0 1 0 ${60 * k} 0 a ${30 * k} ${30 * k} 0 1 0 ${-60 * k} 0`} color={c.sun} opacity={0.8} />
      <Path path={city.far} color={c.cityFar} />
      <Path path={city.near} color={c.city} />
      <Rect x={0} y={horizon - 40 * k} width={width} height={50 * k}>
        <LinearGradient start={vec(0, horizon - 40 * k)} end={vec(0, horizon + 10 * k)} colors={[rgba(c.haze, 0), rgba(c.haze, 0.55)]} />
      </Rect>
      <Path path={land.back.path} color={c.duneShade} />
      <Path path={land.pylon} style="stroke" strokeWidth={1.5 * k} color={c.pylon} />
      <Path path={land.board} color={c.pylon} />
      <Path path={land.boardRip} color={c.duneShade} />
      <Path path={land.dunes.path} color={c.dune} />
      <Path path={land.wreck} color={c.wreck} />
      <Path path={land.rust} color={c.rust} />
      <Vertibird p={p} clock={clock} L={L} land={land} c={c} />
      <Path path={land.rock} color={c.rock} />
      <Path path={land.shade} color={c.rockShade} />
      <Path path={land.frame} color={c.doorRim} />
      <Path path={land.hole} color={c.hole} />
      <VaultDoor p={p} clock={clock} L={L} door={door} c={c} />
      <Dweller p={p} clock={clock} L={L} c={c} />
    </Group>
  );
}
