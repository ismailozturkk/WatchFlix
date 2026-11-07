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
// Simgenin gerçeği her zaman İŞLETİM SİSTEMİNDE. Uygulama içindeki logoların
// (giriş, splash, paylaşım kartları...) render sırasında senkron okuyabilmesi
// için seçim services/appIconStore.js'te ÖNBELLEKLENİR; her açılışta
// reconcileAppIconWithSystem() ile sistemin gerçek durumuna eşitlenir, yani
// yeniden kurulum ya da sistem tarafı değişiklik önbelleği kalıcı bozamaz.

import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import {
  APP_ICON_NATIVE_NAMES,
  DEFAULT_APP_ICON_ID,
  LEGACY_NATIVE_NAMES,
  iconIdFromNativeName,
  nativeNameFromIconId,
} from "../utils/appIcons";
import { setAppIconId } from "./appIconStore";
import {
  loadWidgetPreferences,
  syncWidgetPreferences,
} from "./widgetPreferencesService";

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

/**
 * Alternatif simge desteğinin DURUMU. Ayar kartı yalnız "supported" iken çizilir;
 * geliştirme build'inde diğer durumlar için de sebebi söyleyen bir not çizilir
 * (kart sessizce yok olunca nedeni anlaşılsın diye).
 *   "supported"   → seçilebilir
 *   "no-module"   → bu binary'de SeelogdAppIcon yok (Expo Go ya da modülden ÖNCE
 *                   alınmış build) — yeni native build gerekir
 *   "unsupported" → modül var ama destek yok: Android'de manifestte alias yok
 *                   (plugin'siz / eski `prebuild` çıktısı), iOS'ta cihaz desteklemiyor
 */
export async function getAppIconSupportStatus() {
  if (!NativeAppIcon) return "no-module";
  return (await isAppIconChangeSupported()) ? "supported" : "unsupported";
}

// Bu binary'de GERÇEKTEN bulunan simge adları (katalog sırasıyla). Native modüle
// yalnız bunlar gönderilir: eski Android modülü listedeki her alias'ı kapatmaya
// çalışır ve bulamadığında tüm değişimi hatayla düşürür. Sorgu yoksa (eski build)
// o build'lerin taşıdığı küme varsayılır. Binary oturum içinde değişmez → önbellek.
const LEGACY_AVAILABLE = APP_ICON_NATIVE_NAMES.filter((n) => LEGACY_NATIVE_NAMES.includes(n));
let availableNamesPromise = null;
function loadAvailableNames() {
  if (!NativeAppIcon) return Promise.resolve([]);
  if (!availableNamesPromise) {
    availableNamesPromise = (async () => {
      if (typeof NativeAppIcon.getAvailableNamesAsync !== "function") {
        return LEGACY_AVAILABLE;
      }
      try {
        const names = await NativeAppIcon.getAvailableNamesAsync(APP_ICON_NATIVE_NAMES);
        const found = APP_ICON_NATIVE_NAMES.filter((n) => Array.isArray(names) && names.includes(n));
        return found.length > 0 ? found : LEGACY_AVAILABLE;
      } catch {
        availableNamesPromise = null; // geçici hata: sonraki çağrı yeniden sorsun
        return LEGACY_AVAILABLE;
      }
    })();
  }
  return availableNamesPromise;
}

/** Bu yapıda seçilebilen simgelerin katalog kimlikleri (katalog sırasıyla). */
export async function getAvailableAppIconIds() {
  const names = await loadAvailableNames();
  return names.map(iconIdFromNativeName);
}

/** Şu an etkin simgenin katalog kimliği. Okunamazsa varsayılan. */
export async function getActiveAppIconId() {
  if (!NativeAppIcon) return DEFAULT_APP_ICON_ID;
  try {
    const nativeName = await NativeAppIcon.getAppIconNameAsync(await loadAvailableNames());
    return iconIdFromNativeName(nativeName);
  } catch {
    return DEFAULT_APP_ICON_ID;
  }
}

// Android widget başlıkları da seçili simgeyi gösterir (AppIconRes.kt, simgeyi
// PackageManager'dan okur) ama yalnız KENDİ güncellemesinde. Tercihleri yeniden
// göndermek üç widget'ı da anında yeniden çizdirir; yoksa simge bir sonraki
// veri senkronuna dek eski kalırdı. iOS widget'larında marka simgesi yok.
function refreshWidgetHeaders() {
  if (Platform.OS !== "android") return;
  loadWidgetPreferences()
    .then(syncWidgetPreferences)
    .catch(() => {
      /* widget yenileme best-effort — simge değişimini etkilemez */
    });
}

/**
 * Simgeyi değiştir. Başarıda uygulama içi logoların kaynağı (appIconStore)
 * da güncellenir — tüm logolar anında yeni simgeye geçer — ve yeni etkin kimlik
 * döner. Hatada FIRLATIR; store'a dokunulmaz (logolar eski simgede kalır).
 * @param {string} id katalog kimliği (utils/appIcons.js)
 */
export async function setActiveAppIcon(id) {
  const nativeName = nativeNameFromIconId(id);
  if (!nativeName) throw new Error(`Bilinmeyen uygulama simgesi: ${id}`);
  if (!NativeAppIcon) throw new Error("Uygulama simgesi modülü bu yapıda yok.");
  const names = await loadAvailableNames();
  if (!names.includes(nativeName)) {
    throw new Error(`Bu yapıda "${nativeName}" simgesi yok (yeni native build gerekir).`);
  }
  const applied = iconIdFromNativeName(await NativeAppIcon.setAppIconNameAsync(nativeName, names));
  setAppIconId(applied);
  refreshWidgetHeaders();
  return applied;
}

/**
 * Uygulama içi logo önbelleğini (appIconStore) sistemin GERÇEK simgesiyle
 * eşitler. Açılışta bir kez çağrılır; ayar kartı da açılırken çağırır.
 *
 *   • modül yok (Expo Go / eski binary)  → simge zorunlu olarak varsayılandır
 *   • modül var, cihaz desteklemiyor      → varsayılan
 *   • modül var, destek var               → sistemden okunan simge
 *   • okuma hatası                        → önbelleğe DOKUNMA (geçici hata,
 *                                           doğru logoyu yanlışa çevirmesin)
 */
export async function reconcileAppIconWithSystem() {
  if (!NativeAppIcon) {
    setAppIconId(DEFAULT_APP_ICON_ID);
    return;
  }
  try {
    const supported = (await NativeAppIcon.isSupportedAsync()) === true;
    if (!supported) {
      setAppIconId(DEFAULT_APP_ICON_ID);
      return;
    }
    const nativeName = await NativeAppIcon.getAppIconNameAsync(await loadAvailableNames());
    setAppIconId(iconIdFromNativeName(nativeName));
  } catch {
    /* geçici hata — önbellek olduğu gibi kalır */
  }
}
