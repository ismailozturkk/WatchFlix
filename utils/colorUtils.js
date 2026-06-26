// utils/colorUtils.js
//
// Renk dönüşüm yardımcıları (özel tema oluşturucu için). Saf fonksiyonlardir;
// React/Native bagimliligi yoktur. hex <-> rgb <-> hsl donusumleri, css renk
// stringlerini hex'e normalize etme ve okunabilir metin rengi hesaplama.

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/** "#abc" / "#aabbcc" / "aabbcc" -> "#AABBCC"; gecersizse null. */
export function normalizeHex(input) {
  if (typeof input !== "string") return null;
  let h = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split("").map((c) => c + c).join("");
  if (/^[0-9a-fA-F]{6}$/.test(h)) return "#" + h.toUpperCase();
  return null;
}

export function rgbToHex(r, g, b) {
  const to = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
  return ("#" + to(r) + to(g) + to(b)).toUpperCase();
}

export function hexToRgb(hex) {
  const h = normalizeHex(hex) || "#000000";
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  };
}

/** Her tur css rengi ("#rgb", "#rrggbb", "rgb(...)", "rgba(...)") -> "#RRGGBB" (alfa atilir). */
export function toHex(color) {
  if (typeof color !== "string") return "#000000";
  const hex = normalizeHex(color);
  if (hex) return hex;
  const match = color.match(/rgba?\(([^)]+)\)/i);
  if (match) {
    const [r, g, b] = match[1].split(",").map((s) => parseFloat(s.trim()));
    return rgbToHex(r || 0, g || 0, b || 0);
  }
  return "#000000";
}

/** hex -> { h: 0-360, s: 0-100, l: 0-100 } */
export function hexToHsl(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rr: h = (gg - bb) / d + (gg < bb ? 6 : 0); break;
      case gg: h = (bb - rr) / d + 2; break;
      default: h = (rr - gg) / d + 4;
    }
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** { h, s, l } -> "#RRGGBB" */
export function hslToHex(h, s, l) {
  const hh = ((h % 360) + 360) % 360;
  const ss = clamp(s, 0, 100) / 100;
  const ll = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  let rr = 0;
  let gg = 0;
  let bb = 0;
  if (hh < 60) { rr = c; gg = x; }
  else if (hh < 120) { rr = x; gg = c; }
  else if (hh < 180) { gg = c; bb = x; }
  else if (hh < 240) { gg = x; bb = c; }
  else if (hh < 300) { rr = x; bb = c; }
  else { rr = c; bb = x; }
  return rgbToHex((rr + m) * 255, (gg + m) * 255, (bb + m) * 255);
}

/** Relatif parlaklik (WCAG). */
export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const a = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

/** Verilen arka plan uzerinde okunur metin rengi (siyah/beyaz). */
export function readableTextOn(hex) {
  return luminance(hex) > 0.5 ? "#000000" : "#FFFFFF";
}
