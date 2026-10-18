// components/toast/toastPalette.js
//
// Toast türü → renkler. Saf (React/RN yok) → düğüm ortamında test edilir.
//
// Renk kuralı: ikon rozetinin gövdesi `main → deep` geçişidir ve üstündeki glif BEYAZDIR
// (vurgu üstü yazı beyaz kuralı); açık pastel (`soft`) yalnızca ışıma/parlama içindir,
// beyaz glifin altına konmaz (eski kartta `soft → main` geçişi açık temada ve sarıda
// beyaz ikonu soldururdu). Kart yüzeyi ve metin renkleri TEMADAN gelir; tür yalnızca
// çerçeveye, hafif renk yıkamasına, ilerleme çubuğuna ve ikon rozetine renk verir.

import { alpha } from "../../theme/colors";

const KIND_COLORS = Object.freeze({
  success: { main: "#22C55E", deep: "#15803D", soft: "#86EFAC" },
  error: { main: "#EF4444", deep: "#B91C1C", soft: "#FCA5A5" },
  warning: { main: "#F59E0B", deep: "#C2410C", soft: "#FCD34D" },
  info: { main: "#3B82F6", deep: "#1D4ED8", soft: "#93C5FD" },
  // Premium: altın → mor. `alt` ikinci ışık/yıkama rengi.
  premium: { main: "#F5B301", deep: "#B45309", soft: "#FDE68A", alt: "#8B5CF6" },
});

const FALLBACK_ACCENT = "#6D5DFB";

/**
 * @param {string} kind  success | error | warning | info | loading | premium (badge kartı kendi rengini getirir)
 * @param {object} theme ThemeContext teması (accent, bold okunur)
 * @returns {{ main:string, deep:string, soft:string, alt:string, border:string,
 *             washFrom:string, washTo:string, trackColor:string, orb:string[] }}
 */
export function paletteFor(kind, theme) {
  let base = KIND_COLORS[kind];
  if (!base) {
    // Yükleniyor ve bilinmeyenler: uygulamanın vurgu rengi.
    const accent = theme?.accent || FALLBACK_ACCENT;
    base = { main: accent, deep: theme?.bold || accent, soft: accent };
  }
  const alt = base.alt || base.main;
  return {
    main: base.main,
    deep: base.deep,
    soft: base.soft,
    alt,
    border: alpha(base.main, kind === "premium" ? 0.55 : 0.32),
    washFrom: alpha(base.main, kind === "premium" ? 0.22 : 0.15),
    washTo: alpha(alt, kind === "premium" ? 0.1 : 0),
    trackColor: alpha(base.main, 0.14),
    orb: [base.main, base.deep],
  };
}

/** Rozet kartı için: verilen tek vurgu renginden aynı biçimde palet. */
export function paletteFromAccent(accent) {
  return {
    main: accent,
    deep: accent,
    soft: accent,
    alt: accent,
    border: alpha(accent, 0.38),
    washFrom: alpha(accent, 0.2),
    washTo: alpha(accent, 0),
    trackColor: alpha(accent, 0.14),
    orb: [accent, accent],
  };
}
