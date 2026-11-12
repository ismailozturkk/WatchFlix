// components/decor/onePieceScene.js
//
// One Piece evren sahnesi — GÖK + UFUK katmanı (OVERLAY.opSky = 52; OVERLAY_UNDER: kıyı dalgalarının ALTINDA).
// Önünde ayrı parçacıklar: 3 dalga bandı, aslan başlı yelkenli (opShip), martılar, parıltılar.
//   • Gök degradesi; açıkta tepede güneş + ışınlar, koyuda ufka batan iri gün batımı güneşi.
//   • Sol ve sağda göğe yükselen dev kümülüs kuleleri (gölgeli, çizgi film tonlu), ağır kayar.
//   • Ufukta uzak adalar, palmiyeli ada, kemerli deniz kayası; ufuk parıltısı.
//   • Rüzgâra kapılmış hasır şapka kendi döngüsünde göğü takla atarak geçer.
//   • Olay (66 sn'de bir ~25 sn): ufuk ile kıyı arasında köpükler kaynar, dev bir deniz kralı
//     yükselir, etrafa bakar, kükrer (çene açılır), sonra köpük sıçratarak dalar.
//
// Ölçek: shoreMetrics k; kıyı SCENERY.lift kadar kaldırılmıştır (ParticleField seaLift ile aynı).

import React, { useMemo } from "react";
import { useDerivedValue } from "react-native-reanimated";
import { Circle, Group, LinearGradient, Path, Rect, Skia, vec } from "@shopify/react-native-skia";
import { restU, shoreMetrics } from "../../utils/weatherParticles";
import { SCENERY } from "../../utils/weatherUniverses";
import { Glow, TAU, hash, rgba, sm, toneMap } from "./seasonKit";

export const OP_TONE = [
  "skyTop",
  "skyLow",
  "sun",
  "sunGlow",
  "cloud",
  "cloudShade",
  "seaFar",
  "sea",
  "glitter",
  "islandFar",
  "island",
  "palm",
  "rock",
  "serpent",
  "serpentBelly",
  "fin",
  "eye",
  "teeth",
  "hat",
  "hatBand",
  "foam",
];

export function opLayout(width, height) {
  const m = shoreMetrics(width, height);
  const { k } = m;
  const lift = SCENERY.lift * k;
  const seaTop = m.seaTop - lift;
  const horizon = seaTop - 110 * k;
  return {
    k,
    width,
    height,
    seaTop,
    horizon,
    // deniz kralının su hattı (ufuk ile kıyı arasında)
    king: [width * 0.3, horizon + 34 * k],
  };
}

/** Çizgi film kümülüs kulesi: alttan geniş, yukarı daralan yuvarlak yığın. */
function addTower(lit, shade, cx, base, w, h, seed) {
  // iç dolgu (yamuk) + kenar ve tepe boyunca iri, üst üste binen kabarcıklar
  const rows = 9;
  const body = Skia.Path.Make();
  body.moveTo(cx - w * 0.5, base);
  body.lineTo(cx - w * 0.22, base - h * 0.92);
  body.lineTo(cx + w * 0.22, base - h * 0.92);
  body.lineTo(cx + w * 0.5, base);
  body.close();
  shade.addPath(body);
  const bodyLit = Skia.Path.Make();
  bodyLit.moveTo(cx - w * 0.5, base - w * 0.06);
  bodyLit.lineTo(cx - w * 0.24, base - h * 0.94);
  bodyLit.lineTo(cx + w * 0.16, base - h * 0.94);
  bodyLit.lineTo(cx + w * 0.4, base - w * 0.08);
  bodyLit.close();
  lit.addPath(bodyLit);
  for (let r = 0; r < rows; r += 1) {
    const f = r / (rows - 1);
    const half = (w / 2) * (1 - f * 0.56);
    const y = base - f * h * 0.92;
    const rr = w * (0.2 - f * 0.08) * (0.85 + hash(r, seed + 1) * 0.3);
    const n = r === rows - 1 ? 3 : 2;
    for (let i = 0; i < n; i += 1) {
      const g = n === 3 ? i / 2 : i;
      const x = cx - half + g * 2 * half + (hash(r * 7 + i, seed) - 0.5) * w * 0.08;
      const yy = y - (n === 3 && i === 1 ? rr * 0.5 : 0);
      shade.addCircle(x + rr * 0.08, yy + rr * 0.1, rr);
      lit.addCircle(x - rr * 0.14, yy - rr * 0.12, rr * 0.84);
    }
  }
  // düz taban
  shade.addRRect(Skia.RRectXY(Skia.XYWHRect(cx - w * 0.54, base - w * 0.05, w * 1.08, w * 0.1), w * 0.05, w * 0.05));
}

function buildSky(L, night) {
  const { k, width, horizon, seaTop } = L;
  const sun = night ? [width * 0.62, horizon - 16 * k, 40 * k] : [width * 0.78, L.height * 0.12, 26 * k];
  const towers = [
    { lit: Skia.Path.Make(), shade: Skia.Path.Make() },
    { lit: Skia.Path.Make(), shade: Skia.Path.Make() },
    { lit: Skia.Path.Make(), shade: Skia.Path.Make() },
  ];
  addTower(towers[0].lit, towers[0].shade, width * 0.12, horizon - 30 * k, 170 * k, 300 * k, 3);
  addTower(towers[1].lit, towers[1].shade, width * 0.92, horizon - 50 * k, 140 * k, 220 * k, 11);
  addTower(towers[2].lit, towers[2].shade, width * 0.36, horizon - 10 * k, 100 * k, 64 * k, 19);
  // uzak adalar
  const far = Skia.Path.Make();
  far.moveTo(-10 * k, horizon + 1);
  far.cubicTo(width * 0.06, horizon - 22 * k, width * 0.14, horizon - 26 * k, width * 0.24, horizon + 1);
  far.close();
  far.moveTo(width * 0.4, horizon + 1);
  far.cubicTo(width * 0.44, horizon - 10 * k, width * 0.5, horizon - 12 * k, width * 0.55, horizon + 1);
  far.close();
  // palmiyeli ada (sağ)
  const isl = Skia.Path.Make();
  const ix = width * 0.78;
  isl.moveTo(ix - 60 * k, horizon + 2);
  isl.cubicTo(ix - 40 * k, horizon - 16 * k, ix + 30 * k, horizon - 18 * k, ix + 64 * k, horizon + 2);
  isl.close();
  const palms = Skia.Path.Make();
  [[-14, 34, -0.18], [8, 42, 0.12], [26, 28, 0.3]].forEach(([dx, h, lean]) => {
    const bx = ix + dx * k;
    const by = horizon - 12 * k;
    const tx = bx + lean * h * k;
    const ty = by - h * k;
    palms.moveTo(bx - 1.4 * k, by);
    palms.quadTo(bx + lean * h * 0.3 * k, by - h * 0.6 * k, tx - 0.8 * k, ty);
    palms.lineTo(tx + 0.8 * k, ty);
    palms.quadTo(bx + lean * h * 0.3 * k + 2 * k, by - h * 0.6 * k, bx + 1.4 * k, by);
    palms.close();
    for (let j = 0; j < 6; j += 1) {
      const a = -Math.PI / 2 + (j - 2.5) * 0.55;
      const len = (12 + (j % 2) * 4) * k;
      const ex = tx + Math.cos(a) * len * 1.2;
      const ey = ty + Math.sin(a) * len * 0.5 + len * 0.45;
      palms.moveTo(tx, ty);
      palms.quadTo((tx + ex) / 2, ty - 5 * k, ex, ey);
      palms.quadTo((tx + ex) / 2, ty - 1.5 * k, tx, ty + 1.5 * k);
      palms.close();
    }
  });
  // kemerli deniz kayası (sol-orta, biraz yakın)
  const rock = Skia.Path.Make();
  const rx = width * 0.08;
  const ry = horizon + 20 * k;
  rock.moveTo(rx - 26 * k, ry);
  rock.lineTo(rx - 22 * k, ry - 40 * k);
  rock.quadTo(rx - 14 * k, ry - 58 * k, rx + 4 * k, ry - 54 * k);
  rock.quadTo(rx + 24 * k, ry - 50 * k, rx + 30 * k, ry - 26 * k);
  rock.lineTo(rx + 34 * k, ry);
  rock.lineTo(rx + 20 * k, ry);
  rock.quadTo(rx + 14 * k, ry - 26 * k, rx + 4 * k, ry - 26 * k);
  rock.quadTo(rx - 6 * k, ry - 26 * k, rx - 10 * k, ry);
  rock.close();
  // parıltı: güneşin altında genişleyen kısa çizgiler (3 titreşim grubu)
  const glitter = [Skia.Path.Make(), Skia.Path.Make(), Skia.Path.Make()];
  for (let i = 0; i < 64; i += 1) {
    const f = hash(i, 1);
    const y = horizon + 3 * k + f * f * (seaTop - horizon + 20 * k);
    const spread = (10 + f * 70) * k * (night ? 1 : 1.5);
    const x = sun[0] + (hash(i, 2) - 0.5) * 2 * spread;
    const w = (3 + f * 14) * k * (0.5 + hash(i, 3));
    glitter[i % 3].addRRect(Skia.RRectXY(Skia.XYWHRect(x - w / 2, y, w, (0.8 + f * 1.4) * k), k, k));
  }
  const rays = Skia.Path.Make();
  for (let i = 0; i < 14; i += 1) {
    const a = (i / 14) * TAU;
    const r1 = sun[2] * 1.4;
    const r2 = sun[2] * (i % 2 ? 2.3 : 3);
    rays.moveTo(Math.cos(a - 0.06) * r1, Math.sin(a - 0.06) * r1);
    rays.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    rays.lineTo(Math.cos(a + 0.06) * r1, Math.sin(a + 0.06) * r1);
    rays.close();
  }
  return { sun, towers, far, isl, palms, rock, glitter, rays };
}

// ───────────────────────────── deniz kralı (kare başına)

/** Olay evresi → { h: yükseliş 0–1, sway, mouth, foam, splash }. */
function kingState(u) {
  "worklet";
  if (u > 1) return { h: 0, sway: 0, mouth: 0, foam: 0, splash: 0, dive: 0 };
  const rise = sm(0.1, 0.3, u);
  const dive = sm(0.7, 0.88, u);
  return {
    h: rise * (1 - dive),
    sway: sm(0.3, 0.42, u) * (1 - sm(0.6, 0.72, u)),
    mouth: sm(0.46, 0.52, u) * (1 - sm(0.6, 0.66, u)),
    foam: sm(0.04, 0.12, u) * (1 - sm(0.88, 0.96, u)),
    splash: Math.max(sm(0.12, 0.18, u) * (1 - sm(0.2, 0.34, u)), sm(0.78, 0.84, u) * (1 - sm(0.86, 0.98, u))),
    dive,
  };
}

/** Boyun gövdesi (tabandan başa) + karın şeridi + sırt yüzgeçleri; başın konumu/açısı. */
function kingPaths(t, st, bx, by, k) {
  "worklet";
  const body = Skia.Path.Make();
  const belly = Skia.Path.Make();
  const fins = Skia.Path.Make();
  const scales = Skia.Path.Make();
  const N = 22;
  const H = 250 * k * st.h;
  const pts = [];
  for (let i = 0; i <= N; i += 1) {
    const s = i / N;
    // S kıvrımı + salınım; dalışta baş öne (sola) eğilir
    const x = bx + Math.sin(s * 3.2 + t * 0.6) * 26 * k * s + st.sway * Math.sin(t * 0.9) * 26 * k * s * s - st.dive * 50 * k * s * s;
    const y = by + 30 * k - s * H;
    pts.push([x, y]);
  }
  const L = [];
  const R = [];
  const B = [];
  for (let i = 0; i <= N; i += 1) {
    const s = i / N;
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(N, i + 1)];
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= d;
    dy /= d;
    const w = (30 - 14 * s) * k;
    // normal: (-dy, dx) → sol taraf (karın, yön sol)
    L.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
    R.push([pts[i][0] - dy * w, pts[i][1] + dx * w]);
    B.push([pts[i][0] + dy * w * 0.25, pts[i][1] - dx * w * 0.25]);
    if (i % 2 === 1 && i < N - 1) {
      // sırt yüzgeci (sağ taraf)
      const fx = R[i][0];
      const fy = R[i][1];
      const fl = (16 - s * 6) * k;
      fins.moveTo(fx + dx * 5 * k, fy + dy * 5 * k);
      fins.lineTo(fx - dy * fl * 0.2 + dx * -8 * k - dy * fl, fy + dx * fl - 8 * k * dy);
      fins.lineTo(fx - dx * 5 * k, fy - dy * 5 * k);
      fins.close();
      // pul hilalleri
      scales.moveTo(pts[i][0] - dy * w * 0.2, pts[i][1] + dx * w * 0.2);
      scales.quadTo(pts[i][0] - dy * w * 0.55 - dx * 4 * k, pts[i][1] + dx * w * 0.55 - dy * 4 * k, pts[i][0] - dy * w * 0.85, pts[i][1] + dx * w * 0.85);
    }
  }
  body.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i <= N; i += 1) body.lineTo(L[i][0], L[i][1]);
  for (let i = N; i >= 0; i -= 1) body.lineTo(R[i][0], R[i][1]);
  body.close();
  belly.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i <= N; i += 1) belly.lineTo(L[i][0], L[i][1]);
  for (let i = N; i >= 0; i -= 1) belly.lineTo(B[i][0], B[i][1]);
  belly.close();
  const top = pts[N];
  const prev = pts[N - 1];
  const ang = Math.atan2(top[1] - prev[1], top[0] - prev[0]);
  return { body, belly, fins, scales, hx: top[0], hy: top[1], ang };
}

function buildHead(k) {
  const s = (v) => v * k;
  const head = Skia.Path.Make();
  // üst kafa (sola bakar): ense (0,0) civarında
  head.moveTo(s(14), s(-20));
  head.cubicTo(s(-6), s(-34), s(-44), s(-26), s(-74), s(-8));
  head.quadTo(s(-80), s(-2), s(-74), s(4));
  head.lineTo(s(-10), s(8));
  head.quadTo(s(14), s(10), s(20), s(-4));
  head.close();
  const jaw = Skia.Path.Make();
  jaw.moveTo(s(-4), s(4));
  jaw.lineTo(s(-68), s(4));
  jaw.quadTo(s(-70), s(12), s(-60), s(15));
  jaw.quadTo(s(-26), s(22), s(4), s(18));
  jaw.close();
  const teethU = Skia.Path.Make();
  const teethL = Skia.Path.Make();
  for (let i = 0; i < 9; i += 1) {
    const x = -66 + i * 6.6;
    teethU.moveTo(s(x), s(4.5));
    teethU.lineTo(s(x + 1.8), s(10));
    teethU.lineTo(s(x + 3.6), s(4.5));
    teethU.close();
    teethL.moveTo(s(x + 2), s(4.5));
    teethL.lineTo(s(x + 3.8), s(-0.5));
    teethL.lineTo(s(x + 5.6), s(4.5));
    teethL.close();
  }
  const crest = Skia.Path.Make();
  [[10, -18, 34, -46], [-2, -26, 14, -58], [-16, -29, -8, -56], [-30, -27, -32, -48]].forEach(([x0, y0, x1, y1]) => {
    crest.moveTo(s(x0 - 6), s(y0 + 2));
    crest.quadTo(s((x0 + x1) / 2 + 4), s((y0 + y1) / 2), s(x1), s(y1));
    crest.quadTo(s((x0 + x1) / 2 + 8), s((y0 + y1) / 2 + 6), s(x0 + 6), s(y0 + 2));
    crest.close();
  });
  // bıyık / dokunaç
  const whisker = Skia.Path.Make();
  whisker.moveTo(s(-70), s(-4));
  whisker.cubicTo(s(-90), s(-10), s(-96), s(10), s(-112), s(4));
  whisker.moveTo(s(-62), s(-10));
  whisker.cubicTo(s(-74), s(-30), s(-92), s(-24), s(-100), s(-36));
  const nostril = Skia.Path.Make();
  nostril.addOval(Skia.XYWHRect(s(-72), s(-8), s(4), s(2.4)));
  return { head, jaw, teethU, teethL, crest, whisker, nostril };
}

function SeaKing({ p, clock, L, c }) {
  const { k } = L;
  const [bx, by] = L.king;
  const st = useDerivedValue(() => kingState(restU(p, clock.value)));
  const d = useDerivedValue(() => kingPaths(clock.value, st.value, bx, by, k));
  const body = useDerivedValue(() => d.value.body);
  const belly = useDerivedValue(() => d.value.belly);
  const fins = useDerivedValue(() => d.value.fins);
  const scales = useDerivedValue(() => d.value.scales);
  const head = useMemo(() => buildHead(k), [k]);
  const headT = useDerivedValue(() => {
    // baş gövde yönüne dik durur; ana yön sol, dalışta öne eğilir
    const a = d.value.ang + Math.PI / 2;
    return [{ translateX: d.value.hx }, { translateY: d.value.hy }, { rotate: a * 0.6 - st.value.mouth * 0.25 }];
  });
  const jawT = useDerivedValue(() => [
    { translateX: 4 * k },
    { translateY: 4 * k },
    { rotate: -st.value.mouth * 0.55 },
    { translateX: -4 * k },
    { translateY: -4 * k },
  ]);
  const on = useDerivedValue(() => (st.value.h > 0.01 ? 1 : 0));
  const eye = useDerivedValue(() => 0.7 + 0.3 * st.value.mouth);
  const clip = useMemo(() => Skia.XYWHRect(-50, -500, L.width + 100, by + 500), [L.width, by]);
  return (
    <Group opacity={on}>
      <Group clip={clip}>
        <Path path={fins} color={c.fin} />
        <Path path={body} color={c.serpent} />
        <Path path={belly} color={c.serpentBelly} />
        <Path path={scales} style="stroke" strokeWidth={1.1 * k} strokeCap="round" color={rgba(c.serpentBelly, 0.45)} />
        <Group transform={headT}>
          <Path path={head.crest} color={c.fin} />
          <Group transform={jawT}>
            <Path path={head.jaw} color={c.serpentBelly} />
            <Path path={head.teethL} color={c.teeth} />
          </Group>
          <Path path={head.teethU} color={c.teeth} />
          <Path path={head.head} color={c.serpent} />
          <Path path={head.whisker} style="stroke" strokeWidth={2 * k} strokeCap="round" color={c.fin} />
          <Path path={head.nostril} color={c.rock} />
          <Group opacity={eye}>
            <Glow cx={-30 * k} cy={-12 * k} r={14 * k} color={c.eye} a={0.7} mid={0.3} />
          </Group>
          <Circle cx={-30 * k} cy={-12 * k} r={5.4 * k} color={c.eye} />
          <Rect x={-31.2 * k} y={-16.6 * k} width={2.4 * k} height={9.2 * k} color={c.rock} />
        </Group>
      </Group>
    </Group>
  );
}

/** Kaynayan köpük halkaları + yükseliş/dalış sıçraması. */
function KingFoam({ p, clock, L, c }) {
  const { k } = L;
  const [bx, by] = L.king;
  const st = useDerivedValue(() => kingState(restU(p, clock.value)));
  const ring = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const t = clock.value;
    for (let i = 0; i < 9; i += 1) {
      const a = (i / 9) * TAU + t * 0.4;
      const r = (34 + Math.sin(t * 3 + i) * 4) * k;
      q.addOval(Skia.XYWHRect(bx + Math.cos(a) * r * 1.4 - 7 * k, by + Math.sin(a) * r * 0.22 - 2 * k, 14 * k, 4.5 * k));
    }
    return q;
  });
  const splash = useDerivedValue(() => {
    const q = Skia.Path.Make();
    const g = st.value.splash;
    if (g <= 0) return q;
    for (let i = 0; i < 14; i += 1) {
      const a = Math.PI + (i / 13) * Math.PI;
      const r = (20 + hash(i, 5) * 30) * k * (0.4 + g);
      const x = bx + Math.cos(a) * r * 1.6;
      const y = by + Math.sin(a) * r * (0.8 + hash(i, 6));
      q.addCircle(x, y, (2.5 + hash(i, 7) * 3.5) * k * (1.2 - g * 0.5));
    }
    return q;
  });
  const fo = useDerivedValue(() => st.value.foam);
  const so = useDerivedValue(() => st.value.splash);
  return (
    <Group>
      <Group opacity={fo}>
        <Path path={ring} color={rgba(c.foam, 0.85)} />
        <Rect x={bx - 60 * k} y={by - 1.5 * k} width={120 * k} height={3 * k} color={rgba(c.foam, 0.6)} />
      </Group>
      <Group opacity={so}>
        <Path path={splash} color={c.foam} />
      </Group>
    </Group>
  );
}

/** Rüzgârda takla atan hasır şapka (kendi 26 sn döngüsü; ~15 sn görünür). */
function StrawHat({ clock, L, c }) {
  const { k, width, horizon } = L;
  const geo = useMemo(() => {
    const brim = Skia.Path.Make();
    brim.addOval(Skia.XYWHRect(-26 * k, -6 * k, 52 * k, 12 * k));
    const crown = Skia.Path.Make();
    crown.moveTo(-14 * k, -1 * k);
    crown.cubicTo(-15 * k, -20 * k, 15 * k, -20 * k, 14 * k, -1 * k);
    crown.close();
    const band = Skia.Path.Make();
    band.moveTo(-14.4 * k, -2 * k);
    band.cubicTo(-14.8 * k, -7 * k, 14.8 * k, -7 * k, 14.4 * k, -2 * k);
    band.lineTo(14 * k, 1 * k);
    band.cubicTo(5 * k, 3 * k, -5 * k, 3 * k, -14 * k, 1 * k);
    band.close();
    const weave = Skia.Path.Make();
    for (let i = 1; i < 4; i += 1) weave.addOval(Skia.XYWHRect(-26 * k + i * 4 * k, -6 * k + i * 1 * k, 52 * k - i * 8 * k, 12 * k - i * 2 * k));
    weave.moveTo(-8 * k, -12 * k);
    weave.quadTo(0, -14.5 * k, 8 * k, -12 * k);
    return { brim, crown, band, weave };
  }, [k]);
  const st = useDerivedValue(() => {
    const per = 26;
    const f = (clock.value % per) / per;
    const g = f / 0.6;
    if (g > 1) return { on: 0, x: -999, y: 0, r: 0, sy: 1 };
    const x = width + 40 * k - g * (width + 80 * k);
    const y = horizon * (0.3 + 0.22 * g) + Math.sin(g * TAU * 1.5) * 34 * k;
    return { on: 1, x, y, r: g * TAU * 1.6, sy: 0.55 + 0.45 * Math.cos(g * TAU * 2.2) };
  });
  const at = useDerivedValue(() => [{ translateX: st.value.x }, { translateY: st.value.y }, { rotate: Math.sin(st.value.r) * 0.9 }, { scaleY: st.value.sy }]);
  const on = useDerivedValue(() => st.value.on);
  return (
    <Group opacity={on}>
      <Group transform={at}>
        <Path path={geo.brim} color={c.hat} />
        <Path path={geo.weave} style="stroke" strokeWidth={0.6 * k} color={rgba(c.rock, 0.35)} />
        <Path path={geo.crown} color={c.hat} />
        <Path path={geo.band} color={c.hatBand} />
        <Path path={geo.brim} style="stroke" strokeWidth={0.7 * k} color={rgba(c.rock, 0.5)} />
      </Group>
    </Group>
  );
}

function Tower({ clock, tw, i, L, c, night }) {
  const { k } = L;
  const at = useDerivedValue(() => [{ translateX: Math.sin(clock.value * 0.03 + i * 2) * 14 * k }]);
  return (
    <Group transform={at} opacity={night ? 0.92 : 1}>
      <Path path={tw.shade} color={c.cloudShade} />
      <Path path={tw.lit} color={c.cloud} />
    </Group>
  );
}

function Shimmer({ clock, paths, color }) {
  const o0 = useDerivedValue(() => 0.35 + 0.35 * Math.sin(clock.value * 2.1));
  const o1 = useDerivedValue(() => 0.35 + 0.35 * Math.sin(clock.value * 2.1 + 2.1));
  const o2 = useDerivedValue(() => 0.35 + 0.35 * Math.sin(clock.value * 2.1 + 4.2));
  return (
    <Group>
      <Path path={paths[0]} color={color} opacity={o0} />
      <Path path={paths[1]} color={color} opacity={o1} />
      <Path path={paths[2]} color={color} opacity={o2} />
    </Group>
  );
}

export default function OnePieceScene({ p, clock, width, height, tone, lightSurface }) {
  const night = !lightSurface;
  const L = useMemo(() => opLayout(width, height), [width, height]);
  const geo = useMemo(() => buildSky(L, night), [L, night]);
  const c = useMemo(() => toneMap(OP_TONE, tone.colors), [tone]);
  const { k, horizon, seaTop } = L;
  const [sx, sy, sr] = geo.sun;
  const rayT = useDerivedValue(() => [{ translateX: sx }, { translateY: sy }, { rotate: clock.value * 0.05 }]);
  return (
    <Group opacity={tone.alpha}>
      <Rect x={0} y={0} width={width} height={horizon + 1}>
        <LinearGradient start={vec(0, 0)} end={vec(0, horizon)} colors={[c.skyTop, c.skyLow]} />
      </Rect>
      <Glow cx={sx} cy={sy} r={sr * (night ? 7 : 6)} color={c.sunGlow} a={night ? 0.6 : 0.5} mid={0.35} />
      {night ? null : (
        <Group transform={rayT} opacity={0.35}>
          <Path path={geo.rays} color={c.sun} />
        </Group>
      )}
      <Circle cx={sx} cy={sy} r={sr} color={c.sun} />
      {geo.towers.map((tw, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <Tower key={i} clock={clock} tw={tw} i={i} L={L} c={c} night={night} />
      ))}
      <StrawHat clock={clock} L={L} c={c} />
      {/* deniz: ufuktan kıyıya; güneş ufkun arkasına batar */}
      <Rect x={0} y={horizon} width={width} height={height - horizon}>
        <LinearGradient start={vec(0, horizon)} end={vec(0, seaTop + 30 * k)} colors={[c.seaFar, c.sea]} />
      </Rect>
      <Rect x={0} y={horizon - 0.6 * k} width={width} height={1.4 * k} color={rgba(c.glitter, 0.55)} />
      <Path path={geo.far} color={c.islandFar} />
      <Path path={geo.isl} color={c.island} />
      <Path path={geo.palms} color={c.palm} />
      <Shimmer clock={clock} paths={geo.glitter} color={c.glitter} />
      <SeaKing p={p} clock={clock} L={L} c={c} />
      <KingFoam p={p} clock={clock} L={L} c={c} />
      <Path path={geo.rock} color={c.rock} />
      <Rect x={width * 0.08 - 34 * k} y={horizon + 19 * k} width={74 * k} height={2 * k} color={rgba(c.foam, 0.5)} />
    </Group>
  );
}
