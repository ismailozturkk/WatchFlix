import { NativeModules, Platform } from "react-native";

/**
 * Ana ekran widget'larının ORTAK native köprüsü.
 *
 * Android: her widget'ın kendi klasik köprü modülü var —
 *   ReminderWidgetModule / ListsWidgetModule / StatsWidgetModule.
 * iOS: TEK bir yerel Expo modülü (modules/reminder-widget) üç widget'ı da
 *   besler; App Group UserDefaults'a yazıp WidgetKit'i yeniler. Bu yüzden
 *   iOS'ta modül adı sabittir ve Android modül adına bakılmaz.
 *
 * Widget servisleri (reminder/lists/stats) native ayrıntıyı burada bırakır;
 * kendileri yalnız "hangi veriyi hangi metoda veriyorum" sorusunu çözer.
 */

let iosResolved = false;
let iosModule = null;

const getIosModule = () => {
  if (iosResolved) return iosModule;
  iosResolved = true;
  try {
    // Tembel yüklenir: non-iOS platformlar ve Jest (bkz. jest.config.js — saf
    // JS testleri) asla expo-modules-core'u import etmez.
    const { requireOptionalNativeModule } = require("expo-modules-core");
    iosModule = requireOptionalNativeModule("ReminderWidget");
  } catch (error) {
    iosModule = null;
  }
  return iosModule;
};

export const getWidgetBridge = (androidModuleName) =>
  Platform.OS === "ios" ? getIosModule() : NativeModules[androidModuleName];

// __DEV__ RN/Expo tarafından tanımlanır ama Jest ortamında (plain node) YOK.
// Köprü testlerden de çağrılabildiği için guard'lı okunur.
const isDev = typeof __DEV__ !== "undefined" && __DEV__;

/**
 * Native widget metodunu çağırır. Modül yoksa (Expo Go, desteklenmeyen
 * platform, henüz prebuild edilmemiş iOS) sessizce çıkar — widget senkronu
 * hiçbir zaman uygulamayı düşürmemeli.
 */
export const callWidget = async (androidModuleName, method, ...args) => {
  const bridge = getWidgetBridge(androidModuleName);
  if (!bridge?.[method]) return;
  try {
    await bridge[method](...args);
  } catch (error) {
    if (isDev) console.warn(`[Widget] ${method} failed:`, error?.message);
  }
};

/**
 * TMDB poster yolundan (ör. "/abc.jpg") widget'ın indireceği tam URL üretir.
 * Native taraf bunu arka planda bitmap olarak çeker.
 *
 * Standart TMDB CDN kullanılır — özel R2/kalite katmanına bağlı DEĞİL ki
 * widget her ağ ortamında poster gösterebilsin.
 */
export const widgetPosterUrl = (path, size = "w185") => {
  if (!path || typeof path !== "string") return "";
  if (path.startsWith("http")) return path;
  return `https://image.tmdb.org/t/p/${size}${path.startsWith("/") ? "" : "/"}${path}`;
};
