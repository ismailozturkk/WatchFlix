// components/decor/swBackdrop.js
//
// Star Wars sahnesinin (StarWarsFx, OVERLAY.swPlanet = 32) arka planı ve şok dalgası — VEKTÖR:
//   • Bulutsu (mor + camgöbeği yumuşak ışık), köşede halkalı gaz devi.
//   • Sakin yarıda (olay saatinin dinlenme bölümü) Yıldız Destroyeri yavaşça ekranı geçer:
//     kama gövde (aydınlık üst / gölgeli alt yüz, ortadaki hendek, panel çizgileri ve ışıklar),
//     basamaklı üst yapı + köprü kulesi ve iki kalkan kubbesi, arkada üç mavi motor; yanında
//     iki TIE avcısı eşlik eder.
//   • SwShockwave: Alderaan patlamasının yassı, ince parlak halkası (kalın çizgi yerine bant
//     gradyanı; büyüdükçe kalınlaşmaz).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Circle, Group, LinearGradient, Oval, Path, RadialGradient, Skia, vec } from "@shopify/react-native-skia";

const SD_UPPER = "M130 2 L-118 -30 L-128 -26 L-128 4 Z";
const SD_LOWER = "M130 2 L-128 4 L-126 12 L-110 26 Z";
const SD_BLOCKS =
  "M-112 -29 L-40 -19 L-40 -24 L-104 -34 Z M-108 -33 L-60 -27 L-60 -32 L-100 -39 Z M-104 -38 L-76 -34 L-76 -42 L-100 -45 Z M-96 -44 L-82 -43 L-83 -58 L-95 -59 Z";
const SD_BRIDGE = "M-112 -58 L-66 -57 L-67 -63 L-110 -64 Z";

function buildDestroyer() {
  const panels = Skia.Path.Make();
  for (let i = 0; i < 22; i += 1) {
    const t = i / 22;
    const x = 120 - t * 230;
    const yTop = 2 - (32 * (120 - x)) / 248;
    const y = yTop + 3 + ((i * 7) % 11) * ((2 - yTop) / 12);
    panels.moveTo(x, y);
    panels.lineTo(x - 6 - (i % 4) * 3, y - 0.8);
  }
  panels.moveTo(128, 2);
  panels.lineTo(-126, 4);
  const lights = Skia.Path.Make();
  for (let i = 0; i < 26; i += 1) {
    const x = 110 - ((i * 37) % 220);
    const y = 6 + ((i * 13) % 9) * ((x + 128) / 260) * 1.6;
    lights.addCircle(x, y, 0.55);
  }
  return { panels, lights };
}

const TIE = (
  <Group>
    <Path path="M-9 -11 L-7 -13 L-7 13 L-9 11 Z M9 -11 L7 -13 L7 13 L9 11 Z" color="#5d646d" />
    <Path path="M-7 0 L7 0" style="stroke" strokeWidth={1.4} color="#5d646d" />
    <Circle cx={0} cy={0} r={4.2} color="#7a828c" />
    <Circle cx={0} cy={0} r={2.2} color="#1f2428" />
  </Group>
);

export function SwBackdrop({ p, clock, width, height, k, light }) {
  const geo = useMemo(() => buildDestroyer(), []);
  // dinlenme yarısında (saat evresi 0,52–0,98) yavaş geçiş
  const st = useDerivedValue(() => {
    const c0 = (clock.value / p.period + p.y0) % 1;
    const s = (c0 - 0.52) / 0.46;
    if (s <= 0 || s >= 1) return { x: -9999, y: 0, o: 0 };
    const L = 260 * 0.95 * k;
    const x = -L * 0.6 + (width + L * 1.2) * s;
    return { x, y: height * 0.17 + Math.sin(s * 3) * 6 * k, o: Math.min(1, s * 8, (1 - s) * 8) };
  });
  const sdT = useDerivedValue(() => [{ translateX: st.value.x }, { translateY: st.value.y }, { scale: 0.95 * k }, { rotate: -0.05 }]);
  const sdO = useDerivedValue(() => st.value.o);
  const engO = useDerivedValue(() => 0.75 + 0.2 * Math.sin(clock.value * 2.3));
  const tie = (dx, dy, ph) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDerivedValue(() => [
      { translateX: st.value.x + dx * k + Math.sin(clock.value * 0.7 + ph) * 8 * k },
      { translateY: st.value.y + dy * k + Math.sin(clock.value * 0.9 + ph) * 5 * k },
      { scale: 0.62 * k },
    ]);
  const tieA = tie(150, 34, 0);
  const tieB = tie(172, 52, 2);
  const neb = light ? 0.55 : 1;
  return (
    <Group>
      {/* bulutsu */}
      <Circle cx={width * 0.12} cy={height * 0.18} r={width * 0.7}>
        <RadialGradient c={vec(width * 0.12, height * 0.18)} r={width * 0.7} colors={[`rgba(140,90,220,${0.14 * neb})`, `rgba(90,60,180,${0.06 * neb})`, "rgba(60,40,140,0)"]} positions={[0, 0.5, 1]} />
      </Circle>
      <Circle cx={width * 0.95} cy={height * 0.5} r={width * 0.6}>
        <RadialGradient c={vec(width * 0.95, height * 0.5)} r={width * 0.6} colors={[`rgba(60,190,210,${0.11 * neb})`, `rgba(40,120,180,${0.05 * neb})`, "rgba(30,80,140,0)"]} positions={[0, 0.55, 1]} />
      </Circle>
      {/* halkalı gaz devi */}
      <Group opacity={light ? 0.55 : 0.8}>
        <Oval x={width * 0.86 - 70 * k} y={height * 0.66 - 9 * k} width={140 * k} height={18 * k} style="stroke" strokeWidth={3 * k} color="rgba(220,190,150,0.35)" />
        <Circle cx={width * 0.86} cy={height * 0.66} r={38 * k}>
          <LinearGradient start={vec(width * 0.86, height * 0.66 - 38 * k)} end={vec(width * 0.86, height * 0.66 + 38 * k)} colors={["#c9a27a", "#8a6a52", "#a07a5c", "#4a3a34"]} positions={[0, 0.35, 0.55, 1]} />
        </Circle>
        <Circle cx={width * 0.86} cy={height * 0.66} r={38 * k}>
          <RadialGradient c={vec(width * 0.86 + 20 * k, height * 0.66 + 18 * k)} r={50 * k} colors={["rgba(0,0,10,0.75)", "rgba(0,0,10,0)"]} />
        </Circle>
        <Path
          path={`M${width * 0.86 - 70 * k} ${height * 0.66} C${width * 0.86 - 60 * k} ${height * 0.66 + 12 * k} ${width * 0.86 + 60 * k} ${height * 0.66 + 12 * k} ${width * 0.86 + 70 * k} ${height * 0.66}`}
          style="stroke"
          strokeWidth={3 * k}
          color="rgba(230,200,160,0.5)"
        />
      </Group>
      {/* Yıldız Destroyeri */}
      <Group opacity={sdO}>
        <Group transform={sdT}>
          <Group opacity={engO}>
            {[-17, -6, 5].map((y) => (
              <Circle key={y} cx={-130} cy={y} r={9}>
                <RadialGradient c={vec(-130, y)} r={9} colors={["rgba(235,245,255,1)", "rgba(120,180,255,0.6)", "rgba(80,140,255,0)"]} />
              </Circle>
            ))}
          </Group>
          <Path path={SD_LOWER} color="#3e444c" />
          <Path path={SD_UPPER}>
            <LinearGradient start={vec(0, -30)} end={vec(0, 4)} colors={["#b9c0c8", "#8b939c"]} />
          </Path>
          <Path path={geo.panels} style="stroke" strokeWidth={0.6} color="rgba(40,46,54,0.55)" />
          <Path path={SD_BLOCKS} color="#9aa2ab" />
          <Path path={SD_BLOCKS} style="stroke" strokeWidth={0.5} color="rgba(40,46,54,0.5)" />
          <Path path={SD_BRIDGE} color="#aab1ba" />
          <Circle cx={-104} cy={-66} r={3} color="#9aa2ab" />
          <Circle cx={-72} cy={-65} r={3} color="#9aa2ab" />
          <Path path="M-110 -61 L-67 -60" style="stroke" strokeWidth={0.7} color="rgba(255,240,190,0.7)" />
          <Path path={geo.lights} color="rgba(255,240,200,0.75)" />
        </Group>
        <Group transform={tieA}>{TIE}</Group>
        <Group transform={tieB}>{TIE}</Group>
      </Group>
    </Group>
  );
}

/** Patlamanın yassı şok halkası: ince parlak bant, yatık elips. */
export function SwShockwave({ f, cx, cy, Rp, k }) {
  const tr = useDerivedValue(() => {
    const b = f.value.b;
    const e = 1 - (1 - b) * (1 - b) * (1 - b);
    const s = 0.6 + 5.2 * e;
    return [{ translateX: cx }, { translateY: cy }, { rotate: -0.32 }, { scaleX: s }, { scaleY: s * 0.26 }];
  });
  const op = useDerivedValue(() => {
    if (!f.value.blast) return 0;
    const b = f.value.b;
    const a = b < 0.04 ? b / 0.04 : 1;
    return a * (1 - Math.min(1, Math.max(0, (b - 0.3) / 0.4)));
  });
  return (
    <Group transform={tr} opacity={op}>
      <Circle cx={0} cy={0} r={Rp}>
        <RadialGradient
          c={vec(0, 0)}
          r={Rp}
          colors={["rgba(255,200,120,0)", "rgba(255,200,120,0)", "rgba(255,190,110,0.35)", "rgba(255,250,235,0.95)", "rgba(180,220,255,0.5)", "rgba(150,200,255,0)"]}
          positions={[0, 0.7, 0.88, 0.94, 0.97, 1]}
        />
      </Circle>
    </Group>
  );
}
