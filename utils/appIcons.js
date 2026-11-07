// utils/appIcons.js
//
// Seçilebilir uygulama simgelerinin KATALOĞU. Saf modül (RN importu yok).
//
// Adlar iki yerde birebir aynı olmak zorunda:
//   • app.json → "./plugins/withAlternateAppIcons.js" → icons[].name
//     ("Default" hariç — o, `expo.icon`'dan gelen birincil simge)
//   • yerel modül modules/app-icon (Android alias adı `MainActivity<Ad>`,
//     iOS `<Ad>.appiconset`)
// __tests__/appIcons.test.js bu eşliği ve app.json'daki görsel yollarını doğrular.
//
// Görseller (assets/icon_<id>/) components/appLogoSources.js
// içinde require edilir; burada tutulmaz ki katalog saf kalsın. Seçili simge
// services/appIconStore.js'te; uygulama içindeki TÜM logolar oradan beslenir.
// Alternatif simgelerin görselleri scripts/generate-app-icons.py ile üretilir (classic ve glass hariç).

/** Birincil (varsayılan) simgenin yerel adı. iOS'ta `setAlternateIconName(null)`. */
export const DEFAULT_NATIVE_NAME = "Default";

export const DEFAULT_APP_ICON_ID = "default";

// Varsayılan simge 4 Kas 2026'dan beri Lens işaretidir (marketing/marka/yeni-logo):
// assets/icon_default. Set iki aile, üçer simge (ayar kartında iki satır):
//   Lens: default · lens3d · lensglass      S: classic · glass · flat
// 30 Eki'deki S renk temaları (gold, midnight, sunset, aurora, cinema, light) 5 Kas'ta
// kaldırıldı; depoda kalmış eski seçim isKnownIconId ile varsayılana düşer.
export const APP_ICONS = Object.freeze([
  Object.freeze({
    id: "default",
    nativeName: DEFAULT_NATIVE_NAME,
    labelKey: "autoI18n.uygulama_simgesi_varsayilan",
    labelFallback: "Varsayılan",
  }),
  // Lens'in hacimli sürümleri (scripts/lens_icon_styles.py): kabarık 3B ve iOS 26 tarzı cam.
  Object.freeze({
    id: "lens3d",
    nativeName: "LensSolid",
    labelKey: "autoI18n.uygulama_simgesi_lens_3b",
    labelFallback: "Lens 3B",
  }),
  Object.freeze({
    id: "lensglass",
    nativeName: "LensGlass",
    labelKey: "autoI18n.uygulama_simgesi_lens_cam",
    labelFallback: "Lens Cam",
  }),
  // Eski 3B "S" (4 Kas 2026'ya dek varsayılan).
  Object.freeze({
    id: "classic",
    nativeName: "Classic",
    labelKey: "autoI18n.uygulama_simgesi_klasik",
    labelFallback: "Klasik",
  }),
  Object.freeze({
    id: "glass",
    nativeName: "Glass",
    labelKey: "autoI18n.uygulama_simgesi_cam",
    labelFallback: "Cam",
  }),
  // Düz 2B S (scripts/generate-app-icons.py "flat").
  Object.freeze({
    id: "flat",
    nativeName: "Flat",
    labelKey: "autoI18n.uygulama_simgesi_duz",
    labelFallback: "Düz",
  }),
]);

export const APP_ICON_NATIVE_NAMES = Object.freeze(APP_ICONS.map((i) => i.nativeName));

// `getAvailableNamesAsync` gelmeden ÖNCE alınmış native build'lerde bulunan simgeler.
// Katalog binary'den hızlı büyür (yeni simge = yeni build, JS ise OTA ile gelir):
// eski binary'ye olmayan bir ad gönderilirse Android modülü o alias'ı kapatmaya
// çalışırken hata fırlatıp TÜM değişimi düşürüyordu ("Simge değiştirilemedi").
export const LEGACY_NATIVE_NAMES = Object.freeze([DEFAULT_NATIVE_NAME, "Glass"]);
export const APP_ICON_IDS = Object.freeze(APP_ICONS.map((i) => i.id));

/** Katalogda var olan bir simge kimliği mi? (depodan okunan değeri doğrulamak için) */
export function isKnownIconId(id) {
  return APP_ICON_IDS.includes(id);
}

/** Yerel ad → katalog kimliği. Bilinmeyen/boş ad varsayılana düşer. */
export function iconIdFromNativeName(nativeName) {
  const found = APP_ICONS.find((i) => i.nativeName === nativeName);
  return found ? found.id : DEFAULT_APP_ICON_ID;
}

/** Katalog kimliği → yerel ad. Bilinmeyen kimlik null döner (çağıran reddetmeli). */
export function nativeNameFromIconId(id) {
  const found = APP_ICONS.find((i) => i.id === id);
  return found ? found.nativeName : null;
}
