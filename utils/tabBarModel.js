// One icon family (Ionicons) across all four tabs, each with an
// outline/filled pair — softer, rounder strokes than the old mixed
// MaterialCommunityIcons/Ionicons set, and it mirrors the outline↔filled
// swap iOS already does natively via sf/selectedSf (see TabButton, which
// now does the same swap for the custom Android/fallback bar).
//
// FILM + DİZİ TEK SEKME: "discover" hem dizileri hem filmleri taşır; ekranın
// içindeki cam anahtar (components/home/MediaTypeSwitch.js) ikisi arasında geçirir.
// Eskiden iki ayrı sekme vardı ("tvshows", "movies"); alt çubuk beşten dörde indi.
//
// SOFT CORNERS: every glyph is picked for round silhouettes — no sprocket
// squares (film), dot grids (apps) or bare heads (person). Each Ionicons pair
// has an SF Symbol twin with the SAME silhouette, so the native iOS bar and
// the JS bar (Android glass / blur / solid) read as one icon set:
//   discover play-circle ↔ play.circle (film + dizi için ortak, yuvarlak "izle")
//   hub     grid      ↔ square.grid.2x2 (was apps: 3×3 dots, and a mismatch
//                                      with the 2×2 grid iOS already showed)
//   profile person-circle ↔ person.crop.circle (was a bare person)
//
// A wrong SF name renders a BLANK tab icon on iOS with no error, and a wrong
// Ionicons name renders a red warning glyph — __tests__/tabBarModel.test.js
// checks every name here against the real glyph maps.
export const TAB_DEFINITIONS = Object.freeze([
  { name: "discover", labelKey: "moviesAndTv", family: "Ionicons", icon: "play-circle", iconOutline: "play-circle-outline", sf: "play.circle", selectedSf: "play.circle.fill" },
  { name: "share", labelKey: "hub", family: "Ionicons", icon: "grid", iconOutline: "grid-outline", sf: "square.grid.2x2", selectedSf: "square.grid.2x2.fill" },
  { name: "settings", labelKey: "settings", family: "Ionicons", icon: "settings", iconOutline: "settings-outline", sf: "gearshape", selectedSf: "gearshape.fill" },
  { name: "profile", labelKey: "profile", family: "Ionicons", icon: "person-circle", iconOutline: "person-circle-outline", sf: "person.crop.circle", selectedSf: "person.crop.circle.fill" },
]);
export const TAB_NAMES = Object.freeze(TAB_DEFINITIONS.map(({ name }) => name));
export const isTabName = (name) => TAB_NAMES.includes(name);
export const initialTabName = (name) => isTabName(name) ? name : name === "debug" ? "settings" : "discover";

// Yapay zeka (CineMatch) bir SEKME DEĞİL, çubuğun yanındaki ayrık yuvarlak bir
// eylem düğmesi: dokununca sohbeti açar, hiçbir ekranı seçili yapmaz. Bu yüzden
// TAB_NAMES / TAB_DEFINITIONS'ta YOK (durum makinesi ona asla geçmez); iOS'ta yerel
// çubuğa yalnız bir `Tabs.Screen` anahtarı olarak, `preventNativeSelection` ile
// eklenir (components/navigation/AdaptiveTabShell.js).
//
// SF Symbol ve Ionicons adları ayrı ad alanları; ikisi de gerçek haritalara karşı
// __tests__/tabBarIcons.test.js'te denetlenir.
export const AI_ACTION = Object.freeze({
  key: "ai",
  family: "Ionicons",
  icon: "sparkles",
  sf: "sparkles",
});

export function createTabState(name) {
  const activeTab = initialTabName(name);
  return { activeTab, provenance: 0, mountedTabs: new Set(["discover", activeTab]) };
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
// Yapay zeka düğmesi de bu genişliğin İÇİNDE: çubuk + boşluk + düğme tek grup.
const BAR_MAX_WIDTH = 400;
// iOS 26'nın ayrık arama düğmesinin çubuktan uzaklığına yakın bir boşluk.
const AI_BUTTON_GAP = 10;
// Yerel iOS çubuğunda ayrık düğmenin kenar payı ve alt payı (UIKit çerçevesi
// okunamıyor, bunlar TAHMİN; yalnız sohbetin büyüyeceği noktayı belirler).
const NATIVE_AI_EDGE = 16;
const NATIVE_AI_BOTTOM = 8;

export function getTabBarLayout({ width, bottomInset = 0, mode }) {
  const height = 60;
  const padding = 6;
  const barRadius = height / 2;
  const indicatorHeight = height - padding * 2;
  // Yapay zeka düğmesi çubukla AYNI yükseklikte bir daire: aynı yatay hizada durur.
  const aiSize = height;
  const availableWidth = Math.min(width - BAR_SIDE_MARGIN * 2, BAR_MAX_WIDTH);
  // Slot width is derived from the near-full-width capsule (minus the AI
  // button), only clamped at the low end to keep icon touch targets
  // accessible (44pt minimum).
  const barRoom = availableWidth - aiSize - AI_BUTTON_GAP;
  const slotWidth = Math.max(44, Math.min(76, Math.floor((barRoom - padding * 2) / TAB_NAMES.length)));
  const barWidth = slotWidth * TAB_NAMES.length + padding * 2;
  const groupWidth = barWidth + AI_BUTTON_GAP + aiSize;
  const bottom = Math.max(16, bottomInset + 10);
  const indicatorWidth = slotWidth - 4;
  // Concentric nested border-radius: R_inner = R_outer - spacing
  const indicatorRadius = Math.max(0, barRadius - padding);
  return {
    width: barWidth, height, bottom, padding, slotWidth, indicatorSize: indicatorHeight,
    indicatorWidth, indicatorHeight, barRadius, indicatorRadius,
    aiSize, aiGap: AI_BUTTON_GAP, groupWidth,
    contentBottom: mode === "native-ios" ? bottomInset + 88 : bottom + height + 16,
  };
}

// Yapay zeka düğmesinin EKRAN merkezi — sohbet panelinin büyüyerek açıldığı nokta
// (components/modals/ChatModal.js `origin`). JS çubuğunda düğme konumu bilinir;
// yerel iOS çubuğunda UIKit çerçevesi okunamadığı için sağ alt köşeye yakın bir
// tahmin verilir (animasyonun başlangıç noktası, işlevi etkilemez).
export function getAiButtonCenter({ width, height, layout, mode, bottomInset = 0, rtl = false }) {
  const half = layout.aiSize / 2;
  if (mode === "native-ios") {
    const x = rtl ? NATIVE_AI_EDGE + half : width - NATIVE_AI_EDGE - half;
    return { x, y: height - bottomInset - NATIVE_AI_BOTTOM - half };
  }
  const trailingEdge = (width + layout.groupWidth) / 2;
  return {
    x: rtl ? width - trailingEdge + half : trailingEdge - half,
    y: height - layout.bottom - half,
  };
}
