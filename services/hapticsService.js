// services/hapticsService.js
//
// Titreşimin TEK SAHİBİ: kullanıcı tercihleri + çalma politikası + oynatıcı.
//
// ── Tercihler (hepsi MMKV, SENKRON okunur, anahtar değişince ayna tazelenir) ──
//   Keys.haptics            ana anahtar (varsayılan KAPALI)
//   Keys.hapticsLevel       minimal | balanced | rich      → HANGİ anlar
//   Keys.hapticsIntensity   soft | normal | strong          → NE KADAR sert
//   Keys.hapticsCategories  { navigation, gestures, feedback, games, social, celebrations }
//
// ── Desenler ─────────────────────────────────────────────────────────────────
// Yeni kod `haptic("like")` gibi ANLAMSAL bir ad çağırır; desen kataloğu ve
// platform eşlemesi utils/hapticPatterns.js'te (saf, testli). Eski çağrılar
// (`selectionAsync`, `impactAsync`, `notificationAsync`, `triggerHaptic`) aynen
// çalışır ve birer desene çevrilir:
//
//   selectionAsync           → select      (Gezinme · "Dengeli"den itibaren)
//   impact Light/Soft        → tap         (Gezinme · yalnız "Bol")
//   impact Medium/Rigid      → press       (Hareketler · her düzeyde)
//   impact Heavy             → pressHeavy  (Hareketler · her düzeyde)
//   notification S/W/E       → success / warning / error (Sonuçlar · her düzeyde)
//
// "Az" (minimal) düzeyi 15 Eki'deki "titreşim az olsun" politikasının birebir
// aynısıdır: sıradan dokunuş sessiz; yalnız baskı, sonuç ve kutlama titreşir.
//
// ── Çakışma (öncelik + bekleme) ──────────────────────────────────────────────
// Her desenin önceliği (1 tik … 5 kutlama) ve bekleme süresi var. Son desenin
// "tutma" penceresi (max(süre, gap)) içinde gelen EŞİT/DÜŞÜK öncelikli istek
// düşer; DAHA YÜKSEK öncelikli istek öncekinin kalan adımlarını iptal edip çalar.
// Böylece bir işleyici "basıldı + kaydedildi" derse tek vuruş hissedilir, ama
// sürüklerken tikler 30-45 ms arayla akmaya devam eder.
//
// ── Android ──────────────────────────────────────────────────────────────────
// normal/soft: `View.performHapticFeedback` sabitleri (cihazın ayarlı efektleri;
// sistemin "dokunma geri bildirimi" kapalıysa SESSİZ — platform tercihine saygı).
// Sabit bu API düzeyinde yoksa zincirdeki sonrakine düşülür ve sonuç önbelleğe
// alınır (her seferinde istisna maliyeti yok). strong: desen tek bir
// `Vibration.vibrate([...])` dalga formu olur (tam genlik, native zamanlama).
//
// Servis hiçbir durumda reddetmez/fırlatmaz.

import * as ExpoHaptics from "expo-haptics";
import { Platform, Vibration } from "react-native";
import { Keys, get, set, subscribe } from "./storage";
import {
  DEFAULT_HAPTIC_INTENSITY,
  DEFAULT_HAPTIC_LEVEL,
  HAPTIC_CATEGORIES,
  HAPTIC_PATTERNS,
  isHapticIntensity,
  isHapticLevel,
  isPatternAllowed,
  normalizeCategories,
  patternForLegacy,
  resolvePattern,
} from "../utils/hapticPatterns";

export {
  HAPTIC_CATEGORIES,
  HAPTIC_INTENSITIES,
  HAPTIC_LEVELS,
  HAPTIC_PATTERN_NAMES,
  HAPTIC_SAMPLES,
} from "../utils/hapticPatterns";

// ── Tercih aynası ────────────────────────────────────────────────────────────

const PREF_KEYS = ["haptics", "hapticsLevel", "hapticsIntensity", "hapticsCategories"];
let mirror = null;
let wired = false;
const listeners = new Set();

function readPrefs() {
  if (!wired) {
    wired = true;
    for (const name of PREF_KEYS) {
      const key = Keys[name];
      if (!key) continue;
      subscribe(key, () => {
        mirror = null;
        listeners.forEach((fn) => {
          try {
            fn();
          } catch {
            // dinleyici hatası titreşimi bozmasın
          }
        });
      });
    }
  }
  if (mirror === null) {
    const level = Keys.hapticsLevel ? get(Keys.hapticsLevel) : null;
    const intensity = Keys.hapticsIntensity ? get(Keys.hapticsIntensity) : null;
    mirror = {
      enabled: !!get(Keys.haptics),
      level: isHapticLevel(level) ? level : DEFAULT_HAPTIC_LEVEL,
      intensity: isHapticIntensity(intensity) ? intensity : DEFAULT_HAPTIC_INTENSITY,
      categories: normalizeCategories(Keys.hapticsCategories ? get(Keys.hapticsCategories) : null),
    };
  }
  return mirror;
}

/** Güncel tercihler: `{ enabled, level, intensity, categories }` (salt okunur kopya). */
export function getHapticPrefs() {
  const prefs = readPrefs();
  return { ...prefs, categories: { ...prefs.categories } };
}

/** Tercih değişince çağrılır; abonelikten çıkış fonksiyonu döner. */
export function subscribeHapticPrefs(listener) {
  readPrefs();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Ana anahtarı kalıcılaştırır. Ayarlar dışında çağrılmamalı. */
export function setHapticsEnabled(nextValue) {
  set(Keys.haptics, !!nextValue);
  mirror = null;
}

export function isHapticsEnabled() {
  return readPrefs().enabled;
}

export function setHapticLevel(level) {
  if (!isHapticLevel(level)) return false;
  const ok = set(Keys.hapticsLevel, level);
  mirror = null;
  return ok !== false;
}

export function setHapticIntensity(intensity) {
  if (!isHapticIntensity(intensity)) return false;
  const ok = set(Keys.hapticsIntensity, intensity);
  mirror = null;
  return ok !== false;
}

/** Tek kategoriyi aç/kapa. Hepsi açıksa anahtar `null` tutulur (varsayılan). */
export function setHapticCategory(category, on) {
  if (!HAPTIC_CATEGORIES.includes(category)) return false;
  const next = { ...readPrefs().categories, [category]: !!on };
  const allOn = HAPTIC_CATEGORIES.every((id) => next[id]);
  const ok = set(Keys.hapticsCategories, allOn ? null : next);
  mirror = null;
  return ok !== false;
}

// ── Eski rol tablosu (geri uyum) ─────────────────────────────────────────────

export const ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle;
export const NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType;
export const AndroidHaptics = ExpoHaptics.AndroidHaptics;

export const HAPTIC_ROLES = Object.freeze({
  PRESS: "press",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error",
});

/** Baskı/sonuç desenlerinin bekleme süresi (ms); eşit öncelikli ikincisi düşer. */
export const HAPTIC_MIN_GAP_MS = 300;

const PRESS_STYLES = new Set(["medium", "rigid", "heavy"]);

/** `impactAsync(style)` "Az" düzeyinde hangi rolü üretir? Sessizse `null`. */
export function roleForImpact(style) {
  return PRESS_STYLES.has(style) ? HAPTIC_ROLES.PRESS : null;
}

/** `notificationAsync(type)` hangi rolü üretir? */
export function roleForNotification(type) {
  if (type === "error") return HAPTIC_ROLES.ERROR;
  if (type === "warning") return HAPTIC_ROLES.WARNING;
  return HAPTIC_ROLES.SUCCESS;
}

// ── Oynatıcı ─────────────────────────────────────────────────────────────────

const now = () => Date.now();
let last = { at: -Infinity, until: -Infinity, priority: 0 };
let pendingTimers = [];
const unsupportedAndroid = new Set();

function cancelPending() {
  pendingTimers.forEach((id) => clearTimeout(id));
  pendingTimers = [];
}

// Kapı: çalınabilir mi? Çalınacaksa durumu da günceller.
function claim(pattern) {
  const t = now();
  const clockOk = t >= last.at; // saat geri alındıysa pencere bitmiş say
  if (clockOk && t < last.until && pattern.priority <= last.priority) return false;
  const hold = Math.max(
    pattern.gap,
    pattern.steps.length ? pattern.steps[pattern.steps.length - 1][1] : 0,
  );
  last = { at: t, until: t + hold, priority: pattern.priority };
  return true;
}

async function playAndroidChain(call) {
  for (const effect of call.chain) {
    if (unsupportedAndroid.has(effect)) continue;
    try {
      await ExpoHaptics.performAndroidHapticsAsync(effect);
      return;
    } catch {
      // Bu API düzeyinde yok (örn. confirm/reject < 30, toggle/segment < 34).
      unsupportedAndroid.add(effect);
    }
  }
  const fb = call.fallback;
  if (!fb) return; // hafif atom: Vibrator "zırlaması" yerine sessizlik
  if (fb.kind === "notification") await ExpoHaptics.notificationAsync(fb.type);
  else await ExpoHaptics.impactAsync(fb.style);
}

async function playCall(call) {
  try {
    if (call.kind === "android") await playAndroidChain(call);
    else if (call.kind === "selection") await ExpoHaptics.selectionAsync();
    else if (call.kind === "impact") await ExpoHaptics.impactAsync(call.style);
    else if (call.kind === "notification") await ExpoHaptics.notificationAsync(call.type);
  } catch {
    // native modül yok / titreşim motoru yok / React bağlamı kayıp → sessiz
  }
}

async function play(name, { force = false, intensity } = {}) {
  const pattern = HAPTIC_PATTERNS[name];
  if (!pattern) return;
  const prefs = readPrefs();
  if (!prefs.enabled) return;
  if (!force && !isPatternAllowed(name, prefs)) return;
  if (!force && !claim(pattern)) return;
  if (force) last = { at: now(), until: now() + pattern.gap, priority: pattern.priority };

  cancelPending();
  const platform = Platform?.OS === "android" ? "android" : "ios";
  const resolved = resolvePattern(name, { platform, intensity: intensity || prefs.intensity });
  if (!resolved) return;

  if (resolved.mode === "waveform") {
    try {
      Vibration?.cancel?.();
      Vibration?.vibrate?.(resolved.pattern);
    } catch {
      // bkz. playCall
    }
    return;
  }

  const [first, ...rest] = resolved.steps;
  for (const step of rest) {
    pendingTimers.push(setTimeout(() => playCall(step.call), step.at));
  }
  if (first) await playCall(first.call);
}

// DİKKAT — AŞAĞIDAKİ SARMALAYICILAR HER DURUMDA PROMISE DÖNMELİ.
// ~40 yer `Haptics.selectionAsync().catch(() => {})` biçiminde çağırıyor; MMKV
// geçişinde `undefined` dönünce "Cannot read property 'catch' of undefined" ile
// patlamıştı. `async` sözleşmeyi korur; hiçbiri reddedilmez.

/**
 * ANLAMSAL titreşim: `haptic("like")`, `haptic("wrong")`… Ad kataloğu:
 * utils/hapticPatterns.js → HAPTIC_PATTERNS. Bilinmeyen ad sessizce yok sayılır.
 */
export async function haptic(name) {
  try {
    await play(name);
  } catch {
    // asla reddetme
  }
}

/** Sıradan seçim dokunuşu → `select` (Dengeli+). */
export async function selectionAsync() {
  await haptic(patternForLegacy("selection"));
}

export async function impactAsync(style = ImpactFeedbackStyle?.Medium || "medium") {
  await haptic(patternForLegacy("impact", style));
}

export async function notificationAsync(type = NotificationFeedbackType?.Success || "success") {
  await haptic(patternForLegacy("notification", type));
}

/** Ham Android efekti. Politikadan geçmez, yalnız ana anahtara bağlıdır. */
export async function performAndroidHapticsAsync(type) {
  if (!readPrefs().enabled) return;
  try {
    await ExpoHaptics.performAndroidHapticsAsync(type);
  } catch {
    // bkz. playCall
  }
}

/**
 * Ayarlar ekranındaki "dene" düğmeleri: düzey ve kategori filtresini atlar,
 * yalnız ana anahtara bağlıdır. `intensity` verilirse o güçle çalar.
 */
export async function previewPattern(name, { intensity } = {}) {
  try {
    await play(name, { force: true, intensity });
  } catch {
    // asla reddetme
  }
}

/** Ana anahtar AÇILDIĞINDA tek bir baskı; tercih kapalıysa hiçbir şey yapmaz. */
export function previewHaptic() {
  return previewPattern("press");
}

/**
 * Tür adıyla tetikleme. Eski adlar korunur: "impact" → baskı, "notification" →
 * başarı, "selection" → seçim. Desen adları da doğrudan geçer ("like", "wrong"…).
 */
export function triggerHaptic(type = "selection") {
  if (type === "impact") return impactAsync();
  if (type === "notification") return notificationAsync();
  if (type === "selection") return selectionAsync();
  if (HAPTIC_PATTERNS[type]) return haptic(type);
  return selectionAsync();
}

/** Yalnız testler için: oynatıcı durumunu sıfırlar. */
export function __resetHapticsForTests() {
  cancelPending();
  last = { at: -Infinity, until: -Infinity, priority: 0 };
  unsupportedAndroid.clear();
  mirror = null;
}
