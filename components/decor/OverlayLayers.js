// components/decor/OverlayLayers.js
//
// Tür ışık katmanları (KIND.overlay): korkuda sis + titreyen lamba, gerilimde
// kalp atışı vinyeti, müzikte ekolayzer… Hepsi ekran boyutunda vektör; yollar
// ve gradyanlar boyut değişince BİR KEZ kurulur, kare başına yalnız Group
// dönüşümü/opaklığı değişir (Reanimated türetilmiş değer, UI thread).
//
// Zamanlama ve renk: utils/weatherParticles.js (overlayFrame, overlaySlot,
// equalizerLevel, hazeLine, overlayStyle). Işığa duyarlılık sınırları orada.
// ParticleField katmanı ikiye böler: OVERLAY_FRONT Atlas'ın önünde, gerisi
// arkasında.

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import {
  Circle,
  Group,
  LinearGradient,
  Oval,
  Path,
  RadialGradient,
  Rect,
  RoundedRect,
  Skia,
  vec,
} from "@shopify/react-native-skia";
import {
  OVERLAY,
  equalizerLevel,
  hazeLine,
  overlayFrame,
  overlaySlot,
  overlayStyle,
} from "../../utils/weatherParticles";
import SolarScene from "./solarScene";
import WinterScene from "./winterScene";
import SpringScene from "./springScene";
import { SummerBeach, SummerSky } from "./summerScene";
import AutumnScene from "./autumnScene";
import RainScene from "./rainScene";
import AuroraScene from "./auroraScene";
import StarScene from "./starScene";
import CampfireScene from "./campfireScene";
import FireworksScene from "./fireworksScene";
import HalloweenScene from "./halloweenScene";
import ChristmasScene from "./christmasScene";
import SherlockScene from "./sherlockScene";
import DeathNoteScene from "./deathNoteScene";
import OnePieceScene from "./onePieceScene";
import NarutoScene from "./narutoScene";
import FmaScene from "./fmaScene";
import JujutsuScene from "./jujutsuScene";
import HunterScene from "./hunterScene";
import SquidGameScene from "./squidGameScene";
import DarkScene from "./darkScene";
import TitanicScene from "./titanicScene";
import InceptionScene from "./inceptionScene";
import PiratesScene from "./piratesScene";
import MadMaxScene from "./madMaxScene";
import AvatarScene from "./avatarScene";
import JurassicScene from "./jurassicScene";
import LastOfUsScene from "./lastOfUsScene";
import GhibliScene from "./ghibliScene";
import BladeRunnerScene from "./bladeRunnerScene";
import DemonSlayerScene from "./demonSlayerScene";
import StrangerScene from "./strangerScene";
import InterstellarScene from "./interstellarScene";
import { UNIVERSE_LAYERS } from "./universeOverlays";

function rgba(hex, a) {
  const h = String(hex).replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Merkezden saydama inen yuvarlak ışık (r yarıçap, ortada c renk).
function Glow({ cx = 0, cy = 0, r, color, mid = 0.45 }) {
  return (
    <Circle cx={cx} cy={cy} r={r}>
      <RadialGradient c={vec(cx, cy)} r={r} colors={[rgba(color, 1), rgba(color, mid), rgba(color, 0)]} positions={[0, 0.4, 1]} />
    </Circle>
  );
}

function useFrame(p, clock, width, height) {
  return useDerivedValue(() => overlayFrame(p, clock.value, width, height));
}

// ── 0 · Aksiyon: alt kenardan patlama ışığı ────────────────────────────────
function Flare({ p, clock, width, height, tone }) {
  const f = useFrame(p, clock, width, height);
  const opacity = useDerivedValue(() => f.value.a * tone.alpha);
  const transform = useDerivedValue(() => [{ translateX: f.value.x }, { translateY: height }]);
  const r = Math.max(width, height) * 0.42;
  return (
    <Group opacity={opacity} transform={transform}>
      <Glow r={r} color={tone.colors[0]} mid={0.4} />
    </Group>
  );
}

// ── 1 · Bilim kurgu: halkalı gezegen ──────────────────────────────────────
function Planet({ p, clock, width, height, tone }) {
  const f = useFrame(p, clock, width, height);
  const transform = useDerivedValue(() => [{ translateX: f.value.x }, { translateY: f.value.y }, { rotate: f.value.r }]);
  const R = p.size * width;
  const [light, dark, ring] = tone.colors;
  const front = useMemo(() => Skia.XYWHRect(-R * 3, 0, R * 6, R * 2), [R]);
  const ringProps = { x: -R * 2.1, y: -R * 0.52, width: R * 4.2, height: R * 1.04, style: "stroke", strokeWidth: R * 0.13 };
  return (
    <Group opacity={tone.alpha} transform={transform}>
      <Oval {...ringProps} color={rgba(ring, 0.55)} />
      <Circle cx={0} cy={0} r={R}>
        <RadialGradient c={vec(-R * 0.35, -R * 0.35)} r={R * 1.5} colors={[light, dark]} />
      </Circle>
      <Group clip={front}>
        <Oval {...ringProps} color={ring} />
      </Group>
    </Group>
  );
}

// ── 2 · Gerilim: kalp atışı vinyeti ───────────────────────────────────────
function Heartbeat({ p, clock, width, height, tone }) {
  const f = useFrame(p, clock, width, height);
  const opacity = useDerivedValue(() => f.value.a * tone.alpha);
  const c = tone.colors[0];
  return (
    <Group opacity={opacity}>
      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient
          c={vec(width / 2, height / 2)}
          r={Math.hypot(width, height) * 0.55}
          colors={[rgba(c, 0), rgba(c, 0), rgba(c, 0.55), rgba(c, 1)]}
          positions={[0, 0.5, 0.82, 1]}
        />
      </Rect>
    </Group>
  );
}

// ── 3 · Korku: alttan süzülen sis ─────────────────────────────────────────
function Fog({ p, clock, width, height, tone }) {
  const f = useFrame(p, clock, width, height);
  const transform = useDerivedValue(() => [
    { translateX: f.value.x },
    { translateY: f.value.y },
    { scaleX: (width * 0.9) / 100 },
    { scaleY: (height * 0.16) / 100 },
  ]);
  return (
    <Group opacity={tone.alpha} transform={transform}>
      <Glow r={100} color={tone.colors[0]} mid={0.6} />
      <Glow cx={70} cy={-14} r={70} color={tone.colors[0]} mid={0.5} />
    </Group>
  );
}

// ── 4 · Korku: tavandan titreyen lamba konisi ─────────────────────────────
function Lamp({ p, clock, width, height, tone }) {
  const f = useFrame(p, clock, width, height);
  const opacity = useDerivedValue(() => f.value.a * tone.alpha);
  const cone = useMemo(() => {
    const path = Skia.Path.Make();
    const cx = width / 2;
    path.moveTo(cx - 14, 0);
    path.lineTo(cx + 14, 0);
    path.lineTo(width * 1.1, height * 0.78);
    path.lineTo(-width * 0.1, height * 0.78);
    path.close();
    return path;
  }, [width, height]);
  const c = tone.colors[0];
  return (
    <Group opacity={opacity}>
      <Path path={cone}>
        <LinearGradient start={vec(0, 0)} end={vec(0, height * 0.78)} colors={[rgba(c, 1), rgba(c, 0.35), rgba(c, 0)]} positions={[0, 0.35, 1]} />
      </Path>
      <Glow cx={width / 2} cy={0} r={Math.min(width, height) * 0.3} color={c} mid={0.6} />
    </Group>
  );
}

// ── 5 · Gizem: gezinen el feneri ──────────────────────────────────────────
function Flashlight({ p, clock, width, height, tone }) {
  const f = useFrame(p, clock, width, height);
  const transform = useDerivedValue(() => [{ translateX: f.value.x }, { translateY: f.value.y }]);
  return (
    <Group opacity={tone.alpha} transform={transform}>
      <Glow r={Math.min(width, height) * 0.34} color={tone.colors[0]} mid={0.75} />
    </Group>
  );
}

// ── 6 · Suç: çapraz jaluzi gölgesi ────────────────────────────────────────
function Blinds({ p, clock, width, height, tone }) {
  const f = useFrame(p, clock, width, height);
  const opacity = useDerivedValue(() => f.value.a * tone.alpha);
  const transform = useDerivedValue(() => [
    { translateX: width / 2 },
    { translateY: height / 2 + f.value.y },
    { rotate: -0.42 },
  ]);
  const slats = useMemo(() => {
    const path = Skia.Path.Make();
    const span = Math.hypot(width, height);
    const step = Math.max(26, span / 26);
    for (let y = -span; y < span; y += step) path.addRect(Skia.XYWHRect(-span, y, span * 2, step * 0.5));
    return path;
  }, [width, height]);
  return (
    <Group opacity={opacity} transform={transform}>
      <Path path={slats} color={tone.colors[0]} />
    </Group>
  );
}

// ── 7 · Suç: alttan neon yansıması ────────────────────────────────────────
function Neon({ p, clock, width, height, tone }) {
  const f = useFrame(p, clock, width, height);
  const pink = useDerivedValue(() => f.value.a * tone.alpha * (0.45 + 0.55 * f.value.r));
  const cyan = useDerivedValue(() => f.value.a * tone.alpha * (1 - 0.55 * f.value.r));
  const r = Math.max(width, height) * 0.45;
  return (
    <>
      <Group opacity={pink}>
        <Glow cx={width * 0.12} cy={height * 1.02} r={r} color={tone.colors[0]} mid={0.35} />
      </Group>
      <Group opacity={cyan}>
        <Glow cx={width * 0.9} cy={height * 1.04} r={r * 0.9} color={tone.colors[1]} mid={0.35} />
      </Group>
    </>
  );
}

// ── 8 · Romantik: üst köşelerde sıcak ışık ────────────────────────────────
function WarmGlow({ p, clock, width, height, tone }) {
  const f = useFrame(p, clock, width, height);
  const opacity = useDerivedValue(() => f.value.a * tone.alpha);
  const r = Math.max(width, height) * 0.5;
  return (
    <Group opacity={opacity}>
      <Glow cx={-width * 0.05} cy={-height * 0.02} r={r} color={tone.colors[0]} mid={0.4} />
      <Glow cx={width * 1.05} cy={height * 0.06} r={r * 0.8} color={tone.colors[1]} mid={0.4} />
    </Group>
  );
}

// ── 9 · Müzik: ekolayzer çubukları ────────────────────────────────────────
function EqBar({ p, clock, i, x, barW, maxH, height, color }) {
  const transform = useDerivedValue(() => [{ translateY: height }, { scaleY: equalizerLevel(p, clock.value, i) }]);
  return (
    <Group transform={transform}>
      <RoundedRect x={x} y={-maxH} width={barW} height={maxH} r={barW * 0.35}>
        <LinearGradient start={vec(0, -maxH)} end={vec(0, 0)} colors={[rgba(color, 0.9), rgba(color, 0.15)]} />
      </RoundedRect>
    </Group>
  );
}

function Equalizer({ p, clock, width, height, tone }) {
  const bars = Math.max(10, Math.min(24, Math.round(width / 22)));
  const slot = width / bars;
  const barW = slot * 0.62;
  const maxH = Math.min(height * 0.13, 120);
  return (
    <Group opacity={tone.alpha}>
      {Array.from({ length: bars }, (_, i) => (
        <EqBar
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          p={p}
          clock={clock}
          i={i}
          x={i * slot + (slot - barW) / 2}
          barW={barW}
          maxH={maxH}
          height={height}
          color={tone.colors[i % tone.colors.length]}
        />
      ))}
    </Group>
  );
}

// ── 10 · Tarih: titreyen mum ışığı ────────────────────────────────────────
function Candle({ p, clock, width, height, tone }) {
  const f = useFrame(p, clock, width, height);
  const opacity = useDerivedValue(() => f.value.a * tone.alpha);
  return (
    <Group opacity={opacity}>
      <Glow cx={width / 2} cy={height * 1.04} r={Math.max(width, height) * 0.62} color={tone.colors[0]} mid={0.4} />
    </Group>
  );
}

// ── 11 · Belgesel: kamera vizörü + REC ────────────────────────────────────
function Viewfinder({ p, clock, width, height, tone }) {
  const f = useFrame(p, clock, width, height);
  const dot = useDerivedValue(() => f.value.r);
  const k = Math.max(0.7, Math.min(1.2, width / 390));
  const inset = 22 * k;
  const top = Math.max(inset, height * 0.07);
  const bottom = height - Math.max(inset, height * 0.05);
  const len = 28 * k;
  const brackets = useMemo(() => {
    const path = Skia.Path.Make();
    const L = inset;
    const R = width - inset;
    path.moveTo(L, top + len); path.lineTo(L, top); path.lineTo(L + len, top);
    path.moveTo(R - len, top); path.lineTo(R, top); path.lineTo(R, top + len);
    path.moveTo(L, bottom - len); path.lineTo(L, bottom); path.lineTo(L + len, bottom);
    path.moveTo(R - len, bottom); path.lineTo(R, bottom); path.lineTo(R, bottom - len);
    const c = 9 * k;
    path.moveTo(width / 2 - c, height / 2); path.lineTo(width / 2 + c, height / 2);
    path.moveTo(width / 2, height / 2 - c); path.lineTo(width / 2, height / 2 + c);
    return path;
  }, [width, height, inset, top, bottom, len, k]);
  return (
    <Group opacity={tone.alpha}>
      <Path path={brackets} style="stroke" strokeWidth={2 * k} strokeCap="round" strokeJoin="round" color={tone.colors[0]} />
      <Group opacity={dot}>
        <Circle cx={inset + len + 12 * k} cy={top + 9 * k} r={4.5 * k} color={tone.colors[1]} />
      </Group>
    </Group>
  );
}

// ── 12 · Savaş: ufukta uzak çakmalar ──────────────────────────────────────
function FarFlash({ p, clock, i, width, height, tone }) {
  const s = useDerivedValue(() => overlaySlot(p, clock.value, i, width, height));
  const opacity = useDerivedValue(() => s.value.a * tone.alpha);
  const transform = useDerivedValue(() => [{ translateX: s.value.x }, { translateY: s.value.y }, { scaleY: 0.55 }]);
  return (
    <Group opacity={opacity} transform={transform}>
      <Glow r={width * 0.34} color={tone.colors[0]} mid={0.35} />
    </Group>
  );
}

// ── 13 · Western: yükselen sıcak hava ─────────────────────────────────────
function HazeLine({ p, clock, i, path, baseY, tone }) {
  const v = useDerivedValue(() => hazeLine(p, clock.value, i));
  const transform = useDerivedValue(() => [{ translateX: v.value.dx }, { translateY: baseY + v.value.dy }]);
  const opacity = useDerivedValue(() => v.value.a * tone.alpha);
  return (
    <Group opacity={opacity} transform={transform}>
      <Path path={path} style="stroke" strokeWidth={2.2} strokeCap="round" color={tone.colors[0]} />
    </Group>
  );
}

function HeatHaze({ p, clock, width, height, tone }) {
  const path = useMemo(() => {
    const out = Skia.Path.Make();
    const step = 8;
    for (let x = -30; x <= width + 30; x += step) {
      const y = Math.sin((x / width) * Math.PI * 7) * 3.5;
      if (x === -30) out.moveTo(x, y);
      else out.lineTo(x, y);
    }
    return out;
  }, [width]);
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <HazeLine key={i} p={p} clock={clock} i={i} path={path} baseY={height * (0.86 + 0.03 * (i % 2))} tone={tone} />
      ))}
    </>
  );
}

// ── 14 · Realite: gezen spot ışığı ────────────────────────────────────────
function Spotlight({ p, clock, width, height, tone }) {
  const f = useFrame(p, clock, width, height);
  const ax = p.xr0 * width;
  const transform = useDerivedValue(() => [{ translateX: ax }, { translateY: -12 }, { rotate: f.value.r }]);
  const L = height * 1.05;
  const cone = useMemo(() => {
    const path = Skia.Path.Make();
    const spread = Math.tan(0.24) * L;
    path.moveTo(-8, 0);
    path.lineTo(8, 0);
    path.lineTo(spread, L);
    path.lineTo(-spread, L);
    path.close();
    return path;
  }, [L]);
  const c = tone.colors[0];
  return (
    <Group opacity={tone.alpha} transform={transform}>
      <Path path={cone}>
        <LinearGradient start={vec(0, 0)} end={vec(0, L)} colors={[rgba(c, 1), rgba(c, 0.45), rgba(c, 0)]} positions={[0, 0.5, 1]} />
      </Path>
    </Group>
  );
}

// ── 15 · Realite: paparazzi flaşları ──────────────────────────────────────
function Paparazzo({ p, clock, i, width, height, tone, burst }) {
  const s = useDerivedValue(() => overlaySlot(p, clock.value, i, width, height));
  const opacity = useDerivedValue(() => s.value.a * tone.alpha);
  const transform = useDerivedValue(() => [{ translateX: s.value.x }, { translateY: s.value.y }]);
  return (
    <Group opacity={opacity} transform={transform}>
      <Glow r={30} color={tone.colors[1]} mid={0.4} />
      <Path path={burst} style="stroke" strokeWidth={1.6} strokeCap="round" color={tone.colors[0]} />
      <Circle cx={0} cy={0} r={4} color={tone.colors[0]} />
    </Group>
  );
}

function Paparazzi({ p, clock, width, height, tone }) {
  const burst = useMemo(() => {
    const path = Skia.Path.Make();
    for (let k = 0; k < 4; k += 1) {
      const a = (k * Math.PI) / 4;
      const len = k % 2 ? 11 : 20;
      path.moveTo(-Math.cos(a) * len, -Math.sin(a) * len);
      path.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    }
    return path;
  }, []);
  return (
    <>
      {Array.from({ length: p.slots }, (_, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <Paparazzo key={i} p={p} clock={clock} i={i} width={width} height={height} tone={tone} burst={burst} />
      ))}
    </>
  );
}

function FarFlashes({ p, clock, width, height, tone }) {
  return (
    <>
      {Array.from({ length: p.slots }, (_, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <FarFlash key={i} p={p} clock={clock} i={i} width={width} height={height} tone={tone} />
      ))}
    </>
  );
}

const LAYERS = {
  [OVERLAY.orbits]: SolarScene,
  [OVERLAY.winter]: WinterScene,
  [OVERLAY.spring]: SpringScene,
  [OVERLAY.summerSky]: SummerSky,
  [OVERLAY.summerBeach]: SummerBeach,
  [OVERLAY.autumn]: AutumnScene,
  [OVERLAY.rain]: RainScene,
  [OVERLAY.storm]: RainScene,
  [OVERLAY.aurora]: AuroraScene,
  [OVERLAY.stars]: StarScene,
  [OVERLAY.campfire]: CampfireScene,
  [OVERLAY.fwCity]: FireworksScene,
  [OVERLAY.haunted]: HalloweenScene,
  [OVERLAY.xmasVillage]: ChristmasScene,
  [OVERLAY.sherVec]: SherlockScene,
  [OVERLAY.dnVec]: DeathNoteScene,
  [OVERLAY.opSky]: OnePieceScene,
  [OVERLAY.narVec]: NarutoScene,
  [OVERLAY.fmaVec]: FmaScene,
  [OVERLAY.jjVec]: JujutsuScene,
  [OVERLAY.hxVec]: HunterScene,
  [OVERLAY.sqVec]: SquidGameScene,
  [OVERLAY.dkVec]: DarkScene,
  [OVERLAY.tiVec]: TitanicScene,
  [OVERLAY.inVec]: InceptionScene,
  [OVERLAY.pcVec]: PiratesScene,
  [OVERLAY.mmVec]: MadMaxScene,
  [OVERLAY.avVec]: AvatarScene,
  [OVERLAY.jpVec]: JurassicScene,
  [OVERLAY.tlVec]: LastOfUsScene,
  [OVERLAY.ghVec]: GhibliScene,
  [OVERLAY.brVec]: BladeRunnerScene,
  [OVERLAY.dsVec]: DemonSlayerScene,
  [OVERLAY.stVec]: StrangerScene,
  [OVERLAY.isVec]: InterstellarScene,
  [OVERLAY.flare]: Flare,
  [OVERLAY.planet]: Planet,
  [OVERLAY.heartbeat]: Heartbeat,
  [OVERLAY.fog]: Fog,
  [OVERLAY.lamp]: Lamp,
  [OVERLAY.flashlight]: Flashlight,
  [OVERLAY.blinds]: Blinds,
  [OVERLAY.neon]: Neon,
  [OVERLAY.warmGlow]: WarmGlow,
  [OVERLAY.equalizer]: Equalizer,
  [OVERLAY.candle]: Candle,
  [OVERLAY.viewfinder]: Viewfinder,
  [OVERLAY.farFlashes]: FarFlashes,
  [OVERLAY.heatHaze]: HeatHaze,
  [OVERLAY.spotlight]: Spotlight,
  [OVERLAY.paparazzi]: Paparazzi,
  // film/dizi/anime evrenleri (17–30): universeOverlays.js
  ...UNIVERSE_LAYERS,
};

/** Bir grup ışık katmanı (arka ya da ön). */
export function OverlayLayers({ overlays, clock, width, height, lightSurface }) {
  return (
    <Group>
      {overlays.map((p, i) => {
        const Layer = LAYERS[p.part];
        if (!Layer) return null;
        const tone = overlayStyle(p.part, lightSurface);
        // eslint-disable-next-line react/no-array-index-key
        return <Layer key={`${p.part}-${p.salt}-${i}`} p={p} clock={clock} width={width} height={height} tone={tone} lightSurface={lightSurface} />;
      })}
    </Group>
  );
}

export default OverlayLayers;
