// services/devLab.js
//
// Ayarlar > Geliştirici Laboratuvarı'nın (screens/tabs/settings/DevLabScreen.js)
// geçici durumu. YALNIZ __DEV__: release'de her okuma "kapalı" döner, yazma yok
// sayılır (plan simülatörü services/devPlanOverride.js ile aynı kapı mantığı).
//
// Bellekte tutulur, diske YAZILMAZ: uygulama yeniden açılınca gerçek veriye döner.
// Böylece deneme verisi seri defterine, kutlama kaydına ya da buluta asla sızmaz.
//
// Seri simülatörü: profildeki alev (StreakFlameBadge) gerçek `seriler` yerine
// buradaki sahte seriyi gösterir — günlerce izleme yapmadan her kademe, durum
// (yanık / risk / telafi / kalkan) ve koruma görünümü denenebilir.
import { useMemo, useSyncExternalStore } from "react";

export const isDevLabAvailable = () => typeof __DEV__ !== "undefined" && __DEV__ === true;

export const DEV_STREAK_STATUSES = Object.freeze(["lit", "risk", "repair", "shield", "paused"]);
export const DEV_STREAK_MAX_WEEKS = 120;
// Eski ad (çağıranlar): üst sınır artık HAFTA.
export const DEV_STREAK_MAX_DAYS = DEV_STREAK_MAX_WEEKS;

const DEFAULT_STREAK = Object.freeze({
  enabled: false,
  weeks: 3,
  weekDays: 2,
  status: "lit",
  shields: 1,
  repairHave: 0,
  record: 0,
});

let state = { streak: DEFAULT_STREAK, flameRenderer: "skia" };
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));

export function getDevStreak() {
  return isDevLabAvailable() ? state.streak : DEFAULT_STREAK;
}

/** Kısmi güncelleme; değerler sınırlara kırpılır. Release'de hiçbir şey yapmaz. */
export function setDevStreak(patch) {
  if (!isDevLabAvailable()) return;
  const prev = state.streak;
  const next = { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) };
  next.weeks = clampInt(next.weeks, 0, DEV_STREAK_MAX_WEEKS);
  next.weekDays = clampInt(next.weekDays, 0, 7);
  next.shields = clampInt(next.shields, 0, 3);
  next.repairHave = clampInt(next.repairHave, 0, 3);
  next.record = clampInt(next.record, 0, DEV_STREAK_MAX_WEEKS);
  if (!DEV_STREAK_STATUSES.includes(next.status)) next.status = "lit";
  next.enabled = Boolean(next.enabled);
  state = { ...state, streak: Object.freeze(next) };
  emit();
}

export function resetDevLab() {
  state = { streak: DEFAULT_STREAK, flameRenderer: DEFAULT_FLAME_RENDERER };
  emit();
}

// ── Alev çizicisi (Skia shader ↔ eski SVG) ──────────────────────────────────
// Laboratuvarda iki çizimi karşılaştırmak için. Release'de her zaman "skia"
// (Skia derlenemezse StreakFlame kendisi SVG'ye düşer).
export const FLAME_RENDERERS = Object.freeze(["skia", "svg"]);
const DEFAULT_FLAME_RENDERER = "skia";

export function getDevFlameRenderer() {
  return isDevLabAvailable() ? state.flameRenderer || DEFAULT_FLAME_RENDERER : DEFAULT_FLAME_RENDERER;
}

export function setDevFlameRenderer(renderer) {
  if (!isDevLabAvailable() || !FLAME_RENDERERS.includes(renderer)) return;
  state = { ...state, flameRenderer: renderer };
  emit();
}

/** StreakFlame'in çizici seçimi (laboratuvardaki ayarı izler). */
export function useFlameRenderer() {
  return useSyncExternalStore(subscribe, getDevFlameRenderer, getDevFlameRenderer);
}

/**
 * Simülatör ayarı → utils/streakFlame'in beklediği `seriler.alev` biçimi
 * (utils/streakWeekly alevHesapla çıktısı). Telafi/kalkan beklerken `weeks`
 * KURTARILACAK seri sayılır. Durum gün sayısını tutarlı yapar ("lit" en az 2 gün,
 * "risk"/"paused" en fazla 1 gün, telafi en fazla 3 gün).
 */
export function buildDevSeriler(sim) {
  const weeks = clampInt(sim?.weeks ?? sim?.days, 0, DEV_STREAK_MAX_WEEKS);
  const status = DEV_STREAK_STATUSES.includes(sim?.status) ? sim.status : "lit";
  let gun = clampInt(sim?.weekDays ?? 2, 0, 7);
  if (status === "lit") gun = Math.max(2, gun);
  if (status === "risk" || status === "paused") gun = Math.min(1, gun);
  const repairHave = clampInt(sim?.repairHave, 0, 3);
  if (status === "repair" || status === "shield") gun = Math.min(3, Math.max(Math.min(gun, 1), repairHave));
  const kalkan = clampInt(sim?.shields, 0, 3);
  const bekleyen = status === "repair" || status === "shield"
    ? { hafta: 0, gerekli: 4, mevcut: gun, kalkan: status === "shield", korunanSeri: weeks }
    : null;
  return {
    alev: {
      seri: bekleyen ? 0 : weeks,
      rekor: Math.max(weeks, clampInt(sim?.record, 0, DEV_STREAK_MAX_WEEKS)),
      buHaftaGun: gun,
      buHaftaKutulari: Array.from({ length: 7 }, (_, i) => i < gun),
      buHaftaBasarili: gun >= 2 && !bekleyen,
      bugunAktif: gun > 0,
      bekleyen,
      kalkan: status === "shield" ? Math.max(1, kalkan) : status === "repair" ? 0 : kalkan,
      kalkanTavani: 3,
      kalkanaKalan: 4 - (weeks % 4),
      mola: { aktif: status === "paused", buHafta: status === "paused", hakVar: status !== "paused", gecenHafta: false },
      sonYama: null,
      esik: 2,
      telafiEsigi: 4,
    },
  };
}

/** Laboratuvar ekranı için canlı seri ayarı. */
export function useDevStreak() {
  return useSyncExternalStore(subscribe, getDevStreak, getDevStreak);
}

/**
 * Profilde kullanılır: simülatör açıksa sahte seri, değilse gerçek seri.
 * Release'de her zaman gerçeği döndürür (getDevStreak kapalı ayarı verir).
 */
export function useDevStreakOverride(realSeriler) {
  const sim = useDevStreak();
  // sim değişmedikçe aynı nesne: profildeki memo'lu rozet boş yere yenilenmesin.
  const fake = useMemo(() => (isDevLabAvailable() && sim.enabled ? buildDevSeriler(sim) : null), [sim]);
  return fake || realSeriler;
}
