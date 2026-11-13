// components/decor/sceneEventsB.js
//
// Uzun sinematikli 12 evren sahnesinin İKİNCİ olayları (olay B). Sahnenin kendi zaman çizelgesi
// (xxxFrame) artık eventU(p, t, 0) ile yalnız A döngülerinde oynar; B döngülerinde sahne sakin
// kalır ve buradaki kısa olay `eventU(p, t, 1)` ile oynar (A, B, A, B… sırayla).
//
//   Vikings      → Odin'in iki kuzgunu ayın önünden geçer
//   GoT          → kızıl kuyruklu yıldız gökyüzünü boydan boya geçer
//   Harry Potter → beyaz baykuş mektup getirir, mektup süzülerek düşer
//   LOTR         → Gandalf'ın havai fişekleri (iki patlama)
//   Batman       → yarasa sürüsü kuleden fırlayıp göğe dağılır
//   Spider-Man   → polis helikopteri ışıldakla şehri tarar
//   Matrix       → kara kedi iki kez aynı yürüyüşü yapar (déjà vu), arada yeşil titreme
//   Dune         → ornitopter kanat çırparak geçer, kumda gölgesi
//   AoT          → keşif kolu askeri iki kancayla göğe savrulur
//   Rick & Morty → iki yeşil portal açılır, turşu birinden çıkıp öbürüne düşer
//   Breaking Bad → yanık pembe oyuncak ayı gökten süzülerek iner
//   Prison Break → iki ışıldak göğü ve duvarları tarar
//
// Hepsi tam VEKTÖR; logo/amblem yok. Kurallar: Glow konumu SharedValue değil (Group transform),
// worklet yardımcıları kullanılmadan önce tanımlı, `t * değişkenHız` yok, gradyan sonu rgba(renk, 0).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Circle, Group, LinearGradient, Oval, Path, Rect, Skia, vec } from "@shopify/react-native-skia";
import { eventU, sceneScale } from "../../utils/weatherParticles";
import { SCENERY } from "../../utils/weatherUniverses";
import { Glow, rgba, sm } from "./seasonKit";

const HIDE = [{ translateX: -9999 }, { translateY: -9999 }];

/** 0..1 penceresi (dışında −1). */
const win = (u, a, b) => {
  "worklet";
  return u >= a && u < b ? (u - a) / (b - a) : -1;
};

/** Olaya giriş/çıkış örtüsü. */
const fade = (u, a, b, c, d) => {
  "worklet";
  return u > 1 ? 0 : sm(a, b, u) * (1 - sm(c, d, u));
};

function useLayout(width, height) {
  return useMemo(() => {
    const k = sceneScale(width, height);
    return { k, width, height, ground: height - SCENERY.lift * k };
  }, [width, height]);
}

// ── Ortak: yandan kuş (kuzgun, baykuş) — yerel: gövde x ekseninde, burun +x ──────────
const BIRD_BODY = "M-10 0 C-6 -4 4 -5 9 -2 L14 -1 L9 1 C4 4 -6 4 -10 0 Z M-10 0 L-17 -3 L-16 0 L-17 3 Z";
const BIRD_WING = "M-4 -1 C-8 -12 -2 -20 8 -24 C6 -14 6 -6 4 -1 Z";
const OWL_BODY = "M-9 0 C-9 -9 -2 -12 5 -11 C10 -10 12 -5 11 0 C10 6 4 9 -2 8 C-7 7 -9 4 -9 0 Z M-9 2 L-15 1 L-14 4 Z";
const OWL_FACE = "M6 -10 C10 -10 12 -6 11 -3 C9 -1 6 -2 5 -5 Z";

function Bird({ x, y, flap, scale, body, wing, color, wingColor, face, faceColor, rim }) {
  const tr = useDerivedValue(() => (x.value < -9000 ? HIDE : [{ translateX: x.value }, { translateY: y.value }, { scale }]));
  const wingT = useDerivedValue(() => [{ scaleY: flap.value }]);
  return (
    <Group transform={tr}>
      {/* gece göğünde silüet kaybolmasın: ince ay ışığı kenarı */}
      {rim ? <Path path={body} style="stroke" strokeWidth={1.6} color={rim} /> : null}
      <Path path={body} color={color} />
      {face ? <Path path={face} color={faceColor} /> : null}
      <Group transform={wingT}>
        {rim ? <Path path={wing} style="stroke" strokeWidth={1.6} color={rim} /> : null}
        <Path path={wing} color={wingColor || color} />
      </Group>
    </Group>
  );
}

// ── Vikings: Odin'in kuzgunları ────────────────────────────────────────────────
function RavenPass({ p, clock, L, i }) {
  const { k, width, height } = L;
  const lag = i * 0.06;
  const x = useDerivedValue(() => {
    const u = eventU(p, clock.value, 1);
    const e = win(u, 0.05 + lag, 0.8 + lag);
    return e < 0 ? -9999 : -40 * k + e * (width + 80 * k);
  });
  const y = useDerivedValue(() => {
    const u = eventU(p, clock.value, 1);
    const e = win(u, 0.05 + lag, 0.8 + lag);
    // ayın (0.28W, 0.17H) önünden geçen yay
    return height * (0.19 + i * 0.045) + Math.sin(e * 6.2 + i) * 14 * k - Math.sin(e * 3.1) * 24 * k;
  });
  const flap = useDerivedValue(() => Math.sin(clock.value * 9 + i * 1.7));
  return (
    <Bird x={x} y={y} flap={flap} scale={k * (1.7 - i * 0.35)} body={BIRD_BODY} wing={BIRD_WING} color="#0e0e12" rim="rgba(200,215,240,0.45)" />
  );
}

export function VikingsEventB({ p, clock, width, height }) {
  const L = useLayout(width, height);
  return (
    <Group>
      <RavenPass p={p} clock={clock} L={L} i={0} />
      <RavenPass p={p} clock={clock} L={L} i={1} />
    </Group>
  );
}

// ── GoT: kızıl kuyruklu yıldız ────────────────────────────────────────────────
export function GotEventB({ p, clock, width, height }) {
  const L = useLayout(width, height);
  const { k } = L;
  const len = 150 * k;
  const tr = useDerivedValue(() => {
    const u = eventU(p, clock.value, 1);
    const e = win(u, 0.04, 0.96);
    if (e < 0) return HIDE;
    return [{ translateX: width * (1.1 - e * 1.3) }, { translateY: height * (0.08 + e * 0.12) }, { rotate: -0.16 }];
  });
  const op = useDerivedValue(() => fade(eventU(p, clock.value, 1), 0.04, 0.16, 0.82, 0.96));
  return (
    <Group transform={tr} opacity={op}>
      <Path path={`M0 ${-3 * k} L${len} ${-9 * k} L${len} ${9 * k} L0 ${3 * k} Z`}>
        <LinearGradient start={vec(0, 0)} end={vec(len, 0)} colors={[rgba("#ff5a3c", 0.85), rgba("#c0182a", 0.35), rgba("#c0182a", 0)]} />
      </Path>
      <Glow r={22 * k} color="#ff6a4a" a={0.55} mid={0.3} />
      <Circle cx={0} cy={0} r={3.2 * k} color="#ffe3d6" />
    </Group>
  );
}

// ── Harry Potter: baykuş + mektup ─────────────────────────────────────────────
export function HpEventB({ p, clock, width, height }) {
  const L = useLayout(width, height);
  const { k, ground } = L;
  const x = useDerivedValue(() => {
    const e = win(eventU(p, clock.value, 1), 0.04, 0.7);
    return e < 0 ? -9999 : -40 * k + e * (width + 80 * k);
  });
  const y = useDerivedValue(() => {
    const e = win(eventU(p, clock.value, 1), 0.04, 0.7);
    return height * 0.3 - Math.sin(e * 3.14) * 50 * k + Math.sin(e * 14) * 4 * k;
  });
  const flap = useDerivedValue(() => 0.7 * Math.sin(clock.value * 7));
  // mektup: baykuşun altında taşınır, u 0.36'da bırakılır, sallanarak zemine iner
  const letterT = useDerivedValue(() => {
    const u = eventU(p, clock.value, 1);
    if (u > 1 || u < 0.04) return HIDE;
    const drop = 0.36;
    const xd = -40 * k + ((drop - 0.04) / 0.66) * (width + 80 * k);
    const yd = height * 0.3 - Math.sin(((drop - 0.04) / 0.66) * 3.14) * 50 * k;
    if (u < drop) {
      const e = (u - 0.04) / 0.66;
      return [{ translateX: -40 * k + e * (width + 80 * k) }, { translateY: height * 0.3 - Math.sin(e * 3.14) * 50 * k + 12 * k }, { scale: k }];
    }
    const f = Math.min(1, (u - drop) / 0.5);
    return [
      { translateX: xd + Math.sin(f * 9) * 26 * k },
      { translateY: yd + 12 * k + f * (ground - 24 * k - yd) },
      { rotate: Math.sin(f * 9) * 0.6 },
      { scale: k },
    ];
  });
  const letterO = useDerivedValue(() => fade(eventU(p, clock.value, 1), 0.04, 0.06, 0.9, 0.99));
  return (
    <Group>
      <Group transform={letterT} opacity={letterO}>
        <Rect x={-7} y={-4.5} width={14} height={9} color="#efe4c8" />
        <Path path="M-7 -4.5 L0 1 L7 -4.5" style="stroke" strokeWidth={0.7} color="#a08a60" />
        <Circle cx={0} cy={1} r={1.6} color="#8a1c1c" />
      </Group>
      <Bird x={x} y={y} flap={flap} scale={k * 2} body={OWL_BODY} wing={BIRD_WING} color="#f4f1ea" wingColor="#e2ddd2" face={OWL_FACE} faceColor="#d8d2c4" />
    </Group>
  );
}

// ── LOTR: Gandalf'ın havai fişekleri ──────────────────────────────────────────
const FW = [
  { at: 0.04, x: 0.3, top: 0.2, col: "#7dff9a" },
  { at: 0.3, x: 0.7, top: 0.15, col: "#ffd36a" },
  { at: 0.52, x: 0.5, top: 0.12, col: "#ff8ad8" },
];
function Firework({ p, clock, L, i }) {
  const { k, width, height, ground } = L;
  const f = FW[i];
  const cx = width * f.x;
  const cy = height * f.top;
  const trail = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const e = win(eventU(p, clock.value, 1), f.at, f.at + 0.12);
    if (e < 0) return q;
    const y = ground - (ground - cy) * (1 - (1 - e) * (1 - e));
    q.moveTo(cx, y);
    q.lineTo(cx, y + 30 * k);
    return q;
  });
  const sparks = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const e = win(eventU(p, clock.value, 1), f.at + 0.12, f.at + 0.42);
    if (e < 0) return q;
    const r = (8 + 110 * sm(0, 0.35, e)) * k;
    const dot = Math.max(0.6, (3.4 - e * 2.4)) * k;
    for (let j = 0; j < 36; j += 1) {
      const a = (j / 36) * 6.2832 + i;
      const rr = r * (j % 3 === 0 ? 1 : j % 3 === 1 ? 0.78 : 0.5);
      q.addCircle(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr + e * e * 60 * k, dot);
    }
    return q;
  });
  const flashO = useDerivedValue(() => {
    const e = win(eventU(p, clock.value, 1), f.at + 0.12, f.at + 0.42);
    return e < 0 ? 0 : 1 - sm(0, 0.6, e);
  });
  return (
    <Group>
      <Path path={trail} style="stroke" strokeWidth={1.6 * k} strokeCap="round" color={rgba("#fff1c8", 0.85)} />
      <Group transform={[{ translateX: cx }, { translateY: cy }]} opacity={flashO}>
        <Glow r={90 * k} color={f.col} a={0.3} mid={0.3} />
      </Group>
      <Path path={sparks} color={f.col} />
    </Group>
  );
}
export function LotrEventB({ p, clock, width, height }) {
  const L = useLayout(width, height);
  return (
    <Group>
      <Firework p={p} clock={clock} L={L} i={0} />
      <Firework p={p} clock={clock} L={L} i={1} />
      <Firework p={p} clock={clock} L={L} i={2} />
    </Group>
  );
}

// ── Batman: yarasa sürüsü ─────────────────────────────────────────────────────
export function BatmanEventB({ p, clock, width, height }) {
  const L = useLayout(width, height);
  const { k, ground } = L;
  const ox = width * SCENERY.gargoyle.x;
  const oy = ground - SCENERY.gargoyle.top * k;
  const swarm = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const u = eventU(p, clock.value, 1);
    if (u > 1) return q;
    for (let j = 0; j < 18; j += 1) {
      const e = win(u, 0.04 + (j % 6) * 0.025, 0.7 + (j % 6) * 0.025);
      if (e < 0) continue;
      const spread = (j / 17 - 0.5) * 1.6;
      const x = ox - e * width * (0.9 + 0.3 * Math.sin(j)) + Math.sin(e * 8 + j) * 14 * k;
      const y = oy - e * (oy - 40 * k) * (0.7 + 0.3 * Math.cos(j * 1.3)) + spread * e * 80 * k;
      const s = (6 + (j % 3) * 1.5) * k;
      const w = Math.sin(clock.value * 18 + j * 2.1);
      q.moveTo(x - 2.2 * s, y - w * s);
      q.quadTo(x - s, y - 0.2 * s, x, y + 0.4 * s);
      q.quadTo(x + s, y - 0.2 * s, x + 2.2 * s, y - w * s);
      q.quadTo(x + s, y + 0.4 * s, x, y + 0.9 * s);
      q.quadTo(x - s, y + 0.4 * s, x - 2.2 * s, y - w * s);
      q.close();
    }
    return q;
  });
  return (
    <Group>
      <Path path={swarm} style="stroke" strokeWidth={1.4 * k} strokeJoin="round" color="rgba(190,200,225,0.4)" />
      <Path path={swarm} color="#07070b" />
    </Group>
  );
}

// ── Spider-Man: helikopter + ışıldak ──────────────────────────────────────────
const HELI = "M-18 -4 C-18 -10 -8 -12 2 -12 C12 -12 18 -8 18 -2 C18 3 12 5 2 5 L-6 5 C-12 5 -18 2 -18 -4 Z M-18 -3 L-46 -6 L-46 -2 L-18 1 Z M-46 -10 L-42 -10 L-40 -2 L-46 -2 Z";
export function SpiderEventB({ p, clock, width, height }) {
  const L = useLayout(width, height);
  const { k, ground } = L;
  const pos = useDerivedValue(() => {
    const e = win(eventU(p, clock.value, 1), 0.03, 0.97);
    return e < 0 ? -9999 : width * (1.15 - e * 1.3);
  });
  const tr = useDerivedValue(() =>
    pos.value < -9000 ? HIDE : [{ translateX: pos.value }, { translateY: height * 0.16 + Math.sin(clock.value * 1.4) * 3 * k }, { scale: k * 1.6 }],
  );
  const beamT = useDerivedValue(() => [{ rotate: 0.35 * Math.sin(clock.value * 0.9) }]);
  const beamLen = (ground - height * 0.16) / (k * 1.6);
  const rotor = useDerivedValue(() => 0.5 + 0.5 * Math.sin(clock.value * 40));
  const blink = useDerivedValue(() => (Math.sin(clock.value * 6) > 0.6 ? 1 : 0.15));
  return (
    <Group transform={tr}>
      <Group transform={beamT}>
        <Path path={`M-4 4 L4 4 L${beamLen * 0.28} ${beamLen} L${-beamLen * 0.28} ${beamLen} Z`}>
          <LinearGradient start={vec(0, 0)} end={vec(0, beamLen)} colors={[rgba("#fff6d8", 0.45), rgba("#fff6d8", 0)]} />
        </Path>
      </Group>
      <Path path={HELI} color="#151820" />
      <Path path="M-8 5 L-8 9 M8 5 L8 9 M-14 9 L14 9" style="stroke" strokeWidth={1.2} color="#151820" />
      <Group opacity={rotor}>
        <Path path="M-30 -14 L30 -14" style="stroke" strokeWidth={1.4} color="rgba(30,34,44,0.8)" />
      </Group>
      <Path path="M0 -12 L0 -14" style="stroke" strokeWidth={2} color="#151820" />
      <Group opacity={blink}>
        <Circle cx={-45} cy={-10} r={1.6} color="#ff3030" />
      </Group>
      <Circle cx={12} cy={-6} r={2.4} color="rgba(160,200,240,0.6)" />
    </Group>
  );
}

// ── Matrix: déjà vu kedisi ────────────────────────────────────────────────────
const CAT = "M-14 -8 C-10 -12 6 -12 10 -9 L12 -14 L14 -10 L16 -14 L17 -8 C19 -6 18 -2 15 -2 L13 -2 L12 0 L-12 0 L-14 -3 C-20 -4 -24 -10 -22 -16 C-21 -12 -18 -9 -14 -8 Z";
function CatPass({ p, clock, L, a, b }) {
  const { k, width, ground } = L;
  const tr = useDerivedValue(() => {
    const e = win(eventU(p, clock.value, 1), a, b);
    if (e < 0) return HIDE;
    return [{ translateX: -30 * k + e * (width + 60 * k) }, { translateY: ground - 2 * k + Math.abs(Math.sin(e * 40)) * -1.2 * k }, { scale: k * 1.7 }];
  });
  const legA = useDerivedValue(() => [{ rotate: 0.4 * Math.sin(clock.value * 10) }]);
  const legB = useDerivedValue(() => [{ rotate: -0.4 * Math.sin(clock.value * 10) }]);
  return (
    <Group transform={tr}>
      <Path path={CAT} color="#050805" />
      {[-9, 8].map((lx, i) => (
        <Group key={lx} transform={[{ translateX: lx }, { translateY: -1 }]}>
          <Group transform={i === 0 ? legA : legB}>
            <Path path="M0 0 L0 6" style="stroke" strokeWidth={2} strokeCap="round" color="#050805" />
          </Group>
        </Group>
      ))}
      <Circle cx={14} cy={-7} r={0.9} color="#7dff7d" />
    </Group>
  );
}
export function MatrixEventB({ p, clock, width, height }) {
  const L = useLayout(width, height);
  const glitch = useDerivedValue(() => {
    const u = eventU(p, clock.value, 1);
    if (u > 1) return 0;
    const v = 1 - Math.abs(u - 0.47) / 0.025;
    return v > 0 ? v * (0.6 + 0.4 * Math.sin(clock.value * 60)) : 0;
  });
  return (
    <Group>
      <CatPass p={p} clock={clock} L={L} a={0.06} b={0.42} />
      <CatPass p={p} clock={clock} L={L} a={0.5} b={0.86} />
      <Group opacity={glitch}>
        <Rect x={0} y={0} width={width} height={height} color="rgba(60,255,110,0.14)" />
        <Rect x={0} y={height * 0.42} width={width} height={3 * L.k} color="rgba(120,255,150,0.45)" />
      </Group>
    </Group>
  );
}

// ── Dune: ornitopter ─────────────────────────────────────────────────────────
const ORNI_BODY = "M-26 -3 C-26 -8 -14 -10 0 -10 C14 -10 26 -6 30 -1 C26 3 14 5 0 5 C-14 5 -26 3 -26 -3 Z M-26 -2 L-40 -4 L-40 0 L-26 1 Z";
const ORNI_WING = "M-14 -9 L-30 -26 L14 -26 L18 -9 Z";
export function DuneEventB({ p, clock, width, height }) {
  const L = useLayout(width, height);
  const { k, ground } = L;
  const px = useDerivedValue(() => {
    const e = win(eventU(p, clock.value, 1), 0.04, 0.94);
    return e < 0 ? -9999 : -60 * k + e * (width + 120 * k);
  });
  const tr = useDerivedValue(() => (px.value < -9000 ? HIDE : [{ translateX: px.value }, { translateY: height * 0.24 + Math.sin(clock.value * 1.7) * 6 * k }, { scale: k }]));
  const wingT = useDerivedValue(() => [{ scaleY: 0.3 + 0.7 * Math.abs(Math.sin(clock.value * 16)) }]);
  const shadowT = useDerivedValue(() => (px.value < -9000 ? HIDE : [{ translateX: px.value + 20 * k }, { translateY: ground - 4 * k }]));
  return (
    <Group>
      <Group transform={shadowT}>
        <Oval x={-34 * k} y={-3 * k} width={68 * k} height={6 * k} color="rgba(0,0,0,0.22)" />
      </Group>
      <Group transform={tr}>
        <Group transform={wingT}>
          <Path path={ORNI_WING} color="rgba(190,170,140,0.55)" />
          <Path path="M-14 -9 L-30 -26 M18 -9 L14 -26 M2 -9 L-8 -26" style="stroke" strokeWidth={0.8} color="#6a5a44" />
        </Group>
        <Path path={ORNI_BODY} color="#5e5446" />
        <Path path="M10 -8 C18 -8 24 -5 27 -2 L10 -2 Z" color="rgba(170,210,230,0.55)" />
      </Group>
    </Group>
  );
}

// ── AoT: keşif kolu askeri (iki kancalı savrulma) ─────────────────────────────
export function AotEventB({ p, clock, width, height }) {
  const L = useLayout(width, height);
  const { k, ground } = L;
  const wallTop = ground - SCENERY.titanWallTop * k;
  // kancalar duvarın taç kenarına saplanır; asker duvarın önünde sarkaç gibi savrulur
  const anchors = [
    [width * 0.3, wallTop + 3 * k],
    [width * 0.72, wallTop + 3 * k],
  ];
  const rope = 120 * k;
  const st = useDerivedValue(() => {
    const u = eventU(p, clock.value, 1);
    for (let s = 0; s < 2; s += 1) {
      const e = win(u, 0.08 + s * 0.38, 0.4 + s * 0.38);
      if (e >= 0) {
        const th = -1.1 + e * 2.2;
        const [ax, ay] = anchors[s];
        return { on: 1, s, x: ax + Math.sin(th) * rope, y: ay + Math.cos(th) * rope, a: th };
      }
    }
    // kancalar arası takla uçuşu
    const g = win(u, 0.4, 0.46);
    if (g >= 0) {
      const x0 = anchors[0][0] + Math.sin(1.1) * rope;
      const y0 = anchors[0][1] + Math.cos(1.1) * rope;
      const x1 = anchors[1][0] + Math.sin(-1.1) * rope;
      const y1 = anchors[1][1] + Math.cos(-1.1) * rope;
      return { on: 1, s: -1, x: x0 + (x1 - x0) * g, y: y0 + (y1 - y0) * g - Math.sin(g * 3.14) * 90 * k, a: g * 6.28 };
    }
    return { on: 0, s: -1, x: -9999, y: 0, a: 0 };
  });
  const lines = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const v = st.value;
    if (!v.on || v.s < 0) return q;
    const [ax, ay] = anchors[v.s];
    q.moveTo(v.x - 2 * k, v.y);
    q.lineTo(ax - 6 * k, ay);
    q.moveTo(v.x + 2 * k, v.y);
    q.lineTo(ax + 6 * k, ay);
    return q;
  });
  const tr = useDerivedValue(() => (st.value.on ? [{ translateX: st.value.x }, { translateY: st.value.y }, { rotate: st.value.a * 0.5 }, { scale: k * 1.5 }] : HIDE));
  const capeT = useDerivedValue(() => [{ skewX: 0.3 * Math.sin(clock.value * 12) }]);
  return (
    <Group>
      <Path path={lines} style="stroke" strokeWidth={0.8 * k} color="rgba(220,220,230,0.7)" />
      <Group transform={tr}>
        <Group transform={capeT}>
          <Path path="M-4 -6 L4 -6 L9 10 L-9 10 Z" color="#2f5a3a" />
        </Group>
        <Path path="M-2.5 -6 L2.5 -6 L3 6 L-3 6 Z" color="#8a6a48" />
        <Circle cx={0} cy={-9} r={3} color="#e0b896" />
        <Path path="M-3 -10 C-3 -13 3 -13 3 -10 Z" color="#3a2a1a" />
        <Path path="M-3 6 L-4 13 M3 6 L4 13" style="stroke" strokeWidth={2} strokeCap="round" color="#e8e2d8" />
        <Rect x={-6} y={1} width={3} height={4} color="#9aa2aa" />
        <Rect x={3} y={1} width={3} height={4} color="#9aa2aa" />
      </Group>
    </Group>
  );
}

// ── Rick & Morty: iki portal + turşu ─────────────────────────────────────────
function Portal({ p, clock, L, cx, cy, a, b }) {
  const { k } = L;
  const sc = useDerivedValue(() => {
    const u = eventU(p, clock.value, 1);
    if (u > 1) return 0;
    return sm(a, a + 0.06, u) * (1 - sm(b - 0.06, b, u));
  });
  const tr = useDerivedValue(() => [{ translateX: cx }, { translateY: cy }, { scale: sc.value < 0.001 ? 0.001 : sc.value }]);
  const spin = useDerivedValue(() => [{ rotate: clock.value * 2.4 }]);
  const swirl = useMemo(() => {
    const q = Skia.Path.Make();
    for (let arm = 0; arm < 3; arm += 1) {
      for (let j = 0; j <= 24; j += 1) {
        const t = j / 24;
        const ang = arm * 2.094 + t * 4.2;
        const r = t * 26 * k;
        const x = Math.cos(ang) * r;
        const y = Math.sin(ang) * r * 1.3;
        if (j === 0) q.moveTo(x, y);
        else q.lineTo(x, y);
      }
    }
    return q;
  }, [k]);
  return (
    <Group transform={tr}>
      <Glow r={60 * k} color="#7dff4a" a={0.4} mid={0.3} />
      <Oval x={-28 * k} y={-36 * k} width={56 * k} height={72 * k} color="#39c43a" />
      <Oval x={-22 * k} y={-29 * k} width={44 * k} height={58 * k} color="#a8ff6a" />
      <Group transform={spin}>
        <Path path={swirl} style="stroke" strokeWidth={2.4 * k} strokeCap="round" color="#2a9a2c" />
      </Group>
    </Group>
  );
}
export function RmEventB({ p, clock, width, height }) {
  const L = useLayout(width, height);
  const { k } = L;
  const A = [width * 0.76, height * 0.24];
  const B = [width * 0.22, height * 0.4];
  const pickleT = useDerivedValue(() => {
    const e = win(eventU(p, clock.value, 1), 0.3, 0.62);
    if (e < 0) return HIDE;
    const x = A[0] + (B[0] - A[0]) * e;
    const y = A[1] + (B[1] - A[1]) * e - Math.sin(e * 3.14) * 90 * k;
    return [{ translateX: x }, { translateY: y }, { rotate: e * 9 }, { scale: k * (0.6 + 0.4 * Math.sin(e * 3.14)) }];
  });
  return (
    <Group>
      <Portal p={p} clock={clock} L={L} cx={A[0]} cy={A[1]} a={0.12} b={0.5} />
      <Portal p={p} clock={clock} L={L} cx={B[0]} cy={B[1]} a={0.42} b={0.82} />
      <Group transform={pickleT}>
        <Path path="M-14 -5 C-14 -9 -8 -10 0 -10 C8 -10 14 -9 14 -4 C14 4 8 7 0 7 C-8 7 -14 4 -14 -5 Z" color="#5aa33a" />
        <Path path="M-9 -6 L-8 -4 M-3 -8 L-2 -6 M4 -7 L5 -5 M9 -4 L10 -2 M-6 2 L-5 4 M2 3 L3 5" style="stroke" strokeWidth={1} color="#2f6a1e" />
        <Circle cx={-4} cy={-2} r={2.4} color="#ffffff" />
        <Circle cx={4} cy={-2} r={2.4} color="#ffffff" />
        <Circle cx={-3.6} cy={-2} r={1} color="#111" />
        <Circle cx={4.4} cy={-2} r={1} color="#111" />
        <Path path="M-3 3 C-1 5 2 5 4 3" style="stroke" strokeWidth={1} color="#1a3a10" />
      </Group>
    </Group>
  );
}

// ── Breaking Bad: yanık pembe ayı ─────────────────────────────────────────────
export function BbEventB({ p, clock, width, height }) {
  const L = useLayout(width, height);
  const { k, ground } = L;
  const land = ground - (SCENERY.mesaGround + 14) * k;
  const tr = useDerivedValue(() => {
    const u = eventU(p, clock.value, 1);
    const e = win(u, 0.04, 0.7);
    if (u > 1 || u < 0.04) return HIDE;
    if (e < 0) return [{ translateX: width * 0.58 }, { translateY: land }, { rotate: 0.25 }, { scale: k * 1.5 }];
    const y = -40 * k + (land + 40 * k) * sm(0, 1, e);
    // salınım iniş sonunda söner → yerdeki duruşa sıçramadan oturur
    const sway = 1 - e;
    return [
      { translateX: width * 0.5 + Math.sin(e * 7) * 34 * k * sway + e * width * 0.08 },
      { translateY: y },
      { rotate: Math.sin(e * 5) * 0.7 * sway + e * 0.25 },
      { scale: k * 1.5 },
    ];
  });
  const op = useDerivedValue(() => fade(eventU(p, clock.value, 1), 0.04, 0.06, 0.88, 0.99));
  const puff = useDerivedValue(() => {
    const e = win(eventU(p, clock.value, 1), 0.7, 0.9);
    return e < 0 ? 0 : 0.5 * (1 - e);
  });
  const puffT = useDerivedValue(() => {
    const e = win(eventU(p, clock.value, 1), 0.7, 0.9);
    return [{ translateX: width * 0.58 }, { translateY: land + 6 * k }, { scale: k * (1 + (e < 0 ? 0 : e) * 2) }];
  });
  return (
    <Group>
      <Group transform={puffT} opacity={puff}>
        <Oval x={-24} y={-6} width={48} height={12} color="rgba(210,190,160,0.7)" />
      </Group>
      <Group transform={tr} opacity={op}>
        <Circle cx={-7} cy={-16} r={4} color="#e58fb0" />
        <Circle cx={7} cy={-16} r={4} color="#e58fb0" />
        <Oval x={-10} y={-4} width={20} height={20} color="#e58fb0" />
        <Circle cx={0} cy={-11} r={9} color="#ef9cbc" />
        <Oval x={-4} y={-9} width={8} height={6} color="#f7c4d6" />
        <Circle cx={0} cy={-7.6} r={1.2} color="#3a1a24" />
        <Circle cx={-3.5} cy={-13} r={1.4} color="#20141a" />
        {/* kayıp göz: yalnız soluk iz */}
        <Circle cx={3.5} cy={-13} r={1.4} color="rgba(255,255,255,0.75)" />
        <Oval x={-15} y={-1} width={8} height={12} color="#e58fb0" />
        <Oval x={7} y={-1} width={8} height={12} color="#e58fb0" />
        <Oval x={-9} y={13} width={8} height={7} color="#e58fb0" />
        <Oval x={1} y={13} width={8} height={7} color="#e58fb0" />
        <Path path="M-6 2 C-3 0 -1 4 -4 7 M4 5 C6 8 3 10 2 8" style="stroke" strokeWidth={1.4} color="rgba(40,24,20,0.6)" />
      </Group>
    </Group>
  );
}

// ── Prison Break: ışıldaklar ─────────────────────────────────────────────────
function Searchlight({ p, clock, L, x, phase }) {
  const { k, ground, height } = L;
  const len = height * 0.95;
  const T = useDerivedValue(() => [{ translateX: x }, { translateY: ground - 40 * k }, { rotate: Math.PI + 0.55 * Math.sin(clock.value * 0.6 + phase) }]);
  const op = useDerivedValue(() => fade(eventU(p, clock.value, 1), 0.04, 0.1, 0.88, 0.97));
  return (
    <Group transform={T} opacity={op}>
      <Path path={`M-3 0 L3 0 L${len * 0.12} ${len} L${-len * 0.12} ${len} Z`}>
        <LinearGradient start={vec(0, 0)} end={vec(0, len)} colors={[rgba("#fffbe6", 0.5), rgba("#fffbe6", 0.12), rgba("#fffbe6", 0)]} />
      </Path>
      <Circle cx={0} cy={0} r={4 * k} color="#fffbe6" />
    </Group>
  );
}
export function PbEventB({ p, clock, width, height }) {
  const L = useLayout(width, height);
  return (
    <Group>
      <Searchlight p={p} clock={clock} L={L} x={width * 0.12} phase={0} />
      <Searchlight p={p} clock={clock} L={L} x={width * 0.88} phase={2.4} />
    </Group>
  );
}
