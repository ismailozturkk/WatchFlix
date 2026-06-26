// theme/gameTokens.js
//
// Oyun (Sahne Tahmin ve sonrasi) icin "game.*" token namespace'i (Part 20.1).
// Bu tokenlar YENI hex degerleri TANITMAZ; mevcut tema sisteminden (theme/colors.js)
// turetilir. Boylece oyun ekranlari kullanicinin secili temasiyla (yerlesik veya
// ozel tema) uyumlu kalir ve her ekranda ayri sabit renk tanimlanmaz.
//
// Kullanim:
//   const { theme } = useTheme();
//   const game = buildGameTokens(theme);
//   <View style={{ backgroundColor: game.surface }} />

import { alpha } from "./colors";

// Semantik renkler (dogru/yanlis/uyari/altin) cogu temada ayni kalmalidir;
// bunlar tema SHARED_COLORS setiyle hizalanir (theme.colors.green/red/yellow)
// — boylece "ozel tema" da bu degerleri tema olusturucudan etkileyebilir
// (su an icin sabit semantik renkler, gelecekte ozel tema genisletilebilir).
const GOLD = "#FFD700";

/**
 * Aktif temadan (yerlesik veya ozel) oyun token setini uretir.
 * @param {object} theme - useTheme().theme
 * @returns {object} game.* token haritasi
 */
export function buildGameTokens(theme) {
  if (!theme) return null;

  return {
    // ── Yuzeyler: tema yuzeylerinden birebir ───────────────────────────────
    background: theme.primary,
    surface: theme.secondary,
    surfaceElevated: theme.between || theme.secondary,

    // ── Vurgu: tema accent/bold'undan ───────────────────────────────────────
    accent: theme.accent,
    accentSecondary: theme.bold || theme.accent,

    // ── Semantik durum renkleri: tema'nin paylasilan renk setinden ─────────
    correct: theme.colors?.green || "#2ECC71",
    incorrect: theme.colors?.red || "#E74C3C",
    warning: theme.colors?.orange || "#F1C40F",
    gold: GOLD,

    // ── Overlay: tema shadow'undan (zaten alpha-black) ──────────────────────
    overlay: theme.shadow || alpha("#000000", 0.6),

    // ── Border (kartlar, ayirici cizgiler) ──────────────────────────────────
    border: theme.border,

    // ── Yaricap olcegi (Part 20.1) ───────────────────────────────────────────
    radiusSmall: 10,
    radiusMedium: 16,
    radiusLarge: 24,

    // ── Spacing olcegi (4px taban, Part 20.1) ────────────────────────────────
    spacing1: 4,
    spacing2: 8,
    spacing3: 12,
    spacing4: 16,
    spacing5: 20,
    spacing6: 24,
  };
}
