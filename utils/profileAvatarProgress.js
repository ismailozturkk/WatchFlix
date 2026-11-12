// Both profile headers use the same combined film + TV minute milestone.
import { i18nText } from "./i18nText";

const MINUTES_PER_LEVEL = 10080;
const PALETTE = [
  [210, 68, 56], [152, 55, 45], [265, 60, 60], [188, 62, 45],
  [340, 65, 58], [32, 82, 55], [48, 86, 52], [285, 52, 55],
  [168, 58, 40], [8, 68, 55], [225, 58, 52], [130, 42, 42],
];

export function profileAvatarProgress(minutes) {
  const total = Number.isFinite(Number(minutes)) ? Math.max(0, Number(minutes)) : 0;
  const level = Math.floor(total / MINUTES_PER_LEVEL);
  const cycle = Math.floor(level / PALETTE.length);
  const [baseHue, baseSat, baseLight] = PALETTE[level % PALETTE.length];
  const hue = (baseHue + cycle * 11 + 360) % 360;
  const sat = Math.min(92, baseSat + cycle * 3);
  const light = Math.max(30, baseLight - cycle * 4);
  return {
    borderColor: `hsl(${hue}, ${sat}%, ${light}%)`,
    borderColor2: `hsl(${hue}, ${Math.min(96, sat + 14)}%, ${Math.min(72, light + 16)}%)`,
    shadowColor: `hsla(${hue}, ${Math.max(35, sat - 10)}%, ${Math.max(22, light - 18)}%, 0.9)`,
    rankLevel: level,
    rankName: i18nText("autoI18n.hafta_sayisi", `${level} hafta`, { count: level }),
    progress: Math.min(99, Math.floor(((total % MINUTES_PER_LEVEL) / MINUTES_PER_LEVEL) * 100)),
  };
}
