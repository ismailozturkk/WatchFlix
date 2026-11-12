// components/decor/pbScene.js
//
// Prison Break atmosfer sahnesi (OVERLAY.prison = 23) — tamamı VEKTÖR, dışarıdan bakış:
//   • Fox River: arkada tuğla hücre bloğu (tuğla dizileri, parmaklıklı pencereler — kimi yanar,
//     çatıda su kulesi ve tüten baca), sağda revir binası, nöbetçili gözetleme kulesi ve
//     yavaşça süpüren projektör (yerde ışık lekesi), avlu projektör direkleri; önde çift tel
//     örgü (çapraz ağ, direkler, tepede jiletli tel bobinleri); dışarıda çimen, ağaçlar, elektrik
//     direği; gökte hilal ay ve kayan bulutlar.
//   • Olay (pbFrame, 30 sn): Michael'ın dövmesi gibi mavi plan çizgisi kaçış yolunu çizer →
//     dört mahkûm hücre bloğunun dibindeki rögardan çıkar → avluyu eğilerek koşar → revir duvarından
//     çatıya tırmanır → çatıdan elektrik direğine gerilen kabloda el el tutunarak telin üstünden
//     geçer → direkten inip karanlığa koşar → alarm: kule ışıkları kırmızı nabız, projektör kabloya döner.
//
// Ölçek: sceneScale (k). Zemin SCENERY.lift (sekme çubuğu). Renkler OVERLAY_TONES[23] (PB_TONE).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Circle, Group, LinearGradient, Oval, Path, RadialGradient, Skia, vec } from "@shopify/react-native-skia";
import { pbFrame, sceneScale } from "../../utils/weatherParticles";
import { SCENERY } from "../../utils/weatherUniverses";

const PB_TONE = ["brick", "brickDark", "concrete", "steel", "window", "lamp", "grass", "night", "haze", "fig", "alarm", "plan"];
const toneMap = (colors) => Object.fromEntries(PB_TONE.map((name, i) => [name, colors[i] || colors[0]]));

function rgba(hex, a) {
  const h = String(hex).replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Sahne yerleşimi (dp). */
export function pbLayout(width, height) {
  const k = sceneScale(width, height);
  const ground = height - SCENERY.lift * k;
  const yard = ground - 40 * k; // avlu zemini (çitin arkası)
  const fenceBase = ground - 28 * k;
  const fenceTop = fenceBase - 92 * k;
  const block = { x0: -4, x1: width * 0.58, top: ground - 236 * k };
  const inf = { x0: width * 0.6, x1: width * 0.8, top: ground - 150 * k };
  const pole = { x: width * 0.94, top: ground - 134 * k };
  const tower = { x: width * 0.87, top: ground - 262 * k, cab: ground - 250 * k };
  const lampP = [tower.x - 14 * k, tower.cab + 16 * k];
  // kaçış rotası: rögar → revir dibi → çatı → çatı köşesi → kablo → direk dibi → dışarı
  const hang = 29 * k; // asılırken ayak, kablonun bu kadar altında (eller kabloda)
  const route = [
    [width * 0.44, yard], [inf.x0 + 10 * k, yard], [inf.x0 + 10 * k, inf.top], [inf.x1 - 6 * k, inf.top],
    [pole.x - 3 * k, pole.top + hang], [pole.x - 3 * k, ground - 8 * k], [width + 40 * k, ground - 4 * k],
  ];
  return { k, ground, yard, fenceBase, fenceTop, block, inf, pole, tower, lampP, route, hang };
}

// ── Yapılar ───────────────────────────────────────────────────────────────────
function buildBlock(L, width) {
  const { k, block, yard, inf } = L;
  const { x0, x1, top } = block;
  const body = Skia.Path.Make();
  body.addRect(Skia.XYWHRect(x0, top, x1 - x0, yard - top + 2 * k));
  // üst korniş ve orta kule (yüksek kısım)
  const cx = (x0 + x1) * 0.55;
  const center = Skia.Path.Make();
  center.addRect(Skia.XYWHRect(cx - 34 * k, top - 34 * k, 68 * k, 36 * k));
  center.moveTo(cx - 40 * k, top - 34 * k);
  center.lineTo(cx, top - 54 * k);
  center.lineTo(cx + 40 * k, top - 34 * k);
  center.close();
  const cornice = Skia.Path.Make();
  cornice.addRect(Skia.XYWHRect(x0, top - 3 * k, x1 - x0 + 3 * k, 6 * k));
  cornice.addRect(Skia.XYWHRect(cx - 37 * k, top - 37 * k, 74 * k, 4 * k));
  // tuğla dizileri + derzler
  const bricks = Skia.Path.Make();
  const bh = 5 * k;
  let row = 0;
  for (let y = top + 6 * k; y < yard; y += bh) {
    bricks.moveTo(x0, y);
    bricks.lineTo(x1, y);
    const off = row % 2 ? 6 * k : 0;
    for (let x = x0 + off; x < x1; x += 12 * k) {
      bricks.moveTo(x, y);
      bricks.lineTo(x, y + bh);
    }
    row += 1;
  }
  // pencereler: 4 kat
  const wins = Skia.Path.Make();
  const lit = [Skia.Path.Make(), Skia.Path.Make()];
  const bars = Skia.Path.Make();
  const sills = Skia.Path.Make();
  const ww = 9 * k;
  const wh = 15 * k;
  let n = 0;
  for (let fl = 0; fl < 4; fl += 1) {
    const y = top + 18 * k + fl * 40 * k;
    for (let x = x0 + 14 * k; x + ww < x1 - 8 * k; x += 22 * k) {
      n += 1;
      const on = (n * 7 + fl * 3) % 5 === 0 || (n * 11) % 13 === 0;
      (on ? lit[n % 2] : wins).addRect(Skia.XYWHRect(x, y, ww, wh));
      for (let b = 1; b < 4; b += 1) {
        bars.moveTo(x + (b * ww) / 4, y);
        bars.lineTo(x + (b * ww) / 4, y + wh);
      }
      sills.addRect(Skia.XYWHRect(x - 1.5 * k, y + wh, ww + 3 * k, 2 * k));
      sills.addRect(Skia.XYWHRect(x - 1 * k, y - 3 * k, ww + 2 * k, 3 * k));
    }
  }
  // orta kule pencereleri (yuvarlak kemerli)
  const tw = Skia.Path.Make();
  for (const dx of [-18, 0, 18]) tw.addRRect(Skia.RRectXY(Skia.XYWHRect(cx + dx * k - 4 * k, top - 26 * k, 8 * k, 16 * k), 4 * k, 4 * k));
  // rögar (kaçış çıkışı) — blok dibinde
  const drain = Skia.Path.Make();
  drain.addOval(Skia.XYWHRect(L.route[0][0] - 9 * k, yard - 3 * k, 18 * k, 6 * k));
  // su kulesi (çatıda, solda)
  const wt = Skia.Path.Make();
  const wx = x0 + (x1 - x0) * 0.2;
  wt.moveTo(wx - 14 * k, top);
  wt.lineTo(wx - 10 * k, top - 22 * k);
  wt.moveTo(wx + 14 * k, top);
  wt.lineTo(wx + 10 * k, top - 22 * k);
  wt.moveTo(wx - 12 * k, top - 10 * k);
  wt.lineTo(wx + 12 * k, top - 18 * k);
  wt.moveTo(wx + 12 * k, top - 10 * k);
  wt.lineTo(wx - 12 * k, top - 18 * k);
  const tank = Skia.Path.Make();
  tank.addRect(Skia.XYWHRect(wx - 15 * k, top - 44 * k, 30 * k, 22 * k));
  tank.moveTo(wx - 17 * k, top - 44 * k);
  tank.lineTo(wx, top - 56 * k);
  tank.lineTo(wx + 17 * k, top - 44 * k);
  tank.close();
  // baca
  const chim = Skia.Path.Make();
  chim.addRect(Skia.XYWHRect(x1 - 40 * k, top - 30 * k, 10 * k, 30 * k));
  // revir binası
  const infBody = Skia.Path.Make();
  infBody.addRect(Skia.XYWHRect(inf.x0, inf.top, inf.x1 - inf.x0, yard - inf.top + 2 * k));
  const infWin = Skia.Path.Make();
  const infLit = Skia.Path.Make();
  for (let fl = 0; fl < 2; fl += 1) {
    for (let i = 0; i < 3; i += 1) {
      const x = inf.x0 + 14 * k + i * ((inf.x1 - inf.x0 - 28 * k) / 2) - 6 * k;
      (fl === 1 && i === 1 ? infLit : infWin).addRect(Skia.XYWHRect(x, inf.top + 22 * k + fl * 40 * k, 12 * k, 14 * k));
    }
  }
  const infTrim = Skia.Path.Make();
  infTrim.addRect(Skia.XYWHRect(inf.x0 - 2 * k, inf.top - 4 * k, inf.x1 - inf.x0 + 4 * k, 5 * k));
  // revir yan duvarındaki boru (tırmanma yolu)
  infTrim.addRect(Skia.XYWHRect(inf.x0 + 8 * k, inf.top, 3 * k, yard - inf.top));
  // kırmızı haç
  const cross = Skia.Path.Make();
  const ccx = (inf.x0 + inf.x1) / 2;
  cross.addRect(Skia.XYWHRect(ccx - 2 * k, inf.top + 5 * k, 4 * k, 11 * k));
  cross.addRect(Skia.XYWHRect(ccx - 5.5 * k, inf.top + 8.5 * k, 11 * k, 4 * k));
  return { body, center, cornice, bricks, wins, lit, bars, sills, tw, drain, wt, tank, chim, chimTop: [x1 - 35 * k, top - 30 * k], infBody, infWin, infLit, infTrim, cross };
}

function buildTower(L) {
  const { k, tower, yard } = L;
  const { x, top, cab } = tower;
  const legs = Skia.Path.Make();
  const lb = 18 * k;
  const lt = 9 * k;
  legs.moveTo(x - lb, yard);
  legs.lineTo(x - lt, cab + 14 * k);
  legs.moveTo(x + lb, yard);
  legs.lineTo(x + lt, cab + 14 * k);
  for (let i = 0; i < 6; i += 1) {
    const y0 = yard - i * ((yard - cab - 14 * k) / 6);
    const y1 = yard - (i + 1) * ((yard - cab - 14 * k) / 6);
    const w0 = lb + (lt - lb) * (i / 6);
    const w1 = lb + (lt - lb) * ((i + 1) / 6);
    legs.moveTo(x - w0, y0);
    legs.lineTo(x + w1, y1);
    legs.moveTo(x + w0, y0);
    legs.lineTo(x - w1, y1);
    legs.moveTo(x - w1, y1);
    legs.lineTo(x + w1, y1);
  }
  const cabin = Skia.Path.Make();
  cabin.addRect(Skia.XYWHRect(x - 16 * k, cab, 32 * k, 16 * k));
  const roof = Skia.Path.Make();
  roof.moveTo(x - 21 * k, cab);
  roof.lineTo(x, top);
  roof.lineTo(x + 21 * k, cab);
  roof.close();
  const glass = Skia.Path.Make();
  glass.addRect(Skia.XYWHRect(x - 13 * k, cab + 3 * k, 26 * k, 7 * k));
  const rail = Skia.Path.Make();
  rail.moveTo(x - 20 * k, cab + 16 * k);
  rail.lineTo(x + 20 * k, cab + 16 * k);
  rail.moveTo(x - 20 * k, cab + 10 * k);
  rail.lineTo(x + 20 * k, cab + 10 * k);
  for (let i = -2; i <= 2; i += 1) {
    rail.moveTo(x + i * 10 * k, cab + 10 * k);
    rail.lineTo(x + i * 10 * k, cab + 16 * k);
  }
  return { legs, cabin, roof, glass, rail };
}

function buildFence(L, width) {
  const { k, fenceBase, fenceTop } = L;
  const posts = Skia.Path.Make();
  const mesh = Skia.Path.Make();
  const coils = Skia.Path.Make();
  const arms = Skia.Path.Make();
  const sp = 46 * k;
  for (let x = -sp * 0.3; x < width + sp; x += sp) {
    posts.moveTo(x, fenceBase);
    posts.lineTo(x, fenceTop);
    arms.moveTo(x, fenceTop);
    arms.lineTo(x - 9 * k, fenceTop - 12 * k);
  }
  posts.moveTo(-5, fenceTop + 3 * k);
  posts.lineTo(width + 5, fenceTop + 3 * k);
  posts.moveTo(-5, fenceBase - 2 * k);
  posts.lineTo(width + 5, fenceBase - 2 * k);
  const m = 7 * k;
  for (let x = -fenceBase; x < width + (fenceBase - fenceTop); x += m) {
    mesh.moveTo(x, fenceBase);
    mesh.lineTo(x + (fenceBase - fenceTop), fenceTop);
    mesh.moveTo(x + (fenceBase - fenceTop), fenceBase);
    mesh.lineTo(x, fenceTop);
  }
  // jiletli tel bobinleri (iç içe halkalar)
  for (const [dy, r] of [[-6, 6.5], [-15, 5]]) {
    for (let x = -10; x < width + 10; x += 5.2 * k) coils.addOval(Skia.XYWHRect(x - r * k * 0.5, fenceTop + dy * k - r * k, r * k * 1.4, r * k * 2));
  }
  // ikinci (iç) çit: daha alçak ve soluk
  const inner = Skia.Path.Make();
  for (let x = sp * 0.2; x < width + sp; x += sp) {
    inner.moveTo(x, L.yard + 2 * k);
    inner.lineTo(x, L.yard - 58 * k);
  }
  inner.moveTo(-5, L.yard - 58 * k);
  inner.lineTo(width + 5, L.yard - 58 * k);
  const innerCoil = Skia.Path.Make();
  for (let x = -10; x < width + 10; x += 5 * k) innerCoil.addOval(Skia.XYWHRect(x, L.yard - 64 * k, 6 * k, 9 * k));
  return { posts, mesh, coils, arms, inner, innerCoil };
}

function buildOutside(L, width, height) {
  const { k, ground, fenceBase, pole } = L;
  const grass = Skia.Path.Make();
  grass.moveTo(-5, fenceBase - 4 * k);
  grass.cubicTo(width * 0.3, fenceBase - 2 * k, width * 0.7, fenceBase - 6 * k, width + 5, fenceBase - 3 * k);
  grass.lineTo(width + 5, height + 2);
  grass.lineTo(-5, height + 2);
  grass.close();
  const blades = Skia.Path.Make();
  for (let i = 0; i < 120; i += 1) {
    const x = ((i * 53) % 397) / 397 * width;
    const y = fenceBase + ((i * 29) % 100) / 100 * (height - fenceBase);
    blades.moveTo(x, y);
    blades.lineTo(x + 1.2 * k, y - (3 + (i % 4)) * k);
  }
  // ağaçlar (kenarlarda çam silüetleri)
  const trees = Skia.Path.Make();
  const pine = (x, base, h) => {
    trees.moveTo(x, base - h);
    for (let i = 1; i <= 4; i += 1) {
      const y = base - h + (h * i) / 4.4;
      const w = (h * 0.12 + i * h * 0.06);
      trees.lineTo(x + w, y);
      trees.lineTo(x + w * 0.45, y);
    }
    trees.lineTo(x + 2 * k, base);
    trees.lineTo(x - 2 * k, base);
    for (let i = 4; i >= 1; i -= 1) {
      const y = base - h + (h * i) / 4.4;
      const w = (h * 0.12 + i * h * 0.06);
      trees.lineTo(x - w * 0.45, y);
      trees.lineTo(x - w, y);
    }
    trees.close();
  };
  pine(-6 * k, ground + 4 * k, 92 * k);
  pine(18 * k, ground + 8 * k, 70 * k);
  pine(width + 4 * k, ground + 6 * k, 84 * k);
  // elektrik direği + kablo (revir çatısından)
  const poleP = Skia.Path.Make();
  poleP.moveTo(pole.x, ground - 2 * k);
  poleP.lineTo(pole.x, pole.top - 12 * k);
  poleP.moveTo(pole.x - 12 * k, pole.top - 6 * k);
  poleP.lineTo(pole.x + 12 * k, pole.top - 6 * k);
  const steps = Skia.Path.Make();
  for (let y = ground - 20 * k; y > pole.top; y -= 9 * k) {
    steps.moveTo(pole.x - 4 * k, y);
    steps.lineTo(pole.x + 4 * k, y - 2 * k);
  }
  const [cx0, cy0] = [L.route[3][0], L.route[3][1] - 2 * k];
  const cable = Skia.Path.Make();
  cable.moveTo(cx0, cy0);
  cable.quadTo((cx0 + pole.x) / 2, (cy0 + pole.top) / 2 + 8 * k, pole.x, pole.top);
  return { grass, blades, trees, poleP, steps, cable, cable0: [cx0, cy0] };
}

function buildSky(width, height, k) {
  const stars = Skia.Path.Make();
  let s = 3;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < 36; i += 1) stars.addCircle(rnd() * width, rnd() * height * 0.45, 0.5 + rnd() * 0.8);
  const cloud = Skia.Path.Make();
  for (const [x, y, w] of [[0, 0, 60], [26, -8, 44], [50, 2, 52], [-22, 4, 40]]) cloud.addOval(Skia.XYWHRect(x * k, y * k, w * k, 18 * k));
  return { stars, cloud };
}

// ── Figür (mahkûm) — yerel: ayak 0,0; boy ~24 birim ──
const BODY = "M-3 -16 C-3.6 -12 -3.4 -9 -3 -7 L3 -7 C3.4 -9 3.6 -12 3 -16 C1.6 -17 -1.6 -17 -3 -16 Z";
function Inmate({ L, f, clock, i, c, front }) {
  const st = useDerivedValue(() => {
    const u = f.value.u;
    const W = [3, 1.1, 1, 3.2, 1.2, 1.6];
    let s = (u - 0.14 - i * 0.055) / 0.5;
    if (u > 1 || s <= 0 || s >= 1) return { x: -999, y: 0, mode: 0, o: 0, face: 1, seg: 0 };
    const tot = 11.1;
    let a = s * tot;
    let seg = 0;
    while (seg < W.length - 1 && a > W[seg]) {
      a -= W[seg];
      seg += 1;
    }
    const r = Math.min(1, a / W[seg]);
    const p0 = L.route[seg];
    const p1 = L.route[seg + 1];
    let x = p0[0] + (p1[0] - p0[0]) * r;
    let y = p0[1] + (p1[1] - p0[1]) * r;
    if (seg === 3) {
      // eller kabloda: kablo (çatı köşesi → direk tepesi, ortada ~4k sarkma) + asılma boyu
      const cy = L.route[3][1] - 2 * L.k + (L.pole.top - L.route[3][1] + 2 * L.k) * r + Math.sin(r * Math.PI) * 4 * L.k + L.hang;
      const drop = Math.min(1, r / 0.08);
      y = p0[1] + (cy - p0[1]) * drop;
    }
    // rögardan çıkış: önce yerin altından yükselir
    if (seg === 0 && r < 0.12) y += (1 - r / 0.12) * 18 * L.k;
    const mode = seg === 1 || seg === 4 ? 1 : seg === 3 ? 2 : 0; // 0 koş, 1 tırman, 2 asıl
    return { x, y, mode, o: s < 0.01 ? s / 0.01 : 1, face: 1, seg };
  });
  const tr = useDerivedValue(() => {
    const q = st.value;
    const hangY = 0;
    const crouch = q.mode === 0 ? 0.12 : 0;
    return [{ translateX: q.x }, { translateY: q.y + hangY }, { scale: L.k * 1.25 }, { rotate: crouch }];
  });
  const clip = useDerivedValue(() => {
    // rögardan çıkarken yer altı kesilir
    const q = st.value;
    return q.seg === 0 ? Skia.XYWHRect(-2000, -3000, 6000, 3000 + L.yard) : Skia.XYWHRect(-2000, -3000, 6000, 9000);
  });
  const run = useDerivedValue(() => (st.value.mode === 0 ? 1 : st.value.mode === 1 ? 0.6 : 0.3));
  const legA = useDerivedValue(() => [{ rotate: Math.sin(clock.value * 13 + i) * 0.6 * run.value }]);
  const legB = useDerivedValue(() => [{ rotate: -Math.sin(clock.value * 13 + i) * 0.6 * run.value }]);
  const armA = useDerivedValue(() => {
    const m = st.value.mode;
    if (m === 0) return [{ rotate: -Math.sin(clock.value * 13 + i) * 0.7 }];
    return [{ rotate: Math.PI + Math.sin(clock.value * 7 + i) * 0.35 }];
  });
  const armB = useDerivedValue(() => {
    const m = st.value.mode;
    if (m === 0) return [{ rotate: Math.sin(clock.value * 13 + i) * 0.7 }];
    return [{ rotate: Math.PI - Math.sin(clock.value * 7 + i) * 0.35 }];
  });
  const o = useDerivedValue(() => ((st.value.seg >= 3) === front ? st.value.o : 0));
  const shirt = i === 0 ? "#3e5a7a" : i === 1 ? "#4a4a4a" : "#6a5236";
  return (
    <Group clip={clip} opacity={o}>
      <Group transform={tr}>
        <Group transform={[{ translateY: -15 }]}>
          <Group transform={armA}>
            <Path path="M0 0 L0 8" style="stroke" strokeWidth={1.8} strokeCap="round" color={c.fig} />
          </Group>
        </Group>
        <Group transform={[{ translateY: -7 }]}>
          <Group transform={legA}>
            <Path path="M0 0 L0 7" style="stroke" strokeWidth={2.2} strokeCap="round" color={c.fig} />
          </Group>
          <Group transform={legB}>
            <Path path="M0 0 L0 7" style="stroke" strokeWidth={2.2} strokeCap="round" color={c.fig} />
          </Group>
        </Group>
        <Path path={BODY} color={shirt} />
        <Circle cx={0} cy={-19.4} r={2.8} color="#c99a7a" />
        {i === 1 ? <Path path="M-2.8 -20 C-2.8 -23 2.8 -23 2.8 -20 Z" color="#1a1a1a" /> : <Path path="M-2.8 -19.8 C-3 -22.8 2.9 -22.9 2.8 -19.8 C1 -21 -1 -21 -2.8 -19.8 Z" color="#2a2018" />}
        <Group transform={[{ translateY: -15 }]}>
          <Group transform={armB}>
            <Path path="M0 0 L0 8" style="stroke" strokeWidth={1.8} strokeCap="round" color={c.fig} />
          </Group>
        </Group>
      </Group>
    </Group>
  );
}

// Nöbetçi (kule kabininde, döner)
function Guard({ L, clock, c }) {
  const tr = useDerivedValue(() => [{ translateX: L.tower.x + Math.sin(clock.value * 0.3) * 7 * L.k }, { translateY: L.tower.cab + 13 * L.k }, { scale: L.k * 0.75 }]);
  return (
    <Group transform={tr}>
      <Path path={BODY} color={c.fig} />
      <Circle cx={0} cy={-19.4} r={2.8} color={c.fig} />
      <Path path="M-4 -21 L4 -21 L3 -23.5 L-3 -23.5 Z" color={c.fig} />
      <Path path="M2 -14 L9 -20" style="stroke" strokeWidth={1.2} color={c.fig} />
    </Group>
  );
}

function ChimneySmoke({ x, y, k, i, clock, color }) {
  const tr = useDerivedValue(() => {
    const c0 = (clock.value * 0.07 + i / 4) % 1;
    return [{ translateX: x + c0 * 40 * k }, { translateY: y - c0 * 70 * k }, { scale: (0.4 + c0 * 1.6) * k }];
  });
  const op = useDerivedValue(() => Math.sin(((clock.value * 0.07 + i / 4) % 1) * Math.PI) * 0.35);
  return (
    <Group transform={tr} opacity={op}>
      <Oval x={-10} y={-6} width={20} height={12} color={color} />
    </Group>
  );
}

export default function PbScene({ p, clock, width, height, tone }) {
  const c = toneMap(tone.colors);
  const L = pbLayout(width, height);
  const { k } = L;
  const light = c.night === "#3a4a3a";
  const geo = useMemo(() => {
    const plan = Skia.Path.Make();
    plan.moveTo(L.route[0][0], L.route[0][1]);
    for (const [x, y] of L.route.slice(1)) plan.lineTo(x, y);
    // dövme süsü: rota boyunca küçük düğüm halkaları
    const knots = Skia.Path.Make();
    for (const [x, y] of L.route.slice(0, 6)) knots.addCircle(x, y, 3.2 * k);
    return {
      block: buildBlock(L, width),
      tower: buildTower(L),
      fence: buildFence(L, width),
      out: buildOutside(L, width, height),
      sky: buildSky(width, height, k),
      plan,
      knots,
    };
  }, [width, height]);
  const f = useDerivedValue(() => pbFrame(p, clock.value));

  // projektör: kuleden avluya; alarmda kabloya kilitlenir
  const beam = useDerivedValue(() => {
    const q = f.value;
    const [lx, ly] = L.lampP;
    const calm = width * 0.42 + Math.sin(clock.value * 0.33) * width * 0.34;
    const tx = calm + (L.route[4][0] - 20 * k - calm) * q.alarm;
    const ty = L.yard + (L.pole.top + 10 * k - L.yard) * q.alarm;
    const ang = Math.atan2(ty - ly, tx - lx);
    const len = Math.sqrt((tx - lx) * (tx - lx) + (ty - ly) * (ty - ly));
    return { ang, len, tx, ty };
  });
  const beamT = useDerivedValue(() => [{ translateX: L.lampP[0] }, { translateY: L.lampP[1] }, { rotate: beam.value.ang }, { scaleX: beam.value.len / 100 }]);
  const spotT = useDerivedValue(() => [{ translateX: beam.value.tx }, { translateY: beam.value.ty }]);
  const alarmA = useDerivedValue(() => f.value.alarm * (0.5 + 0.5 * Math.sin(clock.value * 5)));
  const alarmB = useDerivedValue(() => f.value.alarm * (0.5 - 0.5 * Math.sin(clock.value * 5)));
  const planO = useDerivedValue(() => f.value.planO);
  const planEnd = useDerivedValue(() => f.value.plan);
  const winA = useDerivedValue(() => 0.8 + 0.2 * Math.sin(clock.value * 0.9));
  const winB = useDerivedValue(() => 0.75 + 0.25 * Math.sin(clock.value * 0.6 + 2));
  const cloudT = useDerivedValue(() => [{ translateX: ((clock.value * 4) % (width + 200 * k)) - 120 * k }, { translateY: height * 0.16 }]);
  const cloud2T = useDerivedValue(() => [{ translateX: ((clock.value * 2.6 + width * 0.6) % (width + 200 * k)) - 120 * k }, { translateY: height * 0.08 }, { scale: 0.7 }]);

  const B = geo.block;
  const T = geo.tower;
  const F = geo.fence;
  const O = geo.out;
  const moonX = width * 0.16;
  const moonY = height * 0.12;
  return (
    <Group>
      {/* gök */}
      <Group opacity={light ? 0 : 0.6}>
        <Path path={geo.sky.stars} color="#f2f4ff" />
      </Group>
      <Circle cx={moonX} cy={moonY} r={46 * k}>
        <RadialGradient c={vec(moonX, moonY)} r={46 * k} colors={[light ? "rgba(255,255,255,0.35)" : "rgba(230,236,255,0.18)", "rgba(230,236,255,0)"]} />
      </Circle>
      <Circle cx={moonX} cy={moonY} r={16 * k} color={light ? "#ffffff" : "#e8ecf4"} />
      <Circle cx={moonX + 7 * k} cy={moonY - 4 * k} r={14 * k} color={light ? "#c9d5e2" : "#0f141c"} />
      <Group transform={cloudT} opacity={light ? 0.55 : 0.35}>
        <Path path={geo.sky.cloud} color={c.haze} />
      </Group>
      <Group transform={cloud2T} opacity={light ? 0.45 : 0.25}>
        <Path path={geo.sky.cloud} color={c.haze} />
      </Group>

      <Group opacity={tone.alpha}>
        {/* hücre bloğu */}
        {[0, 1, 2, 3].map((i) => (
          <ChimneySmoke key={i} x={B.chimTop[0]} y={B.chimTop[1]} k={k} i={i} clock={clock} color={c.haze} />
        ))}
        <Path path={B.chim} color={c.brickDark} />
        <Path path={B.wt} style="stroke" strokeWidth={1.3 * k} color={c.steel} />
        <Path path={B.tank} color={rgba(c.steel, 0.85)} />
        <Path path={B.center}>
          <LinearGradient start={vec(0, L.block.top - 54 * k)} end={vec(0, L.block.top)} colors={[c.brick, c.brickDark]} />
        </Path>
        <Path path={B.body}>
          <LinearGradient start={vec(0, L.block.top)} end={vec(0, L.yard)} colors={[c.brick, c.brickDark]} />
        </Path>
        <Path path={B.bricks} style="stroke" strokeWidth={0.45 * k} color="rgba(0,0,0,0.22)" />
        <Path path={B.cornice} color={c.concrete} />
        <Path path={B.sills} color={rgba(c.concrete, 0.8)} />
        <Path path={B.wins} color={rgba(c.night, 0.95)} />
        <Group opacity={winA}>
          <Path path={B.lit[0]} color={c.window} />
        </Group>
        <Group opacity={winB}>
          <Path path={B.lit[1]} color={c.window} />
        </Group>
        <Path path={B.bars} style="stroke" strokeWidth={0.8 * k} color={rgba(c.brickDark, 0.95)} />
        <Path path={B.tw} color={rgba(c.window, 0.75)} />
        <Path path={B.drain} color="#06080b" />
        {/* revir */}
        <Path path={B.infBody}>
          <LinearGradient start={vec(0, L.inf.top)} end={vec(0, L.yard)} colors={[c.concrete, rgba(c.concrete, 0.7)]} />
        </Path>
        <Path path={B.infTrim} color={rgba(c.steel, 0.9)} />
        <Path path={B.infWin} color={rgba(c.night, 0.9)} />
        <Path path={B.infLit} color={rgba(c.window, 0.85)} />
        <Path path={B.cross} color="#c0392b" />
        {/* avlu */}
        <Path path={`M-5 ${L.yard} L${width + 5} ${L.yard} L${width + 5} ${L.fenceBase} L-5 ${L.fenceBase} Z`} color={rgba(c.concrete, 0.55)} />
        {/* iç çit */}
        <Path path={F.inner} style="stroke" strokeWidth={1.2 * k} color={rgba(c.steel, 0.6)} />
        <Path path={F.innerCoil} style="stroke" strokeWidth={0.6 * k} color={rgba(c.steel, 0.5)} />
        {/* kule */}
        <Path path={T.legs} style="stroke" strokeWidth={1.2 * k} color={c.steel} />
        <Path path={T.cabin} color={rgba(c.steel, 0.9)} />
        <Path path={T.glass} color={rgba(c.lamp, 0.35)} />
        <Guard L={L} clock={clock} c={c} />
        <Path path={T.roof} color={c.brickDark} />
        <Path path={T.rail} style="stroke" strokeWidth={0.8 * k} color={c.steel} />
      </Group>
      <Group opacity={alarmA}>
        <Circle cx={L.tower.x - 12 * k} cy={L.tower.cab - 2 * k} r={9 * k}>
          <RadialGradient c={vec(L.tower.x - 12 * k, L.tower.cab - 2 * k)} r={9 * k} colors={[rgba(c.alarm, 0.95), rgba(c.alarm, 0)]} />
        </Circle>
      </Group>
      <Group opacity={alarmB}>
        <Circle cx={L.tower.x + 12 * k} cy={L.tower.cab - 2 * k} r={9 * k}>
          <RadialGradient c={vec(L.tower.x + 12 * k, L.tower.cab - 2 * k)} r={9 * k} colors={[rgba(c.alarm, 0.95), rgba(c.alarm, 0)]} />
        </Circle>
      </Group>

      {/* kablo (revir çatısı → direk) */}
      <Path path={O.cable} style="stroke" strokeWidth={1.8 * k} color="rgba(12,12,16,0.9)" />
      <Path path={O.cable} style="stroke" strokeWidth={0.6 * k} color={rgba(c.steel, 0.9)} />

      {/* kaçış planı (dövme çizgisi) */}
      <Group opacity={planO}>
        <Path path={geo.plan} style="stroke" strokeWidth={4 * k} strokeJoin="round" strokeCap="round" color={rgba(c.plan, 0.25)} end={planEnd} />
        <Path path={geo.plan} style="stroke" strokeWidth={1.3 * k} strokeJoin="round" strokeCap="round" color={c.plan} end={planEnd} />
        <Path path={geo.knots} style="stroke" strokeWidth={0.9 * k} color={c.plan} />
      </Group>

      {/* mahkûmlar (çitin arkasında; kabloda ve direkte önde görünür) */}
      {[0, 1, 2, 3].map((i) => (
        <Inmate key={i} L={L} f={f} clock={clock} i={i} c={c} front={false} />
      ))}

      {/* projektör ışını + lekesi */}
      <Group transform={beamT}>
        <Path path="M0 -2 L100 -16 L100 16 L0 2 Z">
          <LinearGradient start={vec(0, 0)} end={vec(100, 0)} colors={[rgba(c.lamp, 0.55), rgba(c.lamp, 0.12)]} />
        </Path>
      </Group>
      <Group transform={spotT}>
        <Oval x={-34 * k} y={-9 * k} width={68 * k} height={18 * k}>
          <RadialGradient c={vec(0, 0)} r={34 * k} colors={[rgba(c.lamp, 0.45), rgba(c.lamp, 0)]} />
        </Oval>
      </Group>
      <Circle cx={L.lampP[0]} cy={L.lampP[1]} r={3 * k} color={c.lamp} />

      {/* dış çit + dışarısı */}
      <Group opacity={tone.alpha}>
        <Path path={F.mesh} style="stroke" strokeWidth={0.45 * k} color={rgba(c.steel, 0.35)} />
        <Path path={F.posts} style="stroke" strokeWidth={1.6 * k} color={c.steel} />
        <Path path={F.arms} style="stroke" strokeWidth={1.2 * k} color={c.steel} />
        <Path path={F.coils} style="stroke" strokeWidth={0.6 * k} color={rgba(c.steel, 0.85)} />
        <Path path={O.grass}>
          <LinearGradient start={vec(0, L.fenceBase)} end={vec(0, height)} colors={[c.grass, c.night]} />
        </Path>
        <Path path={O.blades} style="stroke" strokeWidth={0.6 * k} color={rgba(c.grass, 0.9)} />
        <Path path={O.trees} color={rgba(c.night, 0.95)} />
        <Path path={O.poleP} style="stroke" strokeWidth={2.6 * k} color={light ? "#3a2c22" : "#5a4636"} />
        <Path path={O.steps} style="stroke" strokeWidth={0.8 * k} color={c.steel} />
      </Group>
      {/* kabloda ve direkte (çitin önünde) */}
      {[0, 1, 2, 3].map((i) => (
        <Inmate key={`f${i}`} L={L} f={f} clock={clock} i={i} c={c} front />
      ))}
    </Group>
  );
}
