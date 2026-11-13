// components/decor/arcaneScene.js
//
// Arcane evren sahnesi (OVERLAY.arVec = 76) — tamamı VEKTÖR, İKİ KATLI ŞEHİR:
//   • ÜST KAT: altın ışıklı, krem taş kuleler (kubbeler, sivri tepeler, saat kulesi), kemerli köprü
//     güvertesi; sıcak pencereler.
//   • ALT KAT: güvertenin altında karanlık sanayi kenti: borular, bacalar (duman), üst üste gecekondular,
//     pembe/camgöbeği neon tabelalar, asılı fenerler; yerden yükselen YEŞİL ZEHİRLİ SİS bantları.
//   • İKİ olay (döngüde sırayla, eventPick):
//       A) Altın süslü bir hava gemisi üst şehrin üstünden pervaneleri dönerek geçer.
//       B) Alt kattan bir roket kıvılcım izi bırakarak yükselir, üst şehrin üstünde pembe-camgöbeği
//          BOYA kıvılcımlarına patlar (damlalar süzülür); ardından yeşil sis kabarır.
//
// Işığa duyarlılık: patlama küçük alanlı ve yumuşak; neonlar yavaş nefes alır.
// Logo / amblem YOK: yalnız esinli silüet.
// Ölçek: sceneScale (k). Zemin SCENERY.lift. Renkler OVERLAY_TONES[76] (AR_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Group, LinearGradient, Path, Rect, Skia, vec } from "@shopify/react-native-skia";
import { eventPick, restU } from "../../utils/weatherParticles";
import { Glow, groundLayout, hash, rgba, sm, toneMap } from "./seasonKit";

export const AR_TONE = [
  "goldGlow",
  "pilt",
  "piltShade",
  "dome",
  "spire",
  "piltWin",
  "deck",
  "deckShade",
  "zaun",
  "zaunShade",
  "pipe",
  "stack",
  "smoke",
  "fog",
  "fogCore",
  "neonPink",
  "neonCyan",
  "lantern",
  "ship",
  "shipTrim",
  "rocket",
  "spark",
];

export function arLayout(width, height) {
  const L = groundLayout(width, height);
  const { k, ground } = L;
  const deckY = ground - 196 * k;
  return { ...L, deckY, deckH: 20 * k, launch: [width * 0.2, ground - 70 * k], burst: [width * 0.6, deckY - 230 * k] };
}

// ───────────────────────────── üst kat

function buildUpper(L) {
  const { width, k, deckY } = L;
  const pilt = Skia.Path.Make();
  const shade = Skia.Path.Make();
  const dome = Skia.Path.Make();
  const spire = Skia.Path.Make();
  const win = Skia.Path.Make();
  let x = -8 * k;
  let i = 0;
  while (x < width + 8 * k) {
    const big = i % 4 === 1;
    const w = (big ? 34 : 18 + hash(i, 1) * 16) * k;
    const h = (big ? 190 : 70 + hash(i, 2) * 90) * k;
    const top = deckY - h;
    pilt.addRect(Skia.XYWHRect(x, top, w, h + 2 * k));
    shade.addRect(Skia.XYWHRect(x + w * 0.72, top, w * 0.28, h));
    // kat silmeleri
    for (let y = top + 18 * k; y < deckY - 6 * k; y += 22 * k) shade.addRect(Skia.XYWHRect(x, y, w, 1.6 * k));
    // tepe: kubbe / sivri / saat
    const type = big ? 0 : Math.floor(hash(i, 3) * 3);
    const mx = x + w / 2;
    if (type === 0) {
      dome.moveTo(x + 1 * k, top);
      dome.quadTo(x + 2 * k, top - w * 0.62, mx, top - w * 0.66);
      dome.quadTo(x + w - 2 * k, top - w * 0.62, x + w - 1 * k, top);
      dome.close();
      spire.addRect(Skia.XYWHRect(mx - 1 * k, top - w * 0.66 - 22 * k, 2 * k, 22 * k));
      spire.addCircle(mx, top - w * 0.66 - 22 * k, 2 * k);
      dome.addRect(Skia.XYWHRect(x - 2 * k, top - 3 * k, w + 4 * k, 3 * k));
    } else if (type === 1) {
      spire.moveTo(x + 2 * k, top);
      spire.lineTo(mx, top - w * 1.4);
      spire.lineTo(x + w - 2 * k, top);
      spire.close();
    } else {
      pilt.addRect(Skia.XYWHRect(x + w * 0.2, top - 16 * k, w * 0.6, 16 * k));
      dome.addCircle(mx, top - 8 * k, w * 0.2);
      win.addCircle(mx, top - 8 * k, w * 0.14);
      dome.addRect(Skia.XYWHRect(x + w * 0.16, top - 18 * k, w * 0.68, 2.4 * k));
    }
    // pencereler: yüksek kemerli
    for (let y = top + 8 * k; y < deckY - 14 * k; y += 22 * k)
      for (let wx = x + 4 * k; wx < x + w * 0.7 - 3 * k; wx += 7 * k) {
        if (hash(Math.round(wx + y), 7) < 0.35) continue;
        win.addRRect(Skia.RRectXY(Skia.XYWHRect(wx, y, 3 * k, 8 * k), 1.5 * k, 1.5 * k));
      }
    x += w + (2 + hash(i, 4) * 6) * k;
    i += 1;
  }
  return { pilt, shade, dome, spire, win };
}

function buildDeck(L) {
  const { width, k, deckY, deckH, ground } = L;
  const deck = Skia.Path.Make();
  const under = Skia.Path.Make();
  deck.addRect(Skia.XYWHRect(-10, deckY, width + 20, deckH));
  // korkuluk
  for (let x = 0; x < width; x += 6 * k) deck.addRect(Skia.XYWHRect(x, deckY - 6 * k, 1.4 * k, 6 * k));
  deck.addRect(Skia.XYWHRect(-10, deckY - 7 * k, width + 20, 1.6 * k));
  // altta kemer dişleri + taşıyıcı ayaklar
  const span = 52 * k;
  for (let x = -span / 2; x < width + span; x += span) {
    under.moveTo(x, deckY + deckH);
    under.quadTo(x + span / 2, deckY + deckH + 26 * k, x + span, deckY + deckH);
    under.close();
  }
  [0.14, 0.5, 0.86].forEach((f) => {
    const px = width * f;
    under.moveTo(px - 12 * k, deckY + deckH);
    under.lineTo(px - 18 * k, ground);
    under.lineTo(px + 18 * k, ground);
    under.lineTo(px + 12 * k, deckY + deckH);
    under.close();
  });
  return { deck, under };
}

// ───────────────────────────── alt kat

function buildLower(L) {
  const { width, k, deckY, deckH, ground } = L;
  const zaun = Skia.Path.Make();
  const shade = Skia.Path.Make();
  const pipes = Skia.Path.Make();
  const stacks = [];
  const stackP = Skia.Path.Make();
  const neonP = Skia.Path.Make();
  const neonC = Skia.Path.Make();
  const lanterns = [];
  let x = -6 * k;
  let i = 0;
  while (x < width + 6 * k) {
    const w = (22 + hash(i, 11) * 26) * k;
    const h = (50 + hash(i, 12) * 90) * k;
    const top = Math.max(deckY + deckH + 30 * k, ground - h);
    // eğri gecekondu: üst kenar hafif yamuk + üstünde küçük kulübe
    zaun.moveTo(x, ground + 2 * k);
    zaun.lineTo(x + 1 * k, top + hash(i, 13) * 6 * k);
    zaun.lineTo(x + w, top);
    zaun.lineTo(x + w - 1 * k, ground + 2 * k);
    zaun.close();
    if (hash(i, 14) > 0.45) {
      const sw = w * 0.5;
      const sx = x + w * 0.2;
      zaun.moveTo(sx, top + 1 * k);
      zaun.lineTo(sx + 2 * k, top - 16 * k);
      zaun.lineTo(sx + sw, top - 18 * k);
      zaun.lineTo(sx + sw, top + 1 * k);
      zaun.close();
    }
    shade.addRect(Skia.XYWHRect(x + w * 0.75, top, w * 0.25, ground - top));
    // neon tabela
    if (hash(i, 15) > 0.4) {
      const nw = (8 + hash(i, 16) * 10) * k;
      const ny = top + (10 + hash(i, 17) * 30) * k;
      const target = i % 2 === 0 ? neonP : neonC;
      target.addRRect(Skia.RRectXY(Skia.XYWHRect(x + 3 * k, ny, nw, 4 * k), 2 * k, 2 * k));
    }
    // pencereler (seyrek, sıcak)
    for (let y = top + 10 * k; y < ground - 10 * k; y += 14 * k)
      if (hash(i + y, 18) > 0.7) lanterns.push([x + w * 0.4, y]);
    // baca
    if (i % 3 === 1) {
      const sx = x + w * 0.6;
      const sh = (34 + hash(i, 19) * 26) * k;
      stackP.addRect(Skia.XYWHRect(sx - 4 * k, top - sh, 8 * k, sh));
      stackP.addRect(Skia.XYWHRect(sx - 5.5 * k, top - sh - 3 * k, 11 * k, 3 * k));
      stacks.push([sx, top - sh - 3 * k]);
    }
    x += w + (1 + hash(i, 20) * 4) * k;
    i += 1;
  }
  // borular: yatay hatlar + dikey inişler + dirsekler
  [deckY + deckH + 20 * k, ground - 96 * k, ground - 56 * k].forEach((y, j) => {
    pipes.addRect(Skia.XYWHRect(-10, y, width + 20, (3 + j) * k));
    for (let x0 = 20 * k + j * 40 * k; x0 < width; x0 += 110 * k) {
      pipes.addRect(Skia.XYWHRect(x0, y, (3 + j * 0.5) * k, 40 * k));
      pipes.addRect(Skia.XYWHRect(x0 - 2 * k, y - 1.5 * k, (7 + j) * k, (6 + j) * k));
    }
  });
  // asılı fener ipleri (güverteden)
  const ropes = Skia.Path.Make();
  const hung = [];
  for (let j = 0; j < 7; j += 1) {
    const hx = width * (0.06 + j * 0.145);
    const len = (24 + hash(j, 21) * 30) * k;
    ropes.moveTo(hx, deckY + deckH);
    ropes.lineTo(hx, deckY + deckH + len);
    hung.push([hx, deckY + deckH + len + 3 * k]);
  }
  return { zaun, shade, pipes, stackP, stacks, neonP, neonC, lanterns: lanterns.slice(0, 24), ropes, hung };
}

// ───────────────────────────── canlı parçalar

function Smoke({ clock, L, stacks, c }) {
  const { k } = L;
  const q = useDerivedValue(() => {
    const path = Skia.Path.Make();
    for (let s = 0; s < stacks.length; s += 1) {
      const [x, y] = stacks[s];
      for (let i = 0; i < 6; i += 1) {
        const f = (clock.value * 0.12 + i / 6 + hash(s, 3)) % 1;
        path.addCircle(x + f * 26 * k + Math.sin(f * 5 + s) * 4 * k, y - f * 70 * k, (3 + f * 12) * k);
      }
    }
    return path;
  });
  return <Path path={q} color={c.smoke} opacity={0.45} />;
}

/** Yeşil sis bandı: kayar + (B olayında) kabarır. */
function FogBand({ p, clock, L, y, h, a, speed, c }) {
  const { width, k } = L;
  const at = useDerivedValue(() => [{ translateX: Math.sin(clock.value * speed) * 26 * k }]);
  const op = useDerivedValue(() => {
    const u = restU(p, clock.value);
    const swell = u <= 1 && eventPick(p, clock.value, 2) === 1 ? sm(0.4, 0.55, u) * (1 - sm(0.8, 0.98, u)) : 0;
    return a * (0.85 + 0.15 * Math.sin(clock.value * 0.6 + y)) * (1 + swell * 0.7);
  });
  return (
    <Group transform={at} opacity={op}>
      <Rect x={-40} y={y - h} width={width + 80} height={h * 2}>
        <LinearGradient start={vec(0, y - h)} end={vec(0, y + h)} colors={[rgba(c.fog, 0), rgba(c.fogCore, 0.6), rgba(c.fog, 0)]} />
      </Rect>
    </Group>
  );
}

function Neons({ clock, low, c }) {
  const pink = useDerivedValue(() => 0.65 + 0.35 * Math.sin(clock.value * 1.1));
  const cyan = useDerivedValue(() => 0.65 + 0.35 * Math.sin(clock.value * 0.9 + 2));
  return (
    <>
      <Group opacity={pink}>
        <Path path={low.neonP} color={c.neonPink} />
      </Group>
      <Group opacity={cyan}>
        <Path path={low.neonC} color={c.neonCyan} />
      </Group>
    </>
  );
}

// A: hava gemisi (sağa uçar, merkez 0,0)
function Airship({ p, clock, L, c }) {
  const { k, width, deckY } = L;
  const show = useDerivedValue(() => {
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 0) return 0;
    return sm(0.04, 0.1, u) * (1 - sm(0.84, 0.9, u));
  });
  const at = useDerivedValue(() => {
    const u = Math.min(1, restU(p, clock.value));
    const e = sm(0.04, 0.9, u);
    return [
      { translateX: -120 * k + (width + 240 * k) * e },
      { translateY: deckY - 300 * k + Math.sin(clock.value * 0.7) * 5 * k },
      { scale: k * 1.1 },
    ];
  });
  const prop = useDerivedValue(() => [{ scaleY: 0.2 + 0.8 * Math.abs(Math.sin(clock.value * 24)) }]);
  return (
    <Group opacity={show}>
      <Group transform={at}>
        <Path path="M -66 0 Q -62 -20 -10 -22 L 30 -21 Q 66 -16 70 0 Q 66 16 30 21 L -10 22 Q -62 20 -66 0 Z" color={c.ship} />
        {/* altın kuşaklar */}
        <Path path="M -40 -20.4 L -36 -20.6 L -36 20.6 L -40 20.4 Z M 4 -21.8 L 8 -21.8 L 8 21.8 L 4 21.8 Z M 44 -18.4 L 48 -17.8 L 48 17.8 L 44 18.4 Z" color={c.shipTrim} />
        <Path path="M -58 -8 L -80 -26 L -70 -4 Z M -58 8 L -80 26 L -70 4 Z" color={c.shipTrim} />
        {/* gondol + pencereler */}
        <Path path="M -20 20 L 24 20 Q 26 30 18 32 L -14 32 Q -22 30 -20 20 Z" color={c.shipTrim} />
        <Path path="M -12 24 L -6 24 L -6 28 L -12 28 Z M -2 24 L 4 24 L 4 28 L -2 28 Z M 8 24 L 14 24 L 14 28 L 8 28 Z" color={c.piltWin} />
        {/* yan pervaneler */}
        <Group transform={[{ translateX: -30 }, { translateY: 26 }]}>
          <Group transform={prop}>
            <Path path="M -1 -9 L 1 -9 L 1 9 L -1 9 Z" color={c.shipTrim} />
          </Group>
        </Group>
        <Group transform={[{ translateX: 34 }, { translateY: 26 }]}>
          <Group transform={prop}>
            <Path path="M -1 -9 L 1 -9 L 1 9 L -1 9 Z" color={c.shipTrim} />
          </Group>
        </Group>
      </Group>
    </Group>
  );
}

// B: roket + boya patlaması
function Rocket({ p, clock, L, c }) {
  const { k, launch, burst } = L;
  const pos = (e) => {
    "worklet";
    const it = 1 - e;
    const mx = (launch[0] + burst[0]) / 2 - 40 * k;
    const my = burst[1] - 40 * k;
    return [it * it * launch[0] + 2 * it * e * mx + e * e * burst[0], it * it * launch[1] + 2 * it * e * my + e * e * burst[1]];
  };
  const trail = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 1 || u < 0.1 || u > 0.4) return q;
    const e = sm(0.1, 0.32, u);
    const fade = sm(0.32, 0.4, u);
    for (let i = 0; i < 26; i += 1) {
      const f = e - i * 0.018;
      if (f < 0) break;
      const [x, y] = pos(f);
      const r = (2.6 - i * 0.08) * k * (1 - fade);
      if (r > 0.2) q.addCircle(x + (hash(i, Math.floor(clock.value * 8)) - 0.5) * 3 * k, y, r);
    }
    return q;
  });
  const head = useDerivedValue(() => {
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 1 || u < 0.1 || u > 0.32) return [{ translateX: -999 }, { translateY: -999 }];
    const [x, y] = pos(sm(0.1, 0.32, u));
    return [{ translateX: x }, { translateY: y }];
  });
  // patlama: pembe + camgöbeği kıvılcımlar (yerçekimli), sonra boya damlaları
  const sparks = useDerivedValue(() => {
    const pink = Skia.Path.Make();
    const cyan = Skia.Path.Make();
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 1 || u < 0.32 || u > 0.75) return [pink, cyan];
    const e = (u - 0.32) / 0.43;
    const fade = 1 - sm(0.45, 1, e);
    for (let i = 0; i < 44; i += 1) {
      const a = (i / 44) * Math.PI * 2 + hash(i, 1) * 0.3;
      const sp = (60 + hash(i, 2) * 70) * k;
      const d = sp * (1 - Math.pow(1 - Math.min(1, e * 2.2), 2));
      const x = burst[0] + Math.cos(a) * d;
      const y = burst[1] + Math.sin(a) * d * 0.85 + e * e * 90 * k;
      const r = (1.6 + hash(i, 3) * 2.2) * k * fade;
      if (r > 0.15) (i % 2 === 0 ? pink : cyan).addCircle(x, y, r);
    }
    // damlalar: aşağı süzülen ince izler
    for (let i = 0; i < 9; i += 1) {
      const a = hash(i, 5) * Math.PI * 2;
      const x = burst[0] + Math.cos(a) * 46 * k;
      const y0 = burst[1] + Math.sin(a) * 30 * k + e * 120 * k;
      const len = (8 + e * 26) * k * fade;
      (i % 2 === 0 ? pink : cyan).addRRect(Skia.RRectXY(Skia.XYWHRect(x - 1 * k, y0, 2 * k, len), 1 * k, 1 * k));
    }
    return [pink, cyan];
  });
  const sp0 = useDerivedValue(() => sparks.value[0]);
  const sp1 = useDerivedValue(() => sparks.value[1]);
  const glow = useDerivedValue(() => {
    const u = restU(p, clock.value);
    if (u > 1 || eventPick(p, clock.value, 2) !== 1) return 0;
    return sm(0.31, 0.34, u) * (1 - sm(0.36, 0.55, u));
  });
  return (
    <>
      <Path path={trail} color={c.rocket} opacity={0.8} />
      <Group transform={head}>
        <Glow r={10 * k} color={c.spark} a={0.9} mid={0.4} />
      </Group>
      <Group opacity={glow}>
        <Group transform={[{ translateX: burst[0] }, { translateY: burst[1] }]}>
          <Glow r={90 * k} color={c.neonPink} a={0.45} mid={0.3} />
        </Group>
      </Group>
      <Path path={sp0} color={c.neonPink} />
      <Path path={sp1} color={c.neonCyan} />
    </>
  );
}

export default function ArcaneScene({ p, clock, width, height, tone, lightSurface }) {
  const L = useMemo(() => arLayout(width, height), [width, height]);
  const up = useMemo(() => buildUpper(L), [L]);
  const deck = useMemo(() => buildDeck(L), [L]);
  const low = useMemo(() => buildLower(L), [L]);
  const c = useMemo(() => toneMap(AR_TONE, tone.colors), [tone]);
  const { k, deckY, deckH, ground } = L;
  const night = !lightSurface;
  const lampPath = useMemo(() => {
    const q = Skia.Path.Make();
    low.lanterns.forEach(([x, y]) => q.addRect(Skia.XYWHRect(x, y, 3 * k, 4 * k)));
    low.hung.forEach(([x, y]) => q.addCircle(x, y, 2.4 * k));
    return q;
  }, [low, k]);
  return (
    <Group opacity={tone.alpha}>
      {/* üst şehrin altın pusu */}
      <Rect x={0} y={deckY - 300 * k} width={width} height={300 * k}>
        <LinearGradient start={vec(0, deckY - 300 * k)} end={vec(0, deckY)} colors={[rgba(c.goldGlow, 0), rgba(c.goldGlow, night ? 0.32 : 0.45)]} />
      </Rect>
      <Airship p={p} clock={clock} L={L} c={c} />
      <Path path={up.pilt} color={c.pilt} />
      <Path path={up.shade} color={c.piltShade} />
      <Path path={up.dome} color={c.dome} />
      <Path path={up.spire} color={c.spire} />
      <Path path={up.win} color={c.piltWin} opacity={night ? 0.9 : 0.7} />
      {/* alt kat: arka plan karanlığı (güverte altı) */}
      <Rect x={0} y={deckY + deckH} width={width} height={L.height - deckY - deckH}>
        <LinearGradient start={vec(0, deckY + deckH)} end={vec(0, ground)} colors={[c.zaunShade, rgba(c.zaunShade, 0.6)]} />
      </Rect>
      <FogBand p={p} clock={clock} L={L} y={deckY + deckH + 60 * k} h={40 * k} a={night ? 0.35 : 0.3} speed={0.09} c={c} />
      <Path path={low.zaun} color={c.zaun} />
      <Path path={low.shade} color={c.zaunShade} />
      <Path path={low.stackP} color={c.stack} />
      <Smoke clock={clock} L={L} stacks={low.stacks} c={c} />
      <Path path={low.pipes} color={c.pipe} />
      <Neons clock={clock} low={low} c={c} />
      <Path path={lampPath} color={c.lantern} opacity={night ? 0.9 : 0.75} />
      <Path path={deck.under} color={c.deckShade} />
      <Path path={low.ropes} style="stroke" strokeWidth={0.8 * k} color={c.deckShade} />
      <Path path={deck.deck} color={c.deck} />
      <FogBand p={p} clock={clock} L={L} y={ground - 70 * k} h={36 * k} a={night ? 0.42 : 0.35} speed={0.13} c={c} />
      <FogBand p={p} clock={clock} L={L} y={ground - 14 * k} h={30 * k} a={night ? 0.55 : 0.45} speed={0.07} c={c} />
      <Rocket p={p} clock={clock} L={L} c={c} />
    </Group>
  );
}
