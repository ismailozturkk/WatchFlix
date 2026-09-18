// One icon family (Ionicons) across all five tabs, each with an
// outline/filled pair — softer, rounder strokes than the old mixed
// MaterialCommunityIcons/Ionicons set, and it mirrors the outline↔filled
// swap iOS already does natively via sf/selectedSf (see TabButton, which
// now does the same swap for the custom Android/fallback bar).
export const TAB_DEFINITIONS = Object.freeze([
  { name: "tvshows", labelKey: "tvShows", family: "Ionicons", icon: "tv", iconOutline: "tv-outline", sf: "tv", selectedSf: "tv.fill" },
  { name: "movies", labelKey: "movies", family: "Ionicons", icon: "film", iconOutline: "film-outline", sf: "film", selectedSf: "film.fill" },
  { name: "share", labelKey: "hub", family: "Ionicons", icon: "apps", iconOutline: "apps-outline", sf: "square.grid.2x2", selectedSf: "square.grid.2x2.fill" },
  { name: "settings", labelKey: "settings", family: "Ionicons", icon: "settings", iconOutline: "settings-outline", sf: "gearshape", selectedSf: "gearshape.fill" },
  { name: "profile", labelKey: "profile", family: "Ionicons", icon: "person", iconOutline: "person-outline", sf: "person", selectedSf: "person.fill" },
]);
export const TAB_NAMES = Object.freeze(TAB_DEFINITIONS.map(({ name }) => name));
export const isTabName = (name) => TAB_NAMES.includes(name);
export const initialTabName = (name) => isTabName(name) ? name : name === "debug" ? "settings" : "tvshows";

export function createTabState(name) {
  const activeTab = initialTabName(name);
  return { activeTab, provenance: 0, mountedTabs: new Set(["tvshows", activeTab]) };
}

// Native acknowledgements can arrive after a newer JS selection. An acknowledgement
// updates the native sequence only; it must never undo that newer request.
export function tabStateReducer(state, action) {
  if (action.type === "native") {
    const event = action.event || {};
    if (!isTabName(event.selectedScreenKey) || !Number.isFinite(event.provenance) || event.provenance < state.provenance) return state;
    const activeTab = event.actionOrigin === "programmatic-js" && !action.rejected
      ? state.activeTab : event.selectedScreenKey;
    if (activeTab === state.activeTab && event.provenance === state.provenance) return state;
    return { activeTab, provenance: event.provenance, mountedTabs: new Set(state.mountedTabs).add(activeTab) };
  }
  if (!isTabName(action.name)) return state;
  if (action.type === "warm") {
    return state.mountedTabs.has(action.name) ? state : { ...state, mountedTabs: new Set(state.mountedTabs).add(action.name) };
  }
  if (action.type === "select") {
    return state.activeTab === action.name ? state : { ...state, activeTab: action.name, mountedTabs: new Set(state.mountedTabs).add(action.name) };
  }
  return state;
}

// Reference proportions: iOS 26 "Liquid Glass" tab bars (Instagram, App
// Store) float a capsule that spans nearly the full screen width — a small
// fixed side margin, not a narrow bar with big gutters either side.
const BAR_SIDE_MARGIN = 32;
// Cap so the bar doesn't stretch into an absurdly wide capsule on tablets.
const BAR_MAX_WIDTH = 400;

export function getTabBarLayout({ width, bottomInset = 0, mode, rtl = false }) {
  const height = 60;
  const padding = 6;
  const barRadius = height / 2;
  const indicatorHeight = height - padding * 2;
  const availableWidth = Math.min(width - BAR_SIDE_MARGIN * 2, BAR_MAX_WIDTH);
  // Slot width is derived from the near-full-width capsule, only clamped at
  // the low end to keep icon touch targets accessible (44pt minimum).
  const slotWidth = Math.max(44, Math.min(76, Math.floor((availableWidth - padding * 2) / TAB_NAMES.length)));
  const barWidth = Math.min(availableWidth, slotWidth * TAB_NAMES.length + padding * 2);
  const bottom = Math.max(16, bottomInset + 10);
  const indicatorWidth = slotWidth - 4;
  // Concentric nested border-radius: R_inner = R_outer - spacing
  const indicatorRadius = Math.max(0, barRadius - padding);
  const profileIndex = TAB_NAMES.indexOf("profile");
  const visualProfileIndex = rtl ? TAB_NAMES.length - 1 - profileIndex : profileIndex;
  const profileCenter = (width - barWidth) / 2 + padding + (visualProfileIndex + 0.5) * slotWidth;
  return {
    width: barWidth, height, bottom, padding, slotWidth, indicatorSize: indicatorHeight,
    indicatorWidth, indicatorHeight, barRadius, indicatorRadius,
    contentBottom: mode === "native-ios" ? bottomInset + 88 : bottom + height + 16,
    // Native tab item frames aren't exposed; use a safe screen-edge position.
    fabRight: mode === "native-ios" ? 12 : Math.max(4, width - profileCenter - indicatorHeight / 2 - 20 - 22),
    fabBottom: mode === "native-ios" ? bottomInset + 84 : bottom + height - 22 - padding + 18,
  };
}
