// components/decor/universeKit.js
//
// Evren sahnelerinin (12 Kas ikinci paket: Jurassic Park, Avatar, Mad Max, Karayip Korsanları,
// Inception, Titanic, Dark, Squid Game, Hunter x Hunter, Jujutsu Kaisen) ortak vektör yardımcıları.
// seasonKit'teki temel araçların (hash, Glow, ridgePath…) üstüne: yaprak bıçağı, palmiye, alev,
// yıldız alanı, yelken/dalga gibi tekrar eden biçimler.

import { Skia } from "@shopify/react-native-skia";
import { hash } from "./seasonKit";

/** Sivri yaprak bıçağı: (x0,y0) → (x1,y1); bend kavis (dp), w yarı genişlik. */
export function addBlade(q, x0, y0, x1, y1, bend, w) {
  "worklet";
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  q.moveTo(x0, y0);
  q.quadTo(mx + nx * (bend + w), my + ny * (bend + w), x1, y1);
  q.quadTo(mx + nx * (bend - w), my + ny * (bend - w), x0, y0);
  q.close();
}

/**
 * Palmiye: kavisli gövde (trunk) + sarkan yapraklar (fronds). lean −1…1 eğim; h yükseklik.
 * Döndürür: tepe noktası [x, y].
 */
export function addPalm(trunk, fronds, x, base, h, lean, seed, k) {
  const tx = x + lean * h * 0.35;
  const ty = base - h;
  const w = 5 * k + h * 0.025;
  trunk.moveTo(x - w, base);
  trunk.quadTo(x + lean * h * 0.05 - w * 0.6, base - h * 0.55, tx - w * 0.45, ty);
  trunk.lineTo(tx + w * 0.45, ty);
  trunk.quadTo(x + lean * h * 0.05 + w * 0.6, base - h * 0.55, x + w, base);
  trunk.close();
  const n = 7;
  for (let i = 0; i < n; i += 1) {
    const a = -Math.PI + (i / (n - 1)) * Math.PI + (hash(seed, i) - 0.5) * 0.3;
    const len = h * (0.36 + hash(seed + 3, i) * 0.14);
    const ex = tx + Math.cos(a) * len;
    const ey = ty + Math.sin(a) * len * 0.5 + len * 0.42;
    addBlade(fronds, tx, ty, ex, ey, -len * 0.22 * (Math.cos(a) < 0 ? -1 : 1), len * 0.07);
  }
  return [tx, ty];
}

/** Titrek alev (damla biçimi); t saat, seed faz. Tabanı (x, y). */
export function addFlame(q, x, y, w, h, t, seed) {
  "worklet";
  const f = 0.82 + 0.18 * Math.sin(t * 9.3 + seed * 2.1) * Math.sin(t * 5.7 + seed);
  const sway = Math.sin(t * 6.1 + seed * 1.7) * w * 0.35;
  const top = y - h * f;
  q.moveTo(x - w / 2, y);
  q.quadTo(x - w * 0.62, y - h * 0.45, x + sway, top);
  q.quadTo(x + w * 0.62, y - h * 0.45, x + w / 2, y);
  q.quadTo(x, y + w * 0.35, x - w / 2, y);
  q.close();
}

/** Durağan yıldız alanı: yalnız [top, bottom) bandında, küçük daireler. */
export function addStars(q, width, top, bottom, n, seed, k) {
  for (let i = 0; i < n; i += 1) {
    const x = hash(i, seed) * width;
    const y = top + Math.pow(hash(i, seed + 1), 1.4) * (bottom - top);
    q.addCircle(x, y, (0.5 + hash(i, seed + 2) * 1.1) * k);
  }
}

/** Yumuşak dalga şeridi (deniz yüzeyi): y çevresinde amp genlikli, altı bottom'a kapanır. */
export function wavePath(width, y, amp, len, phase, bottom) {
  "worklet";
  const q = Skia.Path.Make();
  q.moveTo(-10, bottom);
  q.lineTo(-10, y);
  const steps = Math.ceil((width + 20) / (len / 2));
  for (let i = 0; i < steps; i += 1) {
    const x0 = -10 + (i * len) / 2;
    const dir = i % 2 === 0 ? -1 : 1;
    q.quadTo(x0 + len / 4, y + dir * amp + Math.sin(phase + i) * amp * 0.2, x0 + len / 2, y);
  }
  q.lineTo(width + 10, bottom);
  q.close();
  return q;
}
