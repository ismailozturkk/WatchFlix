import { isLightSurface, toHex } from "./colorUtils";

// Resolve the actual surface, including custom rgb/rgba themes. At this
// luminance light glass offers better contrast for the surface's dark text.
export function surfaceBlurAppearance(color) {
  const surface = toHex(color);
  const light = isLightSurface(surface);
  return {
    surface,
    tint: light ? "light" : "dark",
    intensity: light ? 45 : 50,
    overlayAlpha: light ? 0.38 : 0.28,
    fallbackAlpha: 0.9,
  };
}
