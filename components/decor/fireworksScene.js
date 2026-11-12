// components/decor/fireworksScene.js
//
// Havai fişek atmosfer sahnesi (OVERLAY.fireworks = 47) — tamamı VEKTÖR (eski nokta-parçacık
// patlamalarının yerine; seçicide tek başına seçilince yalnız bu sahne çizilir):
//   • Nehir kıyısında şehir: iki katman bina silüeti, yanıp sönen pencereler, kulelerde kırmızı
//     uyarı ışıkları; solda ışıkları dönen dönme dolap; nehirde iki fişek mavnası.
//   • Fişekler: altı yuva, her biri kendi döngüsünde — mavnadan kuyruklu roket yükselir, gökte
//     patlar. Beş tür: şakayık (çift renkli olabilir), krizantem (uzun izli), söğüt (sarkan altın
//     saçaklar), halka (eğik elips) ve palmiye (kalın kollar). Patlama anında parlama + göğe vuran
//     ışık, sonunda çıtırtı (altın kıvılcım), ardından dağılan duman. Her patlama suda renkli
//     titreşen çizgilerle yansır; şehir silüeti de suya yansır.
//   • Olay (52 sn'de bir ~21 sn): büyük final — altı yuva daha hızlı döngüyle devreye girer
//     (söğüt / palmiye / şakayık ağırlıklı), gök ve su aydınlanır.
//
// Ölçek: sceneScale (k). Su çizgisi zeminin (SCENERY.lift) üstünde; su sekme çubuğunun altına
// kadar iner. Renkler OVERLAY_TONES[47] (FW_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import {
  Circle,
  Group,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Skia,
  vec,
} from "@shopify/react-native-skia";
import { restU } from "../../utils/weatherParticles";
import { Glow, TAU, groundLayout, hash, rgba, sm, toneMap } from "./seasonKit";

export const FW_TONE = [
  "horizon",
  "cityFar",
  "city",
  "window",
  "water",
  "waterDeep",
  "quay",
  "wheel",
  "wheelLight",
  "fw1",
  "fw2",
  "fw3",
  "fw4",
  "fw5",
  "fw6",
  "gold",
  "smoke",
  "flash",
  "beacon",
  "barge",
];

const SLOTS = 7; // sürekli yuvalar
const FINALE = 6; // olayda devreye giren yuvalar

export function fwLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  const waterTop = ground - 58 * k;
  return {
    ...L,
    waterTop,
    barges: [width * 0.32, width * 0.72],
    wheel: [width * 0.17, waterTop - 82 * k, 64 * k],
  };
}

function buildCity(L) {
  const { k, width, waterTop } = L;
  const far = Skia.Path.Make();
  const near = Skia.Path.Make();
  const winA = Skia.Path.Make();
  const winB = Skia.Path.Make();
  const reflA = Skia.Path.Make();
  const beacons = [];
  // uzak sıra: alçak, sık
  let x = -12 * k;
  let i = 0;
  while (x < width + 12 * k) {
    const w = (14 + hash(i, 1) * 18) * k;
    const h = (34 + hash(i, 2) * 70) * k;
    far.addRect(Skia.XYWHRect(x, waterTop - h, w + 1, h + 1));
    if (hash(i, 3) > 0.78) {
      far.addRect(Skia.XYWHRect(x + w * 0.45, waterTop - h - 16 * k, 2 * k, 16 * k));
    }
    x += w;
    i += 1;
  }
  // yakın sıra: dolabın sağından itibaren uzun binalar
  x = width * 0.3;
  i = 0;
  let tallest = [];
  while (x < width + 12 * k) {
    const w = (20 + hash(i, 11) * 26) * k;
    const tall = hash(i, 12);
    const h = (46 + tall * tall * 140) * k;
    const top = waterTop - h;
    near.addRect(Skia.XYWHRect(x, top, w + 1, h + 1));
    // çatı biçimi: basamak, sivri ya da anten
    const roof = hash(i, 13);
    if (roof > 0.72) {
      near.moveTo(x + w * 0.2, top);
      near.lineTo(x + w * 0.5, top - 22 * k);
      near.lineTo(x + w * 0.8, top);
      near.close();
    } else if (roof > 0.45) {
      near.addRect(Skia.XYWHRect(x + w * 0.22, top - 9 * k, w * 0.56, 9 * k + 1));
    }
    if (h > 120 * k) tallest.push([x + w / 2, top - (roof > 0.72 ? 22 : roof > 0.45 ? 9 : 0) * k, h]);
    // pencereler: ızgara, rastgele yanık
    const cols = Math.max(1, Math.floor((w - 6 * k) / (7 * k)));
    const rows = Math.max(1, Math.floor((h - 12 * k) / (9 * k)));
    const ox = x + (w - cols * 7 * k) / 2 + 2 * k;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const v = hash(i * 31 + r * 7 + c, 14);
        if (v > 0.36) continue;
        const wx = ox + c * 7 * k;
        const wy = top + 8 * k + r * 9 * k;
        (v < 0.18 ? winA : winB).addRect(Skia.XYWHRect(wx, wy, 3.2 * k, 4.2 * k));
        // suya yansıyan ışık: kısa yatay çizgi (aşağı doğru seyrek)
        if (v < 0.12 && r % 2 === 0) {
          const ry = waterTop + 3 * k + (waterTop - wy) * 0.3;
          reflA.addRect(Skia.XYWHRect(wx - 2 * k, ry, (5 + hash(i + r, c) * 7) * k, 1.3 * k));
        }
      }
    }
    x += w + (hash(i, 15) > 0.7 ? 4 * k : 0);
    i += 1;
  }
  tallest = tallest.sort((a, b) => b[2] - a[2]).slice(0, 3);
  tallest.forEach(([bx, by]) => {
    near.addRect(Skia.XYWHRect(bx - 0.8 * k, by - 18 * k, 1.6 * k, 18 * k));
    beacons.push([bx, by - 18 * k]);
  });
  // rıhtım fenerleri
  const lamps = Skia.Path.Make();
  const lampDots = [];
  for (let j = 0; j < 7; j += 1) {
    const lx = width * (0.06 + j * 0.155);
    lamps.addRect(Skia.XYWHRect(lx - 0.7 * k, waterTop - 14 * k, 1.4 * k, 14 * k));
    lampDots.push([lx, waterTop - 15 * k]);
  }
  return { far, near, winA, winB, reflA, beacons, lamps, lampDots };
}

function buildWheel(L) {
  const { k, waterTop } = L;
  const [cx, cy, R] = L.wheel;
  const frame = Skia.Path.Make(); // dönen kısım (yerel, merkez 0,0)
  const n = 16;
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * TAU;
    frame.moveTo(0, 0);
    frame.lineTo(Math.cos(a) * R, Math.sin(a) * R);
    const b = ((i + 1) / n) * TAU;
    frame.moveTo(Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86);
    frame.lineTo(Math.cos(b) * R, Math.sin(b) * R);
  }
  const rim = Skia.Path.Make();
  rim.addCircle(0, 0, R);
  rim.addCircle(0, 0, R * 0.86);
  const cabins = Skia.Path.Make();
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * TAU;
    cabins.addCircle(Math.cos(a) * R, Math.sin(a) * R, 3.4 * k);
  }
  const bulbsA = Skia.Path.Make();
  const bulbsB = Skia.Path.Make();
  for (let i = 0; i < 48; i += 1) {
    const a = (i / 48) * TAU + 0.07;
    (i % 2 ? bulbsA : bulbsB).addCircle(Math.cos(a) * R * 0.93, Math.sin(a) * R * 0.93, 1.3 * k);
  }
  const legs = Skia.Path.Make();
  legs.moveTo(cx - 34 * k, waterTop - 2 * k);
  legs.lineTo(cx, cy);
  legs.lineTo(cx + 34 * k, waterTop - 2 * k);
  legs.moveTo(cx - 20 * k, waterTop - 40 * k);
  legs.lineTo(cx + 20 * k, waterTop - 40 * k);
  return { frame, rim, cabins, bulbsA, bulbsB, legs };
}

// ───────────────────────────── fişek mekaniği (worklet)

/** Yuvanın döngü parametreleri: tür, konum, renk, süreler. */
function shellOf(i, cyc, fin, width, height, k, bx0, bx1) {
  "worklet";
  const s = (cyc % 997) * 13.37 + i * 7.1 + (fin ? 401 : 0);
  const h = (n) => hash(s, n);
  let type = Math.floor(h(1) * 5) % 5;
  if (fin) {
    const v = h(1);
    type = v < 0.38 ? 2 : v < 0.66 ? 0 : v < 0.86 ? 4 : 1;
  }
  const rise = (fin ? 0.75 : 1.0) + h(12) * 0.3;
  const dur = type === 2 ? 3.1 : type === 4 ? 2.6 : 2.2;
  return {
    type,
    bx: width * (0.12 + 0.76 * h(2)),
    by: height * (0.1 + 0.3 * h(3)),
    R: (fin ? 104 : 88) * k * (0.75 + 0.5 * h(4)),
    ci: Math.floor(h(5) * 6) % 6,
    ci2: (Math.floor(h(5) * 6) + 1 + Math.floor(h(6) * 4)) % 6,
    lx: (h(7) < 0.5 ? bx0 : bx1) + (h(8) - 0.5) * 30 * k,
    dbl: type === 0 && h(9) < 0.5,
    tilt: (h(10) - 0.5) * 1.3,
    squash: 0.32 + 0.3 * h(11),
    rise,
    dur,
    n: type === 0 ? 44 : type === 1 ? 36 : type === 2 ? 30 : type === 3 ? 36 : 12,
  };
}

/** Patlama içindeki j. yıldızın τ anındaki konumu. */
function starPos(S, j, tau, k, out) {
  "worklet";
  const inner = S.dbl && j % 2 === 1;
  const a = (j / S.n) * TAU + (hash(j, S.ci + 3) - 0.5) * 0.2;
  let dx = Math.cos(a);
  let dy = Math.sin(a);
  if (S.type === 3) {
    // halka: eğik elips
    const ex = dx;
    const ey = dy * S.squash;
    dx = ex * Math.cos(S.tilt) - ey * Math.sin(S.tilt);
    dy = ex * Math.sin(S.tilt) + ey * Math.cos(S.tilt);
  }
  const spread = inner ? 0.55 : 0.88 + hash(j, 9) * 0.12;
  const ex = (1 - Math.exp(-4.2 * tau)) / (1 - Math.exp(-4.2));
  const R = S.R * spread * (S.type === 4 ? 0.85 : 1);
  const G = (S.type === 2 ? 95 : S.type === 4 ? 60 : 38) * k;
  out[0] = S.bx + dx * R * ex;
  out[1] = S.by + dy * R * ex + G * tau * tau;
}

function shellFrame(i, fin, t, p, L, k, width, height) {
  "worklet";
  const per = fin ? 3.0 + hash(i, 21) * 0.8 : 4.4 + hash(i, 1) * 1.4;
  const off = hash(i, fin ? 22 : 2) * per;
  const local = (t + off) / per;
  const cyc = Math.floor(local);
  const sec = (local - cyc) * per;
  const empty = {
    on: 0,
    streak: Skia.Path.Make(),
    head: Skia.Path.Make(),
    head2: Skia.Path.Make(),
    glit: Skia.Path.Make(),
    refl: Skia.Path.Make(),
    rocket: Skia.Path.Make(),
    ci: 0,
    ci2: 0,
    x: 0,
    y: 0,
    alpha: 0,
    flash: 0,
    sky: 0,
    smoke: 0,
    tau: 0,
  };
  if (fin) {
    // final yuvası yalnız döngüsü olay penceresinde BAŞLAYAN turlarda (yarıda kesilmez)
    const u = restU(p, cyc * per - off);
    if (u > 1 || u < 0.05 || u > 0.84) return empty;
  }
  const S = shellOf(i, cyc, fin, width, height, k, L.barges[0], L.barges[1]);
  const out = [0, 0];
  const prev = [0, 0];
  const r = empty;
  r.ci = S.ci;
  r.ci2 = S.ci2;
  if (sec < S.rise) {
    // roket: mavnadan patlama noktasına, yavaşlayarak
    const e = sec / S.rise;
    const ease = (q) => 1 - (1 - q) * (1 - q);
    const pos = (q) => {
      const qq = ease(q < 0 ? 0 : q);
      return [
        S.lx + (S.bx - S.lx) * qq + Math.sin(q * 22 + i) * 1.6 * k * (1 - q),
        L.waterTop - 4 * k + (S.by - L.waterTop) * qq,
      ];
    };
    const [x, y] = pos(e);
    const [x0, y0] = pos(e - 0.16);
    r.rocket.moveTo(x0, y0);
    r.rocket.lineTo(x, y);
    r.head.addCircle(x, y, 1.9 * k);
    for (let j = 0; j < 5; j += 1) {
      const q = e - 0.04 - j * 0.035;
      if (q <= 0) break;
      const [sx, sy] = pos(q);
      r.glit.addCircle(sx + (hash(j, Math.floor(t * 20)) - 0.5) * 4 * k, sy + j * 2 * k, (1.1 - j * 0.15) * k);
    }
    r.on = 1;
    r.x = x;
    r.y = y;
    r.alpha = 1;
    r.ci = 5; // roket başı her zaman açık renk (fw6)
    r.tau = -1;
    // suda roketin küçük yansıması
    for (let j = 0; j < 4; j += 1) {
      const ry = L.waterTop + 4 * k + j * 5 * k;
      const w = (5 - j) * 2 * k;
      r.refl.addRect(Skia.XYWHRect(S.lx - w / 2 + Math.sin(t * 3 + j) * 2 * k, ry, w, 1.2 * k));
    }
    return r;
  }
  const tau = (sec - S.rise) / S.dur;
  if (tau >= 1) return empty;
  const fade = 1 - sm(S.type === 2 ? 0.6 : 0.5, 1, tau);
  const lag = S.type === 2 ? 0.32 : S.type === 1 ? 0.17 : S.type === 4 ? 0.24 : S.type === 3 ? 0.05 : 0.08;
  const crackle = S.type === 0 || S.type === 1 ? sm(0.55, 0.7, tau) : 0;
  const cap = S.type === 4 ? 0.95 : 1;
  for (let j = 0; j < S.n; j += 1) {
    starPos(S, j, tau, k, out);
    const tl = tau - lag;
    starPos(S, j, tl < 0 ? 0 : tl, k, prev);
    const tm = tau - lag * 0.5;
    const mid = [0, 0];
    starPos(S, j, tm < 0 ? 0 : tm, k, mid);
    r.streak.moveTo(prev[0], prev[1]);
    r.streak.quadTo(mid[0], mid[1], out[0], out[1]);
    const inner = S.dbl && j % 2 === 1;
    const hr = (S.type === 4 ? 3 : S.type === 2 ? 1.4 : 2.1) * k * (1 - tau * 0.45) * cap;
    if (crackle > 0 && hash(j + S.ci, Math.floor(t * 15)) < crackle * 0.7) {
      // çıtırtı: yıldız sönüp yerinde altın kıvılcım çakar
      r.glit.addCircle(
        out[0] + (hash(j, Math.floor(t * 15) + 1) - 0.5) * 6 * k,
        out[1] + (hash(j, Math.floor(t * 15) + 2) - 0.5) * 6 * k,
        1.1 * k,
      );
    } else if (S.type !== 2 || tau < 0.35) {
      (inner ? r.head2 : r.head).addCircle(out[0], out[1], hr);
    }
  }
  // patlama suda: renkli titreşen yatay çizgiler (alta doğru seyrelir)
  const br = (1 - tau) * (1 - tau);
  for (let j = 0; j < 10; j += 1) {
    const ry = L.waterTop + 4 * k + j * 5.5 * k * (1 + j * 0.12);
    const hw = (16 + j * 4) * k * (0.5 + 0.5 * br);
    for (let m = 0; m < 2; m += 1) {
      const x = S.bx + (hash(j * 3 + m, S.ci) - 0.5) * 2 * hw + Math.sin(t * 2.2 + j + m) * 4 * k;
      const len = (6 + 10 * hash(j, m + S.ci2)) * k * (1 - j * 0.05);
      r.refl.addRect(Skia.XYWHRect(x - len / 2, ry, len, 1.4 * k));
    }
  }
  r.on = 1;
  r.x = S.bx;
  r.y = S.by;
  r.alpha = fade;
  r.flash = tau < 0.14 ? 1 - tau / 0.14 : 0;
  r.sky = (1 - sm(0, 0.55, tau)) * (S.type === 2 ? 1.2 : 1);
  r.smoke = sm(0.2, 0.5, tau) * (1 - sm(0.7, 1, tau));
  r.tau = tau;
  return r;
}

/** "#rrggbb" → [r, g, b] (JS'te bir kez; kare başına rgba dizgesi kurulur). */
function rgbOf(hex) {
  const n = parseInt(String(hex).replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function Shell({ i, fin, p, clock, L, c, cols, rgbs }) {
  const { k, width, height } = L;
  const d = useDerivedValue(() => shellFrame(i, fin, clock.value, p, L, k, width, height));
  const streak = useDerivedValue(() => d.value.streak);
  const head = useDerivedValue(() => d.value.head);
  const head2 = useDerivedValue(() => d.value.head2);
  const glit = useDerivedValue(() => d.value.glit);
  const refl = useDerivedValue(() => d.value.refl);
  const rocket = useDerivedValue(() => d.value.rocket);
  const col = useDerivedValue(() => cols[d.value.ci]);
  const col2 = useDerivedValue(() => cols[d.value.ci2]);
  const alpha = useDerivedValue(() => d.value.alpha);
  const streakA = useDerivedValue(() => d.value.alpha * (d.value.tau < 0 ? 0 : 0.7));
  const reflA = useDerivedValue(() => (d.value.tau < 0 ? 0.6 : d.value.alpha * 0.85));
  const at = useDerivedValue(() => [{ translateX: d.value.x }, { translateY: d.value.y }]);
  const flash = useDerivedValue(() => d.value.flash);
  // göğe vuran ışık fişeğin renginde
  const skyCols = useDerivedValue(() => {
    const [r, g, b] = rgbs[d.value.ci];
    const a = d.value.sky * 0.2;
    return [`rgba(${r},${g},${b},${a})`, `rgba(${r},${g},${b},${a * 0.35})`, `rgba(${r},${g},${b},0)`];
  });
  const smokeT = useDerivedValue(() => [
    { translateX: d.value.x + d.value.tau * 14 * k },
    { translateY: d.value.y + d.value.tau * 24 * k },
    { scale: 0.6 + Math.max(0, d.value.tau) * 0.9 },
  ]);
  const smoke = useDerivedValue(() => d.value.smoke * 0.5);
  const willow = useDerivedValue(() => (d.value.tau >= 0 ? 1 : 0));
  return (
    <Group>
      {/* göğe vuran ışık + duman (yıldızların arkasında) */}
      <Group transform={at}>
        <Circle cx={0} cy={0} r={220 * k}>
          <RadialGradient c={vec(0, 0)} r={220 * k} colors={skyCols} positions={[0, 0.4, 1]} />
        </Circle>
      </Group>
      <Group transform={smokeT} opacity={smoke}>
        <Glow r={60 * k} color={c.smoke} a={0.16} mid={0.6} />
      </Group>
      <Path path={rocket} style="stroke" strokeWidth={1.6 * k} strokeCap="round" color={c.gold} opacity={0.85} />
      <Group opacity={willow}>
        <Path
          path={streak}
          style="stroke"
          strokeWidth={1.6 * k}
          strokeCap="round"
          color={col}
          opacity={streakA}
        />
      </Group>
      <Path path={head} color={col} opacity={alpha} />
      <Path path={head2} color={col2} opacity={alpha} />
      <Path path={glit} color={c.gold} opacity={alpha} />
      <Group transform={at} opacity={flash}>
        <Glow r={46 * k} color={c.flash} a={0.95} mid={0.35} />
      </Group>
      {/* suya yansıma */}
      <Path path={refl} color={col} opacity={reflA} />
    </Group>
  );
}

function Beacon({ clock, x, y, i, k, c }) {
  const op = useDerivedValue(() => (Math.sin(clock.value * 2.1 + i * 1.7) > 0.55 ? 1 : 0.15));
  return (
    <Group opacity={op}>
      <Glow cx={x} cy={y} r={7 * k} color={c.beacon} a={0.9} mid={0.4} />
      <Circle cx={x} cy={y} r={1.4 * k} color={c.beacon} />
    </Group>
  );
}

export default function FireworksScene({ p, clock, width, height, tone, lightSurface }) {
  const L = useMemo(() => fwLayout(width, height), [width, height]);
  const city = useMemo(() => buildCity(L), [L]);
  const wheel = useMemo(() => buildWheel(L), [L]);
  const c = useMemo(() => toneMap(FW_TONE, tone.colors), [tone]);
  const cols = useMemo(() => [c.fw1, c.fw2, c.fw3, c.fw4, c.fw5, c.fw6], [c]);
  const rgbs = useMemo(() => cols.map(rgbOf), [cols]);
  const { k, waterTop } = L;
  const night = !lightSurface;
  const [wx, wy, wr] = L.wheel;
  const spin = useDerivedValue(() => [{ translateX: wx }, { translateY: wy }, { rotate: clock.value * 0.07 }]);
  const winA = useDerivedValue(() => 0.75 + 0.25 * Math.sin(clock.value * 0.9));
  const winB = useDerivedValue(() => 0.75 + 0.25 * Math.sin(clock.value * 0.7 + 2));
  const chaseA = useDerivedValue(() => (Math.sin(clock.value * 4) > 0 ? 1 : 0.25));
  const chaseB = useDerivedValue(() => (Math.sin(clock.value * 4) > 0 ? 0.25 : 1));
  const reflShift = useDerivedValue(() => [{ translateX: Math.sin(clock.value * 1.3) * 2.5 * k }]);
  // final: gök ve su genel olarak aydınlanır
  const finale = useDerivedValue(() => {
    const u = restU(p, clock.value);
    return u > 1 ? 0 : sm(0.06, 0.2, u) * (1 - sm(0.8, 0.98, u));
  });
  const shells = [];
  for (let i = 0; i < SLOTS; i += 1) shells.push([i, false]);
  for (let i = 0; i < FINALE; i += 1) shells.push([i, true]);
  const mirror = [{ translateY: waterTop }, { scaleY: -0.34 }, { translateY: -waterTop }];
  return (
    <Group opacity={tone.alpha}>
      {/* ufuk ışığı (şehrin göğe vuran parıltısı) */}
      <Group transform={[{ translateX: width / 2 }, { translateY: waterTop }, { scaleY: 0.45 }]}>
        <Glow r={width * 0.95} color={c.horizon} a={night ? 0.42 : 0.3} mid={0.4} />
      </Group>
      <Group opacity={finale}>
        <Group transform={[{ translateX: width / 2 }, { translateY: height * 0.3 }]}>
          <Glow r={width * 0.9} color={c.flash} a={night ? 0.1 : 0.08} mid={0.5} />
        </Group>
      </Group>
      <Path path={city.far} color={c.cityFar} />
      <Path path={city.near} color={c.city} />
      <Group opacity={winA}>
        <Path path={city.winA} color={c.window} />
      </Group>
      <Group opacity={winB}>
        <Path path={city.winB} color={c.window} opacity={0.85} />
      </Group>
      {city.beacons.map(([x, y], i) => (
        <Beacon key={`b${i}`} clock={clock} x={x} y={y} i={i} k={k} c={c} />
      ))}
      {/* dönme dolap */}
      <Path path={wheel.legs} style="stroke" strokeWidth={2.6 * k} strokeCap="round" color={c.wheel} />
      <Group transform={spin}>
        <Path path={wheel.frame} style="stroke" strokeWidth={0.9 * k} color={c.wheel} />
        <Path path={wheel.rim} style="stroke" strokeWidth={1.6 * k} color={c.wheel} />
        <Group opacity={chaseA}>
          <Path path={wheel.bulbsA} color={c.wheelLight} />
        </Group>
        <Group opacity={chaseB}>
          <Path path={wheel.bulbsB} color={c.gold} />
        </Group>
        <Path path={wheel.cabins} color={c.window} opacity={0.9} />
      </Group>
      <Circle cx={wx} cy={wy} r={4 * k} color={c.wheel} />
      <Group opacity={night ? 0.5 : 0.35}>
        <Glow cx={wx} cy={wy} r={wr * 1.25} color={c.wheelLight} a={0.18} mid={0.4} />
      </Group>
      {/* rıhtım + fenerler */}
      <Path path={city.lamps} color={c.quay} />
      {city.lampDots.map(([x, y], i) => (
        <Glow key={`l${i}`} cx={x} cy={y} r={8 * k} color={c.window} a={0.85} mid={0.35} />
      ))}
      <Rect x={0} y={waterTop - 3 * k} width={width} height={4 * k} color={c.quay} />
      {/* nehir */}
      <Rect x={0} y={waterTop} width={width} height={height - waterTop + 20}>
        <LinearGradient start={vec(0, waterTop)} end={vec(0, height)} colors={[c.water, c.waterDeep]} />
      </Rect>
      {/* şehrin ve dolabın suya yansıması */}
      <Group transform={mirror} opacity={0.32}>
        <Path path={city.near} color={c.city} />
      </Group>
      <Group transform={reflShift} opacity={night ? 0.55 : 0.4}>
        <Path path={city.reflA} color={c.window} />
      </Group>
      <Group opacity={finale}>
        <Rect x={0} y={waterTop} width={width} height={60 * k}>
          <LinearGradient
            start={vec(0, waterTop)}
            end={vec(0, waterTop + 60 * k)}
            colors={[rgba(c.flash, night ? 0.16 : 0.12), rgba(c.flash, 0)]}
          />
        </Rect>
      </Group>
      {/* fişekler (suyun ve şehrin önünde: roket mavnadan kalkar, patlama suya yansır) */}
      {shells.map(([i, fin]) => (
        <Shell key={`${fin ? "f" : "s"}${i}`} i={i} fin={fin} p={p} clock={clock} L={L} c={c} cols={cols} rgbs={rgbs} />
      ))}
      {/* fişek mavnaları */}
      {L.barges.map((bx, i) => (
        <Group key={`g${i}`}>
          <Path
            path={`M ${bx - 22 * k} ${waterTop + 6 * k} L ${bx + 22 * k} ${waterTop + 6 * k} L ${bx + 17 * k} ${waterTop + 12 * k} L ${bx - 17 * k} ${waterTop + 12 * k} Z`}
            color={c.barge}
          />
          <Rect x={bx - 12 * k} y={waterTop + 2 * k} width={24 * k} height={4 * k} color={c.barge} />
          <Circle cx={bx - 18 * k} cy={waterTop + 5 * k} r={1 * k} color={c.beacon} />
          <Circle cx={bx + 18 * k} cy={waterTop + 5 * k} r={1 * k} color={c.fw4} />
        </Group>
      ))}
    </Group>
  );
}
