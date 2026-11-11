// utils/streakFlameShader.js
//
// Seri alevinin Skia shader'ı (SkSL) + JS tarafı hesapları. SAF modül: RN/Skia
// importu yok, jest'te test edilir. Çizim: components/streak/SkiaStreakFlame.js.
//
// DOĞAL ALEV NASIL ÇİZİLİYOR
//   • Yoğunluk alanı: damla biçimli bir gövde, yukarı akan iki kat gürültüyle
//     (domain warp) bükülür ve kenarları yerer. Uç sivrilir, kopan "dil"ler oluşur.
//   • Sıcaklık → renk: gövde katmanları üst üste toplanıp bir SICAKLIK değerine
//     dönüşür; renk 5 duraklı bir rampadan okunur (koyu dış ton → açık dış → orta →
//     çekirdek → beyaz-sıcak). Gerçek alevdeki gibi dip ve merkez sıcak, uç serin.
//   • Titreme: parlaklık hızlı, düşük genlikli gürültüyle oynar; alev hafif sallanır.
//   • İhtişam (bu haftanın günü, 1..7):
//       1 tek dil (çekirdeksiz, sönük) · 2 orta katman · 3 beyaz-sıcak çekirdek ·
//       4 yükselen kıvılcımlar · 5 uçuşan minik kıvılcımlar (girdap gibi dönüp
//       yükselen, göz kırpan parçacıklar) · 6 taç (arkada büyük,
//       yarı saydam ikinci alev + ışınlar) · 7 çevrede parlayan yıldızlar
//   • Kıvılcım biçimi HER HAFTA değişir: kor · yıldız · elmas · kar tanesi.
//   • 52+ hafta: alev etrafında dönen gökkuşağı halkası ve renk kayması.
//   • Mola: gri rampa, efektsiz, yavaş.
//
// Çıktı ÖNÇARPIMLI (premultiplied) ve saydam arka planlıdır: açık ve koyu temada
// aynı alev, arkasındaki yüzeyin üstüne çizilir.
//
// KOORDİNAT: tuval alev kutusundan büyüktür (FLAME_CANVAS); efektler kutunun
// dışına taşar ama yerleşimi büyütmez. Shader içinde birim = alev kutusu YÜKSEKLİĞİ;
// y = 0 alevin dibi, y ≈ 1 ucu.

export const FLAME_SKSL = `
uniform float2 res;
uniform float2 box;
uniform float time;
uniform float stage;
uniform float shape;
uniform float energy;
uniform float growth;
uniform float effects;
uniform float rainbow;
uniform float sparkCount;
uniform float dim;
uniform float detail;
uniform float3 c0;
uniform float3 c1;
uniform float3 c2;
uniform float3 c3;
uniform float3 c4;
uniform float3 glowC;
uniform float3 emberC;

float hash(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }

float vnoise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + float2(1.0, 0.0));
  float c = hash(i + float2(0.0, 1.0));
  float d = hash(i + float2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(float2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = p * 2.03 + float2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

float3 ramp(float x) {
  x = clamp(x, 0.0, 1.0);
  if (x < 0.25) return mix(c0, c1, x / 0.25);
  if (x < 0.5) return mix(c1, c2, (x - 0.25) / 0.25);
  if (x < 0.75) return mix(c2, c3, (x - 0.5) / 0.25);
  return mix(c3, c4, (x - 0.75) / 0.25);
}

float3 hue(float h) {
  return clamp(abs(mod(h * 6.0 + float3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}

// Alev dili yoğunluğu (0..1). h: boy, w: dipteki yarı genişlik, sp: akış hızı.
// Gövde: yuvarlak dip, ~%25 boyda en geniş, uca doğru sivrilen damla. İki kat gürültü
// gövdeyi yukarı doğru büker (domain warp); üçüncü kat kenarları yer ve tepede
// kopan diller açar. Uca çıktıkça bükülme artar: dip sakin, uç oynak.
float tongue(float2 p, float t, float h, float w, float sp, float seed) {
  float y = p.y / h;
  if (y > 1.45 || y < -0.3 || abs(p.x) > w * 2.6) return 0.0;
  float rise = smoothstep(0.0, 1.0, y);
  float2 q = float2(p.x * 2.6, p.y * 2.2 - t * 1.9 * sp);
  float wx = fbm(q + seed);
  float wy = fbm(q * 1.3 + float2(5.2, 1.3) + seed);
  float x = p.x + (wx - 0.5) * 0.9 * rise * w * (0.55 + energy * 0.7)
          + sin(t * 1.1 + seed + p.y * 2.5) * 0.04 * rise * energy;
  float py = p.y + (wy - 0.5) * 0.16 * rise;
  float yy = py / h;
  float width;
  if (yy < 0.0) {
    float b = yy / 0.17;
    width = w * sqrt(max(0.0, 1.0 - b * b));
  } else {
    float k = clamp(yy, 0.0, 1.0);
    width = w * pow(max(0.0, 1.0 - k), 0.85) * (1.0 + 0.45 * sin(min(k * 2.2, 3.14159)));
  }
  float body = 1.0 - abs(x) / max(width, 0.0005);
  float turb = fbm(float2(x * 8.0 + seed, py * 6.0 - t * 3.6 * sp));
  float lick = vnoise(float2(x * 14.0 + seed * 2.0, py * 3.0 - t * 4.5 * sp));
  float d = body * 1.35 - turb * 1.25 * smoothstep(0.0, 0.85, yy) - lick * 0.35 * rise - yy * 0.3;
  return clamp(d, 0.0, 1.0);
}

// Kıvılcım biçimi: 0 kor · 1 yıldız · 2 elmas · 3 kar tanesi. Değer = biçim mesafesi.
float sparkDist(float2 d) {
  float l = length(d);
  float a = atan(d.y, d.x);
  if (shape < 0.5) return l;
  if (shape < 1.5) return l / (0.62 + 0.38 * cos(5.0 * a));
  if (shape < 2.5) return abs(d.x) * 1.15 + abs(d.y) * 0.75;
  return l / (0.5 + 0.5 * pow(abs(cos(3.0 * a)), 7.0));
}

half4 main(float2 pos) {
  float H = box.y * growth;
  float2 c = float2(res.x * 0.5, res.y * 0.5 + box.y * 0.42);
  float2 p = float2(pos.x - c.x, c.y - pos.y) / H;
  float t = time;
  float s = stage;

  // ── gövde: katmanlar sıcaklığa dönüşür ─────────────────────────────────────
  float outer = tongue(p, t, 0.98, 0.3, 1.0, 0.0);
  float mid = s >= 2.0 ? tongue(p + float2(0.0, 0.02), t, 0.74, 0.21, 1.2, 3.7) : 0.0;
  float core = s >= 3.0 ? tongue(p + float2(0.0, 0.035), t, 0.48, 0.13, 1.45, 7.3) : 0.0;
  float flick = 1.0 + (vnoise(float2(t * 9.0, 2.0)) - 0.5) * 0.16 * energy;
  float temp = outer * 0.46 + mid * 0.3 + core * 0.38;
  if (s < 2.0) temp = outer * 0.55;
  else if (s < 3.0) temp = min(temp, 0.7);
  temp = clamp(temp * flick, 0.0, 1.0);
  float3 col = ramp(0.14 + temp * 0.86);
  if (rainbow > 0.5) {
    float3 rb = hue(fract(p.y * 0.55 - t * 0.12 + p.x * 0.3));
    col = mix(col, rb, 0.38 * (1.0 - smoothstep(0.35, 0.7, temp)));
  }
  // Kenarlar yarı saydam (gerçek alevin "is"siz yumuşak sınırı); uç daha da incelir.
  float alpha = smoothstep(0.0, 0.3, outer) * (1.0 - 0.2 * smoothstep(0.6, 1.15, p.y));
  float3 rgb = col * alpha;

  // ── efektler (toplanır) ────────────────────────────────────────────────────
  float3 fx = float3(0.0);
  float2 ce = float2(0.0, 0.42);
  float2 dc = p - ce;
  float r = length(float2(dc.x, dc.y * 0.92));
  if (effects > 0.5) {
    float pulse = 0.85 + 0.15 * sin(t * 2.6);
    fx += glowC * exp(-r * r * 9.0) * 0.32 * pulse * (0.55 + 0.08 * s) * dim;

    // taç: arkada büyük, yarı saydam ikinci alev + dönen yumuşak ışınlar
    if (s >= 6.0) {
      float back = tongue(float2(p.x / 1.3, (p.y - 0.03) / 1.32), t * 0.8, 0.98, 0.3, 0.9, 11.0);
      fx += glowC * smoothstep(0.0, 0.6, back) * (1.0 - alpha) * 0.24 * dim;
      float a = atan(dc.x, dc.y);
      float rays = pow(max(0.0, cos(a * 11.0 + t * 0.7 + vnoise(float2(a * 3.0, t)) * 1.5)), 14.0) + 0.6 * pow(max(0.0, cos(a * 7.0 - t * 0.5)), 26.0);
      fx += mix(glowC, emberC, 0.5) * rays * smoothstep(0.62, 0.36, r) * smoothstep(0.18, 0.34, r)
            * smoothstep(-0.55, 0.15, dc.y) * (0.12 + 0.08 * vnoise(float2(t * 3.0, 4.0))) * dim * detail;
    }

    // gökkuşağı halkası (52+ hafta)
    if (rainbow > 0.5) {
      float a2 = atan(dc.y, dc.x) / 6.28318 + t * 0.08;
      float e3 = (r - 0.6) * 42.0;
      fx += hue(fract(a2)) * exp(-e3 * e3) * 0.85 * dim;
    }

    // Arka efektler (ışık, taç, gökkuşağı halkası) alevin ARKASINDA: gövde onları örter.
    fx *= 1.0 - alpha;

    // kıvılcımlar: alevden kopup yükselir, salınır, küçülerek söner
    if (s >= 4.0) {
      for (int i = 0; i < 8; i++) {
        float fi = float(i);
        float on = step(fi + 0.5, sparkCount);
        float hs = hash(float2(fi, 3.1));
        float life = fract(t * (0.28 + hs * 0.22) + hs);
        float2 sp = float2((hs - 0.5) * 0.36 + sin(t * 1.7 + fi * 2.3) * 0.06 * life,
                           0.25 + life * 1.0);
        float2 d = (p - sp);
        float rad = 0.05 * (1.0 - life * 0.6);
        float a3 = t * (hs - 0.5) * 3.0;
        d = float2(d.x * cos(a3) - d.y * sin(a3), d.x * sin(a3) + d.y * cos(a3));
        float k2 = sparkDist(d);
        float fade = smoothstep(0.0, 0.1, life) * (1.0 - life);
        float spark = smoothstep(rad, rad * 0.3, k2) + exp(-dot(d, d) / (rad * rad * 7.0)) * 0.55;
        fx += emberC * spark * fade * on * 1.8 * dim;
      }
    }

    // uçuşan kıvılcımlar (ihtişam 5+): alevin çevresinde yükselen, girdap gibi
    // dönen, göz kırpar gibi parlayan minik parçacıklar. Dikey uzatılmış (hız izi).
    if (s >= 5.0) {
      for (int i = 0; i < 22; i++) {
        float fi = float(i);
        float h1 = hash(float2(fi, 17.3));
        float h2 = hash(float2(fi, 4.7));
        float life = fract(t * (0.16 + h1 * 0.2) + h2);
        float dir = h2 > 0.5 ? 1.0 : -1.0;
        float ang = t * (0.7 + h1) * dir + fi * 2.1;
        float swirl = (0.1 + 0.22 * h1) * (0.4 + life);
        float2 fp = float2((h2 - 0.5) * 0.56 + sin(ang) * swirl,
                           0.02 + life * 1.2 + cos(ang * 1.3) * 0.04);
        float2 d = p - fp;
        d.y *= 0.5;
        float sz = 0.014 * (1.0 - life * 0.45);
        float tw = 0.55 + 0.45 * sin(t * 11.0 + fi * 3.1);
        float fade = smoothstep(0.0, 0.12, life) * (1.0 - life);
        float dd = dot(d, d);
        float pt = exp(-dd / (sz * sz)) + exp(-dd / (sz * sz * 14.0)) * 0.3;
        fx += mix(emberC, float3(1.0, 0.96, 0.85), 0.45) * pt * fade * tw * 2.2 * dim;
      }
    }

    // yıldızlar: çevrede dört köşeli, yanıp sönen ışıltılar
    if (s >= 7.0) {
      for (int j = 0; j < 7; j++) {
        float fj = float(j);
        float an = fj * 0.8976 + 0.4 + t * 0.06;
        float rad2 = 0.5 + 0.12 * hash(float2(fj, 9.0));
        float2 d = dc - float2(cos(an), sin(an)) * rad2;
        float tw = pow(max(0.0, sin(t * 2.2 + fj * 1.9)), 5.0);
        float st = exp(-abs(d.x) * 120.0) * exp(-abs(d.y) * 16.0)
                 + exp(-abs(d.y) * 120.0) * exp(-abs(d.x) * 16.0)
                 + exp(-dot(d, d) * 900.0) * 0.6;
        fx += mix(float3(1.0), emberC, 0.35) * st * tw * 1.2 * dim;
      }
    }
  }

  // Önçarpımlı çıktı: kanal kanal kırpmak tonu kaydırır (turuncu → yeşilimsi saçak);
  // taşma varsa renk BÜTÜN olarak ölçeklenir, alfa en parlak kanala yükselir.
  float3 outc = rgb + fx;
  float m = max(outc.r, max(outc.g, outc.b));
  if (m > 1.0) outc /= m;
  float a = clamp(max(alpha, max(outc.r, max(outc.g, outc.b))), 0.0, 1.0);
  return half4(half3(outc), half(a));
}
`;

// Alev kutusu: genişlik = yükseklik × 0,78 (SVG çizimiyle aynı yerleşim).
export const FLAME_ASPECT = 100 / 128;

// Tuval / alev kutusu oranları: efektler (hale, kıvılcım, yıldız) kutunun dışına taşar.
export const FLAME_CANVAS = Object.freeze({ widthPerHeight: 1.6, heightPerHeight: 2.0 });

/** Alev kutusu (w × h) → tuvalin boyu ve kutuya göre kayması (pt). */
export function flameCanvasBox(width, height) {
  const w = Math.max(1, Math.round(Number(height) * FLAME_CANVAS.widthPerHeight));
  const h = Math.max(1, Math.round(Number(height) * FLAME_CANVAS.heightPerHeight));
  return { width: w, height: h, left: Math.round((Number(width) - w) / 2), top: Math.round((Number(height) - h) / 2) };
}

/** "#RRGGBB" → [r, g, b] (0..1). Bozuk girdi → beyaz. */
export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return [1, 1, 1];
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((v) => Math.round(v * 1000) / 1000);
}

const SHAPE_INDEX = Object.freeze({ ember: 0, star: 1, diamond: 2, flake: 3 });

/** Paletin 5 duraklı sıcaklık rampası: koyu dış → açık dış → orta → çekirdek → beyaz. */
export function flameRamp(palette) {
  const p = palette || {};
  const outer = p.outer || ["#FF3D00", "#FF8A00"];
  const mid = p.mid || ["#FF6D00", "#FFB300"];
  const core = p.core || ["#FFD54F", "#FFF8E1"];
  return [outer[0], outer[1], mid[1], core[0], core[1]].map(hexToRgb);
}

/**
 * streakLook() + boyut → shader uniform'ları (zaman hariç; o her karede eklenir).
 * `pixelRatio`: tuval fiziksel piksel çalışır; res/box piksel cinsinden verilir.
 */
export function flameUniforms(look, { width, height, pixelRatio = 1, dimmed = false } = {}) {
  const l = look || {};
  const stage = Math.max(1, Math.min(7, Math.floor(Number(l.stage) || Number(l.layers) || 3)));
  const paused = Boolean(l.paused);
  const effects = Array.isArray(l.effects) ? l.effects : [];
  const canvas = flameCanvasBox(width, height);
  const [c0, c1, c2, c3, c4] = flameRamp(l.palette);
  const heat = Number.isFinite(l.heat) ? l.heat : 1;
  return {
    res: [canvas.width * pixelRatio, canvas.height * pixelRatio],
    box: [Number(width) * pixelRatio, Number(height) * pixelRatio],
    stage,
    shape: SHAPE_INDEX[l.spark?.shape] ?? 0,
    energy: Math.round((dimmed && !paused ? 0.5 : 1) * heat * 1000) / 1000,
    growth: Number.isFinite(l.growth) ? l.growth : 1,
    effects: paused ? 0 : 1,
    rainbow: !paused && effects.includes("rainbow") ? 1 : 0,
    sparkCount: Math.max(0, Math.min(8, Math.floor(Number(l.spark?.count) || 3))),
    dim: dimmed ? 0.45 : 1,
    // Küçük boyda (profil satırı) taç ışınları hafif: alevin kendisi okunmalı.
    detail: Number(height) < 40 ? 0.55 : 1,
    c0, c1, c2, c3, c4,
    glowC: hexToRgb(l.palette?.glow || "#FF6D00"),
    emberC: hexToRgb(l.palette?.ember || "#FFB74D"),
  };
}

/** Mola alevi yavaş akar; risk/telafi daha durgun. Saniye başına shader zamanı. */
export const flameTimeScale = ({ paused = false, dimmed = false } = {}) => (paused ? 0.35 : dimmed ? 0.6 : 1);
