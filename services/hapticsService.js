// services/hapticsService.js
//
// Titreşim tercihinin TEK SAHİBİ.
//
// GEÇİŞ ÖNCESİ SORUN: bu anahtarı (`hapticsEnabled`) hem burası hem
// AppSettingsContext ayrı ayrı okuyup yazıyordu. İki ayrı hidrasyon, iki ayrı
// ayna, aralarında senkron tutmak için AppSettingsContext'ten buraya bir
// `setHapticsEnabled(...)` itmesi vardı. Artık tek sahip burası: değer MMKV'den
// SENKRON okunuyor ve anahtar değişince abonelik tazeliyor.
//
// Ayrıca kalkan yarış: eski kodda tercih async okunana kadar `runIfEnabled`
// bir promise bekliyordu; açılışta hızlı bir dokunuşta titreşim gecikmeli
// geliyordu. Senkron okumada bekleme yok.

import * as ExpoHaptics from "expo-haptics";
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

// DİKKAT — BU FONKSİYON `async` KALMALI.
//
// Aşağıdaki dört sarmalayıcı 16 dosyada ~40 yerden `Haptics.selectionAsync()
// .catch(() => {})` biçiminde çağrılıyor. MMKV geçişinde bekleme kalkınca bu
// `async` bir ara sade fonksiyona çevrilmişti; titreşim KAPALIYKEN `undefined`
// dönüyor ve her çağrı yeri "Cannot read property 'catch' of undefined" ile
// patlıyordu (ör. tema seçimi).
//
// `async` olması sözleşmeyi korur: her durumda bir Promise döner ve
// expo-haptics senkron fırlatsa bile bu bir reddedilmeye dönüşür.
async function runIfEnabled(callback) {
  if (!enabled()) return undefined;
  return callback();
}

export function selectionAsync() {
  return runIfEnabled(() => ExpoHaptics.selectionAsync());
}

export function impactAsync(style = ImpactFeedbackStyle.Medium) {
  return runIfEnabled(() => ExpoHaptics.impactAsync(style));
}

export function notificationAsync(type = NotificationFeedbackType.Success) {
  return runIfEnabled(() => ExpoHaptics.notificationAsync(type));
}

export function performAndroidHapticsAsync(type) {
  return runIfEnabled(() => ExpoHaptics.performAndroidHapticsAsync(type));
}
