// Zevk uyumunun hesaplama kademelerinden bağımsız görsel "ısı" dili.
// 60 / 70 / 80 / 90 eşikleri yalnız sunumu güçlendirir; puanı veya tierOf sonucunu değiştirmez.

export const TASTE_HEAT_THRESHOLDS = Object.freeze([60, 70, 80, 90]);

const HEAT_LEVELS = Object.freeze([
  { min: 90, level: 4, accent: "#FF2448", colors: ["#FFB000", "#FF5A1F", "#E11D48"] },
  { min: 80, level: 3, accent: "#FF3D3D", colors: ["#FFC247", "#FF6B22", "#FF2448"] },
  { min: 70, level: 2, accent: "#FF6B2C", colors: ["#FFD166", "#FF8A24", "#FF4D35"] },
  { min: 60, level: 1, accent: "#F59E0B", colors: ["#FFE08A", "#FFAA2B", "#FF6B2C"] },
]);

export function tasteMatchHeat(score, fallback = "#E11D48") {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
  const heat = HEAT_LEVELS.find((entry) => safeScore >= entry.min);
  if (!heat) {
    return { score: safeScore, level: 0, accent: fallback, colors: [fallback, fallback] };
  }
  return { score: safeScore, level: heat.level, accent: heat.accent, colors: heat.colors };
}
