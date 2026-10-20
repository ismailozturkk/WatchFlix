// components/cineswipe/cineTheme.js
//
// CineSwipe renkleri tek yerden. Eski kod `#64FF64` / `#FF3232` gibi sabit
// neonlar kullanıyordu; açık temada okunmuyordu. Beğen/pas artık temanın
// semantik yeşil/kırmızısından (`theme.colors`) gelir, tema değişince uyum sağlar.
//
// Poster ÜSTÜNDEKİ öğeler (kart bilgileri, rozetler) bilerek beyaz-üstü-koyu
// kalır: zemin tema değil fotoğraftır.

export function cineColors(theme) {
  return {
    background: theme?.primary || "#141414",
    surface: theme?.secondary || "#2C2C2E",
    between: theme?.between || "#202024",
    border: theme?.border || "rgba(255,255,255,0.12)",
    text: theme?.text?.primary || "#FFFFFF",
    textSecondary: theme?.text?.secondary || "#A0A0A8",
    muted: theme?.text?.muted || "#7C7C84",
    accent: theme?.accent || "#138DF0",
    like: theme?.colors?.green || "#22C55E",
    pass: theme?.colors?.red || "#EF4444",
    // Beğeni sepeti / kalp: marka rengi, temadan bağımsız.
    heart: "#FF3B5C",
    gold: "#FFC83D",
    onAccent: "#FFFFFF",
  };
}

// Poster üstü sabit renkler.
export const ON_POSTER = {
  text: "#FFFFFF",
  textSoft: "rgba(255,255,255,0.88)",
  textMuted: "rgba(255,255,255,0.62)",
  chip: "rgba(0,0,0,0.5)",
  chipBorder: "rgba(255,255,255,0.16)",
  gold: "#FFC83D",
};
