// services/effectSettings.js
//
// Görsel efekt modunun (Tam / Orta / Kapalı) TEK KAYNAĞI.
//
// NEDEN AYRI BİR STORE: efekt bütçesini okuyan üç yer de (AdaptiveBlurView,
// IconBacground, SpritePet) render sırasında senkron bir değer istiyor ve
// ikisi bunu eskiden MODÜL SEVİYESİNDE sabitliyordu — kullanıcı ayarı
// değiştirdiğinde uygulamayı yeniden başlatmadan etkisi görünmezdi. Burada
// değer bir abonelik kaynağı: `useEffectPreset()` ile okuyan bileşen mod
// değişince yeniden çizilir.
//
// AppSettingsContext'e KOYULMADI: bu üç bileşen ağacın en sıcak yerlerinde
// (her ekranın arka planı, her modal) duruyor; provider değeri değiştikçe tüm
// alt ağacı yeniden çizmek yerine yalnız bu üç bileşen abone olur.
// hapticsService gibi tercihini kendisi hidrate eder (bkz. services/hapticsService.js).
import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  EFFECT_MODES,
  defaultEffectMode,
  getEffectPreset,
} from "../utils/deviceTier";
import { deviceTier } from "./deviceTier";

export const EFFECT_MODE_STORAGE_KEY = "effectMode";

// Tercih okunana kadar cihaz sınıfının kararı geçerli — bugünkü davranış.
let mod = defaultEffectMode(deviceTier);
let preset = getEffectPreset(mod);
// Kullanıcı hidrasyon tamamlanmadan seçim yaparsa geç gelen kayıt onu EZMESİN.
let tercihSurumu = 0;
const dinleyiciler = new Set();

const yayinla = () => {
  for (const fn of dinleyiciler) fn();
};

const uygula = (yeniMod) => {
  if (yeniMod === mod) return;
  mod = yeniMod;
  // Referans yalnız mod değişince değişir: useSyncExternalStore'un snapshot
  // karşılaştırması buna dayanır, her okumada yeni nesne dönersek sonsuz döngü olur.
  preset = getEffectPreset(yeniMod);
  yayinla();
};

AsyncStorage.getItem(EFFECT_MODE_STORAGE_KEY)
  .then((kayitli) => {
    if (tercihSurumu !== 0) return;
    if (EFFECT_MODES.includes(kayitli)) uygula(kayitli);
  })
  .catch(() => {
    /* kayıt okunamadı → cihaz sınıfının kararıyla devam */
  });

/** Modu değiştirir ve (istenirse) kalıcılaştırır. Geçersiz mod yok sayılır. */
export function setEffectMode(yeniMod, { persist = true } = {}) {
  if (!EFFECT_MODES.includes(yeniMod)) return;
  tercihSurumu += 1;
  uygula(yeniMod);
  if (persist) {
    AsyncStorage.setItem(EFFECT_MODE_STORAGE_KEY, yeniMod).catch(() => {
      /* yazılamadıysa oturum içi seçim yine de geçerli */
    });
  }
}

/** React dışı çağıranlar için anlık değerler. */
export const getEffectMode = () => mod;
export const getEffectPresetNow = () => preset;
/** Kullanıcı hiç seçim yapmadıysa hangi mod açılırdı — "Önerilen" rozeti için. */
export const onerilenEffectMode = () => defaultEffectMode(deviceTier);

/** Mod değişimini dinler; abonelikten çıkaran fonksiyonu döner. */
export const subscribeEffects = (fn) => {
  dinleyiciler.add(fn);
  return () => dinleyiciler.delete(fn);
};

const abone = subscribeEffects;

/** Efekt bütçesi — mod değişince abone bileşen yeniden çizilir. */
export function useEffectPreset() {
  return useSyncExternalStore(abone, getEffectPresetNow, getEffectPresetNow);
}

/** Seçili mod ("full" | "balanced" | "off") — ayar ekranı için. */
export function useEffectMode() {
  return useSyncExternalStore(abone, getEffectMode, getEffectMode);
}
