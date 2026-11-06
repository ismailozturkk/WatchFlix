// utils/hapticPatterns.js
//
// TİTREŞİM DESEN KATALOĞU — saf modül (RN/expo yok, testte doğrudan çalışır).
//
// Çağrı yeri NE OLDUĞUNU söyler ("like", "wrong", "dragStart"); NASIL titreşeceğine
// burası + kullanıcı tercihleri karar verir. Böylece "titreşim çok/az" tartışması
// 100+ dosyaya dağılmaz (bkz. services/hapticsService.js başlığı).
//
// ── Üç ayar ekseni ───────────────────────────────────────────────────────────
//   düzey (level)      minimal · balanced · rich     → HANGİ anlar titreşir
//   güç (intensity)    soft · normal · strong         → NE KADAR sert titreşir
//   kategori           6 anahtar                      → HANGİ alanlar titreşir
//
// Her desenin bir kategorisi ve bir en düşük düzeyi (`level`) vardır. "minimal"
// eski "az olsun" politikasının birebir aynısıdır: yalnız baskı, sonuç ve kutlama.
//
// ── Atomlar ve platformlar ───────────────────────────────────────────────────
// Desen = zamanlanmış atomlar dizisi. Atom platformdan bağımsız bir "his" adıdır;
// `resolvePattern` onu platformun gerçek çağrısına çevirir:
//
//   iOS      UISelection / UIImpact(light|soft|medium|rigid|heavy) / UINotification.
//            iOS'un genlik ayarı yok (expo-haptics `intensity` vermiyor); güç,
//            darbe STİLİ kaydırılarak verilir (strong: light→medium, medium→heavy).
//   Android  normal/soft: `View.performHapticFeedback` sabitleri (cihazın kendi
//            ayarlı efektleri; sistemin "dokunma geri bildirimi" ayarına uyar).
//            Sabit bu API düzeyinde yoksa ZİNCİRDEKİ bir sonrakine düşülür; zincir
//            hep eski API'lerde de var olan bir sabitle biter (clock-tick, virtual-key,
//            long-press, context-click). Tik/dokunuş atomları ASLA eski `Vibrator`
//            dalga formuna düşmez — 15 Eki'deki "zırlama"nın kaynağı oydu.
//            strong: desenin TAMAMI tek bir `Vibration.vibrate([...])` dalga formu
//            olur (varsayılan genlik = cihazın tam gücü; zamanlama native, kaymaz).

export const HAPTIC_LEVELS = Object.freeze(["minimal", "balanced", "rich"]);
export const HAPTIC_INTENSITIES = Object.freeze(["soft", "normal", "strong"]);
export const HAPTIC_CATEGORIES = Object.freeze([
  "navigation",
  "gestures",
  "feedback",
  "games",
  "social",
  "celebrations",
]);

export const DEFAULT_HAPTIC_LEVEL = "balanced";
export const DEFAULT_HAPTIC_INTENSITY = "normal";

const LEVEL_RANK = Object.freeze({ minimal: 0, balanced: 1, rich: 2 });

export const isHapticLevel = (value) => HAPTIC_LEVELS.includes(value);
export const isHapticIntensity = (value) => HAPTIC_INTENSITIES.includes(value);

/** Kayıtlı kategori haritası doğrulayıcısı (registry `validate`). */
export const isHapticCategoryMap = (value) =>
  !!value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.entries(value).every(
    ([key, on]) => HAPTIC_CATEGORIES.includes(key) && typeof on === "boolean",
  );

/** Eksik/bozuk kategori haritasını "hepsi açık" üzerine bindirir. */
export function normalizeCategories(value) {
  const out = {};
  for (const id of HAPTIC_CATEGORIES) out[id] = true;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const id of HAPTIC_CATEGORIES) {
      if (typeof value[id] === "boolean") out[id] = value[id];
    }
  }
  return out;
}

// ── Atomlar ──────────────────────────────────────────────────────────────────
//
// ios: [tür, stil]   android: performHapticFeedback zinciri   ms: strong dalga süresi
//
// Android sabitlerinin Android 12+ karşılıkları (hafiften ağıra):
//   clock-tick / segment-frequent-tick → TEXTURE_TICK   (en ince)
//   context-click / gesture-end        → EFFECT_TICK
//   virtual-key / keyboard-tap         → EFFECT_CLICK
//   long-press / drag-start            → EFFECT_HEAVY_CLICK
//   confirm (API 30+) / reject (API 30+, çift vuruş), toggle-*/segment-tick (API 34+)
//
// `light: true` → zincir biterse SESSİZ kal (eski `Vibrator` dalga formuna düşme).
// Diğerleri zincir biterse expo'nun klasik yoluna düşer (impact/notification).

export const HAPTIC_ATOMS = Object.freeze({
  tick: { ios: ["selection"], android: ["segment-tick", "clock-tick"], ms: 8, light: true },
  tap: { ios: ["impact", "light"], android: ["context-click"], ms: 12, light: true },
  soft: { ios: ["impact", "soft"], android: ["gesture-end", "context-click"], ms: 10, light: true },
  click: { ios: ["impact", "medium"], android: ["virtual-key"], ms: 18 },
  press: { ios: ["impact", "medium"], android: ["long-press"], ms: 20 },
  rigid: { ios: ["impact", "rigid"], android: ["keyboard-tap", "virtual-key"], ms: 14 },
  thud: { ios: ["impact", "heavy"], android: ["long-press"], ms: 32 },
  toggleOn: { ios: ["impact", "medium"], android: ["toggle-on", "virtual-key"], ms: 16 },
  toggleOff: { ios: ["impact", "soft"], android: ["toggle-off", "context-click"], ms: 12 },
  dragStart: { ios: ["impact", "medium"], android: ["drag-start", "long-press"], ms: 22 },
  gestureEnd: { ios: ["impact", "rigid"], android: ["gesture-end", "virtual-key"], ms: 14 },
  success: { ios: ["notification", "success"], android: ["confirm"], ms: [22, 70, 30] },
  warning: { ios: ["notification", "warning"], android: ["long-press"], ms: [26, 110, 26] },
  error: { ios: ["notification", "error"], android: ["reject"], ms: [30, 80, 24, 70, 30] },
});

// Güç kademesine göre iOS darbe stili kaydırması.
const IOS_IMPACT_SHIFT = Object.freeze({
  soft: { light: "soft", soft: "soft", medium: "light", rigid: "light", heavy: "medium" },
  normal: {},
  strong: { light: "medium", soft: "light", medium: "heavy", rigid: "heavy", heavy: "heavy" },
});

// "soft" güçte Android zinciri bir kademe hafifler (normal = atomun kendi zinciri).
const ANDROID_SOFT_SWAP = Object.freeze({
  tick: ["segment-frequent-tick", "clock-tick"],
  tap: ["clock-tick"],
  soft: ["clock-tick"],
  click: ["context-click"],
  press: ["virtual-key"],
  rigid: ["context-click"],
  thud: ["virtual-key"],
  toggleOn: ["toggle-on", "context-click"],
  toggleOff: ["toggle-off", "clock-tick"],
  dragStart: ["drag-start", "virtual-key"],
  gestureEnd: ["gesture-end", "context-click"],
});

// ── Desenler ─────────────────────────────────────────────────────────────────
//
// steps: [atom, başlangıçtan ms]   priority: çakışmada kim kazanır (1 tik … 5 kutlama)
// level: en düşük düzey            gap: aynı/düşük öncelikli yenisi için en kısa ara (ms)

const P = (category, level, priority, steps, gap) => ({ category, level, priority, steps, gap });

export const HAPTIC_PATTERNS = Object.freeze({
  // Gezinme ve seçim
  select: P("navigation", "balanced", 1, [["tick", 0]], 45),
  tabSwitch: P("navigation", "balanced", 1, [["tap", 0]], 60),
  toggleOn: P("navigation", "balanced", 2, [["toggleOn", 0]], 80),
  toggleOff: P("navigation", "balanced", 2, [["toggleOff", 0]], 80),
  sliderTick: P("navigation", "balanced", 1, [["tick", 0]], 30),
  sliderEdge: P("navigation", "balanced", 2, [["rigid", 0]], 120),
  tap: P("navigation", "rich", 1, [["tap", 0]], 50),
  sheetOpen: P("navigation", "rich", 1, [["soft", 0]], 120),
  sheetSnap: P("navigation", "rich", 1, [["soft", 0]], 120),

  // Hareketler
  press: P("gestures", "minimal", 3, [["press", 0]], 300),
  pressHeavy: P("gestures", "minimal", 3, [["thud", 0]], 300),
  longPress: P("gestures", "minimal", 3, [["press", 0]], 300),
  dragStart: P("gestures", "balanced", 2, [["dragStart", 0]], 120),
  dragOver: P("gestures", "balanced", 1, [["tick", 0]], 40),
  drop: P("gestures", "balanced", 2, [["gestureEnd", 0]], 120),
  swipeThreshold: P("gestures", "balanced", 2, [["rigid", 0]], 150),
  swipeCancel: P("gestures", "rich", 1, [["soft", 0]], 120),
  refresh: P("gestures", "balanced", 2, [["gestureEnd", 0]], 400),
  holdTick: P("gestures", "balanced", 1, [["tick", 0]], 40),

  // İşlem sonuçları
  success: P("feedback", "minimal", 3, [["success", 0]], 300),
  warning: P("feedback", "minimal", 3, [["warning", 0]], 300),
  error: P("feedback", "minimal", 4, [["error", 0]], 300),
  added: P("feedback", "minimal", 3, [["click", 0], ["tap", 70]], 300),
  removed: P("feedback", "balanced", 2, [["tap", 0], ["soft", 60]], 250),
  delete: P("feedback", "minimal", 3, [["rigid", 0], ["thud", 80]], 300),
  copy: P("feedback", "balanced", 2, [["tick", 0], ["tick", 60]], 200),

  // Oyunlar
  correct: P("games", "minimal", 3, [["click", 0], ["success", 70]], 300),
  wrong: P("games", "minimal", 4, [["error", 0]], 300),
  countdown: P("games", "balanced", 2, [["rigid", 0]], 300),
  timeUp: P("games", "minimal", 4, [["thud", 0], ["thud", 150]], 400),
  combo: P("games", "balanced", 2, [["tap", 0], ["tap", 60], ["click", 120]], 250),
  win: P("games", "minimal", 5, [["tap", 0], ["click", 90], ["thud", 190], ["success", 330]], 600),
  lose: P("games", "minimal", 4, [["click", 0], ["soft", 140], ["soft", 280]], 500),

  // Sohbet ve sosyal
  send: P("social", "balanced", 2, [["soft", 0], ["rigid", 55]], 150),
  receive: P("social", "balanced", 1, [["tick", 0], ["tick", 90]], 600),
  like: P("social", "balanced", 2, [["tap", 0], ["click", 90]], 200),
  unlike: P("social", "rich", 1, [["soft", 0]], 150),
  reaction: P("social", "balanced", 2, [["tap", 0], ["tap", 70]], 200),
  friend: P("social", "minimal", 3, [["success", 0]], 300),

  // Kutlamalar
  celebrate: P("celebrations", "minimal", 5, [["tap", 0], ["click", 90], ["thud", 190], ["success", 330]], 700),
  badge: P("celebrations", "minimal", 5, [["click", 0], ["thud", 110], ["success", 260]], 700),
  streak: P("celebrations", "minimal", 5, [["tap", 0], ["tap", 80], ["click", 160], ["click", 240], ["thud", 320]], 700),
  goal: P("celebrations", "minimal", 5, [["success", 0], ["thud", 230]], 700),
  match: P("celebrations", "minimal", 5, [["thud", 0], ["tap", 120], ["thud", 240], ["success", 400]], 800),
});

export const HAPTIC_PATTERN_NAMES = Object.freeze(Object.keys(HAPTIC_PATTERNS));

/** Ayarlar ekranındaki "dene" listesi: kategori başına örnek desenler. */
export const HAPTIC_SAMPLES = Object.freeze({
  navigation: ["select", "tabSwitch", "toggleOn", "sliderTick"],
  gestures: ["longPress", "dragStart", "drop", "swipeThreshold"],
  feedback: ["success", "added", "delete", "warning", "error"],
  games: ["correct", "wrong", "countdown", "win"],
  social: ["send", "receive", "like", "reaction"],
  celebrations: ["badge", "streak", "goal", "match"],
});

/** Desenin toplam süresi (son atomun başlangıcı). */
export const patternDuration = (pattern) =>
  pattern?.steps?.length ? pattern.steps[pattern.steps.length - 1][1] : 0;

/**
 * Tercihler bu deseni çalar mı? (düzey + kategori). Ana anahtar burada değil,
 * serviste bakılır.
 */
export function isPatternAllowed(name, prefs = {}) {
  const pattern = HAPTIC_PATTERNS[name];
  if (!pattern) return false;
  const level = isHapticLevel(prefs.level) ? prefs.level : DEFAULT_HAPTIC_LEVEL;
  if (LEVEL_RANK[pattern.level] > LEVEL_RANK[level]) return false;
  const categories = normalizeCategories(prefs.categories);
  return categories[pattern.category] !== false;
}

/**
 * Deseni platform çağrılarına çevirir.
 *
 * iOS / Android normal-soft → `{ mode: "steps", steps: [{ at, call }] }`
 *   call: { kind: "selection" } | { kind: "impact", style } |
 *         { kind: "notification", type } | { kind: "android", chain, native?, light? }
 * Android strong → `{ mode: "waveform", pattern: [bekle, titre, bekle, titre…], at: [...] }`
 */
export function resolvePattern(name, { platform = "ios", intensity = DEFAULT_HAPTIC_INTENSITY } = {}) {
  const pattern = HAPTIC_PATTERNS[name];
  if (!pattern) return null;
  const power = isHapticIntensity(intensity) ? intensity : DEFAULT_HAPTIC_INTENSITY;

  if (platform === "android" && power === "strong") {
    return { mode: "waveform", pattern: buildWaveform(pattern.steps), duration: patternDuration(pattern) };
  }

  const steps = pattern.steps.map(([atomName, at]) => {
    const atom = HAPTIC_ATOMS[atomName];
    if (platform === "android") {
      const chain = (power === "soft" && ANDROID_SOFT_SWAP[atomName]) || atom.android;
      return { at, call: { kind: "android", chain: [...chain], fallback: androidFallback(atom) } };
    }
    const [kind, style] = atom.ios;
    if (kind === "selection") {
      // strong'da seçim tiki hafif bir darbeye yükselir (UISelection çok ince).
      return power === "strong"
        ? { at, call: { kind: "impact", style: "light" } }
        : { at, call: { kind: "selection" } };
    }
    if (kind === "notification") return { at, call: { kind: "notification", type: style } };
    return { at, call: { kind: "impact", style: IOS_IMPACT_SHIFT[power][style] || style } };
  });
  return { mode: "steps", steps, duration: patternDuration(pattern) };
}

// Zincirin tamamı bu API düzeyinde yoksa ne çalınır? Hafif atomlar sessiz kalır;
// diğerleri expo'nun klasik `Vibrator` yoluna (notification / impact) düşer.
function androidFallback(atom) {
  if (atom.light) return null;
  const [kind, value] = atom.ios;
  if (kind === "notification") return { kind: "notification", type: value };
  return { kind: "impact", style: value };
}

/**
 * Android strong: atomları tek bir `Vibration.vibrate` desenine çevirir
 * ([bekle, titre, bekle, titre, …], ms). Atomun `ms` dizisi [titre, ara, titre…].
 * Üst üste binen darbeler birleştirilir; sıra hep zamana göredir.
 */
export function buildWaveform(steps) {
  const buzzes = [];
  for (const [atomName, at] of steps) {
    const atom = HAPTIC_ATOMS[atomName];
    const pulses = Array.isArray(atom.ms) ? atom.ms : [atom.ms];
    let t = at;
    pulses.forEach((ms, index) => {
      if (index % 2 === 0) buzzes.push([t, t + ms]);
      t += ms;
    });
  }
  buzzes.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [from, to] of buzzes) {
    const last = merged[merged.length - 1];
    if (last && from <= last[1]) last[1] = Math.max(last[1], to);
    else merged.push([from, to]);
  }
  const out = [];
  let cursor = 0;
  for (const [from, to] of merged) {
    out.push(from - cursor, to - from);
    cursor = to;
  }
  return out;
}

/** Eski çağrıların desen karşılığı (impactAsync / notificationAsync / selectionAsync). */
export function patternForLegacy(kind, value) {
  if (kind === "selection") return "select";
  if (kind === "impact") {
    if (value === "light" || value === "soft") return "tap";
    if (value === "heavy") return "pressHeavy";
    return "press";
  }
  if (kind === "notification") {
    if (value === "error") return "error";
    if (value === "warning") return "warning";
    return "success";
  }
  return null;
}
