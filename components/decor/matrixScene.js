// components/decor/matrixScene.js
//
// Matrix atmosfer sahnesi (OVERLAY.matrixCity = 36) — tamamı VEKTÖR (kod yağmuru parçacıklarla önde):
//   • Yeşile çalan gece şehri: iki kat gökdelen (yanıp sönen yeşil pencereler, antenler), şehir pusu,
//     arada uzaktan geçen helikopter (dönen pervane, projektör); önde çatı: korkuluk, havalandırma
//     kutuları, merdiven kulübesi ve kapısı, helipad işareti.
//   • Olay (matrixFrame, 30 sn): kapıdan Ajan çıkar, Neo'ya yürür → silahını kaldırır, ateş eder →
//     MERMİ ZAMANI: sahne yeşile kayar, Neo geriye bükülür (paltosu sarkar, kolları ağır ağır döner),
//     mermiler hava halkaları bırakarak üstünden süzülür → Neo doğrulur → Ajan yine ateş eder, Neo elini
//     kaldırır: mermiler havada durur, titreşir, yere düşer → Ajan yeşil koda dağılıp yok olur.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift (sekme çubuğu). Renkler OVERLAY_TONES[36] (MX_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Circle, Group, LinearGradient, Oval, Path, RadialGradient, Rect, Skia, vec } from "@shopify/react-native-skia";
import { matrixFrame, sceneScale } from "../../utils/weatherParticles";
import { SCENERY } from "../../utils/weatherUniverses";

const MX_TONE = ["bldFar", "bldNear", "window", "roof", "roofLit", "haze", "coat", "suit", "skin", "glow", "metal", "night"];
const toneMap = (colors) => Object.fromEntries(MX_TONE.map((name, i) => [name, colors[i] || colors[0]]));

function rgba(hex, a) {
  const h = String(hex).replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// İlk sıra mermiler (Neo'nun üstünden geçer): [çıkış u, yükseklik (çatıdan dp)]
const SHOTS = [[0.19, 62], [0.235, 70], [0.28, 56], [0.325, 66]];
const FLY = 0.2;
// İkinci sıra (havada durur): durma noktası x (Neo'dan dp), y (çatıdan dp)
const STOPS = [[34, 58], [44, 68], [40, 48]];

/** Sahne yerleşimi (dp). */
export function matrixLayout(width, height) {
  const k = sceneScale(width, height);
  const ground = height - SCENERY.lift * k;
  const roof = ground - 34 * k;
  return {
    k, ground, roof,
    neoX: width * 0.32,
    agentX: width * 0.76,
    doorX: width * 0.93,
    gun: [width * 0.76 - 30 * k, roof - 56 * k],
    fig: 1.05 * k, // figür ölçeği (boy ~74 birim)
  };
}

// ── Şehir ──────────────────────────────────────────────────────────────────────
function buildCity(L, width, height) {
  const { k, roof } = L;
  let s = 17;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const layer = (base, hMin, hMax, wMin, wMax, winStep) => {
    const body = Skia.Path.Make();
    const wins = [Skia.Path.Make(), Skia.Path.Make(), Skia.Path.Make()];
    const ant = Skia.Path.Make();
    const tips = [];
    let x = -10;
    while (x < width + 10) {
      const w = (wMin + rnd() * (wMax - wMin)) * k;
      const h = (hMin + rnd() * (hMax - hMin)) * k;
      const top = base - h;
      body.addRect(Skia.XYWHRect(x, top, w - 2 * k, base - top + 2));
      // basamaklı tepe
      if (rnd() < 0.5) body.addRect(Skia.XYWHRect(x + w * 0.2, top - 12 * k, w * 0.5, 13 * k));
      if (rnd() < 0.35) {
        ant.moveTo(x + w * 0.45, top - (rnd() < 0.5 ? 12 * k : 0));
        const at = top - (30 + rnd() * 30) * k;
        ant.lineTo(x + w * 0.45, at);
        tips.push([x + w * 0.45, at]);
      }
      for (let wy = top + 6 * k; wy < base - 4 * k; wy += winStep * k) {
        for (let wx = x + 4 * k; wx < x + w - 6 * k; wx += 6 * k) {
          const r = rnd();
          if (r < 0.32) wins[Math.floor(rnd() * 3)].addRect(Skia.XYWHRect(wx, wy, 2.6 * k, 3.4 * k));
        }
      }
      x += w;
    }
    return { body, wins, ant, tips };
  };
  const far = layer(roof - 40 * k, 120, 280, 26, 52, 8);
  const near = layer(roof + 2 * k, 60, 170, 40, 74, 9);
  return { far, near };
}

function buildRoof(L, width, height) {
  const { k, roof, doorX } = L;
  const slab = Skia.Path.Make();
  slab.addRect(Skia.XYWHRect(-5, roof, width + 10, height - roof + 2));
  const ledge = Skia.Path.Make();
  ledge.addRect(Skia.XYWHRect(-5, roof - 4 * k, width + 10, 5 * k));
  // korkuluk
  const rail = Skia.Path.Make();
  rail.moveTo(-5, roof - 26 * k);
  rail.lineTo(width + 5, roof - 26 * k);
  rail.moveTo(-5, roof - 15 * k);
  rail.lineTo(width + 5, roof - 15 * k);
  for (let x = 0; x < width + 10; x += 24 * k) {
    rail.moveTo(x, roof - 4 * k);
    rail.lineTo(x, roof - 27 * k);
  }
  // havalandırma kutuları + borular
  const units = Skia.Path.Make();
  const unitsLit = Skia.Path.Make();
  for (const [x, w, h] of [[0.05, 46, 24], [0.47, 34, 18], [0.56, 22, 30]]) {
    units.addRect(Skia.XYWHRect(width * x, roof - h * k, w * k, h * k));
    unitsLit.addRect(Skia.XYWHRect(width * x, roof - h * k, w * k, 2.4 * k));
  }
  units.addRect(Skia.XYWHRect(width * 0.05 + 4 * k, roof - 36 * k, 6 * k, 12 * k));
  units.addRect(Skia.XYWHRect(width * 0.05 + 30 * k, roof - 32 * k, 6 * k, 8 * k));
  // fan ızgarası
  const grill = Skia.Path.Make();
  for (let i = 1; i < 6; i += 1) {
    grill.moveTo(width * 0.47 + i * 5.6 * k, roof - 16 * k);
    grill.lineTo(width * 0.47 + i * 5.6 * k, roof - 3 * k);
  }
  // merdiven kulübesi + kapı (sağda)
  const hut = Skia.Path.Make();
  hut.addRect(Skia.XYWHRect(doorX - 22 * k, roof - 86 * k, 54 * k, 86 * k));
  const hutTop = Skia.Path.Make();
  hutTop.addRect(Skia.XYWHRect(doorX - 25 * k, roof - 90 * k, 60 * k, 5 * k));
  const door = Skia.Path.Make();
  door.addRect(Skia.XYWHRect(doorX - 12 * k, roof - 68 * k, 24 * k, 68 * k));
  // helipad
  const pad = Skia.Path.Make();
  pad.addOval(Skia.XYWHRect(width * 0.36, roof + 6 * k, width * 0.36, 26 * k));
  const H = Skia.Path.Make();
  const hx = width * 0.54;
  const hy = roof + 19 * k;
  H.moveTo(hx - 12 * k, hy - 7 * k);
  H.lineTo(hx - 12 * k, hy + 7 * k);
  H.moveTo(hx + 12 * k, hy - 7 * k);
  H.lineTo(hx + 12 * k, hy + 7 * k);
  H.moveTo(hx - 12 * k, hy);
  H.lineTo(hx + 12 * k, hy);
  // çatı derzleri
  const joints = Skia.Path.Make();
  for (let i = 1; i < 6; i += 1) {
    const y = roof + i * i * 2.4 * k;
    joints.moveTo(-5, y);
    joints.lineTo(width + 5, y);
  }
  for (let i = -6; i < 8; i += 1) {
    joints.moveTo(width * 0.5 + i * 30 * k, roof);
    joints.lineTo(width * 0.5 + i * 70 * k, height);
  }
  return { slab, ledge, rail, units, unitsLit, grill, hut, hutTop, door, pad, H, joints };
}

// ── Figürler — yerel: ayak 0,0; boy ~74 birim; yüz sağa (+x) ──
// Neo: uzun siyah palto, güneş gözlüğü. Diz noktası (0, −22) etrafında geriye bükülür.
const NEO_SHIN_A = "M-2 0 L2 0 L3 -22 L-2 -22 Z";
const NEO_THIGH = "M-4 0 L4 0 L5 -24 L-4 -24 Z"; // diz (0,0) → kalça (0,−24)
const NEO_TORSO = "M-7 0 L7 0 C8 -10 9 -20 8 -26 C4 -29 -4 -29 -8 -26 C-9 -20 -8 -10 -7 0 Z"; // kalça → omuz
const NEO_COAT = "M-8 -26 C-11 -14 -13 2 -16 26 L-6 28 L-1 6 L1 6 L6 28 L14 26 C12 4 10 -12 8 -26 Z";

function Neo({ L, f, clock, c }) {
  const k = L.fig;
  const tr = [{ translateX: L.neoX }, { translateY: L.roof }, { scale: k }];
  const kneeT = useDerivedValue(() => [{ rotate: -1.18 * f.value.lean }]);
  const torsoT = useDerivedValue(() => [{ rotate: -0.25 * f.value.lean }]);
  // palto: büküldükçe yere doğru sarkar (yerçekimi) + rüzgârda dalgalanır
  const coatT = useDerivedValue(() => [{ rotate: 1.15 * f.value.lean }, { scaleX: 1 + 0.08 * Math.sin(clock.value * 3) + 0.2 * f.value.lean }, { scaleY: 1 - 0.42 * f.value.lean }]);
  const armA = useDerivedValue(() => {
    const q = f.value;
    const spin = q.lean * (Math.sin(clock.value * 0.9) * 1.4 - 1.6);
    return [{ rotate: 0.15 + spin - 1.75 * q.hand }];
  });
  const armB = useDerivedValue(() => {
    const q = f.value;
    return [{ rotate: -0.1 + q.lean * (Math.sin(clock.value * 0.9 + 2) * 1.2 + 1.2) }];
  });
  return (
    <Group transform={tr}>
      {/* baldırlar (öne hafif eğik) */}
      <Group transform={[{ translateX: -4 }, { rotate: 0.12 }]}>
        <Path path={NEO_SHIN_A} color={c.coat} />
        <Path path="M-3 0 L6 0 L5 -3 L-3 -3 Z" color={c.coat} />
      </Group>
      <Group transform={[{ translateX: 4 }, { rotate: 0.18 }]}>
        <Path path={NEO_SHIN_A} color={c.coat} />
        <Path path="M-3 0 L6 0 L5 -3 L-3 -3 Z" color={c.coat} />
      </Group>
      {/* diz → üst gövde */}
      <Group transform={[{ translateX: 2 }, { translateY: -22 }]}>
        <Group transform={kneeT}>
          <Path path={NEO_THIGH} color={c.coat} />
          <Group transform={[{ translateY: -24 }]}>
            <Group transform={torsoT}>
              {/* palto eteği (kalçadan sarkar) */}
              <Group transform={[{ translateY: -26 }]}>
                <Group transform={coatT}>
                  <Group transform={[{ translateY: 26 }]}>
                    <Path path={NEO_COAT} color={c.coat} />
                    <Path path="M-1 6 L-6 28 M1 6 L6 28" style="stroke" strokeWidth={0.6} color={rgba(c.glow, 0.25)} />
                  </Group>
                </Group>
              </Group>
              {/* arka kol */}
              <Group transform={[{ translateX: -3 }, { translateY: -25 }]}>
                <Group transform={armB}>
                  <Path path="M-2 0 L2 0 L1.6 20 L-1.6 20 Z" color={c.coat} />
                  <Circle cx={0} cy={21.5} r={2} color={c.skin} />
                </Group>
              </Group>
              <Path path={NEO_TORSO} color={c.coat} />
              <Path path="M-2 -27 L0 -16 L2 -27" style="stroke" strokeWidth={0.8} color={rgba(c.glow, 0.3)} />
              {/* baş */}
              <Path path="M-2 -28 L2 -28 L2 -31 L-2 -31 Z" color={c.skin} />
              <Oval x={-4.2} y={-40} width={8.6} height={10} color={c.skin} />
              <Path path="M-4.4 -36 C-5 -42 4.6 -43 4.4 -36 C3 -39 -2 -39.4 -4.4 -36 Z" color="#0c0c0c" />
              <Path path="M-1 -36.6 L5 -36.6 L4.6 -34.6 L1.6 -34.6 Z" color="#050605" />
              <Path path="M-0.6 -36.4 L4.6 -36.4" style="stroke" strokeWidth={0.5} color={rgba(c.glow, 0.7)} />
              {/* ön kol (elini kaldırır) */}
              <Group transform={[{ translateX: 3 }, { translateY: -25 }]}>
                <Group transform={armA}>
                  <Path path="M-2 0 L2 0 L1.6 20 L-1.6 20 Z" color={c.coat} />
                  <Path path="M-2 19 L2 19 L2.4 24 L-1.8 24 Z" color={c.skin} />
                </Group>
              </Group>
            </Group>
          </Group>
        </Group>
      </Group>
    </Group>
  );
}

// Ajan: takım elbise, kravat, gözlük, kulaklık; yüz sola (scaleX −1).
function Agent({ L, f, clock, c }) {
  const k = L.fig;
  const tr = useDerivedValue(() => {
    const q = f.value;
    const x = L.doorX + (L.agentX - L.doorX) * q.walk;
    return [{ translateX: x }, { translateY: L.roof }, { scale: k }, { scaleX: -1 }];
  });
  const step = useDerivedValue(() => (f.value.walk > 0 && f.value.walk < 1 ? 1 : 0));
  const legA = useDerivedValue(() => [{ rotate: Math.sin(clock.value * 7) * 0.32 * step.value }]);
  const legB = useDerivedValue(() => [{ rotate: -Math.sin(clock.value * 7) * 0.32 * step.value }]);
  const gunArm = useDerivedValue(() => {
    const q = f.value;
    const kick = q.kick;
    return [{ rotate: -1.52 * q.aim + kick * 0.3 }];
  });
  const flashO = useDerivedValue(() => f.value.flash);
  return (
    <Group transform={tr}>
      <Group transform={[{ translateY: -38 }]}>
        <Group transform={legA}>
          <Path path="M-3 0 L3 0 L2.6 36 L-2.6 36 Z" color={c.suit} />
          <Path path="M-3 35 L6 35 L6 38 L-3 38 Z" color="#060606" />
        </Group>
        <Group transform={legB}>
          <Path path="M-3 0 L3 0 L2.6 36 L-2.6 36 Z" color={c.suit} />
          <Path path="M-3 35 L6 35 L6 38 L-3 38 Z" color="#060606" />
        </Group>
      </Group>
      <Path path="M-8 -38 L8 -38 C9 -48 9 -58 7 -64 C3 -67 -3 -67 -7 -64 C-9 -58 -9 -48 -8 -38 Z" color={c.suit} />
      <Path path="M-1.6 -64 L1.6 -64 L0.9 -46 L0 -44 L-0.9 -46 Z" color="#0a0a0a" />
      <Path path="M-3.6 -64.5 L0 -58 L3.6 -64.5 Z" color="#e6e6e2" />
      <Path path="M-1.6 -64 L1.6 -64 L0.9 -46 L0 -44 L-0.9 -46 Z" color="#141414" />
      <Path path="M-8 -38 L8 -38" style="stroke" strokeWidth={1} color="rgba(0,0,0,0.4)" />
      {/* baş */}
      <Path path="M-2 -66 L2 -66 L2 -69 L-2 -69 Z" color={c.skin} />
      <Oval x={-4.2} y={-78} width={8.6} height={10.4} color={c.skin} />
      <Path path="M-4.4 -73.4 C-4.6 -80 4.6 -80.2 4.4 -73.4 C3 -76.4 -3 -76.4 -4.4 -73.4 Z" color="#1a1612" />
      <Path path="M-1.2 -74 L5 -74 L4.8 -72 L1.6 -72 Z" color="#050505" />
      <Path path="M-4.2 -72 C-6 -70 -6 -66 -5 -63" style="stroke" strokeWidth={0.6} color="#d8dcd8" />
      {/* silah kolu */}
      <Group transform={[{ translateX: 3 }, { translateY: -62 }]}>
        <Group transform={gunArm}>
          <Path path="M-2.2 0 L2.2 0 L1.8 22 L-1.8 22 Z" color={c.suit} />
          <Circle cx={0} cy={23} r={2.1} color={c.skin} />
          <Path path="M-1.8 23 L1.6 23 L1.4 32 L-1.4 32 Z" color="#1a1c1e" />
          <Group opacity={flashO}>
            <Circle cx={0} cy={36} r={6}>
              <RadialGradient c={vec(0, 36)} r={6} colors={["rgba(255,255,220,1)", "rgba(180,255,160,0.6)", "rgba(120,255,140,0)"]} />
            </Circle>
          </Group>
        </Group>
      </Group>
    </Group>
  );
}

// Mermi + hava halkaları (ilk sıra: Neo'nun üstünden süzülür)
function Bullet({ L, f, i, clock, c }) {
  const [t0, h] = SHOTS[i];
  const st = useDerivedValue(() => {
    const u = f.value.u;
    const s = (u - t0) / FLY;
    if (u > 1 || s <= 0 || s >= 1) return { o: 0, x: -999, y: 0 };
    const x0 = L.gun[0];
    const x1 = -40 * L.k;
    const x = x0 + (x1 - x0) * s;
    const y = L.roof - h * L.k + Math.sin(s * 3 + i) * 2 * L.k;
    return { o: Math.min(1, s * 30) * Math.min(1, (1 - s) * 10), x, y };
  });
  const tr = useDerivedValue(() => [{ translateX: st.value.x }, { translateY: st.value.y }, { scale: L.k }]);
  const op = useDerivedValue(() => st.value.o);
  const ring = (j) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDerivedValue(() => {
      const ph = (clock.value * 0.9 + j / 3) % 1;
      return [{ translateX: 8 + ph * 46 }, { scaleY: 0.6 + ph * 1.6 }, { scaleX: 0.35 + ph * 0.5 }];
    });
  const rings = [ring(0), ring(1), ring(2)];
  const ringO = (j) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDerivedValue(() => 1 - ((clock.value * 0.9 + j / 3) % 1));
  const ro = [ringO(0), ringO(1), ringO(2)];
  return (
    <Group transform={tr} opacity={op}>
      <Path path="M2 0 L60 -1.2 L60 1.2 Z" color={rgba(c.glow, 0.25)} />
      {rings.map((t, j) => (
        <Group key={j} transform={t} opacity={ro[j]}>
          <Oval x={-3} y={-9} width={6} height={18} style="stroke" strokeWidth={1} color={rgba(c.glow, 0.7)} />
        </Group>
      ))}
      {/* mermi Ajan'dan (sağ) Neo'ya (sol) uçar: sivri uç sola, kovan dibi sağa */}
      <Path path="M6 -2 L-2 -2 C-4 -2 -6 -1 -7 0 C-6 1 -4 2 -2 2 L6 2 Z" color="#c9a24a" />
      <Path path="M6 -2 L2 -2 L2 2 L6 2 Z" color="#8f7230" />
    </Group>
  );
}

// İkinci sıra: Neo'nun önünde durur, titreşir, düşer
function StopBullet({ L, f, i, clock, c }) {
  const [sx, sy] = STOPS[i];
  const st = useDerivedValue(() => {
    const q = f.value;
    const u = q.u;
    if (u > 1 || u < 0.62 + i * 0.012 || u > 0.9) return { o: 0, x: -999, y: 0, r: 0 };
    const x1 = L.neoX + sx * L.k;
    const y1 = L.roof - sy * L.k;
    const fly = Math.min(1, (u - 0.62 - i * 0.012) / 0.05);
    const e = 1 - (1 - fly) * (1 - fly) * (1 - fly);
    let x = L.gun[0] + (x1 - L.gun[0]) * e;
    let y = L.gun[1] + (y1 - L.gun[1]) * e;
    let r = 0;
    if (u > 0.8) {
      const d = Math.min(1, (u - 0.8 - i * 0.008) / 0.04);
      const dd = d < 0 ? 0 : d;
      y += (L.roof - 2 * L.k - y1) * dd * dd;
      r = dd * (1.2 + i * 0.5);
    } else if (fly >= 1) {
      x += Math.sin(clock.value * 23 + i) * 0.7 * L.k;
      y += Math.sin(clock.value * 19 + i * 2) * 0.7 * L.k;
    }
    return { o: u > 0.86 ? Math.max(0, 1 - (u - 0.86) / 0.04) : 1, x, y, r };
  });
  const tr = useDerivedValue(() => [{ translateX: st.value.x }, { translateY: st.value.y }, { rotate: st.value.r }, { scale: L.k }]);
  const op = useDerivedValue(() => st.value.o);
  const haloO = useDerivedValue(() => f.value.hold * (0.5 + 0.3 * Math.sin(clock.value * 5 + i)));
  return (
    <Group transform={tr} opacity={op}>
      <Group opacity={haloO}>
        <Oval x={-4} y={-11} width={8} height={22} style="stroke" strokeWidth={0.9} color={rgba(c.glow, 0.8)} />
        <Oval x={-2} y={-6} width={4} height={12} style="stroke" strokeWidth={0.7} color={rgba(c.glow, 0.6)} />
      </Group>
      {/* mermi Ajan'dan (sağ) Neo'ya (sol) uçar: sivri uç sola, kovan dibi sağa */}
      <Path path="M6 -2 L-2 -2 C-4 -2 -6 -1 -7 0 C-6 1 -4 2 -2 2 L6 2 Z" color="#c9a24a" />
      <Path path="M6 -2 L2 -2 L2 2 L6 2 Z" color="#8f7230" />
    </Group>
  );
}

// Ajanın koda dağılması: dikey yeşil şeritler
function Dissolve({ L, f, clock, c }) {
  const k = L.fig;
  const bars = useMemo(() => {
    const p = [Skia.Path.Make(), Skia.Path.Make()];
    for (let i = 0; i < 18; i += 1) {
      const x = (-10 + i * 1.2) * k;
      for (let j = 0; j < 9; j += 1) {
        const y = -(4 + j * 8.6 + ((i * 7 + j * 3) % 5)) * k;
        p[(i + j) % 2].addRect(Skia.XYWHRect(x, y, 0.9 * k, (2.4 + ((i + j) % 3)) * k));
      }
    }
    return p;
  }, [k]);
  const tr = useDerivedValue(() => [{ translateX: L.agentX }, { translateY: L.roof - f.value.dissolve * 30 * L.k }]);
  const oA = useDerivedValue(() => Math.sin(f.value.dissolve * Math.PI) * (0.6 + 0.4 * Math.sin(clock.value * 13)));
  const oB = useDerivedValue(() => Math.sin(f.value.dissolve * Math.PI) * (0.6 - 0.4 * Math.sin(clock.value * 13)));
  return (
    <Group transform={tr}>
      <Group opacity={oA}>
        <Path path={bars[0]} color={c.glow} />
      </Group>
      <Group opacity={oB}>
        <Path path={bars[1]} color={rgba(c.glow, 0.7)} />
      </Group>
    </Group>
  );
}

// Uzak helikopter (sakinde de geçer)
function Heli({ L, clock, width, height, c }) {
  const P = 47;
  const tr = useDerivedValue(() => {
    const c0 = (clock.value / P) % 1;
    const tau = c0 / 0.45;
    const x = tau < 1 ? width + 60 * L.k - tau * (width + 120 * L.k) : -500;
    // sağdan sola uçar: gövde sağa bakar çizildi, burun sola dönsün diye aynalanır
    return [{ translateX: x }, { translateY: height * 0.3 + Math.sin(clock.value * 0.8) * 6 * L.k }, { scaleX: -1 }, { scale: L.k * 0.8 }];
  });
  const rotor = useDerivedValue(() => [{ scaleX: 0.15 + Math.abs(Math.sin(clock.value * 30)) }]);
  const blink = useDerivedValue(() => (Math.sin(clock.value * 4) > 0.7 ? 1 : 0.15));
  return (
    <Group transform={tr}>
      <Path path="M-60 60 L-8 4 L8 4 L60 60 Z">
        <LinearGradient start={vec(0, 4)} end={vec(0, 60)} colors={[rgba(c.glow, 0.22), rgba(c.glow, 0)]} />
      </Path>
      <Path path="M-14 -6 C-14 -12 -4 -14 4 -13 C12 -12 16 -6 14 0 C10 4 -10 4 -14 0 Z" color={c.bldNear} />
      <Path path="M10 -10 C13 -9 15 -6 14 -2 L9 -2 Z" color={rgba(c.glow, 0.35)} />
      <Path path="M-14 -5 L-40 -7 L-42 -12 L-38 -12 L-36 -8 L-14 -2 Z" color={c.bldNear} />
      <Path path="M-10 6 L12 6 M-6 4 L-6 6 M8 4 L8 6" style="stroke" strokeWidth={1.2} color={c.bldNear} />
      <Path path="M0 -14 L0 -17" style="stroke" strokeWidth={1.4} color={c.bldNear} />
      <Group transform={[{ translateY: -17 }]}>
        <Group transform={rotor}>
          <Path path="M-34 -0.8 L34 -0.8 L34 0.8 L-34 0.8 Z" color={rgba(c.metal, 0.6)} />
        </Group>
      </Group>
      <Group opacity={blink}>
        <Circle cx={-41} cy={-11} r={1.5} color="#ff4040" />
      </Group>
    </Group>
  );
}

function Windows({ path, clock, i, color }) {
  const o = useDerivedValue(() => 0.55 + 0.35 * Math.sin(clock.value * (0.5 + i * 0.37) + i * 2));
  return (
    <Group opacity={o}>
      <Path path={path} color={color} />
    </Group>
  );
}

export default function MatrixScene({ p, clock, width, height, tone }) {
  const c = toneMap(tone.colors);
  const L = matrixLayout(width, height);
  const { k } = L;
  const light = c.night === "#d9eadf";
  const city = useMemo(() => buildCity(L, width, height), [width, height]);
  const roof = useMemo(() => buildRoof(L, width, height), [width, height]);
  const f = useDerivedValue(() => matrixFrame(p, clock.value));
  const tintO = useDerivedValue(() => f.value.slow * 0.13);
  const agentO = useDerivedValue(() => (f.value.u > 1 ? 0 : (f.value.walk > 0.001 ? 1 : 0) * (1 - f.value.dissolve)));
  const doorO = useDerivedValue(() => (f.value.u <= 1 && f.value.walk > 0 && f.value.walk < 0.25 ? 1 : 0));
  const tipO = useDerivedValue(() => (Math.sin(clock.value * 2.2) > 0.4 ? 0.9 : 0.25));
  return (
    <Group>
      <Rect x={0} y={L.roof - 300 * k} width={width} height={300 * k}>
        <LinearGradient start={vec(0, L.roof - 300 * k)} end={vec(0, L.roof)} colors={[rgba(c.haze, 0), rgba(c.haze, light ? 0.5 : 0.35)]} />
      </Rect>
      <Heli L={L} clock={clock} width={width} height={height} c={c} />
      <Group opacity={tone.alpha}>
        <Path path={city.far.body} color={c.bldFar} />
        <Path path={city.far.ant} style="stroke" strokeWidth={0.8 * k} color={c.bldFar} />
        {city.far.wins.map((w, i) => (
          <Windows key={i} path={w} clock={clock} i={i} color={rgba(c.window, 0.45)} />
        ))}
        <Group opacity={tipO}>
          {city.far.tips.map(([x, y], i) => (
            <Circle key={i} cx={x} cy={y} r={1.4 * k} color="#ff5050" />
          ))}
        </Group>
        <Path path={`M0 ${L.roof - 80 * k} L${width} ${L.roof - 80 * k} L${width} ${L.roof} L0 ${L.roof} Z`}>
          <LinearGradient start={vec(0, L.roof - 80 * k)} end={vec(0, L.roof)} colors={[rgba(c.haze, 0), rgba(c.haze, 0.4)]} />
        </Path>
        <Path path={city.near.body} color={c.bldNear} />
        {city.near.wins.map((w, i) => (
          <Windows key={i} path={w} clock={clock} i={i + 3} color={rgba(c.window, 0.7)} />
        ))}
        <Path path={city.near.ant} style="stroke" strokeWidth={1 * k} color={c.bldNear} />
        {/* çatı */}
        <Path path={roof.slab}>
          <LinearGradient start={vec(0, L.roof)} end={vec(0, height)} colors={[c.roof, c.night]} />
        </Path>
        <Path path={roof.joints} style="stroke" strokeWidth={0.5 * k} color={rgba(c.roofLit, 0.25)} />
        <Path path={roof.pad} style="stroke" strokeWidth={1.4 * k} color={rgba(c.roofLit, 0.6)} />
        <Path path={roof.H} style="stroke" strokeWidth={2.4 * k} color={rgba(c.roofLit, 0.6)} />
        <Path path={roof.rail} style="stroke" strokeWidth={1.2 * k} color={c.metal} />
        <Path path={roof.ledge} color={c.roofLit} />
        <Path path={roof.units} color={c.roof} />
        <Path path={roof.unitsLit} color={c.roofLit} />
        <Path path={roof.grill} style="stroke" strokeWidth={0.8 * k} color="rgba(0,0,0,0.4)" />
        <Path path={roof.hut} color={c.roof} />
        <Path path={roof.hutTop} color={c.roofLit} />
        <Path path={roof.door} color="#050806" />
        <Group opacity={doorO}>
          <Path path={roof.door} color={rgba(c.glow, 0.35)} />
        </Group>
      </Group>

      {/* mermi zamanı yeşil kayması */}
      <Group opacity={tintO}>
        <Rect x={0} y={0} width={width} height={height} color={c.glow} />
      </Group>

      <Neo L={L} f={f} clock={clock} c={c} />
      <Group opacity={agentO}>
        <Agent L={L} f={f} clock={clock} c={c} />
      </Group>
      <Dissolve L={L} f={f} clock={clock} c={c} />
      {SHOTS.map((_, i) => (
        <Bullet key={i} L={L} f={f} i={i} clock={clock} c={c} />
      ))}
      {STOPS.map((_, i) => (
        <StopBullet key={`s${i}`} L={L} f={f} i={i} clock={clock} c={c} />
      ))}
    </Group>
  );
}
