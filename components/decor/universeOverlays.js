// components/decor/universeOverlays.js
//
// Evren sahnelerinin vektör katmanları (KIND.overlay, OVERLAY 17–30): büyük
// silüetler (buz duvarı, kum tepeleri, Gotham, gökdelenler, Mordor, çöl
// masaları, hapishane, titan duvarı), sahne ışıkları (süpüren göz, kule
// projektörü, şehir projektörleri) ve ipler (ağ, ODM halatı). Sherlock, Death
// Note, One Piece gök, Naruto ve FMA kendi dosyalarında (OVERLAY 50–54).
//
// Yollar boyut değişince BİR KEZ kurulur (useMemo); kare başına yalnız Group
// dönüşümü / opaklık / yol kırpma (end) değişir. Yükseklikler kıyı katmanıyla
// aynı ölçekte (sceneScale): sahne parçacıkları (gemi, ördek, pelerinli silüet,
// titan) bu silüetlere dp ile oturur — ortak sabitler utils/weatherUniverses SCENERY.
//
// Işığa duyarlılık: hiçbir katman çakmaz. Göz ve projektörler yavaş nefes alır.

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Circle, Group, LinearGradient, Path, RadialGradient, Rect, Skia, vec } from "@shopify/react-native-skia";
import { hash01, overlayFrame, sceneScale, tetherFrame, swFrame, starWarsLayout, restU } from "../../utils/weatherParticles";
import { SCENERY } from "../../utils/weatherUniverses";
import { seededRandom } from "../../utils/decorLayout";
import AotScene from "./aotScene";
import RmScene from "./rmScene";
import GotScene from "./gotScene";
import BbScene from "./bbScene";
import PbScene from "./pbScene";
import BatScene from "./batScene";
import DuneScene from "./duneScene";
import HpScene from "./hpScene";
import LotrScene from "./lotrScene";
import SpiderScene from "./spiderScene";
import VikingsScene from "./vikingsScene";
import MatrixScene from "./matrixScene";
import { SwBackdrop, SwShockwave } from "./swBackdrop";

function rgba(hex, a) {
  const h = String(hex).replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
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

// ── 30 · Batman: şehirden göğe süpüren projektörler (yarasa işareti batScene'de buluta düşer) ──
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
  return (
    <Group transform={transform}>
      <Group opacity={opacity}>
        <Beam L={L} ha={0.085} color={tone.colors[0]} tail={0.32} />
        <Glow cx={0} cy={L * 0.04} r={46 * k} color={tone.colors[0]} mid={0.3} />
      </Group>
      <Group opacity={spotOpacity} transform={symbolT}>
        <Circle cx={0} cy={0} r={Rs * 1.15}>
          <RadialGradient c={vec(0, 0)} r={Rs * 1.15} colors={[rgba(tone.colors[0], 0.4), rgba(tone.colors[0], 0.22), rgba(tone.colors[0], 0)]} positions={[0, 0.7, 1]} />
        </Circle>
      </Group>
    </Group>
  );
}

// ── 32 · Star Wars: Ölüm Yıldızı, gezegen, süperlazer ışını ve patlama ──────
// Hepsi vektör (büyütülünce bulanmaz). Zaman çizelgesi swScene ile aynı 120 sn
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

function Chunk({ d, f, fill, edge }) {
  const { x, y, vx, vy, rot, delay } = d;
  const transform = useDerivedValue(() => {
    const q = (f.value.b - delay) > 0 ? easeOut((f.value.b - delay) / (1 - delay)) : 0;
    return [{ translateX: x + vx * q }, { translateY: y + vy * q }, { rotate: rot * q * 5 }];
  });
  const opacity = useDerivedValue(() => {
    if (!f.value.blast || f.value.b <= delay) return 0;
    return smoothStep(delay, delay + 0.08, f.value.b) * (1 - smoothStep(0.55, 0.98, f.value.b));
  });
  return (
    <Group transform={transform} opacity={opacity}>
      <Path path={d.path} color={fill} />
      <Path path={d.path} style="stroke" strokeWidth={0.7} color={edge} />
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
        {[40, 50, 60].map((y) => (
          <Circle key={y} cx={10} cy={y} r={10}>
            <RadialGradient c={vec(10, y)} r={10} colors={["rgba(213,241,255,0.95)", "rgba(113,191,255,0.52)", "rgba(60,135,250,0)"]} positions={[0, 0.45, 1]} />
          </Circle>
        ))}
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
    const layout = starWarsLayout(width, height);
    const { R, dcx, dcy, dish, dishR, Rp, pcx, pcy, hit } = layout;
    const ux = (pcx - dish[0]) / Math.hypot(pcx - dish[0], pcy - dish[1]);
    const uy = (pcy - dish[1]) / Math.hypot(pcx - dish[0], pcy - dish[1]);
    // Işın tam olarak çanak merkezinden gezegenin yakın yüzeyine gider.
    const beam = Skia.Path.Make();
    beam.moveTo(dish[0], dish[1]);
    beam.lineTo(hit[0], hit[1]);
    const chargeSpokes = Skia.Path.Make();
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      chargeSpokes.moveTo(dish[0] + Math.cos(a) * R * 0.48, dish[1] + Math.sin(a) * R * 0.48);
      chargeSpokes.lineTo(dish[0] + Math.cos(a) * dishR * 0.48, dish[1] + Math.sin(a) * dishR * 0.48);
    }
    const hyperspace = Skia.Path.Make();
    for (let i = 0; i < 30; i += 1) {
      const a = (i / 30) * Math.PI * 2 + hash01(i, 42.1) * 0.12;
      const reach = Math.max(width, height) * (0.72 + hash01(i, 43.2) * 0.4);
      const start = (18 + hash01(i, 44.3) * 45) * k;
      const hx = width * 0.5, hy = height * 0.4;
      hyperspace.moveTo(hx + Math.cos(a) * start, hy + Math.sin(a) * start);
      hyperspace.lineTo(hx + Math.cos(a) * reach, hy + Math.sin(a) * reach);
    }
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
    for (let i = 0; i < 20; i += 1) {
      const a = (i / 20) * 6.2832 + hash01(i, 5.5) * 0.2;
      const r0 = Rp * 0.56;
      const r1 = Rp * (1.18 + hash01(i, 6.6) * 0.62);
      const w = 0.035 + hash01(i, 7.7) * 0.035;
      spikes.moveTo(pcx + Math.cos(a - w) * r0, pcy + Math.sin(a - w) * r0);
      spikes.lineTo(pcx + Math.cos(a) * r1, pcy + Math.sin(a) * r1);
      spikes.lineTo(pcx + Math.cos(a + w) * r0, pcy + Math.sin(a + w) * r0);
      spikes.close();
    }
    // moloz parçaları
    const chunks = [];
    for (let i = 0; i < 24; i += 1) {
      const a = hash01(i, 1.4) * 6.2832;
      const dist = (48 + hash01(i, 2.6) * 112) * k;
      const w = (2 + hash01(i, 3.6) * 4.5) * k;
      const path = Skia.Path.Make();
      path.moveTo(-w, -w * 0.4);
      path.lineTo(w * 0.5, -w);
      path.lineTo(w, w * 0.3);
      path.lineTo(-w * 0.3, w);
      path.close();
      chunks.push({
        path, x: pcx + Math.cos(a) * Rp * 0.5, y: pcy + Math.sin(a) * Rp * 0.5,
        vx: Math.cos(a) * dist, vy: Math.sin(a) * dist, rot: (hash01(i, 4.9) - 0.5) * 2, delay: hash01(i, 5.2) * 0.12,
        material: i % 5,
      });
    }
    return {
      ...layout, beam, chargeSpokes, hyperspace, dsLines, dsLit, dsClip, lands, clouds, plClip, cracks, spikes, chunks,
    };
  }, [width, height, k]);

  const f = useDerivedValue(() => swFrame(p, clock.value));
  const FS = 190 * k; // Falcon kutusu (uzun kenar ≈ 0,83 × FS)
  const falconT = useDerivedValue(() => [
    { translateX: width * 0.5 + Math.sin(clock.value * 0.7) * 1.6 * k + f.value.bank * 9 * k },
    { translateY: f.value.fy * height + Math.sin(clock.value * 0.9) * 1.8 * k },
    { rotate: -Math.PI / 2 - f.value.bank * 0.055 },
    { scale: (FS / 100) * f.value.fs },
    { translateX: -46 },
    { translateY: -50 },
  ]);
  const falconO = useDerivedValue(() => f.value.fv);
  const engineO = useDerivedValue(() => Math.min(1, 0.62 + 0.16 * Math.sin(clock.value * 3.1) + 0.22 * f.value.hyper));
  const dsT = useDerivedValue(() => [
    { translateX: f.value.slide * width * 0.14 },
    { translateY: -f.value.slide * 8 * k },
  ]);
  const dsOpacity = useDerivedValue(() => f.value.ds);
  const plOpacity = useDerivedValue(() => f.value.planet);
  const chargeOpacity = useDerivedValue(() => f.value.charge);
  const cloudT = useDerivedValue(() => [{ translateX: Math.sin(clock.value * 0.12) * 5 * k }]);
  const hyperOpacity = useDerivedValue(() => f.value.hyper * 0.52);
  const hyperT = useDerivedValue(() => [
    { translateX: width * 0.5 }, { translateY: height * 0.4 },
    { scale: 0.12 + f.value.hyperDraw * 0.88 },
    { translateX: -width * 0.5 }, { translateY: -height * 0.4 },
  ]);
  const beamEnd = useDerivedValue(() => f.value.grow);
  const beamOpacity = useDerivedValue(() => f.value.beam);
  const impactOpacity = useDerivedValue(() => f.value.impact);
  const crackOpacity = useDerivedValue(() => f.value.impact * 0.95);
  const fireT = useDerivedValue(() => [
    { translateX: geo.pcx }, { translateY: geo.pcy }, { scale: 0.35 + 2.1 * easeOut(f.value.b) },
  ]);
  const fireOpacity = useDerivedValue(() => (f.value.blast ? smoothStep(0, 0.075, f.value.b) * (1 - smoothStep(0.12, 0.7, f.value.b)) * 0.95 : 0));
  const spikeT = useDerivedValue(() => {
    const s = 0.9 + 1.0 * easeOut(f.value.b);
    return [{ translateX: geo.pcx }, { translateY: geo.pcy }, { scale: s }, { translateX: -geo.pcx }, { translateY: -geo.pcy }];
  });
  const spikeO = useDerivedValue(() => (f.value.blast ? smoothStep(0, 0.06, f.value.b) * (1 - smoothStep(0.22, 0.58, f.value.b)) * 0.75 : 0));
  const ambientO = useDerivedValue(() => (f.value.blast ? smoothStep(0, 0.1, f.value.b) * (1 - smoothStep(0.64, 1, f.value.b)) * 0.45 : 0));
  const { R, dcx, dcy, dish, dishR, Rp, pcx, pcy, hit } = geo;
  const fragmentColors = [rgba(land, 0.95), rgba(sea, 0.95), rgba(fireC, 0.9), "#a8b9bd", "#d9c9a0"];
  const lineW = (w) => w * k;
  return (
    <>
      <SwBackdrop p={p} clock={clock} width={width} height={height} k={k} light={sea === "#2b78c2"} />
      {/* Perspektif çizgileri yavaş açılır; Atlas yıldız izleriyle aynı olay saatinde söner. */}
      <Group opacity={hyperOpacity} transform={hyperT}>
        <Path path={geo.hyperspace} style="stroke" strokeWidth={1.3 * k} strokeCap="round" color="rgba(198,225,255,0.7)" />
      </Group>
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
          <Path path={geo.chargeSpokes} style="stroke" strokeWidth={1.8 * k} strokeCap="round" color={rgba(beamC, 0.8)} />
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
          <Group transform={cloudT}><Path path={geo.clouds} style="stroke" strokeWidth={3 * k} strokeCap="round" color="rgba(255,255,255,0.4)" /></Group>
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
      <SwShockwave f={f} cx={pcx} cy={pcy} Rp={Rp} k={k} />
      {geo.chunks.map((d, i) => (
        <Chunk key={i} d={d} f={f} fill={fragmentColors[d.material]} edge={rgba(fireC, 0.6)} />
      ))}
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

/** OVERLAY numarası → katman (OverlayLayers LAYERS'a eklenir). */
export const UNIVERSE_LAYERS = {
  17: GotScene,
  18: DuneScene,
  19: BatScene,
  20: SpiderScene,
  21: LotrScene,
  22: BbScene,
  23: PbScene,
  26: AotScene,
  29: Tether,
  30: SkyBeam,
  31: VikingsScene,
  32: StarWarsFx,
  33: HpScene,
  34: OpShip,
  35: RmScene,
  36: MatrixScene,
};
