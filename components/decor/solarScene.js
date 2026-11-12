// Güneş sistemi atmosferi: TEK vektör sahne (OVERLAY.orbits, Atlas'ın ÖNÜNDE; yıldızlar arkada kalır).
//
//   Sakin: hafif bulutsu + Samanyolu şeridi; arkası soluk / önü belirgin yörüngeler; canlı Güneş
//     (kenar kararması, granülasyon, dönen taç ışınları, nefes alan çıkıntı ilmekleri, lekeler);
//     8 gezegen yörüngede — ışığı GÜNEŞ'TEN alır (gece tarafı Güneş'in tersinde, Güneş'in önündeyken
//     hilal, arkasındayken dolunay); Merkür–Mars Güneş'in arkasından geçer (iki geçiş); Dünya
//     (dönen kıtalar + bulutlar + atmosfer kenarı, Ay ve İSS), Mars (kutup başlığı), Jüpiter (bantlar +
//     Büyük Kırmızı Leke), Satürn (halka önde/arkada, Cassini boşluğu), Uranüs (dik halka), Neptün
//     (karanlık leke); vektör asteroit kuşağı (arka yarısı Güneş'in arkasında); köşede kara delik
//     (yığılma diski, bükülmüş arka disk, foton halkası) ve öbür köşede ışınları süpüren pulsar.
//   Olay (75 sn'de bir 30 sn, solarFrame): bir kuyruklu yıldız parabolik yörüngeyle sol üstten
//     girer, Güneş'in önünden hızlanarak geçer (kuyrukları hep Güneş'in tersine, yaklaştıkça uzar),
//     sağ üstten çıkar; günberi anında Güneş patlaması + genişleyen taç kütle atımı halkası.
//
// Geometri weatherParticles ile aynı: merkez (W/2, ORBIT_CENTER_Y·H), ölçek orbitScale(W), dikey oran 0,5.

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Circle, Group, LinearGradient, Oval, Path, RadialGradient, Rect, Skia, vec } from "@shopify/react-native-skia";
import { ORBIT_CENTER_Y, ORBIT_RADII, SOLAR_PHASES, orbitScale, solarFrame } from "../../utils/weatherParticles";

export const SOLAR_TONE = ["orbit", "glow", "nebulaA", "nebulaB", "belt"];
const toneMap = (colors) => Object.fromEntries(SOLAR_TONE.map((name, i) => [name, colors[i] || colors[0]]));

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

const TAU = Math.PI * 2;
// Gezegenler: yörünge sırası, dolanma süresi (sn; eski parçacıklarla aynı), yarıçap (dp)
const PLANETS = [
  { orbit: 0, period: 16, r: 5 },
  { orbit: 1, period: 25, r: 7.5 },
  { orbit: 2, period: 38, r: 8.5 },
  { orbit: 3, period: 58, r: 6.5 },
  { orbit: 4, period: 95, r: 15 },
  { orbit: 5, period: 135, r: 12.5 },
  { orbit: 6, period: 190, r: 9.5 },
  { orbit: 7, period: 260, r: 9 },
];
const P_ORBIT = PLANETS.map((q) => ORBIT_RADII[q.orbit]);
const P_W = PLANETS.map((q) => TAU / q.period);
const SUN_R = 19;
const BELT_W = TAU / 110;
// Kuyruklu yıldız: günberi uzaklığı (dp) ve parabol parametresi D = tan(θ/2) sınırı
const COMET_Q = 44;
const COMET_D = 2.6;
const COMET_M = COMET_D + (COMET_D * COMET_D * COMET_D) / 3;

export function solarLayout(width, height) {
  const k = orbitScale(width);
  return { k, cx: width * 0.5, cy: height * ORBIT_CENTER_Y, width, height, bh: [width * 0.84, height * 0.12], ps: [width * 0.15, height * 0.87] };
}

/** Gezegenin ekran konumu, yörünge açısı, derinlik (sn > 0 = önde) ve derinlik ölçeği. */
function bodyAt(L, i, t) {
  "worklet";
  const a = SOLAR_PHASES[i + 1] + t * P_W[i];
  const R = P_ORBIT[i] * L.k;
  const sn = Math.sin(a);
  return { x: L.cx + Math.cos(a) * R, y: L.cy + sn * R * 0.5, sn, s: 1 + 0.1 * sn };
}

/** Parabolik kuyruklu yıldız (Barker denklemi: zamanla düzgün ilerler, günberide hızlanır). c: 0–1. */
function cometAt(L, c) {
  "worklet";
  const M = (c * 2 - 1) * COMET_M;
  const Y = Math.cbrt(1.5 * M + Math.sqrt(2.25 * M * M + 1));
  const D = Y - 1 / Y;
  const th = 2 * Math.atan(D);
  const r = COMET_Q * (1 + D * D);
  const ph = Math.PI / 2 + th; // günberi önde (Güneş'in altında)
  const X = Math.cos(ph) * r;
  const Z = Math.sin(ph) * r;
  return { x: L.cx + X * L.k, y: L.cy + Z * L.k * 0.5, r, X, Z };
}

// ── statik yollar ────────────────────────────────────────────────────────────
function circlePath(r) {
  const p = Skia.Path.Make();
  p.addCircle(0, 0, r);
  return p;
}

// [cx, cy, rx, ry] (r birimi) → 2r periyotla üç kopya (kaydırılınca dikişsiz)
function blobPath(list, r, per = 2) {
  const p = Skia.Path.Make();
  for (const o of [-per, 0, per]) {
    for (const [x, y, rx, ry] of list) p.addOval(Skia.XYWHRect((x + o - rx) * r, (y - ry) * r, rx * 2 * r, ry * 2 * r));
  }
  return p;
}

const EARTH_LAND = [
  [-0.62, -0.42, 0.3, 0.26], [-0.42, -0.22, 0.2, 0.2], [-0.4, 0.18, 0.15, 0.3], [-0.33, 0.52, 0.1, 0.2],
  [0.2, -0.5, 0.42, 0.2], [0.55, -0.32, 0.3, 0.18], [0.28, 0.02, 0.2, 0.26], [0.34, 0.38, 0.13, 0.2], [0.8, 0.45, 0.14, 0.1],
];
const EARTH_DRY = [[0.28, -0.04, 0.12, 0.12], [0.5, -0.36, 0.14, 0.07], [-0.4, -0.3, 0.08, 0.08]];
const EARTH_CLOUD = [
  [-0.7, -0.6, 0.32, 0.05], [-0.1, -0.15, 0.36, 0.05], [0.5, 0.18, 0.3, 0.05], [-0.5, 0.42, 0.28, 0.04],
  [0.15, 0.62, 0.3, 0.04], [0.75, -0.55, 0.22, 0.04], [-0.2, 0.05, 0.12, 0.08],
];
const MARS_DARK = [[-0.5, -0.1, 0.3, 0.14], [0.2, 0.15, 0.36, 0.12], [0.7, -0.3, 0.2, 0.1], [-0.1, 0.5, 0.25, 0.08]];
const JUP_BANDS = [
  [-0.82, 0.14, "rgba(140,96,62,0.5)"], [-0.5, 0.17, "rgba(176,116,72,0.6)"], [-0.24, 0.08, "rgba(255,246,228,0.55)"],
  [0.02, 0.19, "rgba(164,98,58,0.6)"], [0.34, 0.09, "rgba(255,240,215,0.45)"], [0.5, 0.12, "rgba(186,134,92,0.5)"], [0.72, 0.14, "rgba(132,92,60,0.45)"],
];
const SAT_BANDS = [[-0.6, 0.16, "rgba(190,150,96,0.35)"], [-0.2, 0.12, "rgba(255,248,226,0.4)"], [0.12, 0.2, "rgba(196,156,100,0.38)"], [0.5, 0.14, "rgba(170,130,84,0.3)"]];
const MERC_CRATERS = [[-0.35, -0.3, 0.18], [0.3, -0.45, 0.12], [0.25, 0.3, 0.22], [-0.4, 0.4, 0.13], [0.6, 0.0, 0.1], [-0.05, 0.0, 0.09]];
const MOON_CRATERS = [[-0.3, -0.25, 0.22], [0.3, 0.2, 0.28], [-0.2, 0.45, 0.16]];

function buildSun() {
  const gran = Skia.Path.Make();
  for (let i = 0; i < 90; i += 1) {
    const a = hash(i, 1) * TAU;
    const d = Math.sqrt(hash(i, 2)) * SUN_R * 0.95;
    gran.addCircle(Math.cos(a) * d, Math.sin(a) * d, 0.5 + hash(i, 3) * 0.8);
  }
  const rays = [Skia.Path.Make(), Skia.Path.Make()];
  for (let j = 0; j < 2; j += 1) {
    const n = j ? 11 : 16;
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * TAU + j * 0.2;
      const len = SUN_R * (1.55 + hash(i, 4 + j) * (j ? 1.4 : 0.9));
      const w = j ? 0.09 : 0.06;
      const b = SUN_R * 0.92;
      rays[j].moveTo(Math.cos(a - w) * b, Math.sin(a - w) * b);
      rays[j].quadTo(Math.cos(a) * len * 0.6, Math.sin(a) * len * 0.6, Math.cos(a) * len, Math.sin(a) * len);
      rays[j].quadTo(Math.cos(a) * len * 0.6, Math.sin(a) * len * 0.6, Math.cos(a + w) * b, Math.sin(a + w) * b);
      rays[j].close();
    }
  }
  const prom = Skia.Path.Make();
  for (const [a, h, w] of [[-2.2, 5.5, 0.12], [0.5, 4, 0.1], [2.6, 6.5, 0.14]]) {
    const r0 = SUN_R * 0.98;
    prom.moveTo(Math.cos(a - w) * r0, Math.sin(a - w) * r0);
    prom.cubicTo(Math.cos(a - w * 1.3) * (r0 + h), Math.sin(a - w * 1.3) * (r0 + h), Math.cos(a + w * 1.3) * (r0 + h), Math.sin(a + w * 1.3) * (r0 + h), Math.cos(a + w) * r0, Math.sin(a + w) * r0);
  }
  const spots = Skia.Path.Make();
  for (const [x, y, rr] of [[-6, -4, 1.8], [-4.4, -2.6, 1.1], [5, 6, 1.6], [7, 4.6, 0.9], [2, -9, 1.2]]) spots.addCircle(x, y, rr);
  const umbra = Skia.Path.Make();
  for (const [x, y, rr] of [[-6, -4, 0.9], [5, 6, 0.8]]) umbra.addCircle(x, y, rr);
  return { gran, rays, prom, spots, umbra, clip: circlePath(SUN_R) };
}

function buildBelt(k) {
  const a = Skia.Path.Make();
  const b = Skia.Path.Make();
  for (let i = 0; i < 150; i += 1) {
    const ang = hash(i, 21) * TAU;
    const rr = (106 + hash(i, 22) * 18 + (hash(i, 23) - 0.5) * 4) * k;
    const s = (0.35 + hash(i, 24) * 0.75) * k;
    (i % 3 ? a : b).addCircle(Math.cos(ang) * rr, Math.sin(ang) * rr, s);
  }
  return [a, b];
}

function buildStarsBg(width, height) {
  // Samanyolu şeridi içinde ince toz (yıldız parçacıklarına ek, statik)
  const p = Skia.Path.Make();
  for (let i = 0; i < 70; i += 1) {
    const s = hash(i, 31);
    const x = s * width;
    const y = height * (0.95 - 0.8 * s) + (hash(i, 32) - 0.5) * 70;
    p.addCircle(x, y, 0.35 + hash(i, 33) * 0.6);
  }
  return p;
}

// ── aydınlatılmış disk: yüzey + Güneş yönünde parıltı + gece tarafı ─────────────
function LitDisc({ r, light, shade, rim, children }) {
  const clip = useMemo(() => circlePath(r), [r]);
  return (
    <>
      <Group clip={clip}>
        {children}
        <Group transform={light}>
          <Circle cx={0.5 * r} cy={0} r={r * 1.15}>
            <RadialGradient c={vec(0.5 * r, 0)} r={r * 1.15} colors={["rgba(255,248,230,0.3)", "rgba(255,248,230,0)"]} />
          </Circle>
          <Group transform={shade}>
            <Rect x={-3 * r} y={-2 * r} width={3 * r} height={4 * r}>
              <LinearGradient start={vec(0, 0)} end={vec(-0.4 * r, 0)} colors={["rgba(3,5,14,0)", "rgba(3,5,14,0.88)"]} />
            </Rect>
          </Group>
        </Group>
      </Group>
      {rim ? <Circle cx={0} cy={0} r={r - 0.3} style="stroke" strokeWidth={0.9} color={rim} /> : null}
    </>
  );
}

function useScroll(clock, speed, per) {
  return useDerivedValue(() => [{ translateX: (clock.value * speed) % per }]);
}

function Ball({ r, colors }) {
  return (
    <Circle cx={0} cy={0} r={r}>
      <RadialGradient c={vec(-0.3 * r, -0.35 * r)} r={r * 1.7} colors={colors} />
    </Circle>
  );
}

function Bands({ r, list }) {
  return list.map(([y, h, color]) => <Rect key={y} x={-r} y={y * r} width={2 * r} height={h * r} color={color} />);
}

// ── gezegen yüzeyleri (yerel, merkez 0,0) ─────────────────────────────────────
function Mercury({ r }) {
  const craters = useMemo(() => {
    const p = Skia.Path.Make();
    for (const [x, y, rr] of MERC_CRATERS) p.addCircle(x * r, y * r, rr * r);
    return p;
  }, [r]);
  return (
    <>
      <Ball r={r} colors={["#dcd6ce", "#9c958d", "#56524c"]} />
      <Path path={craters} color="rgba(60,55,50,0.4)" />
    </>
  );
}

function Venus({ r }) {
  return (
    <>
      <Ball r={r} colors={["#fff6d8", "#efc47e", "#a8742e"]} />
      <Group transform={[{ scale: r / 10 }]}>
        <Path path="M-12 -4 C-6 -8 2 -2 12 -6" style="stroke" strokeWidth={2.4} strokeCap="round" color="rgba(255,255,255,0.35)" />
        <Path path="M-12 3 C-4 0 4 7 12 2" style="stroke" strokeWidth={2.2} strokeCap="round" color="rgba(170,110,40,0.3)" />
        <Path path="M-10 -9 C-2 -11 4 -9 10 -11" style="stroke" strokeWidth={1.6} strokeCap="round" color="rgba(255,255,255,0.25)" />
      </Group>
    </>
  );
}

function Earth({ r, clock }) {
  const land = useMemo(() => blobPath(EARTH_LAND, r), [r]);
  const dry = useMemo(() => blobPath(EARTH_DRY, r), [r]);
  const cloud = useMemo(() => blobPath(EARTH_CLOUD, r), [r]);
  const sLand = useScroll(clock, r * 0.16, 2 * r);
  const sCloud = useScroll(clock, r * 0.24, 2 * r);
  return (
    <>
      <Ball r={r} colors={["#7cc4ff", "#1f6fd1", "#0a336e"]} />
      <Group transform={sLand}>
        <Path path={land} color="#3e9a4c" />
        <Path path={dry} color="rgba(206,176,110,0.85)" />
      </Group>
      <Oval x={-0.6 * r} y={-1.05 * r} width={1.2 * r} height={0.34 * r} color="rgba(245,250,255,0.95)" />
      <Oval x={-0.5 * r} y={0.78 * r} width={1.0 * r} height={0.3 * r} color="rgba(245,250,255,0.9)" />
      <Group transform={sCloud}>
        <Path path={cloud} color="rgba(255,255,255,0.75)" />
      </Group>
    </>
  );
}

function Mars({ r, clock }) {
  const dark = useMemo(() => blobPath(MARS_DARK, r), [r]);
  const s = useScroll(clock, r * 0.14, 2 * r);
  return (
    <>
      <Ball r={r} colors={["#ffbf94", "#d8653a", "#7a2812"]} />
      <Group transform={s}>
        <Path path={dark} color="rgba(110,40,20,0.45)" />
      </Group>
      <Oval x={-0.45 * r} y={-1.04 * r} width={0.9 * r} height={0.36 * r} color="rgba(255,250,245,0.9)" />
    </>
  );
}

function Jupiter({ r, clock }) {
  const spot = useMemo(() => blobPath([[0, 0.38, 0.27, 0.13]], r), [r]);
  const ovals = useMemo(() => blobPath([[-0.6, -0.4, 0.1, 0.04], [0.4, 0.6, 0.08, 0.035], [0.7, -0.12, 0.09, 0.035]], r), [r]);
  const s = useScroll(clock, r * 0.2, 2 * r);
  return (
    <>
      <Ball r={r} colors={["#f8e8cc", "#d9b48a", "#86603e"]} />
      <Bands r={r} list={JUP_BANDS} />
      <Group transform={s}>
        <Path path={spot} color="#c8573c" />
        <Path path={ovals} color="rgba(255,250,240,0.75)" />
      </Group>
    </>
  );
}

function Saturn({ r }) {
  return (
    <>
      <Ball r={r} colors={["#fdf0cc", "#e2c48a", "#987848"]} />
      <Bands r={r} list={SAT_BANDS} />
    </>
  );
}

const RING_TILT = -0.2;
const RING_Y = 0.3;
// [yarıçap (r birimi), çizgi kalınlığı (r birimi), renk]
const SAT_RINGS = [
  [1.42, 0.12, "rgba(200,180,140,0.35)"], [1.62, 0.2, "rgba(236,216,170,0.9)"], [1.82, 0.16, "rgba(246,228,186,0.95)"],
  [2.08, 0.16, "rgba(220,200,156,0.8)"], [2.24, 0.06, "rgba(200,180,140,0.6)"],
];

function Rings({ r, half, rings, ry = RING_Y, tilt = RING_TILT }) {
  const clip = useMemo(() => (half < 0 ? Skia.XYWHRect(-4 * r, -4 * r, 8 * r, 4 * r) : Skia.XYWHRect(-4 * r, 0, 8 * r, 4 * r)), [half, r]);
  return (
    <Group transform={[{ rotate: tilt }]}>
      <Group clip={clip}>
        {rings.map(([rr, w, color]) => (
          <Oval key={rr} x={-rr * r} y={-rr * r * ry} width={2 * rr * r} height={2 * rr * r * ry} style="stroke" strokeWidth={w * r} color={color} />
        ))}
      </Group>
    </Group>
  );
}

function Uranus({ r }) {
  return (
    <>
      <Ball r={r} colors={["#e2fcff", "#94dbe8", "#3a8796"]} />
      <Rect x={-r} y={-0.12 * r} width={2 * r} height={0.2 * r} color="rgba(255,255,255,0.15)" />
    </>
  );
}
const URA_RINGS = [[1.5, 0.05, "rgba(200,240,250,0.45)"], [1.7, 0.04, "rgba(200,240,250,0.3)"]];

function Neptune({ r, clock }) {
  const spot = useMemo(() => blobPath([[0.1, 0.25, 0.22, 0.12]], r), [r]);
  const streak = useMemo(() => blobPath([[0.15, 0.06, 0.18, 0.04], [-0.5, -0.4, 0.2, 0.035]], r), [r]);
  const s = useScroll(clock, r * 0.22, 2 * r);
  return (
    <>
      <Ball r={r} colors={["#a8ccff", "#3a6ee0", "#122a72"]} />
      <Group transform={s}>
        <Path path={spot} color="rgba(10,20,70,0.5)" />
        <Path path={streak} color="rgba(240,248,255,0.7)" />
      </Group>
    </>
  );
}

// ── Gezegen: konum + derinlik geçişi + ışık ──────────────────────────────────
// pass: 0 = her zaman (Güneş'in önünde çizilir), 1 = yalnız öndeyken, −1 = yalnız arkadayken.
function Body({ L, i, clock, pass, rim, back, front, children }) {
  const r = PLANETS[i].r;
  const st = useDerivedValue(() => bodyAt(L, i, clock.value));
  const op = useDerivedValue(() => (pass === 0 ? 1 : (st.value.sn >= 0 ? 1 : -1) === pass ? 1 : 0));
  const tr = useDerivedValue(() => [{ translateX: st.value.x }, { translateY: st.value.y }, { scale: L.k * st.value.s }]);
  const light = useDerivedValue(() => [{ rotate: Math.atan2(L.cy - st.value.y, L.cx - st.value.x) }]);
  const shade = useDerivedValue(() => [{ translateX: r * (0.1 + 0.5 * st.value.sn) }]);
  return (
    <Group opacity={op}>
      <Group transform={tr}>
        {back}
        <LitDisc r={r} light={light} shade={shade} rim={rim}>
          {children}
        </LitDisc>
        {front}
      </Group>
    </Group>
  );
}

// Ay ve İSS (Dünya'nın yerel düzleminde, ölçek Dünya ile birlikte)
function Moon({ L, clock, side }) {
  const st = useDerivedValue(() => {
    const t = clock.value;
    const e = bodyAt(L, 2, t);
    const a = SOLAR_PHASES[9] + (t * TAU) / 14;
    const sn = Math.sin(a);
    return { x: Math.cos(a) * 21, y: sn * 21 * 0.55, sn, on: (sn >= 0 ? 1 : -1) === side ? 1 : 0, ang: Math.atan2(L.cy - e.y, L.cx - e.x), esn: e.sn };
  });
  const tr = useDerivedValue(() => [{ translateX: st.value.x }, { translateY: st.value.y }]);
  const op = useDerivedValue(() => st.value.on);
  const light = useDerivedValue(() => [{ rotate: st.value.ang }]);
  const shade = useDerivedValue(() => [{ translateX: 2.4 * (0.1 + 0.5 * st.value.esn) }]);
  const craters = useMemo(() => {
    const p = Skia.Path.Make();
    for (const [x, y, rr] of MOON_CRATERS) p.addCircle(x * 2.4, y * 2.4, rr * 2.4);
    return p;
  }, []);
  return (
    <Group opacity={op}>
      <Group transform={tr}>
        <LitDisc r={2.4} light={light} shade={shade}>
          <Ball r={2.4} colors={["#f2f0ea", "#b8b4ac", "#6c6862"]} />
          <Path path={craters} color="rgba(90,86,80,0.4)" />
        </LitDisc>
      </Group>
    </Group>
  );
}

function Iss({ clock, side }) {
  const st = useDerivedValue(() => {
    const a = SOLAR_PHASES[10] + (clock.value * TAU) / 5;
    const sn = Math.sin(a);
    return { x: Math.cos(a) * 12.5, y: sn * 12.5 * 0.55, on: (sn >= 0 ? 1 : -1) === side ? 1 : 0 };
  });
  const tr = useDerivedValue(() => [{ translateX: st.value.x }, { translateY: st.value.y }, { rotate: 0.3 }]);
  const op = useDerivedValue(() => st.value.on);
  const glint = useDerivedValue(() => (Math.sin(clock.value * 3.1) > 0.85 ? 1 : 0.25));
  return (
    <Group opacity={op}>
      <Group transform={tr}>
        <Rect x={-2.6} y={-0.9} width={1.6} height={1.8} color="#5a7ab8" />
        <Rect x={1} y={-0.9} width={1.6} height={1.8} color="#5a7ab8" />
        <Rect x={-1} y={-0.25} width={2} height={0.5} color="#e8e8e8" />
        <Group opacity={glint}>
          <Circle cx={0} cy={0} r={0.7} color="#ffffff" />
        </Group>
      </Group>
    </Group>
  );
}

// ── Güneş ─────────────────────────────────────────────────────────────────────
function Sun({ L, f, clock, S, c }) {
  const tr = useMemo(() => [{ translateX: L.cx }, { translateY: L.cy }, { scale: L.k }], [L]);
  const glowO = useDerivedValue(() => 0.85 + 0.1 * Math.sin(clock.value * 0.9) + 0.25 * f.value.flare);
  const rayA = useDerivedValue(() => [{ rotate: clock.value * 0.035 }]);
  const rayB = useDerivedValue(() => [{ rotate: -clock.value * 0.022 }]);
  const rayO = useDerivedValue(() => 0.75 + 0.25 * Math.sin(clock.value * 0.6));
  const spin = useDerivedValue(() => [{ rotate: clock.value * 0.05 }]);
  const promO = useDerivedValue(() => 0.55 + 0.3 * Math.sin(clock.value * 0.7) + 0.4 * f.value.flare);
  const promS = useDerivedValue(() => [{ rotate: clock.value * 0.05 }, { scale: 1 + 0.06 * Math.sin(clock.value * 0.5) + 0.25 * f.value.flare }]);
  const flareO = useDerivedValue(() => f.value.flare);
  const cmeT = useDerivedValue(() => {
    const q = f.value.cme;
    return [{ scale: q < 0 ? 1 : 1 + q * 7 }];
  });
  const cmeO = useDerivedValue(() => {
    const q = f.value.cme;
    return q < 0 ? 0 : (1 - q) * (1 - q) * 0.8;
  });
  return (
    <Group transform={tr}>
      <Group opacity={glowO}>
        <Circle cx={0} cy={0} r={78}>
          <RadialGradient c={vec(0, 0)} r={78} colors={[rgba(c.glow, 0.42), rgba(c.glow, 0.14), rgba(c.glow, 0)]} positions={[0.2, 0.5, 1]} />
        </Circle>
      </Group>
      <Group opacity={rayO}>
        <Group transform={rayA}>
          <Path path={S.rays[0]} color="rgba(255,214,130,0.22)" />
        </Group>
        <Group transform={rayB}>
          <Path path={S.rays[1]} color="rgba(255,190,100,0.16)" />
        </Group>
      </Group>
      <Group opacity={promO}>
        <Group transform={promS}>
          <Path path={S.prom} style="stroke" strokeWidth={1.3} strokeCap="round" color="rgba(255,150,70,0.75)" />
        </Group>
      </Group>
      <Circle cx={0} cy={0} r={SUN_R}>
        <RadialGradient c={vec(0, 0)} r={SUN_R} colors={["#fffbe8", "#ffe47c", "#ffb22e", "#e2560a"]} positions={[0, 0.5, 0.84, 1]} />
      </Circle>
      <Group clip={S.clip}>
        <Group transform={spin}>
          <Path path={S.gran} color="rgba(200,90,0,0.1)" />
          <Path path={S.spots} color="rgba(150,60,0,0.3)" />
          <Path path={S.umbra} color="rgba(90,30,0,0.45)" />
        </Group>
      </Group>
      <Group opacity={flareO}>
        <Circle cx={-8} cy={13} r={16}>
          <RadialGradient c={vec(-8, 13)} r={16} colors={["rgba(255,255,255,0.95)", "rgba(255,240,180,0.5)", "rgba(255,200,100,0)"]} />
        </Circle>
        <Path path="M-14 15 C-20 2 -4 -2 -2 12" style="stroke" strokeWidth={2.4} strokeCap="round" color="rgba(255,250,220,0.9)" />
      </Group>
      <Group opacity={cmeO}>
        <Group transform={cmeT}>
          <Circle cx={0} cy={0} r={SUN_R * 1.1} style="stroke" strokeWidth={2.5} color="rgba(255,190,110,0.9)" />
          <Circle cx={0} cy={0} r={SUN_R * 1.02} style="stroke" strokeWidth={1} color="rgba(255,240,200,0.7)" />
        </Group>
      </Group>
    </Group>
  );
}

// ── Kuyruklu yıldız (olay) ────────────────────────────────────────────────────
function Comet({ L, f, clock }) {
  const st = useDerivedValue(() => {
    const q = f.value.comet;
    if (q < 0) return { o: 0, x: -999, y: -999, ang: 0, len: 1, bend: 1, near: 0 };
    const p = cometAt(L, q);
    const n = cometAt(L, q < 0.999 ? q + 0.001 : q);
    const dx = p.x - L.cx;
    const dy = p.y - L.cy;
    const ang = Math.atan2(dy, dx);
    const near = Math.max(0, 1 - p.r / 300);
    const vx = n.x - p.x;
    const vy = n.y - p.y;
    const cross = Math.cos(ang) * vy - Math.sin(ang) * vx;
    const edge = Math.min(1, q / 0.06, (1 - q) / 0.06);
    return { o: edge, x: p.x, y: p.y, ang, len: 0.4 + 1.5 * near * near + 0.3 * near, bend: cross > 0 ? -1 : 1, near };
  });
  const tr = useDerivedValue(() => [{ translateX: st.value.x }, { translateY: st.value.y }, { rotate: st.value.ang }, { scale: L.k }]);
  const op = useDerivedValue(() => st.value.o);
  const tail = useDerivedValue(() => [{ scaleX: st.value.len }]);
  const dust = useDerivedValue(() => [{ scaleX: st.value.len * 0.85 }, { scaleY: st.value.bend }]);
  const coma = useDerivedValue(() => 0.7 + 0.3 * st.value.near + 0.08 * Math.sin(clock.value * 9));
  return (
    <Group opacity={op}>
      <Group transform={tr}>
        <Group transform={dust}>
          <Path path="M0 -2.4 C30 -4 60 2 100 14 C70 14 30 8 0 2.4 Z">
            <LinearGradient start={vec(0, 0)} end={vec(100, 10)} colors={["rgba(255,236,190,0.75)", "rgba(255,210,150,0.25)", "rgba(255,200,140,0)"]} />
          </Path>
        </Group>
        <Group transform={tail}>
          <Path path="M0 -1.3 L120 -0.3 L120 0.3 L0 1.3 Z">
            <LinearGradient start={vec(0, 0)} end={vec(120, 0)} colors={["rgba(180,224,255,0.75)", "rgba(120,180,255,0.2)", "rgba(120,180,255,0)"]} />
          </Path>
          <Path path="M0 -0.6 L90 -3 L90 -2.4 L0 0 Z" color="rgba(170,215,255,0.25)" />
        </Group>
        <Group opacity={coma}>
          <Circle cx={0} cy={0} r={9}>
            <RadialGradient c={vec(0, 0)} r={9} colors={["rgba(230,248,255,0.95)", "rgba(160,220,255,0.35)", "rgba(160,220,255,0)"]} />
          </Circle>
        </Group>
        <Circle cx={0} cy={0} r={1.8} color="#ffffff" />
      </Group>
    </Group>
  );
}

// ── Kara delik ve pulsar (köşelerde) ─────────────────────────────────────────
function BlackHole({ L, clock }) {
  const tr = useMemo(() => [{ translateX: L.bh[0] }, { translateY: L.bh[1] }, { scale: L.k }, { rotate: -0.22 }], [L]);
  const clumps = useMemo(() => {
    const p = Skia.Path.Make();
    for (let i = 0; i < 26; i += 1) {
      const a = hash(i, 41) * TAU;
      const rr = 17 + hash(i, 42) * 13;
      p.addCircle(Math.cos(a) * rr, Math.sin(a) * rr, 0.6 + hash(i, 43) * 0.8);
    }
    return p;
  }, []);
  const spin = useDerivedValue(() => [{ scaleY: 0.24 }, { rotate: clock.value * 0.6 }]);
  const pulse = useDerivedValue(() => 0.85 + 0.15 * Math.sin(clock.value * 1.3));
  const back = useMemo(() => Skia.XYWHRect(-40, -40, 80, 40), []);
  const front = useMemo(() => Skia.XYWHRect(-40, 0, 80, 40), []);
  const disk = (
    <Oval x={-30} y={-7} width={60} height={14} style="stroke" strokeWidth={6}>
      <LinearGradient start={vec(-30, 0)} end={vec(30, 0)} colors={["rgba(255,236,190,0.95)", "rgba(255,150,60,0.8)", "rgba(200,70,20,0.5)"]} />
    </Oval>
  );
  return (
    <Group transform={tr}>
      <Circle cx={0} cy={0} r={46}>
        <RadialGradient c={vec(0, 0)} r={46} colors={["rgba(255,150,70,0.22)", "rgba(255,120,60,0.08)", "rgba(255,120,60,0)"]} />
      </Circle>
      <Group clip={back}>
        {disk}
        <Group transform={spin}>
          <Path path={clumps} color="rgba(255,226,170,0.7)" />
        </Group>
      </Group>
      {/* bükülmüş arka disk: deliğin üstünden ve altından dolanan ışık */}
      <Group opacity={pulse}>
        <Oval x={-17} y={-15} width={34} height={27} style="stroke" strokeWidth={3.2}>
          <LinearGradient start={vec(-17, 0)} end={vec(17, 0)} colors={["rgba(255,236,190,0.9)", "rgba(255,160,70,0.6)"]} />
        </Oval>
      </Group>
      <Circle cx={0} cy={0} r={11.5} color="#000000" />
      <Circle cx={0} cy={0} r={12.2} style="stroke" strokeWidth={0.9} color="rgba(255,244,220,0.95)" />
      <Group clip={front}>
        {disk}
        <Group transform={spin}>
          <Path path={clumps} color="rgba(255,226,170,0.8)" />
        </Group>
      </Group>
    </Group>
  );
}

function Pulsar({ L, clock }) {
  const tr = useMemo(() => [{ translateX: L.ps[0] }, { translateY: L.ps[1] }, { scale: L.k }], [L]);
  const beams = useDerivedValue(() => [{ rotate: -0.5 }, { scaleY: 0.5 }, { rotate: clock.value * 1.7 }]);
  const beamO = useDerivedValue(() => 0.55 + 0.45 * Math.abs(Math.sin(clock.value * 1.7)));
  const core = useDerivedValue(() => 0.75 + 0.25 * Math.sin(clock.value * 5));
  const beam = (
    <Path path="M-1.5 0 L-7 -72 L7 -72 L1.5 0 Z">
      <LinearGradient start={vec(0, 0)} end={vec(0, -72)} colors={["rgba(190,230,255,0.75)", "rgba(150,200,255,0.2)", "rgba(150,200,255,0)"]} />
    </Path>
  );
  return (
    <Group transform={tr}>
      <Path path="M0 0 C-14 -16 -14 16 0 0 M0 0 C14 -16 14 16 0 0" style="stroke" strokeWidth={0.7} color="rgba(170,210,255,0.35)" />
      <Group opacity={beamO}>
        <Group transform={beams}>
          {beam}
          <Group transform={[{ rotate: Math.PI }]}>{beam}</Group>
        </Group>
      </Group>
      <Group opacity={core}>
        <Circle cx={0} cy={0} r={18}>
          <RadialGradient c={vec(0, 0)} r={18} colors={["rgba(220,240,255,0.8)", "rgba(140,190,255,0.25)", "rgba(140,190,255,0)"]} />
        </Circle>
      </Group>
      <Circle cx={0} cy={0} r={2.6} color="#ffffff" />
    </Group>
  );
}

// ── Arka plan: bulutsu + Samanyolu + yörüngeler + kuşak ──────────────────────
function Backdrop({ L, c, light, dust }) {
  const { width, height } = L;
  const a = light ? 0.12 : 0.2;
  return (
    <>
      <Circle cx={width * 0.18} cy={height * 0.2} r={width * 0.5}>
        <RadialGradient c={vec(width * 0.18, height * 0.2)} r={width * 0.5} colors={[rgba(c.nebulaA, a), rgba(c.nebulaA, 0)]} />
      </Circle>
      <Circle cx={width * 0.85} cy={height * 0.72} r={width * 0.55}>
        <RadialGradient c={vec(width * 0.85, height * 0.72)} r={width * 0.55} colors={[rgba(c.nebulaB, a), rgba(c.nebulaB, 0)]} />
      </Circle>
      <Group transform={[{ translateX: width * 0.5 }, { translateY: height * 0.55 }, { rotate: -1.05 }, { scaleX: height * 0.75 }, { scaleY: width * 0.2 }]}>
        <Circle cx={0} cy={0} r={1}>
          <RadialGradient c={vec(0, 0)} r={1} colors={[rgba("#dfe6ff", light ? 0.05 : 0.08), rgba("#dfe6ff", light ? 0.02 : 0.03), rgba("#dfe6ff", 0)]} />
        </Circle>
      </Group>
      <Path path={dust} color={rgba("#e8eeff", light ? 0.25 : 0.45)} />
    </>
  );
}

function Orbits({ L, c }) {
  const front = useMemo(() => {
    const p = Skia.Path.Make();
    for (const r of ORBIT_RADII) {
      const R = r * L.k;
      p.addArc(Skia.XYWHRect(L.cx - R, L.cy - R * 0.5, 2 * R, R), 0, 180);
    }
    return p;
  }, [L]);
  return (
    <>
      {ORBIT_RADII.map((r) => (
        <Oval key={r} x={L.cx - r * L.k} y={L.cy - r * L.k * 0.5} width={2 * r * L.k} height={r * L.k} style="stroke" strokeWidth={0.8} color={rgba(c.orbit, 0.12)} />
      ))}
      <Path path={front} style="stroke" strokeWidth={1} color={rgba(c.orbit, 0.18)} />
    </>
  );
}

function Belt({ L, clock, c, half, B }) {
  const clip = useMemo(() => (half < 0 ? Skia.XYWHRect(0, 0, L.width, L.cy) : Skia.XYWHRect(0, L.cy, L.width, L.height - L.cy)), [half, L]);
  const tr = useDerivedValue(() => [{ translateX: L.cx }, { translateY: L.cy }, { scaleY: 0.5 }, { rotate: clock.value * BELT_W }]);
  return (
    <Group clip={clip}>
      <Group transform={tr}>
        <Path path={B[0]} color={rgba(c.belt, half < 0 ? 0.4 : 0.65)} />
        <Path path={B[1]} color={rgba(c.belt, half < 0 ? 0.25 : 0.4)} />
      </Group>
    </Group>
  );
}

export default function SolarScene({ p, clock, width, height, tone, lightSurface }) {
  const c = useMemo(() => toneMap(tone.colors), [tone.colors]);
  const light = !!lightSurface;
  const L = useMemo(() => solarLayout(width, height), [width, height]);
  const S = useMemo(() => buildSun(), []);
  const B = useMemo(() => buildBelt(L.k), [L.k]);
  const dust = useMemo(() => buildStarsBg(width, height), [width, height]);
  const f = useDerivedValue(() => solarFrame(p, clock.value));
  const inner = (pass) => [
    <Body key="me" L={L} i={0} clock={clock} pass={pass}>
      <Mercury r={PLANETS[0].r} />
    </Body>,
    <Body key="ve" L={L} i={1} clock={clock} pass={pass} rim="rgba(255,236,190,0.45)">
      <Venus r={PLANETS[1].r} />
    </Body>,
    <Body
      key="ea"
      L={L}
      i={2}
      clock={clock}
      pass={pass}
      rim="rgba(140,200,255,0.7)"
      back={[<Moon key="m" L={L} clock={clock} side={-1} />, <Iss key="i" clock={clock} side={-1} />]}
      front={[<Moon key="m" L={L} clock={clock} side={1} />, <Iss key="i" clock={clock} side={1} />]}
    >
      <Earth r={PLANETS[2].r} clock={clock} />
    </Body>,
    <Body key="ma" L={L} i={3} clock={clock} pass={pass} rim="rgba(255,190,150,0.35)">
      <Mars r={PLANETS[3].r} clock={clock} />
    </Body>,
  ];
  const sr = PLANETS[5].r;
  const ur = PLANETS[6].r;
  return (
    <Group opacity={tone.alpha}>
      <Backdrop L={L} c={c} light={light} dust={dust} />
      <Orbits L={L} c={c} />
      <BlackHole L={L} clock={clock} />
      <Pulsar L={L} clock={clock} />
      <Belt L={L} clock={clock} c={c} half={-1} B={B} />
      {inner(-1)}
      <Sun L={L} f={f} clock={clock} S={S} c={c} />
      <Belt L={L} clock={clock} c={c} half={1} B={B} />
      {inner(1)}
      <Body key="ju" L={L} i={4} clock={clock} pass={0}>
        <Jupiter r={PLANETS[4].r} clock={clock} />
      </Body>
      <Body
        key="sa"
        L={L}
        i={5}
        clock={clock}
        pass={0}
        back={<Rings r={sr} half={-1} rings={SAT_RINGS} />}
        front={<Rings r={sr} half={1} rings={SAT_RINGS} />}
      >
        <Saturn r={sr} />
      </Body>
      <Body
        key="ur"
        L={L}
        i={6}
        clock={clock}
        pass={0}
        rim="rgba(200,245,255,0.4)"
        back={<Rings r={ur} half={-1} rings={URA_RINGS} ry={0.16} tilt={1.45} />}
        front={<Rings r={ur} half={1} rings={URA_RINGS} ry={0.16} tilt={1.45} />}
      >
        <Uranus r={ur} />
      </Body>
      <Body key="ne" L={L} i={7} clock={clock} pass={0} rim="rgba(150,190,255,0.4)">
        <Neptune r={PLANETS[7].r} clock={clock} />
      </Body>
      <Comet L={L} f={f} clock={clock} />
    </Group>
  );
}
