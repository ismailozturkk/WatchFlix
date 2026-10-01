// services/appIconService.js
//
// Uygulama simgesi değiştirme — yerel modül modules/app-icon'un JS yüzü.
//
// Modül, `requireOptionalNativeModule` ile alınır: modül çok eski bir
// binary'de (OTA ile yeni JS gelmiş ama native build yenilenmemiş) ya da
// Expo Go'da YOK. Bu durumda özellik sessizce kapalı sayılır ve ayar kartı
// hiç çizilmez; uygulama çökmez. `runtimeVersion: appVersion` politikası yüzünden
// bu durum gerçekten oluşabilir.
//
// Simgenin gerçeği her zaman İŞLETİM SİSTEMİNDE: burada ayrıca saklanan bir
// tercih yok (saklasaydık, sistem ayarı/yeniden kurulumla ayrışabilirdi).

import { requireOptionalNativeModule } from "expo-modules-core";
import {
  APP_ICON_NATIVE_NAMES,
  DEFAULT_APP_ICON_ID,
  iconIdFromNativeName,
  nativeNameFromIconId,
} from "../utils/appIcons";

const NativeAppIcon = requireOptionalNativeModule("SeelogdAppIcon");

/** Modül bu binary'de var mı (cihaz desteğinden ayrı, ucuz kontrol)? */
export const hasAppIconModule = () => NativeAppIcon != null;

/**
 * Bu cihazda/yapıda alternatif simge seçilebilir mi?
 * Modül yoksa, iOS cihaz desteklemiyorsa ya da Android'de alias'lar manifestte
 * yoksa (plugin'siz üretilmiş build) false.
 */
export async function isAppIconChangeSupported() {
  if (!NativeAppIcon) return false;
  try {
    return (await NativeAppIcon.isSupportedAsync()) === true;
  } catch {
    return false;
  }
}

/** Şu an etkin simgenin katalog kimliği. Okunamazsa varsayılan. */
export async function getActiveAppIconId() {
  if (!NativeAppIcon) return DEFAULT_APP_ICON_ID;
  try {
    const nativeName = await NativeAppIcon.getAppIconNameAsync(APP_ICON_NATIVE_NAMES);
    return iconIdFromNativeName(nativeName);
  } catch {
    return DEFAULT_APP_ICON_ID;
  }
}

/**
 * Simgeyi değiştir. Başarıda yeni etkin kimliği döner; hatada FIRLATIR
 * (çağıran kullanıcıya bildirir ve seçimi geri alır).
 * @param {string} id katalog kimliği (utils/appIcons.js)
 */
export async function setActiveAppIcon(id) {
  const nativeName = nativeNameFromIconId(id);
  if (!nativeName) throw new Error(`Bilinmeyen uygulama simgesi: ${id}`);
  if (!NativeAppIcon) throw new Error("Uygulama simgesi modülü bu yapıda yok.");
  const applied = await NativeAppIcon.setAppIconNameAsync(nativeName, APP_ICON_NATIVE_NAMES);
  return iconIdFromNativeName(applied);
}
