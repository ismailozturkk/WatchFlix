// Bölüm puanı → renk katmanı.
// TvGraphDetailScreen ızgarası ile story "Bölüm Graph" bloğu ortak kullanır.
export const RATING_TIERS = [
  { min: 9, bg: "rgb(0, 88, 74)", text: "#fff" },
  { min: 8, bg: "rgb(41, 184, 100)", text: "#000" },
  { min: 7, bg: "rgba(119, 255, 171, 1)", text: "#000" },
  { min: 6, bg: "rgb(255, 255, 0)", text: "#000" },
  { min: 5, bg: "rgb(255, 100, 0)", text: "#000" },
  { min: 4, bg: "rgb(255, 0, 0)", text: "#fff" },
  { min: -Infinity, bg: "rgb(99, 0, 204)", text: "#fff" },
];

export const getRatingColors = (rating) => {
  const tier =
    RATING_TIERS.find((t) => rating >= t.min) ??
    RATING_TIERS[RATING_TIERS.length - 1];
  return { bg: tier.bg, text: tier.text };
};
