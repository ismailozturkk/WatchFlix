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
import {
  EFFECT_MODES,
  defaultEffectMode,
  getEffectPreset,
} from "../utils/deviceTier";
import { deviceTier } from "./deviceTier";
import { Keys, get, set, subscribe } from "./storage";

export const EFFECT_MODE_STORAGE_KEY = Keys.effectMode.key;

// MMKV GEÇİŞİ: tercih artık AÇILIŞTA SENKRON okunuyor. Eskiden cihaz sınıfının
// kararıyla başlanıp async okuma sonrası düzeltiliyordu; "efektler kapalı" diyen
// kullanıcı her açılışta bir kare boyunca tam efektli ekran görüyordu. Bununla
// birlikte "geç gelen kayıt kullanıcı seçimini ezmesin" koruması da gereksizleşti.
let mod = defaultEffectMode(deviceTier);
let preset = getEffectPreset(mod);
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

// Kayıtlı tercihi uygular. HEM modül yüklenirken HEM de anahtar değiştiğinde
// çalışır.
//
// Aboneliğin sebebi yalnız "ayar ekranından değişince güncelle" değil: bu modül
// AsyncStorage → MMKV göçünden ÖNCE yüklenebiliyor (App.js'teki göç kapısı
// provider ağacını tutuyor ama modül seviyesindeki kodu tutmuyor). O durumda ilk
// okuma boş depoya denk gelir; göç anahtarı yazınca abonelik tetiklenir ve
// kullanıcının gerçek seçimi aynı oturumda devreye girer. Bu olmadan güncelleme
// sonrası ilk açılışta seçim bir oturum boyunca yok sayılırdı.
const kayittanUygula = () => {
  const kayitli = get(Keys.effectMode);
  if (EFFECT_MODES.includes(kayitli)) uygula(kayitli);
};

kayittanUygula();
subscribe(Keys.effectMode, kayittanUygula);

/** Modu değiştirir ve (istenirse) kalıcılaştırır. Geçersiz mod yok sayılır. */
export function setEffectMode(yeniMod, { persist = true } = {}) {
  if (!EFFECT_MODES.includes(yeniMod)) return;
  uygula(yeniMod);
  // Yazılamadıysa oturum içi seçim yine de geçerli — depolama katmanı hatayı
  // kendi raporlar, burada ayrıca ele almaya gerek yok.
  if (persist) set(Keys.effectMode, yeniMod);
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
