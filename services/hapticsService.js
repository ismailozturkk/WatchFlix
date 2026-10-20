// services/hapticsService.js
//
// Titreşimin TEK SAHİBİ: hem kullanıcı tercihinin (`hapticsEnabled`) hem de
// "neyin titreşeceği" politikasının.
//
// ── Tercih ────────────────────────────────────────────────────────────────
// Anahtarı eskiden hem burası hem AppSettingsContext ayrı ayrı okuyup yazıyordu.
// Artık tek sahip burası: değer MMKV'den SENKRON okunuyor ve anahtar değişince
// abonelik tazeliyor (açılışta hızlı bir dokunuşta gecikmeli titreşim yok).
//
// ── Politika: "az olsun" ──────────────────────────────────────────────────
// ~70 dosyada ~230 çağrı yeri her sıradan dokunuşta (sekme, çip, düğme, seçici)
// titreşim istiyordu; ayar açılınca uygulama sürekli zırlıyordu. Çağrı yerlerini
// tek tek budamak yerine kural BURADA: yalnız anlam taşıyan anlar titreşir.
//
//   SESSİZ   selectionAsync, impact Light/Soft   sıradan dokunuş (sekme, çip, düğme, tekerlek…)
//   BASKI    impact Medium/Rigid/Heavy           uzun basma, kart fırlatma, listeye ekleme
//   BAŞARI   notification Success                kaydedildi / eklendi / rozet kazanıldı
//   UYARI    notification Warning                (şu an kimse çağırmıyor; ileride)
//   HATA     notification Error                  reddedildi / başarısız
//
// Ayrıca art arda gelen titreşimler tek vuruşa indirilir (HAPTIC_MIN_GAP_MS):
// bir işleyici hem "basıldı" hem "başarılı" derse kullanıcı iki kez değil bir
// kez hisseder.
//
// ── Android ───────────────────────────────────────────────────────────────
// expo-haptics'in impact/notification/selection çağrıları Android'de `Vibrator`
// ile düşük genlikli (30–70/255) bir dalga formu üretir; çoğu cihazda zor
// hissedilir ve kütüphane de bunu önermez. Bu yüzden Android'de önce cihazın
// kendi ayarlı efekti (`View.performHapticFeedback`: Confirm/Reject/Long_Press…)
// denenir; o efekt bu API düzeyinde yoksa (Confirm/Reject API 30+) eski
// `Vibrator` yoluna düşülür. Sistem "dokunma geri bildirimi" kapalıysa sistem
// efekti sessiz kalır — bu platformun kendi tercihine saygıdır.

import * as ExpoHaptics from "expo-haptics";
import { Platform } from "react-native";
import { Keys, get, set, subscribe } from "./storage";

// Ayna: ilk erişimde MMKV'den dolar, anahtar değişince düşer.
let mirror = null;
let wired = false;

function enabled() {
  if (!wired) {
    wired = true;
    subscribe(Keys.haptics, () => {
      mirror = null;
    });
  }
  if (mirror === null) mirror = get(Keys.haptics);
  return mirror;
}

export const ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle;
export const NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType;
export const AndroidHaptics = ExpoHaptics.AndroidHaptics;

/** Tercihi kalıcılaştırır. Ayarlar ekranı dışında çağrılmamalı. */
export function setHapticsEnabled(nextValue) {
  set(Keys.haptics, !!nextValue);
  mirror = null;
}

export function isHapticsEnabled() {
  return enabled();
}

// ── Politika tablosu ──────────────────────────────────────────────────────

export const HAPTIC_ROLES = Object.freeze({
  PRESS: "press",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error",
});

/** Art arda iki titreşim arasındaki en kısa süre (ms); aradakiler düşer. */
export const HAPTIC_MIN_GAP_MS = 300;

// expo-haptics enum'ları düz dizgedir; testlerde kısmi taklit edilebildikleri
// için enum alanlarına değil değerlere bakılır.
const PRESS_STYLES = new Set(["medium", "rigid", "heavy"]);

/** `impactAsync(style)` hangi rolü üretir? Sessizse `null`. */
export function roleForImpact(style) {
  return PRESS_STYLES.has(style) ? HAPTIC_ROLES.PRESS : null;
}

/** `notificationAsync(type)` hangi rolü üretir? */
export function roleForNotification(type) {
  if (type === "error") return HAPTIC_ROLES.ERROR;
  if (type === "warning") return HAPTIC_ROLES.WARNING;
  return HAPTIC_ROLES.SUCCESS;
}

// Android'de her rolün cihaz efekti (AndroidHaptics değerleri).
const ANDROID_EFFECT = {
  [HAPTIC_ROLES.PRESS]: "long-press",
  [HAPTIC_ROLES.SUCCESS]: "confirm",
  [HAPTIC_ROLES.WARNING]: "context-click",
  [HAPTIC_ROLES.ERROR]: "reject",
};

let lastFiredAt = -Infinity;

// Duvar saati geri alınırsa (`now < lastFiredAt`) kapı sonsuza dek kapalı
// kalmasın diye o durum "süre doldu" sayılır.
function claimSlot() {
  const now = Date.now();
  if (now >= lastFiredAt && now - lastFiredAt < HAPTIC_MIN_GAP_MS) return false;
  lastFiredAt = now;
  return true;
}

// Titreşim hiçbir yerde hata fırlatmamalı: native modül yoksa, cihazda titreşim
// motoru yoksa ya da React bağlamı kaybolduysa kullanıcıya görünen bir şey
// değişmemeli. `native` expo'nun klasik (iOS UIKit / Android Vibrator) yoludur.
async function emit(role, native) {
  if (!enabled() || !claimSlot()) return;
  try {
    if (Platform?.OS === "android") {
      try {
        await ExpoHaptics.performAndroidHapticsAsync(ANDROID_EFFECT[role]);
        return;
      } catch {
        // Bu API düzeyinde yok (örn. Confirm/Reject < API 30) → Vibrator yolu.
      }
    }
    await native();
  } catch {
    // bkz. yukarıdaki not
  }
}

// DİKKAT — AŞAĞIDAKİ SARMALAYICILAR HER DURUMDA PROMISE DÖNMELİ.
//
// ~40 yerden `Haptics.selectionAsync().catch(() => {})` biçiminde çağrılıyorlar.
// MMKV geçişinde bekleme kalkınca bunlar bir ara sade fonksiyona çevrilmiş,
// titreşim KAPALIYKEN `undefined` dönmüş ve her çağrı yeri "Cannot read property
// 'catch' of undefined" ile patlamıştı (ör. tema seçimi). `async` sözleşmeyi
// korur; ayrıca artık hiçbiri reddedilmez.

/** Sıradan seçim dokunuşu — politika gereği SESSİZ. */
export async function selectionAsync() {}

export async function impactAsync(style = ImpactFeedbackStyle.Medium) {
  const role = roleForImpact(style);
  if (!role) return;
  await emit(role, () => ExpoHaptics.impactAsync(style));
}

export async function notificationAsync(type = NotificationFeedbackType.Success) {
  await emit(roleForNotification(type), () => ExpoHaptics.notificationAsync(type));
}

/**
 * Ham Android efekti (AndroidHaptics.*). Rol/kısma politikasından geçmez, yalnız
 * tercihe bağlıdır; şu an çağıran yok.
 */
export async function performAndroidHapticsAsync(type) {
  if (!enabled()) return;
  try {
    await ExpoHaptics.performAndroidHapticsAsync(type);
  } catch {
    // bkz. `emit`
  }
}

/**
 * Ayar AÇILDIĞINDA kullanıcının çalıştığını hissetmesi için tek bir baskı.
 * Kısma kapısını sıfırlar; tercih kapalıysa hiçbir şey yapmaz.
 */
export function previewHaptic() {
  lastFiredAt = -Infinity;
  return impactAsync(ImpactFeedbackStyle.Medium);
}

/**
 * Tür adıyla tetikleme. Eski adlar korunur: "impact" → baskı, "notification" →
 * başarı, diğerleri ("selection") sessiz. Yeni adlar doğru rolü açıkça söyler;
 * hata yolunda "notification" (=başarı) yerine "error" kullan.
 */
export function triggerHaptic(type = "selection") {
  if (type === "impact" || type === "press") return impactAsync();
  if (type === "notification" || type === "success") return notificationAsync();
  if (type === "warning") return notificationAsync("warning");
  if (type === "error") return notificationAsync("error");
  return selectionAsync();
}
